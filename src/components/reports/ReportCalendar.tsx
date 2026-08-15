import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ChevronLeft, ChevronRight, FileText, Plus } from 'lucide-react';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, startOfWeek, endOfWeek, getWeek } from 'date-fns';
import { ar } from 'date-fns/locale';

import type { Report } from '@/pages/Reports';

interface ReportCalendarProps {
  reports: Report[];
  onSelectReport: (report: Report) => void;
  onCreateReport: (date: string) => void;
  reportType: 'daily' | 'weekly' | 'monthly';
}

export function ReportCalendar({ reports, onSelectReport, onCreateReport, reportType }: ReportCalendarProps) {
  const [currentMonth, setCurrentMonth] = useState(new Date());

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  const getReportsForDay = (day: Date) => {
    return reports.filter(report => 
      isSameDay(new Date(report.report_date), day)
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </Button>
        <h2 className="text-xl font-bold">
          {format(currentMonth, 'MMMM yyyy', { locale: ar })}
        </h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      <div className="grid grid-cols-7 gap-2">
        {['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'].map(day => (
          <div key={day} className="text-center text-sm font-medium p-2">
            {day}
          </div>
        ))}
        
        {days.map(day => {
          const dayReports = getReportsForDay(day);
          const isToday = isSameDay(day, new Date());
          
          return (
            <Card
              key={day.toISOString()}
              className={`p-2 min-h-24 ${
                isToday ? 'border-primary border-2' : ''
              }`}
            >
              <div className="text-sm font-medium mb-1">
                {format(day, 'd', { locale: ar })}
              </div>
              {dayReports.length > 0 ? (
                <div className="space-y-1">
                  {dayReports.map(report => (
                    <div key={report.id} className="w-full">
                      <Button
                        size="sm"
                        variant="secondary"
                        className="w-full text-xs justify-start gap-2 h-auto py-1 px-2"
                        onClick={() => onSelectReport(report)}
                      >
                        <FileText className="h-3 w-3" />
                        <span className="truncate">{report.title.substring(0, 12)}</span>
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <Button
                  size="sm"
                  variant="ghost"
                  className="w-full mt-1 text-xs"
                  onClick={() => onCreateReport(day.toISOString())}
                >
                  <Plus className="h-3 w-3 ml-1" />
                  إضافة تقرير
                </Button>
              )}
            </Card>
          );
        })}
      </div>
    </div>
  );
}