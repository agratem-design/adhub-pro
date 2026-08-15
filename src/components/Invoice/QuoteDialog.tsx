/**
 * QuoteDialog - عرض السعر الموحد
 * ✅ يستخدم القاعدة الموحدة (unifiedInvoiceBase) + showPrintPreview
 */

import { Button } from '@/components/ui/button';
import * as UIDialog from '@/components/ui/dialog';
import { FileText, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { Billboard } from '@/types';
import { CUSTOMERS, CustomerType, getPriceFor } from '@/data/pricing';
import { addMonths, format as fmt } from 'date-fns';
import { generateQuoteHTML } from '@/lib/quoteGenerator';
import type { QuoteData, QuoteItem } from '@/lib/quoteGenerator';
import { getBillboardsSortMaps, sortBillboardsStandardSync } from '@/lib/billboardSorter';

export type QuoteMeta = {
  contractNumber?: string;
  date?: Date;
  adType?: string;
  clientName?: string;
  clientRep?: string;
  clientPhone?: string;
  companyName?: string;
  companyAddress?: string;
  companyRep?: string;
  iban?: string;
  durationMonths?: number;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  items: Billboard[];
  monthsById: Record<string, number>;
  customerById: Record<string, CustomerType>;
  meta?: QuoteMeta;
};

function mapUrl(b: Billboard): string {
  const coords: any = (b as any).coordinates;
  if (typeof coords === 'string' && coords.includes(',')) {
    const parts = coords.split(',').map((c: string) => c.trim());
    if (parts.length >= 2) return `https://www.google.com/maps?q=${encodeURIComponent(parts[0])},${encodeURIComponent(parts[1])}`;
  } else if (coords && typeof coords === 'object' && typeof (coords as any).lat === 'number' && typeof (coords as any).lng === 'number') {
    return `https://www.google.com/maps?q=${(coords as any).lat},${(coords as any).lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(b.location || '')}`;
}

export default function QuoteDialog(props: Props) {
  const { open, onOpenChange, items, monthsById, customerById } = props;
  const [isLoading, setIsLoading] = useState(false);

  const handlePrint = async () => {
    setIsLoading(true);
    try {
      const meta: QuoteMeta = {
        contractNumber: props.meta?.contractNumber || `${new Date().getFullYear()}-${String(Date.now()).slice(-4)}`,
        date: props.meta?.date || new Date(),
        adType: props.meta?.adType || '—',
        clientName: props.meta?.clientName || '—',
        clientRep: props.meta?.clientRep || '',
        clientPhone: props.meta?.clientPhone || '',
        companyName: props.meta?.companyName || '',
        companyAddress: props.meta?.companyAddress || '',
        companyRep: props.meta?.companyRep || '',
        iban: props.meta?.iban || '',
        durationMonths: props.meta?.durationMonths || Math.max(1, Math.max(...items.map(b => monthsById[b.id] || 1))),
      };

      const { sizeOrderMap, municipalityOrderMap } = await getBillboardsSortMaps();
      const sortedItems = sortBillboardsStandardSync(items, sizeOrderMap, municipalityOrderMap);

      const quoteItems: QuoteItem[] = sortedItems.map((b, i) => {
        const months = monthsById[b.id] || 1;
        const customer = customerById[b.id] || CUSTOMERS[0];
        const unit = getPriceFor(b.size, (b as any).level, customer, months) ?? 0;
        const end = addMonths(new Date(), months);
        return {
          index: i + 1,
          mapUrl: mapUrl(b),
          city: (b as any).City || (b as any).city || '',
          municipality: (b as any).Municipality || (b as any).municipality || '',
          landmark: b.location || (b as any).Nearest_Landmark || '',
          size: b.size || '',
          facesCount: (b as any).Faces_Count || 'وجهين',
          endDate: fmt(end, 'yyyy-MM-dd'),
          price: unit,
          imageUrl: b.image || '/placeholder.svg',
        };
      });

      const grandTotal = quoteItems.reduce((s, r) => s + r.price, 0);

      const quoteData: QuoteData = {
        contractNumber: meta.contractNumber!,
        date: meta.date!,
        adType: meta.adType!,
        clientName: meta.clientName!,
        clientRep: meta.clientRep!,
        clientPhone: meta.clientPhone!,
        companyName: meta.companyName!,
        companyAddress: meta.companyAddress!,
        companyRep: meta.companyRep!,
        iban: meta.iban!,
        durationMonths: meta.durationMonths!,
        items: quoteItems,
        grandTotal,
      };

      const html = await generateQuoteHTML(quoteData);
      const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
      showPrintPreview(html, `عرض_سعر_${meta.contractNumber}`, 'contracts');
      toast.success('تم فتح عرض السعر للطباعة بنجاح!');
      onOpenChange(false);
    } catch (error) {
      console.error('Error generating quote:', error);
      toast.error('حدث خطأ أثناء إنشاء عرض السعر');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <UIDialog.Dialog open={open} onOpenChange={onOpenChange}>
      <UIDialog.DialogContent className="max-w-md">
        <UIDialog.DialogHeader>
          <UIDialog.DialogTitle>عرض سعر</UIDialog.DialogTitle>
        </UIDialog.DialogHeader>
        <p className="text-sm text-muted-foreground">
          سيتم إنشاء عرض سعر موحد لـ {items.length} موقع بنفس تصميم الفواتير الموحدة.
        </p>
        <div className="flex items-center gap-3 justify-end">
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={handlePrint} disabled={isLoading} className="gap-2">
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
            إنشاء وطباعة
          </Button>
        </div>
      </UIDialog.DialogContent>
    </UIDialog.Dialog>
  );
}
