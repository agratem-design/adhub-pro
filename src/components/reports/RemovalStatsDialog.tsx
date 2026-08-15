import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { format, startOfMonth, endOfMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import { CalendarIcon, Package, Users, CheckCircle2, MapPin } from 'lucide-react';
import { toast } from 'sonner';

interface RemovalStatsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RemovalStatsDialog({ open, onOpenChange }: RemovalStatsDialogProps) {
  const [startDate, setStartDate] = useState<Date | undefined>(startOfMonth(new Date()));
  const [endDate, setEndDate] = useState<Date | undefined>(endOfMonth(new Date()));

  const { data: stats, isLoading } = useQuery({
    queryKey: ['removal-stats', startDate, endDate],
    enabled: open && !!startDate && !!endDate,
    queryFn: async () => {
      // جلب مهام الإزالة في الفترة المحددة
      const { data: tasks, error: tasksError } = await supabase
        .from('removal_tasks')
        .select('*')
        .gte('created_at', startDate!.toISOString())
        .lte('created_at', endDate!.toISOString());

      if (tasksError) throw tasksError;

      // جلب عناصر المهام مع بيانات اللوحات
      const taskIds = tasks?.map(t => t.id) || [];
      const { data: items, error: itemsError } = await supabase
        .from('removal_task_items')
        .select('*')
        .in('task_id', taskIds);

      if (itemsError) throw itemsError;

      // جلب بيانات اللوحات المرتبطة
      const billboardIds = items?.map(i => i.billboard_id).filter(Boolean) || [];
      const { data: billboardsData, error: billError } = await supabase
        .from('billboards')
        .select('*')
        .in('ID', billboardIds);

      if (billError) throw billError;

      // جلب الفرق
      const teamIds = [...new Set(tasks?.map(t => t.team_id))];
      const { data: teams, error: teamsError } = await supabase
        .from('installation_teams')
        .select('*')
        .in('id', teamIds);

      if (teamsError) throw teamsError;

      // حساب الإحصائيات
      const totalTasks = tasks?.length || 0;
      const completedTasks = tasks?.filter(t => t.status === 'completed').length || 0;
      const pendingTasks = tasks?.filter(t => t.status === 'pending').length || 0;
      const totalBillboards = items?.length || 0;
      const completedBillboards = items?.filter(i => i.status === 'completed').length || 0;

      // تجميع حسب الفريق
      const byTeam: Record<string, { teamName: string; tasks: number; billboards: number; completed: number }> = {};
      tasks?.forEach(task => {
        const team = teams?.find(t => t.id === task.team_id);
        const teamName = team?.team_name || 'غير محدد';
        const taskItems = items?.filter(i => i.task_id === task.id) || [];
        const completedItems = taskItems.filter(i => i.status === 'completed').length;

        if (!byTeam[teamName]) {
          byTeam[teamName] = { teamName, tasks: 0, billboards: 0, completed: 0 };
        }
        byTeam[teamName].tasks++;
        byTeam[teamName].billboards += taskItems.length;
        byTeam[teamName].completed += completedItems;
      });

      // تجميع حسب المنطقة
      const byMunicipality: Record<string, number> = {};
      items?.forEach(item => {
        const billboard = billboardsData?.find(b => b.ID === item.billboard_id);
        const municipality = billboard?.Municipality || 'غير محدد';
        byMunicipality[municipality] = (byMunicipality[municipality] || 0) + 1;
      });

      return {
        totalTasks,
        completedTasks,
        pendingTasks,
        totalBillboards,
        completedBillboards,
        byTeam: Object.values(byTeam),
        byMunicipality,
      };
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">تقرير إحصائيات الإزالة</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* تحديد الفترة الزمنية */}
          <div className="flex gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">من تاريخ</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {startDate ? format(startDate, 'PPP', { locale: ar }) : 'اختر التاريخ'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={startDate}
                    onSelect={setStartDate}
                    locale={ar}
                  />
                </PopoverContent>
              </Popover>
            </div>

            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">إلى تاريخ</label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="w-full justify-start">
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {endDate ? format(endDate, 'PPP', { locale: ar }) : 'اختر التاريخ'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0">
                  <Calendar
                    mode="single"
                    selected={endDate}
                    onSelect={setEndDate}
                    locale={ar}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">جاري تحميل الإحصائيات...</p>
            </div>
          ) : stats ? (
            <>
              {/* الإحصائيات الرئيسية */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <Package className="h-8 w-8 text-blue-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">إجمالي المهام</p>
                      <p className="text-2xl font-bold">{stats.totalTasks}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-8 w-8 text-green-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">المهام المكتملة</p>
                      <p className="text-2xl font-bold">{stats.completedTasks}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <Package className="h-8 w-8 text-orange-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">المهام المعلقة</p>
                      <p className="text-2xl font-bold">{stats.pendingTasks}</p>
                    </div>
                  </div>
                </Card>

                <Card className="p-4">
                  <div className="flex items-center gap-3">
                    <MapPin className="h-8 w-8 text-purple-600" />
                    <div>
                      <p className="text-sm text-muted-foreground">اللوحات المزالة</p>
                      <p className="text-2xl font-bold">{stats.completedBillboards}</p>
                    </div>
                  </div>
                </Card>
              </div>

              {/* الإحصائيات حسب الفريق */}
              <Card className="p-4">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  الإحصائيات حسب الفريق
                </h3>
                <div className="space-y-3">
                  {stats.byTeam.map((team, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                      <div>
                        <p className="font-medium">{team.teamName}</p>
                        <p className="text-sm text-muted-foreground">
                          {team.tasks} مهام • {team.billboards} لوحات
                        </p>
                      </div>
                      <Badge variant="default" className="bg-green-600">
                        {team.completed} مكتمل
                      </Badge>
                    </div>
                  ))}
                  {stats.byTeam.length === 0 && (
                    <p className="text-center text-muted-foreground py-4">لا توجد بيانات</p>
                  )}
                </div>
              </Card>

              {/* الإحصائيات حسب المنطقة */}
              <Card className="p-4">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  الإحصائيات حسب المنطقة
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Object.entries(stats.byMunicipality)
                    .sort(([, a], [, b]) => b - a)
                    .map(([municipality, count]) => (
                      <div key={municipality} className="flex items-center justify-between p-3 bg-muted rounded-lg">
                        <p className="font-medium text-sm">{municipality}</p>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                  {Object.keys(stats.byMunicipality).length === 0 && (
                    <p className="text-center text-muted-foreground py-4 col-span-full">لا توجد بيانات</p>
                  )}
                </div>
              </Card>

              {/* معدل الإنجاز */}
              <Card className="p-4">
                <h3 className="text-lg font-semibold mb-4">معدل الإنجاز</h3>
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>المهام</span>
                    <span>{stats.totalTasks > 0 ? Math.round((stats.completedTasks / stats.totalTasks) * 100) : 0}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-green-600 h-2 rounded-full transition-all"
                      style={{ width: `${stats.totalTasks > 0 ? (stats.completedTasks / stats.totalTasks) * 100 : 0}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>اللوحات</span>
                    <span>{stats.totalBillboards > 0 ? Math.round((stats.completedBillboards / stats.totalBillboards) * 100) : 0}%</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all"
                      style={{ width: `${stats.totalBillboards > 0 ? (stats.completedBillboards / stats.totalBillboards) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </Card>
            </>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
