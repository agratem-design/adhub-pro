import { printUnifiedDocument, escHtml, docMoney, docDate } from '@/lib/unifiedDocument';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';
import { preparePrintWindow, writePrintWindow } from '@/utils/printWindowHelper';

interface DesignGroup {
  design: string;
  face: 'a' | 'b';
  size: string;
  quantity: number;
  area: number;
  billboards: number[];
  width: number;
  height: number;
  hasCutout?: boolean;
  cutoutCount?: number;
  cutoutImageUrl?: string;
}

interface CutoutTaskInvoiceProps {
  designGroups: DesignGroup[];
  cutoutPricePerUnit: number;
  cutoutPrinterName?: string;
  totalCutouts: number;
  showPrices?: boolean;
}

export function CutoutTaskInvoice({
  designGroups,
  cutoutPricePerUnit,
  cutoutPrinterName,
  totalCutouts,
  showPrices = true
}: CutoutTaskInvoiceProps) {
  // تصفية التصاميم لإظهار فقط التي تحتوي على مجسمات
  const cutoutDesigns = designGroups.filter(group => group.hasCutout && (group.cutoutCount || 0) > 0);
  const totalCutoutsCost = totalCutouts * cutoutPricePerUnit;

  const handlePrint = () => {
    // ✅ المستند الموحد — نفس قالب كل الفواتير، والألوان من إعدادات الطباعة (فاتورة مهمة القص)
    const img = (url?: string) => url ? `<img src="${escHtml(url)}" alt="التصميم" style="max-width:70px;max-height:60px;object-fit:contain" onerror="this.style.display='none'" />` : '—';
    void printUnifiedDocument('cutout_task', {
      title: 'فاتورة قص المجسمات',
      subtitle: 'Cutout Task Invoice',
      info: [
        { label: 'مصنع قص المجسمات', value: escHtml(cutoutPrinterName || 'غير محدد') },
        { label: 'رقم الفاتورة', value: `<bdi>CT-${Date.now()}</bdi>` },
        { label: 'التاريخ', value: docDate(new Date()) },
        { label: 'إجمالي المجسمات', value: totalCutouts },
      ],
      total: showPrices ? { label: 'الإجمالي الكلي', value: docMoney(totalCutoutsCost) } : undefined,
      sections: [{
        title: `التصاميم (${cutoutDesigns.length})`,
        columns: [
          { key: 'design', header: 'صورة التصميم', width: '13%' },
          { key: 'cutout', header: 'صورة المجسم', width: '13%' },
          { key: 'size', header: 'المقاس', width: '12%' },
          { key: 'face', header: 'الوجه' },
          { key: 'qty', header: 'الكمية', width: '9%' },
          { key: 'count', header: 'عدد المجسمات', width: '11%' },
          { key: 'total', header: 'إجمالي المجسمات', width: '12%' },
          ...(showPrices ? [{ key: 'cost', header: 'التكلفة', width: '12%' }] : []),
        ],
        rows: cutoutDesigns.map(g => {
          const groupTotal = g.quantity * (g.cutoutCount || 0);
          return {
            design: img(g.design), cutout: img(g.cutoutImageUrl),
            size: `<b><bdi>${escHtml(g.size)}</bdi></b>`, face: g.face === 'a' ? 'أمامي' : 'خلفي',
            qty: `×${g.quantity}`, count: `×${g.cutoutCount || 0}`, total: `<b>${groupTotal}</b>`,
            cost: docMoney(groupTotal * cutoutPricePerUnit),
          };
        }),
      }],
      summary: showPrices ? [
        { label: 'إجمالي المجسمات', value: String(totalCutouts) },
        { label: 'سعر المجسم', value: docMoney(cutoutPricePerUnit) },
        { label: 'الإجمالي الكلي', value: docMoney(totalCutoutsCost) },
      ] : undefined,
    });
  };

  if (cutoutDesigns.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">معاينة فاتورة قص المجسمات</h3>
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          طباعة فاتورة قص المجسمات
        </Button>
      </div>
      
      <div className="border rounded-lg p-4 bg-muted/30">
        <div className="text-sm text-muted-foreground mb-2">
          سيتم طباعة فاتورة بصيغة A4 تحتوي على {cutoutDesigns.length} تصميم بمجسمات ({totalCutouts} مجسم إجمالي)
        </div>
      </div>
    </div>
  );
}
