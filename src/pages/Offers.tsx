import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Calendar, User, Printer, FilePlus } from 'lucide-react';
import { loadBillboards } from '@/services/billboardService';
import type { Billboard } from '@/types';
import { getPriceFor, CustomerType, CUSTOMERS } from '@/data/pricing';
import { toast } from '@/components/ui/sonner';
import { createOffer } from '@/services/offersService';
import { buildBgc2OfferHtml } from '@/components/Invoice/printTemplates';
import { supabase } from '@/integrations/supabase/client';
import BillboardTagBadges from '@/components/Billboard/BillboardTagBadges';

export default function Offers() {
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [tagsMap, setTagsMap] = useState<Record<number, any>>({});

  // selection
  const [selected, setSelected] = useState<string[]>([]);

  // filters
  const [q, setQ] = useState('');
  const [city, setCity] = useState<string>('all');
  const [size, setSize] = useState<string>('all');
  const [status, setStatus] = useState<string>('all'); // show all by default

  // form
  const [customerName, setCustomerName] = useState('');
  const [durationMonths, setDurationMonths] = useState<number>(3);
  const [notes, setNotes] = useState('');
  const [pricingCategory, setPricingCategory] = useState<CustomerType>('عادي' as CustomerType);
  const [discountValue, setDiscountValue] = useState<number>(0);

  useEffect(() => {
    (async () => {
      try {
        const [data, tagsResult] = await Promise.all([
          loadBillboards(),
          supabase.from('billboard_tags').select('billboard_id, tags, location_type').limit(1000),
        ]);
        setBillboards(data);
        const map: Record<number, any> = {};
        (tagsResult.data || []).forEach((t: any) => { map[t.billboard_id] = t; });
        setTagsMap(map);
      } catch (e: any) {
        console.error(e);
        toast.error(e?.message || 'فشل تحميل اللوحات');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cities = useMemo(
    () => Array.from(new Set(billboards.map((b) => (b.city || (b as any).City))).values()).filter(Boolean) as string[],
    [billboards]
  );
  const sizes = useMemo(
    () => Array.from(new Set(billboards.map((b) => (b.size || (b as any).Size))).values()).filter(Boolean) as string[],
    [billboards]
  );

  const filtered = useMemo(() => {
    const list = billboards.filter((b: any) => {
      const text = b.name || b.Billboard_Name || '';
      const loc = b.location || b.Nearest_Landmark || '';
      const c = String(b.city || b.City || '');
      const s = String(b.size || b.Size || '');
      const st = String(b.status || b.Status || '').toLowerCase();

      const matchesQ = !q || text.toLowerCase().includes(q.toLowerCase()) || loc.toLowerCase().includes(q.toLowerCase());
      const matchesCity = city === 'all' || c === city;
      const matchesSize = size === 'all' || s === size;

      let show = true;
      if (status === 'available') show = (st === 'available');
      else if (status === 'rented') show = (st === 'rented');

      return matchesQ && matchesCity && matchesSize && show;
    });

    return list.slice(0, 30);
  }, [billboards, q, city, size, status]);

  const toggleSelect = (b: Billboard) => {
    const id = String((b as any).ID);
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const priceForBoard = (b: any) => {
    const size = (b.size || b.Size || '') as string;
    const level = (b.level || b.Level) as any;
    const price = getPriceFor(size, level, pricingCategory as CustomerType, durationMonths) ?? 0;
    return price || 0;
  };

  // حساب الإجمالي والخصم
  const totalBeforeDiscount = useMemo(() => {
    return billboards
      .filter((b: any) => selected.includes(String(b.ID)))
      .reduce((sum, b) => sum + priceForBoard(b), 0);
  }, [billboards, selected, pricingCategory, durationMonths]);

  const discountPercentage = totalBeforeDiscount > 0 ? (discountValue / totalBeforeDiscount) * 100 : 0;
  const totalAfterDiscount = totalBeforeDiscount - discountValue;

  const calculateDiscountFromPercentage = (percentage: number) => {
    return (totalBeforeDiscount * percentage) / 100;
  };

  const handlePrintOffer = async () => {
    try {
      if (!customerName || selected.length === 0) {
        toast.error('يرجى إدخال اسم الزبون واختيار لوحات');
        return;
      }
      const items = billboards.filter((b: any) => selected.includes(String(b.ID)));
      const meta = {
        months: durationMonths,
        customer: pricingCategory as any,
        adType: 'عرض سعر',
        contractNumber: undefined,
        date: new Date(),
        clientName: customerName,
      } as any;

      const html = buildBgc2OfferHtml(items as any, meta);
      const w = window.open('', '_blank', 'fullscreen=yes,scrollbars=yes,resizable=yes');
      if (!w) return;
      w.document.write(html);
      w.document.close();

      // try to save offer (non-blocking)
      const selectedBoards = items.map((b: any) => ({
        id: String(b.ID),
        code: b.Billboard_Name || b.name || b.id,
        municipality: b.Municipality || b.municipality || '',
        district: b.District || b.district || '',
        landmark: b.Nearest_Landmark || b.location || '',
        size: b.Size || b.size || '',
        faces: b.Faces_Count || '1',
        price: priceForBoard(b),
        pricing_category: pricingCategory,
        coords: b.GPS_Coordinates || b.coordinates || '',
        img: b.Image_URL || b.image || '',
      }));
      createOffer({ customer_name: customerName, duration_months: durationMonths, notes, selected_boards: selectedBoards }).then((saved) => {
        if (!saved) console.log('Offer not saved (table missing or RLS).');
      });
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'فشل إنشاء العرض');
    }
  };

  return (
    <div className="container mx-auto px-4 py-6 space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">إنشاء عرض سعر</h1>
          <p className="text-muted-foreground">اختر اللوحات واطبع عرض السعر بدون إنشاء عق��</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handlePrintOffer} className="gap-2">
            <Printer className="h-4 w-4" /> عرض السعر
          </Button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6">
        {/* main area */}
        <div className="flex-1 space-y-6">
          {/* selected summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FilePlus className="h-5 w-5" /> اللوحات المختارة ({selected.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {selected.length === 0 ? (
                <p className="text-muted-foreground">لم يتم اختيار أي لوحة</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {billboards.filter((b: any) => selected.includes(String(b.ID))).map((b: any) => (
                    <Card key={b.ID} className="overflow-hidden">
                      <CardContent className="p-0">
                        {(b.image || b.Image_URL) && (
                          <img src={(b.image || b.Image_URL)} alt={(b.name || b.Billboard_Name)} className="w-full h-36 object-cover" />
                        )}
                        <div className="p-3 space-y-2">
                          <div>
                            <div className="font-semibold">{b.name || b.Billboard_Name}</div>
                            <div className="text-xs text-muted-foreground">{b.location || b.Nearest_Landmark}</div>
                            <div className="text-xs">{(b.city || b.City)} • {(b.size || b.Size)}</div>
                            <div className="text-sm font-medium">{priceForBoard(b).toLocaleString('ar-LY')} د.ل / {durationMonths === 12 ? 'سنة' : `${durationMonths} شهر`}</div>
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" variant="destructive" className="w-full" onClick={() => setSelected((prev)=>prev.filter((id)=>id!==String(b.ID)))}>إزالة</Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* filters */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" /> البحث والتصفية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-3">
                <div className="flex-1 relative min-w-[220px]">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input placeholder="بحث عن لوحة" value={q} onChange={(e) => setQ(e.target.value)} className="pr-9" />
                </div>
                <Select value={city} onValueChange={setCity}>
                  <SelectTrigger className="w-[180px]"><SelectValue placeholder="المدينة" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل المدن</SelectItem>
                    {cities.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={size} onValueChange={setSize}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="المقاس" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل المقاسات</SelectItem>
                    {sizes.map((s) => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={status} onValueChange={setStatus}>
                  <SelectTrigger className="w-[160px]"><SelectValue placeholder="الحالة" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    <SelectItem value="available">المتاحة</SelectItem>
                    <SelectItem value="rented">المؤجرة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* grid */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" /> جميع اللوحات ({filtered.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-10 text-center">جاري التحميل...</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filtered.map((b: any) => {
                    const isSelected = selected.includes(String(b.ID));
                    return (
                      <Card key={b.ID} className={`overflow-hidden ${isSelected ? 'ring-2 ring-primary' : ''}`}>
                        <CardContent className="p-0">
                          {(b.image || b.Image_URL) && (
                            <img src={(b.image || b.Image_URL)} alt={(b.name || b.Billboard_Name)} className="w-full h-40 object-cover" />
                          )}
                          <div className="p-3 space-y-1">
                            <div className="font-semibold">{b.name || b.Billboard_Name}</div>
                            <div className="text-xs text-muted-foreground">{b.location || b.Nearest_Landmark}</div>
                            <div className="text-xs">{(b.city || b.City)} • {(b.size || b.Size)}</div>
                            <BillboardTagBadges tags={tagsMap[b.ID]?.tags} locationType={tagsMap[b.ID]?.location_type} maxTags={3} />
                            <div className="pt-2">
                              <Button size="sm" variant={isSelected ? 'destructive' : 'outline'} onClick={() => toggleSelect(b)} className="w-full">
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
                <div className="py-10 text-center text-muted-foreground">لا توجد لوحات مطابقة</div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* sidebar */}
        <div className="w-full lg:w-[360px] space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> بيانات العرض</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="text-sm">اسم الزبون</label>
                <Input value={customerName} onChange={(e)=>setCustomerName(e.target.value)} placeholder="مثال: شركة الهدى" />
              </div>
              <div>
                <label className="text-sm">المدة</label>
                <Select value={String(durationMonths)} onValueChange={(v)=>setDurationMonths(Number(v))}>
                  <SelectTrigger><SelectValue placeholder="اختر المدة" /></SelectTrigger>
                  <SelectContent>
                    {[1,2,3,6,12].map((m)=> (
                      <SelectItem key={m} value={String(m)}>{m === 12 ? 'سنة' : `${m} شهر`}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm">فئة السعر</label>
                <Select value={pricingCategory} onValueChange={(v)=>setPricingCategory(v as any)}>
                  <SelectTrigger><SelectValue placeholder="الفئة" /></SelectTrigger>
                  <SelectContent>
                    {CUSTOMERS.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              {/* حقل الخصم */}
              <div>
                <label className="text-sm font-medium">الخصم</label>
                <div className="grid grid-cols-2 gap-2 mt-1">
                  <div>
                    <label className="text-xs text-muted-foreground">القيمة (د.ل)</label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={discountValue}
                      onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                      placeholder="0"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">النسبة (%)</label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={discountPercentage.toFixed(1)}
                      onChange={(e) => {
                        const percentage = parseFloat(e.target.value) || 0;
                        setDiscountValue(calculateDiscountFromPercentage(percentage));
                      }}
                      placeholder="0"
                    />
                  </div>
                </div>
                {discountValue > 0 && (
                  <p className="text-xs text-green-600 mt-1">
                    خصم {discountPercentage.toFixed(1)}% = {discountValue.toLocaleString('ar-LY')} د.ل
                  </p>
                )}
              </div>

              {/* ملخص السعر */}
              {selected.length > 0 && (
                <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>الإجمالي:</span>
                    <span>{totalBeforeDiscount.toLocaleString('ar-LY')} د.ل</span>
                  </div>
                  {discountValue > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>الخصم:</span>
                      <span>-{discountValue.toLocaleString('ar-LY')} د.ل</span>
                    </div>
                  )}
                  <div className="flex justify-between font-bold border-t pt-2">
                    <span>الصافي:</span>
                    <span>{totalAfterDiscount.toLocaleString('ar-LY')} د.ل</span>
                  </div>
                </div>
              )}

              <div>
                <label className="text-sm">ملاحظات</label>
                <Input value={notes} onChange={(e)=>setNotes(e.target.value)} placeholder="اختياري" />
              </div>
              <Button className="w-full" onClick={handlePrintOffer}>
                <Printer className="h-4 w-4 ml-2" /> عرض السعر
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
