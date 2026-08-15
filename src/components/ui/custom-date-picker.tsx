import * as React from "react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Calendar as CalendarIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";

interface CustomDatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
}

export function CustomDatePicker({
  value,
  onChange,
  placeholder = "اختر التاريخ",
  className,
  disabled = false,
}: CustomDatePickerProps) {
  const [open, setOpen] = React.useState(false);

  const handleSelect = (date: Date | undefined) => {
    if (date) {
      onChange(format(date, "yyyy-MM-dd"));
      setOpen(false);
    }
  };

  const selectedDate = value ? new Date(value) : undefined;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full h-10 justify-start text-right font-medium rounded-lg border-2 border-border hover:border-primary/50 bg-background transition-all duration-200",
            !value && "text-muted-foreground",
            "hover:bg-accent/5",
            className
          )}
        >
          <CalendarIcon className="ml-2 h-4 w-4 text-primary dark:text-white shrink-0" />
          <span className="truncate">
            {value
              ? format(new Date(value), "dd MMMM yyyy", { locale: ar })
              : placeholder}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent
        className="w-auto p-0 border-2 border-border shadow-2xl bg-popover z-[10000]"
        align="start"
        sideOffset={4}
      >
        <div className="p-1">
          <Calendar
            mode="single"
            selected={selectedDate}
            onSelect={handleSelect}
            locale={ar}
            className="rounded-lg pointer-events-auto"
          />
          <div className="p-2 border-t border-border flex justify-between gap-2 bg-muted/20">
            <Button
              size="sm"
              variant="outline"
              className="text-xs font-bold w-full h-8"
              onClick={() => {
                onChange(format(new Date(), "yyyy-MM-dd"));
                setOpen(false);
              }}
            >
              اليوم
            </Button>
            {value && (
              <Button
                size="sm"
                variant="ghost"
                className="text-xs font-bold text-destructive hover:bg-destructive/10 hover:text-destructive w-full h-8"
                onClick={() => {
                  onChange("");
                  setOpen(false);
                }}
              >
                مسح
              </Button>
            )}
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
