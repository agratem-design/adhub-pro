import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, FileText, Plus, Calendar as CalendarIcon } from 'lucide-react';
import { format, startOfMonth, eachWeekOfInterval, startOfWeek, endOfWeek, addMonths, subMonths, getWeek, eachDayOfInterval } from 'date-fns';
import { ar } from 'date-fns/locale';
import DOMPurify from 'dompurify';
import type { Report } from '@/pages/Reports';

interface WeeklyCalendarViewProps {
  reports: Report[];
  onSelectReport: (report: Report) => void;
  onCreateReport: (startDate: Date, endDate: Date) => void;
}

export function WeeklyCalendarView({ reports, onSelectReport, onCreateReport }: WeeklyCalendarViewProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const firstWeekStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  
  // Get 4 weeks starting from the first week
  const weeks = Array.from({ length: 4 }, (_, i) => {
    const weekStartDate = new Date(firstWeekStart);
    weekStartDate.setDate(firstWeekStart.getDate() + (i * 7));
    const weekEndDate = endOfWeek(weekStartDate, { weekStartsOn: 0 });
    return { start: weekStartDate, end: weekEndDate };
  });

  const getReportsForWeek = (weekStart: Date, weekEnd: Date) => {
    return reports.filter(report => {
      const reportDate = new Date(report.report_date);
      return reportDate >= weekStart && reportDate <= weekEnd;
    });
  };

  const getDailyReportsInWeek = (weekStart: Date, weekEnd: Date) => {
    const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
    return days.map(day => ({
      day,
      reports: reports.filter(report => {
        const reportDate = new Date(report.report_date);
        return reportDate.toDateString() === day.toDateString();
      })
    })).filter(item => item.reports.length > 0);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
          className="gap-2"
        >
          <ChevronRight className="h-4 w-4" />
          الشهر السابق
        </Button>
        <div className="text-center">
          <h2 className="text-2xl font-bold">
            {format(currentMonth, 'MMMM yyyy', { locale: ar })}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            الأسابيع الأربعة الأولى
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
          className="gap-2"
        >
          الشهر القادم
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Weeks Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {weeks.map((week, index) => {
          const weekReports = getReportsForWeek(week.start, week.end);
          const dailyReports = getDailyReportsInWeek(week.start, week.end);
          const weekNumber = getWeek(week.start, { locale: ar });
          
          return (
            <Card
              key={week.start.toISOString()}
              className="p-6 hover:shadow-xl transition-all border-2"
            >
              {/* Week Header */}
              <div className="flex items-start justify-between mb-4 pb-4 border-b-2">
                <div>
                  <Badge variant="outline" className="mb-2">
                    الأسبوع {index + 1}
                  </Badge>
                  <div className="text-lg font-bold">
                    {format(week.start, 'd MMM', { locale: ar })} - {format(week.end, 'd MMM', { locale: ar })}
                  </div>
                  <div className="text-sm text-muted-foreground mt-1">
                    أسبوع رقم {weekNumber}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl font-bold text-primary">
                    {weekReports.length}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {weekReports.length === 1 ? 'تقرير' : 'تقارير'}
                  </div>
                </div>
              </div>

              {/* Daily Reports in this week */}
              <div className="space-y-3 min-h-[250px]">
                {dailyReports.length > 0 ? (
                  dailyReports.map(({ day, reports: dayReports }) => (
                    <div key={day.toISOString()} className="space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                        <CalendarIcon className="h-4 w-4" />
                        <span>{format(day, 'EEEE، d MMMM', { locale: ar })}</span>
                      </div>
                      {dayReports.map(report => (
                        <Button
                          key={report.id}
                          variant="outline"
                          className="w-full h-auto py-3 px-4 flex items-start gap-3 hover:bg-accent hover:border-primary"
                          onClick={() => onSelectReport(report)}
                        >
                          <FileText className="h-5 w-5 mt-0.5 flex-shrink-0 text-primary" />
                          <div className="flex-1 text-right min-w-0 overflow-hidden">
                            <div className="font-medium text-sm line-clamp-2 break-words">
                              {report.title}
                            </div>
                            {report.summary && (
                              <div 
                                className="text-xs text-muted-foreground line-clamp-2 mt-1 break-words overflow-hidden"
                                dangerouslySetInnerHTML={{ 
                                  __html: DOMPurify.sanitize(report.summary.replace(/<[^>]*>/g, '').substring(0, 80) + '...') 
                                }}
                              />
                            )}
                          </div>
                        </Button>
                      ))}
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                    <FileText className="h-16 w-16 text-muted-foreground/20 mb-4" />
                    <p className="text-sm text-muted-foreground mb-4">
                      لا توجد تقارير يومية في هذا الأسبوع
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onCreateReport(week.start, week.end)}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      إنشاء تقرير أسبوعي
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
