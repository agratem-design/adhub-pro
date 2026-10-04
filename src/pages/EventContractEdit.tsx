// @ts-nocheck
import { RentalCompensationAlert, type CompensationChoices } from '@/components/contracts/RentalCompensationAlert';
import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  ArrowLeft,
  PartyPopper,
  Search,
  X,
  Save,
  Calendar as CalendarIcon,
  Clock,
  User,
  MapPin,
  DollarSign,
  Percent,
  Filter,
  CheckCircle2,
  List,
  Map as MapIcon,
  Layers,
  Plus,
  ChevronDown,
} from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import SelectableGoogleHomeMap from '@/components/Map/SelectableGoogleHomeMap';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import {
  createEventContract,
  getEventContract,
  updateEventContract,
  getReservedEventBillboardIds,
} from '@/services/eventContractService';
import { CustomerSelector } from '@/components/contracts/CustomerSelector';
import { BillboardImage } from '@/components/BillboardImage';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { isBillboardAvailable } from '@/utils/contractUtils';
import { ContractDatesForm } from '@/components/contracts/edit/ContractDatesForm';
import { ContractEditHeader } from '@/components/contracts/edit/ContractEditHeader';
import { SelectedBillboardsCard } from '@/components/contracts/edit/SelectedBillboardsCard';
import { AvailableBillboardsGrid } from '@/components/contracts/edit/AvailableBillboardsGrid';
import { BillboardFilters } from '@/components/contracts/edit/BillboardFilters';
import { CostSummaryCard } from '@/components/contracts/edit/CostSummaryCard';
import { CustomerInfoForm } from '@/components/contracts/edit/CustomerInfoForm';
import { durationEnd } from '@/utils/pricingDuration';
import { usePricingDurations } from '@/hooks/usePricingDurations';

export default function EventContractEdit() {
  const [compensationChoices, setCompensationChoices] = useState<CompensationChoices>({});
  const [savedCompensation, setSavedCompensation] = useState<any[]>([]);
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Event info
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customers, setCustomers] = useState<any[]>([]);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [eventName, setEventName] = useState('');
  const [eventType, setEventType] = useState('');
  const [pricingCategory, setPricingCategory] = useState('عادي');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [pricingMode, setPricingMode] = useState<'months' | 'days'>('days');
  const [durationMonths, setDurationMonths] = useState(1);
  const [durationDays, setDurationDays] = useState(1);
  const [use30DayMonth, setUse30DayMonth] = useState(true);
  const { data: pricingDurations = [] } = usePricingDurations();
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [contractNumber, setContractNumber] = useState<string>('');

  // Billboards
  const [allBillboards, setAllBillboards] = useState<any[]>([]);
  const [eventPrices, setEventPrices] = useState<any[]>([]);
  const [reservedIds, setReservedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Record<string, { daily_price: number; name: string }>>({});

  // Filters
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [showUnavailable, setShowUnavailable] = useState(false);

  // ✅ نفس تخطيط صفحة تعديل العقد
  const [workspaceSection, setWorkspaceSection] = useState<'basics' | 'boards' | 'catalog' | 'pricing'>('boards');
  const [boardsViewMode, setBoardsViewMode] = useState<'cards' | 'map' | 'split'>('cards');
  const [catalogFiltersCollapsed, setCatalogFiltersCollapsed] = useState(false);

  // Load billboards
  useEffect(() => {
    (async () => {
      const [{ data }, { data: prices }] = await Promise.all([
        supabase.from('billboards').select('*').limit(5000),
        supabase.from('event_pricing' as any).select('*').eq('active', true),
      ]);
      setAllBillboards(data || []);
      setEventPrices(prices || []);
    })();
  }, []);

  useEffect(() => {
    supabase.from('customers').select('id,name,company,phone').order('name').limit(2000).then(({ data }) => setCustomers(data || []));
  }, []);

  const addCustomer = async (name: string) => {
    if (!name) return;
    const { data, error } = await supabase.from('customers').insert({ name }).select('id,name,company,phone').single();
    if (error) { toast.error('تعذر إضافة العميل: ' + error.message); return; }
    setCustomers((prev) => [...prev, data]); setCustomerName(data.name); setCustomerId(data.id); setCustomerOpen(false); setCustomerQuery('');
  };

  // Load existing contract
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        setLoading(true);
        const { contract, billboards } = await getEventContract(id);
        setCustomerName(contract.customer_name);
        setCustomerId(contract.customer_id || null);
        setEventName(contract.event_name);
        setEventType(contract.event_type || '');
        setStartDate(contract.start_date);
        setEndDate(contract.end_date);
        const savedDays = Math.max(1, Math.ceil((new Date(contract.end_date).getTime() - new Date(contract.start_date).getTime()) / 86400000) + 1);
        setPricingMode('days');
        setDurationDays(savedDays);
        setDiscount(Number(contract.discount_amount) || 0);
        setNotes(contract.notes || '');
        setContractNumber(contract.event_contract_number || '');
        const sel: any = {};
        billboards.forEach((b) => {
          sel[b.billboard_id] = { daily_price: Number(b.daily_price), name: b.billboard_name || '' };
        });
        setSelected(sel);
        const { data: ledger } = await supabase.from('event_original_compensation' as any).select('*').eq('event_id', id);
        setSavedCompensation((ledger || []).map((r: any) => ({ billboardId: String(r.billboard_id), originalContractNumber: r.contract_number, compensateOriginal: r.days > 0 })));

      } catch (e: any) {
        toast.error('فشل التحميل: ' + e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [id]);

  // Refresh reservations when dates change
  useEffect(() => {
    if (!startDate || !endDate) {
      setReservedIds(new Set());
      return;
    }
    getReservedEventBillboardIds(startDate, endDate, id).then(setReservedIds).catch(() => {});
  }, [startDate, endDate, id]);

  useEffect(() => {
    if (!startDate) return;
    const end = pricingMode === 'months'
      ? durationEnd(startDate, durationMonths, use30DayMonth, pricingDurations)
      : new Date(`${startDate}T00:00:00`);
    if (pricingMode === 'days') end.setDate(end.getDate() + Math.max(0, durationDays - 1));
    if (!Number.isNaN(end.getTime())) setEndDate(end.toISOString().slice(0, 10));
  }, [startDate, pricingMode, durationMonths, durationDays, use30DayMonth, pricingDurations]);

  const days = useMemo(() => {
    if (!startDate || !endDate) return 0;
    const s = new Date(startDate);
    const e = new Date(endDate);
    return Math.max(1, Math.ceil((e.getTime() - s.getTime()) / 86400000) + 1);
  }, [startDate, endDate]);

  // Cities and sizes lists
  const cityOptions = useMemo(() => {
    const set = new Set<string>();
    allBillboards.forEach((b) => {
      const city = b.City || b.city;
      if (city) set.add(String(city));
    });
    return Array.from(set).sort();
  }, [allBillboards]);

  const sizeOptions = useMemo(() => {
    const set = new Set<string>();
    allBillboards.forEach((b) => {
      const sz = b.Size || b.size;
      if (sz) set.add(String(sz));
    });
    return Array.from(set).sort();
  }, [allBillboards]);

  const filtered = useMemo(() => {
    const q = search.trim();
    return allBillboards.filter((b) => {
      const bid = String(b.ID);
      if (!showUnavailable && !selected[bid] && !isBillboardAvailable(b)) return false;
      if (q) {
        const hay = [b.Billboard_Name, b.City, b.District, b.Size, b.Nearest_Landmark]
          .map((v: any) => String(v || ''))
          .join(' ');
        if (!hay.includes(q)) return false;
      }
      if (cityFilter !== 'all' && String(b.City || b.city || '') !== cityFilter) return false;
      if (sizeFilter !== 'all' && String(b.Size || b.size || '') !== sizeFilter) return false;
      return true;
    });
  }, [allBillboards, search, cityFilter, sizeFilter, showUnavailable, selected]);

  const availableCount = useMemo(
    () => allBillboards.filter((b) => isBillboardAvailable(b) || selected[String(b.ID)]).length,
    [allBillboards, selected]
  );

  const eventDailyPrice = (b: any) => {
    const size = String(b.Size || b.size || '').trim().toLowerCase();
    const level = String(b.Level || b.level || b.billboard_level || 'عادي').trim().toLowerCase();
    const category = String(pricingCategory || 'عادي').trim().toLowerCase();
    const match = eventPrices.find((p) => String(p.size || '').trim().toLowerCase() === size && String(p.billboard_level || 'عادي').trim().toLowerCase() === level && String(p.customer_category || 'عادي').trim().toLowerCase() === category)
      || eventPrices.find((p) => String(p.size || '').trim().toLowerCase() === size);
    return match ? Number(match.one_day || 0) : Number(b.Price || b.price || 0);
  };

  const eventCategories = useMemo(() => Array.from(new Set(eventPrices.map((p) => String(p.customer_category || 'عادي')))), [eventPrices]);

  const selectedBillboards = useMemo(
    () => allBillboards.filter((b) => !!selected[String(b.ID)]),
    [allBillboards, selected]
  );

  const subtotal = useMemo(() => {
    return Object.values(selected).reduce((sum, s) => sum + s.daily_price * days, 0);
  }, [selected, days]);

  const total = Math.max(0, subtotal - (Number(discount) || 0));

  const toggle = (b: any) => {
    const bid = String(b.ID);
    if (!selected[bid] && reservedIds.has(bid)) {
      toast.error('هذه اللوحة محجوزة لمناسبة أخرى في نفس الفترة');
      return;
    }
    setSelected((prev) => {
      const next = { ...prev };
      if (next[bid]) delete next[bid];
      else next[bid] = { daily_price: eventDailyPrice(b), name: b.Billboard_Name || '' };
      return next;
    });
  };

  const remove = (bid: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      delete next[bid];
      return next;
    });
  };

  const bulkRemove = (bids: string[]) => {
    setSelected((prev) => {
      const next = { ...prev };
      bids.forEach((bid) => delete next[bid]);
      return next;
    });
  };

  const updatePrice = (bid: string, p: number) => {
    setSelected((prev) => ({ ...prev, [bid]: { ...prev[bid], daily_price: p } }));
  };

  const handleSave = async () => {
    if (!customerName || !eventName || !startDate || !endDate) {
      toast.error('أكمل: العميل، اسم المناسبة، التواريخ');
      return;
    }
    if (Object.keys(selected).length === 0) {
      toast.error('اختر لوحة واحدة على الأقل');
      return;
    }
    try {
      setSaving(true);
      const billboards = Object.entries(selected).map(([bid, v]) => ({
        billboard_id: bid,
        compensate_original: compensationChoices[bid]?.enabled ?? savedCompensation.find(p => p.billboardId === bid)?.compensateOriginal ?? false,
        billboard_name: v.name,
        daily_price: v.daily_price,
        total_price: v.daily_price * days,
      }));
      const payload = {
        customer_id: customerId || null,
        customer_name: customerName,
        event_name: eventName,
        event_type: eventType,
        start_date: startDate,
        end_date: endDate,
        total_amount: total,
        discount_amount: discount,
        notes,
        billboards,
      };
      if (isEdit) {
        await updateEventContract(id!, payload as any);
        toast.success('تم تحديث عقد المناسبة');
      } else {
        await createEventContract(payload);
        toast.success('تم إنشاء عقد المناسبة');
      }
      navigate('/admin/events-contracts');
    } catch (e: any) {
      toast.error('فشل الحفظ: ' + e.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  const selectedSet = new Set(Object.keys(selected));
  const toMapBillboard = (b: any) => {
    const bid = String(b.ID);
    const reserved = reservedIds.has(bid) && !selected[bid];
    const available = !reserved && (isBillboardAvailable(b) || !!selected[bid]);
    return {
      ...b,
      ID: b.ID || 0,
      Billboard_Name: b.Billboard_Name || '',
      Status: available ? 'متاح' : 'محجوز',
      id: bid,
      name: b.Billboard_Name || '',
      location: b.Nearest_Landmark || '',
      size: b.Size || '',
      status: available ? 'available' : 'rented',
      coordinates: b.GPS_Coordinates || '',
      imageUrl: b.Image_URL || '',
    };
  };

  return (
    <div className="min-h-screen bg-muted/20 text-foreground p-3 md:p-4" dir="rtl">
      <div className="max-w-[1440px] mx-auto space-y-3">
        <div className="sticky top-0 z-30 space-y-2 bg-background/95 pb-2 backdrop-blur">
        <ContractEditHeader
          contractNumber={contractNumber}
          title={isEdit ? `تعديل عقد مناسبة ${contractNumber ? '#' + contractNumber : ''}` : 'عقد مناسبة جديد'}
          subtitle="عقد المناسبة يحجز اللوحات للفترة المحددة — راجع الأسعار قبل الحفظ"
          printLabel="طباعة"
          saveLabel={isEdit ? 'حفظ التعديلات' : 'إنشاء عقد المناسبة'}
          onBack={() => navigate('/admin/events-contracts')}
          onPrint={() => window.print()}
          onSave={handleSave}
          saving={saving}
        />
        <nav aria-label="أقسام تعديل عقد المناسبة" className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1.5">
          {([
            ['basics', 'بيانات المناسبة'],
            ['boards', `لوحات المناسبة (${Object.keys(selected).length})`],
            ['catalog', 'اختيار لوحات جديدة'],
            ['pricing', 'الأسعار والملخص'],
          ] as const).map(([section, label]) => (
            <button key={section} type="button" aria-pressed={workspaceSection === section}
              onClick={() => setWorkspaceSection(section)}
              className={`min-h-11 flex-1 cursor-pointer whitespace-nowrap rounded-lg px-4 py-2 text-sm font-semibold transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${workspaceSection === section ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}>
              {label}
            </button>
          ))}
        </nav>
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-lg border border-border bg-card px-3 py-2 sm:grid-cols-4" aria-live="polite">
          <div><span className="text-xs text-muted-foreground">نوع النظام</span><p className="text-sm font-semibold">عقد مناسبة</p></div>
          <div><span className="text-xs text-muted-foreground">اللوحات المختارة</span><p className="font-semibold">{Object.keys(selected).length} لوحة</p></div>
          <div><span className="text-xs text-muted-foreground">مدة المناسبة</span><p className="font-semibold">{days} يوم</p></div>
          <div><span className="text-xs text-muted-foreground">الإجمالي</span><p className="font-semibold text-primary">{total.toLocaleString('ar-LY')} د.ل</p></div>
        </div>

        <RentalCompensationAlert billboards={selectedBillboards} startDate={startDate} endDate={endDate} choices={compensationChoices} onChange={setCompensationChoices} savedPrices={savedCompensation} />

        <section className={`${workspaceSection === 'basics' ? 'grid' : 'hidden'} scroll-mt-40 items-start gap-5 lg:grid-cols-2`} aria-label="بيانات المناسبة">
          <div className="space-y-4">
            <CustomerInfoForm
              customerName={customerName}
              setCustomerName={setCustomerName}
              adType={eventType}
              setAdType={setEventType}
              pricingCategory={pricingCategory}
              setPricingCategory={setPricingCategory}
              pricingCategories={eventCategories.length ? eventCategories : ['عادي']}
              customers={customers}
              customerOpen={customerOpen}
              setCustomerOpen={setCustomerOpen}
              customerQuery={customerQuery}
              setCustomerQuery={setCustomerQuery}
              onAddCustomer={addCustomer}
              onSelectCustomer={(customer) => { setCustomerName(customer.name); setCustomerId(customer.id); setCustomerOpen(false); }}
            />
            <Card className="border-border shadow-sm">
              <CardContent className="p-4 space-y-3">
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">اسم المناسبة</Label>
                  <Input value={eventName} onChange={(e) => setEventName(e.target.value)} placeholder="مثال: مهرجان الربيع" className="mt-1.5" />
                </div>
                <div>
                  <Label className="text-xs font-medium text-muted-foreground">ملاحظات</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} className="mt-1.5" />
                </div>
              </CardContent>
            </Card>
          </div>
          <ContractDatesForm
            startDate={startDate}
            setStartDate={setStartDate}
            endDate={endDate}
            pricingMode={pricingMode}
            setPricingMode={setPricingMode}
            durationMonths={durationMonths}
            setDurationMonths={setDurationMonths}
            durationDays={durationDays}
            setDurationDays={setDurationDays}
            use30DayMonth={use30DayMonth}
            setUse30DayMonth={setUse30DayMonth}
          />
        </section>

        <div className="flex flex-col gap-6">
          <div className={`${['boards', 'catalog'].includes(workspaceSection) ? 'block' : 'hidden'} scroll-mt-40 min-w-0 space-y-4`}>
            <div className={workspaceSection === 'boards' ? 'space-y-3' : 'hidden'}>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-base font-bold">لوحات المناسبة</h2>
                <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-xl border border-border">
                  <Button type="button" size="sm" variant={boardsViewMode === 'cards' ? 'default' : 'ghost'} onClick={() => setBoardsViewMode('cards')} className="h-8 gap-1.5 text-xs font-medium cursor-pointer">
                    <List className="h-3.5 w-3.5" />
                    قائمة البطاقات
                  </Button>
                  <Button type="button" size="sm" variant={boardsViewMode === 'map' ? 'default' : 'ghost'} onClick={() => setBoardsViewMode('map')} className="h-8 gap-1.5 text-xs font-medium cursor-pointer">
                    <MapIcon className="h-3.5 w-3.5" />
                    خريطة اللوحات ({Object.keys(selected).length})
                  </Button>
                  <Button type="button" size="sm" variant={boardsViewMode === 'split' ? 'default' : 'ghost'} onClick={() => setBoardsViewMode('split')} className="h-8 gap-1.5 text-xs font-medium cursor-pointer">
                    <Layers className="h-3.5 w-3.5" />
                    عرض مدمج
                  </Button>
                </div>
              </div>
              <Button type="button" variant="outline" onClick={() => setWorkspaceSection('catalog')} className="min-h-10 cursor-pointer gap-2 transition-all duration-200">
                <Plus className="h-4 w-4" />
                اختيار لوحات جديدة
              </Button>
            </div>

            {boardsViewMode === 'map' && (
              <div className="w-full h-[760px] lg:h-[84vh] min-h-[620px] rounded-2xl overflow-hidden border border-border shadow-sm relative">
                <SelectableGoogleHomeMap
                  className="w-full h-full"
                  billboards={selectedBillboards.map(toMapBillboard)}
                  selectedBillboards={selectedSet}
                  onToggleSelection={(billboardId) => {
                    const billboard = allBillboards.find((b) => String(b.ID) === billboardId);
                    if (billboard) toggle(billboard);
                  }}
                  pricingMode="days"
                  durationDays={days}
                  pricingCategory={pricingCategory}
                  calculateBillboardPrice={(b: any) => (selected[String(b.ID)]?.daily_price ?? eventDailyPrice(b)) * days}
                />
              </div>
            )}
            {boardsViewMode === 'split' && (
              <div className="w-full h-[540px] lg:h-[58vh] min-h-[440px] mb-4 rounded-2xl overflow-hidden border border-border shadow-sm relative">
                <SelectableGoogleHomeMap
                  className="w-full h-full"
                  billboards={selectedBillboards.map(toMapBillboard)}
                  selectedBillboards={selectedSet}
                  onToggleSelection={(billboardId) => {
                    const billboard = allBillboards.find((b) => String(b.ID) === billboardId);
                    if (billboard) toggle(billboard);
                  }}
                  pricingMode="days"
                  durationDays={days}
                  pricingCategory={pricingCategory}
                  calculateBillboardPrice={(b: any) => (selected[String(b.ID)]?.daily_price ?? eventDailyPrice(b)) * days}
                />
              </div>
            )}
            {boardsViewMode !== 'map' && (
              <SelectedBillboardsCard
                selected={Object.keys(selected)}
                billboards={selectedBillboards}
                onRemoveSelected={remove}
                onBulkRemove={bulkRemove}
                calculateBillboardPrice={(b) => (selected[String(b.ID)]?.daily_price || 0) * days}
                installationDetails={[]}
                pricingMode="days"
                durationMonths={0}
                durationDays={days}
                startDate={startDate}
                endDate={endDate}
                customerCategory={pricingCategory}
                customerName={customerName}
                adType={eventType}
                installationEnabled={false}
                printCostEnabled={false}
              />
            )}
            </div>

            <div className={workspaceSection === 'catalog' ? 'space-y-4' : 'hidden'}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div><h2 className="text-lg font-bold">اختيار لوحات جديدة</h2><p className="text-sm text-muted-foreground">اللوحات المحجوزة لمناسبة أخرى في نفس الفترة لا يمكن اختيارها</p></div>
                <Button type="button" variant="outline" onClick={() => setWorkspaceSection('boards')} className="min-h-10 cursor-pointer transition-all duration-200">مراجعة لوحات المناسبة ({Object.keys(selected).length})</Button>
              </div>
            <Card className="flex min-h-[700px] flex-col overflow-hidden border-border shadow-sm">
              <div className="shrink-0 border-b border-border bg-gradient-to-l from-primary/10 via-primary/5 to-transparent p-3 lg:p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                    <Filter className="h-3.5 w-3.5 text-primary" />
                    فلاتر البحث والتصفية
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setCatalogFiltersCollapsed(prev => !prev)}
                    className="h-7 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground cursor-pointer rounded-lg border border-border/60 bg-background/50"
                  >
                    <span>{catalogFiltersCollapsed ? 'إظهار الفلاتر' : 'طي الفلاتر لتوسيع المساحة'}</span>
                    <ChevronDown className={`h-3.5 w-3.5 transition-transform duration-200 ${catalogFiltersCollapsed ? '' : 'rotate-180'}`} />
                  </Button>
                </div>
                {!catalogFiltersCollapsed && (
                  <BillboardFilters
                    searchQuery={search}
                    setSearchQuery={setSearch}
                    cityFilter={cityFilter}
                    setCityFilter={setCityFilter}
                    sizeFilter={sizeFilter}
                    setSizeFilter={setSizeFilter}
                    statusFilter={showUnavailable ? 'all' : 'available'}
                    setStatusFilter={(v: string) => setShowUnavailable(v !== 'available')}
                    pricingCategory={pricingCategory}
                    setPricingCategory={setPricingCategory}
                    cities={cityOptions}
                    sizes={sizeOptions}
                    pricingCategories={eventCategories.length ? eventCategories : ['عادي']}
                    selectedCount={Object.keys(selected).length}
                    totalCount={filtered.length}
                    onClearSelection={() => setSelected({})}
                  />
                )}
              </div>
              <Tabs defaultValue="list" className="w-full flex-1 flex flex-col min-h-0">
                <div className="flex shrink-0 flex-col gap-3 border-b border-border bg-muted/20 p-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-foreground">اختيار اللوحات</h3>
                    <p className="text-xs text-muted-foreground">السعر المعروض هو سعر المناسبة لكامل المدة ({days} يوم)</p>
                  </div>
                  <TabsList className="grid h-11 w-full grid-cols-2 bg-background/70 sm:w-[240px]">
                    <TabsTrigger value="list" className="flex cursor-pointer items-center gap-2 transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <List className="h-4 w-4" />
                      القائمة
                    </TabsTrigger>
                    <TabsTrigger value="map" className="flex cursor-pointer items-center gap-2 transition-all duration-200 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <MapIcon className="h-4 w-4" />
                      الخريطة
                    </TabsTrigger>
                  </TabsList>
                </div>
                <TabsContent value="list" className="m-0 flex-1 overflow-y-auto min-h-[500px] max-h-[75vh]">
                  <div className="space-y-3 p-3 lg:p-5">
                    <AvailableBillboardsGrid
                      billboards={filtered.filter((b) => !reservedIds.has(String(b.ID)) || !!selected[String(b.ID)])}
                      selected={Object.keys(selected)}
                      onToggleSelect={toggle}
                      loading={loading}
                      calculateBillboardPrice={(b: any) => eventDailyPrice(b) * days}
                      pricingMode="days"
                      durationDays={days}
                      pricingCategory={pricingCategory}
                      onSelectCityFilter={(c) => setCityFilter(c)}
                      onSelectSizeFilter={(sz) => setSizeFilter(sz)}
                    />
                  </div>
                </TabsContent>
                <TabsContent value="map" className="m-0 p-0 flex-1 min-h-[650px] h-[760px] lg:h-[84vh] relative">
                  <SelectableGoogleHomeMap
                    className="w-full h-full min-h-[650px]"
                    hideInternalFilters
                    billboards={filtered.map(toMapBillboard)}
                    selectedBillboards={selectedSet}
                    onToggleSelection={(billboardId) => {
                      const billboard = allBillboards.find((b) => String(b.ID) === billboardId);
                      if (billboard) toggle(billboard);
                    }}
                    onSelectMultiple={(billboardIds) => {
                      const picked = billboardIds.filter((bid) => !reservedIds.has(String(bid)));
                      setSelected((prev) => {
                        const next = { ...prev };
                        picked.forEach((bid) => {
                          const b = allBillboards.find((x) => String(x.ID) === String(bid));
                          if (b && !next[String(bid)]) next[String(bid)] = { daily_price: eventDailyPrice(b), name: b.Billboard_Name || '' };
                        });
                        return next;
                      });
                      toast.success(`تم تحديد ${picked.length} لوحة`);
                    }}
                    pricingMode="days"
                    durationDays={days}
                    pricingCategory={pricingCategory}
                    calculateBillboardPrice={(b: any) => eventDailyPrice(b) * days}
                  />
                </TabsContent>
              </Tabs>
            </Card>
            </div>
          </div>

          <div className={`${workspaceSection === 'pricing' ? 'grid' : 'hidden'} scroll-mt-40 min-w-0 items-start gap-5 lg:grid-cols-2`}>
            <div className="lg:col-span-2">
              <h2 className="text-lg font-bold">أسعار المناسبة والملخص</h2>
              <p className="text-sm text-muted-foreground">السعر اليومي لكل لوحة من تسعيرة المناسبات، ويمكن تعديله يدوياً</p>
            </div>
            <Card className="bg-card border-border shadow-lg overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-emerald-500 to-green-500" />
              <CardHeader className="py-3 px-4 bg-gradient-to-br from-emerald-500/5 to-transparent">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="p-1.5 rounded-lg bg-emerald-500/10">
                    <DollarSign className="h-4 w-4 text-emerald-600" />
                  </div>
                  الأسعار اليومية للوحات
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-2 max-h-[60vh] overflow-y-auto">
                {selectedBillboards.length === 0 ? (
                  <div className="text-sm text-muted-foreground text-center py-4 bg-muted/20 rounded-lg">لا توجد لوحات مختارة</div>
                ) : selectedBillboards.map((b) => {
                  const bid = String(b.ID);
                  const sel = selected[bid];
                  if (!sel) return null;
                  return (
                    <div key={bid} className="flex items-center gap-3 rounded-lg border border-border/60 bg-muted/20 p-2.5">
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{b.Billboard_Name}</div>
                        <div className="truncate text-xs text-muted-foreground">{b.Size} • {b.City}</div>
                      </div>
                      <Input
                        type="number"
                        min={0}
                        value={sel.daily_price}
                        onChange={(e) => updatePrice(bid, Number(e.target.value) || 0)}
                        className="h-9 w-28 text-center tabular-nums"
                        aria-label={`سعر اليوم للوحة ${b.Billboard_Name}`}
                      />
                      <span className="w-28 text-left text-sm font-bold text-emerald-600 tabular-nums">{(sel.daily_price * days).toLocaleString('ar-LY')} د.ل</span>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
            <CostSummaryCard
              estimatedTotal={subtotal}
              rentCost={total}
              setRentCost={() => {}}
              setUserEditedRentCost={() => {}}
              discountType="amount"
              setDiscountType={() => {}}
              discountValue={discount}
              setDiscountValue={setDiscount}
              baseTotal={subtotal}
              discountAmount={discount}
              finalTotal={total}
              installationCost={0}
              rentalCostOnly={subtotal}
              operatingFee={0}
              currentContract={null}
              originalTotal={0}
              onSave={handleSave}
              onCancel={() => navigate('/admin/events-contracts')}
              saving={saving}
              currencySymbol="د.ل"
              installationEnabled={false}
              includeInstallationInPrice={false}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
