import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { X, ShoppingCart, Calculator, Printer } from 'lucide-react';
import { CUSTOMERS, CustomerType, getPriceFor } from '@/data/pricing';
import { useState } from 'react';
import type { Billboard } from '@/types';
import { buildMinimalOfferHtml } from '@/components/Invoice/printTemplates';

interface BookingSummaryProps {
  selectedBillboards: Billboard[];
  onRemoveBillboard: (billboardId: string) => void;
  onSubmitBooking: () => void;
  isOpen: boolean;
}

export function BookingSummary({
  selectedBillboards,
  onRemoveBillboard,
  onSubmitBooking,
  isOpen
}: BookingSummaryProps) {
  const [months, setMonths] = useState<number>(1);
  const [customer, setCustomer] = useState<string>(CUSTOMERS[0]);

  const totalCost = selectedBillboards.reduce((sum, b) => {
    const price = getPriceFor((b as any).Size || (b as any).size, (b as any).Level || (b as any).level, customer as CustomerType, months) ?? 0;
    return sum + price;
  }, 0);

  if (!isOpen || selectedBillboards.length === 0) return null;

  return (
    <Card className="fixed bottom-4 right-4 w-96 max-h-[70vh] overflow-hidden shadow-luxury border-primary/20 bg-card/95 backdrop-blur-sm z-50">
      <CardHeader className="bg-gradient-primary text-primary-foreground pb-3">
        <CardTitle className="flex items-center gap-2">
          <ShoppingCart className="h-5 w-5" />
          ملخص الحجز ({selectedBillboards.length} لوحة)
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 max-h-64 overflow-y-auto">
        <div className="space-y-3">
          {selectedBillboards.map((billboard) => (
            <div key={billboard.ID} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
              <div className="flex-1">
                <div className="font-medium text-sm">{billboard.Billboard_Name || `لوحة ${billboard.ID}`}</div>
                <div className="text-xs text-muted-foreground">
                  {billboard.Size} - {billboard.District || billboard.City}
                </div>
                <div className="text-xs text-primary font-medium">
                  {billboard.Price || '0'} د.ل
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => onRemoveBillboard(billboard.ID.toString())}
                className="h-8 w-8 p-0 hover:bg-destructive/20 hover:text-destructive"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>
      </CardContent>

      <Separator />

      <div className="p-4 space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Select value={String(months)} onValueChange={(v)=>setMonths(parseInt(v))}>
            <SelectTrigger>
              <SelectValue placeholder="المدة" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">شهر واحد</SelectItem>
              <SelectItem value="2">شهران</SelectItem>
              <SelectItem value="3">3 أشهر</SelectItem>
              <SelectItem value="6">6 أشهر</SelectItem>
              <SelectItem value="12">سنة كاملة</SelectItem>
            </SelectContent>
          </Select>
          <Select value={customer} onValueChange={(v)=>setCustomer(v)}>
            <SelectTrigger>
              <SelectValue placeholder="فئة العميل" />
            </SelectTrigger>
            <SelectContent>
              {CUSTOMERS.map(c=> (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between text-lg font-bold text-primary">
          <span className="flex items-center gap-1">
            <Calculator className="h-4 w-4" />
            الإجمالي:
          </span>
          <span>{totalCost.toLocaleString('en-US')} د.ل</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Button
            onClick={onSubmitBooking}
            variant="hero"
            className="w-full font-semibold"
          >
            إرسال طلب الحجز
          </Button>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              const html = buildMinimalOfferHtml(selectedBillboards as any, { months, customer: customer as CustomerType, logoUrl: 'https://cdn.builder.io/api/v1/image/assets%2Ffc68c2d70dd74affa9a5bbf7eee66f4a%2F684306a82024469997a03db98b279f4e?format=webp&width=256' });
              import('@/components/print/PrintPreviewDialog').then(m => m.showPrintPreview(html, 'عرض سعر'));
            }}
          >
            <Printer className="h-4 w-4 ml-2" /> طباعة
          </Button>
        </div>
      </div>
    </Card>
  );
}
