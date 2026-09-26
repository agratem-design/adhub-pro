import { useState, useRef, useEffect, KeyboardEvent, ChangeEvent } from 'react';
import { Input } from '@/components/ui/input';
import { formatPriceWithCommas, formatPriceInputWithCursor, parsePriceInput } from '@/utils/priceInputParser';
import { toast } from 'sonner';

interface PriceFormattedInputProps {
  initialValue: number | null;
  onCommit: (val: number | null) => void;
  onCancel: () => void;
  className?: string;
  placeholder?: string;
  'aria-label'?: string;
  autoFocus?: boolean;
}

export function PriceFormattedInput({
  initialValue,
  onCommit,
  onCancel,
  className,
  placeholder = '0',
  'aria-label': ariaLabel,
  autoFocus = true,
}: PriceFormattedInputProps) {
  const [value, setValue] = useState(() => formatPriceWithCommas(initialValue));
  const inputRef = useRef<HTMLInputElement>(null);
  const isCommittedRef = useRef(false);

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [autoFocus]);

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const target = e.target;
    const oldCursor = target.selectionStart ?? target.value.length;
    const { formatted, newCursor } = formatPriceInputWithCursor(target.value, oldCursor);
    setValue(formatted);
    requestAnimationFrame(() => {
      if (inputRef.current) {
        inputRef.current.setSelectionRange(newCursor, newCursor);
      }
    });
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      isCommittedRef.current = true;
      onCancel();
    } else if (e.key === 'Backspace') {
      const input = e.currentTarget;
      const start = input.selectionStart;
      const end = input.selectionEnd;
      // إذا كان المؤشر مباشرة بعد فاصلة الآلاف، نقوم بحذف الرقم الذي يسبقها
      if (start === end && start !== null && start > 1 && input.value[start - 1] === ',') {
        e.preventDefault();
        const before = input.value.slice(0, start - 2);
        const after = input.value.slice(start);
        const { formatted, newCursor } = formatPriceInputWithCursor(before + after, start - 2);
        setValue(formatted);
        requestAnimationFrame(() => {
          if (inputRef.current) {
            inputRef.current.setSelectionRange(newCursor, newCursor);
          }
        });
      }
    }
  };

  const commit = () => {
    if (isCommittedRef.current) return;
    isCommittedRef.current = true;

    const parsed = parsePriceInput(value);
    if (!parsed.isValid) {
      toast.error('أدخل سعراً صحيحاً غير سالب');
      onCancel();
      return;
    }
    onCommit(parsed.value);
  };

  return (
    <Input
      ref={inputRef}
      type="text"
      inputMode="numeric"
      dir="ltr"
      value={value}
      onChange={handleChange}
      onKeyDown={handleKeyDown}
      onBlur={commit}
      placeholder={placeholder}
      aria-label={ariaLabel}
      className={className || "h-10 text-base font-bold tabular-nums text-center"}
    />
  );
}
