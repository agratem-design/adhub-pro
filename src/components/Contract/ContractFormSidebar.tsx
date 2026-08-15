import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Calendar } from 'lucide-react';
import { CustomerSelector } from './CustomerSelector';
import { InstallmentManager } from './InstallmentManager';
import { CostCalculator } from './CostCalculator';
import type { ContractFormData, Installment } from '@/hooks/useContractForm';

interface ContractFormSidebarProps {
  formData: ContractFormData;
  updateFormData: (updates: Partial<ContractFormData>) => void;
  pricingCategories: string[];
  installments: Installment[];
  setInstallments: (installments: Installment[]) => void;
  updateInstallment: (index: number, field: string, value: any) => void;
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
  onSubmit: () => void;
  onCancel: () => void;
  saving?: boolean;
  submitLabel?: string;
  showOriginalTotal?: boolean;
  originalTotal?: number;
  currentContract?: any;
  distributeEvenly: (count: number) => void;
  addInstallment: () => void;
  removeInstallment: (index: number) => void;
  clearAllInstallments: () => void;
  calculateDueDate: (paymentType: string, index: number) => string;
}

export const ContractFormSidebar: React.FC<ContractFormSidebarProps> = ({
  formData,
  updateFormData,
  pricingCategories,
  installments,
  setInstallments,
  updateInstallment,
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
  onSubmit,
  onCancel,
  saving = false,
  submitLabel = 'إنشاء العقد',
  showOriginalTotal = false,
  originalTotal = 0,
  currentContract,
  distributeEvenly,
  addInstallment,
  removeInstallment,
  clearAllInstallments,
  calculateDueDate
}) => {
  return (
    <div className="w-full lg:w-[360px] space-y-4">
      {/* Customer Info */}
      <Card className="card-elegant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-5 w-5 text-primary" />
            بيانات الزبون
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <CustomerSelector
            customerName={formData.customerName}
            customerId={formData.customerId}
            onCustomerChange={(name, id) => updateFormData({ customerName: name, customerId: id })}
          />
          
          <div>
            <label className="form-label">نوع الإعلان</label>
            <Input 
              value={formData.adType} 
              onChange={(e) => updateFormData({ adType: e.target.value })} 
            />
          </div>
          
          <div>
            <label className="form-label">فئة السعر</label>
            <Select 
              value={formData.pricingCategory} 
              onValueChange={(v) => updateFormData({ pricingCategory: v })}
            >
              <SelectTrigger className="input-primary">
                <SelectValue placeholder="الفئة" />
              </SelectTrigger>
              <SelectContent>
                {pricingCategories.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-xs text-primary mt-1">
              الفئة المحددة: <span className="font-medium text-primary">{formData.pricingCategory}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Duration and Dates */}
      <Card className="card-elegant">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-primary" />
            المدة والتواريخ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="form-label">تاريخ البداية</label>
            <Input 
              type="date" 
              value={formData.startDate} 
              onChange={(e) => updateFormData({ startDate: e.target.value })} 
            />
          </div>
          
          <div>
            <label className="form-label">نظام الإيجار</label>
            <Select 
              value={formData.pricingMode} 
              onValueChange={(v) => updateFormData({ pricingMode: v as 'months' | 'days' })}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر نظام الإيجار" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="months">شهري</SelectItem>
                <SelectItem value="days">يومي</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          {formData.pricingMode === 'months' ? (
            <div>
              <label className="form-label">عدد الأشهر</label>
              <Select 
                value={String(formData.durationMonths)} 
                onValueChange={(v) => updateFormData({ durationMonths: Number(v) })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر عدد الأشهر" />
                </SelectTrigger>
                <SelectContent>
                  {[1, 2, 3, 6, 12].map((m) => (
                    <SelectItem key={m} value={String(m)}>
                      {m} {m === 1 ? 'شهر' : 'أشهر'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div>
              <label className="form-label">عدد الأيام</label>
              <Input 
                type="number" 
                min={1} 
                value={formData.durationDays} 
                onChange={(e) => updateFormData({ durationDays: Number(e.target.value) || 0 })} 
                placeholder="أدخل عدد الأيام"
              />
            </div>
          )}
          
          <div>
            <label className="form-label">تاريخ النهاية</label>
            <Input type="date" value={formData.endDate} readOnly disabled />
          </div>
        </CardContent>
      </Card>

      {/* Installment Manager */}
      <InstallmentManager
        installments={installments}
        setInstallments={setInstallments}
        updateInstallment={updateInstallment}
        finalTotal={finalTotal}
        distributeEvenly={distributeEvenly}
        addInstallment={addInstallment}
        removeInstallment={removeInstallment}
        clearAllInstallments={clearAllInstallments}
        calculateDueDate={calculateDueDate}
      />

      {/* Cost Calculator */}
      <CostCalculator
        formData={formData}
        updateFormData={updateFormData}
        estimatedTotal={estimatedTotal}
        baseTotal={baseTotal}
        discountAmount={discountAmount}
        totalAfterDiscount={totalAfterDiscount}
        rentalCostOnly={rentalCostOnly}
        finalTotal={finalTotal}
        operatingFee={operatingFee}
        installationCost={installationCost}
        userEditedRentCost={userEditedRentCost}
        setUserEditedRentCost={setUserEditedRentCost}
        showOriginalTotal={showOriginalTotal}
        originalTotal={originalTotal}
        currentContract={currentContract}
      />

      {/* Action Buttons */}
      <div className="space-y-2">
        <Button className="w-full btn-primary" onClick={onSubmit} disabled={saving}>
          {saving ? 'جاري الحفظ...' : submitLabel}
        </Button>
        <Button variant="outline" className="w-full" onClick={onCancel}>
          إلغاء
        </Button>
      </div>
    </div>
  );
};