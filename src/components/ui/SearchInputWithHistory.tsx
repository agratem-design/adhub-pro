import * as React from "react";
import { Clock, Trash2, X, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface SearchInputWithHistoryProps
  extends React.ComponentProps<"input"> {
  historyKey: string;
}

export const SearchInputWithHistory = React.forwardRef<
  HTMLInputElement,
  SearchInputWithHistoryProps
>(({ className, historyKey, value, onChange, onKeyDown, onBlur, onFocus, ...props }, ref) => {
  const [history, setHistory] = React.useState<string[]>([]);
  const [isOpen, setIsOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useImperativeHandle(ref, () => inputRef.current!);

  // Load history from localStorage
  React.useEffect(() => {
    try {
      const stored = localStorage.getItem(`search_history_${historyKey}`);
      if (stored) {
        setHistory(JSON.parse(stored));
      }
    } catch (e) {
      console.error("Error reading search history from localStorage:", e);
    }
  }, [historyKey]);

  // Save query to history
  const saveQuery = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed || trimmed.length < 2) return;

    setHistory((prev) => {
      // Remove if already exists (case-insensitive)
      const filtered = prev.filter((item) => item.toLowerCase() !== trimmed.toLowerCase());
      // Insert at front
      const next = [trimmed, ...filtered].slice(0, 5);
      localStorage.setItem(`search_history_${historyKey}`, JSON.stringify(next));
      return next;
    });
  };

  const handleDeleteItem = (e: React.MouseEvent, itemToDelete: string) => {
    e.stopPropagation();
    e.preventDefault();
    setHistory((prev) => {
      const next = prev.filter((item) => item !== itemToDelete);
      localStorage.setItem(`search_history_${historyKey}`, JSON.stringify(next));
      return next;
    });
  };

  const handleClearAll = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setHistory([]);
    localStorage.removeItem(`search_history_${historyKey}`);
  };

  const handleSelectQuery = (query: string) => {
    if (inputRef.current) {
      const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
        HTMLInputElement.prototype,
        "value"
      )?.set;
      if (nativeInputValueSetter) {
        nativeInputValueSetter.call(inputRef.current, query);
        const event = new Event("change", { bubbles: true });
        inputRef.current.dispatchEvent(event);
      } else {
        inputRef.current.value = query;
        if (onChange) {
          const event = {
            target: inputRef.current,
            currentTarget: inputRef.current,
          } as any;
          onChange(event);
        }
      }
    }
    saveQuery(query);
    setIsOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const val = inputRef.current?.value || "";
      saveQuery(val);
      setIsOpen(false);
    }
    if (onKeyDown) {
      onKeyDown(e);
    }
  };

  // Close dropdown on click outside
  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const showDropdown = isOpen && history.length > 0;

  return (
    <div ref={containerRef} className="relative w-full" dir="rtl">
      <Input
        ref={inputRef}
        value={value}
        onChange={onChange}
        onKeyDown={handleKeyDown}
        onFocus={(e) => {
          setIsOpen(true);
          if (onFocus) onFocus(e);
        }}
        onBlur={(e) => {
          const val = e.target.value;
          // Defer save and close to let click handlers on history options execute first
          setTimeout(() => {
            if (document.activeElement !== inputRef.current) {
              saveQuery(val);
              setIsOpen(false);
            }
          }, 250);
          if (onBlur) onBlur(e);
        }}
        className={cn("w-full pl-10 pr-10", className)}
        {...props}
      />
      {showDropdown && (
        <div className="absolute top-[calc(100%+4px)] right-0 left-0 z-50 overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-2xl backdrop-blur-md bg-opacity-95 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center justify-between px-3.5 py-2 border-b border-border/40 bg-muted/30">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-primary animate-pulse" />
              عمليات البحث الأخيرة
            </span>
            <button
              onClick={handleClearAll}
              className="text-[10px] font-bold text-destructive hover:underline flex items-center gap-1 cursor-pointer bg-transparent border-0"
            >
              <Trash2 className="h-3 w-3" />
              مسح الكل
            </button>
          </div>
          <div className="py-1 max-h-[220px] overflow-y-auto">
            {history.map((item, idx) => (
              <div
                key={`${item}-${idx}`}
                onClick={() => handleSelectQuery(item)}
                className="flex items-center justify-between px-3.5 py-2 hover:bg-accent hover:text-accent-foreground text-sm cursor-pointer select-none group transition-colors duration-150"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Search className="h-3.5 w-3.5 opacity-40 shrink-0" />
                  <span className="truncate font-medium">{item}</span>
                </div>
                <button
                  onClick={(e) => handleDeleteItem(e, item)}
                  className="p-1 rounded-md opacity-0 group-hover:opacity-100 hover:bg-muted text-muted-foreground hover:text-foreground transition-all duration-150 bg-transparent border-0 cursor-pointer"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
});

SearchInputWithHistory.displayName = "SearchInputWithHistory";
