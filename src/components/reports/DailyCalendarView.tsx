import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, FileText, Plus, Calendar as CalendarIcon } from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, addWeeks, subWeeks, isToday } from 'date-fns';
import { ar } from 'date-fns/locale';
import DOMPurify from 'dompurify';
import type { Report } from '@/pages/Reports';

interface DailyCalendarViewProps {
  reports: Report[];
  onSelectReport: (report: Report) => void;
  onCreateReport: (date: Date) => void;
}

export function DailyCalendarView({ reports, onSelectReport, onCreateReport }: DailyCalendarViewProps) {
  const [currentWeek, setCurrentWeek] = useState(new Date());

  const weekStart = startOfWeek(currentWeek, { weekStartsOn: 0 });
  const weekEnd = endOfWeek(currentWeek, { weekStartsOn: 0 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const getReportsForDay = (day: Date) => {
    return reports.filter(report => {
      const reportDate = new Date(report.report_date);
      // تعديل المنطقة الزمنية للتاريخ المحلي
      const localDay = new Date(day.getFullYear(), day.getMonth(), day.getDate());
      const localReportDate = new Date(reportDate.getFullYear(), reportDate.getMonth(), reportDate.getDate());
      return localDay.getTime() === localReportDate.getTime();
    });
  };

  const getDayName = (day: Date) => {
    const dayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    return dayNames[day.getDay()];
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentWeek(subWeeks(currentWeek, 1))}
          className="gap-2"
        >
          <ChevronRight className="h-4 w-4" />
          الأسبوع السابق
        </Button>
        <div className="text-center">
          <h2 className="text-2xl font-bold">
            {format(weekStart, 'd', { locale: ar })} - {format(weekEnd, 'd MMMM yyyy', { locale: ar })}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            الأسبوع الحالي
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentWeek(addWeeks(currentWeek, 1))}
          className="gap-2"
        >
          الأسبوع القادم
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Days Grid */}
      <div className="grid grid-cols-1 md:grid-cols-7 gap-4">
        {days.map(day => {
          const dayReports = getReportsForDay(day);
          const isTodayDate = isToday(day);
          
          return (
            <Card
              key={day.toISOString()}
              className={`p-4 transition-all hover:shadow-lg ${
                isTodayDate ? 'border-2 border-primary bg-primary/5' : ''
              }`}
            >
              {/* Day Header */}
              <div className="flex items-center justify-between mb-3 pb-3 border-b">
                <div>
                  <div className="text-sm font-semibold text-muted-foreground">
                    {getDayName(day)}
                  </div>
                  <div className={`text-2xl font-bold ${isTodayDate ? 'text-primary' : ''}`}>
                    {format(day, 'd', { locale: ar })}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {format(day, 'MMM', { locale: ar })}
                  </div>
                </div>
                {isTodayDate && (
                  <Badge variant="default" className="text-xs">
                    اليوم
                  </Badge>
                )}
              </div>

              {/* Reports for this day */}
              <div className="space-y-2 min-h-[200px]">
                {dayReports.length > 0 ? (
                  <>
                    <div className="flex items-center gap-2 mb-2">
                      <FileText className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">
                        {dayReports.length} {dayReports.length === 1 ? 'تقرير' : 'تقارير'}
                      </span>
                    </div>
                    {dayReports.map(report => (
                      <Button
                        key={report.id}
                        variant="outline"
                        className="w-full h-auto py-3 px-3 flex flex-col items-start gap-1 hover:bg-accent"
                        onClick={() => onSelectReport(report)}
                      >
                        <div className="flex items-start gap-2 w-full">
                          <CalendarIcon className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
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
                        </div>
                      </Button>
                    ))}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-8 text-center">
                    <FileText className="h-12 w-12 text-muted-foreground/30 mb-3" />
                    <p className="text-sm text-muted-foreground mb-3">
                      لا توجد تقارير
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onCreateReport(day)}
                      className="gap-2"
                    >
                      <Plus className="h-4 w-4" />
                      إضافة تقرير
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
