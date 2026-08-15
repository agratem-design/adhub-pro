import { useAuth } from '@/contexts/AuthContext';
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Building2, Plus, Edit2, Trash2, DollarSign, MapPin, Calculator, Save } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import MunicipalityContracts from '@/components/municipality/MunicipalityContracts';
// MunicipalityStatementPrint removed - now used in MunicipalityStats page

interface MunicipalityRent {
  id: string;
  municipality_name: string;
  price_per_meter: number;
  notes: string | null;
  is_active: boolean;
}

interface BillboardSummary {
  municipality: string;
  count: number;
  totalArea: number;
  annualRent: number;
}

const MunicipalityRentPrices = () => {
  const [prices, setPrices] = useState<MunicipalityRent[]>([]);
  const [billboardSummaries, setBillboardSummaries] = useState<BillboardSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<MunicipalityRent | null>(null);
  const [form, setForm] = useState({ municipality_name: '', price_per_meter: 0, notes: '' });
  const [municipalities, setMunicipalities] = useState<string[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const [pricesRes, billboardsRes] = await Promise.all([
      supabase.from('municipality_rent_prices').select('*').order('municipality_name'),
      supabase.from('billboards').select('Municipality, Size'),
    ]);

    setPrices((pricesRes.data || []) as MunicipalityRent[]);

    const billboards = billboardsRes.data || [];
    // Extract unique municipalities
    const uniqueMunicipalities = [...new Set(billboards.map(b => b.Municipality).filter(Boolean))] as string[];
    setMunicipalities(uniqueMunicipalities.sort());

    // Calculate billboard area per municipality
    const priceMap: Record<string, number> = {};
    (pricesRes.data || []).forEach((p: any) => { priceMap[p.municipality_name] = p.price_per_meter; });

    const summaryMap: Record<string, BillboardSummary> = {};
    billboards.forEach(b => {
      const mun = b.Municipality;
      if (!mun) return;
      if (!summaryMap[mun]) summaryMap[mun] = { municipality: mun, count: 0, totalArea: 0, annualRent: 0 };
      summaryMap[mun].count += 1;
      // Parse size to get area (e.g., "3x4" → 12)
      const size = b.Size || '';
      const match = size.match(/(\d+(?:\.\d+)?)\s*[xX×]\s*(\d+(?:\.\d+)?)/);
      const area = match ? parseFloat(match[1]) * parseFloat(match[2]) : 0;
      summaryMap[mun].totalArea += area;
      summaryMap[mun].annualRent = summaryMap[mun].totalArea * (priceMap[mun] || 0);
    });

    setBillboardSummaries(Object.values(summaryMap).sort((a, b) => b.annualRent - a.annualRent));
    setLoading(false);
  };

  const handleSave = async () => {
    if (!form.municipality_name || form.price_per_meter < 0) {
      toast.error('يرجى إدخال البيانات المطلوبة');
      return;
    }

    if (editItem) {
      const { error } = await supabase.from('municipality_rent_prices')
        .update({ price_per_meter: form.price_per_meter, notes: form.notes || null })
        .eq('id', editItem.id);
      if (error) { toast.error('خطأ في التحديث'); return; }
      toast.success('تم التحديث');
    } else {
      const { error } = await supabase.from('municipality_rent_prices')
        .insert({ municipality_name: form.municipality_name, price_per_meter: form.price_per_meter, notes: form.notes || null });
      if (error) {
        if (error.code === '23505') toast.error('هذه البلدية مسجلة مسبقاً');
        else toast.error('خطأ في الحفظ');
        return;
      }
      toast.success('تمت الإضافة');
    }
    setDialogOpen(false);
    setEditItem(null);
    fetchData();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('municipality_rent_prices').delete().eq('id', id);
    if (error) { toast.error('خطأ في الحذف'); return; }
    toast.success('تم الحذف');
    fetchData();
  };

  const openAdd = () => {
    setEditItem(null);
    setForm({ municipality_name: '', price_per_meter: 0, notes: '' });
    setDialogOpen(true);
  };

  const openEdit = (item: MunicipalityRent) => {
    setEditItem(item);
    setForm({ municipality_name: item.municipality_name, price_per_meter: item.price_per_meter, notes: item.notes || '' });
    setDialogOpen(true);
  };

  const totalAnnualRent = billboardSummaries.reduce((s, b) => s + b.annualRent, 0);
  const existingNames = prices.map(p => p.municipality_name);
  const availableMunicipalities = municipalities.filter(m => !existingNames.includes(m));

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary" />
            أسعار إيجار المتر حسب البلدية
          </h1>
          <p className="text-muted-foreground text-sm mt-1">سعر المتر السنوي لإيجار مواقع اللوحات لكل بلدية</p>
        </div>
        <Button onClick={openAdd} className="gap-2">
          <Plus className="h-4 w-4" />
          إضافة بلدية
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <MapPin className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">بلديات مسجلة</p>
              <p className="text-xl font-bold text-foreground">{prices.length}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-500/10">
              <Calculator className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">إجمالي المساحة</p>
              <p className="text-xl font-bold text-foreground">{billboardSummaries.reduce((s, b) => s + b.totalArea, 0).toLocaleString('en-US')} م²</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/50">
          <CardContent className="pt-4 pb-4 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-500/10">
              <DollarSign className="h-5 w-5 text-orange-600 dark:text-orange-400" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">إجمالي الإيجار السنوي</p>
              <p className="text-xl font-bold text-orange-600 dark:text-orange-400">{totalAnnualRent.toLocaleString('en-US')} د.ل</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Table */}
      <Card className="border-border/50">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">تفاصيل الإيجار حسب البلدية</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/30">
                  <th className="p-3 text-right font-medium">البلدية</th>
                  <th className="p-3 text-right font-medium">سعر المتر (سنوي)</th>
                  <th className="p-3 text-right font-medium">عدد اللوحات</th>
                  <th className="p-3 text-right font-medium">إجمالي المساحة</th>
                  <th className="p-3 text-right font-medium">الإيجار السنوي</th>
                  <th className="p-3 text-right font-medium">ملاحظات</th>
                  <th className="p-3 text-right font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">جاري التحميل...</td></tr>
                ) : prices.length === 0 ? (
                  <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">لا توجد أسعار مسجلة — أضف بلدية للبدء</td></tr>
                ) : (
                  prices.map(p => {
                    const summary = billboardSummaries.find(s => s.municipality === p.municipality_name);
                    return (
                      <React.Fragment key={p.id}>
                        <tr className="border-b hover:bg-muted/20 transition-colors">
                          <td className="p-3 font-medium">
                            <div className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 text-primary" />
                              {p.municipality_name}
                            </div>
                          </td>
                          <td className="p-3 font-bold text-primary">{p.price_per_meter.toLocaleString('en-US')} د.ل/م²</td>
                          <td className="p-3">{summary?.count || 0}</td>
                          <td className="p-3">{(summary?.totalArea || 0).toLocaleString('en-US')} م²</td>
                          <td className="p-3 font-bold text-orange-600 dark:text-orange-400">
                            {(summary?.annualRent || 0).toLocaleString('en-US')} د.ل
                          </td>
                          <td className="p-3 text-muted-foreground text-xs max-w-[200px] truncate">{p.notes || '—'}</td>
                          <td className="p-3">
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(p)}>
                                <Edit2 className="h-3.5 w-3.5" />
                              </Button>
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(p.id)}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                        <tr key={`${p.id}-contracts`} className="border-b">
                          <td colSpan={7} className="p-2">
                            <MunicipalityContracts municipalityName={p.municipality_name} />
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
              {prices.length > 0 && (
                <tfoot>
                  <tr className="bg-muted/30 font-bold">
                    <td className="p-3">الإجمالي</td>
                    <td className="p-3">—</td>
                    <td className="p-3">{billboardSummaries.reduce((s, b) => s + b.count, 0)}</td>
                    <td className="p-3">{billboardSummaries.reduce((s, b) => s + b.totalArea, 0).toLocaleString('en-US')} م²</td>
                    <td className="p-3 text-orange-600 dark:text-orange-400">{totalAnnualRent.toLocaleString('en-US')} د.ل</td>
                    <td colSpan={2}></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>{editItem ? 'تعديل سعر البلدية' : 'إضافة بلدية جديدة'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {!editItem ? (
              <div>
                <label className="text-sm font-medium mb-1 block">البلدية</label>
                {availableMunicipalities.length > 0 ? (
                  <Select value={form.municipality_name} onValueChange={(v) => setForm({ ...form, municipality_name: v })}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر البلدية" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableMunicipalities.map(m => (
                        <SelectItem key={m} value={m}>{m}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <Input
                    value={form.municipality_name}
                    onChange={(e) => setForm({ ...form, municipality_name: e.target.value })}
                    placeholder="اسم البلدية"
                  />
                )}
              </div>
            ) : (
              <div>
                <label className="text-sm font-medium mb-1 block">البلدية</label>
                <Input value={form.municipality_name} disabled />
              </div>
            )}
            <div>
              <label className="text-sm font-medium mb-1 block">سعر المتر السنوي (د.ل/م²)</label>
              <Input
                type="number"
                value={form.price_per_meter}
                onChange={(e) => setForm({ ...form, price_per_meter: parseFloat(e.target.value) || 0 })}
                min="0"
                step="0.5"
              />
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">ملاحظات</label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="ملاحظات اختيارية"
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={handleSave} className="gap-2">
              <Save className="h-4 w-4" />
              {editItem ? 'تحديث' : 'حفظ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MunicipalityRentPrices;
