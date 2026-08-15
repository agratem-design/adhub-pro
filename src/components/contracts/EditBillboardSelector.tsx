import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, MapPin, Ruler, X, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { isBillboardAvailable } from '@/utils/contractUtils';

interface Billboard {
  id: string;
  name: string;
  size: string;
  city: string;
  location: string;
  status: string;
  level: string;
  image?: string;
}

interface EditBillboardSelectorProps {
  selectedBillboards: string[];
  onSelectionChange: (billboards: string[]) => void;
  formData: any;
  pricingData: any[];
  getPriceFromDatabase: (size: string, level: any, customer: string, months: number) => number | null;
  getDailyPriceFromDatabase: (size: string, level: any, customer: string) => number | null;
}

export function EditBillboardSelector({
  selectedBillboards,
  onSelectionChange,
  formData,
  pricingData,
  getPriceFromDatabase,
  getDailyPriceFromDatabase
}: EditBillboardSelectorProps) {
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [filteredBillboards, setFilteredBillboards] = useState<Billboard[]>([]);
  const [selectedBillboardsData, setSelectedBillboardsData] = useState<Billboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [allSizes, setAllSizes] = useState<string[]>([]);

  // جلب جميع المقاسات من قاعدة البيانات
  useEffect(() => {
    const loadSizes = async () => {
      const { data, error } = await supabase
        .from('sizes')
        .select('name, sort_order')
        .order('sort_order');
      
      if (!error && data) {
        setAllSizes(data.map(s => s.name).filter(Boolean));
      }
    };
    loadSizes();
  }, []);

  // Load billboards
  useEffect(() => {
    const loadBillboards = async () => {
      try {
        setLoading(true);
        const { data, error } = await supabase
          .from('billboards')
          .select('*')
          .order('Billboard_Name');

        if (error) {
          console.error('Error loading billboards:', error);
          toast.error('فشل في تحميل اللوحات الإعلانية');
          return;
        }

        if (data) {
          const formattedBillboards = data.map(billboard => {
            const isAvailable = isBillboardAvailable(billboard, true);
            
            return {
              id: String(billboard.ID),
              name: billboard.Billboard_Name || '',
              size: billboard.Size || '',
              city: billboard.City || '',
              location: billboard.Nearest_Landmark || '',
              status: isAvailable ? 'available' : 'occupied',
              level: billboard.Level || '',
              image: billboard.image_name || '',
              Contract_Number: billboard.Contract_Number,
              Rent_End_Date: billboard.Rent_End_Date
            };
          });
          
          setBillboards(formattedBillboards);
        }
      } catch (error) {
        console.error('Error loading billboards:', error);
        toast.error('فشل في تحميل اللوحات الإعلانية');
      } finally {
        setLoading(false);
      }
    };

    loadBillboards();
  }, []);

  // Load selected billboards data
  useEffect(() => {
    if (selectedBillboards.length > 0 && billboards.length > 0) {
      const selected = billboards.filter(b => selectedBillboards.includes(b.id));
      setSelectedBillboardsData(selected);
    } else {
      setSelectedBillboardsData([]);
    }
  }, [selectedBillboards, billboards]);

  // Filter billboards
  useEffect(() => {
    let filtered = billboards;

    if (searchQuery) {
      filtered = filtered.filter(billboard =>
        billboard.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        billboard.location.toLowerCase().includes(searchQuery.toLowerCase()) ||
        billboard.city.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    if (cityFilter !== 'all') {
      filtered = filtered.filter(billboard => billboard.city === cityFilter);
    }

    if (sizeFilter !== 'all') {
      filtered = filtered.filter(billboard => billboard.size === sizeFilter);
    }

    if (statusFilter !== 'all') {
      if (statusFilter === 'available') {
        filtered = filtered.filter(billboard => billboard.status === 'available');
      } else if (statusFilter === 'occupied') {
        filtered = filtered.filter(billboard => billboard.status === 'occupied');
      } else {
        // للحالات الأخرى (صيانة، إلخ)
        filtered = filtered.filter(billboard => billboard.status === statusFilter);
      }
    }

    setFilteredBillboards(filtered);
  }, [billboards, searchQuery, cityFilter, sizeFilter, statusFilter]);

  const calculateBillboardPrice = (billboard: Billboard): number => {
    const size = billboard.size;
    const level = billboard.level;
    
    if (formData.pricingMode === 'months') {
      const months = Math.max(0, Number(formData.durationMonths || 0));
      const price = getPriceFromDatabase(size, level, formData.pricingCategory, months);
      return price !== null ? price : 0;
    } else {
      const days = Math.max(0, Number(formData.durationDays || 0));
      let daily = getDailyPriceFromDatabase(size, level, formData.pricingCategory);
      if (daily === null) {
        const monthlyPrice = getPriceFromDatabase(size, level, formData.pricingCategory, 1);
        daily = monthlyPrice ? Math.round((monthlyPrice / 30) * 100) / 100 : 0;
      }
      return (daily || 0) * days;
    }
  };

  const toggleBillboard = (billboard: Billboard) => {
    const isSelected = selectedBillboards.includes(billboard.id);
    if (isSelected) {
      onSelectionChange(selectedBillboards.filter(id => id !== billboard.id));
    } else {
      onSelectionChange([...selectedBillboards, billboard.id]);
    }
  };

  const removeBillboard = (billboardId: string) => {
    onSelectionChange(selectedBillboards.filter(id => id !== billboardId));
  };

  const cities = Array.from(new Set(billboards.map(b => b.city))).filter(Boolean);
  
  // استخدام المقاسات من قاعدة البيانات مع إضافة أي مقاسات موجودة في اللوحات
  const sizes = useMemo(() => {
    const sizeSet = new Set<string>(allSizes);
    billboards.forEach(b => {
      if (b.size) sizeSet.add(b.size);
    });
    return [...allSizes, ...Array.from(sizeSet).filter(s => !allSizes.includes(s))];
  }, [billboards, allSizes]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>اللوحات الإعلانية</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-2"></div>
              <p className="text-muted-foreground">جاري تحميل اللوحات...</p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Selected Billboards */}
      {selectedBillboardsData.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>اللوحات المختارة ({selectedBillboardsData.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {selectedBillboardsData.map((billboard) => (
                <div key={billboard.id} className="border rounded-lg p-4 bg-blue-50">
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-sm truncate">{billboard.name}</h4>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => removeBillboard(billboard.id)}
                      className="h-6 w-6 p-0 text-red-500 hover:text-red-700"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Ruler className="h-3 w-3" />
                      <span>{billboard.size}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span>{billboard.city} - {billboard.location}</span>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t">
                    <div className="text-sm font-medium text-primary">
                      {calculateBillboardPrice(billboard).toLocaleString()} ريال
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Billboard Selector */}
      <Card>
        <CardHeader>
          <CardTitle>اختيار اللوحات الإعلانية</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="البحث في اللوحات..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={cityFilter} onValueChange={setCityFilter}>
              <SelectTrigger>
                <SelectValue placeholder="المدينة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المدن</SelectItem>
                {cities.map((city) => (
                  <SelectItem key={city} value={city}>
                    {city}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={sizeFilter} onValueChange={setSizeFilter}>
              <SelectTrigger>
                <SelectValue placeholder="الحجم" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأحجام</SelectItem>
                {sizes.map((size) => (
                  <SelectItem key={size} value={size}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="الحالة" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الحالات</SelectItem>
                <SelectItem value="available">متاح</SelectItem>
                <SelectItem value="occupied">محجوز</SelectItem>
                <SelectItem value="maintenance">صيانة</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Billboard List */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-96 overflow-y-auto">
            {filteredBillboards.map((billboard) => {
              const isSelected = selectedBillboards.includes(billboard.id);
              const price = calculateBillboardPrice(billboard);
              
              return (
                <div
                  key={billboard.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-colors ${
                    isSelected
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:border-primary/50'
                  }`}
                  onClick={() => toggleBillboard(billboard)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <h4 className="font-medium text-sm truncate">{billboard.name}</h4>
                    <Badge variant={billboard.status === 'available' ? 'default' : 'secondary'} className={billboard.status === 'available' ? 'bg-green-500' : 'bg-orange-500'}>
                      {billboard.status === 'available' ? 'متاح' : 'مؤجر'}
                    </Badge>
                  </div>
                  <div className="space-y-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Ruler className="h-3 w-3" />
                      <span>{billboard.size}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      <span>{billboard.city} - {billboard.location}</span>
                    </div>
                  </div>
                  <div className="mt-2 pt-2 border-t flex justify-between items-center">
                    <div className="text-sm font-medium text-primary">
                      {price.toLocaleString()} ريال
                    </div>
                    <Button
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      className="h-6 px-2"
                    >
                      {isSelected ? (
                        <X className="h-3 w-3" />
                      ) : (
                        <Plus className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>

          {filteredBillboards.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              لا توجد لوحات تطابق معايير البحث
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}