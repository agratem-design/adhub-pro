import React from 'react';
import { AlertCircle, CalendarPlus, Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { addCalendarDays } from '@/services/billboardAvailabilityService';
import { calculateDaysBetween } from '@/utils/contractBillboardCalculations';

export type CompensationChoices = Record<string, { enabled: boolean; contractNumber: number }>;

export function readPrices(raw: unknown): any[] {
  try {
    const value = typeof raw === 'string' ? JSON.parse(raw) : raw;
    return Array.isArray(value) ? value : [];
  } catch {
    return [];
  }
}

export function withCompensation(prices: any[], choices: CompensationChoices, saved?: unknown) {
  const previous = readPrices(saved);
  return prices.map(p => {
    const old = previous.find(x => String(x.billboardId) === String(p.billboardId));
    const choice = choices[String(p.billboardId)];
    return {
      ...p,
      compensateOriginal: choice?.enabled ?? old?.compensateOriginal ?? false,
      originalContractNumber: choice?.contractNumber ?? old?.originalContractNumber ?? null,
    };
  });
}

export function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function isContractDateExpired(
  endDate?: string | null,
  contractStatus?: string | null,
  isExplicitExpired?: boolean
): boolean {
  if (isExplicitExpired === true) return true;
  if (contractStatus) {
    const s = String(contractStatus).trim().toLowerCase();
    if (['منتهي', 'ملغي', 'expired', 'cancelled'].includes(s)) {
      return true;
    }
  }
  if (!endDate) return false;
  const endClean = String(endDate).trim().slice(0, 10);
  if (!endClean || endClean.length < 10) return false;
  return endClean < getTodayString();
}

export interface CompensationRow {
  b: any;
  id: string;
  source: string | number;
  old: any;
  eligible: boolean;
}

export function getEligibleCompensationRows({
  billboards,
  startDate,
  endDate,
  contractNumber,
  contractStatus,
  isExpired,
  savedPrices,
}: {
  billboards: any[];
  startDate: string;
  endDate: string;
  contractNumber?: string | number;
  contractStatus?: string;
  isExpired?: boolean;
  savedPrices?: unknown;
}): CompensationRow[] {
  if (isContractDateExpired(endDate, contractStatus, isExpired)) {
    return [];
  }
  if (!startDate || !endDate) return [];
  const todayStr = getTodayString();
  const saved = readPrices(savedPrices);

  return billboards
    .map(b => {
      const id = String(b.ID ?? b.id);
      const old = saved.find(p => String(p.billboardId) === id);
      const source = old?.originalContractNumber || b.Contract_Number;
      const sourceRentalActive = b.Rent_End_Date ? b.Rent_End_Date.slice(0, 10) >= todayStr : false;
      const eligible = Boolean(
        old?.compensateOriginal ||
          (source &&
            String(source) !== String(contractNumber ?? '') &&
            sourceRentalActive &&
            b.Rent_End_Date?.slice(0, 10) >= startDate &&
            (!b.Rent_Start_Date || b.Rent_Start_Date.slice(0, 10) <= endDate))
      );
      return { b, id, source, old, eligible };
    })
    .filter(r => r.eligible);
}

export function RentalCompensationDialog({
  open,
  onOpenChange,
  billboards,
  startDate,
  endDate,
  contractNumber,
  contractStatus,
  isExpired,
  choices,
  onChange,
  savedPrices,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billboards: any[];
  startDate: string;
  endDate: string;
  contractNumber?: string | number;
  contractStatus?: string;
  isExpired?: boolean;
  choices: CompensationChoices;
  onChange: (value: CompensationChoices) => void;
  savedPrices?: unknown;
}) {
  const rows = getEligibleCompensationRows({
    billboards,
    startDate,
    endDate,
    contractNumber,
    contractStatus,
    isExpired,
    savedPrices,
  });

  const days = calculateDaysBetween(startDate, endDate);

  if (!rows.length || !days) return null;

  const enabledCount = rows.filter(
    ({ id, old }) => choices[id]?.enabled ?? old?.compensateOriginal ?? false
  ).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-lg p-6 bg-card border border-border shadow-2xl rounded-2xl">
        <DialogHeader className="space-y-2 text-right">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
            <AlertCircle className="h-5 w-5 text-primary shrink-0" />
            استعانة بلوحات مؤجرة — تعويض العقد الأصلي
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground leading-relaxed">
            يمكن تمديد اللوحة في عقدها الأصلي بمدة هذا العقد ({days} يوم)، دون زيادة قيمته المالية. ينطبق على جميع أنواع العقود.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto space-y-2.5 py-2">
          {rows.map(({ b, id, source, old }) => {
            const isChecked = choices[id]?.enabled ?? old?.compensateOriginal ?? false;
            return (
              <label
                key={id}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3.5 transition-all duration-200 ${
                  isChecked
                    ? 'border-primary bg-primary/5 shadow-xs'
                    : 'border-border bg-background hover:border-primary/50'
                }`}
              >
                <Checkbox
                  checked={isChecked}
                  onCheckedChange={checked =>
                    onChange({
                      ...choices,
                      [id]: { enabled: checked === true, contractNumber: Number(source) },
                    })
                  }
                  className="mt-1"
                />
                <div className="flex-1 text-sm space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      {b.Billboard_Name || id}
                    </span>
                    <span className="text-xs text-muted-foreground font-medium">
                      العقد #{source}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground leading-normal">
                    {old?.compensateOriginal
                      ? 'التعويض محفوظ؛ تعديل المدة يحدّث فرق الأيام فقط.'
                      : `إضافة ${days} يوم${
                          b.Rent_End_Date
                            ? `؛ الانتهاء المتوقع: ${addCalendarDays(b.Rent_End_Date.slice(0, 10), days)}`
                            : ''
                        }`}
                  </p>
                </div>
              </label>
            );
          })}
        </div>

        <DialogFooter className="flex flex-row-reverse justify-between items-center gap-2 pt-3 border-t border-border">
          <Button
            type="button"
            onClick={() => onOpenChange(false)}
            className="cursor-pointer transition-all duration-200"
          >
            <Check className="h-4 w-4 ml-1.5" />
            تم الحفظ
          </Button>
          <span className="text-xs text-muted-foreground font-medium">
            تم تحديد {enabledCount} من أصل {rows.length} لوحة
          </span>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RentalCompensationAlert({
  billboards,
  startDate,
  endDate,
  contractNumber,
  contractStatus,
  isExpired,
  choices,
  onChange,
  savedPrices,
}: {
  billboards: any[];
  startDate: string;
  endDate: string;
  contractNumber?: string | number;
  contractStatus?: string;
  isExpired?: boolean;
  choices: CompensationChoices;
  onChange: (value: CompensationChoices) => void;
  savedPrices?: unknown;
}) {
  const rows = getEligibleCompensationRows({
    billboards,
    startDate,
    endDate,
    contractNumber,
    contractStatus,
    isExpired,
    savedPrices,
  });

  const days = calculateDaysBetween(startDate, endDate);
  if (!rows.length || !days) return null;

  return (
    <div role="alert" dir="rtl" className="space-y-3 rounded-xl border border-primary/40 bg-primary/10 p-4">
      <p className="flex items-center gap-2 font-semibold">
        <AlertCircle className="h-5 w-5 text-primary shrink-0" />
        استعانة بلوحات مؤجرة — تعويض العقد الأصلي
      </p>
      <p className="text-sm text-muted-foreground">
        يمكن تمديد اللوحة في عقدها الأصلي بمدة هذا العقد ({days} يوم)، دون زيادة قيمته المالية. ينطبق على جميع أنواع العقود.
      </p>
      {rows.map(({ b, id, source, old }) => (
        <label
          key={id}
          className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-background p-3 transition-all duration-200 hover:border-primary"
        >
          <Checkbox
            checked={choices[id]?.enabled ?? old?.compensateOriginal ?? false}
            onCheckedChange={checked =>
              onChange({
                ...choices,
                [id]: { enabled: checked === true, contractNumber: Number(source) },
              })
            }
          />
          <span className="text-sm">
            <span className="font-semibold">
              {b.Billboard_Name || id} — العقد #{source}
            </span>
            <br />
            {old?.compensateOriginal
              ? 'التعويض محفوظ؛ تعديل المدة يحدّث فرق الأيام فقط.'
              : `إضافة ${days} يوم${
                  b.Rent_End_Date
                    ? `؛ الانتهاء المتوقع ${addCalendarDays(b.Rent_End_Date.slice(0, 10), days)}`
                    : ''
                }`}
          </span>
        </label>
      ))}
    </div>
  );
}
