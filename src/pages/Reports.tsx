import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Plus, FileText, Calendar as CalendarIcon, TrendingUp } from 'lucide-react';
import { ReportDialog } from '@/components/reports/ReportDialog';
import { ReportView } from '@/components/reports/ReportView';
import { ReportPrintDialog } from '@/components/reports/ReportPrintDialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Badge } from '@/components/ui/badge';
import { DailyCalendarView } from '@/components/reports/DailyCalendarView';
import { WeeklyCalendarView } from '@/components/reports/WeeklyCalendarView';
import { MonthlyCalendarView } from '@/components/reports/MonthlyCalendarView';

export interface Report {
  id: string;
  title: string;
  report_type: 'daily' | 'weekly' | 'monthly';
  report_date: string;
  start_date?: string;
  end_date?: string;
  summary?: string;
  created_at: string;
}

export default function Reports() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);
  const [viewReport, setViewReport] = useState<Report | null>(null);
  const [printReport, setPrintReport] = useState<Report | null>(null);
  const [activeTab, setActiveTab] = useState<'daily' | 'weekly' | 'monthly'>('daily');

  const { data: allReports = [], isLoading, refetch } = useQuery({
    queryKey: ['reports'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reports')
        .select('*')
        .order('report_date', { ascending: false });
      
      if (error) throw error;
      return data as Report[];
    },
  });

  const dailyReports = allReports.filter(r => r.report_type === 'daily');
  const weeklyReports = allReports.filter(r => r.report_type === 'weekly');
  const monthlyReports = allReports.filter(r => r.report_type === 'monthly');

  const createNewReport = (type: 'daily' | 'weekly' | 'monthly', customDate?: Date | string) => {
    // إصلاح مشكلة المنطقة الزمنية - استخدام التاريخ المحلي
    let date: Date;
    if (customDate) {
      if (typeof customDate === 'string') {
        date = new Date(customDate);
      } else {
        date = customDate;
      }
    } else {
      date = new Date();
    }
    
    // إنشاء تاريخ محلي بدون تأثير المنطقة الزمنية
    const localDate = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0);
    const reportDate = localDate.toISOString();
    
    let title = '';
    
    if (type === 'daily') {
      title = `تقرير يومي - ${format(localDate, 'PPP', { locale: ar })}`;
    } else if (type === 'weekly') {
      const weekStart = startOfWeek(localDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(localDate, { weekStartsOn: 0 });
      title = `تقرير أسبوعي - من ${format(weekStart, 'PP', { locale: ar })} إلى ${format(weekEnd, 'PP', { locale: ar })}`;
    } else {
      title = `تقرير شهري - ${format(localDate, 'MMMM yyyy', { locale: ar })}`;
    }

    setSelectedReport({
      id: '',
      title,
      report_type: type,
      report_date: reportDate,
      created_at: new Date().toISOString(),
    } as Report);
    setDialogOpen(true);
  };

  const getReportTypeLabel = (type: string) => {
    switch (type) {
      case 'daily': return 'يومي';
      case 'weekly': return 'أسبوعي';
      case 'monthly': return 'شهري';
      default: return type;
    }
  };

  const getReportTypeColor = (type: string) => {
    switch (type) {
      case 'daily': return 'bg-blue-500';
      case 'weekly': return 'bg-green-500';
      case 'monthly': return 'bg-purple-500';
      default: return 'bg-gray-500';
    }
  };


  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">التقارير اليومية والدورية</h1>
        <p className="text-xs sm:text-sm text-muted-foreground mt-1">
          سجل الأحداث اليومية وقم بإنشاء تقارير أسبوعية وشهرية بسهولة
        </p>
      </div>

      {/* إحصائيات سريعة */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <FileText className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">تقارير يومية</p>
              <p className="text-2xl font-bold font-manrope">{dailyReports.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-green-100 dark:bg-green-900 rounded-lg">
              <CalendarIcon className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">تقارير أسبوعية</p>
              <p className="text-2xl font-bold font-manrope">{weeklyReports.length}</p>
            </div>
          </div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="p-3 bg-purple-100 dark:bg-purple-900 rounded-lg">
              <TrendingUp className="h-6 w-6 text-purple-600 dark:text-purple-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">تقارير شهرية</p>
              <p className="text-2xl font-bold font-manrope">{monthlyReports.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tabs للتقارير */}
      <Card className="p-3 sm:p-6">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as typeof activeTab)}>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 mb-6">
            <div className="overflow-x-auto">
              <TabsList className="grid w-full min-w-[280px] grid-cols-3">
                <TabsTrigger value="daily" className="text-xs sm:text-sm">تقارير يومية</TabsTrigger>
                <TabsTrigger value="weekly" className="text-xs sm:text-sm">تقارير أسبوعية</TabsTrigger>
                <TabsTrigger value="monthly" className="text-xs sm:text-sm">تقارير شهرية</TabsTrigger>
              </TabsList>
            </div>
            
            <Button onClick={() => createNewReport(activeTab)} className="gap-2 w-full sm:w-auto">
              <Plus className="h-4 w-4" />
              تقرير {getReportTypeLabel(activeTab)} جديد
            </Button>
          </div>

          <TabsContent value="daily" className="mt-6">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
              </div>
            ) : (
              <DailyCalendarView
                reports={dailyReports}
                onSelectReport={(report) => setViewReport(report)}
                onCreateReport={(date) => createNewReport('daily', date)}
              />
            )}
          </TabsContent>

          <TabsContent value="weekly" className="mt-6">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
              </div>
            ) : (
              <WeeklyCalendarView
                reports={dailyReports}
                onSelectReport={(report) => setViewReport(report)}
                onCreateReport={(startDate, endDate) => createNewReport('weekly', startDate)}
              />
            )}
          </TabsContent>

          <TabsContent value="monthly" className="mt-6">
            {isLoading ? (
              <div className="text-center py-12">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
              </div>
            ) : (
              <MonthlyCalendarView
                reports={dailyReports}
                onSelectReport={(report) => setViewReport(report)}
                onCreateReport={(month) => createNewReport('monthly', month)}
              />
            )}
          </TabsContent>
        </Tabs>
      </Card>

      <ReportDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        report={selectedReport}
        reportType={activeTab}
        onSaved={refetch}
      />

      <ReportView
        report={viewReport}
        onClose={() => setViewReport(null)}
        onEdit={(report) => {
          setSelectedReport(report);
          setDialogOpen(true);
          setViewReport(null);
        }}
        onPrint={(report) => {
          setPrintReport(report);
          setViewReport(null);
        }}
        onDeleted={() => {
          refetch();
        }}
      />

      <ReportPrintDialog
        report={printReport}
        open={!!printReport}
        onClose={() => setPrintReport(null)}
      />
    </div>
  );
}
