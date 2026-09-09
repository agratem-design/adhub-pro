import React, { useState, useMemo, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Building2,
  Building,
  Layers,
  Search,
  Check,
  CheckCircle2,
  EyeOff,
  SlidersHorizontal,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  HelpCircle,
  X,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react';
import type { Billboard } from '@/types';

export interface CompanyItem {
  id: string;
  name: string;
  brand_color?: string | null;
  company_type?: string | null;
  logo_url?: string | null;
}

export interface CollectionItem {
  id?: string;
  sequence_number: number;
  billboard_id?: number | null;
  billboard_name?: string;
  size: string;
  faces_count: string;
  location_text: string;
  nearest_landmark: string;
  latitude: number | null;
  longitude: number | null;
  item_type: 'existing' | 'new';
  design_face_a?: string | null;
  design_face_b?: string | null;
  image_url?: string | null;
  municipality?: string;
  status?: string;
  overlay_config?: any;
}

const normalizeMuni = (name: string | null | undefined): string => {
  if (!name) return '';
  const clean = String(name).trim();
  const legacyMap: Record<string, string> = {
    'قصر خيار': 'قصر الاخيار',
    'قصر_خيار': 'قصر الاخيار',
    'قصر الخيار': 'قصر الاخيار',
    'القره بوللي': 'القره بوللي',
    'القره_بوللي': 'القره بوللي',
    'القرهبوللي': 'القره بوللي',
    'طرابلس': 'طرابلس المركز',
    'طرابلس القديمة': 'طرابلس المركز',
    'صبراتة': 'صبراته',
    'امسلاته': 'امسلاتة',
    'مسلاتة': 'امسلاتة',
  };
  return legacyMap[clean] || clean;
};

const cleanMuni = (str: string | null | undefined): string => {
  if (!str) return '';
  return String(str)
    .trim()
    .replace(/^(بلدية|مدينة|البلدية|المدينة|منطقة|المنطقة)\s+/gi, '')
    .replace(/^ال/gi, '')
    .trim();
};

export const matchMunicipality = (muniA: string | null | undefined, muniB: string | null | undefined): boolean => {
  if (!muniA || !muniB) return false;
  const rawA = String(muniA).trim();
  const rawB = String(muniB).trim();
  if (rawA === rawB) return true;

  const nA = normalizeMuni(rawA);
  const nB = normalizeMuni(rawB);
  if (nA && nB && nA === nB) return true;

  const cA = cleanMuni(rawA);
  const cB = cleanMuni(rawB);
  if (cA && cB && cA === cB) return true;

  const cNA = cleanMuni(nA);
  const cNB = cleanMuni(nB);
  if (cNA && cNB && cNA === cNB) return true;

  return false;
};

export const isBillboardHidden = (b: any): boolean => {
  if (!b) return false;
  if (b.is_visible_in_available === false) return true;
  if (b.is_visible === false) return true;
  const status = String(b.Status || '').trim();
  if (status === 'مخفي' || status === 'غير متاح' || status === 'لم يتم التركيب') return true;
  return false;
};

export const getInitialBillboardStatus = (b: any): string => {
  if (!b) return 'تم التركيب';
  const status = String(b.Status || '').trim();
  if (status === 'إزالة' || status === 'ازالة') return 'إزالة';
  if (isBillboardHidden(b)) return 'لم يتم التركيب';
  return 'تم التركيب';
};

interface SmartMunicipalityImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allBillboards: any[];
  allCompanies: CompanyItem[];
  municipalities: string[];
  dbSizes: string[];
  sizesList: { name: string; sort_order: number }[];
  existingBillboardIds: Set<number | string>;
  currentMunicipalityName?: string;
  currentCityName?: string;
  loadingBillboards: boolean;
  loadedBillboardsCount: number;
  formatLocationText: (b: any, cityBindValue: string, muniVal?: string) => string;
  onConfirmImport: (newItems: CollectionItem[], municipality: string, city: string, replaceExisting?: boolean) => void;
  onReloadBillboards?: () => void;
  currentItemsCount?: number;
}

type StepType = 'municipality' | 'company' | 'sizes';

export const SmartMunicipalityImportDialog: React.FC<SmartMunicipalityImportDialogProps> = ({
  open,
  onOpenChange,
  allBillboards,
  allCompanies,
  municipalities,
  dbSizes,
  sizesList,
  existingBillboardIds,
  currentMunicipalityName,
  currentCityName,
  loadingBillboards,
  loadedBillboardsCount,
  formatLocationText,
  onConfirmImport,
  onReloadBillboards,
  currentItemsCount = 0,
}) => {
  const [step, setStep] = useState<StepType>('municipality');
  const [searchMunicipality, setSearchMunicipality] = useState('');
  const [searchCompany, setSearchCompany] = useState('');
  const [selectedMunicipality, setSelectedMunicipality] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('all'); // 'all' | 'unassigned' | companyId
  const [sizeMappings, setSizeMappings] = useState<Record<string, string>>({});
  const [importMode, setImportMode] = useState<'replace' | 'append'>('replace');

  // Reset dialog state when opened: ALWAYS start on Step 1 (اختيار البلدية)
  useEffect(() => {
    if (open) {
      setStep('municipality');
      setSelectedMunicipality(null);
      setSelectedCompanyId('all');
      setSearchMunicipality('');
      setSearchCompany('');
      setSizeMappings({});
      setImportMode('replace');
    }
  }, [open]);

  // All billboards in the chosen municipality (matched intelligently)
  const municipalityBillboards = useMemo(() => {
    if (!selectedMunicipality) return [];
    return allBillboards.filter(b => matchMunicipality(b.Municipality, selectedMunicipality));
  }, [allBillboards, selectedMunicipality]);

  // Company breakdown for the selected municipality
  const companyBreakdown = useMemo(() => {
    if (!selectedMunicipality || municipalityBillboards.length === 0) {
      return {
        allTotal: 0,
        allInstalled: 0,
        allHidden: 0,
        allRemoval: 0,
        companies: [],
        unassignedTotal: 0,
        unassignedInstalled: 0,
        unassignedHidden: 0,
        unassignedRemoval: 0,
      };
    }

    let allTotal = 0;
    let allInstalled = 0;
    let allHidden = 0;
    let allRemoval = 0;

    let unassignedTotal = 0;
    let unassignedInstalled = 0;
    let unassignedHidden = 0;
    let unassignedRemoval = 0;

    const companyMap = new Map<
      string,
      {
        company: CompanyItem;
        total: number;
        installed: number;
        hidden: number;
        removal: number;
      }
    >();

    municipalityBillboards.forEach(b => {
      allTotal++;
      const isHidden = isBillboardHidden(b);
      const isRemoval = (b.Status || '').trim() === 'إزالة' || (b.Status || '').trim() === 'ازالة';

      if (isRemoval) allRemoval++;
      else if (isHidden) allHidden++;
      else allInstalled++;

      const compId = b.own_company_id || b.friend_company_id;
      if (compId) {
        if (!companyMap.has(compId)) {
          const compObj = allCompanies.find(c => c.id === compId) || {
            id: compId,
            name: b.own_company_id ? 'شركة مالكة غير مسجلة' : 'شركة صديقة غير مسجلة',
            company_type: b.own_company_id ? 'own' : 'friend',
            brand_color: null,
          };
          companyMap.set(compId, {
            company: compObj,
            total: 0,
            installed: 0,
            hidden: 0,
            removal: 0,
          });
        }
        const entry = companyMap.get(compId)!;
        entry.total++;
        if (isRemoval) entry.removal++;
        else if (isHidden) entry.hidden++;
        else entry.installed++;
      } else {
        unassignedTotal++;
        if (isRemoval) unassignedRemoval++;
        else if (isHidden) unassignedHidden++;
        else unassignedInstalled++;
      }
    });

    const companiesList = Array.from(companyMap.values()).sort((a, b) => b.total - a.total);

    return {
      allTotal,
      allInstalled,
      allHidden,
      allRemoval,
      companies: companiesList,
      unassignedTotal,
      unassignedInstalled,
      unassignedHidden,
      unassignedRemoval,
    };
  }, [selectedMunicipality, municipalityBillboards, allCompanies]);

  // Filtered billboards based on chosen company and municipality
  const targetBillboards = useMemo(() => {
    if (!selectedMunicipality) return [];
    let list = municipalityBillboards;

    if (selectedCompanyId === 'unassigned') {
      list = list.filter(b => !b.own_company_id && !b.friend_company_id);
    } else if (selectedCompanyId !== 'all') {
      list = list.filter(
        b => b.own_company_id === selectedCompanyId || b.friend_company_id === selectedCompanyId
      );
    }
    return list;
  }, [municipalityBillboards, selectedCompanyId, selectedMunicipality]);

  // Billboards to import based on mode (replace vs append)
  const newBillboardsToImport = useMemo(() => {
    if (importMode === 'replace') {
      return targetBillboards;
    }
    return targetBillboards.filter(b => !existingBillboardIds.has(b.ID));
  }, [targetBillboards, existingBillboardIds, importMode]);

  const alreadyImportedCount = useMemo(() => {
    return targetBillboards.filter(b => existingBillboardIds.has(b.ID)).length;
  }, [targetBillboards, existingBillboardIds]);

  // Distinct sizes in the pending batch with counts
  const distinctSizesWithCounts = useMemo(() => {
    const sizeCounts: Record<string, number> = {};
    newBillboardsToImport.forEach(b => {
      const s = b.Size || 'بدون مقاس';
      sizeCounts[s] = (sizeCounts[s] || 0) + 1;
    });
    return Object.entries(sizeCounts)
      .map(([size, count]) => ({ size, count }))
      .sort((a, b) => b.count - a.count);
  }, [newBillboardsToImport]);

  // Initialize size mappings when entering Step 3
  useEffect(() => {
    if (step === 'sizes') {
      const initial: Record<string, string> = {};
      distinctSizesWithCounts.forEach(({ size }) => {
        initial[size] = size;
      });
      setSizeMappings(initial);
    }
  }, [step, distinctSizesWithCounts]);

  // Calculate status breakdown for the new batch
  const pendingBatchStatusCounts = useMemo(() => {
    let installed = 0;
    let hidden = 0;
    let removal = 0;

    newBillboardsToImport.forEach(b => {
      const isHidden = isBillboardHidden(b);
      const isRemoval = (b.Status || '').trim() === 'إزالة' || (b.Status || '').trim() === 'ازالة';
      if (isRemoval) removal++;
      else if (isHidden) hidden++;
      else installed++;
    });

    return { installed, hidden, removal };
  }, [newBillboardsToImport]);

  const getSizeSortOrder = (sizeStr: string) => {
    if (!sizeStr) return 99999;
    const normalize = (str: string) =>
      str
        .replace(/×/g, 'x')
        .replace(/X/g, 'x')
        .replace(/\*/g, 'x')
        .replace(/\s+/g, '')
        .trim()
        .toLowerCase();
    const normalized = normalize(sizeStr);
    const found = sizesList.find(s => normalize(s.name) === normalized);
    if (found) return found.sort_order;
    return 99999;
  };

  const handleSelectMunicipality = (muni: string) => {
    setSelectedMunicipality(muni);
    setSelectedCompanyId('all');
    setStep('company');
  };

  const handleConfirmAndExecute = () => {
    if (!selectedMunicipality || newBillboardsToImport.length === 0) return;

    // Apply size mappings
    const mappedBillboards = newBillboardsToImport.map(b => {
      const srcSize = b.Size || 'بدون مقاس';
      const mapped = sizeMappings[srcSize] || srcSize;
      return {
        ...b,
        Size: mapped === 'بدون مقاس' ? null : mapped,
      };
    });

    // Sort by sort_order of sizes, falling back to billboard ID
    const sorted = [...mappedBillboards].sort((a, b) => {
      const orderA = getSizeSortOrder(a.Size || '');
      const orderB = getSizeSortOrder(b.Size || '');
      if (orderA !== orderB) return orderA - orderB;
      return (a.ID || 0) - (b.ID || 0);
    });

    const firstCity = !currentCityName ? sorted.find(b => b.City)?.City || '' : currentCityName;

    const newItems: CollectionItem[] = sorted.map((b, idx) => {
      const coords = b.GPS_Coordinates?.split(',').map((c: string) => parseFloat(c.trim()));
      const statusToUse = getInitialBillboardStatus(b);

      return {
        sequence_number: idx + 1, // Parent will re-index properly based on collection items
        billboard_id: b.ID,
        billboard_name: b.Billboard_Name || `لوحة ${b.ID}`,
        size: b.Size || '',
        faces_count: b.Faces_Count ? (b.Faces_Count === 1 ? 'وجه' : 'وجهين') : 'وجهين',
        location_text: formatLocationText(b, firstCity, selectedMunicipality),
        nearest_landmark: b.Nearest_Landmark || '',
        latitude: coords?.[0] || null,
        longitude: coords?.[1] || null,
        item_type: 'existing',
        design_face_a: b.design_face_a,
        design_face_b: b.design_face_b,
        image_url: b.Image_URL,
        municipality: selectedMunicipality,
        status: statusToUse,
      };
    });

    onConfirmImport(
      newItems,
      selectedMunicipality,
      firstCity,
      currentItemsCount > 0 ? importMode === 'replace' : true
    );
    onOpenChange(false);
  };

  const getCompanyName = (id: string) => {
    if (id === 'all') return 'جميع الشركات (كافة اللوحات)';
    if (id === 'unassigned') return 'لوحات بدون شركة محددة';
    const found = allCompanies.find(c => c.id === id);
    return found ? found.name : 'شركة محددة';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl border-border/20 rounded-3xl bg-background/98 backdrop-blur-xl flex flex-col max-h-[88vh] p-6 shadow-2xl transition-all duration-200">
        {/* Header with Stepper */}
        <DialogHeader className="shrink-0 pb-3 border-b border-border/10 space-y-3 text-right">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-2.5 rounded-2xl bg-primary/10 text-primary border border-primary/20">
                <Building2 className="h-5 w-5" />
              </div>
              <div>
                <DialogTitle className="text-lg font-bold text-foreground">
                  جلب لوحات بلدية كاملة
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  جلب وترتيب لوحات البلدية مع تصفية الشركة المالكة وتصنيف اللوحات المخفية
                </DialogDescription>
              </div>
            </div>

            {/* Stepper Indicators */}
            <div className="flex items-center gap-1 bg-muted/30 p-1 rounded-xl border border-border/10 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setStep('municipality')}
                className={`px-2.5 py-1 rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                  step === 'municipality'
                    ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                    : selectedMunicipality
                    ? 'text-foreground hover:bg-muted/50'
                    : 'text-muted-foreground'
                }`}
              >
                <span>1. البلدية</span>
                {selectedMunicipality && step !== 'municipality' && (
                  <Check className="h-3 w-3 text-emerald-500" />
                )}
              </button>

              <ChevronLeft className="h-3 w-3 text-muted-foreground/40 shrink-0" />

              <button
                type="button"
                disabled={!selectedMunicipality}
                onClick={() => selectedMunicipality && setStep('company')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                  !selectedMunicipality
                    ? 'opacity-40 cursor-not-allowed'
                    : 'cursor-pointer ' +
                      (step === 'company'
                        ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                        : 'text-foreground hover:bg-muted/50')
                }`}
              >
                <span>2. الشركة</span>
              </button>

              <ChevronLeft className="h-3 w-3 text-muted-foreground/40 shrink-0" />

              <button
                type="button"
                disabled={!selectedMunicipality}
                onClick={() => selectedMunicipality && setStep('sizes')}
                className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                  !selectedMunicipality
                    ? 'opacity-40 cursor-not-allowed'
                    : 'cursor-pointer ' +
                      (step === 'sizes'
                        ? 'bg-primary text-primary-foreground shadow-xs font-bold'
                        : 'text-foreground hover:bg-muted/50')
                }`}
              >
                <span>3. المقاسات والحالات</span>
              </button>
            </div>
          </div>
        </DialogHeader>

        {/* ================= STEP 1: اختيار البلدية ================= */}
        {step === 'municipality' && (
          <div className="space-y-3.5 py-3 flex-1 overflow-hidden flex flex-col min-h-0">
            <div className="relative shrink-0">
              <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchMunicipality}
                onChange={e => setSearchMunicipality(e.target.value)}
                placeholder="بحث عن بلدية..."
                className="rounded-2xl border-border/20 bg-background/50 h-11 pr-10 pl-9 text-sm focus-visible:ring-primary"
              />
              {searchMunicipality && (
                <button
                  type="button"
                  onClick={() => setSearchMunicipality('')}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer p-0.5"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="flex-1 overflow-hidden border border-border/15 rounded-2xl bg-muted/5">
              <ScrollArea className="h-full">
                <div className="space-y-2 p-3">
                  {loadingBillboards && (
                    <div className="text-center py-12 text-xs text-muted-foreground flex flex-col items-center justify-center gap-3">
                      <div className="w-7 h-7 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                      <span>جاري تحميل بيانات اللوحات من السيرفر ({loadedBillboardsCount} لوحة)...</span>
                    </div>
                  )}

                  {!loadingBillboards && currentMunicipalityName && !searchMunicipality && (
                    <div className="mb-2.5 p-3.5 rounded-2xl bg-gradient-to-r from-primary/15 to-primary/5 border border-primary/30 flex items-center justify-between shadow-xs">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl bg-primary text-primary-foreground">
                          <Building2 className="h-4.5 w-4.5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-foreground">
                              بلدية المنظم الحالية: {currentMunicipalityName}
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] font-semibold border-primary/30 bg-primary/20 text-primary"
                            >
                              البلدية الحالية
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground mt-0.5 block font-medium">
                            يوجد {allBillboards.filter(b => matchMunicipality(b.Municipality, currentMunicipalityName)).length} لوحة مسجلة
                          </span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleSelectMunicipality(currentMunicipalityName)}
                        className="rounded-xl h-9 bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-bold gap-1.5 cursor-pointer px-3.5 shadow-sm"
                      >
                        <span>اختيار والمتابعة</span>
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  )}

                  {!loadingBillboards &&
                    municipalities
                      .filter(m => !searchMunicipality || m.toLowerCase().includes(searchMunicipality.toLowerCase()))
                      .map(m => {
                        const count = allBillboards.filter(b => matchMunicipality(b.Municipality, m)).length;
                        const isCurrentActive = matchMunicipality(currentMunicipalityName, m);
                        const isSelected = matchMunicipality(selectedMunicipality, m);

                        return (
                          <div
                            key={m}
                            className={`flex items-center justify-between p-3.5 border rounded-2xl cursor-pointer transition-all duration-200 group/mun ${
                              isSelected
                                ? 'border-primary bg-primary/10 shadow-xs'
                                : 'border-border/15 bg-card/60 hover:bg-muted/70 hover:border-primary/30'
                            }`}
                            onClick={() => handleSelectMunicipality(m)}
                          >
                            <div className="flex items-center gap-3">
                              <div
                                className={`p-2.5 rounded-xl transition-colors ${
                                  isSelected
                                    ? 'bg-primary text-primary-foreground'
                                    : 'bg-primary/5 text-primary group-hover/mun:bg-primary group-hover/mun:text-primary-foreground'
                                }`}
                              >
                                <Building2 className="h-4 w-4" />
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-foreground">{m}</span>
                                {isCurrentActive && (
                                  <Badge
                                    variant="outline"
                                    className="rounded-lg text-[10px] font-semibold border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                  >
                                    البلدية الحالية
                                  </Badge>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <Badge
                                variant="secondary"
                                className="rounded-xl font-mono text-xs px-2.5 py-1 bg-muted/60 text-foreground font-bold"
                              >
                                {count} لوحة
                              </Badge>
                              <ChevronLeft className="h-4 w-4 text-muted-foreground/50 group-hover/mun:text-primary transition-transform group-hover/mun:-translate-x-0.5" />
                            </div>
                          </div>
                        );
                      })}

                  {!loadingBillboards &&
                    municipalities.filter(
                      m => !searchMunicipality || m.toLowerCase().includes(searchMunicipality.toLowerCase())
                    ).length === 0 && (
                      <div className="text-center py-12 text-muted-foreground text-xs">
                        لا توجد بلديات مطابقة للبحث
                      </div>
                    )}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}

        {/* ================= STEP 2: اختيار الشركة المالكة ================= */}
        {step === 'company' && selectedMunicipality && (
          <div className="space-y-3.5 py-3 flex-1 overflow-hidden flex flex-col min-h-0">
            {/* Municipality info chip banner */}
            <div className="flex items-center justify-between p-3 rounded-2xl bg-primary/5 border border-primary/15 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="p-1.5 rounded-xl bg-primary/10 text-primary">
                  <Building2 className="h-4 w-4" />
                </div>
                <div>
                  <span className="text-xs text-muted-foreground block">البلدية المحددة:</span>
                  <span className="text-sm font-bold text-foreground">{selectedMunicipality}</span>
                </div>
                <Badge variant="secondary" className="mr-2 font-mono text-xs">
                  {companyBreakdown.allTotal} لوحة إجمالاً
                </Badge>
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => setStep('municipality')}
                className="h-8 rounded-xl text-xs text-muted-foreground hover:text-foreground cursor-pointer gap-1"
              >
                <span>تغيير البلدية</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>

            <div className="flex items-center justify-between shrink-0">
              <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Building className="h-3.5 w-3.5 text-primary" />
                اختر الشركة المالكة أو كافة الشركات:
              </Label>
              <span className="text-[11px] text-muted-foreground">
                حدد نطاق الجلب لتصفية اللوحات حسب ملكيتها
              </span>
            </div>

            {/* Companies List */}
            <div className="flex-1 overflow-hidden border border-border/15 rounded-2xl bg-muted/5">
              <ScrollArea className="h-full">
                <div className="space-y-2.5 p-3">
                  {/* OPTION 1: ALL COMPANIES (جميع الشركات) */}
                  <div
                    onClick={() => setSelectedCompanyId('all')}
                    className={`p-4 border rounded-2xl cursor-pointer transition-all duration-200 relative ${
                      selectedCompanyId === 'all'
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/20 shadow-xs'
                        : 'border-border/15 bg-card/60 hover:bg-muted/70 hover:border-primary/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div
                          className={`p-2.5 rounded-xl transition-colors ${
                            selectedCompanyId === 'all'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-primary/10 text-primary'
                          }`}
                        >
                          <Layers className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-black text-sm text-foreground">
                              جميع الشركات (كافة لوحات البلدية)
                            </span>
                            <Badge
                              variant="outline"
                              className="text-[10px] font-semibold border-primary/30 bg-primary/10 text-primary"
                            >
                              شامل
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground mt-0.5 block">
                            جلب كافة لوحات بلدية "{selectedMunicipality}" بغض النظر عن الشركة المالكة
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge
                          variant="secondary"
                          className="rounded-xl font-mono text-sm px-3 py-1 font-bold bg-background text-foreground border border-border/15"
                        >
                          {companyBreakdown.allTotal} لوحة
                        </Badge>
                        <div
                          className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                            selectedCompanyId === 'all'
                              ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-muted-foreground/30'
                          }`}
                        >
                          {selectedCompanyId === 'all' && <Check className="h-3 w-3 stroke-[3]" />}
                        </div>
                      </div>
                    </div>

                    {/* Breakdown sub-tags */}
                    <div className="mt-3 pt-2.5 border-t border-border/10 flex items-center gap-2 flex-wrap text-xs">
                      <span className="text-[11px] text-muted-foreground font-semibold">توزيع الحالات:</span>
                      <Badge
                        variant="outline"
                        className="rounded-lg text-[11px] font-medium border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1"
                      >
                        <CheckCircle2 className="h-3 w-3" />
                        <span>{companyBreakdown.allInstalled} تم التركيب (نشطة)</span>
                      </Badge>
                      {companyBreakdown.allHidden > 0 && (
                        <Badge
                          variant="outline"
                          className="rounded-lg text-[11px] font-medium border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1"
                        >
                          <EyeOff className="h-3 w-3" />
                          <span>{companyBreakdown.allHidden} لم يتم التركيب (لوحات مخفية)</span>
                        </Badge>
                      )}
                      {companyBreakdown.allRemoval > 0 && (
                        <Badge
                          variant="outline"
                          className="rounded-lg text-[11px] font-medium border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400 gap-1"
                        >
                          <AlertTriangle className="h-3 w-3" />
                          <span>{companyBreakdown.allRemoval} إزالة</span>
                        </Badge>
                      )}
                    </div>
                  </div>

                  {/* OPTION 2: INDIVIDUAL COMPANIES (الشركات المالكة) */}
                  {companyBreakdown.companies.map(({ company, total, installed, hidden, removal }) => {
                    const isSelected = selectedCompanyId === company.id;
                    const isOwn = company.company_type === 'own';

                    return (
                      <div
                        key={company.id}
                        onClick={() => setSelectedCompanyId(company.id)}
                        className={`p-3.5 border rounded-2xl cursor-pointer transition-all duration-200 ${
                          isSelected
                            ? 'border-primary bg-primary/10 ring-2 ring-primary/20 shadow-xs'
                            : 'border-border/15 bg-card/60 hover:bg-muted/70 hover:border-primary/30'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div
                              className="w-10 h-10 rounded-xl flex items-center justify-center font-bold text-white shadow-xs shrink-0"
                              style={{ backgroundColor: company.brand_color || '#d6ac40' }}
                            >
                              <Building className="h-5 w-5" />
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-foreground">{company.name}</span>
                                <Badge
                                  variant="outline"
                                  className={`text-[10px] font-semibold ${
                                    isOwn
                                      ? 'border-primary/30 bg-primary/10 text-primary'
                                      : 'border-blue-500/30 bg-blue-500/10 text-blue-600 dark:text-blue-400'
                                  }`}
                                >
                                  {isOwn ? 'شركة مالكة' : 'شركة صديقة'}
                                </Badge>
                              </div>
                              <span className="text-xs text-muted-foreground mt-0.5 block">
                                لوحات تابعة لـ {company.name} في بلدية {selectedMunicipality}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge
                              variant="secondary"
                              className="rounded-xl font-mono text-xs px-2.5 py-1 font-bold"
                            >
                              {total} لوحة
                            </Badge>
                            <div
                              className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                                isSelected
                                  ? 'border-primary bg-primary text-primary-foreground'
                                  : 'border-muted-foreground/30'
                              }`}
                            >
                              {isSelected && <Check className="h-3 w-3 stroke-[3]" />}
                            </div>
                          </div>
                        </div>

                        {/* Breakdown sub-tags */}
                        <div className="mt-2.5 pt-2 border-t border-border/10 flex items-center gap-2 flex-wrap text-xs">
                          <Badge
                            variant="outline"
                            className="rounded-lg text-[10px] font-medium border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1"
                          >
                            <CheckCircle2 className="h-3 w-3" />
                            <span>{installed} تم التركيب</span>
                          </Badge>
                          {hidden > 0 && (
                            <Badge
                              variant="outline"
                              className="rounded-lg text-[10px] font-medium border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1"
                            >
                              <EyeOff className="h-3 w-3" />
                              <span>{hidden} لم يتم التركيب (مخفية)</span>
                            </Badge>
                          )}
                          {removal > 0 && (
                            <Badge
                              variant="outline"
                              className="rounded-lg text-[10px] font-medium border-rose-500/25 bg-rose-500/10 text-rose-600 dark:text-rose-400 gap-1"
                            >
                              <AlertTriangle className="h-3 w-3" />
                              <span>{removal} إزالة</span>
                            </Badge>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {/* OPTION 3: UNASSIGNED (لوحات بدون شركة محددة) */}
                  {companyBreakdown.unassignedTotal > 0 && (
                    <div
                      onClick={() => setSelectedCompanyId('unassigned')}
                      className={`p-3.5 border rounded-2xl cursor-pointer transition-all duration-200 ${
                        selectedCompanyId === 'unassigned'
                          ? 'border-primary bg-primary/10 ring-2 ring-primary/20 shadow-xs'
                          : 'border-border/15 bg-card/60 hover:bg-muted/70 hover:border-primary/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="p-2.5 rounded-xl bg-muted/60 text-muted-foreground">
                            <HelpCircle className="h-5 w-5" />
                          </div>
                          <div>
                            <span className="font-bold text-sm text-foreground">
                              لوحات بدون شركة محددة (غير منسوبة)
                            </span>
                            <span className="text-xs text-muted-foreground mt-0.5 block">
                              لوحات لا تتبع لأي شركة مالكة أو صديقة مسجلة
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <Badge
                            variant="secondary"
                            className="rounded-xl font-mono text-xs px-2.5 py-1 font-bold"
                          >
                            {companyBreakdown.unassignedTotal} لوحة
                          </Badge>
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                              selectedCompanyId === 'unassigned'
                                ? 'border-primary bg-primary text-primary-foreground'
                              : 'border-muted-foreground/30'
                            }`}
                          >
                            {selectedCompanyId === 'unassigned' && <Check className="h-3 w-3 stroke-[3]" />}
                          </div>
                        </div>
                      </div>

                      <div className="mt-2.5 pt-2 border-t border-border/10 flex items-center gap-2 flex-wrap text-xs">
                        <Badge
                          variant="outline"
                          className="rounded-lg text-[10px] font-medium border-emerald-500/25 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1"
                        >
                          <CheckCircle2 className="h-3 w-3" />
                          <span>{companyBreakdown.unassignedInstalled} تم التركيب</span>
                        </Badge>
                        {companyBreakdown.unassignedHidden > 0 && (
                          <Badge
                            variant="outline"
                            className="rounded-lg text-[10px] font-medium border-amber-500/25 bg-amber-500/10 text-amber-600 dark:text-amber-400 gap-1"
                          >
                            <EyeOff className="h-3 w-3" />
                            <span>{companyBreakdown.unassignedHidden} لم يتم التركيب (مخفية)</span>
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {loadingBillboards && (
                    <div className="p-12 text-center space-y-3 bg-background/50 rounded-2xl border border-border/15 my-4 flex flex-col items-center justify-center">
                      <div className="w-8 h-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-foreground">
                          جاري تحميل وتحديث لوحات بلدية "{selectedMunicipality}"...
                        </p>
                        <p className="text-xs text-muted-foreground">
                          تم تحميل {loadedBillboardsCount} لوحة من السيرفر حتى الآن
                        </p>
                      </div>
                    </div>
                  )}

                  {!loadingBillboards && companyBreakdown.allTotal === 0 && (
                    <div className="p-8 text-center space-y-3 bg-background/50 rounded-2xl border border-border/15 my-4">
                      <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center mx-auto">
                        <AlertTriangle className="h-6 w-6" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-bold text-foreground">
                          لا توجد لوحات مسجلة لبلدية "{selectedMunicipality}"
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {allBillboards.length === 0
                            ? 'لم يتم تحميل أي لوحات من قاعدة البيانات بعد، يمكنك النقر على زر إعادة التحميل أدناه.'
                            : 'يمكنك الرجوع لاختيار بلدية أخرى من قائمة البلديات.'}
                        </p>
                      </div>
                      <div className="flex items-center justify-center gap-2 pt-2">
                        {onReloadBillboards && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={onReloadBillboards}
                            className="rounded-xl text-xs font-bold cursor-pointer gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
                          >
                            <RotateCcw className="h-4 w-4" />
                            <span>إعادة تحميل اللوحات</span>
                          </Button>
                        )}
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setStep('municipality')}
                          className="rounded-xl text-xs font-bold cursor-pointer gap-1.5"
                        >
                          <ChevronRight className="h-4 w-4" />
                          <span>الرجوع لاختيار بلدية أخرى</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}

        {/* ================= STEP 3: مراجعة المقاسات والحالات والتأكيد ================= */}
        {step === 'sizes' && selectedMunicipality && (
          <div className="space-y-3.5 py-3 flex-1 overflow-hidden flex flex-col min-h-0">
            {/* Summary Banner */}
            <div className="p-3.5 rounded-2xl bg-card/70 border border-border/15 shrink-0 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="border-primary/20 bg-primary/5 text-primary font-bold">
                    البلدية: {selectedMunicipality}
                  </Badge>
                  <Badge variant="outline" className="border-border/30 bg-muted/40 font-bold">
                    الشركة: {getCompanyName(selectedCompanyId)}
                  </Badge>
                </div>
                <span className="font-mono font-bold text-foreground">
                  المجموع للاستيراد: {newBillboardsToImport.length} لوحة
                </span>
              </div>

              {currentItemsCount > 0 && (
                <div className="pt-2 border-t border-border/10 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-foreground flex items-center gap-1">
                      <Layers className="h-3 w-3 text-primary" />
                      طريقة الإدراج في منظم اللوحات:
                    </span>
                    <span className="text-[10px] text-muted-foreground font-semibold">
                      (الجدول الحالي يحتوي على {currentItemsCount} لوحة)
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setImportMode('replace')}
                      className={`p-2 rounded-xl border text-right transition-all flex flex-col gap-0.5 cursor-pointer ${
                        importMode === 'replace'
                          ? 'border-primary bg-primary/10 text-primary shadow-xs font-bold'
                          : 'border-border/20 bg-background/50 text-muted-foreground hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">استبدال الجدول بالكامل (يوصى به)</span>
                        {importMode === 'replace' && <Check className="h-3 w-3 text-primary" />}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        مسح اللوحات السابقة وإدراج {targetBillboards.length} لوحة نظيفة ومطابقة 100%
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setImportMode('append')}
                      className={`p-2 rounded-xl border text-right transition-all flex flex-col gap-0.5 cursor-pointer ${
                        importMode === 'append'
                          ? 'border-primary bg-primary/10 text-primary shadow-xs font-bold'
                          : 'border-border/20 bg-background/50 text-muted-foreground hover:bg-muted/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold">إلحاق بالجدول الحالي</span>
                        {importMode === 'append' && <Check className="h-3 w-3 text-primary" />}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        إضافة اللوحات الجديدة أسفل الـ {currentItemsCount} لوحة الحالية
                      </span>
                    </button>
                  </div>
                </div>
              )}

              {importMode === 'append' && alreadyImportedCount > 0 && (
                <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 bg-muted/20 px-2 py-1 rounded-lg">
                  <Sparkles className="h-3 w-3 text-amber-500" />
                  <span>تم استبعاد {alreadyImportedCount} لوحة لأنها مضافة مسبقاً إلى منظم اللوحات.</span>
                </div>
              )}
            </div>

            {/* Smart Classification Alert */}
            <div className="p-3.5 rounded-2xl bg-gradient-to-r from-primary/5 via-amber-500/5 to-emerald-500/5 border border-primary/20 shrink-0 space-y-2">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary shrink-0" />
                <span className="text-xs font-bold text-foreground">التصنيف الذكي للحالات المعتمد:</span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <div className="flex items-center justify-between p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <div className="flex items-center gap-1.5 font-bold">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>تم التركيب (لوحات نشطة)</span>
                  </div>
                  <span className="font-mono font-bold">{pendingBatchStatusCounts.installed} لوحة</span>
                </div>

                <div className="flex items-center justify-between p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400">
                  <div className="flex items-center gap-1.5 font-bold">
                    <EyeOff className="h-3.5 w-3.5" />
                    <span>لم يتم التركيب (لوحات مخفية)</span>
                  </div>
                  <span className="font-mono font-bold">{pendingBatchStatusCounts.hidden} لوحة</span>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed">
                * يتم تلقائياً تصنيف اللوحات غير المفعلة في المتاح أو الموسومة كـ "مخفي" بالحالة <strong>لم يتم التركيب</strong> لتسهيل متابعتها ومطابقتها.
              </p>
            </div>

            {/* Sizes Review & Mapping */}
            <div className="space-y-1.5 flex-1 overflow-hidden flex flex-col min-h-0">
              <div className="flex items-center justify-between shrink-0 px-1">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                  مراجعة وتوحيد مقاسات اللوحات ({distinctSizesWithCounts.length} مقاس):
                </Label>
                <span className="text-[11px] text-muted-foreground">
                  يمكنك الإبقاء على المقاس أو ربطه بمقاس قياسي
                </span>
              </div>

              <div className="flex-1 overflow-hidden border border-border/15 rounded-2xl bg-muted/5 p-1">
                <ScrollArea className="h-full">
                  <div className="space-y-2 p-2">
                    {distinctSizesWithCounts.map(({ size, count }) => {
                      const currentTarget = sizeMappings[size] || size;
                      return (
                        <div
                          key={size}
                          className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-3 border border-border/10 rounded-xl bg-card/60 hover:bg-card transition-all"
                        >
                          <div className="flex items-center gap-2">
                            <Badge
                              variant="outline"
                              className="rounded-lg px-2.5 py-1 text-xs border-primary/30 bg-primary/5 text-primary font-bold font-mono"
                            >
                              {size}
                            </Badge>
                            <span className="text-xs text-muted-foreground font-semibold">
                              ({count} لوحة)
                            </span>
                          </div>

                          <div className="flex items-center gap-2">
                            <span className="text-xs text-muted-foreground font-medium shrink-0">
                              تغيير إلى:
                            </span>

                            <Select
                              value={currentTarget}
                              onValueChange={val => {
                                setSizeMappings(prev => ({ ...prev, [size]: val }));
                              }}
                            >
                              <SelectTrigger className="h-8.5 w-32 rounded-xl bg-background border-border/20 text-xs font-semibold">
                                <SelectValue placeholder="اختر المقاس" />
                              </SelectTrigger>
                              <SelectContent className="rounded-xl border-border/20 max-h-56">
                                {[
                                  ...new Set([
                                    currentTarget,
                                    ...distinctSizesWithCounts.map(x => x.size),
                                    ...dbSizes,
                                  ]),
                                ]
                                  .filter(Boolean)
                                  .map(s => (
                                    <SelectItem key={s} value={s} className="text-xs">
                                      {s}
                                    </SelectItem>
                                  ))}
                              </SelectContent>
                            </Select>

                            <Input
                              value={currentTarget}
                              onChange={e => {
                                const val = e.target.value;
                                setSizeMappings(prev => ({ ...prev, [size]: val }));
                              }}
                              placeholder="كتابة يدوية..."
                              className="h-8.5 w-28 rounded-xl bg-background border-border/20 text-xs font-semibold"
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </ScrollArea>
              </div>
            </div>
          </div>
        )}

        {/* Footer Navigation */}
        <DialogFooter className="gap-2 mt-2 pt-3 border-t border-border/10 shrink-0 flex flex-col-reverse sm:flex-row sm:justify-between">
          <div>
            {step !== 'municipality' && (
              <Button
                variant="outline"
                onClick={() => {
                  if (step === 'sizes') setStep('company');
                  else if (step === 'company') setStep('municipality');
                }}
                className="rounded-xl h-10 cursor-pointer gap-1.5 text-xs font-bold"
              >
                <ArrowRight className="h-4 w-4" />
                <span>الرجوع</span>
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="rounded-xl h-10 cursor-pointer text-xs font-bold"
            >
              إلغاء
            </Button>

            {step === 'company' && (
              <Button
                onClick={() => setStep('sizes')}
                disabled={newBillboardsToImport.length === 0}
                className="rounded-xl h-10 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer gap-1.5 text-xs font-bold px-5"
              >
                <span>متابعة للمقاسات والتأكيد</span>
                <ArrowLeft className="h-4 w-4" />
              </Button>
            )}

            {step === 'sizes' && (
              <Button
                onClick={handleConfirmAndExecute}
                disabled={newBillboardsToImport.length === 0}
                className="rounded-xl h-10 bg-primary hover:bg-primary/90 text-primary-foreground cursor-pointer gap-1.5 text-xs font-bold px-6 shadow-md"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>تأكيد واستيراد {newBillboardsToImport.length} لوحة</span>
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
