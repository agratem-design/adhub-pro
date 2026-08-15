import { useMemo, useEffect } from 'react';
import { getPriceFor, getDailyPriceFor, CustomerType } from '@/data/pricing';
import type { Billboard } from '@/types';
import type { ContractFormData } from './useContractForm';

interface UseContractCalculationsProps {
  formData: ContractFormData;
  selected: string[];
  billboards: Billboard[];
  userEditedRentCost: boolean;
  installationCost: number;
  installationEnabled?: boolean;
  pricingData: any[];
  getPriceFromDatabase: (size: string, level: any, customer: string, months: number) => number | null;
  getDailyPriceFromDatabase: (size: string, level: any, customer: string) => number | null;
  onRentCostChange: (cost: number) => void;
}

export const useContractCalculations = ({
  formData,
  selected,
  billboards,
  userEditedRentCost,
  installationCost,
  installationEnabled = true,
  pricingData,
  getPriceFromDatabase,
  getDailyPriceFromDatabase,
  onRentCostChange
}: UseContractCalculationsProps) => {
  
  // Calculate estimated total based on selected billboards and pricing
  const estimatedTotal = useMemo(() => {
    const sel = billboards.filter((b) => selected.includes(String((b as any).ID)));
    
    if (formData.pricingMode === 'months') {
      const months = Math.max(0, Number(formData.durationMonths || 0));
      if (!months) return 0;
      
      return sel.reduce((acc, b) => {
        const size = (b.size || (b as any).Size || '') as string;
        const level = ((b as any).level || (b as any).Level) as any;
        
        // Try database first
        let price = getPriceFromDatabase(size, level, formData.pricingCategory, months);
        
        // Fallback to static pricing if not found in database
        if (price === null) {
          price = getPriceFor(size, level, formData.pricingCategory as CustomerType, months);
        }
        
        if (price !== null) return acc + price;
        
        // Final fallback to billboard price
        const monthly = Number((b as any).price) || 0;
        return acc + monthly * months;
      }, 0);
    } else {
      const days = Math.max(0, Number(formData.durationDays || 0));
      if (!days) return 0;
      
      return sel.reduce((acc, b) => {
        const size = (b.size || (b as any).Size || '') as string;
        const level = ((b as any).level || (b as any).Level) as any;
        
        // Try database first
        let daily = getDailyPriceFromDatabase(size, level, formData.pricingCategory);
        
        // Fallback to static pricing if not found in database
        if (daily === null) {
          daily = getDailyPriceFor(size, level, formData.pricingCategory as CustomerType);
        }
        
        // If still null, calculate from monthly price
        if (daily === null) {
          let monthlyPrice = getPriceFromDatabase(size, level, formData.pricingCategory, 1);
          if (monthlyPrice === null) {
            monthlyPrice = getPriceFor(size, level, formData.pricingCategory as CustomerType, 1) || 0;
          }
          daily = monthlyPrice ? Math.round((monthlyPrice / 30) * 100) / 100 : 0;
        }
        
        return acc + (daily || 0) * days;
      }, 0);
    }
  }, [billboards, selected, formData.durationMonths, formData.durationDays, formData.pricingMode, formData.pricingCategory, pricingData]);

  // Auto update rent cost with new estimation unless user manually edited it
  useEffect(() => {
    if (!userEditedRentCost) {
      onRentCostChange(estimatedTotal);
    }
  }, [estimatedTotal, userEditedRentCost, onRentCostChange]);

  // Calculate base total (الإجمالي الكامل شامل التركيب)
  const baseTotal = useMemo(() => (
    formData.rentCost && formData.rentCost > 0 ? formData.rentCost : estimatedTotal
  ), [formData.rentCost, estimatedTotal]);

  // Calculate actual installation cost
  const actualInstallationCost = useMemo(() => installationEnabled ? installationCost : 0, [installationEnabled, installationCost]);

  // ✅ صافي الإيجار قبل الخصم = الإجمالي - التركيب
  const rentalBeforeDiscount = useMemo(() => Math.max(0, baseTotal - actualInstallationCost), [baseTotal, actualInstallationCost]);

  // ✅ الخصم يُحسب من صافي الإيجار (بدون التركيب)
  const discountAmount = useMemo(() => {
    if (!formData.discountValue) return 0;
    return formData.discountType === 'percent'
      ? (rentalBeforeDiscount * Math.max(0, Math.min(100, formData.discountValue)) / 100)
      : Math.max(0, formData.discountValue);
  }, [formData.discountType, formData.discountValue, rentalBeforeDiscount]);

  // ✅ صافي الإيجار بعد الخصم = صافي الإيجار - الخصم
  const rentalCostOnly = useMemo(() => Math.max(0, rentalBeforeDiscount - discountAmount), [rentalBeforeDiscount, discountAmount]);

  // الإجمالي بعد الخصم (للتوافق مع العرض القديم)
  const totalAfterDiscount = useMemo(() => rentalCostOnly + actualInstallationCost, [rentalCostOnly, actualInstallationCost]);

  // الإجمالي النهائي = صافي الإيجار + التركيب
  const finalTotal = useMemo(() => rentalCostOnly + actualInstallationCost, [rentalCostOnly, actualInstallationCost]);

  // Calculate operating fee based on contract flags
  const operatingFee = useMemo(() => {
    let baseForFee = rentalCostOnly;
    // Note: in this hook we don't have includeOperatingInInstallation/Print flags
    // The fee is calculated from rentalCostOnly by default (installation not included)
    if (!installationEnabled) {
      baseForFee = totalAfterDiscount;
    }
    return Math.round(baseForFee * (formData.operatingFeeRate / 100) * 100) / 100;
  }, [installationEnabled, totalAfterDiscount, rentalCostOnly, formData.operatingFeeRate]);

  return {
    estimatedTotal,
    baseTotal,
    discountAmount,
    totalAfterDiscount,
    rentalCostOnly,
    finalTotal,
    operatingFee
  };
};