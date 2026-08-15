import * as React from "react";
import { cn } from "@/lib/utils";
import { Slider } from "@/components/ui/slider";
import { Minus, Plus } from "lucide-react";

interface NumberInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange' | 'value'> {
  value: number | string | undefined;
  onChange: (value: number) => void;
  locale?: string;
  showSlider?: boolean;
  sliderMin?: number;
  sliderMax?: number;
  sliderStep?: number;
  showButtons?: boolean;
  buttonStep?: number;
}

const formatWithCommas = (val: string): string => {
  // Remove non-numeric chars except minus and dot
  const cleaned = val.replace(/[^\d.\-]/g, '');
  const parts = cleaned.split('.');
  const intPart = parts[0] || '';
  // Add thousand separators
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (parts.length > 1) {
    return `${formatted}.${parts[1]}`;
  }
  return formatted;
};

const NumberInput = React.forwardRef<HTMLInputElement, NumberInputProps>(
  ({ className, value, onChange, locale, showSlider, sliderMin = 0, sliderMax = 100, sliderStep = 1, showButtons = true, buttonStep = 1, ...props }, ref) => {
    const [displayValue, setDisplayValue] = React.useState('');

    const numValue = React.useMemo(() => {
      const n = Number(value);
      return isNaN(n) ? 0 : n;
    }, [value]);

    React.useEffect(() => {
      const num = Number(value);
      if (!isNaN(num) && num !== 0) {
        setDisplayValue(formatWithCommas(String(num)));
      } else if (value === 0 || value === '0') {
        setDisplayValue('0');
      } else if (!value && value !== 0) {
        setDisplayValue('');
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw === '' || raw === '-') {
        setDisplayValue(raw);
        onChange(0);
        return;
      }
      const numStr = raw.replace(/,/g, '');
      if (numStr.endsWith('.') || numStr === '-') {
        setDisplayValue(formatWithCommas(numStr) + (numStr.endsWith('.') ? '.' : ''));
        return;
      }
      const num = parseFloat(numStr);
      if (!isNaN(num)) {
        setDisplayValue(formatWithCommas(numStr));
        onChange(num);
      }
    };

    const increment = () => onChange(numValue + buttonStep);
    const decrement = () => onChange(numValue - buttonStep);

    return (
      <div className="space-y-1.5">
        <div className="flex items-center gap-1">
          {showButtons && (
            <button
              type="button"
              onClick={decrement}
              className="flex items-center justify-center h-10 w-8 rounded-md border border-input bg-background hover:bg-accent text-muted-foreground transition-colors"
              tabIndex={-1}
            >
              <Minus className="h-3.5 w-3.5" />
            </button>
          )}
          <input
            ref={ref}
            type="text"
            inputMode="decimal"
            className={cn(
              "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-base ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
              className
            )}
            value={displayValue}
            onChange={handleChange}
            {...props}
          />
          {showButtons && (
            <button
              type="button"
              onClick={increment}
              className="flex items-center justify-center h-10 w-8 rounded-md border border-input bg-background hover:bg-accent text-muted-foreground transition-colors"
              tabIndex={-1}
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
        {showSlider && (
          <Slider
            value={[Math.min(sliderMax, Math.max(sliderMin, numValue))]}
            onValueChange={([v]) => onChange(v)}
            min={sliderMin}
            max={sliderMax}
            step={sliderStep}
            className="w-full"
          />
        )}
      </div>
    );
  }
);
NumberInput.displayName = "NumberInput";

export { NumberInput };
