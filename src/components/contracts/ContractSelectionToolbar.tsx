import type { ReactNode } from 'react';
import { CheckSquare, Download, Loader2, Printer, Ruler, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface Props {
  count: number; filteredCount: number; rangeSelector: ReactNode;
  printing: boolean; preparingSizes: boolean; exporting: boolean;
  onClear: () => void; onSelectAll: () => void; onPrint: () => void; onSizes: () => void; onExport: () => void;
}
export function ContractSelectionToolbar(props: Props) {
  const busy = props.printing || props.preparingSizes || props.exporting;
  return <section dir="rtl" aria-label="إجراءات العقود المختارة" className="sticky top-4 z-20 rounded-xl border border-primary/30 bg-card p-3 shadow-md sm:p-4">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b pb-3">
      <div className="flex items-center gap-3"><span role="status" className="rounded-lg bg-primary/10 px-3 py-2 text-sm font-semibold text-primary">{props.count} عقد مختار</span><Button size="sm" variant="ghost" disabled={busy} onClick={props.onClear} className="min-h-[44px] cursor-pointer text-[13px] gap-2"><X aria-hidden="true" className="h-4 w-4" /><span>إلغاء الاختيار</span></Button></div>
      <div className="flex flex-wrap items-center gap-2">{props.rangeSelector}<Button variant="outline" size="sm" disabled={busy || !props.filteredCount} onClick={props.onSelectAll} className="min-h-[44px] cursor-pointer text-[13px] gap-2"><CheckSquare aria-hidden="true" className="h-4 w-4" /><span>اختيار الكل ({props.filteredCount})</span></Button></div>
    </div>
    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
      <Button variant="outline" disabled={busy} onClick={props.onPrint} className="min-h-[44px] cursor-pointer text-[13px] gap-2">{props.printing ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Printer aria-hidden="true" className="h-4 w-4" />}<span>{props.printing ? 'جاري تجهيز العقود…' : `طباعة العقود (${props.count})`}</span></Button>
      <Button variant="outline" disabled={busy} onClick={props.onSizes} className="min-h-[44px] cursor-pointer text-[13px] gap-2 border-primary/50 text-primary hover:bg-primary/10">{props.preparingSizes ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Ruler aria-hidden="true" className="h-4 w-4" />}<span>{props.preparingSizes ? 'جاري تجهيز المقاسات…' : 'طباعة فاتورة المقاسات'}</span></Button>
      <Button variant="outline" disabled={busy} onClick={props.onExport} className="min-h-[44px] cursor-pointer text-[13px] gap-2">{props.exporting ? <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Download aria-hidden="true" className="h-4 w-4" />}<span>{props.exporting ? 'جاري تجهيز الملف…' : 'تنزيل اللوحات Excel'}</span></Button>
    </div>
  </section>;
}
