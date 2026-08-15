import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import MultiSelect from '@/components/ui/multi-select';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import BillboardsMap from '@/components/Map/BillboardsMap';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import InvoiceDialog from '@/components/Invoice/InvoiceDialog';
import QuoteDialog from '@/components/Invoice/QuoteDialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogTrigger } from '@/components/ui/dialog';
import { MapPin, DollarSign, Search, Filter, ShoppingCart, Heart, Eye, Phone, Mail, Globe, User, FileText, Calendar, Hourglass } from 'lucide-react';
import { CUSTOMERS, getPriceFor, CustomerType } from '@/data/pricing';
import { Billboard } from '@/types';
import { loadBillboards } from '@/services/billboardService';
import { useToast } from '@/hooks/use-toast';
import { Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

export default function ClientHome() {
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [selectedBillboards, setSelectedBillboards] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>(['available']);
  const [selectedClients, setSelectedClients] = useState<string[]>([]);
  const [selectedContracts, setSelectedContracts] = useState<string[]>([]);
  const [packageById, setPackageById] = useState<Record<string, number>>({});
  const [customerTypeById, setCustomerTypeById] = useState<Record<string, CustomerType>>({});
  const [currentPage, setCurrentPage] = useState(1);
  const [showMap, setShowMap] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [quoteOpen, setQuoteOpen] = useState(false);
  const pageSize = 10;
  const { toast } = useToast();
  const { isAdmin, user, profile } = useAuth();
  const defaultCustomer = (profile?.pricingCategory as CustomerType) || CUSTOMERS[0];

  useEffect(() => {
    const fetchBillboards = async () => {
      try {
        setLoading(true);
        const data = await loadBillboards();
        setBillboards(data);
      } catch (error) {
        console.error('خطأ في تحميل اللوحات:', error);
        toast({
          title: "خطأ في التحميل",
          description: "فشل في تحميل بيانات اللوحات الإعلانية",
          variant: "destructive"
        });
      } finally {
        setLoading(false);
      }
    };

    fetchBillboards();
  }, []);

  // للأدمن: التحويل تلقائياً لعرض غير المتاح والقريب الانتهاء عند أول تحميل
  useEffect(() => {
    if (isAdmin && selectedStatuses.length === 1 && selectedStatuses[0] === 'available') {
      setSelectedStatuses(['rented', 'near']);
    }
  }, [isAdmin]);

  const buildMapUrl = (billboard: Billboard) => {
    const coords: any = (billboard as any).coordinates;
    if (typeof coords === 'string' && coords.includes(',')) {
      const parts = coords.split(',').map((c: string) => c.trim());
      if (parts.length >= 2) {
        return `https://www.google.com/maps?q=${encodeURIComponent(parts[0])},${encodeURIComponent(parts[1])}`;
      }
    } else if (coords && typeof coords === 'object' && typeof coords.lat === 'number' && typeof coords.lng === 'number') {
      return `https://www.google.com/maps?q=${coords.lat},${coords.lng}`;
    }
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(billboard.location)}`;
  };

  const filteredBillboards = billboards.filter((billboard) => {
    const matchesSearch = billboard.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         billboard.location.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCity = selectedCities.length === 0 || selectedCities.includes(billboard.city);
    const matchesSize = selectedSizes.length === 0 || selectedSizes.includes(billboard.size);

    const wantsNear = selectedStatuses.includes('near');
    const wantsAvailable = selectedStatuses.includes('available');
    const wantsRented = selectedStatuses.includes('rented');

    const statusMatch = (
      (wantsAvailable && billboard.status === 'available') ||
      (wantsRented && billboard.status === 'rented') ||
      (wantsNear && (billboard as any).nearExpiry === true)
    ) || selectedStatuses.length === 0;

    const matchesClient = selectedClients.length === 0 || (billboard as any).clientName && selectedClients.includes((billboard as any).clientName);
    const matchesContract = selectedContracts.length === 0 || (billboard as any).contractNumber && selectedContracts.includes((billboard as any).contractNumber);

    const allowed = !isAdmin ? ((profile as any)?.allowed_clients as string[] | null) : null;
    const assignedMatch = isAdmin || !allowed || allowed.length === 0 || (((billboard as any).clientName) && allowed.includes((billboard as any).clientName));

    return matchesSearch && matchesCity && matchesSize && statusMatch && matchesClient && matchesContract && assignedMatch;
  });

  const cities = [...new Set(billboards.map(b => b.city))];
  const sizes = [...new Set(billboards.map(b => b.size))];
  const clients = [...new Set(billboards.map(b => (b as any).clientName).filter(Boolean))] as string[];
  const contracts = [...new Set(
    billboards
      .filter(b => selectedClients.length === 0 || (b as any).clientName && selectedClients.includes((b as any).clientName))
      .map(b => (b as any).contractNumber)
      .filter(Boolean)
  )] as string[];

  // تأكد من مزامنة العقود المختارة مع العملاء المختارين بدون تحد��ثات غير ضرورية
  useEffect(() => {
    const valid = new Set(contracts);
    setSelectedContracts(prev => {
      const next = prev.filter(c => valid.has(c));
      if (next.length === prev.length && next.every((v, i) => v === prev[i])) {
        return prev;
      }
      return next;
    });
  }, [contracts]);

  const totalPages = Math.max(1, Math.ceil(filteredBillboards.length / pageSize));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const paginatedBillboards = filteredBillboards.slice((currentPageSafe - 1) * pageSize, currentPageSafe * pageSize);

  const toggleBillboardSelection = (id: string) => {
    setSelectedBillboards(prev => 
      prev.includes(id) 
        ? prev.filter(bid => bid !== id)
        : [...prev, id]
    );
  };

  const getSelectedTotal = () => {
    return selectedBillboards.reduce((total, id) => {
      const billboard = billboards.find(b => b.id === id);
      if (!billboard) return total;
      const months = packageById[id] || 1;
      const customer = customerTypeById[id] || defaultCustomer;
      const price = getPriceFor(billboard.size, (billboard as any).level, customer, months) ?? 0;
      return total + price;
    }, 0);
  };

  const handleSubmitRequest = () => {
    if (selectedBillboards.length === 0) {
      toast({
        title: "لم يتم اختيار أي لوحات",
        description: "يرجى ا��تيار لوحة أو أكثر لإرسال طلب الحجز",
        variant: "destructive"
      });
      return;
    }

    const selectedNames = selectedBillboards.map(id => {
      const billboard = billboards.find(b => b.id === id);
      return billboard?.name || id;
    }).join(', ');

    toast({
      title: "تم إرسال طلب الحجز",
      description: `تم إرسال طلب حجز ${selectedBillboards.length} لوحة بإجم��لي ${getSelectedTotal().toLocaleString()} د.ل`,
    });

    // إعادة تعيين الاختيارات
    setSelectedBillboards([]);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary mx-auto mb-6"></div>
          <h2 className="text-2xl font-bold text-foreground mb-2">جاري تحميل اللوحات الإعلانية</h2>
          <p className="text-muted-foreground">يرجى الانتظار...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* الهيدر */}
      <header className="bg-gradient-dark shadow-elegant border-b border-border/50">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <img
                src="https://cdn.builder.io/api/v1/image/assets%2Ffc68c2d70dd74affa9a5bbf7eee66f4a%2F8d67e8499cfc4a8caf22e6c6835ab764?format=webp&width=128"
                alt="شعار الفارس الذهبي"
                className="w-16 h-16 rounded-2xl shadow-glow object-cover"
              />
            </div>
            
            <div className="flex items-center gap-4">
              <div className="text-left text-white/60">
                <div className="flex items-center gap-2 mb-1">
                  <Phone className="h-4 w-4" />
                  <span className="text-sm">+218 91 123 4567</span>
                </div>
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4" />
                  <span className="text-sm">info@billboards.ly</span>
                </div>
              </div>
              {!user && (
                <Button asChild variant="secondary" className="ml-2">
                  <Link to="/auth">تسجيل الدخول</Link>
                </Button>
              )}
              {user && (isAdmin || (user?.permissions && user.permissions.length > 0)) && (
                <Button asChild className="ml-2">
                  <Link to="/admin">لوحة التحكم</Link>
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* إحصائيات سريعة */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card className="bg-gradient-card border-0 shadow-card">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">{billboards.length}</h3>
              <p className="text-muted-foreground">لوحة متاحة</p>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-card border-0 shadow-card">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-success/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                <Globe className="h-6 w-6 text-success" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">{cities.length}</h3>
              <p className="text-muted-foreground">مدينة</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-0 shadow-card">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-warning/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                <DollarSign className="h-6 w-6 text-warning" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">2,500</h3>
              <p className="text-muted-foreground">د.ل ابتداءً من</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-card border-0 shadow-card">
            <CardContent className="p-6 text-center">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-3">
                <ShoppingCart className="h-6 w-6 text-primary" />
              </div>
              <h3 className="text-2xl font-bold text-foreground">{selectedBillboards.length}</h3>
              <p className="text-muted-foreground">مختارة</p>
            </CardContent>
          </Card>
        </div>

        {/* أدوات البحث والتصفية */}
        <Card className="bg-gradient-card border-0 shadow-card mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Filter className="h-5 w-5 text-primary" />
              ابحث عن اللوحة المناسبة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-muted-foreground">استخدم الفلاتر للعثور على اللوحات المناسبة</div>
              <Button variant="outline" onClick={() => setShowMap(v => !v)}>
                {showMap ? 'إخفاء الخريطة' : 'إظهار الخريطة'}
              </Button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث بالاسم أو الموقع..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10"
                />
              </div>
              
              <MultiSelect
                options={cities.map(c => ({ label: c, value: c }))}
                value={selectedCities}
                onChange={setSelectedCities}
                placeholder="جميع المدن"
              />

              <MultiSelect
                options={sizes.map(s => ({ label: s, value: s }))}
                value={selectedSizes}
                onChange={setSelectedSizes}
                placeholder="جميع الأحجام"
              />

              <MultiSelect
                options={[{label:'متاح', value:'available'},{label:'محجوز', value:'rented'},{label:'قريبة الانتهاء', value:'near'}]}
                value={selectedStatuses}
                onChange={setSelectedStatuses}
                placeholder="الحالة"
              />

              {isAdmin && (
                <MultiSelect
                  options={clients.map(c => ({ label: c, value: c }))}
                  value={selectedClients}
                  onChange={setSelectedClients}
                  placeholder="الزبائن"
                />
              )}

              {isAdmin && (
                <MultiSelect
                  options={contracts.map(c => ({ label: c, value: c }))}
                  value={selectedContracts}
                  onChange={setSelectedContracts}
                  placeholder={selectedClients.length ? "عقود العميل" : "أرقام العق��د"}
                />
              )}

              <Button
                onClick={() => {
                  setSearchQuery('');
                  setSelectedCities([]);
                  setSelectedSizes([]);
                  setSelectedStatuses(['available']);
                  setSelectedClients([]);
                  setSelectedContracts([]);
                  setCurrentPage(1);
                }}
                variant="outline"
              >
                مسح الفلاتر
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* خريطة تفاعلية */}
        {showMap && (
          <Card className="bg-gradient-card border-0 shadow-card mb-8 relative z-0">
            <CardHeader>
              <CardTitle>الخريطة</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="relative z-0">
                <BillboardsMap 
                  billboards={filteredBillboards} 
                  selectedBillboards={selectedBillboards}
                  onToggleSelection={toggleBillboardSelection}
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* عرض اللوحات */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {paginatedBillboards.map((billboard) => (
            <Card 
              key={billboard.id} 
              className={`bg-gradient-card border-0 shadow-card hover:shadow-elegant transition-smooth overflow-hidden ${
                selectedBillboards.includes(billboard.id) ? 'ring-2 ring-primary shadow-glow' : ''
              }`}
            >
              <div className="relative">
                <Dialog>
                  <DialogTrigger asChild>
                    <img
                      src={billboard.image || "/placeholder.svg"}
                      alt={billboard.name}
                      className="w-full h-48 object-cover cursor-zoom-in"
                    />
                  </DialogTrigger>
                  <DialogContent className="max-w-3xl p-0 bg-transparent border-0 shadow-none">
                    <img
                      src={billboard.image || "/placeholder.svg"}
                      alt={billboard.name}
                      className="w-full h-auto rounded-lg"
                    />
                  </DialogContent>
                </Dialog>
                <div className="absolute top-4 right-4">
                  { (billboard as any).nearExpiry ? (
                    <Badge className="bg-warning text-warning-foreground border-warning">قريبة الانتهاء</Badge>
                  ) : billboard.status === 'rented' ? (
                    <Badge className="bg-destructive text-destructive-foreground border-destructive">محجوز</Badge>
                  ) : (
                    <Badge className="bg-success text-success-foreground border-success">متاح</Badge>
                  ) }
                </div>
                <div className="absolute top-4 left-4">
                  <Badge className="bg-primary text-primary-foreground border-primary">
                    {billboard.size}
                  </Badge>
                </div>
                
                {/* زر الاختيار */}
                <div className="absolute bottom-4 right-4">
                  <div
                    className="flex items-center gap-2 bg-white/90 backdrop-blur-sm rounded-lg p-2 cursor-pointer"
                    onClick={(e) => { e.stopPropagation(); toggleBillboardSelection(billboard.id || String(billboard.ID)); }}
                  >
                    <Checkbox
                      id={`billboard-${billboard.id || billboard.ID}`}
                      checked={selectedBillboards.includes(billboard.id || String(billboard.ID))}
                      onCheckedChange={() => toggleBillboardSelection(billboard.id || String(billboard.ID))}
                      className="data-[state=checked]:bg-primary data-[state=checked]:border-primary"
                    />
                    <label
                      htmlFor={`billboard-${billboard.id || billboard.ID}`}
                      className="text-sm font-medium cursor-pointer"
                      onClick={(e) => { e.preventDefault(); toggleBillboardSelection(billboard.id || String(billboard.ID)); }}
                    >
                      اختيار
                    </label>
                  </div>
                </div>
              </div>
              
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-bold text-2xl text-foreground">{billboard.name}</h3>
                      { typeof (billboard as any).remainingDays === 'number' && (billboard as any).remainingDays > 0 && (
                        <span className={"ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium " + ((billboard as any).remainingDays <= 20 ? 'bg-warning text-warning-foreground' : 'bg-muted text-foreground') }>
                          <Hourglass className="h-3 w-3" />
                          متبقي {(billboard as any).remainingDays} يوم
                        </span>
                      ) }
                    </div>
                    {(billboard.location && billboard.location !== 'غير محدد') && (
                      <div className="flex items-center gap-2 text-muted-foreground text-base">
                        <MapPin className="h-4 w-4" />
                        <span>{billboard.location}</span>
                      </div>
                    )}
                    {(((billboard as any).district && (billboard as any).district !== 'غير محدد') || ((billboard as any).municipality && (billboard as any).municipality !== 'غير محدد')) ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {(billboard as any).district && (billboard as any).district !== 'غير محدد' && (
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5">{(billboard as any).district}</span>
                        )}
                        {(billboard as any).municipality && (billboard as any).municipality !== 'غير محدد' && (
                          <span className="inline-flex items-center rounded-full bg-muted px-2 py-0.5">{(billboard as any).municipality}</span>
                        )}
                      </div>
                    ) : null}
                  </div>

                  <div className="space-y-3">
                    { (billboard.status === 'available' || (billboard as any).nearExpiry) ? (
                      <>
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">السعر حسب الباقة:</span>
                          <span className="font-semibold text-primary">
                            {(() => { const months = packageById[billboard.id] || 1; const customer = customerTypeById[billboard.id] || defaultCustomer; const price = getPriceFor(billboard.size, (billboard as any).level, customer, months); return (price ?? 0).toLocaleString(); })()} د.ل
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-3 items-center">
                          <div className="text-sm text-muted-foreground">الباقة:</div>
                          <Select value={String(packageById[billboard.id] || 1)} onValueChange={(v) => setPackageById((p) => { const months = parseInt(v); const next = { ...p }; const ids = selectedBillboards.length ? selectedBillboards : [billboard.id]; ids.forEach(id => { next[id] = months; }); return next; })}>
                            <SelectTrigger>
                              <SelectValue placeholder="شهر واحد" />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="1">شهر واحد</SelectItem>
                              <SelectItem value="2">شهران</SelectItem>
                              <SelectItem value="3">3 أشهر</SelectItem>
                              <SelectItem value="6">6 أشهر</SelectItem>
                              <SelectItem value="12">سنة كاملة</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-3 items-center">
                          <div className="text-sm text-muted-foreground">نوع الزبون:</div>
                          <Select value={String(customerTypeById[billboard.id] || CUSTOMERS[0])} onValueChange={(v) => setCustomerTypeById(p => ({...p, [billboard.id]: v as CustomerType}))}>
                            <SelectTrigger>
                              <SelectValue placeholder="اختيار" />
                            </SelectTrigger>
                            <SelectContent>
                              {CUSTOMERS.map(c => (
                                <SelectItem key={c} value={c}>{c}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>

                        <div className="border-t pt-2">
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium text-foreground">الإجمالي:</span>
                            <span className="font-bold text-primary text-xl">
                              {(() => {
                                const months = packageById[billboard.id] || 1;
                                const customer = customerTypeById[billboard.id] || defaultCustomer;
                                const price = getPriceFor(billboard.size, (billboard as any).level, customer, months);
                                return (price ?? 0).toLocaleString();
                              })()} د.ل
                            </span>
                          </div>
                        </div>
                      </>
                    ) : (
                      <div className="text-sm text-muted-foreground">غير متاح للحجز حالياً</div>
                    ) }

                    {isAdmin && ((((billboard as any).clientName) || ((billboard as any).contractNumber) || ((billboard as any).adType) || ((billboard as any).expiryDate)) && (
                      <div className="mt-3 rounded-xl border border-border/50 bg-white/60 dark:bg-white/5 backdrop-blur-sm p-4 shadow-card">
                        <p className="mb-3 text-sm font-semibold text-foreground">بيانات الحجز</p>
                        <div className="grid grid-cols-1 gap-3 text-xs text-muted-foreground md:grid-cols-2">
                          <div className="flex items-center gap-2">
                            <User className="h-3.5 w-3.5" />
                            <span className="font-medium text-foreground">العميل:</span>
                            <span>{(billboard as any).clientName}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <FileText className="h-3.5 w-3.5" />
                            <span className="font-medium text-foreground">رقم العقد:</span>
                            <span>{(billboard as any).contractNumber}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <MapPin className="h-3.5 w-3.5" />
                            <span className="font-medium text-foreground">نوع الإعلان:</span>
                            <span>{(billboard as any).adType}</span>
                          </div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-3.5 w-3.5" />
                            <span className="font-medium text-foreground">ينتهي:</span>
                            <span>{(billboard as any).expiryDate}</span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => toggleBillboardSelection(billboard.id)}
                    >
                      {selectedBillboards.includes(billboard.id) ? (
                        <>
                          <Heart className="h-4 w-4 ml-1 fill-current" />
                          مختارة
                        </>
                      ) : (
                        <>
                          <Heart className="h-4 w-4 ml-1" />
                          إضافة
                        </>
                      )}
                    </Button>
                    <Button variant="outline" size="sm" className="px-3">
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button asChild variant="outline" size="sm" className="flex-1">
                      <a href={buildMapUrl(billboard)} target="_blank" rel="noopener noreferrer">
                        <MapPin className="h-4 w-4 ml-1" />
                        الخريطة
                      </a>
                    </Button>
                    {(billboard.status === 'available' || (billboard as any).nearExpiry) && (
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          const months = packageById[billboard.id] || 1;
                          const customer = customerTypeById[billboard.id] || defaultCustomer;
                          const price = getPriceFor(billboard.size, (billboard as any).level, customer, months) ?? 0;
                          toast({ title: 'تم إضافة حجز', description: `تم اختيار ${customer} لمدة ${months} شهر بإجمالي ${price.toLocaleString()} د.ل` });
                        }}
                      >
                        حجز سريع
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {totalPages > 1 && (
          <Pagination className="mb-8">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(Math.max(1, currentPageSafe - 1)); }} />
              </PaginationItem>
              {Array.from({ length: totalPages }).map((_, i) => {
                const page = i + 1;
                return (
                  <PaginationItem key={page}>
                    <PaginationLink href="#" isActive={page === currentPageSafe} onClick={(e) => { e.preventDefault(); setCurrentPage(page); }}>
                      {page}
                    </PaginationLink>
                  </PaginationItem>
                );
              })}
              <PaginationItem>
                <PaginationNext href="#" onClick={(e) => { e.preventDefault(); setCurrentPage(Math.min(totalPages, currentPageSafe + 1)); }} />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        )}

        {filteredBillboards.length === 0 && (
          <Card className="bg-gradient-card border-0 shadow-card">
            <CardContent className="p-12 text-center">
              <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-foreground mb-2">لا توجد نتائج</h3>
              <p className="text-muted-foreground">لم يتم العثور على لوحات تطابق معايير البحث المحددة</p>
            </CardContent>
          </Card>
        )}

        {/* شريط الطلب */}
        {selectedBillboards.length > 0 && (
          <div className="fixed bottom-6 left-6 right-6 z-50">
            <Card className="bg-gradient-primary shadow-glow border-0">
              <CardContent className="p-6">
                <div className="grid grid-cols-1 gap-4 text-white md:grid-cols-3 items-center">
                  <div>
                    <h3 className="font-bold text-lg mb-1">
                      {selectedBillboards.length} لوحة مختارة
                    </h3>
                    <p className="text-white/80 text-sm">
                      الإجمالي: {getSelectedTotal().toLocaleString()} د.ل
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <Select value={String((() => { const anyId = selectedBillboards[0]; return packageById[anyId] || 1; })())} onValueChange={(v) => {
                      const months = parseInt(v);
                      setPackageById(prev => {
                        const next = { ...prev };
                        selectedBillboards.forEach(id => { next[id] = months; });
                        return next;
                      });
                    }}>
                      <SelectTrigger className="bg-white/10 text-white border-white/20">
                        <SelectValue placeholder="الباقة"></SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="1">شهر واحد</SelectItem>
                        <SelectItem value="2">شهران</SelectItem>
                        <SelectItem value="3">3 أشهر</SelectItem>
                        <SelectItem value="6">6 أشهر</SelectItem>
                        <SelectItem value="12">سنة كاملة</SelectItem>
                      </SelectContent>
                    </Select>

                    <Select value={String((() => { const anyId = selectedBillboards[0]; return (customerTypeById[anyId] || defaultCustomer); })())} onValueChange={(v) => {
                      const customer = v as any;
                      setCustomerTypeById(prev => {
                        const next = { ...prev } as any;
                        selectedBillboards.forEach(id => { next[id] = customer; });
                        return next;
                      });
                    }}>
                      <SelectTrigger className="bg-white/10 text-white border-white/20">
                        <SelectValue placeholder="نوع ال��بون"></SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        {CUSTOMERS.map(c => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="flex gap-3 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => setSelectedBillboards([])}
                      className="bg-white/10 border-white/20 text-white hover:bg-white/20"
                    >
                      مسح الكل
                    </Button>
                    <Button
                      onClick={handleSubmitRequest}
                      className="bg-white text-primary hover:bg-white/90 font-semibold"
                    >
                      <ShoppingCart className="h-4 w-4 ml-2" />
                      إرسال طلب الحجز
                    </Button>
                    <Button
                      onClick={() => setInvoiceOpen(true)}
                      className="bg-white text-primary hover:bg-white/90 font-semibold"
                    >
                      طباعة فاتورة
                    </Button>
                    <Button
                      onClick={() => setQuoteOpen(true)}
                      className="bg-white text-primary hover:bg-white/90 font-semibold"
                    >
                      عرض سعر
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        <InvoiceDialog
          open={invoiceOpen}
          onOpenChange={setInvoiceOpen}
          items={billboards.filter(b => selectedBillboards.includes(b.id))}
          monthsById={packageById}
          customerById={customerTypeById as any}
        />
        <QuoteDialog
          open={quoteOpen}
          onOpenChange={setQuoteOpen}
          items={billboards.filter(b => selectedBillboards.includes(b.id))}
          monthsById={packageById}
          customerById={customerTypeById as any}
        />
      </div>
    </div>
  );
}
