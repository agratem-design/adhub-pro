import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, FileText, Plus, Calendar as CalendarIcon, TrendingUp } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachMonthOfInterval, addYears, subYears, startOfYear, endOfYear } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { Report } from '@/pages/Reports';

interface MonthlyCalendarViewProps {
  reports: Report[];
  onSelectReport: (report: Report) => void;
  onCreateReport: (month: Date) => void;
}

export function MonthlyCalendarView({ reports, onSelectReport, onCreateReport }: MonthlyCalendarViewProps) {
  const [currentYear, setCurrentYear] = useState(new Date());

  const yearStart = startOfYear(currentYear);
  const yearEnd = endOfYear(currentYear);
  const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });

  const getReportsForMonth = (month: Date) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    return reports.filter(report => {
      const reportDate = new Date(report.report_date);
      return reportDate >= monthStart && reportDate <= monthEnd;
    });
  };

  const getDailyReportsInMonth = (month: Date) => {
    return getReportsForMonth(month).filter(r => r.report_type === 'daily');
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentYear(subYears(currentYear, 1))}
          className="gap-2"
        >
          <ChevronRight className="h-4 w-4" />
          السنة السابقة
        </Button>
        <div className="text-center">
          <h2 className="text-3xl font-bold">
            {format(currentYear, 'yyyy', { locale: ar })}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            جميع أشهر السنة
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentYear(addYears(currentYear, 1))}
          className="gap-2"
        >
          السنة القادمة
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Months Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        {months.map((month) => {
          const monthReports = getReportsForMonth(month);
          const dailyReports = getDailyReportsInMonth(month);
          const isCurrentMonth = format(month, 'yyyy-MM') === format(new Date(), 'yyyy-MM');
          
          return (
            <Card
              key={month.toISOString()}
              className={`p-5 hover:shadow-xl transition-all ${
                isCurrentMonth ? 'border-2 border-primary bg-primary/5' : 'border-2'
              }`}
            >
              {/* Month Header */}
              <div className="flex items-start justify-between mb-4 pb-4 border-b-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="text-xl font-bold">
                      {format(month, 'MMMM', { locale: ar })}
                    </div>
                    {isCurrentMonth && (
                      <Badge variant="default" className="text-xs">
                        الحالي
                      </Badge>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {format(month, 'yyyy', { locale: ar })}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-primary">
                    {monthReports.length}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {monthReports.length === 1 ? 'تقرير' : 'تقارير'}
                  </div>
                </div>
              </div>

              {/* Reports Summary */}
              {dailyReports.length > 0 && (
                <div className="mb-4 p-3 bg-accent/50 rounded-lg">
                  <div className="flex items-center gap-2 mb-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">
                      التقارير اليومية: {dailyReports.length}
                    </span>
                  </div>
                </div>
              )}

              {/* Reports List */}
              <div className="space-y-2 min-h-[200px]">
                {monthReports.length > 0 ? (
                  <>
                    {monthReports.slice(0, 3).map(report => (
                      <Button
                        key={report.id}
                        variant="outline"
                        className="w-full h-auto py-2 px-3 flex items-start gap-2 hover:bg-accent hover:border-primary text-right"
                        onClick={() => onSelectReport(report)}
                      >
                        <FileText className="h-4 w-4 mt-0.5 flex-shrink-0 text-primary" />
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="font-medium text-xs line-clamp-2 break-words">
                            {report.title}
                          </div>
                          <div className="text-xs text-muted-foreground mt-1">
                            {format(new Date(report.report_date), 'd MMM', { locale: ar })}
                          </div>
                        </div>
                      </Button>
                    ))}
                    {monthReports.length > 3 && (
                      <div className="text-center pt-2">
                        <Badge variant="secondary" className="text-xs">
                          +{monthReports.length - 3} {monthReports.length - 3 === 1 ? 'تقرير آخر' : 'تقارير أخرى'}
                        </Badge>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center h-full py-10 text-center">
                    <CalendarIcon className="h-12 w-12 text-muted-foreground/20 mb-3" />
                    <p className="text-xs text-muted-foreground mb-3">
                      لا توجد تقارير
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onCreateReport(month)}
                      className="gap-2 text-xs"
                    >
                      <Plus className="h-3 w-3" />
                      إنشاء تقرير
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
