import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Trash2, Plus, AlertCircle, CheckCircle, Calculator, Calendar, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';

interface UnequalPayment {
  amount: number;
  dueDate: string;
  description: string;
  paymentType: string;
}

interface UnequalDistributionManagerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  finalTotal: number;
  startDate: string;
  count: number;
  onApply: (payments: UnequalPayment[]) => void;
}

export function UnequalDistributionManager({
  open,
  onOpenChange,
  finalTotal,
  startDate,
  count,
  onApply
}: UnequalDistributionManagerProps) {
  const [payments, setPayments] = useState<UnequalPayment[]>(
    Array.from({ length: count }).map((_, i) => ({
      amount: 0,
      dueDate: '',
      description: i === 0 ? 'الدفعة الأولى' : `الدفعة ${i + 1}`,
      paymentType: i === 0 ? 'عند التوقيع' : 'شهري'
    }))
  );

  React.useEffect(() => {
    if (open) {
      setPayments(
        Array.from({ length: count }).map((_, i) => ({
          amount: 0,
          dueDate: '',
          description: i === 0 ? 'الدفعة الأولى' : `الدفعة ${i + 1}`,
          paymentType: i === 0 ? 'عند التوقيع' : 'شهري'
        }))
      );
    }
  }, [open, count]);

  const calculateDueDate = (index: number): string => {
    if (!startDate) return '';
    const date = new Date(startDate);
    
    if (index === 0) {
      return startDate;
    }
    
    date.setMonth(date.getMonth() + index);
    return date.toISOString().split('T')[0];
  };

  const totalAmount = useMemo(() => {
    return payments.reduce((sum, p) => sum + (p.amount || 0), 0);
  }, [payments]);

  const difference = finalTotal - totalAmount;
  const isValid = Math.abs(difference) < 0.01;
  const progressPercent = Math.min(100, (totalAmount / finalTotal) * 100);

  const handlePaymentChange = (index: number, field: string, value: any) => {
    const newPayments = [...payments];
    if (field === 'amount') {
      newPayments[index].amount = parseFloat(value) || 0;
    } else if (field === 'dueDate') {
      newPayments[index].dueDate = value;
    } else if (field === 'description') {
      newPayments[index].description = value;
    }
    setPayments(newPayments);
  };

  const handleAutoFillDates = () => {
    const newPayments = payments.map((p, i) => ({
      ...p,
      dueDate: calculateDueDate(i)
    }));
    setPayments(newPayments);
  };

  const handleDistributeEvenly = () => {
    const amountPerPayment = Math.floor((finalTotal / payments.length) * 100) / 100;
    const remainder = finalTotal - (amountPerPayment * (payments.length - 1));
    
    const newPayments = payments.map((p, i) => ({
      ...p,
      amount: i === payments.length - 1 ? Math.round(remainder * 100) / 100 : amountPerPayment,
      dueDate: p.dueDate || calculateDueDate(i)
    }));
    
    setPayments(newPayments);
  };

  const handleFillRemaining = () => {
    if (payments.length === 0) return;
    
    const lastIndex = payments.length - 1;
    const newPayments = [...payments];
    newPayments[lastIndex].amount = Math.round(difference * 100) / 100 + newPayments[lastIndex].amount;
    setPayments(newPayments);
  };

  const handleApply = () => {
    if (!isValid) return;
    
    const finalPayments = payments.map((p, i) => ({
      ...p,
      dueDate: p.dueDate || calculateDueDate(i)
    }));
    
    onApply(finalPayments);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-4 pb-3 border-b border-border bg-gradient-to-r from-purple-500/10 to-purple-500/5">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="p-1.5 rounded-lg bg-purple-500/20">
              <Sparkles className="h-4 w-4 text-purple-500" />
            </div>
            توزيع يدوي للدفعات
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">التقدم</span>
              <span className={cn("font-bold", isValid ? "text-green-500" : "text-purple-500")}>
                {totalAmount.toLocaleString('ar-LY')} / {finalTotal.toLocaleString('ar-LY')} د.ل
              </span>
            </div>
            <div className="h-3 bg-muted rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full transition-all duration-300 rounded-full",
                  isValid ? "bg-green-500" : progressPercent > 100 ? "bg-red-500" : "bg-gradient-to-r from-purple-500 to-purple-400"
                )}
                style={{ width: `${Math.min(100, progressPercent)}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>0%</span>
              <span className={cn("font-bold", isValid ? "text-green-500" : "text-muted-foreground")}>
                {progressPercent.toFixed(0)}%
              </span>
              <span>100%</span>
            </div>
          </div>

          {/* Status */}
          <div className={cn(
            "p-3 rounded-lg flex items-center gap-2 border",
            isValid 
              ? "bg-green-500/10 border-green-500/30" 
              : "bg-amber-500/10 border-amber-500/30"
          )}>
            {isValid ? (
              <>
                <CheckCircle className="h-5 w-5 text-green-500" />
                <span className="text-sm font-medium text-green-600">المجموع متطابق!</span>
              </>
            ) : (
              <>
                <AlertCircle className="h-5 w-5 text-amber-500" />
                <span className="text-sm text-amber-600">
                  {difference > 0 
                    ? `متبقي ${difference.toLocaleString('ar-LY')} د.ل`
                    : `زيادة ${Math.abs(difference).toLocaleString('ar-LY')} د.ل`
                  }
                </span>
              </>
            )}
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" onClick={handleAutoFillDates} className="text-xs">
              <Calendar className="h-3 w-3 mr-1" />
              ملء التواريخ
            </Button>
            <Button size="sm" variant="outline" onClick={handleDistributeEvenly} className="text-xs">
              <Calculator className="h-3 w-3 mr-1" />
              توزيع متساوي
            </Button>
            {!isValid && difference > 0 && (
              <Button 
                size="sm" 
                variant="outline" 
                onClick={handleFillRemaining}
                className="text-xs border-amber-500/50 text-amber-600 hover:bg-amber-500/10"
              >
                إضافة المتبقي لآخر دفعة
              </Button>
            )}
          </div>

          {/* Payments List */}
          <div className="space-y-2">
            {payments.map((payment, index) => (
              <div 
                key={index} 
                className={cn(
                  "p-3 rounded-lg border-2 space-y-2",
                  index === 0 
                    ? "bg-purple-500/5 border-purple-500/30" 
                    : "bg-card border-border"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                      index === 0 
                        ? "bg-purple-500 text-white" 
                        : "bg-muted text-muted-foreground"
                    )}>
                      {index + 1}
                    </div>
                    <Input
                      type="text"
                      value={payment.description}
                      onChange={(e) => handlePaymentChange(index, 'description', e.target.value)}
                      className="h-7 text-xs border-0 bg-transparent p-0 font-medium focus-visible:ring-0"
                      placeholder="وصف الدفعة"
                    />
                  </div>
                  {payments.length > 1 && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setPayments(payments.filter((_, i) => i !== index))}
                      className="h-6 w-6 p-0 text-destructive hover:text-destructive/80"
                    >
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  )}
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">المبلغ</label>
                    <Input
                      type="number"
                      step="0.01"
                      min="0"
                      value={payment.amount || ''}
                      onChange={(e) => handlePaymentChange(index, 'amount', e.target.value)}
                      placeholder="0.00"
                      className="h-9 font-bold text-left"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] text-muted-foreground">التاريخ</label>
                    <Input
                      type="date"
                      value={payment.dueDate}
                      onChange={(e) => handlePaymentChange(index, 'dueDate', e.target.value)}
                      className="h-9"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Add Payment */}
          {payments.length < 12 && (
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setPayments([...payments, {
                  amount: 0,
                  dueDate: '',
                  description: `الدفعة ${payments.length + 1}`,
                  paymentType: 'شهري'
                }]);
              }}
              className="w-full border-dashed"
              size="sm"
            >
              <Plus className="h-4 w-4 mr-1" />
              إضافة دفعة
            </Button>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-border bg-muted/30 flex gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="flex-1"
          >
            إلغاء
          </Button>
          <Button
            onClick={handleApply}
            disabled={!isValid}
            className="flex-1 bg-gradient-to-r from-purple-500 to-purple-600 hover:from-purple-600 hover:to-purple-700"
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            تطبيق
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
