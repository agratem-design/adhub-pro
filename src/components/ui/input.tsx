import * as React from "react";
import { Minus, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const formatWithCommas = (val: string): string => {
  const cleaned = val.replace(/[^\d.\-]/g, '');
  const parts = cleaned.split('.');
  const intPart = parts[0] || '';
  const formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  if (parts.length > 1) {
    return `${formatted}.${parts[1]}`;
  }
  return formatted;
};

const NumberInputInner = React.forwardRef<HTMLInputElement, React.ComponentProps<"input"> & { step?: string | number }>(
  ({ className, onChange, value, type, step, ...props }, ref) => {
    const [displayVal, setDisplayVal] = React.useState(() => {
      const num = Number(value);
      if (value === '' || value === undefined || value === null) return '';
      if (!isNaN(num)) return formatWithCommas(String(value));
      return String(value);
    });

    const internalRef = React.useRef<HTMLInputElement>(null);
    React.useImperativeHandle(ref, () => internalRef.current!);

    React.useEffect(() => {
      if (document.activeElement !== internalRef.current) {
        const num = Number(value);
        if (value === '' || value === undefined || value === null) {
          setDisplayVal('');
        } else if (!isNaN(num)) {
          setDisplayVal(formatWithCommas(String(value)));
        }
      }
    }, [value]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value;
      if (raw === '' || raw === '-') {
        setDisplayVal(raw);
        if (onChange) {
          const syntheticEvent = { ...e, target: { ...e.target, value: raw === '-' ? '-' : '' } };
          onChange(syntheticEvent as React.ChangeEvent<HTMLInputElement>);
        }
        return;
      }
      const numStr = raw.replace(/,/g, '');
      if (numStr.endsWith('.')) {
        setDisplayVal(formatWithCommas(numStr) + '.');
        return;
      }
      const num = parseFloat(numStr);
      if (!isNaN(num) || numStr === '') {
        setDisplayVal(formatWithCommas(numStr));
        if (onChange) {
          const syntheticEvent = { ...e, target: { ...e.target, value: numStr } };
          onChange(syntheticEvent as React.ChangeEvent<HTMLInputElement>);
        }
      }
    };

    const stepVal = Number(step) || 1;

    // Use a ref to always have the latest value for long-press
    const latestValueRef = React.useRef<number>(0);
    React.useEffect(() => {
      latestValueRef.current = parseFloat(String(value)?.replace(/,/g, '') || '0') || 0;
    }, [value]);

    const fireChange = (nextStr: string) => {
      setDisplayVal(formatWithCommas(nextStr));
      if (onChange && internalRef.current) {
        const nativeEvent = new Event('input', { bubbles: true });
        Object.defineProperty(nativeEvent, 'target', { value: { ...internalRef.current, value: nextStr } });
        onChange(nativeEvent as unknown as React.ChangeEvent<HTMLInputElement>);
      }
    };

    const adjustValue = (delta: number) => {
      const current = latestValueRef.current;
      const next = Math.round((current + delta) * 100) / 100;
      latestValueRef.current = next;
      fireChange(String(next));
    };

    // Long-press: start slow, accelerate
    const holdTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const holdActiveRef = React.useRef(false);

    const stopHold = React.useCallback(() => {
      holdActiveRef.current = false;
      if (holdTimerRef.current) { clearTimeout(holdTimerRef.current); holdTimerRef.current = null; }
    }, []);

    React.useEffect(() => () => stopHold(), [stopHold]);

    const startHold = (delta: number) => {
      stopHold();
      holdActiveRef.current = true;
      adjustValue(delta);
      let count = 0;
      const tick = () => {
        if (!holdActiveRef.current) return;
        adjustValue(delta);
        count++;
        const delay = count > 15 ? 40 : count > 5 ? 100 : 250;
        holdTimerRef.current = setTimeout(tick, delay);
      };
      holdTimerRef.current = setTimeout(tick, 350);
    };

    return (
      <div className="flex items-center gap-1">
        <button
          type="button"
          onMouseDown={() => startHold(-stepVal)}
          onMouseUp={stopHold}
          onMouseLeave={stopHold}
          onTouchStart={() => startHold(-stepVal)}
          onTouchEnd={stopHold}
          className="flex items-center justify-center h-8.5 sm:h-10 w-7 sm:w-8 shrink-0 rounded-md border border-input bg-background hover:bg-accent text-muted-foreground transition-colors select-none"
          tabIndex={-1}
        >
          <Minus className="h-3.5 w-3.5" />
        </button>
        <input
          type="text"
          inputMode="decimal"
          className={cn(
            "flex h-8.5 sm:h-10 w-full rounded-md border border-input bg-background px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          ref={internalRef}
          value={displayVal}
          onChange={handleChange}
          {...props}
        />
        <button
          type="button"
          onMouseDown={() => startHold(stepVal)}
          onMouseUp={stopHold}
          onMouseLeave={stopHold}
          onTouchStart={() => startHold(stepVal)}
          onTouchEnd={stopHold}
          className="flex items-center justify-center h-8.5 sm:h-10 w-7 sm:w-8 shrink-0 rounded-md border border-input bg-background hover:bg-accent text-muted-foreground transition-colors select-none"
          tabIndex={-1}
        >
          <Plus className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  },
);
NumberInputInner.displayName = "NumberInputInner";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    if (type === "number") {
      return <NumberInputInner className={className} ref={ref} type={type} {...props} />;
    }

    return (
      <input
        type={type}
        className={cn(
          "flex h-8.5 sm:h-10 w-full rounded-md border border-input bg-background px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50",
          type === "color" && "p-1 cursor-pointer",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
