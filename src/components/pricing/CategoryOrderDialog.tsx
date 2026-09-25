import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowUp, ArrowDown, ArrowUpDown, RotateCcw, Check, Sparkles, Building2 } from 'lucide-react';
import { DEFAULT_PRIMARY_CUSTOMERS } from '@/utils/pricingCategoryOrder';

interface CategoryOrderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  categories: string[];
  onSaveOrder: (newOrder: string[]) => Promise<void>;
}

export function CategoryOrderDialog({
  open,
  onOpenChange,
  categories,
  onSaveOrder,
}: CategoryOrderDialogProps) {
  const [items, setItems] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      setItems([...categories]);
      setSearchTerm('');
    }
  }, [open, categories]);

  const moveItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= items.length) return;

    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.splice(targetIndex, 0, moved);
    setItems(next);
  };

  const moveToTop = (index: number) => {
    if (index === 0) return;
    const next = [...items];
    const [moved] = next.splice(index, 1);
    next.unshift(moved);
    setItems(next);
  };

  const handleRankChange = (currentIndex: number, newRankStr: string) => {
    const targetRank = parseInt(newRankStr, 10);
    if (isNaN(targetRank) || targetRank < 1 || targetRank > items.length) return;
    const targetIndex = targetRank - 1;
    if (targetIndex === currentIndex) return;

    const next = [...items];
    const [moved] = next.splice(currentIndex, 1);
    next.splice(targetIndex, 0, moved);
    setItems(next);
  };

  const resetToDefault = () => {
    const primary = DEFAULT_PRIMARY_CUSTOMERS.filter(c => items.includes(c));
    const others = items.filter(c => !DEFAULT_PRIMARY_CUSTOMERS.includes(c)).sort();
    setItems([...primary, ...others]);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveOrder(items);
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  const filteredItems = items
    .map((name, index) => ({ name, originalIndex: index }))
    .filter(item => item.name.includes(searchTerm.trim()));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl flex flex-col max-h-[90dvh] [&_button]:cursor-pointer">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <ArrowUpDown className="h-5 w-5 text-primary" />
            ترتيب فئات العملاء
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            حدد ترتيب ظهور فئات العملاء في قائمة الأسعار والشاشات والتصدير. تظهر فئة الشركات في المرتبة الأولى افتراضياً.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1 flex-1 overflow-hidden flex flex-col min-h-0">
          <div className="flex items-center justify-between gap-3">
            <Input
              placeholder="البحث في الفئات..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="h-9 max-w-xs"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={resetToDefault}
              className="gap-1.5 h-9 text-xs"
              title="إعادة الترتيب القياسي مع الشركات أولاً"
            >
              <RotateCcw className="h-3.5 w-3.5 text-muted-foreground" />
              <span>الشركات أولاً (افتراضي)</span>
            </Button>
          </div>

          <div className="rounded-xl border border-border overflow-y-auto max-h-[50vh] divide-y divide-border">
            {filteredItems.map(({ name, originalIndex }) => {
              const rank = originalIndex + 1;
              const isCompany = name === 'شركات';
              const isFirst = originalIndex === 0;
              const isLast = originalIndex === items.length - 1;

              return (
                <div
                  key={name}
                  className={`flex items-center justify-between p-3 gap-2 transition-colors ${
                    isCompany ? 'bg-primary/5' : 'hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-muted text-xs font-bold tabular-nums">
                      {rank}
                    </span>
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-bold text-sm truncate">{name}</span>
                      {isCompany && (
                        <span className="inline-flex items-center gap-1 rounded-md bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary border border-primary/20">
                          <Building2 className="h-3 w-3" />
                          <span>الأساسية الأولى</span>
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0">
                    <div className="flex items-center gap-1 ml-2">
                      <span className="text-[11px] text-muted-foreground">الرقم:</span>
                      <Input
                        type="number"
                        min={1}
                        max={items.length}
                        value={rank}
                        onChange={e => handleRankChange(originalIndex, e.target.value)}
                        className="h-7 w-14 text-center text-xs p-1 tabular-nums font-bold"
                      />
                    </div>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={isFirst}
                      onClick={() => moveItem(originalIndex, 'up')}
                      className="h-8 w-8"
                      title="تحريك لأعلى"
                      aria-label={`تحريك فئة ${name} لأعلى`}
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>

                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      disabled={isLast}
                      onClick={() => moveItem(originalIndex, 'down')}
                      className="h-8 w-8"
                      title="تحريك لأسفل"
                      aria-label={`تحريك فئة ${name} لأسفل`}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>

                    {!isFirst && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => moveToTop(originalIndex)}
                        className="h-8 px-2 text-xs"
                        title="نقل إلى المرتبة الأولى"
                      >
                        <Sparkles className="h-3 w-3 text-primary ml-1" />
                        <span>للأعلى</span>
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <p className="text-xs text-muted-foreground">
            إجمالي الفئات: {items.length} فئة. سيتم اعتماد هذا الترتيب في شريط فئات الأسعار والتصدير.
          </p>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 pt-2 border-t border-border">
          <Button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className="gap-1.5 font-bold cursor-pointer"
          >
            <Check className="h-4 w-4" />
            <span>{saving ? 'جارٍ الحفظ...' : 'حفظ الترتيب'}</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={saving}
            onClick={() => onOpenChange(false)}
            className="cursor-pointer"
          >
            إلغاء
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
