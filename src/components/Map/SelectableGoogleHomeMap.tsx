import { useCallback, useMemo } from 'react';
import type { Billboard } from '@/types';
import GoogleHomeMap from './GoogleHomeMap';

/**
 * خريطة الاختيار (العقود، العروض، عقود المناسبات).
 * لم تعد خريطة مستقلة: تستخدم الخريطة الموحدة GoogleHomeMap بنفس الشكل والأدوات،
 * وتضيف فقط زر الإضافة/الإزالة وسعر اللوحة في بطاقة الدبوس.
 */
interface SelectableGoogleHomeMapProps {
  billboards: Billboard[];
  selectedBillboards?: Set<string>;
  onToggleSelection?: (billboardId: string) => void;
  onSelectMultiple?: (billboardIds: string[]) => void;
  onSelectAll?: () => void;
  onClearAll?: () => void;
  className?: string;
  pricingMode?: 'months' | 'days';
  durationMonths?: number;
  durationDays?: number;
  pricingCategory?: string;
  calculateBillboardPrice?: (billboard: Billboard) => number;
  hideInternalFilters?: boolean;
  billboardPricingResults?: Map<string, any>;
  occupiedBillboardsMap?: Map<number, { endDate: string; customerName: string; contractNumber: string }>;
  /** اسم الكيان في أزرار الإضافة/الإزالة (العقد، العرض...) */
  entityLabel?: string;
}

const idOf = (b: Billboard) => String((b as any).ID ?? (b as any).id ?? '');

export default function SelectableGoogleHomeMap({
  billboards,
  selectedBillboards,
  onToggleSelection,
  onSelectMultiple,
  className,
  pricingMode,
  durationMonths,
  durationDays,
  calculateBillboardPrice,
  entityLabel = 'العقد',
}: SelectableGoogleHomeMapProps) {
  const selectable = Boolean(onToggleSelection || onSelectMultiple);
  const selectedNumeric = useMemo(
    () => new Set([...(selectedBillboards || new Set<string>())].map(Number).filter(n => Number.isFinite(n))),
    [selectedBillboards],
  );

  const periodLabel = pricingMode === 'days' ? `${durationDays || 0} يوم` : `${durationMonths || 0} شهر`;

  const handleSelectionChange = useCallback((next: Set<number>) => {
    const current = new Set([...(selectedBillboards || new Set<string>())].map(String));
    const nextIds = new Set([...next].map(String));
    const added = [...nextIds].filter(id => !current.has(id));
    const removed = [...current].filter(id => !nextIds.has(id));
    if (added.length > 0) {
      if (added.length > 1 && onSelectMultiple) onSelectMultiple(added);
      else added.forEach(id => onToggleSelection?.(id));
    }
    // الإزالة الجماعية من الخريطة تُتجاهل حمايةً من مسح لوحات العقد بالخطأ؛ الإزالة تكون لوحة لوحة
    if (removed.length === 1 && added.length === 0) onToggleSelection?.(removed[0]);
  }, [selectedBillboards, onSelectMultiple, onToggleSelection]);

  const selectionActions = useMemo(() => selectable ? {
    isSelected: (b: Billboard) => Boolean(selectedBillboards?.has(idOf(b))),
    onToggle: (b: Billboard) => onToggleSelection?.(idOf(b)),
    priceLabel: calculateBillboardPrice
      ? (b: Billboard) => {
          const v = Number(calculateBillboardPrice(b) || 0);
          return v > 0 ? `${v.toLocaleString('ar-LY')} د.ل · ${periodLabel}` : null;
        }
      : undefined,
    addLabel: `إضافة إلى ${entityLabel}`,
    removeLabel: `إزالة من ${entityLabel}`,
  } : undefined, [selectable, selectedBillboards, onToggleSelection, calculateBillboardPrice, periodLabel, entityLabel]);

  return (
    <GoogleHomeMap
      billboards={billboards}
      className={className}
      externalSelectedIds={selectable ? selectedNumeric : undefined}
      onSelectionChange={selectable ? handleSelectionChange : undefined}
      selectionActions={selectionActions}
      allowLocationEdit={false}
    />
  );
}
