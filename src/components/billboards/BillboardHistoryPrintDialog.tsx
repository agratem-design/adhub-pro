import { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Printer, Loader2, RefreshCw, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { resolveInvoiceStyles, type ResolvedPrintStyles } from '@/lib/unifiedInvoiceBase';
import { preparePrintWindow, writePrintWindow } from '@/utils/printWindowHelper';
import { buildHistoryReport, type HistoryReportOptions } from './historyReport';
import type { HistoryRecord } from './historyModel';

interface BillboardHistoryPrintDialogProps {
  open: boolean; onOpenChange: (open: boolean) => void;
  billboardId: number; billboardName: string; history: HistoryRecord[];
  totalRentals: number; totalRevenue: number; totalDays: number;
}
const defaults: HistoryReportOptions = { landscape: true, financial: true, costs: false, team: false, notes: false, installationImages: false, designImages: false };
const interactive = 'cursor-pointer transition-all duration-200';

export function BillboardHistoryPrintDialog({ open, onOpenChange, billboardId, billboardName, history }: BillboardHistoryPrintDialogProps) {
  const [styles, setStyles] = useState<ResolvedPrintStyles | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [options, setOptions] = useState<HistoryReportOptions>(defaults);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true); setError(false); setStyles(null);
    resolveInvoiceStyles('sizes_invoice', { titleAr: 'تاريخ اللوحة', titleEn: 'BILLBOARD HISTORY' })
      .then(value => { if (!cancelled) setStyles(value); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [open, retry]);
  const documentHTML = useMemo(() => styles ? buildHistoryReport(styles, billboardName, billboardId, history, options) : '', [styles, billboardName, billboardId, history, options]);
  const setOption = (key: keyof HistoryReportOptions, value: boolean) => setOptions(previous => ({ ...previous, [key]: value }));
  const handlePrint = () => {
    if (!documentHTML || !history.length) return;
    const title = `تاريخ اللوحة ${billboardName}`;
    const printWindow = preparePrintWindow(title);
    if (!printWindow) { toast.error('تعذر فتح الطباعة. اسمح بالنوافذ المنبثقة ثم حاول مجددًا.'); return; }
    writePrintWindow(printWindow, documentHTML, { title, landscape: options.landscape, autoPrint: false });
  };
  return <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent dir="rtl" className="max-w-7xl h-[92dvh] p-0 gap-0 flex flex-col overflow-hidden">
      <DialogHeader className="p-4 sm:p-5 pl-12 sm:pl-14 border-b bg-primary/5 shrink-0">
        <div className="flex flex-wrap justify-between items-center gap-3">
          <div><DialogTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" />معاينة طباعة تاريخ اللوحة</DialogTitle><DialogDescription className="mt-1">{billboardName} · {history.length} سجل · ورق A4</DialogDescription></div>
          <Button disabled={loading || !styles || !history.length} onClick={handlePrint} className={`${interactive} gap-2 min-h-10`}><Printer className="h-4 w-4" />طباعة / حفظ PDF</Button>
        </div>
      </DialogHeader>
      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        <aside className="lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-l bg-card p-4 overflow-y-auto max-h-[32dvh] lg:max-h-none space-y-4">
          <div><p className="text-sm font-bold mb-2">اتجاه الصفحة</p><div className="flex gap-2"><Button size="sm" variant={options.landscape ? 'default' : 'outline'} aria-pressed={options.landscape} onClick={() => setOption('landscape', true)} className={`${interactive} flex-1 min-h-10`}>أفقي</Button><Button size="sm" variant={!options.landscape ? 'default' : 'outline'} aria-pressed={!options.landscape} onClick={() => setOption('landscape', false)} className={`${interactive} flex-1 min-h-10`}>عمودي</Button></div></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-2">
            {([
              ['financial', 'القيم والإجمالي'], ['costs', 'الخصم وتكاليف الخدمات'], ['team', 'فريق التركيب'],
              ['notes', 'الملاحظات'], ['installationImages', 'صور التركيب'], ['designImages', 'صور التصميم'],
            ] as [keyof HistoryReportOptions, string][]).map(([key, label]) => <div key={key} className="flex items-center justify-between gap-3 rounded-lg border p-3"><Label htmlFor={`history-print-${key}`} className="text-xs cursor-pointer leading-5">{label}</Label><Switch id={`history-print-${key}`} checked={options[key]} disabled={key === 'costs' && !options.financial} onCheckedChange={value => setOption(key, value)} className={interactive} /></div>)}
          </div>
          <p className="text-xs leading-6 text-muted-foreground">تظهر الصور والملاحظات في قسم مستقل بعد الجدول. إخفاء القيم يخفي أيضًا الإجمالي والتكاليف من التقرير.</p>
          <Button variant="ghost" className={`${interactive} gap-2 w-full`} onClick={() => setOptions(defaults)}><RefreshCw className="h-3.5 w-3.5" />الإعدادات الافتراضية</Button>
        </aside>
        <div className="flex-1 min-h-0 min-w-0 bg-muted/40 p-2 sm:p-4 flex flex-col">
          {loading ? <div role="status" className="flex flex-1 items-center justify-center gap-2 text-sm"><Loader2 className="h-5 w-5 text-primary motion-safe:animate-spin" />جاري إعداد المعاينة…</div> : error ? <div role="alert" className="flex flex-1 flex-col items-center justify-center gap-3"><p>تعذر تحميل إعدادات الطباعة.</p><Button className={interactive} onClick={() => setRetry(value => value + 1)}>إعادة المحاولة</Button></div> : <iframe title="معاينة تقرير تاريخ اللوحة" sandbox="allow-same-origin" srcDoc={documentHTML} className="w-full flex-1 min-h-0 rounded-lg border bg-white" />}
        </div>
      </div>
      <div className="border-t px-4 py-3 flex justify-between items-center gap-3 shrink-0"><p className="text-xs text-muted-foreground">المعاينة والطباعة تستخدمان نفس المستند.</p><Button variant="outline" className={interactive} onClick={() => onOpenChange(false)}>رجوع للسجل</Button></div>
    </DialogContent>
  </Dialog>;
}
