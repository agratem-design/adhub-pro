import { memo, useState } from 'react';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { DollarSign, ChevronDown } from 'lucide-react';
import type { DistributableItem } from './types';

interface ItemCardProps {
  item: DistributableItem;
  index: number;
  onSelect: (id: string | number, selected: boolean, type?: DistributableItem['type']) => void;
  onAmountChange: (id: string | number, value: string, type?: DistributableItem['type']) => void;
  remainingToAllocate: number;
}

export const ItemCard = memo(({ item, index, onSelect, onAmountChange, remainingToAllocate }: ItemCardProps) => {
  const [expanded, setExpanded] = useState(false);
  const paymentPercent = item.totalAmount > 0 ? (item.paidAmount / item.totalAmount) * 100 : 0;
  const maxAllowed = Math.max(0, Math.min(item.remainingAmount, remainingToAllocate + item.allocatedAmount));
  const poolFull = maxAllowed <= 0;

  return (
    <div className={`rounded-lg border transition-all duration-200 overflow-hidden ${
      item.selected 
        ? 'border-primary bg-primary/5 ring-1 ring-primary/20' 
        : 'border-border/50 hover:border-primary/30 hover:bg-accent/10'
    }`}>
      {/* Compact row - always visible */}
      <div className="flex items-center gap-2 p-2.5 cursor-pointer" onClick={() => !item.selected && setExpanded(!expanded)}>
        <div className={`flex items-center justify-center w-6 h-6 rounded-lg text-xs font-bold shrink-0 ${
          item.selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
        }`}>
          {index + 1}
        </div>
        <Checkbox
          aria-label={`تحديد ${item.displayName}`}
          checked={item.selected}
          onCheckedChange={(checked) => onSelect(item.id, checked as boolean, item.type)}
          className="h-4 w-4 shrink-0"
          onClick={(e) => e.stopPropagation()}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm truncate">{item.displayName}</span>
            {item.adType && <Badge variant="outline" className="text-[10px] h-4 shrink-0">{item.adType}</Badge>}
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0 text-xs">
          <span className="text-red-500 font-bold">{item.remainingAmount.toLocaleString('ar-LY', { maximumFractionDigits: 2 })}</span>
          <span className="text-muted-foreground">/</span>
          <span className="text-muted-foreground">{item.totalAmount.toLocaleString('ar-LY', { maximumFractionDigits: 2 })}</span>
          {!item.selected && (
            <ChevronDown className={`h-3.5 w-3.5 text-muted-foreground transition-transform ${expanded ? 'rotate-180' : ''}`} />
          )}
        </div>
      </div>

      {/* Progress bar - compact */}
      <div className="px-2.5 pb-1">
        <div className="h-1 bg-accent/50 rounded-full overflow-hidden">
          <div 
            className={`h-full rounded-full transition-all duration-500 ${
              paymentPercent >= 100 ? "bg-green-500" : paymentPercent >= 50 ? "bg-blue-500" : "bg-amber-500"
            }`}
            style={{ width: `${Math.min(paymentPercent, 100)}%` }}
          />
        </div>
      </div>

      {/* Expanded details - only when clicked and not selected */}
      {expanded && !item.selected && (
        <div className="px-2.5 pb-2.5 pt-1 border-t border-border/30">
          <div className="grid grid-cols-3 gap-1.5 text-xs">
            <div className="text-center p-1.5 rounded bg-accent/30">
              <span className="text-muted-foreground block text-[10px]">الإجمالي</span>
              <span className="font-bold">{item.totalAmount.toLocaleString('ar-LY', { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="text-center p-1.5 rounded bg-green-500/10">
              <span className="text-muted-foreground block text-[10px]">المدفوع</span>
              <span className="font-bold text-green-500">{item.paidAmount.toLocaleString('ar-LY', { maximumFractionDigits: 2 })}</span>
            </div>
            <div className="text-center p-1.5 rounded bg-red-500/10">
              <span className="text-muted-foreground block text-[10px]">المتبقي</span>
              <span className="font-bold text-red-500">{item.remainingAmount.toLocaleString('ar-LY', { maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        </div>
      )}

      {/* Amount input - only when selected */}
      {item.selected && (
        <div className="px-2.5 pb-2.5 pt-1 border-t border-primary/20 bg-primary/5">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Input
                aria-label={`مبلغ السداد لـ ${item.displayName}`}
                type="number"
                step="0.01"
                min="0"
                max={maxAllowed}
                value={item.allocatedAmount || ''}
                onChange={(e) => onAmountChange(item.id, e.target.value, item.type)}
                placeholder="0.00"
                disabled={poolFull && item.allocatedAmount === 0}
                className="text-right text-sm font-semibold h-9 pr-3 pl-9 bg-background/80 disabled:opacity-60"
                title={poolFull ? 'تم بلوغ سقف الدفعة' : undefined}
              />
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] text-muted-foreground">د.ل</span>
            </div>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                onAmountChange(item.id, String(maxAllowed), item.type);
              }}
              disabled={poolFull && item.allocatedAmount === 0}
              className="whitespace-nowrap h-9 px-3 text-xs bg-primary/10 border-primary/30 hover:bg-primary/20 text-primary"
            >
              كامل
            </Button>
          </div>
          {poolFull && item.allocatedAmount === 0 && (
            <div className="mt-1 text-[10px] text-red-600 font-semibold">
 تم بلوغ سقف الدفعة — لا يمكن إضافة قيمة
            </div>
          )}
          {item.allocatedAmount > 0 && (
            <div className="flex items-center gap-1.5 mt-1.5 text-xs">
              <span className="text-muted-foreground">بعد الدفع:</span>
              <span className={`font-bold ${item.remainingAmount - item.allocatedAmount <= 0 ? "text-green-500" : "text-amber-500"}`}>
                {(item.remainingAmount - item.allocatedAmount).toFixed(2)} د.ل
              </span>
              {item.remainingAmount - item.allocatedAmount <= 0 && (
                <Badge className="bg-green-500/20 text-green-500 border-0 text-[10px] h-4">مسدد</Badge>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
});
