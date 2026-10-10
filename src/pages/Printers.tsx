import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import {
  Building2, Crown, Edit, FileText, Loader2, Mail, MapPin, Phone, Plus, Printer, Ruler, Save, Search, Trash2, X,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import PrintedMetersStatement from '@/components/printers/PrintedMetersStatement';
import { MainPrinterSchedule } from '@/components/printers/MainPrinterSchedule';
import { loadPrinterDefaults, savePrinterDefaults, inHousePrinterId, mainPrinterAt, ensureDefaultPrinterAssignments, type PrinterDefaults } from '@/lib/printerDefaults';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PrinterData {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

interface PrintedInvoice {
  id: string;
  invoice_number: string;
  customer_name: string | null;
  invoice_date: string;
  total_amount: number;
  paid_amount: number | null;
  notes: string | null;
}

interface PrinterStats { monthMeters: number; monthTasks: number; monthCost: number; totalMeters: number; totalTasks: number; openTasks: number }

const EMPTY_FORM = { name: '', phone: '', email: '', address: '', notes: '', is_active: true };
const n0 = (v: number) => Math.round(Number(v || 0)).toLocaleString('ar-LY');

export default function Printers() {
  const { canEdit: canEditAuth } = useAuth();
  const canEditSection = canEditAuth('printers');
  const [printers, setPrinters] = useState<PrinterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Record<string, PrinterStats>>({});
  const [defaults, setDefaults] = useState<PrinterDefaults | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [metersOpen, setMetersOpen] = useState(false);
  const [metersPrinterId, setMetersPrinterId] = useState<string | undefined>(undefined);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoicesDialogOpen, setInvoicesDialogOpen] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState<PrinterData | null>(null);
  const [printerToDelete, setPrinterToDelete] = useState<PrinterData | null>(null);
  const [printerInvoices, setPrinterInvoices] = useState<PrintedInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [formData, setFormData] = useState(EMPTY_FORM);

  useEffect(() => {
    loadPrinters();
    loadStats();
    loadPrinterDefaults().then(setDefaults).catch(() => setDefaults({ in_house_printer_id: null, schedule: [] }));
  }, []);

  const loadPrinters = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.from('printers').select('*').order('created_at', { ascending: false });
      if (error) throw error;
      setPrinters(data || []);
    } catch (error) {
      console.error('Error loading printers:', error);
      toast.error('فشل في تحميل المطابع');
    } finally {
      setLoading(false);
    }
  };

  // إحصاءات الطباعة لكل مطبعة: هذا الشهر والإجمالي
  const loadStats = async () => {
    await ensureDefaultPrinterAssignments();
    const { data } = await supabase
      .from('print_tasks')
      .select('printer_id, total_area, printer_total_cost, total_cost, created_at, status')
      .neq('status', 'cancelled')
      .not('printer_id', 'is', null);
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0);
    const out: Record<string, PrinterStats> = {};
    (data || []).forEach((t: any) => {
      const s = out[t.printer_id] ||= { monthMeters: 0, monthTasks: 0, monthCost: 0, totalMeters: 0, totalTasks: 0, openTasks: 0 };
      const m = Number(t.total_area) || 0;
      s.totalMeters += m; s.totalTasks += 1;
      if (t.status !== 'completed') s.openTasks += 1;
      if (new Date(t.created_at) >= monthStart) {
        s.monthMeters += m; s.monthTasks += 1;
        s.monthCost += Number(t.printer_total_cost) || Number(t.total_cost) || 0;
      }
    });
    setStats(out);
  };

  const today = new Date().toISOString().slice(0, 10);
  const currentMainId = defaults ? mainPrinterAt(defaults, today, printers.filter(p => p.is_active)) : null;
  const inHouseId = defaults ? inHousePrinterId(defaults, printers.filter(p => p.is_active)) : null;

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return printers
      .filter(p => statusFilter === 'all' || (statusFilter === 'active' ? p.is_active : !p.is_active))
      .filter(p => !q || [p.name, p.phone, p.email, p.address, p.notes].some(v => (v || '').toLowerCase().includes(q)))
      .sort((a, b) => Number(b.is_active) - Number(a.is_active) || (stats[b.id]?.monthMeters || 0) - (stats[a.id]?.monthMeters || 0));
  }, [printers, search, statusFilter, stats]);

  const totals = useMemo(() => {
    const vals = Object.values(stats);
    return {
      active: printers.filter(p => p.is_active).length,
      monthMeters: vals.reduce((s, v) => s + v.monthMeters, 0),
      monthTasks: vals.reduce((s, v) => s + v.monthTasks, 0),
      monthCost: vals.reduce((s, v) => s + v.monthCost, 0),
      open: vals.reduce((s, v) => s + v.openTasks, 0),
    };
  }, [stats, printers]);

  const handleOpenDialog = (printer?: PrinterData) => {
    setSelectedPrinter(printer || null);
    setFormData(printer ? {
      name: printer.name, phone: printer.phone || '', email: printer.email || '',
      address: printer.address || '', notes: printer.notes || '', is_active: printer.is_active,
    } : EMPTY_FORM);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) { toast.error('الرجاء إدخال اسم المطبعة'); return; }
    const payload = {
      name: formData.name.trim(),
      phone: formData.phone || null,
      email: formData.email || null,
      address: formData.address || null,
      notes: formData.notes || null,
      is_active: formData.is_active,
    };
    setSaving(true);
    try {
      const { error } = selectedPrinter
        ? await supabase.from('printers').update(payload).eq('id', selectedPrinter.id)
        : await supabase.from('printers').insert(payload);
      if (error) throw error;
      toast.success(selectedPrinter ? 'تم تحديث المطبعة' : 'تمت إضافة المطبعة');
      setDialogOpen(false);
      loadPrinters();
    } catch (error) {
      console.error('Error saving printer:', error);
      toast.error('فشل في حفظ المطبعة');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (printer: PrinterData, isActive: boolean) => {
    setPrinters(prev => prev.map(p => p.id === printer.id ? { ...p, is_active: isActive } : p));
    const { error } = await supabase.from('printers').update({ is_active: isActive }).eq('id', printer.id);
    if (error) {
      toast.error('تعذر تغيير الحالة');
      setPrinters(prev => prev.map(p => p.id === printer.id ? { ...p, is_active: !isActive } : p));
    }
  };

  const handleDelete = async () => {
    if (!printerToDelete) return;
    try {
      const { error } = await supabase.from('printers').delete().eq('id', printerToDelete.id);
      if (error) throw error;
      toast.success('تم حذف المطبعة');
      loadPrinters();
    } catch (error) {
      console.error('Error deleting printer:', error);
      toast.error('فشل في حذف المطبعة — قد تكون مرتبطة بمهام طباعة، يمكنك إيقافها بدلاً من حذفها');
    } finally {
      setDeleteDialogOpen(false);
      setPrinterToDelete(null);
    }
  };

  const handleViewInvoices = async (printer: PrinterData) => {
    setSelectedPrinter(printer);
    setInvoicesDialogOpen(true);
    setLoadingInvoices(true);
    try {
      const { data, error } = await supabase
        .from('printed_invoices')
        .select('id, invoice_number, customer_name, invoice_date, total_amount, paid_amount, notes')
        .eq('printer_id', printer.id)
        .order('invoice_date', { ascending: false });
      if (error) throw error;
      setPrinterInvoices((data || []) as PrintedInvoice[]);
    } catch (error) {
      console.error('Error loading invoices:', error);
      toast.error('فشل في تحميل الفواتير');
      setPrinterInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  const openMeters = (printerId?: string) => { setMetersPrinterId(printerId); setMetersOpen(true); };

  const invoiceTotals = useMemo(() => {
    const total = printerInvoices.reduce((s, i) => s + Number(i.total_amount || 0), 0);
    const paid = printerInvoices.reduce((s, i) => s + Number(i.paid_amount || 0), 0);
    return { total, paid, remaining: total - paid };
  }, [printerInvoices]);

  return (
    <div className="space-y-4" dir="rtl">
      {/* الرأس */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="rounded-xl bg-primary/10 p-2 text-primary"><Printer className="h-5 w-5" /></span>
          <div>
            <h1 className="text-xl font-bold sm:text-2xl">المطابع</h1>
            <p className="text-xs text-muted-foreground">المطابع المتعاملة، إنتاجها من الأمتار، والمطبعة الافتراضية لمهام الطباعة</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-9 gap-1.5" onClick={() => openMeters()}>
            <Ruler className="h-4 w-4" />كشف طباعة الأمتار
          </Button>
          {canEditSection && (
            <Button size="sm" className="h-9 gap-1.5" onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4" />إضافة مطبعة
            </Button>
          )}
        </div>
      </header>

      {/* المؤشرات */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-5">
        {[
          { k: 'مطابع نشطة', v: `${totals.active} / ${printers.length}` },
          { k: 'أمتار هذا الشهر', v: `${n0(totals.monthMeters)} م²` },
          { k: 'مهام هذا الشهر', v: n0(totals.monthTasks) },
          { k: 'تكلفة هذا الشهر', v: `${n0(totals.monthCost)} د.ل` },
          { k: 'مهام غير منجزة', v: n0(totals.open) },
        ].map(x => (
          <div key={x.k} className="bg-card px-3 py-2.5">
            <p className="text-xs text-muted-foreground">{x.k}</p>
            <p className="text-base font-bold tabular-nums">{x.v}</p>
          </div>
        ))}
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0 space-y-3">
          {/* البحث والتصفية */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
              <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث بالاسم أو الهاتف أو العنوان..." className="h-9 pr-9 text-sm" />
            </div>
            <div className="flex gap-1 rounded-lg bg-muted/40 p-0.5" role="group" aria-label="حالة المطبعة">
              {([['all', 'الكل'], ['active', 'نشطة'], ['inactive', 'موقوفة']] as const).map(([k, l]) => (
                <button key={k} type="button" onClick={() => setStatusFilter(k)} aria-pressed={statusFilter === k}
                  className={cn('h-8 cursor-pointer rounded-md px-3 text-xs font-semibold transition-colors', statusFilter === k ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')}>
                  {l}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="grid gap-3 md:grid-cols-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-56 rounded-xl" />)}</div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-border py-14 text-center">
              <Printer className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">{printers.length === 0 ? 'لا توجد مطابع مسجلة' : 'لا توجد مطابع مطابقة'}</p>
              {canEditSection && printers.length === 0 && <Button size="sm" onClick={() => handleOpenDialog()} className="gap-1.5"><Plus className="h-4 w-4" />إضافة مطبعة</Button>}
            </div>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {visible.map(printer => {
                const s = stats[printer.id];
                const isMain = printer.id === currentMainId;
                const isInHouse = printer.id === inHouseId;
                return (
                  <article key={printer.id} className={cn('flex flex-col rounded-xl border bg-card transition-colors', isMain ? 'border-primary/50' : 'border-border', !printer.is_active && 'opacity-70')}>
                    <div className="flex items-start gap-3 p-4">
                      <span className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-lg font-bold', isMain ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground')}>
                        {printer.name.trim().charAt(0)}
                      </span>
                      <div className="min-w-0 flex-1">
                        <h3 className="truncate text-base font-bold">{printer.name}</h3>
                        <div className="mt-1 flex flex-wrap gap-1">
                          <span className={cn('rounded px-1.5 py-px text-xs font-semibold', printer.is_active ? 'bg-emerald-500/15 text-emerald-500' : 'bg-muted text-muted-foreground')}>
                            {printer.is_active ? 'نشطة' : 'موقوفة'}
                          </span>
                          {isMain && <span className="inline-flex items-center gap-1 rounded bg-primary/15 px-1.5 py-px text-xs font-semibold text-primary"><Crown className="h-3 w-3" />الرئيسية الآن</span>}
                          {isInHouse && <span className="inline-flex items-center gap-1 rounded bg-sky-500/15 px-1.5 py-px text-xs font-semibold text-sky-400"><Building2 className="h-3 w-3" />مطبعة الشركة</span>}
                        </div>
                      </div>
                      {canEditSection && (
                        <Switch checked={printer.is_active} onCheckedChange={v => toggleActive(printer, v)} aria-label={printer.is_active ? 'إيقاف المطبعة' : 'تفعيل المطبعة'} />
                      )}
                    </div>

                    <dl className="mx-4 grid grid-cols-3 gap-px overflow-hidden rounded-lg border border-border bg-border text-center">
                      <div className="bg-muted/30 py-2"><dt className="text-xs text-muted-foreground">م² هذا الشهر</dt><dd className="text-sm font-bold tabular-nums">{n0(s?.monthMeters || 0)}</dd></div>
                      <div className="bg-muted/30 py-2"><dt className="text-xs text-muted-foreground">مهام الشهر</dt><dd className="text-sm font-bold tabular-nums">{n0(s?.monthTasks || 0)}</dd></div>
                      <div className="bg-muted/30 py-2"><dt className="text-xs text-muted-foreground">إجمالي م²</dt><dd className="text-sm font-bold tabular-nums">{n0(s?.totalMeters || 0)}</dd></div>
                    </dl>

                    <ul className="flex-1 space-y-1.5 px-4 py-3 text-xs text-muted-foreground">
                      {printer.phone && <li className="flex items-center gap-2"><Phone className="h-3.5 w-3.5 shrink-0" /><a href={`tel:${printer.phone}`} dir="ltr" className="hover:text-foreground">{printer.phone}</a></li>}
                      {printer.email && <li className="flex items-center gap-2"><Mail className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{printer.email}</span></li>}
                      {printer.address && <li className="flex items-center gap-2"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{printer.address}</span></li>}
                      {printer.notes && <li className="line-clamp-2 pt-0.5 leading-5">{printer.notes}</li>}
                      {!printer.phone && !printer.email && !printer.address && !printer.notes && <li className="text-muted-foreground/60">لا توجد بيانات تواصل</li>}
                    </ul>

                    <footer className="flex items-center gap-1 border-t border-border p-2">
                      <Button size="sm" variant="ghost" className="h-8 flex-1 gap-1.5 text-xs" onClick={() => handleViewInvoices(printer)}><FileText className="h-3.5 w-3.5" />الفواتير</Button>
                      <Button size="sm" variant="ghost" className="h-8 flex-1 gap-1.5 text-xs" onClick={() => openMeters(printer.id)}><Ruler className="h-3.5 w-3.5" />كشف الأمتار</Button>
                      {canEditSection && (
                        <>
                          <Button size="sm" variant="ghost" className="h-8 flex-1 gap-1.5 text-xs" onClick={() => handleOpenDialog(printer)}><Edit className="h-3.5 w-3.5" />تعديل</Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-muted-foreground hover:bg-destructive/10 hover:text-destructive" aria-label="حذف المطبعة"
                            onClick={() => { setPrinterToDelete(printer); setDeleteDialogOpen(true); }}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </>
                      )}
                    </footer>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <aside className="space-y-3 lg:sticky lg:top-4">
          {defaults && !loading && (
            <MainPrinterSchedule
              printers={printers}
              canEdit={canEditSection}
              value={defaults}
              onPersist={async next => { await savePrinterDefaults(next); setDefaults(next); }}
            />
          )}
        </aside>
      </div>

      <PrintedMetersStatement
        open={metersOpen}
        onOpenChange={setMetersOpen}
        printers={printers.map(p => ({ id: p.id, name: p.name }))}
        initialPrinterId={metersPrinterId}
      />

      {/* إضافة / تعديل */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[560px]" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle>{selectedPrinter ? 'تعديل المطبعة' : 'إضافة مطبعة جديدة'}</DialogTitle>
            <DialogDescription className="text-xs">بيانات المطبعة ومعلومات التواصل</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="pr-name" className="text-xs">اسم المطبعة *</Label>
              <Input id="pr-name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="مثال: مطبعة الأصدقاء" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pr-phone" className="text-xs">رقم الهاتف</Label>
              <Input id="pr-phone" dir="ltr" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} placeholder="09x xxx xxxx" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="pr-email" className="text-xs">البريد الإلكتروني</Label>
              <Input id="pr-email" type="email" dir="ltr" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="pr-address" className="text-xs">العنوان</Label>
              <Input id="pr-address" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} />
            </div>
            <div className="space-y-1 sm:col-span-2">
              <Label htmlFor="pr-notes" className="text-xs">ملاحظات</Label>
              <Textarea id="pr-notes" rows={3} value={formData.notes} onChange={e => setFormData({ ...formData, notes: e.target.value })} />
            </div>
            <label className="flex cursor-pointer items-center justify-between rounded-lg border border-border px-3 py-2.5 sm:col-span-2">
              <span className="text-sm">المطبعة نشطة وتظهر في اختيار مهام الطباعة</span>
              <Switch checked={formData.is_active} onCheckedChange={v => setFormData({ ...formData, is_active: v })} />
            </label>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)} className="gap-1.5"><X className="h-4 w-4" />إلغاء</Button>
            <Button onClick={handleSave} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}حفظ
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader className="text-right">
            <AlertDialogTitle>حذف «{printerToDelete?.name}»؟</AlertDialogTitle>
            <AlertDialogDescription>لا يمكن التراجع عن الحذف. إن كانت المطبعة مرتبطة بمهام سابقة فالأفضل إيقافها بدلاً من حذفها.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* فواتير المطبعة */}
      <Dialog open={invoicesDialogOpen} onOpenChange={setInvoicesDialogOpen}>
        <DialogContent className="max-h-[85vh] max-w-4xl overflow-y-auto" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle>فواتير الطباعة — {selectedPrinter?.name}</DialogTitle>
            <DialogDescription className="sr-only">قائمة فواتير الطباعة الصادرة من هذه المطبعة</DialogDescription>
          </DialogHeader>
          {loadingInvoices ? (
            <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
          ) : printerInvoices.length === 0 ? (
            <p className="py-10 text-center text-sm text-muted-foreground">لا توجد فواتير طباعة لهذه المطبعة</p>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-px overflow-hidden rounded-xl border border-border bg-border">
                <div className="bg-card px-3 py-2"><p className="text-xs text-muted-foreground">الإجمالي</p><p className="font-bold tabular-nums">{n0(invoiceTotals.total)} د.ل</p></div>
                <div className="bg-card px-3 py-2"><p className="text-xs text-muted-foreground">المدفوع</p><p className="font-bold tabular-nums text-emerald-500">{n0(invoiceTotals.paid)} د.ل</p></div>
                <div className="bg-card px-3 py-2"><p className="text-xs text-muted-foreground">المتبقي</p><p className={cn('font-bold tabular-nums', invoiceTotals.remaining > 0 ? 'text-rose-500' : 'text-muted-foreground')}>{n0(invoiceTotals.remaining)} د.ل</p></div>
              </div>
              <div className="overflow-x-auto rounded-xl border border-border">
                <table className="w-full text-xs">
                  <thead className="bg-muted/40 text-muted-foreground">
                    <tr>
                      <th className="px-3 py-2 text-right">رقم الفاتورة</th>
                      <th className="px-3 py-2 text-right">الزبون</th>
                      <th className="px-3 py-2 text-right">التاريخ</th>
                      <th className="px-3 py-2 text-center">الإجمالي</th>
                      <th className="px-3 py-2 text-center">المدفوع</th>
                      <th className="px-3 py-2 text-center">المتبقي</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {printerInvoices.map(inv => {
                      const rem = Number(inv.total_amount || 0) - Number(inv.paid_amount || 0);
                      return (
                        <tr key={inv.id} className="hover:bg-muted/20" title={inv.notes || undefined}>
                          <td className="px-3 py-2 font-medium">{inv.invoice_number}</td>
                          <td className="px-3 py-2">{inv.customer_name || '—'}</td>
                          <td className="px-3 py-2 tabular-nums">{new Date(inv.invoice_date).toLocaleDateString('en-GB')}</td>
                          <td className="px-3 py-2 text-center tabular-nums">{n0(inv.total_amount)}</td>
                          <td className="px-3 py-2 text-center tabular-nums text-emerald-500">{n0(inv.paid_amount || 0)}</td>
                          <td className={cn('px-3 py-2 text-center tabular-nums', rem > 0 ? 'text-rose-500' : 'text-muted-foreground')}>{n0(rem)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
