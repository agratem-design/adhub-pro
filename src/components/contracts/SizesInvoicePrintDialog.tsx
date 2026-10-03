import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Loader2, Ruler } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { usePrintSettingsByType } from '@/store';
import { DOCUMENT_TYPES } from '@/types/document-types';
import { UnifiedPrintDialog } from '@/components/print/UnifiedPrintDialog';
import { buildSizesInvoiceHTML, summarizeSizesInvoice, type SizeDimensions } from '@/lib/sizesInvoice';

interface SizesInvoicePrintDialogProps { open: boolean; onOpenChange: (open: boolean) => void; billboards: any[]; customerName: string; contractNumbers: string[] }
export function SizesInvoicePrintDialog({ open, onOpenChange, billboards, customerName, contractNumbers }: SizesInvoicePrintDialogProps) {
  const { settings, isLoading } = usePrintSettingsByType(DOCUMENT_TYPES.MEASUREMENTS_INVOICE);
  const [dimensions, setDimensions] = useState<SizeDimensions>({});
  const [loadingSizes, setLoadingSizes] = useState(true);
  const [separateFaces, setSeparateFaces] = useState(true);
  const [html, setHtml] = useState('');
  const [error, setError] = useState('');
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingSizes(true); setHtml(''); setError('');
    const loadSizes = async () => {
      try {
        let sizesData: any[] = [];
        const { data, error } = await supabase.from('sizes').select('name, width, height, print_size, sort_order').order('sort_order', { ascending: true });
        if (error && (error.code === '42703' || error.message?.includes('print_size'))) {
          const fallback = await supabase.from('sizes').select('name, width, height, sort_order').order('sort_order', { ascending: true });
          if (fallback.error) throw fallback.error;
          sizesData = fallback.data || [];
        } else if (error) {
          throw error;
        } else {
          sizesData = data || [];
        }
        if (!cancelled) {
          setDimensions(
            Object.fromEntries(
              sizesData.map(size => [
                size.name,
                {
                  width: Number(size.width) || 0,
                  height: Number(size.height) || 0,
                  print_size: size.print_size || null,
                  sort_order: typeof size.sort_order === 'number' ? size.sort_order : 999,
                }
              ])
            )
          );
        }
      } catch {
        if (!cancelled) setError('تعذّر تحميل أبعاد المقاسات. أعد فتح النافذة للمحاولة مجددًا.');
      } finally {
        if (!cancelled) setLoadingSizes(false);
      }
    };
    void loadSizes();
    return () => { cancelled = true; };
  }, [open]);
  const summary = useMemo(() => summarizeSizesInvoice(billboards, dimensions), [billboards, dimensions]);
  useEffect(() => {
    if (!open || isLoading || loadingSizes || error) return;
    let cancelled = false;
    if (!billboards.length) { setError('لا توجد لوحات في العقود المختارة.'); return; }
    setHtml('');
    buildSizesInvoiceHTML(settings || {}, { billboards, dimensions, customerName, contractNumbers, separateFaces }).then(result => { if (!cancelled) setHtml(result); }).catch(() => { if (!cancelled) setError('تعذّر تجهيز كشف مقاسات الطباعة.'); });
    return () => { cancelled = true; };
  }, [open, isLoading, loadingSizes, error, settings, billboards, dimensions, customerName, contractNumbers, separateFaces]);
  if (!html || error) return <Dialog open={open} onOpenChange={onOpenChange}><DialogContent dir="rtl" className="max-w-lg"><DialogHeader><DialogTitle>كشف مقاسات الطباعة</DialogTitle><DialogDescription>تجهيز مقاسات الطباعة من العقود المختارة</DialogDescription></DialogHeader><div className="flex min-h-32 items-center justify-center gap-3">{error ? <p role="alert" className="text-destructive">{error}</p> : <><Loader2 aria-hidden="true" className="h-5 w-5 animate-spin" /><span>جاري تجهيز المعاينة…</span></>}</div></DialogContent></Dialog>;
  return <UnifiedPrintDialog open={open} onOpenChange={onOpenChange} title="كشف مقاسات الطباعة" subtitle={`${contractNumbers.length} عقد · ${summary.totalBillboards} لوحة · ${summary.totalArea.toLocaleString('en-US', { maximumFractionDigits: 2 })} م²${summary.missingSizes.length ? ' (المقاسات المعروفة)' : ''}`} icon={<Ruler aria-hidden="true" className="h-5 w-5" />} html={html} fontFamily={settings?.font_family || 'Doran'} pdfFilename={`كشف_مقاسات_الطباعة_${contractNumbers.join('_')}`} driveFolder="contracts" headerControls={<div className="space-y-2"><div className="flex items-center gap-2"><Checkbox id="sizes-separate-faces" checked={separateFaces} onCheckedChange={value => setSeparateFaces(value === true)} /><Label htmlFor="sizes-separate-faces" className="cursor-pointer text-xs">فصل لوحات الوجه الواحد عن متعددة الأوجه</Label></div>{summary.missingSizes.length > 0 && <p role="status" className="text-xs text-muted-foreground">أبعاد غير معروفة: {summary.missingSizes.join('، ')}. تظهر في الفاتورة دون مساحة محسوبة.</p>}</div>} />;
}
