import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Printer, Edit2 } from 'lucide-react';

interface PrintCostDetail {
  size: string;
  quantity: number;
  areaPerBoard: number;
  totalArea: number;
  unitCost: number;
  totalCost: number;
}

interface PrintCostSummaryProps {
  printCostEnabled: boolean;
  setPrintCostEnabled: (enabled: boolean) => void;
  printPricePerMeter: number;
  setPrintPricePerMeter: (price: number) => void;
  printCostDetails: PrintCostDetail[];
  onUpdateUnitCost: (size: string, newCost: number) => void;
  totalPrintCost: number;
}

export function PrintCostSummary({
  printCostEnabled,
  setPrintCostEnabled,
  printPricePerMeter,
  setPrintPricePerMeter,
  printCostDetails,
  onUpdateUnitCost,
  totalPrintCost,
}: PrintCostSummaryProps) {
  return (
    <Card className="bg-card border-border shadow-lg">
      <CardHeader className="border-b border-border">
        <div className="flex items-center justify-between">
          <CardTitle className="text-xl font-bold flex items-center gap-2">
            <Printer className="h-5 w-5 text-primary" />
            تكلفة الطباعة
          </CardTitle>
          <div className="flex items-center gap-2">
            <Label htmlFor="print-enabled" className="text-sm">تفعيل الطباعة</Label>
            <Switch
              id="print-enabled"
              checked={printCostEnabled}
              onCheckedChange={setPrintCostEnabled}
            />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="p-6 space-y-4">
        {printCostEnabled && (
          <>
            {/* سعر المتر المربع */}
            <div className="bg-muted/50 p-4 rounded-lg border border-border">
              <Label htmlFor="print-price" className="text-sm font-medium mb-2 block">
                سعر المتر المربع (د.ل)
              </Label>
              <Input
                id="print-price"
                type="number"
                min="0"
                step="0.01"
                value={printPricePerMeter}
                onChange={(e) => setPrintPricePerMeter(Number(e.target.value) || 0)}
                className="text-lg font-bold"
              />
            </div>

            {/* تفاصيل الطباعة لكل مقاس */}
            {printCostDetails.length > 0 && (
              <div className="space-y-3">
                <h3 className="font-semibold text-base border-b border-border pb-2">
                  تفاصيل الطباعة حسب المقاس
                </h3>
                
                <div className="space-y-2">
                  {printCostDetails.map((detail) => (
                    <div
                      key={detail.size}
                      className="bg-background border border-border rounded-lg p-4 space-y-3"
                    >
                      {/* رأس المقاس */}
                      <div className="flex items-center justify-between border-b border-border pb-2">
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-lg text-primary">{detail.size}</span>
                          <span className="text-sm text-muted-foreground">
                            ({detail.quantity} {detail.quantity === 1 ? 'لوحة' : 'لوحات'})
                          </span>
                        </div>
                        <div className="text-sm text-muted-foreground">
                          المساحة الكلية: {detail.totalArea.toFixed(2)} م²
                        </div>
                      </div>

                      {/* تفاصيل الحساب */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                        <div className="bg-muted/30 p-3 rounded">
                          <div className="text-muted-foreground mb-1">مساحة اللوحة</div>
                          <div className="font-semibold">{detail.areaPerBoard.toFixed(2)} م²</div>
                        </div>
                        
                        <div className="bg-muted/30 p-3 rounded">
                          <div className="text-muted-foreground mb-1">السعر الافتراضي</div>
                          <div className="font-semibold">{printPricePerMeter.toFixed(2)} د.ل/م²</div>
                        </div>
                        
                        <div className="bg-primary/10 p-3 rounded">
                          <div className="text-muted-foreground mb-1">التكلفة الكلية</div>
                          <div className="font-bold text-primary text-lg">
                            {detail.totalCost.toFixed(2)} د.ل
                          </div>
                        </div>
                      </div>

                      {/* إمكانية تعديل التكلفة لكل وحدة */}
                      <div className="flex items-center gap-3 bg-blue-50 dark:bg-blue-950/20 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                        <Edit2 className="h-4 w-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />
                        <div className="flex-1">
                          <Label htmlFor={`unit-cost-${detail.size}`} className="text-xs text-muted-foreground mb-1 block">
                            تعديل التكلفة لكل لوحة (اختياري)
                          </Label>
                          <Input
                            id={`unit-cost-${detail.size}`}
                            type="number"
                            min="0"
                            step="0.01"
                            placeholder={`${detail.unitCost.toFixed(2)} د.ل (افتراضي)`}
                            onChange={(e) => {
                              const newValue = Number(e.target.value);
                              if (newValue > 0) {
                                onUpdateUnitCost(detail.size, newValue);
                              }
                            }}
                            className="h-9"
                          />
                        </div>
                        <div className="text-xs text-muted-foreground">
                          الكمية: {detail.quantity}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>

                {/* الإجمالي */}
                <div className="bg-gradient-to-r from-primary/10 to-primary/5 p-4 rounded-lg border-2 border-primary/20">
                  <div className="flex items-center justify-between">
                    <span className="text-lg font-bold">إجمالي تكلفة الطباعة</span>
                    <span className="text-2xl font-bold text-primary">
                      {totalPrintCost.toFixed(2)} د.ل
                    </span>
                  </div>
                </div>
              </div>
            )}

            {printCostDetails.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                <Printer className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>لا توجد لوحات مضافة للعقد</p>
              </div>
            )}
          </>
        )}

        {!printCostEnabled && (
          <div className="text-center py-6 text-muted-foreground">
            <p>تكلفة الطباعة غير مفعلة لهذا العقد</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
