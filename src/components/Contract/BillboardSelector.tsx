import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Calendar, X, Wrench } from 'lucide-react';
import type { Billboard } from '@/types';
import { smartArabicMatch } from '@/lib/arabicSearch';
import { getBillboardsSortMaps, sortBillboardsStandardSync } from '@/lib/billboardSorter';

interface BillboardSelectorProps {
  billboards: Billboard[];
  selected: string[];
  onToggleSelect: (billboard: Billboard) => void;
  onRemoveSelected: (id: string) => void;
  loading: boolean;
  // Filters
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
  pricingCategories: string[];
  // Pricing calculations
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
}

export const BillboardSelector: React.FC<BillboardSelectorProps> = ({
  billboards,
  selected,
  onToggleSelect,
  onRemoveSelected,
  loading,
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
  pricingCategories,
  calculateBillboardPrice,
  installationDetails,
  pricingMode,
  durationMonths,
  durationDays
}) => {
  // Derive cities and sizes from billboards
  const cities = useMemo(
    () => Array.from(new Set(billboards.map((b) => b.city || (b as any).City))).filter(Boolean) as string[],
    [billboards]
  );
  
  const sizes = useMemo(
    () => Array.from(new Set(billboards.map((b) => b.size || (b as any).Size))).filter(Boolean) as string[],
    [billboards]
  );

  const [sortMaps, setSortMaps] = useState<{ sizeOrderMap: Record<string, number>; municipalityOrderMap: Record<string, number> }>({ sizeOrderMap: {}, municipalityOrderMap: {} });
  useEffect(() => {
    getBillboardsSortMaps();
  }, []);

  const { data: dbSizesData = [] } = useQuery({
    queryKey: ['selector-sizes-sorting'],
    queryFn: async () => {
      const { data } = await supabase.from('sizes').select('name, sort_order').order('sort_order', { ascending: true });
      return data || [];
    }
  });

  const { data: dbMunisData = [] } = useQuery({
    queryKey: ['selector-munis-sorting'],
    queryFn: async () => {
      const { data } = await supabase.from('municipalities').select('name, sort_order').order('sort_order', { ascending: true });
      return data || [];
    }
  });

  // Filter billboards
  const filtered = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const NEAR_DAYS = 30;

    const isNearExpiring = (b: any) => {
      const raw = b.Rent_End_Date || b.rent_end_date || b.rentEndDate || b['End Date'];
      if (!raw) return false;
      const end = new Date(raw);
      if (isNaN(end.getTime())) return false;
      const diff = Math.ceil((end.getTime() - today.getTime()) / 86400000);
      return diff > 0 && diff <= NEAR_DAYS;
    };

    const list = billboards.filter((b: any) => {
      const c = String(b.city || b.City || '');
      const s = String(b.size || b.Size || '');
      const st = String(b.status || b.Status || '').toLowerCase();
      const bIdStr = String(b.ID || b.id || '');
      const code = b.code || b.Code || `TR-${bIdStr.padStart(4, '0')}`;

      const matchesQ = smartArabicMatch(
        [
          code, b.code, b.Code,
          b.name, b.Billboard_Name,
          b.location, b.Nearest_Landmark,
          b.city, b.City,
          b.municipality, b.Municipality,
          b.Customer_Name, b.clientName, b.customer_name,
          b.Ad_Type, b.adType, b.ad_type,
          b.Contract_Number, b.contractNumber,
          b.Level, b.level,
          b.ID, b.id, bIdStr, b.Size, b.size
        ],
        searchQuery
      );
      const matchesCity = cityFilter === 'all' || c === cityFilter;
      const matchesSize = sizeFilter === 'all' || s === sizeFilter;

      const hasContract = !!(b.contractNumber || b.Contract_Number || b.contract_number);
      const isAvailable = st === 'available' || (!hasContract && st !== 'rented');
      const isNear = isNearExpiring(b);
      const isRented = hasContract || st === 'rented';
      const isInContract = selected.includes(String(b.ID || b.id));

      let shouldShow = false;
      if (statusFilter === 'all') {
        shouldShow = true;
      } else if (statusFilter === 'available') {
        shouldShow = (isAvailable && !isRented) || isInContract;
      } else if (statusFilter === 'rented') {
        shouldShow = isRented && !isNear;
      }

      return matchesQ && matchesCity && matchesSize && shouldShow;
    });

    return sortBillboardsStandardSync(list, dbSizesData, dbMunisData);
  }, [billboards, searchQuery, cityFilter, sizeFilter, statusFilter, selected, dbSizesData, dbMunisData]);

  return (
    <div className="flex-1 space-y-6">
      {/* Selected Billboards */}
      <Card className="card-elegant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            اللوحات المرتبطة ({selected.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {selected.length === 0 ? (
            <p className="text-primary">لا توجد لوحات</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {billboards.filter((b) => selected.includes(String((b as any).ID))).map((b) => {
                const totalForBoard = calculateBillboardPrice(b);
                const installDetail = installationDetails.find(detail => detail.billboardId === String((b as any).ID));
                const installPrice = installDetail?.installationPrice || 0;

                return (
                  <Card key={(b as any).ID} className="card-hover">
                    <CardContent className="p-0">
                      {(b as any).image && (
                        <img src={(b as any).image} alt={(b as any).name || (b as any).Billboard_Name} className="w-full h-36 object-cover" />
                      )}
                      <div className="p-3 flex items-start justify-between gap-3">
                        <div className="flex-1">
                          <div className="font-semibold">{(b as any).name || (b as any).Billboard_Name}</div>
                          <div className="text-xs text-primary">{(b as any).location || (b as any).Nearest_Landmark}</div>
                          <div className="text-xs">الحجم: {(b as any).size || (b as any).Size} • {(b as any).city || (b as any).City}</div>
                          <div className="text-xs font-medium mt-1 space-y-1">
                            <div className="price-text">الإيجار: {totalForBoard.toLocaleString('ar-LY')} د.ل {pricingMode === 'months' ? `/${durationMonths} شهر` : `/${durationDays} يوم`}</div>
                            {installPrice > 0 && (
                              <div className="flex items-center gap-1 installation-cost">
                                <Wrench className="h-3 w-3" />
                                التركيب: {installPrice.toLocaleString('ar-LY')} د.ل
                                {installDetail?.faces === 1 && (
                                  <span className="text-xs badge-orange">وجه واحد</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                        <Button size="sm" variant="destructive" onClick={() => onRemoveSelected(String((b as any).ID))}>
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Filters */}
      <Card className="card-elegant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5 text-primary" />
            البحث والتصفية
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex-1 relative min-w-[200px] w-full">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-primary" />
              <Input placeholder="بحث عن لوحة" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pr-9" />
            </div>
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger className="w-full sm:w-[180px]"><SelectValue placeholder="المدينة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المدن</SelectItem>
                {cities.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sizeFilter} onValueChange={setSizeFilter}>
              <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="المقاس" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المقاسات</SelectItem>
                {sizes.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="الحالة" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">الكل</SelectItem>
                <SelectItem value="available">المتاحة فقط</SelectItem>
                <SelectItem value="rented">المؤجرة فقط</SelectItem>
              </SelectContent>
            </Select>
            <Select value={pricingCategory} onValueChange={setPricingCategory}>
              <SelectTrigger className="w-full sm:w-[160px]"><SelectValue placeholder="فئة السعر" /></SelectTrigger>
              <SelectContent>
                {pricingCategories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Available Billboards Grid */}
      <Card className="card-elegant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            اللوحات المتاحة ({filtered.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-10 text-center">جاري التحميل...</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((b) => {
                const isSelected = selected.includes(String((b as any).ID));
                const st = ((b as any).status || (b as any).Status || '').toString().toLowerCase();
                const hasContract = !!(b as any).contractNumber || !!(b as any).Contract_Number || !!(b as any).contract_number;
                const isAvailable = st === 'available' || (!hasContract && st !== 'rented');
                
                const today = new Date();
                const endDate = (b as any).Rent_End_Date || (b as any).rent_end_date || (b as any).rentEndDate;
                const isNearExpiring = endDate ? (() => {
                  const end = new Date(endDate);
                  if (isNaN(end.getTime())) return false;
                  const diff = Math.ceil((end.getTime() - today.getTime()) / 86400000);
                  return diff > 0 && diff <= 30;
                })() : false;

                const canSelect = isAvailable || isNearExpiring || isSelected;
                
                return (
                  <Card key={(b as any).ID} className={`card-hover ${!canSelect ? 'opacity-60' : ''} ${isSelected ? 'card-selected' : ''}`}>
                    <CardContent className="p-0">
                      {(b as any).image && (
                        <img src={(b as any).image} alt={(b as any).name || (b as any).Billboard_Name} className="w-full h-40 object-cover" />
                      )}
                      <div className="p-3 space-y-1">
                        <div className="font-semibold">{(b as any).name || (b as any).Billboard_Name}</div>
                        <div className="text-xs text-primary">{(b as any).location || (b as any).Nearest_Landmark}</div>
                        <div className="text-xs">{(b as any).city || (b as any).City} • {(b as any).size || (b as any).Size}</div>
                        <div className="text-sm price-text">{(Number((b as any).price) || 0).toLocaleString('ar-LY')} د.ل / شهر</div>
                        
                        <div className="flex items-center gap-2 text-xs">
                          {isAvailable && (
                            <span className="badge-green status-available">متاحة</span>
                          )}
                          {isNearExpiring && (
                            <span className="badge-yellow status-expiring">قريبة الانتهاء</span>
                          )}
                          {!isAvailable && !isNearExpiring && (
                            <span className="badge-red status-rented">مؤجرة</span>
                          )}
                        </div>
                        
                        <div className="pt-2">
                          <Button 
                            size="sm" 
                            variant={isSelected ? 'destructive' : 'outline'} 
                            onClick={() => onToggleSelect(b as any)} 
                            disabled={!canSelect}
                            className="w-full"
                          >
                            {isSelected ? 'إزالة' : 'إضافة'}
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
          {!loading && filtered.length === 0 && (
            <div className="py-10 text-center text-primary">
              لا توجد لوحات تطابق معايير البحث
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};