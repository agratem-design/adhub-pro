import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Wrench, Send, Calendar } from 'lucide-react';
import type { ContractFormData } from '@/hooks/useContractForm';

interface CostCalculatorProps {
  formData: ContractFormData;
  updateFormData: (updates: Partial<ContractFormData>) => void;
  estimatedTotal: number;
  baseTotal: number;
  discountAmount: number;
  totalAfterDiscount: number;
  rentalCostOnly: number;
  finalTotal: number;
  operatingFee: number;
  installationCost: number;
  userEditedRentCost: boolean;
  setUserEditedRentCost: (edited: boolean) => void;
  showOriginalTotal?: boolean;
  originalTotal?: number;
  currentContract?: any;
}

export const CostCalculator: React.FC<CostCalculatorProps> = ({
  formData,
  updateFormData,
  estimatedTotal,
  baseTotal,
  discountAmount,
  totalAfterDiscount,
  rentalCostOnly,
  finalTotal,
  operatingFee,
  installationCost,
  userEditedRentCost,
  setUserEditedRentCost,
  showOriginalTotal = false,
  originalTotal = 0,
  currentContract
}) => {
  const [showSettlement, setShowSettlement] = React.useState(false);

  const handleWhatsAppShare = () => {
    const text = `${showOriginalTotal ? 'تعديل عقد' : 'عقد جديد'}\nالزبون: ${formData.customerName}\nمن ${formData.startDate} إلى ${formData.endDate}\nالإجمالي النهائي: ${finalTotal.toLocaleString('ar-LY')} د.ل\nسعر الإيجار: ${rentalCostOnly.toLocaleString('ar-LY')} د.ل\nتكلفة التركيب: ${installationCost.toLocaleString('ar-LY')} د.ل\nرسوم التشغيل: ${operatingFee.toLocaleString('ar-LY')} د.ل`;
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  };

  const calculateSettlement = () => {
    const s = formData.startDate ? new Date(formData.startDate) : null;
    const e = formData.endDate ? new Date(formData.endDate) : null;
    if (!s || !e || isNaN(s.getTime()) || isNaN(e.getTime()))
      return { message: 'يرجى تحديد تاريخ البداية والنهاية' };
    
    const today = new Date();
    const end = e < today ? e : today;
    const totalDays = Math.max(1, Math.ceil((e.getTime() - s.getTime()) / 86400000));
    const consumedDays = Math.max(0, Math.min(totalDays, Math.ceil((end.getTime() - s.getTime()) / 86400000)));
    const ratio = consumedDays / totalDays;
    const currentDue = Math.round(finalTotal * ratio);
    
    return {
      endDate: formData.endDate,
      consumedDays,
      totalDays,
      currentDue
    };
  };

  return (
    <>
      {/* Settlement and Sharing */}
      <Card className="card-elegant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            التسوية والإرسال
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => setShowSettlement((s) => !s)}>
              تسوية العقد
            </Button>
            <Button
              type="button"
              variant="outline"
              className="gap-2"
              onClick={handleWhatsAppShare}
            >
              <Send className="h-4 w-4" /> إرسال عبر الواتساب
            </Button>
          </div>
          {showSettlement && (
            <div className="space-y-2 text-sm">
              {(() => {
                const settlement = calculateSettlement();
                if ('message' in settlement) {
                  return <div className="text-muted">{settlement.message}</div>;
                }
                return (
                  <div className="space-y-1">
                    <div>
                      تاريخ انتهاء العقد: <span className="font-medium">{settlement.endDate}</span>
                    </div>
                    <div>
                      الأيام المستهلكة: <span className="font-medium">{settlement.consumedDays}</span> / {settlement.totalDays}
                    </div>
                    <div>
                      التكلفة الحالية عند التسوية: <span className="font-bold text-primary">{settlement.currentDue.toLocaleString('ar-LY')} د.ل</span>
                    </div>
                  </div>
                );
              })()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Cost Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" /> التكلفة
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="text-sm text-muted">
            تقدير تلقائي حسب الفئة والمدة: <span className="price-text">{estimatedTotal.toLocaleString('ar-LY')} د.ل</span>
          </div>
          
          <Input
            type="number"
            value={formData.rentCost}
            onChange={(e) => {
              updateFormData({ rentCost: Number(e.target.value) });
              setUserEditedRentCost(true);
            }}
            placeholder="تكلفة قبل الخصم (تُحدّث تلقائياً)"
          />
          
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="form-label">نوع الخصم</label>
              <Select 
                value={formData.discountType} 
                onValueChange={(v) => updateFormData({ discountType: v as 'percent' | 'amount' })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="نوع الخصم" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="percent">نسبة %</SelectItem>
                  <SelectItem value="amount">قيمة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="form-label">قيمة الخصم</label>
              <Input
                type="number"
                value={formData.discountValue}
                onChange={(e) => updateFormData({ discountValue: Number(e.target.value) || 0 })}
                placeholder="0"
              />
            </div>
          </div>
          
          <div className="space-y-3 border-t pt-3">
            {/* 1. الإجمالي الكامل */}
            <div className="text-sm bg-muted/30 p-2 rounded">
              <span className="text-muted-foreground">① الإجمالي الكامل:</span>
              <span className="price-text font-medium mr-2">{baseTotal.toLocaleString('ar-LY')} د.ل</span>
            </div>
            
            {/* 2. طرح التركيب */}
            {installationCost > 0 && (
              <div className="text-sm bg-amber-50 dark:bg-amber-950/30 p-2 rounded flex items-center gap-1">
                <Wrench className="h-4 w-4 text-amber-600" />
                <span className="text-muted-foreground">② تكلفة التركيب:</span>
                <span className="text-amber-600 font-medium mr-2">- {installationCost.toLocaleString('ar-LY')} د.ل</span>
              </div>
            )}
            
            {/* 3. صافي الإيجار قبل الخصم */}
            <div className="text-sm bg-blue-50 dark:bg-blue-950/30 p-2 rounded">
              <span className="text-muted-foreground">③ صافي الإيجار (قبل الخصم):</span>
              <span className="text-blue-600 font-medium mr-2">{(baseTotal - installationCost).toLocaleString('ar-LY')} د.ل</span>
              <span className="text-xs text-muted-foreground">({baseTotal.toLocaleString('ar-LY')} - {installationCost.toLocaleString('ar-LY')})</span>
            </div>
            
            {/* 4. الخصم */}
            {discountAmount > 0 && (
              <div className="text-sm bg-red-50 dark:bg-red-950/30 p-2 rounded">
                <span className="text-muted-foreground">④ الخصم:</span>
                <span className="text-red-600 font-medium mr-2">- {discountAmount.toLocaleString('ar-LY')} د.ل</span>
              </div>
            )}
            
            {/* 5. صافي الإيجار بعد الخصم */}
            <div className="bg-green-50 dark:bg-green-950/30 p-3 rounded border border-green-200 dark:border-green-800">
              <div className="text-sm text-muted-foreground mb-1">⑤ صافي الإيجار بعد الخصم:</div>
              <div className="text-lg font-bold text-green-600">{rentalCostOnly.toLocaleString('ar-LY')} د.ل</div>
              {discountAmount > 0 && (
                <div className="text-xs text-muted-foreground">
                  ({(baseTotal - installationCost).toLocaleString('ar-LY')} - {discountAmount.toLocaleString('ar-LY')})
                </div>
              )}
            </div>
            
            {/* 6. الإجمالي النهائي */}
            {/* 6. الإجمالي النهائي */}
            <div className="bg-primary/10 p-3 rounded border border-primary/30">
              <div className="text-sm text-muted-foreground mb-1">⑥ الإجمالي النهائي (صافي الإيجار + التركيب):</div>
              <div className="text-xl font-bold text-primary">{finalTotal.toLocaleString('ar-LY')} د.ل</div>
              {installationCost > 0 && (
                <div className="text-xs text-muted-foreground">
                  ({rentalCostOnly.toLocaleString('ar-LY')} + {installationCost.toLocaleString('ar-LY')})
                </div>
              )}
            </div>
            
            {operatingFee > 0 && (
              <div className="text-sm flex items-center gap-1 bg-muted/30 p-2 rounded">
                <DollarSign className="h-4 w-4" />
                رسوم التشغيل ({formData.operatingFeeRate}%): {operatingFee.toLocaleString('ar-LY')} د.ل
              </div>
            )}
            
            {showOriginalTotal && (
              <div className="space-y-1 bg-muted/20 p-2 rounded">
                <div className="text-sm text-muted-foreground">المدفوع: <span className="text-green-600 font-medium">{(currentContract?.['Total Paid'] || 0).toLocaleString('ar-LY')} د.ل</span></div>
                <div className="text-sm text-muted-foreground">المتبقي: <span className="text-destructive font-medium">{(finalTotal - (currentContract?.['Total Paid'] || 0)).toLocaleString('ar-LY')} د.ل</span></div>
                <div className="text-sm text-muted-foreground">السابق: <span className="font-medium">{originalTotal.toLocaleString('ar-LY')} د.ل</span> • الفرق: <span className="text-primary font-medium">{(finalTotal - originalTotal).toLocaleString('ar-LY')} د.ل</span></div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </>
  );
};