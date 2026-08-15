import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, CaptionProps, useNavigation } from "react-day-picker";
import { format, setMonth, setYear } from "date-fns";
import { ar } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
function CustomCaption({ displayMonth }: CaptionProps) {
  const { goToMonth, previousMonth, nextMonth } = useNavigation();

  const months = Array.from({ length: 12 }, (_, i) => {
    const date = new Date(2024, i, 1);
    return { value: i.toString(), label: format(date, "LLLL", { locale: ar }) };
  });

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 41 }, (_, i) => {
    const year = currentYear - 20 + i;
    return { value: year.toString(), label: year.toString() };
  });

  const handleMonthChange = (value: string) => {
    const newDate = setMonth(displayMonth, parseInt(value));
    goToMonth(newDate);
  };

  const handleYearChange = (value: string) => {
    const newDate = setYear(displayMonth, parseInt(value));
    goToMonth(newDate);
  };

  return (
    <div className="flex items-center justify-between gap-1.5 px-1">
      <button
        type="button"
        onClick={() => previousMonth && goToMonth(previousMonth)}
        disabled={!previousMonth}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 p-0 opacity-60 hover:opacity-100 shrink-0"
        )}
      >
        <ChevronRight className="h-4 w-4" />
      </button>
      <div className="flex items-center gap-1 flex-1 justify-center">
        <select
          value={displayMonth.getMonth().toString()}
          onChange={(e) => handleMonthChange(e.target.value)}
          className="h-7 w-auto min-w-[85px] text-xs font-semibold bg-background border border-border/60 rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/30 cursor-pointer text-foreground shadow-sm hover:bg-accent/5 transition-all text-center"
        >
          {months.map((month) => (
            <option key={month.value} value={month.value} className="bg-popover text-foreground">
              {month.label}
            </option>
          ))}
        </select>
        <select
          value={displayMonth.getFullYear().toString()}
          onChange={(e) => handleYearChange(e.target.value)}
          className="h-7 w-[75px] text-xs font-semibold bg-background border border-border/60 rounded-md px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-primary/30 cursor-pointer text-foreground shadow-sm hover:bg-accent/5 transition-all text-center"
        >
          {years.map((year) => (
            <option key={year.value} value={year.value} className="bg-popover text-foreground">
              {year.label}
            </option>
          ))}
        </select>
      </div>
      <button
        type="button"
        onClick={() => nextMonth && goToMonth(nextMonth)}
        disabled={!nextMonth}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 p-0 opacity-60 hover:opacity-100 shrink-0"
        )}
      >
        <ChevronLeft className="h-4 w-4" />
      </button>
    </div>
  );
}

function CalendarFooter({ onSelect, mode }: { onSelect?: any; mode?: string }) {
  const { goToMonth } = useNavigation();

  const handleToday = () => {
    const today = new Date();
    goToMonth(today);
    if (onSelect) {
      if (mode === "single") {
        onSelect(today, today, { selected: true } as any);
      } else if (mode === "multiple") {
        onSelect([today], { selected: true } as any);
      } else if (mode === "range") {
        onSelect({ from: today, to: today }, today, { selected: true } as any);
      }
    }
  };

  return (
    <div className="flex justify-center pt-2 mt-2 border-t border-border">
      <button
        type="button"
        onClick={handleToday}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "text-xs font-semibold px-4 py-1 h-7 rounded-md cursor-pointer hover:bg-primary hover:text-primary-foreground transition-all"
        )}
      >
        اليوم
      </button>
    </div>
  );
}

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  const defaultMonth = props.defaultMonth || 
    (props.mode === "single" && (props as any).selected instanceof Date 
      ? (props as any).selected 
      : undefined);

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      defaultMonth={defaultMonth}
      className={cn("p-3 pointer-events-auto", className)}
      classNames={{
        months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "hidden",
        nav: "hidden",
        table: "w-full border-collapse border border-border/20",
        head_row: "flex bg-muted/30 border-b border-border/30",
        head_cell: "text-muted-foreground w-9 font-semibold text-[0.75rem] text-center py-1.5",
        row: "flex w-full border-b border-border/10 last:border-b-0",
        cell: "h-9 w-9 text-center text-sm p-0 relative border-r border-border/20 last:border-r-0 [&:has([aria-selected].day-range-end)]:rounded-none [&:has([aria-selected].day-outside)]:bg-accent/10 [&:has([aria-selected])]:bg-accent/30 focus-within:relative focus-within:z-20",
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-full w-full p-0 font-medium aria-selected:opacity-100 rounded-none transition-all duration-150 flex items-center justify-center hover:bg-primary hover:text-primary-foreground cursor-pointer"
        ),
        day_range_end: "day-range-end",
        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground focus:bg-primary focus:text-primary-foreground shadow-md font-bold",
        day_today: "bg-accent/40 text-accent-foreground font-extrabold ring-1 ring-primary/45",
        day_outside:
          "day-outside text-muted-foreground/30 hover:bg-primary/20 hover:text-primary-foreground aria-selected:bg-accent/20",
        day_disabled: "text-muted-foreground/20 cursor-not-allowed",
        day_range_middle: "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Caption: CustomCaption,
        IconLeft: ({ ..._props }) => <ChevronLeft className="h-4 w-4" />,
        IconRight: ({ ..._props }) => <ChevronRight className="h-4 w-4" />,
      }}
      footer={(props as any).onSelect ? <CalendarFooter onSelect={(props as any).onSelect} mode={props.mode} /> : undefined}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
