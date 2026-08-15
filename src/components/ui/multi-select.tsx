import * as React from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';

export type Option = { label: string; value: string };

interface MultiSelectProps {
  options: Option[];
  value: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  className?: string;
  emptyText?: string;
  icon?: React.ReactNode;
  maxDisplay?: number;
}

export function MultiSelect({
  options,
  value,
  onChange,
  placeholder = 'اختر...',
  className,
  emptyText = 'لا توجد نتائج',
  icon,
  maxDisplay = 2,
}: MultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const selectedLabels = React.useMemo(() => {
    if (!value?.length) return null;
    return options.filter(o => value.includes(o.value)).map(o => o.label);
  }, [options, value]);

  const toggle = (val: string) => {
    const exists = value.includes(val);
    onChange(exists ? value.filter(v => v !== val) : [...value, val]);
  };

  const clearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange([]);
  };

  const hasSelection = value.length > 0;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            'w-full justify-between gap-1 font-normal',
            hasSelection && 'border-primary/50 bg-primary/5',
            className
          )}
        >
          <div className="flex items-center gap-1.5 flex-1 min-w-0">
            {icon && <span className="shrink-0 text-primary">{icon}</span>}
            {!hasSelection ? (
              <span className="truncate text-muted-foreground">{placeholder}</span>
            ) : (
              <div className="flex items-center gap-1 min-w-0 flex-1">
                {selectedLabels && selectedLabels.length <= maxDisplay ? (
                  <span className="truncate text-foreground text-[11px]">{selectedLabels.join('، ')}</span>
                ) : (
                  <Badge variant="secondary" className="h-4 px-1.5 text-[10px] font-semibold shrink-0">
                    {value.length} محدد
                  </Badge>
                )}
              </div>
            )}
          </div>
          <div className="flex items-center gap-0.5 shrink-0">
            {hasSelection && (
              <span
                role="button"
                onClick={clearAll}
                className="rounded-full p-0.5 hover:bg-destructive/20 transition-colors"
              >
                <X className="h-3 w-3 text-muted-foreground hover:text-destructive" />
              </span>
            )}
            <ChevronsUpDown className="h-3.5 w-3.5 opacity-40" />
          </div>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-[--radix-popover-trigger-width] min-w-[200px] p-0 bg-popover border-border shadow-xl z-[10000]"
        align="start"
        dir="rtl"
      >
        <Command dir="rtl">
          <CommandInput placeholder="ابحث..." className="text-xs text-right" dir="rtl" />
          <CommandList className="max-h-[250px]" dir="rtl">
            <CommandEmpty className="py-4 text-xs text-center text-muted-foreground">{emptyText}</CommandEmpty>
            <CommandGroup dir="rtl">
              {/* Select all / clear all */}
              {options.length > 1 && (
                <CommandItem
                  onSelect={() => {
                    if (value.length === options.length) {
                      onChange([]);
                    } else {
                      onChange(options.map(o => o.value));
                    }
                  }}
                  className="text-xs font-semibold border-b border-border/30 mb-1 flex items-center justify-between"
                  dir="rtl"
                >
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      'flex h-4 w-4 items-center justify-center rounded-sm border shrink-0',
                      value.length === options.length ? 'bg-primary text-primary-foreground border-primary' : 'border-muted-foreground/30'
                    )}>
                      {value.length === options.length && <Check className="h-3 w-3" />}
                    </div>
                    <span>{value.length === options.length ? 'إلغاء تحديد الكل' : 'تحديد الكل'}</span>
                  </div>
                  {value.length > 0 && value.length < options.length && (
                    <span className="text-[10px] text-muted-foreground font-manrope">{value.length}/{options.length}</span>
                  )}
                </CommandItem>
              )}
              {options.map((option) => {
                const checked = value.includes(option.value);
                return (
                  <CommandItem
                    key={option.value}
                    value={option.label}
                    onSelect={() => toggle(option.value)}
                    className="text-xs flex items-center gap-2"
                    dir="rtl"
                  >
                    <div className={cn(
                      'flex h-4 w-4 items-center justify-center rounded-sm border shrink-0',
                      checked ? 'bg-primary text-primary-foreground border-primary' : 'border-muted-foreground/30'
                    )}>
                      {checked && <Check className="h-3 w-3" />}
                    </div>
                    <span className="truncate">{option.label}</span>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export default MultiSelect;
