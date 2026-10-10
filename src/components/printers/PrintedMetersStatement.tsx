import { useEffect, useMemo, useState } from 'react';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, subMonths, subWeeks } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Printer, Ruler } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { loadPrinterDefaults, defaultPrinterForContract, ensureDefaultPrinterAssignments } from '@/lib/printerDefaults';
import { taskPrintAmounts, contractPrintArea, printEnabled, collectStatementRows } from '@/lib/printerStatement';
import { usePrintTheme } from '@/hooks/usePrintTheme';
import { DOCUMENT_TYPES } from '@/types/document-types';
import { openMeasurementsPrintWindow, createMeasurementsConfigFromSettings, PrintColumn } from '@/lib/printMeasurements';

type Preset = 'this_week' | 'last_week' | 'this_month' | 'last_month' | 'custom';

const PRESETS: { key: Preset; label: string }[] = [
  { key: 'this_week', label: 'هذا الأسبوع' },
  { key: 'last_week', label: 'الأسبوع الماضي' },
  { key: 'this_month', label: 'هذا الشهر' },
  { key: 'last_month', label: 'الشهر الماضي' },
  { key: 'custom', label: 'فترة محددة' },
];

const ymd = (d: Date) => format(d, 'yyyy-MM-dd');
// الأسبوع يبدأ السبت
const rangeOf = (p: Preset): [string, string] | null => {
  const now = new Date();
  switch (p) {
    case 'this_week': return [ymd(startOfWeek(now, { weekStartsOn: 6 })), ymd(endOfWeek(now, { weekStartsOn: 6 }))];
    case 'last_week': { const d = subWeeks(now, 1); return [ymd(startOfWeek(d, { weekStartsOn: 6 })), ymd(endOfWeek(d, { weekStartsOn: 6 }))]; }
    case 'this_month': return [ymd(startOfMonth(now)), ymd(endOfMonth(now))];
    case 'last_month': { const d = subMonths(now, 1); return [ymd(startOfMonth(d)), ymd(endOfMonth(d))]; }
    default: return null;
  }
};

interface Row {
  id: string;
  date: string;
  contractId: number | null;
  customer: string;
  printerId: string | null;
  printer: string;
  meters: number;
  costPerMeter: number;
  cost: number;
  status: string;
  customerRate: number;
  customerCost: number;
}

const n2 = (v: number) => Number(v || 0).toLocaleString('ar-LY', { maximumFractionDigits: 2 });

export function PrintedMetersStatement({ open, onOpenChange, printers, initialPrinterId }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  printers: { id: string; name: string }[];
  initialPrinterId?: string;
}) {
  const [preset, setPreset] = useState<Preset>('this_week');
  const [from, setFrom] = useState(() => rangeOf('this_week')![0]);
  const [to, setTo] = useState(() => rangeOf('this_week')![1]);
  const [printerId, setPrinterId] = useState<string>('all');
  const [basis, setBasis] = useState<'created' | 'completed'>('created');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const { settings: printSettings } = usePrintTheme(DOCUMENT_TYPES.PRINT_TASK);

  useEffect(() => { if (open) setPrinterId(initialPrinterId || 'all'); }, [open, initialPrinterId]);

  const pickPreset = (p: Preset) => {
    setPreset(p);
    const r = rangeOf(p);
    if (r) { setFrom(r[0]); setTo(r[1]); }
  };

  useEffect(() => {
    if (!open || !from || !to) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await ensureDefaultPrinterAssignments();
        const col = basis === 'completed' ? 'completed_at' : 'created_at';
        let q = supabase
          .from('print_tasks')
          .select('*')
          .gte(col, `${from}T00:00:00`)
          .lte(col, `${to}T23:59:59.999`)
          .neq('status', 'cancelled')
          .order(col, { ascending: true }).order('id');
        if (basis === 'completed') q = q.eq('status', 'completed');
        const { data, error } = await collectStatementRows((start, end) => q.range(start, end));
        if (error) throw error;
        const tasks = data || [];

        // المساحة من البنود عندما لا تُسجَّل في المهمة
        const missing = tasks.filter((t: any) => !(Number(t.total_area) > 0)).map((t: any) => t.id);
        const areaByTask = new Map<string, number>();
        for (let i = 0; i < missing.length; i += 40) {
          const { data: items, error: itemsError } = await supabase.from('print_task_items').select('task_id, area, quantity, width, height').in('task_id', missing.slice(i, i + 40));
          if (itemsError) throw itemsError;
          (items || []).forEach((it: any) => {
            const area = Number(it.area) > 0 ? Number(it.area) : (Number(it.width) || 0) * (Number(it.height) || 0);
            areaByTask.set(it.task_id, (areaByTask.get(it.task_id) || 0) + area * (Number(it.quantity) || 1));
          });
        }

        const nameOf = new Map(printers.map(p => [p.id, p.name]));
        const out: Row[] = tasks.map((t: any) => {
          const meters = Number(t.total_area) > 0 ? Number(t.total_area) : (areaByTask.get(t.id) || 0);
          const amounts = taskPrintAmounts(t, meters);
          return {
            id: t.id,
            date: (basis === 'completed' ? t.completed_at : t.created_at) || t.created_at,
            contractId: t.contract_id,
            customer: t.customer_name || '',
            printerId: t.printer_id,
            printer: (t.printer_id && nameOf.get(t.printer_id)) || 'بدون مطبعة',
            meters,
            ...amounts,
            status: t.status,
          };
        });
        // Include enabled contracts without inventing completed work or duplicating existing tasks.
        if (basis === 'created') {
          const { data: contracts, error: contractsError } = await collectStatementRows((start, end) => supabase.from('Contract').select('*')
            .gte('Contract Date', from).lte('Contract Date', `${to}T23:59:59.999`).order('Contract_Number').range(start, end));
          if (contractsError) throw contractsError;
          const enabled = (contracts || []).filter(c => printEnabled(c.print_cost_enabled));
          if (enabled.length) {
            const [existing, boards, sizes, defaults, history] = await Promise.all([
              supabase.from('print_tasks').select('contract_id').in('contract_id', enabled.map(c => c.Contract_Number)).neq('status', 'cancelled'),
              collectStatementRows((start, end) => supabase.from('billboards').select('ID, Size, Faces_Count').order('ID').range(start, end)),
              supabase.from('sizes').select('name, width, height, print_size'),
              loadPrinterDefaults(),
              collectStatementRows((start, end) => supabase.from('print_tasks').select('printer_id, printer_cost_per_meter, price_per_meter, created_at').neq('status', 'cancelled').order('created_at', { ascending: false }).order('id').range(start, end)),
            ]);
            for (const result of [existing, boards, sizes, history]) if (result.error) throw result.error;
            const represented = new Set((existing.data || []).map(t => t.contract_id));
            for (const c of enabled) {
              if (represented.has(c.Contract_Number)) continue;
              const id = defaultPrinterForContract(defaults, printers, c);
              const rateTask = history.data?.find(t => t.printer_id === id && t.created_at.slice(0, 10) <= String(c['Contract Date']).slice(0, 10));
              const costPerMeter = Number(rateTask?.printer_cost_per_meter ?? rateTask?.price_per_meter ?? 0);
              const meters = contractPrintArea(c, boards.data || [], sizes.data || []);
              const customerRate = Number(c.print_price_per_meter) || 0;
              out.push({ id: `contract-${c.Contract_Number}`, date: c['Contract Date']!, contractId: c.Contract_Number,
                customer: c['Customer Name'] || '', printerId: id, printer: (id && nameOf.get(id)) || 'بدون مطبعة',
                meters, costPerMeter, cost: meters * costPerMeter, customerRate,
                customerCost: Number(c.print_cost ?? meters * customerRate), status: 'awaiting_task' });
            }
          }
        }
        if (!cancelled) setRows(out.filter(r => printerId === 'all' || r.printerId === printerId).sort((a, b) => a.date.localeCompare(b.date)));
      } catch (e: any) {
        if (!cancelled) { setRows([]); toast.error(e?.message || 'تعذر تحميل مهام الطباعة'); }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, from, to, printerId, basis, printers]);

  const totals = useMemo(() => {
    const meters = rows.reduce((s, r) => s + r.meters, 0);
    const cost = rows.reduce((s, r) => s + r.cost, 0);
    const byPrinter = new Map<string, { name: string; meters: number; cost: number; count: number }>();
    rows.forEach(r => {
      const k = r.printerId || 'none';
      const cur = byPrinter.get(k) || { name: r.printer, meters: 0, cost: 0, count: 0 };
      cur.meters += r.meters; cur.cost += r.cost; cur.count += 1;
      byPrinter.set(k, cur);
    });
    return { meters, cost, count: rows.length, avg: meters > 0 ? cost / meters : 0, byPrinter: [...byPrinter.values()].sort((a, b) => b.meters - a.meters) };
  }, [rows]);

  const periodLabel = `من ${from} إلى ${to}`;
  const printerLabel = printerId === 'all' ? 'كل المطابع' : (printers.find(p => p.id === printerId)?.name || '');

  const handlePrint = () => {
    if (rows.length === 0) { toast.info('لا توجد مهام طباعة في هذه الفترة'); return; }
    const config = createMeasurementsConfigFromSettings(printSettings);
    config.header.title.text = 'كشف طباعة الأمتار';
    config.page.direction = 'rtl';
    const columns: PrintColumn[] = [
      { key: 'index', header: '#', width: '4%', align: 'center' },
      { key: 'date', header: 'التاريخ', width: '10%', align: 'center' },
      { key: 'contract', header: 'العقد', width: '7%', align: 'center' },
      { key: 'customer', header: 'الزبون', width: '15%', align: 'right' },
      { key: 'printer', header: 'المطبعة', width: '12%', align: 'right' },
      { key: 'meters', header: 'الأمتار م²', width: '7%', align: 'center' },
      { key: 'cpm', header: 'سعر متر المطبعة', width: '9%', align: 'center' },
      { key: 'cost', header: 'التكلفة', width: '9%', align: 'center' },
      { key: 'customerRate', header: 'سعر متر الزبون', width: '9%', align: 'center' },
      { key: 'customerCost', header: 'قيمة الزبون', width: '9%', align: 'center' },
      { key: 'status', header: 'الحالة', width: '9%', align: 'center' },
    ];
    const printRows = rows.map((r, i) => ({
      index: i + 1,
      date: format(new Date(r.date), 'yyyy/MM/dd'),
      contract: r.contractId ? `#${r.contractId}` : '—',
      customer: r.customer || '—',
      printer: r.printer,
      meters: n2(r.meters),
      cpm: n2(r.costPerMeter),
      cost: n2(r.cost),
      customerRate: n2(r.customerRate),
      customerCost: n2(r.customerCost),
      status: r.status === 'awaiting_task' ? 'بانتظار مهمة (تقديري)' : r.status === 'completed' ? 'مكتمل' : 'قيد الطباعة',
    }));
    const byPrinterHtml = totals.byPrinter.length > 1 ? `
      <table style="width:100%;border-collapse:collapse;margin:10px 0;font-size:12px">
        <thead><tr style="background:#f3f3f3"><th style="padding:6px;border:1px solid #ddd;text-align:right">المطبعة</th><th style="padding:6px;border:1px solid #ddd">المهام</th><th style="padding:6px;border:1px solid #ddd">الأمتار م²</th><th style="padding:6px;border:1px solid #ddd">التكلفة</th></tr></thead>
        <tbody>${totals.byPrinter.map(p => `<tr><td style="padding:6px;border:1px solid #ddd">${p.name}</td><td style="padding:6px;border:1px solid #ddd;text-align:center">${p.count}</td><td style="padding:6px;border:1px solid #ddd;text-align:center">${n2(p.meters)}</td><td style="padding:6px;border:1px solid #ddd;text-align:center">${n2(p.cost)}</td></tr>`).join('')}</tbody>
      </table>` : '';
    openMeasurementsPrintWindow({
      config,
      documentData: {
        title: 'كشف طباعة الأمتار',
        date: format(new Date(), 'yyyy/MM/dd'),
        additionalInfo: [
          { label: 'الفترة', value: periodLabel },
          { label: 'المطبعة', value: printerLabel },
          { label: 'حسب', value: basis === 'completed' ? 'تاريخ الإنجاز' : 'تاريخ الإنشاء' },
        ],
      },
      columns,
      rows: printRows,
      statisticsCards: [
        { label: 'عدد المهام', value: totals.count },
        { label: 'إجمالي الأمتار', value: n2(totals.meters), unit: 'م²' },
        { label: 'متوسط سعر المتر', value: n2(totals.avg), unit: 'د.ل' },
        { label: 'إجمالي التكلفة', value: n2(totals.cost), unit: 'د.ل' },
      ],
      customHeaderHtml: byPrinterHtml,
      totals: [
        { label: 'إجمالي الأمتار (م²)', value: n2(totals.meters), bold: true },
        { label: 'إجمالي التكلفة (د.ل)', value: n2(totals.cost), highlight: true },
      ],
    }, 'كشف طباعة الأمتار', 'printers');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto" dir="rtl">
        <DialogHeader className="text-right">
          <DialogTitle className="flex items-center gap-2"><Ruler className="h-5 w-5 text-primary" />كشف طباعة الأمتار</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <p className="text-xs leading-5 text-muted-foreground">تظهر العقود المفعّلة للطباعة والمهام في الفترة. العقود بانتظار مهمة تظهر بتكلفة تقديرية وفق آخر سعر مسجل للمطبعة بتاريخ العقد، ولا تُضاف إلى رصيد حساب المطبعة حتى إنشاء المهمة. سعر صفر يعني أنه لم يُسجل سعر للمطبعة. اختر تاريخ الإنجاز لعرض المطبوع المنجز.</p>
          <div className="flex flex-wrap gap-1">
            {PRESETS.map(p => (
              <button
                key={p.key}
                type="button"
                onClick={() => pickPreset(p.key)}
                className={cn('h-8 cursor-pointer rounded-md border px-3 text-xs font-semibold transition-colors', preset === p.key ? 'border-primary bg-primary/15 text-primary' : 'border-border/60 text-muted-foreground hover:bg-muted')}
              >
                {p.label}
              </button>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="space-y-1"><Label className="text-xs">من</Label><Input type="date" value={from} onChange={e => { setFrom(e.target.value); setPreset('custom'); }} className="h-9" /></div>
            <div className="space-y-1"><Label className="text-xs">إلى</Label><Input type="date" value={to} onChange={e => { setTo(e.target.value); setPreset('custom'); }} className="h-9" /></div>
            <div className="space-y-1">
              <Label className="text-xs">المطبعة</Label>
              <Select value={printerId} onValueChange={setPrinterId}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل المطابع</SelectItem>
                  {printers.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">حسب تاريخ</Label>
              <Select value={basis} onValueChange={(v) => setBasis(v as any)}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="created">إنشاء المهمة</SelectItem>
                  <SelectItem value="completed">إنجاز المهمة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border/60 bg-border/60 sm:grid-cols-4">
            {[
              { k: 'عدد المهام', v: String(totals.count) },
              { k: 'إجمالي الأمتار', v: `${n2(totals.meters)} م²` },
              { k: 'متوسط سعر المتر', v: `${n2(totals.avg)} د.ل` },
              { k: 'إجمالي التكلفة', v: `${n2(totals.cost)} د.ل` },
            ].map(x => (
              <div key={x.k} className="bg-card px-3 py-2"><p className="text-xs text-muted-foreground">{x.k}</p><p className="text-base font-bold tabular-nums">{x.v}</p></div>
            ))}
          </div>

          {totals.byPrinter.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {totals.byPrinter.map(p => (
                <span key={p.name} className="rounded-lg border border-border/60 px-2.5 py-1 text-xs">
                  <b>{p.name}</b> · {n2(p.meters)} م² · {p.count} مهمة
                </span>
              ))}
            </div>
          )}

          <div className="overflow-x-auto rounded-xl border border-border/60">
            <table className="w-full text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-2 py-2 text-right">التاريخ</th>
                  <th className="px-2 py-2 text-right">العقد</th>
                  <th className="px-2 py-2 text-right">الزبون</th>
                  <th className="px-2 py-2 text-right">المطبعة</th>
                  <th className="px-2 py-2 text-center">م²</th>
                  <th className="px-2 py-2 text-center">سعر متر المطبعة</th>
                  <th className="px-2 py-2 text-center">التكلفة</th>
                  <th className="px-2 py-2 text-center">سعر متر الزبون</th>
                  <th className="px-2 py-2 text-center">قيمة الزبون</th>
                  <th className="px-2 py-2 text-center">الحالة</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {loading ? (
                  <tr><td colSpan={10} className="py-8 text-center"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
                ) : rows.length === 0 ? (
                  <tr><td colSpan={10} className="py-8 text-center text-muted-foreground">لا توجد عقود أو مهام طباعة في هذه الفترة</td></tr>
                ) : rows.map(r => (
                  <tr key={r.id} className="hover:bg-muted/20">
                    <td className="px-2 py-1.5 tabular-nums">{format(new Date(r.date), 'yyyy/MM/dd')}</td>
                    <td className="px-2 py-1.5">{r.contractId ? `#${r.contractId}` : '—'}</td>
                    <td className="px-2 py-1.5">{r.customer || '—'}</td>
                    <td className="px-2 py-1.5">{r.printer}</td>
                    <td className="px-2 py-1.5 text-center font-semibold tabular-nums">{n2(r.meters)}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums">{n2(r.costPerMeter)}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums">{n2(r.cost)}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums">{n2(r.customerRate)}</td>
                    <td className="px-2 py-1.5 text-center tabular-nums">{n2(r.customerCost)}</td>
                    <td className="px-2 py-1.5 text-center">{r.status === 'awaiting_task' ? 'بانتظار مهمة (تقديري)' : r.status === 'completed' ? 'مكتمل' : 'قيد الطباعة'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <Button onClick={handlePrint} disabled={loading} className="gap-2"><Printer className="h-4 w-4" />طباعة الكشف</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default PrintedMetersStatement;
