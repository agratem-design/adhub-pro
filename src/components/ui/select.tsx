import * as React from "react";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp, Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import './menu-surfaces.css';

const Select = SelectPrimitive.Root;

const SelectGroup = SelectPrimitive.Group;

const SelectValue = SelectPrimitive.Value;

const SelectTrigger = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Trigger>
>(({ className, children, ...props }, ref) => (
  <SelectPrimitive.Trigger
    ref={ref}
    className={cn(
      "group flex h-11 w-full cursor-pointer items-center justify-between gap-3 rounded-lg border border-input bg-background px-3 py-2 text-sm font-medium text-foreground ring-offset-background transition-colors hover:border-primary/60 data-[placeholder]:text-muted-foreground data-[state=open]:border-primary focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 [&>span]:line-clamp-1 [&>span]:text-start",
      className,
    )}
    {...props}
  >
    {children}
    <SelectPrimitive.Icon asChild>
      <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground motion-safe:transition-transform group-data-[state=open]:rotate-180" />
    </SelectPrimitive.Icon>
  </SelectPrimitive.Trigger>
));
SelectTrigger.displayName = SelectPrimitive.Trigger.displayName;

const SelectScrollUpButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollUpButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollUpButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollUpButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronUp className="h-4 w-4" />
  </SelectPrimitive.ScrollUpButton>
));
SelectScrollUpButton.displayName = SelectPrimitive.ScrollUpButton.displayName;

const SelectScrollDownButton = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.ScrollDownButton>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.ScrollDownButton>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.ScrollDownButton
    ref={ref}
    className={cn("flex cursor-default items-center justify-center py-1", className)}
    {...props}
  >
    <ChevronDown className="h-4 w-4" />
  </SelectPrimitive.ScrollDownButton>
));
SelectScrollDownButton.displayName = SelectPrimitive.ScrollDownButton.displayName;

// Context to share search query with SelectItem children
const SelectSearchContext = React.createContext<string>("");

interface SelectContentProps extends React.ComponentPropsWithoutRef<typeof SelectPrimitive.Content> {
  searchable?: boolean;
}

const SelectContent = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Content>,
  SelectContentProps
>(({ className, children, position = "popper", searchable, ...props }, ref) => {
  const [searchQuery, setSearchQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const viewportRef = React.useRef<HTMLDivElement>(null);

  // Count SelectItem children (flatten arrays)
  const itemCount = React.useMemo(() => {
    let count = 0;
    const countItems = (ch: React.ReactNode) => {
      React.Children.forEach(ch, (child) => {
        if (!React.isValidElement(child)) return;
        // Check if it's a SelectItem by checking for value prop
        if (child.props?.value !== undefined) {
          count++;
        }
        if (child.props?.children) {
          countItems(child.props.children);
        }
      });
    };
    countItems(children);
    return count;
  }, [children]);

  const showSearch = searchable !== undefined ? searchable : itemCount >= 6;

  // Focus input on open
  React.useEffect(() => {
    if (showSearch) {
      const timer = setTimeout(() => inputRef.current?.focus(), 100);
      return () => clearTimeout(timer);
    }
  }, [showSearch]);

  // Count visible items after filtering
  const [visibleCount, setVisibleCount] = React.useState(itemCount);

  React.useEffect(() => {
    if (!showSearch || !searchQuery.trim()) {
      setVisibleCount(itemCount);
      return;
    }
    // Use requestAnimationFrame to count visible items after DOM update
    requestAnimationFrame(() => {
      if (viewportRef.current) {
        const items = viewportRef.current.querySelectorAll('[role="option"]');
        let visible = 0;
        items.forEach((item) => {
          if (!(item as HTMLElement).hidden) visible++;
        });
        setVisibleCount(visible);
      }
    });
  }, [searchQuery, showSearch, itemCount]);

  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        ref={ref}
        className={cn(
          "app-menu-surface max-w-[calc(100vw-1rem)] max-h-[min(24rem,var(--radix-select-content-available-height))]",
          "relative z-50 max-h-96 min-w-[8rem] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2",
          position === "popper" &&
            "data-[side=bottom]:translate-y-1 data-[side=left]:-translate-x-1 data-[side=right]:translate-x-1 data-[side=top]:-translate-y-1",
          className,
        )}
        position={position}
        {...props}
        // Prevent Radix typeahead from interfering with search input
        onKeyDown={(e) => {
          if (showSearch) {
            // Allow typing in search field
            const target = e.target as HTMLElement;
            if (target.tagName === 'INPUT') {
              e.stopPropagation();
            }
          }
          props.onKeyDown?.(e);
        }}
      >
        {showSearch && (
          <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-border bg-muted/40 px-3 focus-within:ring-1 focus-within:ring-inset focus-within:ring-primary/50">
            <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
            <input
              ref={inputRef}
              placeholder="ابحث..."
              aria-label="البحث في الخيارات"
              value={searchQuery}
              className="flex h-11 min-w-0 w-full bg-transparent py-2 text-base text-foreground outline-none placeholder:text-muted-foreground"
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                // Stop all keyboard events from propagating to Select
                e.stopPropagation();
                // Allow Escape to close
                if (e.key === 'Escape') {
                  // Let it propagate to close the select
                }
              }}
              // Prevent the select from stealing focus
              onFocus={(e) => e.stopPropagation()}
            />
            {searchQuery && (
              <button
                type="button"
                aria-label="مسح البحث"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setSearchQuery("");
                  inputRef.current?.focus();
                }}
                className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <X className="h-3 w-3 opacity-50" />
              </button>
            )}
          </div>
        )}
        <SelectScrollUpButton />
        <SelectPrimitive.Viewport
          ref={viewportRef}
          className={cn(
            "p-1.5",
            position === "popper" &&
              "h-[var(--radix-select-trigger-height)] w-full min-w-[var(--radix-select-trigger-width)]",
          )}
        >
          <SelectSearchContext.Provider value={searchQuery.toLowerCase().trim()}>
            {children}
          </SelectSearchContext.Provider>
          {showSearch && searchQuery && visibleCount === 0 && (
            <div className="py-4 text-center text-sm text-muted-foreground">
              لا توجد نتائج لـ "{searchQuery}"
            </div>
          )}
        </SelectPrimitive.Viewport>
        <SelectScrollDownButton />
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
});
SelectContent.displayName = SelectPrimitive.Content.displayName;

const SelectLabel = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Label>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Label>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Label ref={ref} className={cn("py-1.5 pl-8 pr-2 text-sm font-semibold", className)} {...props} />
));
SelectLabel.displayName = SelectPrimitive.Label.displayName;

// Helper to extract text from React children recursively
function extractText(children: React.ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (Array.isArray(children)) return children.map(extractText).join(" ");
  if (React.isValidElement(children)) return extractText(children.props?.children);
  return "";
}

const SelectItem = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Item>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Item>
>(({ className, children, ...props }, ref) => {
  const searchQuery = React.useContext(SelectSearchContext);
  
  // Determine if this item matches the search
  const itemText = React.useMemo(() => {
    const text = extractText(children).toLowerCase();
    const valueText = props.value ? props.value.toLowerCase() : "";
    return text + " " + valueText;
  }, [children, props.value]);

  const isMatch = !searchQuery || itemText.includes(searchQuery);

  // Use hidden attribute + display:none for non-matching items
  // This keeps them in DOM for Radix but hides them visually
  if (!isMatch) {
    return (
      <SelectPrimitive.Item
        ref={ref}
        className="!p-0 !m-0 !h-0 !min-h-0 !overflow-hidden !border-0 !opacity-0 !pointer-events-none !absolute"
        style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}
        aria-hidden="true"
        hidden
        {...props}
      >
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
      </SelectPrimitive.Item>
    );
  }

  return (
    <SelectPrimitive.Item
      ref={ref}
      className={cn(
        "relative flex w-full cursor-default select-none items-center rounded-sm py-1.5 pl-8 pr-2 text-sm outline-none data-[disabled]:pointer-events-none data-[disabled]:opacity-50 focus:bg-accent focus:text-accent-foreground",
        className,
      )}
      {...props}
    >
      <span className="absolute left-2 flex h-3.5 w-3.5 items-center justify-center">
        <SelectPrimitive.ItemIndicator>
          <Check className="h-4 w-4" />
        </SelectPrimitive.ItemIndicator>
      </span>

      <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
    </SelectPrimitive.Item>
  );
});
SelectItem.displayName = SelectPrimitive.Item.displayName;

const SelectSeparator = React.forwardRef<
  React.ElementRef<typeof SelectPrimitive.Separator>,
  React.ComponentPropsWithoutRef<typeof SelectPrimitive.Separator>
>(({ className, ...props }, ref) => (
  <SelectPrimitive.Separator ref={ref} className={cn("-mx-1 my-1 h-px bg-muted", className)} {...props} />
));
SelectSeparator.displayName = SelectPrimitive.Separator.displayName;

export {
  Select,
  SelectGroup,
  SelectValue,
  SelectTrigger,
  SelectContent,
  SelectLabel,
  SelectItem,
  SelectSeparator,
  SelectScrollUpButton,
  SelectScrollDownButton,
};
