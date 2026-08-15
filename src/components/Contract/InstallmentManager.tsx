import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { DollarSign, Calculator, Plus as PlusIcon, Trash2, RefreshCw } from 'lucide-react';
import type { Installment } from '@/hooks/useContractForm';

interface InstallmentManagerProps {
  installments: Installment[];
  setInstallments: (installments: Installment[]) => void;
  updateInstallment: (index: number, field: string, value: any) => void;
  finalTotal: number;
  distributeEvenly: (count: number) => void;
  addInstallment: () => void;
  removeInstallment: (index: number) => void;
  clearAllInstallments: () => void;
  calculateDueDate: (paymentType: string, index: number) => string;
}

export const InstallmentManager: React.FC<InstallmentManagerProps> = ({
  installments,
  setInstallments,
  updateInstallment,
  finalTotal,
  distributeEvenly,
  addInstallment,
  removeInstallment,
  clearAllInstallments,
  calculateDueDate
}) => {
  return (
    <Card className="card-elegant border-green">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <DollarSign className="h-5 w-5 text-primary" />
          نظام الدفعات الديناميكي
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Quick Actions */}
        <div className="flex flex-wrap gap-2">
          <Input
            type="number"
            min={1}
            max={6}
            placeholder="عدد الدفعات"
            className="w-32"
            onChange={(e) => {
              const count = parseInt(e.target.value || '1');
              if (count > 0) distributeEvenly(count);
            }}
          />
          <Button 
            type="button" 
            variant="outline" 
            onClick={() => distributeEvenly(2)} 
            className="gap-2"
          >
            <Calculator className="h-4 w-4" />
            دفعتين
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={addInstallment}
            className="gap-2"
          >
            <PlusIcon className="h-4 w-4" />
            إضافة دفعة
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={clearAllInstallments}
            className="gap-2 text-red-600 hover:text-red-700"
          >
            <RefreshCw className="h-4 w-4" />
            مسح الكل
          </Button>
        </div>
        
        {/* Installments List */}
        <div className="space-y-3">
          {installments.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              لا توجد دفعات. استخدم الأزرار أعلاه لإضافة دفعات.
            </div>
          ) : (
            installments.map((inst, idx) => (
              <div key={idx} className="border rounded-lg p-3 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="font-medium">الدفعة {idx + 1}</span>
                  <Button 
                    type="button" 
                    variant="ghost" 
                    size="sm"
                    onClick={() => removeInstallment(idx)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
                
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground">المبلغ (د.ل)</label>
                    <Input
                      type="number"
                      value={inst.amount}
                      onChange={(e) => updateInstallment(idx, 'amount', Number(e.target.value || 0))}
                      className="text-sm"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground">نوع الدفع</label>
                    <Select
                      value={inst.paymentType}
                      onValueChange={(v) => updateInstallment(idx, 'paymentType', v)}
                    >
                      <SelectTrigger className="text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="عند التوقيع">عند التوقيع</SelectItem>
                        <SelectItem value="عند التركيب">عند التركيب</SelectItem>
                        <SelectItem value="شهري">شهري</SelectItem>
                        <SelectItem value="شهرين">كل شهرين</SelectItem>
                        <SelectItem value="ثلاثة أشهر">كل ثلاثة أشهر</SelectItem>
                        <SelectItem value="نهاية العقد">نهاية العقد</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                
                <div>
                  <label className="text-xs text-muted-foreground">الوصف</label>
                  <Input
                    value={inst.description}
                    onChange={(e) => updateInstallment(idx, 'description', e.target.value)}
                    placeholder="وصف الدفعة"
                    className="text-sm"
                  />
                </div>
                
                <div>
                  <label className="text-xs text-muted-foreground">تاريخ الاستحقاق</label>
                  <Input
                    type="date"
                    value={inst.dueDate}
                    onChange={(e) => updateInstallment(idx, 'dueDate', e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
            ))
          )}
        </div>
        
        {/* Summary */}
        {installments.length > 0 && (
          <div className="border-t pt-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span>إجمالي الدفعات:</span>
              <span className="font-medium">
                {installments.reduce((sum, inst) => sum + inst.amount, 0).toLocaleString('en-US')} د.ل
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span>إجمالي العقد:</span>
              <span className="font-bold text-primary">{finalTotal.toLocaleString('en-US')} د.ل</span>
            </div>
            {Math.abs(installments.reduce((sum, inst) => sum + inst.amount, 0) - finalTotal) > 1 && (
              <div className="text-xs text-red-600 font-medium bg-red-50 p-2 rounded">
                تحذير: مجموع الدفعات ({installments.reduce((sum, inst) => sum + inst.amount, 0).toLocaleString('en-US')} د.ل) لا يساوي إجمالي العقد ({finalTotal.toLocaleString('en-US')} د.ل)
              </div>
            )}
            {Math.abs(installments.reduce((sum, inst) => sum + inst.amount, 0) - finalTotal) <= 1 && (
              <div className="text-xs text-green-600 font-medium bg-green-50 p-2 rounded">
                صحيح: مجموع الدفعات يطابق إجمالي العقد
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
