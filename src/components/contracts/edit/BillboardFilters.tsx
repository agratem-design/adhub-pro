import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Trash2, X, Filter, Building2, MapPin, Ruler, Tag, SlidersHorizontal } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { MultiSelect } from '@/components/ui/multi-select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface BillboardFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  cityFilter: string;
  setCityFilter: (city: string) => void;
  sizeFilter: string;
  setSizeFilter: (size: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  pricingCategory: string;
  setPricingCategory: (category: string) => void;
  cities: string[];
  sizes: string[];
  pricingCategories: string[];
  municipalities?: string[];
  municipalityFilter?: string;
  setMunicipalityFilter?: (municipality: string) => void;
  onCleanup?: () => void;
  selectedCount?: number;
  totalCount?: number;
  onSelectAll?: () => void;
  onClearSelection?: () => void;
  sizeFilters?: string[];
  setSizeFilters?: (sizes: string[]) => void;
  cityFilters?: string[];
  setCityFilters?: (cities: string[]) => void;
  municipalityFilters?: string[];
  setMunicipalityFilters?: (municipalities: string[]) => void;
  isMapOpen?: boolean;
}

const STATUS_OPTIONS = [
  { value: 'available', label: 'متاح', color: 'bg-emerald-500', ring: 'ring-emerald-500/30' },
  { value: 'nearExpiry', label: 'قريب الانتهاء', color: 'bg-amber-500', ring: 'ring-amber-500/30' },
  { value: 'rented', label: 'مؤجر', color: 'bg-red-500', ring: 'ring-red-500/30' },
  { value: 'maintenance', label: 'صيانة', color: 'bg-orange-500', ring: 'ring-orange-500/30' },
  { value: 'hidden', label: 'مخفية', color: 'bg-purple-500', ring: 'ring-purple-500/30' },
  { value: 'all', label: 'الكل', color: 'bg-muted-foreground', ring: 'ring-muted-foreground/30' },
];

export function BillboardFilters({
  searchQuery,
  setSearchQuery,
  cityFilter,
  setCityFilter,
  sizeFilter,
  setSizeFilter,
  statusFilter,
  setStatusFilter,
  pricingCategory,
  setPricingCategory,
  cities,
  sizes,
  pricingCategories,
  municipalities = [],
  municipalityFilter = 'all',
  setMunicipalityFilter,
  onCleanup,
  selectedCount = 0,
  totalCount = 0,
  onSelectAll,
  onClearSelection,
  sizeFilters,
  setSizeFilters,
  cityFilters,
  setCityFilters,
  municipalityFilters,
  setMunicipalityFilters,
  isMapOpen = false,
}: BillboardFiltersProps) {
  const [filtersOpen, setFiltersOpen] = React.useState(true);

  React.useEffect(() => {
    if (isMapOpen) {
      setFiltersOpen(false);
    }
  }, [isMapOpen]);

  const useMultiSize = !!(sizeFilters !== undefined && setSizeFilters);
  const useMultiCity = !!(cityFilters !== undefined && setCityFilters);
  const useMultiMunicipality = !!(municipalityFilters !== undefined && setMunicipalityFilters);

  const activeCityCount = useMultiCity ? (cityFilters?.length || 0) : (cityFilter !== 'all' ? 1 : 0);
  const activeMunicipalityCount = useMultiMunicipality ? (municipalityFilters?.length || 0) : (municipalityFilter !== 'all' ? 1 : 0);
  const activeSizeCount = useMultiSize ? (sizeFilters?.length || 0) : (sizeFilter !== 'all' ? 1 : 0);

  const hasActiveFilters = activeCityCount > 0 || activeMunicipalityCount > 0 || activeSizeCount > 0 || statusFilter !== 'all' || searchQuery.length > 0;
  const activeFilterCount = [activeCityCount > 0, activeMunicipalityCount > 0, activeSizeCount > 0, statusFilter !== 'all', searchQuery.length > 0].filter(Boolean).length;

  const clearAllFilters = () => {
    setSearchQuery('');
    setCityFilter('all');
    setSizeFilter('all');
    setStatusFilter('all');
    if (setMunicipalityFilter) setMunicipalityFilter('all');
    if (setSizeFilters) setSizeFilters([]);
    if (setCityFilters) setCityFilters([]);
    if (setMunicipalityFilters) setMunicipalityFilters([]);
  };

  const sizeOptions = sizes.map(s => ({ label: s, value: s }));
  const cityOptions = cities.map(c => ({ label: c, value: c }));
  const municipalityOptions = municipalities.map(m => ({ label: m, value: m }));
  const pricingOptions = pricingCategories.map(p => ({ label: p, value: p }));

  // Collect active filter badges for display
  const activeBadges: { label: string; onRemove: () => void }[] = [];
  if (activeCityCount > 0) {
    const label = useMultiCity ? `${activeCityCount} مدينة` : cityFilter;
    activeBadges.push({ label, onRemove: () => useMultiCity ? setCityFilters!([]) : setCityFilter('all') });
  }
  if (activeMunicipalityCount > 0) {
    const label = useMultiMunicipality ? `${activeMunicipalityCount} بلدية` : municipalityFilter;
    activeBadges.push({ label, onRemove: () => useMultiMunicipality ? setMunicipalityFilters!([]) : setMunicipalityFilter?.('all') });
  }
  if (activeSizeCount > 0) {
    const label = useMultiSize ? `${activeSizeCount} مقاس` : sizeFilter;
    activeBadges.push({ label, onRemove: () => useMultiSize ? setSizeFilters!([]) : setSizeFilter('all') });
  }

  return (
    <div className="rounded-2xl border border-amber-500/25 bg-slate-950/40 backdrop-blur-xl shadow-lg overflow-hidden" dir="rtl">
      {/* Top bar: search + stats */}
      <div className="p-2.5 pb-2 space-y-2">
        {/* Header row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1 rounded-md bg-amber-500/10 border border-amber-500/20">
              <Filter className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <span className="text-xs font-bold text-foreground">فلترة اللوحات</span>
            {totalCount > 0 && (
              <span className="text-[10px] text-muted-foreground bg-muted/30 px-1.5 py-0.5 rounded-md">
                {totalCount}
              </span>
            )}
            {selectedCount > 0 && (
              <Badge className="text-[10px] h-4 px-1.5 bg-amber-500/15 text-amber-500 border border-amber-500/20">
                {selectedCount} محددة
              </Badge>
            )}
            {activeFilterCount > 0 && (
              <Badge variant="outline" className="text-[10px] h-4 px-1.5 border-amber-500/40 text-amber-500">
                {activeFilterCount} فلتر نشط
              </Badge>
            )}
          </div>

          <div className="flex items-center gap-1">
            {onSelectAll && (
              <Button variant="ghost" size="sm" onClick={onSelectAll} className="h-6 text-[10px] px-2 text-amber-500 hover:bg-amber-500/10 cursor-pointer">
                تحديد الكل
              </Button>
            )}
            {onClearSelection && selectedCount > 0 && (
              <Button variant="ghost" size="sm" onClick={onClearSelection} className="h-6 text-[10px] px-2 text-destructive hover:bg-destructive/10 cursor-pointer">
                <X className="h-2.5 w-2.5 ml-0.5" />
                إلغاء التحديد
              </Button>
            )}
          </div>
        </div>

        {/* Search bar */}
        <div className="relative">
          <Search className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            placeholder="بحث بالاسم، الموقع، البلدية، رقم اللوحة..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-8 pl-8 h-8 text-xs bg-muted/10 border-border/50 focus:border-amber-500/50 focus:ring-1 focus:ring-amber-500/30 focus:bg-background rounded-xl transition-all duration-200"
            dir="rtl"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors cursor-pointer"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Status pills */}
      <div className="px-2.5 pb-2">
        <div className="flex gap-1 flex-wrap">
          {STATUS_OPTIONS.map((s) => {
            const isActive = statusFilter === s.value;
            return (
              <button
                key={s.value}
                onClick={() => setStatusFilter(s.value)}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all duration-200 cursor-pointer hover:scale-[1.03] active:scale-[0.97]",
                  isActive
                    ? `bg-gradient-to-r from-amber-500 to-amber-600 text-white shadow-md shadow-amber-500/20 ring-1 ring-amber-500/30`
                    : "bg-muted/30 text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                )}
              >
                <span className={cn("h-1.5 w-1.5 rounded-full", s.color)} />
                {s.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Collapsible advanced filters */}
      <Collapsible open={filtersOpen} onOpenChange={setFiltersOpen}>
        <CollapsibleTrigger asChild>
          <button className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] text-muted-foreground hover:text-foreground bg-muted/20 hover:bg-muted/40 border-t border-border/30 transition-colors">
            <SlidersHorizontal className="h-3 w-3" />
            {filtersOpen ? 'إخفاء الفلاتر المتقدمة' : 'عرض الفلاتر المتقدمة'}
            {!filtersOpen && activeFilterCount > 0 && (
              <Badge className="text-[9px] h-3.5 px-1 bg-primary text-primary-foreground">{activeFilterCount}</Badge>
            )}
          </button>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="p-2.5 pt-2 space-y-2 border-t border-border/30 bg-muted/10">
            {/* Filter dropdowns grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-1.5">
              {/* Cities */}
              <MultiSelect
                options={cityOptions}
                value={useMultiCity ? cityFilters! : (cityFilter !== 'all' ? [cityFilter] : [])}
                onChange={useMultiCity ? setCityFilters! : (v) => setCityFilter(v.length > 0 ? v[v.length - 1] : 'all')}
                placeholder="المدن"
                className="h-8 text-[11px]"
                emptyText="لا توجد مدن"
                icon={<Building2 className="h-3 w-3" />}
              />

              {/* Municipalities */}
              {municipalities.length > 0 && (
                <MultiSelect
                  options={municipalityOptions}
                  value={useMultiMunicipality ? municipalityFilters! : (municipalityFilter !== 'all' ? [municipalityFilter] : [])}
                  onChange={useMultiMunicipality ? setMunicipalityFilters! : (v) => setMunicipalityFilter?.(v.length > 0 ? v[v.length - 1] : 'all')}
                  placeholder="البلديات"
                  className="h-8 text-[11px]"
                  emptyText="لا توجد بلديات"
                  icon={<MapPin className="h-3 w-3" />}
                />
              )}

              {/* Sizes */}
              <MultiSelect
                options={sizeOptions}
                value={useMultiSize ? sizeFilters! : (sizeFilter !== 'all' ? [sizeFilter] : [])}
                onChange={useMultiSize ? setSizeFilters! : (v) => setSizeFilter(v.length > 0 ? v[v.length - 1] : 'all')}
                placeholder="المقاسات"
                className="h-8 text-[11px]"
                emptyText="لا توجد مقاسات"
                icon={<Ruler className="h-3 w-3" />}
              />

              {/* Pricing Category */}
              <MultiSelect
                options={pricingOptions}
                value={pricingCategory ? [pricingCategory] : []}
                onChange={(v) => setPricingCategory(v.length > 0 ? v[v.length - 1] : pricingCategories[0] || '')}
                placeholder="الفئة السعرية"
                className="h-8 text-[11px]"
                emptyText="لا توجد فئات"
                icon={<Tag className="h-3 w-3" />}
              />
            </div>

            {/* Active filter badges + clear */}
            {hasActiveFilters && (
              <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/30" dir="rtl">
                <div className="flex flex-wrap gap-1.5 items-center">
                  {activeBadges.map((badge, i) => (
                    <Badge
                      key={i}
                      variant="secondary"
                      className="inline-flex items-center gap-1.5 text-[11px] font-bold px-2 py-0.5 bg-amber-500/15 text-amber-400 border border-amber-500/30 rounded-lg hover:bg-amber-500/25 transition-colors cursor-pointer"
                      dir="rtl"
                    >
                      <button 
                        onClick={(e) => { e.stopPropagation(); badge.onRemove(); }} 
                        className="hover:text-red-400 p-0.5 rounded-full hover:bg-black/30 transition-colors"
                        title="إزالة الفلتر"
                      >
                        <X className="h-3 w-3" />
                      </button>
                      <span className="truncate">{badge.label}</span>
                    </Badge>
                  ))}
                </div>

                <div className="flex items-center gap-1.5 shrink-0" dir="rtl">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={clearAllFilters}
                    className="h-6 text-[11px] font-bold text-muted-foreground hover:text-foreground hover:bg-muted/50 gap-1 px-2 rounded-lg cursor-pointer"
                  >
                    <X className="h-3 w-3" />
                    مسح الكل
                  </Button>
                  {onCleanup && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onCleanup}
                      className="h-6 text-[11px] font-bold text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1 px-2 rounded-lg cursor-pointer"
                    >
                      <Trash2 className="h-3 w-3" />
                      تنظيف
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
