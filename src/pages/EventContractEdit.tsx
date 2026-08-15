// @ts-nocheck
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
} from 'lucide-react';
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

export default function EventContractEdit() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Event info
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [eventName, setEventName] = useState('');
  const [eventType, setEventType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [discount, setDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [contractNumber, setContractNumber] = useState<string>('');

  // Billboards
  const [allBillboards, setAllBillboards] = useState<any[]>([]);
  const [reservedIds, setReservedIds] = useState<Set<string>>(new Set());
  const [selected, setSelected] = useState<Record<string, { daily_price: number; name: string }>>({});

  // Filters
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');

  // Load billboards
  useEffect(() => {
    (async () => {
      const { data } = await supabase.from('billboards').select('*').limit(5000);
      setAllBillboards(data || []);
    })();
  }, []);

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
        setDiscount(Number(contract.discount_amount) || 0);
        setNotes(contract.notes || '');
        setContractNumber(contract.event_contract_number || '');
        const sel: any = {};
        billboards.forEach((b) => {
          sel[b.billboard_id] = { daily_price: Number(b.daily_price), name: b.billboard_name || '' };
        });
        setSelected(sel);
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
  }, [allBillboards, search, cityFilter, sizeFilter]);

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
    setSelected((prev) => {
      const next = { ...prev };
      if (next[bid]) delete next[bid];
      else next[bid] = { daily_price: Number(b.Price) || 0, name: b.Billboard_Name || '' };
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
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-fuchsia-500 mx-auto mb-4" />
          <p className="text-muted-foreground">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted/30 text-foreground p-4 md:p-6" dir="rtl">
      <div className="max-w-[1600px] mx-auto space-y-4">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-2">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold flex items-center gap-2">
              <PartyPopper className="h-6 w-6 text-fuchsia-500" />
              {isEdit ? `تعديل عقد مناسبة ${contractNumber ? `#${contractNumber}` : ''}` : 'عقد مناسبة جديد'}
            </h1>
            <p className="text-xs sm:text-sm text-muted-foreground mt-1">
              إدارة كاملة لعقد المناسبة مع اختيار اللوحات وحساب التكلفة
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => navigate('/admin/events-contracts')} size="sm">
              <ArrowLeft className="h-4 w-4 ml-2" />
              عودة
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-fuchsia-600 hover:bg-fuchsia-700 text-white"
              size="sm"
            >
              <Save className="h-4 w-4 ml-2" />
              {saving ? 'جاري الحفظ...' : 'حفظ العقد'}
            </Button>
          </div>
        </div>

        <div className="flex flex-col xl:flex-row gap-4">
          {/* Main Content */}
          <div className="flex-1 space-y-4">
            {/* Customer & Event Info */}
            <Card className="border-border shadow-lg overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-fuchsia-500 to-purple-500" />
              <CardHeader className="py-3 px-4 bg-gradient-to-r from-fuchsia-500/10 via-fuchsia-500/5 to-transparent border-b border-border">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="p-1.5 rounded-lg bg-fuchsia-500/20">
                    <User className="h-4 w-4 text-fuchsia-600" />
                  </div>
                  بيانات العميل والمناسبة
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">العميل</Label>
                    <CustomerSelector
                      customerName={customerName}
                      customerId={customerId}
                      onCustomerChange={(n, i) => {
                        setCustomerName(n);
                        setCustomerId(i);
                      }}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">اسم المناسبة</Label>
                    <Input
                      value={eventName}
                      onChange={(e) => setEventName(e.target.value)}
                      placeholder="مثلاً: مهرجان الربيع"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">نوع المناسبة</Label>
                    <Input
                      value={eventType}
                      onChange={(e) => setEventType(e.target.value)}
                      placeholder="معرض / حفل / إطلاق منتج..."
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground">عدد الأيام</Label>
                    <Input value={days} disabled className="text-center font-bold tabular-nums" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">ملاحظات</Label>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
                </div>
              </CardContent>
            </Card>

            {/* Dates */}
            <Card className="border-border shadow-lg overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-primary via-primary/70 to-primary/40" />
              <CardHeader className="py-3 px-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border">
                <CardTitle className="flex items-center gap-2 text-base">
                  <div className="p-1.5 rounded-lg bg-primary/20">
                    <CalendarIcon className="h-4 w-4 text-primary" />
                  </div>
                  تواريخ المناسبة
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <CalendarIcon className="h-3 w-3" />
                      تاريخ البداية
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full h-10 justify-start text-right font-medium',
                            !startDate && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="ml-2 h-4 w-4 text-primary" />
                          {startDate
                            ? format(new Date(startDate), 'dd MMMM yyyy', { locale: ar })
                            : 'اختر التاريخ'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[10000]" align="start">
                        <Calendar
                          mode="single"
                          selected={startDate ? new Date(startDate) : undefined}
                          onSelect={(d) => setStartDate(d ? format(d, 'yyyy-MM-dd') : '')}
                          locale={ar}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      تاريخ النهاية
                    </Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={cn(
                            'w-full h-10 justify-start text-right font-medium',
                            !endDate && 'text-muted-foreground'
                          )}
                        >
                          <CalendarIcon className="ml-2 h-4 w-4 text-primary" />
                          {endDate
                            ? format(new Date(endDate), 'dd MMMM yyyy', { locale: ar })
                            : 'اختر التاريخ'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0 z-[10000]" align="start">
                        <Calendar
                          mode="single"
                          selected={endDate ? new Date(endDate) : undefined}
                          onSelect={(d) => setEndDate(d ? format(d, 'yyyy-MM-dd') : '')}
                          locale={ar}
                          className="pointer-events-auto"
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {(startDate && endDate) && (
                  <div className="p-3 rounded-xl bg-gradient-to-br from-emerald-500/10 to-transparent border border-emerald-500/20 flex items-center justify-between">
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4" />
                      مدة المناسبة
                    </span>
                    <span className="font-bold text-emerald-600 tabular-nums">{days} يوم</span>
                  </div>
                )}
                {(!startDate || !endDate) && (
                  <div className="text-xs text-amber-600 bg-amber-500/10 border border-amber-500/20 rounded-lg p-2">
                    حدّد التواريخ لمعرفة اللوحات المحجوزة في هذه الفترة
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Selected Billboards */}
            {selectedBillboards.length > 0 && (
              <Card className="border-border shadow-lg overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-emerald-500 to-green-500" />
                <CardHeader className="py-3 px-4 bg-gradient-to-r from-emerald-500/10 to-transparent border-b border-border">
                  <CardTitle className="flex items-center justify-between gap-2 text-base">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 rounded-lg bg-emerald-500/20">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      </div>
                      اللوحات المختارة
                    </div>
                    <Badge variant="secondary" className="font-bold">
                      {selectedBillboards.length} لوحة
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {selectedBillboards.map((b) => {
                      const bid = String(b.ID);
                      const sel = selected[bid];
                      if (!sel) return null;
                      return (
                        <div
                          key={bid}
                          className="relative bg-card border border-border rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-all"
                        >
                          <button
                            type="button"
                            onClick={() => remove(bid)}
                            className="absolute top-2 left-2 z-10 w-7 h-7 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 flex items-center justify-center shadow-md"
                            title="إزالة"
                          >
                            <X className="h-4 w-4" />
                          </button>
                          <div className="aspect-video bg-muted">
                            <BillboardImage billboard={b} className="w-full h-full object-cover" />
                          </div>
                          <div className="p-3 space-y-2">
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-bold text-sm truncate">{b.Billboard_Name}</div>
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                {b.Size}
                              </Badge>
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                              <MapPin className="h-3 w-3" />
                              {b.City} - {b.District}
                            </div>
                            <div className="flex items-center gap-2 pt-1">
                              <Label className="text-[10px] text-muted-foreground whitespace-nowrap">
                                سعر اليوم:
                              </Label>
                              <Input
                                type="number"
                                value={sel.daily_price}
                                onChange={(e) => updatePrice(bid, Number(e.target.value) || 0)}
                                className="h-8 text-xs"
                              />
                            </div>
                            <div className="flex items-center justify-between pt-1 border-t border-border">
                              <span className="text-[10px] text-muted-foreground">الإجمالي</span>
                              <span className="font-bold text-emerald-600 tabular-nums text-sm">
                                {(sel.daily_price * days).toLocaleString('en-US')} د.ل
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Available Billboards */}
            <Card className="border-border shadow-lg overflow-hidden">
              <div className="h-1 bg-gradient-to-r from-blue-500 to-cyan-500" />
              <CardHeader className="py-3 px-4 bg-gradient-to-r from-blue-500/10 to-transparent border-b border-border">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <div className="p-1.5 rounded-lg bg-blue-500/20">
                      <MapPin className="h-4 w-4 text-blue-600" />
                    </div>
                    اللوحات المتاحة ({filtered.length})
                  </CardTitle>
                </div>
              </CardHeader>
              <CardContent className="p-4 space-y-3">
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="بحث بالاسم/الموقع..."
                      className="pr-10"
                    />
                  </div>
                  <Select value={cityFilter} onValueChange={setCityFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="المدينة" />
                    </SelectTrigger>
                    <SelectContent className="z-[10000]">
                      <SelectItem value="all">كل المدن</SelectItem>
                      {cityOptions.map((c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={sizeFilter} onValueChange={setSizeFilter}>
                    <SelectTrigger>
                      <SelectValue placeholder="المقاس" />
                    </SelectTrigger>
                    <SelectContent className="z-[10000]">
                      <SelectItem value="all">كل المقاسات</SelectItem>
                      {sizeOptions.map((s) => (
                        <SelectItem key={s} value={s}>
                          {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2 max-h-[600px] overflow-auto pr-1">
                  {filtered.map((b) => {
                    const bid = String(b.ID);
                    const isReserved = reservedIds.has(bid);
                    const isSelected = !!selected[bid];
                    return (
                      <button
                        key={bid}
                        type="button"
                        disabled={isReserved && !isSelected}
                        onClick={() => toggle(b)}
                        className={cn(
                          'relative text-right rounded-lg border-2 overflow-hidden transition-all',
                          isSelected
                            ? 'border-fuchsia-500 ring-2 ring-fuchsia-300 shadow-md'
                            : isReserved
                            ? 'border-red-300 opacity-50 cursor-not-allowed'
                            : 'border-border hover:border-fuchsia-400 hover:shadow-md'
                        )}
                      >
                        {isReserved && !isSelected && (
                          <Badge className="absolute top-1 right-1 z-10 bg-red-500 text-white text-[9px]">
                            محجوز
                          </Badge>
                        )}
                        {isSelected && (
                          <Badge className="absolute top-1 right-1 z-10 bg-fuchsia-500 text-white text-[9px]">
                            مختارة
                          </Badge>
                        )}
                        <div className="aspect-video bg-muted">
                          <BillboardImage billboard={b} className="w-full h-full object-cover" />
                        </div>
                        <div className="p-2 text-xs space-y-0.5">
                          <div className="font-bold truncate">{b.Billboard_Name}</div>
                          <div className="text-muted-foreground truncate">
                            {b.City} • {b.Size}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Sidebar - Cost Summary */}
          <div className="xl:w-[360px] space-y-4">
            <div className="xl:sticky xl:top-4 space-y-4">
              <Card className="border-border shadow-lg overflow-hidden">
                <div className="h-1 bg-gradient-to-r from-emerald-500 to-green-500" />
                <CardHeader className="py-3 px-4 bg-gradient-to-r from-emerald-500/10 to-transparent border-b border-border">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <div className="p-1.5 rounded-lg bg-emerald-500/20">
                      <DollarSign className="h-4 w-4 text-emerald-600" />
                    </div>
                    ملخص التكلفة
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-3">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">عدد اللوحات</span>
                    <span className="font-bold tabular-nums">{Object.keys(selected).length}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-muted-foreground">عدد الأيام</span>
                    <span className="font-bold tabular-nums">{days}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm pt-2 border-t border-border">
                    <span className="text-muted-foreground">المجموع الفرعي</span>
                    <span className="font-bold tabular-nums">
                      {subtotal.toLocaleString('en-US')} د.ل
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Percent className="h-3 w-3" />
                      الخصم (د.ل)
                    </Label>
                    <Input
                      type="number"
                      min={0}
                      value={discount}
                      onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                      className="text-center font-bold tabular-nums"
                    />
                  </div>
                  <div className="flex justify-between items-center pt-3 border-t-2 border-emerald-500/30">
                    <span className="font-bold text-emerald-700 dark:text-emerald-300">
                      الإجمالي النهائي
                    </span>
                    <span className="text-xl font-bold text-emerald-600 tabular-nums">
                      {total.toLocaleString('en-US')} د.ل
                    </span>
                  </div>
                </CardContent>
              </Card>

              <Button
                onClick={handleSave}
                disabled={saving}
                className="w-full bg-fuchsia-600 hover:bg-fuchsia-700 text-white"
                size="lg"
              >
                <Save className="h-4 w-4 ml-2" />
                {saving ? 'جاري الحفظ...' : isEdit ? 'حفظ التعديلات' : 'إنشاء عقد المناسبة'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
