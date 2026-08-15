import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { SearchInputWithHistory } from '@/components/ui/SearchInputWithHistory';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandGroup, CommandInput, CommandItem, CommandList, CommandEmpty } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import MultiSelect from '@/components/ui/multi-select';
import { 
  Filter, Search, LayoutGrid, MapPin, Maximize2, Building2, Megaphone, Users, FileText, X, 
  ChevronDown, ChevronUp, Sparkles, SlidersHorizontal, Check, RotateCcw,
  CircleCheck, Clock, Ban, Wrench, EyeOff, Handshake, AlertTriangle
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface OwnerCompanyOption {
  id: string;
  name: string;
}

interface BillboardFiltersProps {
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  selectedStatuses: string[];
  setSelectedStatuses: (statuses: string[]) => void;
  selectedCities: string[];
  setSelectedCities: (cities: string[]) => void;
  selectedSizes: string[];
  setSelectedSizes: (sizes: string[]) => void;
  selectedMunicipalities: string[];
  setSelectedMunicipalities: (municipalities: string[]) => void;
  selectedDistricts: string[];
  setSelectedDistricts: (districts: string[]) => void;
  selectedAdTypes: string[];
  setSelectedAdTypes: (adTypes: string[]) => void;
  selectedCustomers: string[];
  setSelectedCustomers: (customers: string[]) => void;
  selectedContractNumbers: string[];
  setSelectedContractNumbers: (contractNumbers: string[]) => void;
  selectedOwnerCompanies?: string[];
  setSelectedOwnerCompanies?: (companies: string[]) => void;
  ownerCompanies?: OwnerCompanyOption[];
  cities: string[];
  billboardSizes: string[];
  billboardMunicipalities: string[];
  billboardDistricts?: string[];
  uniqueAdTypes: string[];
  uniqueCustomers: string[];
  uniqueContractNumbers: string[];
  isMapOpen?: boolean;
}

// ✅ مكون فلتر مخصص مع تصميم محسن
interface FilterChipProps {
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  count?: number;
  onClick: () => void;
  color?: 'default' | 'success' | 'warning' | 'danger' | 'info';
}

const FilterChip: React.FC<FilterChipProps> = ({ label, icon, isActive, count, onClick, color = 'default' }) => {
  const colorClasses = {
    default: isActive ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25' : 'bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground',
    success: isActive ? 'bg-green-500 text-white shadow-lg shadow-green-500/25' : 'bg-green-500/10 hover:bg-green-500/20 text-green-600',
    warning: isActive ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/25' : 'bg-orange-500/10 hover:bg-orange-500/20 text-orange-600',
    danger: isActive ? 'bg-red-500 text-white shadow-lg shadow-red-500/25' : 'bg-red-500/10 hover:bg-red-500/20 text-red-600',
    info: isActive ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/25' : 'bg-blue-500/10 hover:bg-blue-500/20 text-blue-600',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all duration-300",
        "border border-transparent hover:scale-[1.02] active:scale-[0.98]",
        colorClasses[color]
      )}
    >
      <span className="flex-shrink-0">{icon}</span>
      <span>{label}</span>
      {count !== undefined && count > 0 && (
        <Badge variant="secondary" className={cn(
          "h-5 min-w-5 px-1.5 text-xs rounded-full",
          isActive ? "bg-white/20 text-inherit" : "bg-foreground/10"
        )}>
          {count}
        </Badge>
      )}
    </button>
  );
};

// ✅ مكون حالة سريعة
interface QuickStatusProps {
  label: string;
  value: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
  variant: 'success' | 'warning' | 'danger' | 'info' | 'muted';
}

const QuickStatus: React.FC<QuickStatusProps> = ({ label, icon, isActive, onClick, variant }) => {
  const variants = {
    success: 'border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    warning: 'border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400',
    danger: 'border-rose-500/20 bg-rose-500/5 hover:bg-rose-500/10 text-rose-600 dark:text-rose-400',
    info: 'border-sky-500/20 bg-sky-500/5 hover:bg-sky-500/10 text-sky-600 dark:text-sky-400',
    muted: 'border-slate-500/20 bg-slate-500/5 hover:bg-slate-500/10 text-slate-600 dark:text-slate-400',
  };

  const activeVariants = {
    success: 'border-emerald-500/50 bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-[0_8px_20px_-4px_rgba(16,185,129,0.4)]',
    warning: 'border-amber-500/50 bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-[0_8px_20px_-4px_rgba(245,158,11,0.4)]',
    danger: 'border-rose-500/50 bg-gradient-to-br from-rose-500 to-red-600 text-white shadow-[0_8px_20px_-4px_rgba(244,63,94,0.4)]',
    info: 'border-sky-500/50 bg-gradient-to-br from-sky-500 to-indigo-600 text-white shadow-[0_8px_20px_-4px_rgba(14,165,233,0.4)]',
    muted: 'border-slate-500/50 bg-gradient-to-br from-slate-500 to-slate-700 text-white shadow-[0_8px_20px_-4px_rgba(100,116,139,0.4)]',
  };

  return (
    <button
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3.5 sm:py-2 rounded-lg sm:rounded-xl border text-[11px] sm:text-xs md:text-sm font-bold transition-all duration-300",
        "hover:scale-[1.02] active:scale-[0.98] shadow-sm select-none",
        isActive ? activeVariants[variant] : variants[variant]
      )}
    >
      {icon}
      <span>{label}</span>
      {isActive && <Check className="h-3 w-3 sm:h-3.5 sm:w-3.5" />}
    </button>
  );
};

export const BillboardFilters: React.FC<BillboardFiltersProps> = ({
  searchQuery,
  setSearchQuery,
  selectedStatuses,
  setSelectedStatuses,
  selectedCities,
  setSelectedCities,
  selectedSizes,
  setSelectedSizes,
  selectedMunicipalities,
  setSelectedMunicipalities,
  selectedDistricts,
  setSelectedDistricts,
  selectedAdTypes,
  setSelectedAdTypes,
  selectedCustomers,
  setSelectedCustomers,
  selectedContractNumbers,
  setSelectedContractNumbers,
  selectedOwnerCompanies = [],
  setSelectedOwnerCompanies,
  ownerCompanies = [],
  cities = [],
  billboardSizes = [],
  billboardMunicipalities = [],
  billboardDistricts = [],
  uniqueAdTypes = [],
  uniqueCustomers = [],
  uniqueContractNumbers = [],
  isMapOpen = false,
}) => {
  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false);

  // ✅ طي الفلاتر تلقائياً عند فتح الخريطة لتوفير مساحة كاملة للخريطة
  React.useEffect(() => {
    if (isMapOpen) {
      setIsAdvancedOpen(false);
    }
  }, [isMapOpen]);

  // ✅ فرز أرقام العقود تنازلياً مع إزالة القيم الفارغة
  const sortedContractNumbers = React.useMemo(() => {
    return [...(uniqueContractNumbers || [])]
      .filter(c => c && String(c).trim())
      .sort((a, b) => {
        const numA = parseInt(String(a), 10);
        const numB = parseInt(String(b), 10);
        if (!isNaN(numA) && !isNaN(numB)) {
          return numB - numA;
        }
        return String(a).localeCompare(String(b), 'ar', { numeric: true });
      });
  }, [uniqueContractNumbers]);

  // حساب عدد الفلاتر النشطة
  const activeFiltersCount = [
    selectedStatuses.length > 0,
    selectedCities.length > 0,
    selectedSizes.length > 0,
    selectedMunicipalities.length > 0,
    selectedDistricts.length > 0,
    selectedAdTypes.length > 0,
    selectedCustomers.length > 0,
    selectedContractNumbers.length > 0,
    (selectedOwnerCompanies || []).length > 0
  ].filter(Boolean).length;

  // دالة إعادة تعيين جميع الفلاتر
  const handleResetFilters = () => {
    setSearchQuery('');
    setSelectedStatuses([]);
    setSelectedCities([]);
    setSelectedSizes([]);
    setSelectedMunicipalities([]);
    setSelectedDistricts([]);
    setSelectedAdTypes([]);
    setSelectedCustomers([]);
    setSelectedContractNumbers([]);
    if (setSelectedOwnerCompanies) setSelectedOwnerCompanies([]);
  };

  // ✅ التحقق من حالة فلتر سريع
  const isQuickStatusActive = (status: string) => selectedStatuses.includes(status);
  
  const toggleQuickStatus = (status: string) => {
    if (selectedStatuses.includes(status)) {
      setSelectedStatuses(selectedStatuses.filter(s => s !== status));
    } else {
      setSelectedStatuses([...selectedStatuses.filter(s => s !== 'all'), status]);
    }
  };

  // ✅ الحالات السريعة
  const quickStatuses = [
    { label: 'متاحة', value: 'متاحة', icon: <CircleCheck className="h-4 w-4" />, variant: 'success' as const },
    { label: 'قريبة الانتهاء', value: 'قريبة الانتهاء', icon: <Clock className="h-4 w-4" />, variant: 'warning' as const },
    { label: 'محجوز', value: 'محجوز', icon: <Ban className="h-4 w-4" />, variant: 'danger' as const },
    { label: 'منتهي', value: 'منتهي', icon: <Clock className="h-4 w-4" />, variant: 'muted' as const },
    { label: 'إزالة', value: 'إزالة', icon: <Ban className="h-4 w-4" />, variant: 'muted' as const },
    { label: 'قيد الصيانة', value: 'قيد الصيانة', icon: <Wrench className="h-4 w-4" />, variant: 'info' as const },
    { label: 'مخفية', value: 'مخفية من المتاح', icon: <EyeOff className="h-4 w-4" />, variant: 'muted' as const },
    { label: 'لوحات صديقة', value: 'لوحات صديقة', icon: <Handshake className="h-4 w-4" />, variant: 'info' as const },
    { label: 'ممزقة', value: 'ممزقة', icon: <AlertTriangle className="h-4 w-4" />, variant: 'danger' as const },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* شريط البحث الرئيسي - تصميم عصري */}
      <Card className="relative overflow-hidden border border-border/40 shadow-md sm:shadow-xl bg-gradient-to-br from-primary/5 via-card/90 to-primary/5 rounded-xl sm:rounded-[2rem] hover:shadow-primary/5 hover:border-primary/20 transition-all duration-500">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/10 via-transparent to-transparent pointer-events-none" />
        
        <CardContent className="relative p-2.5 sm:p-4">
          <div className="flex items-center gap-2 sm:gap-4">
            {/* أيقونة البحث */}
            <div className="relative hidden xs:block">
              <div className="absolute inset-0 bg-primary/20 rounded-xl sm:rounded-2xl blur-xl animate-pulse" />
              <div className="relative p-2 sm:p-3.5 rounded-xl sm:rounded-2xl bg-gradient-to-br from-primary to-amber-600 shadow-md shadow-primary/30">
                <Search className="h-4 w-4 sm:h-6 sm:w-6 text-primary-foreground" />
              </div>
            </div>
            
            <div className="flex-1 relative">
              <SearchInputWithHistory
                historyKey="billboards"
                placeholder="ابحث باسم اللوحة، الموقع، العميل، رقم العقد..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={cn(
                  "h-10 sm:h-14 pr-3 sm:pr-5 pl-9 sm:pl-14 text-xs sm:text-base bg-background/50 backdrop-blur-md",
                  "border border-border/50 focus:border-primary/50 focus:ring-2 sm:focus:ring-4 focus:ring-primary/20",
                  "rounded-lg sm:rounded-2xl shadow-inner text-right font-medium",
                  "placeholder:text-muted-foreground/40 transition-all duration-300",
                  "focus:shadow-md focus:shadow-primary/10 focus:bg-background"
                )}
                dir="rtl"
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 sm:h-10 sm:w-10 rounded-lg sm:rounded-xl bg-destructive/10 hover:bg-destructive/20 text-destructive"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>

            {/* زر الفلاتر المتقدمة */}
            <Button
              variant={isAdvancedOpen ? "default" : "outline"}
              size="sm"
              onClick={() => setIsAdvancedOpen(!isAdvancedOpen)}
              className={cn(
                "h-10 sm:h-14 px-3 sm:px-5 rounded-lg sm:rounded-2xl gap-1.5 sm:gap-2 text-xs sm:text-sm font-semibold transition-all duration-300",
                "hover:scale-[1.02] active:scale-[0.98]",
                isAdvancedOpen && "shadow-md sm:shadow-lg shadow-primary/25"
              )}
            >
              <SlidersHorizontal className="h-4 w-4 sm:h-5 sm:w-5" />
              <span>فلاتر</span>
              {activeFiltersCount > 0 && (
                <Badge className="bg-destructive text-destructive-foreground border-0 text-[10px] sm:text-xs px-1.5 py-0">
                  {activeFiltersCount}
                </Badge>
              )}
              {isAdvancedOpen ? <ChevronUp className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> : <ChevronDown className="h-3.5 w-3.5 sm:h-4 sm:w-4" />}
            </Button>
          </div>
        </CardContent>
      </Card>


 {/* الفلاتر السريعة للحالة */}
      <div className="flex items-center gap-2 sm:gap-3 flex-wrap p-2 sm:p-3 rounded-xl sm:rounded-[1.5rem] bg-card/60 backdrop-blur-md border border-border/60 shadow-sm">
        <span className="text-xs sm:text-sm font-bold text-muted-foreground flex items-center gap-1.5 ml-2 mr-1">
          <Sparkles className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-primary animate-pulse" />
          تصفية سريعة:
        </span>
        <div className="flex flex-wrap gap-1.5 sm:gap-2 items-center flex-1">
          {quickStatuses.map((status) => (
            <QuickStatus
              key={status.value}
              label={status.label}
              value={status.value}
              icon={status.icon}
              variant={status.variant}
              isActive={isQuickStatusActive(status.value)}
              onClick={() => toggleQuickStatus(status.value)}
            />
          ))}
        </div>
        
        {/* زر مسح الكل */}
        {(searchQuery || activeFiltersCount > 0) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetFilters}
            className="gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3 rounded-lg sm:rounded-xl text-destructive hover:bg-destructive/10 hover:text-destructive mr-auto text-xs sm:text-sm font-bold transition-all duration-300 active:scale-95"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            مسح الفلاتر
          </Button>
        )}
      </div>

 {/* الفلاتر المتقدمة - قابلة للطي */}
      <Collapsible open={isAdvancedOpen} onOpenChange={setIsAdvancedOpen}>
        <CollapsibleContent className="transition-all duration-300">
          <Card className="border border-border/50 shadow-lg bg-card/80 backdrop-blur-sm">
            <CardContent className="p-5">
              {/* رأس الفلاتر */}
              <div className="flex items-center justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20">
                    <Filter className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-foreground">فلاتر متقدمة</h3>
                    <p className="text-xs text-muted-foreground">تصفية دقيقة حسب المدينة، الحجم، البلدية...</p>
                  </div>
                </div>
              </div>

              {/* شبكة الفلاتر - تصميم محسن */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* فلتر الحالة */}
                <FilterField
                  label="الحالة"
                  icon={<LayoutGrid className="h-4 w-4" />}
                >
                  <MultiSelect
                    options={[
                      { label: 'جميع الحالات', value: 'all' },
                      { label: 'متاحة', value: 'متاحة' },
                      { label: 'قريبة الانتهاء', value: 'قريبة الانتهاء' },
                      { label: 'محجوز', value: 'محجوز' },
                      { label: 'منتهي', value: 'منتهي' },
                      { label: 'إزالة', value: 'إزالة' },
                      { label: 'لم يتم التركيب', value: 'لم يتم التركيب' },
                      { label: 'تحتاج ازالة لغرض التطوير', value: 'تحتاج ازالة لغرض التطوير' },
                      { label: 'قيد الصيانة', value: 'قيد الصيانة' },
                      { label: 'متضررة اللوحة', value: 'متضررة اللوحة' },
                      { label: 'مخفية من المتاح', value: 'مخفية من المتاح' },
                      { label: 'لوحات صديقة', value: 'لوحات صديقة' },
                    ]}
                    value={selectedStatuses}
                    onChange={(values) => {
                      if (values.includes('all') && !selectedStatuses.includes('all')) {
                        setSelectedStatuses(['all']);
                      } else if (values.includes('all') && values.length > 1) {
                        setSelectedStatuses(values.filter(v => v !== 'all'));
                      } else {
                        setSelectedStatuses(values);
                      }
                    }}
                    placeholder="جميع الحالات"
                    className="rounded-xl"
                  />
                </FilterField>

                {/* فلتر المدن */}
                <FilterField
                  label="المدينة"
                  icon={<MapPin className="h-4 w-4" />}
                >
                  <MultiSelect
                    options={cities.map(c => ({ label: c, value: c }))}
                    value={selectedCities}
                    onChange={setSelectedCities}
                    placeholder="جميع المدن"
                    className="rounded-xl"
                  />
                </FilterField>

                {/* فلتر الحجم */}
                <FilterField
                  label="الحجم"
                  icon={<Maximize2 className="h-4 w-4" />}
                >
                  <MultiSelect
                    options={billboardSizes.filter(s => s && String(s).trim()).map(s => ({ label: String(s), value: String(s) }))}
                    value={selectedSizes}
                    onChange={setSelectedSizes}
                    placeholder="جميع الأحجام"
                    className="rounded-xl"
                  />
                </FilterField>

                {/* فلتر البلدية */}
                <FilterField
                  label="البلدية"
                  icon={<Building2 className="h-4 w-4" />}
                >
                  <MultiSelect
                    options={billboardMunicipalities.filter(m => m && String(m).trim()).map(m => ({ label: String(m), value: String(m) }))}
                    value={selectedMunicipalities}
                    onChange={setSelectedMunicipalities}
                    placeholder="جميع البلديات"
                    className="rounded-xl"
                  />
                </FilterField>

                {/* فلتر المنطقة */}
                {billboardDistricts.length > 0 && (
                  <FilterField
                    label="المنطقة"
                    icon={<MapPin className="h-4 w-4" />}
                  >
                    <MultiSelect
                      options={billboardDistricts.filter(d => d && String(d).trim()).map(d => ({ label: String(d), value: String(d) }))}
                      value={selectedDistricts}
                      onChange={setSelectedDistricts}
                      placeholder="جميع المناطق"
                      className="rounded-xl"
                    />
                  </FilterField>
                )}

                {/* فلتر نوع الإعلان */}
                <FilterField
                  label="نوع الإعلان"
                  icon={<Megaphone className="h-4 w-4" />}
                >
                  <MultiSelect
                    options={uniqueAdTypes.filter(a => a && String(a).trim()).map(a => ({ label: String(a), value: String(a) }))}
                    value={selectedAdTypes}
                    onChange={setSelectedAdTypes}
                    placeholder="جميع الأنواع"
                    className="rounded-xl"
                  />
                </FilterField>

                {/* فلتر العملاء */}
                <FilterField
                  label="العميل"
                  icon={<Users className="h-4 w-4" />}
                >
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className={cn(
                          "w-full h-10 justify-between rounded-xl border-2 font-normal",
                          "bg-background/60 hover:bg-background/80 transition-all",
                          selectedCustomers.length > 0 && "border-primary/50 bg-primary/5"
                        )}
                      >
                        <span className={selectedCustomers.length > 0 ? "text-foreground font-medium" : "text-muted-foreground"}>
                          {selectedCustomers.length === 0 
                            ? 'جميع العملاء' 
                            : `${selectedCustomers.length} عميل`}
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80 p-0 rounded-xl shadow-2xl" align="start">
                      <Command className="rounded-xl">
                        <CommandInput placeholder="ابحث عن عميل..." className="text-right h-12" dir="rtl" />
                        <CommandList className="max-h-64">
                          <CommandEmpty className="py-6 text-center text-muted-foreground">لا توجد نتائج</CommandEmpty>
                          <CommandGroup>
                            <CommandItem 
                              onSelect={() => setSelectedCustomers([])} 
                              className="justify-end rounded-lg mx-1 my-0.5"
                            >
                              جميع العملاء
                            </CommandItem>
                            {uniqueCustomers.filter(c => c && String(c).trim()).map((customer) => (
                              <CommandItem
                                key={String(customer)}
                                value={String(customer)}
                                onSelect={() => {
                                  const val = String(customer);
                                  if (selectedCustomers.includes(val)) {
                                    setSelectedCustomers(selectedCustomers.filter(c => c !== val));
                                  } else {
                                    setSelectedCustomers([...selectedCustomers, val]);
                                  }
                                }}
                                className="justify-between rounded-lg mx-1 my-0.5"
                              >
                                <span className={selectedCustomers.includes(String(customer)) ? 'font-bold text-primary' : ''}>
                                  {String(customer)}
                                </span>
                                {selectedCustomers.includes(String(customer)) && (
                                  <Check className="h-4 w-4 text-primary" />
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </FilterField>

                {/* فلتر أرقام العقود */}
                <FilterField
                  label="رقم العقد"
                  icon={<FileText className="h-4 w-4" />}
                  className="sm:col-span-2 lg:col-span-1"
                >
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button 
                        variant="outline" 
                        className={cn(
                          "w-full h-10 justify-between rounded-xl border-2 font-normal",
                          "bg-background/60 hover:bg-background/80 transition-all",
                          selectedContractNumbers.length > 0 && "border-primary/50 bg-primary/5"
                        )}
                      >
                        <span className={selectedContractNumbers.length > 0 ? "text-foreground font-medium" : "text-muted-foreground"}>
                          {selectedContractNumbers.length === 0 
                            ? 'جميع العقود' 
                            : `${selectedContractNumbers.length} عقد`}
                        </span>
                        <ChevronDown className="h-4 w-4 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-0 rounded-xl shadow-2xl" align="start">
                      <Command className="rounded-xl">
                        <CommandInput placeholder="ابحث عن رقم العقد..." className="text-right h-12" dir="rtl" />
                        <CommandList className="max-h-64">
                          <CommandEmpty className="py-6 text-center text-muted-foreground">لا توجد نتائج</CommandEmpty>
                          <CommandGroup>
                            <CommandItem 
                              onSelect={() => setSelectedContractNumbers([])} 
                              className="justify-end rounded-lg mx-1 my-0.5"
                            >
                              جميع العقود
                            </CommandItem>
                            {sortedContractNumbers.map((contractNum) => (
                              <CommandItem
                                key={String(contractNum)}
                                value={String(contractNum)}
                                onSelect={() => {
                                  const val = String(contractNum);
                                  if (selectedContractNumbers.includes(val)) {
                                    setSelectedContractNumbers(selectedContractNumbers.filter(c => c !== val));
                                  } else {
                                    setSelectedContractNumbers([...selectedContractNumbers, val]);
                                  }
                                }}
                                className="justify-between rounded-lg mx-1 my-0.5"
                              >
                                <span className={selectedContractNumbers.includes(String(contractNum)) ? 'font-bold text-primary' : ''}>
                                  عقد #{String(contractNum)}
                                </span>
                                {selectedContractNumbers.includes(String(contractNum)) && (
                                  <Check className="h-4 w-4 text-primary" />
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </FilterField>

                {/* فلتر الشركة المالكة */}
                {ownerCompanies.length > 0 && setSelectedOwnerCompanies && (
                  <FilterField
                    label="الشركة المالكة"
                    icon={<Building2 className="h-4 w-4" />}
                  >
                    <MultiSelect
                      options={ownerCompanies.map(c => ({ label: c.name, value: c.id }))}
                      value={selectedOwnerCompanies}
                      onChange={setSelectedOwnerCompanies}
                      placeholder="جميع الشركات"
                      className="rounded-xl"
                    />
                  </FilterField>
                )}
              </div>
            </CardContent>
          </Card>
        </CollapsibleContent>
      </Collapsible>

 {/* شريط الفلاتر النشطة - تصميم محسن */}
      {(searchQuery || activeFiltersCount > 0) && (
        <div className="flex items-center gap-2 flex-wrap p-3 rounded-xl bg-muted/30 border border-border/30">
          <span className="text-xs font-medium text-muted-foreground flex items-center gap-1.5">
            <Filter className="h-3.5 w-3.5" />
            نشط:
          </span>
          
          {searchQuery && (
            <ActiveFilterBadge
              label={`البحث: ${searchQuery}`}
              onRemove={() => setSearchQuery('')}
              variant="primary"
            />
          )}
          
          {selectedStatuses.filter(s => s !== 'all').map(status => (
            <ActiveFilterBadge
              key={status}
              label={status}
              onRemove={() => setSelectedStatuses(selectedStatuses.filter(s => s !== status))}
              variant="info"
            />
          ))}
          
          {selectedCities.map(city => (
            <ActiveFilterBadge
              key={city}
              label={city}
              onRemove={() => setSelectedCities(selectedCities.filter(c => c !== city))}
              variant="success"
            />
          ))}
          
          {selectedSizes.map(size => (
            <ActiveFilterBadge
              key={size}
              label={size}
              onRemove={() => setSelectedSizes(selectedSizes.filter(s => s !== size))}
              variant="warning"
            />
          ))}
          
          {selectedMunicipalities.map(municipality => (
            <ActiveFilterBadge
              key={municipality}
              label={municipality}
              onRemove={() => setSelectedMunicipalities(selectedMunicipalities.filter(m => m !== municipality))}
              variant="default"
            />
          ))}
          
          {selectedDistricts.map(district => (
            <ActiveFilterBadge
              key={district}
              label={district}
              onRemove={() => setSelectedDistricts(selectedDistricts.filter(d => d !== district))}
              variant="default"
            />
          ))}
          
          {selectedAdTypes.map(adType => (
            <ActiveFilterBadge
              key={adType}
              label={adType}
              onRemove={() => setSelectedAdTypes(selectedAdTypes.filter(a => a !== adType))}
              variant="default"
            />
          ))}
          
          {selectedCustomers.map(customer => (
            <ActiveFilterBadge
              key={customer}
              label={customer}
              onRemove={() => setSelectedCustomers(selectedCustomers.filter(c => c !== customer))}
              variant="default"
            />
          ))}
          
          {selectedContractNumbers.map(contractNum => (
            <ActiveFilterBadge
              key={contractNum}
              label={`عقد #${contractNum}`}
              onRemove={() => setSelectedContractNumbers(selectedContractNumbers.filter(c => c !== contractNum))}
              variant="default"
            />
          ))}
          
          {selectedOwnerCompanies.map(companyId => {
            const company = ownerCompanies.find(c => c.id === companyId);
            return company ? (
              <ActiveFilterBadge
                key={companyId}
                label={company.name}
                onRemove={() => setSelectedOwnerCompanies?.(selectedOwnerCompanies.filter(c => c !== companyId))}
                variant="info"
              />
            ) : null;
          })}
        </div>
      )}
    </div>
  );
};

// ✅ مكون حقل الفلتر
interface FilterFieldProps {
  label: string;
  icon: React.ReactNode;
  children: React.ReactNode;
  className?: string;
}

const FilterField: React.FC<FilterFieldProps> = ({ label, icon, children, className }) => (
  <div className={cn("space-y-2", className)}>
    <label className="text-xs font-semibold text-muted-foreground flex items-center gap-2 pr-1">
      <span className="text-primary">{icon}</span>
      {label}
    </label>
    {children}
  </div>
);

// ✅ مكون شارة الفلتر النشط
interface ActiveFilterBadgeProps {
  label: string;
  onRemove: () => void;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'info';
}

const ActiveFilterBadge: React.FC<ActiveFilterBadgeProps> = ({ label, onRemove, variant = 'default' }) => {
  const variants = {
    default: 'bg-muted text-muted-foreground hover:bg-muted/80',
    primary: 'bg-primary/15 text-primary border-primary/30',
    success: 'bg-green-500/15 text-green-600 border-green-500/30',
    warning: 'bg-orange-500/15 text-orange-600 border-orange-500/30',
    info: 'bg-blue-500/15 text-blue-600 border-blue-500/30',
  };

  return (
    <Badge 
      variant="outline" 
      className={cn(
        "gap-1.5 pl-1.5 pr-2.5 py-1 text-xs font-medium rounded-full transition-all hover:scale-105",
        variants[variant]
      )}
    >
      {label}
      <button 
        onClick={onRemove} 
        className="hover:bg-destructive/20 hover:text-destructive rounded-full p-0.5 transition-colors"
      >
        <X className="h-3 w-3" />
      </button>
    </Badge>
  );
};

export default BillboardFilters;
