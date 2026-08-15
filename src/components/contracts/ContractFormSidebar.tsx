import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Calendar as CalendarIcon, DollarSign } from 'lucide-react';
import { CustomerSelector } from './CustomerSelector';
import { InstallmentsManager } from './edit/InstallmentsManager';
import { CostCalculator } from './CostCalculator';
import type { ContractFormData, Installment } from '@/hooks/useContractForm';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar as CustomCalendar } from '@/components/ui/calendar';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

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
  use30DayMonth?: boolean;
  setUse30DayMonth?: (v: boolean) => void;
  currencySymbol?: string;

  // New Installment Settings Props
  onDistributeWithInterval?: (config: any) => void;
  onDistributeByDurationPeriods?: (count: number) => void;
  onCreateManualInstallments?: (count: number) => void;
  onApplyUnequalDistribution?: (payments: any[]) => void;
  installmentSummary?: string | null;
  savedDistributionType?: 'single' | 'multiple' | 'periods';
  savedFirstPaymentAmount?: number;
  savedFirstPaymentType?: 'amount' | 'percent';
  savedInterval?: 'month' | '2months' | '3months' | '4months' | '5months' | '6months' | '7months';
  savedCount?: number;
  savedHasDifferentFirstPayment?: boolean;
  savedFirstAtSigning?: boolean;
  onDistributionTypeChange?: (type: 'single' | 'multiple' | 'periods') => void;
  onFirstPaymentAmountChange?: (amount: number) => void;
  onFirstPaymentTypeChange?: (type: 'amount' | 'percent') => void;
  onIntervalChange?: (interval: 'month' | '2months' | '3months' | '4months' | '5months' | '6months' | '7months') => void;
  onCountChange?: (count: number) => void;
  onHasDifferentFirstPaymentChange?: (has: boolean) => void;
  onFirstAtSigningChange?: (value: boolean) => void;
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
  calculateDueDate,
  use30DayMonth = true,
  setUse30DayMonth,
  currencySymbol,
  onDistributeWithInterval,
  onDistributeByDurationPeriods,
  onCreateManualInstallments,
  onApplyUnequalDistribution,
  installmentSummary,
  savedDistributionType,
  savedFirstPaymentAmount,
  savedFirstPaymentType,
  savedInterval,
  savedCount,
  savedHasDifferentFirstPayment,
  savedFirstAtSigning,
  onDistributionTypeChange,
  onFirstPaymentAmountChange,
  onFirstPaymentTypeChange,
  onIntervalChange,
  onCountChange,
  onHasDifferentFirstPaymentChange,
  onFirstAtSigningChange,
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
            <CalendarIcon className="h-5 w-5 text-primary" />
            المدة والتواريخ
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1.5">
            <label className="form-label">تاريخ البداية</label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  type="button"
                  className={cn(
                    "w-full h-10 justify-start text-right font-medium rounded-xl border-2 border-border hover:border-primary/50 bg-background text-foreground hover:bg-accent/5 transition-all shadow-sm",
                    !formData.startDate && "text-muted-foreground"
                  )}
                >
                  <CalendarIcon className="ml-2 h-4 w-4 text-primary dark:text-white shrink-0" />
                  {formData.startDate ? format(new Date(formData.startDate), "dd MMMM yyyy", { locale: ar }) : "اختر التاريخ"}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0 border-2 border-border shadow-xl z-[10000]" align="start">
                <CustomCalendar
                  mode="single"
                  selected={formData.startDate ? new Date(formData.startDate) : undefined}
                  onSelect={(date) => updateFormData({ startDate: date ? format(date, 'yyyy-MM-dd') : '' })}
                  locale={ar}
                  className="rounded-xl pointer-events-auto"
                />
              </PopoverContent>
            </Popover>
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

          {formData.pricingMode === 'months' && setUse30DayMonth && (
            <div className="flex items-center gap-2 p-2 rounded-lg bg-accent/30 border border-accent/40">
              <input
                type="checkbox"
                id="use30DayMonth"
                checked={use30DayMonth}
                onChange={(e) => setUse30DayMonth(e.target.checked)}
                className="h-4 w-4 accent-primary cursor-pointer"
              />
              <label htmlFor="use30DayMonth" className="text-xs font-medium cursor-pointer text-foreground">
                حساب الشهر = 30 يوم (افتراضي)
              </label>
            </div>
          )}

          <div>
            <label className="form-label">تاريخ النهاية</label>
            <Input type="date" value={formData.endDate} readOnly disabled />
          </div>
        </CardContent>
      </Card>

      {/* Installment Manager */}
      <InstallmentsManager
        installments={installments}
        finalTotal={finalTotal}
        startDate={formData.startDate}
        endDate={formData.endDate}
        onDistributeEvenly={distributeEvenly}
        onDistributeWithInterval={onDistributeWithInterval}
        onDistributeByDurationPeriods={onDistributeByDurationPeriods}
        onCreateManualInstallments={onCreateManualInstallments}
        onApplyUnequalDistribution={onApplyUnequalDistribution}
        onAddInstallment={addInstallment}
        onRemoveInstallment={removeInstallment}
        onUpdateInstallment={updateInstallment}
        onClearAll={clearAllInstallments}
        installmentSummary={installmentSummary}
        savedDistributionType={savedDistributionType}
        savedFirstPaymentAmount={savedFirstPaymentAmount}
        savedFirstPaymentType={savedFirstPaymentType}
        savedInterval={savedInterval}
        savedCount={savedCount}
        savedHasDifferentFirstPayment={savedHasDifferentFirstPayment}
        savedFirstAtSigning={savedFirstAtSigning}
        onDistributionTypeChange={onDistributionTypeChange}
        onFirstPaymentAmountChange={onFirstPaymentAmountChange}
        onFirstPaymentTypeChange={onFirstPaymentTypeChange}
        onIntervalChange={onIntervalChange}
        onCountChange={onCountChange}
        onHasDifferentFirstPaymentChange={onHasDifferentFirstPaymentChange}
        onFirstAtSigningChange={onFirstAtSigningChange}
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