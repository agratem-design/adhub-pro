import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ChevronDown, ChevronUp, FileText, Printer, Calendar } from 'lucide-react';
import { format, startOfWeek, endOfWeek, eachWeekOfInterval, startOfMonth, endOfMonth, eachMonthOfInterval, getWeek } from 'date-fns';
import { ar } from 'date-fns/locale';
import type { Report } from '@/pages/Reports';

interface WeeklyMonthlyViewProps {
  reports: Report[];
  reportType: 'weekly' | 'monthly';
  onSelectReport: (report: Report) => void;
  onPrintGroup: (reports: Report[], title: string, startDate: string, endDate: string) => void;
  currentMonth: Date;
}

export function WeeklyMonthlyView({ 
  reports, 
  reportType, 
  onSelectReport, 
  onPrintGroup,
  currentMonth 
}: WeeklyMonthlyViewProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [selectedReports, setSelectedReports] = useState<Set<string>>(new Set());

  const toggleGroup = (groupKey: string) => {
    const newExpanded = new Set(expandedGroups);
    if (newExpanded.has(groupKey)) {
      newExpanded.delete(groupKey);
    } else {
      newExpanded.add(groupKey);
    }
    setExpandedGroups(newExpanded);
  };

  const toggleReportSelection = (reportId: string) => {
    const newSelected = new Set(selectedReports);
    if (newSelected.has(reportId)) {
      newSelected.delete(reportId);
    } else {
      newSelected.add(reportId);
    }
    setSelectedReports(newSelected);
  };

  const selectAllInGroup = (groupReports: Report[]) => {
    const newSelected = new Set(selectedReports);
    const allSelected = groupReports.every(r => selectedReports.has(r.id));
    
    if (allSelected) {
      groupReports.forEach(r => newSelected.delete(r.id));
    } else {
      groupReports.forEach(r => newSelected.add(r.id));
    }
    setSelectedReports(newSelected);
  };

  // تجميع التقارير حسب النوع
  const groupReports = () => {
    const grouped: Record<string, Report[]> = {};

    if (reportType === 'weekly') {
      // تجميع حسب الأسبوع
      const monthStart = startOfMonth(currentMonth);
      const monthEnd = endOfMonth(currentMonth);
      const weeks = eachWeekOfInterval({ start: monthStart, end: monthEnd });

      weeks.forEach((weekStart) => {
        const weekEnd = endOfWeek(weekStart);
        const weekKey = format(weekStart, 'yyyy-ww');
        
        const weekReports = reports.filter(report => {
          const reportDate = new Date(report.report_date);
          return reportDate >= weekStart && reportDate <= weekEnd;
        });

        if (weekReports.length > 0) {
          grouped[weekKey] = weekReports;
        }
      });
    } else if (reportType === 'monthly') {
      // تجميع حسب الشهر
      const yearStart = new Date(currentMonth.getFullYear(), 0, 1);
      const yearEnd = new Date(currentMonth.getFullYear(), 11, 31);
      const months = eachMonthOfInterval({ start: yearStart, end: yearEnd });

      months.forEach((month) => {
        const monthKey = format(month, 'yyyy-MM');
        const monthStart = startOfMonth(month);
        const monthEnd = endOfMonth(month);

        const monthReports = reports.filter(report => {
          const reportDate = new Date(report.report_date);
          return reportDate >= monthStart && reportDate <= monthEnd;
        });

        if (monthReports.length > 0) {
          grouped[monthKey] = monthReports;
        }
      });
    }

    return grouped;
  };

  const groupedReports = groupReports();

  const getGroupTitle = (groupKey: string, groupReports: Report[]) => {
    if (reportType === 'weekly') {
      const weekStart = startOfWeek(new Date(groupReports[0].report_date));
      const weekEnd = endOfWeek(weekStart);
      const weekNumber = getWeek(weekStart, { locale: ar });
      return `الأسبوع ${weekNumber} - ${format(weekStart, 'd', { locale: ar })} إلى ${format(weekEnd, 'd MMM', { locale: ar })}`;
    } else {
      return format(new Date(groupKey), 'MMMM yyyy', { locale: ar });
    }
  };

  return (
    <div className="space-y-4">
      {Object.entries(groupedReports).length === 0 ? (
        <Card className="p-12 text-center border-2 border-dashed">
          <Calendar className="h-20 w-20 mx-auto mb-4 text-muted-foreground/30" />
          <h3 className="text-xl font-semibold mb-2">لا توجد تقارير</h3>
          <p className="text-muted-foreground">
            لم يتم إنشاء أي تقارير {reportType === 'weekly' ? 'أسبوعية' : 'شهرية'} حتى الآن
          </p>
        </Card>
      ) : (
        Object.entries(groupedReports).map(([groupKey, groupReports]) => {
          const isExpanded = expandedGroups.has(groupKey);
          const weekStart = startOfWeek(new Date(groupReports[0].report_date));
          const weekEnd = endOfWeek(weekStart);
          const selectedInGroup = groupReports.filter(r => selectedReports.has(r.id));
          const allSelected = groupReports.length > 0 && selectedInGroup.length === groupReports.length;
          
          return (
            <Card key={groupKey} className="overflow-hidden border-2 hover:shadow-lg transition-shadow">
              <div className="p-5 bg-gradient-to-r from-primary/5 to-primary/10 border-b flex items-center justify-between">
                <div className="flex items-center gap-4 flex-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleGroup(groupKey)}
                    className="p-2 hover:bg-primary/20 rounded-lg"
                  >
                    {isExpanded ? (
                      <ChevronUp className="h-5 w-5" />
                    ) : (
                      <ChevronDown className="h-5 w-5" />
                    )}
                  </Button>
                  <Calendar className="h-6 w-6 text-primary" />
                  <div>
                    <h3 className="text-lg font-bold text-foreground">{getGroupTitle(groupKey, groupReports)}</h3>
                    <p className="text-sm text-muted-foreground">
                      {groupReports.length} {groupReports.length === 1 ? 'تقرير يومي' : 'تقارير يومية'}
                      {selectedInGroup.length > 0 && ` • ${selectedInGroup.length} محدد`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isExpanded && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => selectAllInGroup(groupReports)}
                      className="gap-2"
                    >
                      <Checkbox checked={allSelected} />
                      {allSelected ? 'إلغاء الكل' : 'تحديد الكل'}
                    </Button>
                  )}
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      const reportsToSend = selectedInGroup.length > 0 ? selectedInGroup : groupReports;
                      onPrintGroup(
                        reportsToSend,
                        getGroupTitle(groupKey, groupReports),
                        format(reportType === 'weekly' ? weekStart : startOfMonth(new Date(groupKey)), 'yyyy-MM-dd'),
                        format(reportType === 'weekly' ? weekEnd : endOfMonth(new Date(groupKey)), 'yyyy-MM-dd')
                      );
                    }}
                    className="gap-2"
                  >
                    <Printer className="h-4 w-4" />
                    {selectedInGroup.length > 0 ? `طباعة (${selectedInGroup.length})` : 'طباعة الكل'}
                  </Button>
                </div>
              </div>

              {isExpanded && (
                <div className="p-4 space-y-2 bg-accent/5">
                  {groupReports
                    .sort((a, b) => new Date(a.report_date).getTime() - new Date(b.report_date).getTime())
                    .map(report => {
                      const isSelected = selectedReports.has(report.id);
                      return (
                        <Card
                          key={report.id}
                          className={`p-4 transition-all hover:shadow-md ${
                            isSelected ? 'bg-primary/10 border-primary' : 'hover:bg-accent/50'
                          }`}
                        >
                          <div className="flex items-center gap-4">
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => toggleReportSelection(report.id)}
                              onClick={(e) => e.stopPropagation()}
                            />
                            <div 
                              className="flex-1 cursor-pointer"
                              onClick={() => onSelectReport(report)}
                            >
                              <div className="flex items-center gap-3 mb-2">
                                <FileText className="h-5 w-5 text-primary" />
                                <div className="flex-1">
                                  <h4 className="font-semibold text-foreground">{report.title}</h4>
                                  <p className="text-sm text-muted-foreground">
                                    {format(new Date(report.report_date), 'EEEE، d MMMM yyyy', { locale: ar })}
                                  </p>
                                </div>
                              </div>
                              {report.summary && (
                                <p className="text-sm text-muted-foreground mt-2 line-clamp-2 pr-8">
                                  {report.summary}
                                </p>
                              )}
                            </div>
                            <Button 
                              variant="ghost" 
                              size="sm"
                              onClick={() => onSelectReport(report)}
                            >
                              عرض التفاصيل
                            </Button>
                          </div>
                        </Card>
                      );
                    })}
                </div>
              )}
            </Card>
          );
        })
      )}
    </div>
  );
}
