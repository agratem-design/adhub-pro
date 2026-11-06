import { printUnifiedDocument, escHtml, docMoney, docDate } from '@/lib/unifiedDocument';
import React from 'react';
import { Button } from '@/components/ui/button';
import { Printer } from 'lucide-react';

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

interface PrintTaskInvoiceProps {
  designGroups: DesignGroup[];
  pricePerMeter: number;
  cutoutPricePerUnit: number;
  printerName?: string;
  cutoutPrinterName?: string;
  totalArea: number;
  totalCutouts: number;
  showPrices?: boolean;
}

export function PrintTaskInvoice({
  designGroups,
  pricePerMeter,
  cutoutPricePerUnit,
  printerName,
  cutoutPrinterName,
  totalArea,
  totalCutouts,
  showPrices = true
}: PrintTaskInvoiceProps) {
  const printCost = totalArea * pricePerMeter;
  const cutoutsCost = totalCutouts * cutoutPricePerUnit;
  const totalCost = printCost + cutoutsCost;

  const handlePrint = async () => {
    // ✅ المستند الموحد — نفس قالب كل الفواتير، والألوان من إعدادات الطباعة (فاتورة مهمة الطباعة)
    const img = (url?: string) => url ? `<img src="${escHtml(url)}" alt="التصميم" style="max-width:70px;max-height:60px;object-fit:contain" onerror="this.style.display='none'" />` : '—';
    await printUnifiedDocument('print_task', {
      title: 'فاتورة طباعة',
      subtitle: 'Print Task Invoice',
      info: [
        { label: 'المطبعة الرئيسية', value: escHtml(printerName || 'غير محدد') },
        ...(totalCutouts > 0 ? [{ label: 'مطبعة المجسمات', value: escHtml(cutoutPrinterName || printerName || 'غير محدد') }] : []),
        { label: 'رقم الفاتورة', value: `<bdi>PT-${Date.now()}</bdi>` },
        { label: 'التاريخ', value: docDate(new Date()) },
        { label: 'إجمالي المساحة', value: `${totalArea.toFixed(2)} م²` },
      ],
      total: showPrices && totalCost > 0 ? { label: 'الإجمالي الكلي', value: docMoney(totalCost) } : undefined,
      sections: [{
        title: `التصاميم (${designGroups.length})`,
        columns: [
          { key: 'design', header: 'التصميم', width: '12%' },
          { key: 'size', header: 'المقاس', width: '12%' },
          { key: 'face', header: 'الوجه' },
          { key: 'cut', header: 'مجسمات', width: '12%' },
          { key: 'qty', header: 'الكمية', width: '8%' },
          { key: 'area', header: 'المساحة/وحدة', width: '12%' },
          { key: 'totalArea', header: 'إجمالي المساحة', width: '13%' },
          ...(showPrices ? [{ key: 'cost', header: 'تكلفة الطباعة', width: '13%' }] : []),
        ],
        rows: designGroups.map(g => ({
          design: img(g.design) + (g.hasCutout && g.cutoutImageUrl ? `<br>${img(g.cutoutImageUrl)}` : ''),
          size: `<b><bdi>${escHtml(g.size)}</bdi></b>`,
          face: g.face === 'a' ? 'أمامي' : 'خلفي',
          cut: g.hasCutout ? '<span class="os-days">يحتوي على مجسم</span>' : '—',
          qty: `×${g.quantity}`,
          area: `${g.area.toFixed(2)} م²`,
          totalArea: `<b>${(g.area * g.quantity).toFixed(2)} م²</b>`,
          cost: docMoney(g.area * g.quantity * pricePerMeter),
        })),
      }],
      summary: showPrices && totalCost > 0 ? [
        { label: 'سعر المتر', value: docMoney(pricePerMeter) },
        { label: 'تكلفة الطباعة', value: docMoney(printCost) },
        ...(totalCutouts > 0 && cutoutsCost > 0 ? [
          { label: `المجسمات (${totalCutouts} × ${docMoney(cutoutPricePerUnit)})`, value: docMoney(cutoutsCost) },
        ] : []),
        { label: 'الإجمالي الكلي', value: docMoney(totalCost) },
      ] : undefined,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">معاينة فاتورة الطباعة</h3>
        <Button onClick={handlePrint} className="gap-2">
          <Printer className="h-4 w-4" />
          طباعة فاتورة المطبعة
        </Button>
      </div>
      
      <div className="border rounded-lg p-4 bg-muted/30">
        <div className="text-sm text-muted-foreground mb-2">
          سيتم طباعة فاتورة بصيغة A4 تحتوي على {designGroups.length} تصميم
        </div>
      </div>
    </div>
  );
}
