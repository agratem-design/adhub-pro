import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, useDayPicker, type MonthCaptionProps } from "react-day-picker";
import { format, setMonth, setYear } from "date-fns";
import { ar } from "date-fns/locale";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

function CustomCaption({ calendarMonth }: MonthCaptionProps) {
  const { goToMonth, previousMonth, nextMonth } = useDayPicker();
  const displayMonth = calendarMonth.date;

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
    goToMonth(setMonth(displayMonth, parseInt(value)));
  };

  const handleYearChange = (value: string) => {
    goToMonth(setYear(displayMonth, parseInt(value)));
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
  const { goToMonth } = useDayPicker();

  const handleToday = () => {
    const today = new Date();
    goToMonth(today);
    if (onSelect) {
      if (mode === "single") {
        onSelect(today, today, { selected: true } as any);
      } else if (mode === "multiple") {
        onSelect([today], today, { selected: true } as any);
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

// v8 كان يقبل initialFocus؛ في الإصدارات الجديدة اسمه autoFocus
export type CalendarProps = React.ComponentProps<typeof DayPicker> & { initialFocus?: boolean };

function Calendar({ className, classNames, showOutsideDays = true, initialFocus, ...props }: CalendarProps) {
  const defaultMonth = props.defaultMonth ||
    (props.mode === "single" && (props as any).selected instanceof Date
      ? (props as any).selected
      : undefined);
  const onSelect = (props as any).onSelect;

  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      defaultMonth={defaultMonth}
      autoFocus={initialFocus}
      hideNavigation
      className={cn("p-3 pointer-events-auto", className)}
      classNames={{
        months: "relative flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
        month: "space-y-4",
        month_caption: "flex justify-center pt-1 relative items-center",
        caption_label: "hidden",
        nav: "hidden",
        month_grid: "w-full border-collapse border border-border/20",
        weekdays: "flex bg-muted/30 border-b border-border/30",
        weekday: "text-muted-foreground w-9 font-semibold text-[0.75rem] text-center py-1.5",
        week: "flex w-full border-b border-border/10 last:border-b-0",
        day: "h-9 w-9 text-center text-sm p-0 relative border-r border-border/20 last:border-r-0 focus-within:relative focus-within:z-20 [&.rdp-selected]:bg-accent/30 [&.rdp-outside.rdp-selected]:bg-accent/10",
        day_button: cn(
          buttonVariants({ variant: "ghost" }),
          "h-full w-full p-0 font-medium rounded-none transition-all duration-150 flex items-center justify-center hover:bg-primary hover:text-primary-foreground cursor-pointer"
        ),
        range_start: "rdp-range_start",
        range_end: "rdp-range_end",
        selected:
          "rdp-selected [&>button]:bg-primary [&>button]:text-primary-foreground [&>button]:hover:bg-primary [&>button]:hover:text-primary-foreground [&>button]:shadow-md [&>button]:font-bold",
        today: "[&>button]:bg-accent/40 [&>button]:text-accent-foreground [&>button]:font-extrabold [&>button]:ring-1 [&>button]:ring-primary/45",
        outside:
          "rdp-outside [&>button]:text-muted-foreground/30 [&>button]:hover:bg-primary/20",
        disabled: "[&>button]:text-muted-foreground/20 [&>button]:cursor-not-allowed",
        range_middle: "[&>button]:bg-accent [&>button]:text-accent-foreground",
        hidden: "invisible",
        ...classNames,
      }}
      components={{ MonthCaption: CustomCaption }}
      footer={onSelect ? <CalendarFooter onSelect={onSelect} mode={props.mode} /> : undefined}
      {...props}
    />
  );
}
Calendar.displayName = "Calendar";

export { Calendar };
