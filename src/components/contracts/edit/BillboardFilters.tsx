import React from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Building2, CheckSquare, MapPin, Ruler, Search, Tag, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { MultiSelect } from '@/components/ui/multi-select';
import { STATUS_PALETTE } from '@/lib/billboardStatusPalette';

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
  { value: 'all', label: 'الكل', dot: 'bg-muted-foreground' },
  { value: 'available', label: 'متاح', dot: STATUS_PALETTE.available.dot },
  { value: 'nearExpiry', label: 'قريب الانتهاء', dot: STATUS_PALETTE.reserved.dot },
  { value: 'rented', label: 'مؤجر', dot: STATUS_PALETTE.rented.dot },
  { value: 'maintenance', label: 'صيانة', dot: STATUS_PALETTE.maintenance.dot },
  { value: 'hidden', label: 'مخفية', dot: 'bg-zinc-400' },
];

/** فلاتر اختيار اللوحات في صفحات العقد والعرض: بحث، حالة، ومحددات الموقع والمقاس والفئة */
export function BillboardFilters({
  searchQuery, setSearchQuery, cityFilter, setCityFilter, sizeFilter, setSizeFilter, statusFilter, setStatusFilter,
  pricingCategory, setPricingCategory, cities, sizes, pricingCategories, municipalities = [], municipalityFilter = 'all',
  setMunicipalityFilter, onCleanup, selectedCount = 0, totalCount = 0, onSelectAll, onClearSelection,
  sizeFilters, setSizeFilters, cityFilters, setCityFilters, municipalityFilters, setMunicipalityFilters,
}: BillboardFiltersProps) {
  const useMultiSize = !!(sizeFilters !== undefined && setSizeFilters);
  const useMultiCity = !!(cityFilters !== undefined && setCityFilters);
  const useMultiMunicipality = !!(municipalityFilters !== undefined && setMunicipalityFilters);

  const cityValue = useMultiCity ? cityFilters! : (cityFilter !== 'all' ? [cityFilter] : []);
  const municipalityValue = useMultiMunicipality ? municipalityFilters! : (municipalityFilter !== 'all' ? [municipalityFilter] : []);
  const sizeValue = useMultiSize ? sizeFilters! : (sizeFilter !== 'all' ? [sizeFilter] : []);

  const activeChips: { label: string; onRemove: () => void }[] = [];
  if (searchQuery) activeChips.push({ label: `بحث: ${searchQuery}`, onRemove: () => setSearchQuery('') });
  if (statusFilter !== 'all') activeChips.push({ label: STATUS_OPTIONS.find(s => s.value === statusFilter)?.label || statusFilter, onRemove: () => setStatusFilter('all') });
  if (cityValue.length) activeChips.push({ label: cityValue.length === 1 ? cityValue[0] : `${cityValue.length} مدن`, onRemove: () => useMultiCity ? setCityFilters!([]) : setCityFilter('all') });
  if (municipalityValue.length) activeChips.push({ label: municipalityValue.length === 1 ? municipalityValue[0] : `${municipalityValue.length} بلديات`, onRemove: () => useMultiMunicipality ? setMunicipalityFilters!([]) : setMunicipalityFilter?.('all') });
  if (sizeValue.length) activeChips.push({ label: sizeValue.length === 1 ? sizeValue[0] : `${sizeValue.length} مقاسات`, onRemove: () => useMultiSize ? setSizeFilters!([]) : setSizeFilter('all') });

  const clearAll = () => {
    setSearchQuery('');
    setCityFilter('all');
    setSizeFilter('all');
    setStatusFilter('all');
    setMunicipalityFilter?.('all');
    setSizeFilters?.([]);
    setCityFilters?.([]);
    setMunicipalityFilters?.([]);
  };

  const opts = (list: string[]) => list.map(v => ({ label: v, value: v }));

  return (
    <div className="space-y-3" dir="rtl">
      {/* البحث والعدد */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم، الموقع، البلدية، رقم اللوحة..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="h-10 pl-9 pr-9"
          />
          {searchQuery && (
            <button type="button" onClick={() => setSearchQuery('')} aria-label="مسح البحث"
              className="absolute left-2 top-1/2 -translate-y-1/2 cursor-pointer rounded p-1 text-muted-foreground hover:text-foreground">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        <span className="text-xs text-muted-foreground">
          {totalCount} لوحة{selectedCount > 0 && <> · <span className="font-semibold text-primary">{selectedCount} محددة</span></>}
        </span>
        {onSelectAll && <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={onSelectAll}><CheckSquare className="h-4 w-4" />تحديد الكل</Button>}
        {onClearSelection && selectedCount > 0 && <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-destructive" onClick={onClearSelection}><X className="h-4 w-4" />إلغاء التحديد</Button>}
      </div>

      {/* الحالة */}
      <div role="radiogroup" aria-label="حالة اللوحة" className="no-scrollbar flex gap-1 overflow-x-auto rounded-lg border border-border bg-muted/30 p-1">
        {STATUS_OPTIONS.map(s => {
          const on = statusFilter === s.value;
          return (
            <button key={s.value} type="button" role="radio" aria-checked={on} onClick={() => setStatusFilter(s.value)}
              className={cn('inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-md px-3 text-xs font-semibold transition-colors',
                on ? 'bg-card text-foreground shadow-sm ring-1 ring-primary/40' : 'text-muted-foreground hover:text-foreground')}>
              <span className={cn('h-2 w-2 rounded-full', s.dot)} />{s.label}
            </button>
          );
        })}
      </div>

      {/* المحددات */}
      <div className="grid grid-cols-2 gap-2 xl:grid-cols-4">
        <MultiSelect options={opts(cities)} value={cityValue}
          onChange={useMultiCity ? setCityFilters! : v => setCityFilter(v.length ? v[v.length - 1] : 'all')}
          placeholder="المدينة" emptyText="لا توجد مدن" icon={<Building2 className="h-3.5 w-3.5" />} className="h-10 text-xs" />
        {municipalities.length > 0 && (
          <MultiSelect options={opts(municipalities)} value={municipalityValue}
            onChange={useMultiMunicipality ? setMunicipalityFilters! : v => setMunicipalityFilter?.(v.length ? v[v.length - 1] : 'all')}
            placeholder="البلدية" emptyText="لا توجد بلديات" icon={<MapPin className="h-3.5 w-3.5" />} className="h-10 text-xs" />
        )}
        <MultiSelect options={opts(sizes)} value={sizeValue}
          onChange={useMultiSize ? setSizeFilters! : v => setSizeFilter(v.length ? v[v.length - 1] : 'all')}
          placeholder="المقاس" emptyText="لا توجد مقاسات" icon={<Ruler className="h-3.5 w-3.5" />} className="h-10 text-xs" />
        <MultiSelect options={opts(pricingCategories)} value={pricingCategory ? [pricingCategory] : []}
          onChange={v => setPricingCategory(v.length ? v[v.length - 1] : pricingCategories[0] || '')}
          placeholder="الفئة السعرية" emptyText="لا توجد فئات" icon={<Tag className="h-3.5 w-3.5" />} className="h-10 text-xs" />
      </div>

      {/* الفلاتر النشطة */}
      {(activeChips.length > 0 || onCleanup) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {activeChips.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">
              <span className="max-w-[160px] truncate">{c.label}</span>
              <button type="button" onClick={c.onRemove} aria-label="إزالة الفلتر" className="cursor-pointer rounded hover:text-foreground"><X className="h-3 w-3" /></button>
            </span>
          ))}
          <span className="mr-auto flex items-center gap-1">
            {activeChips.length > 0 && <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs" onClick={clearAll}><X className="h-3.5 w-3.5" />مسح الكل</Button>}
            {onCleanup && <Button variant="ghost" size="sm" className="h-8 gap-1 text-xs text-muted-foreground hover:text-destructive" onClick={onCleanup}><Trash2 className="h-3.5 w-3.5" />تنظيف</Button>}
          </span>
        </div>
      )}
    </div>
  );
}
