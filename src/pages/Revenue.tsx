import React, { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, Calendar, TrendingUp, DollarSign, FileText, Wrench, Printer, Building2, Users, Package, BarChart3, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, startOfYear, endOfYear, subDays, subWeeks, subMonths, subYears } from 'date-fns';
import { ar } from 'date-fns/locale';

interface RevenueData {
  contracts: number;
  reinstallation: number;
  installation: number;
  printing: number;
  cutout: number;
  operatingFees: number;
  friendRentals: number;
  partnerships: number;
  total: number;
}

interface RevenueStats {
  current: RevenueData;
  previous: RevenueData;
  expenses: number;
  netProfit: number;
}

export default function Revenue() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState<'week' | 'month' | 'year'>('month');
  const [stats, setStats] = useState<RevenueStats | null>(null);

  // Calculate date ranges based on period
  const dateRanges = useMemo(() => {
    const now = new Date();
    let currentStart: Date, currentEnd: Date, previousStart: Date, previousEnd: Date;

    switch (period) {
      case 'week':
        currentStart = startOfWeek(now, { weekStartsOn: 6 }); // Saturday
        currentEnd = endOfWeek(now, { weekStartsOn: 6 });
        previousStart = subWeeks(currentStart, 1);
        previousEnd = subWeeks(currentEnd, 1);
        break;
      case 'month':
        currentStart = startOfMonth(now);
        currentEnd = endOfMonth(now);
        previousStart = subMonths(currentStart, 1);
        previousEnd = endOfMonth(previousStart);
        break;
      case 'year':
        currentStart = startOfYear(now);
        currentEnd = endOfYear(now);
        previousStart = subYears(currentStart, 1);
        previousEnd = endOfYear(previousStart);
        break;
    }

    return {
      current: { start: format(currentStart, 'yyyy-MM-dd'), end: format(currentEnd, 'yyyy-MM-dd') },
      previous: { start: format(previousStart, 'yyyy-MM-dd'), end: format(previousEnd, 'yyyy-MM-dd') }
    };
  }, [period]);

  // Fetch revenue data
  React.useEffect(() => {
    fetchRevenueData();
  }, [period, dateRanges]);

  const fetchRevenueData = async () => {
    try {
      setLoading(true);

      // Fetch contracts revenue
      const { data: contractsData } = await supabase
        .from('Contract')
        .select('Total, "Contract Date"')
        .gte('Contract Date', dateRanges.current.start)
        .lte('Contract Date', dateRanges.current.end);

      const contractsRevenue = contractsData?.reduce((sum, c) => sum + (Number(c.Total) || 0), 0) || 0;

      // Fetch previous contracts revenue
      const { data: prevContractsData } = await supabase
        .from('Contract')
        .select('Total')
        .gte('Contract Date', dateRanges.previous.start)
        .lte('Contract Date', dateRanges.previous.end);

      const prevContractsRevenue = prevContractsData?.reduce((sum, c) => sum + (Number(c.Total) || 0), 0) || 0;

      // Fetch composite tasks (reinstallation)
      const { data: compositeData } = await supabase
        .from('composite_tasks')
        .select('customer_total, created_at, task_type')
        .gte('created_at', dateRanges.current.start)
        .lte('created_at', dateRanges.current.end)
        .eq('task_type', 'reinstallation');

      const reinstallationRevenue = compositeData?.reduce((sum, t) => sum + (Number(t.customer_total) || 0), 0) || 0;

      // Fetch installation tasks revenue (from composite_tasks)
      const { data: installationData } = await supabase
        .from('composite_tasks')
        .select('customer_installation_cost, created_at')
        .gte('created_at', dateRanges.current.start)
        .lte('created_at', dateRanges.current.end);

      const installationRevenue = installationData?.reduce((sum, t) => sum + (Number(t.customer_installation_cost) || 0), 0) || 0;

      // Fetch printing revenue
      const { data: printingData } = await supabase
        .from('composite_tasks')
        .select('customer_print_cost, created_at')
        .gte('created_at', dateRanges.current.start)
        .lte('created_at', dateRanges.current.end);

      const printingRevenue = printingData?.reduce((sum, t) => sum + (Number(t.customer_print_cost) || 0), 0) || 0;

      // Fetch cutout revenue
      const { data: cutoutData } = await supabase
        .from('composite_tasks')
        .select('customer_cutout_cost, created_at')
        .gte('created_at', dateRanges.current.start)
        .lte('created_at', dateRanges.current.end);

      const cutoutRevenue = cutoutData?.reduce((sum, t) => sum + (Number(t.customer_cutout_cost) || 0), 0) || 0;

      // Fetch operating fees from contracts
      const { data: feesData } = await supabase
        .from('Contract')
        .select('fee, "Contract Date"')
        .gte('Contract Date', dateRanges.current.start)
        .lte('Contract Date', dateRanges.current.end);

      const operatingFeesRevenue = feesData?.reduce((sum, c) => {
        const fee = typeof c.fee === 'string' ? Number(c.fee) : (c.fee || 0);
        return sum + fee;
      }, 0) || 0;

      // Fetch friend rentals profit
      const { data: friendRentalsData } = await supabase
        .from('friend_billboard_rentals')
        .select('profit, created_at')
        .gte('created_at', dateRanges.current.start)
        .lte('created_at', dateRanges.current.end);

      const friendRentalsRevenue = friendRentalsData?.reduce((sum, r) => sum + (Number(r.profit) || 0), 0) || 0;

      // Fetch partnerships revenue (from friend_billboard_rentals as proxy)
      const { data: partnershipsData } = await supabase
        .from('friend_billboard_rentals')
        .select('profit, created_at')
        .gte('created_at', dateRanges.current.start)
        .lte('created_at', dateRanges.current.end);

      // Calculate 50% of friend rentals profit as partnerships estimate
      const partnershipsRevenue = (partnershipsData?.reduce((sum, r) => sum + (Number(r.profit) || 0), 0) || 0) * 0.5;

      // Fetch expenses
      const { data: expensesData } = await supabase
        .from('expenses')
        .select('amount, expense_date')
        .gte('expense_date', dateRanges.current.start)
        .lte('expense_date', dateRanges.current.end);

      const totalExpenses = expensesData?.reduce((sum, e) => sum + (Number(e.amount) || 0), 0) || 0;

      const currentRevenue: RevenueData = {
        contracts: contractsRevenue,
        reinstallation: reinstallationRevenue,
        installation: installationRevenue,
        printing: printingRevenue,
        cutout: cutoutRevenue,
        operatingFees: operatingFeesRevenue,
        friendRentals: friendRentalsRevenue,
        partnerships: partnershipsRevenue,
        total: contractsRevenue + reinstallationRevenue + installationRevenue + printingRevenue + cutoutRevenue + operatingFeesRevenue + friendRentalsRevenue + partnershipsRevenue
      };

      const previousRevenue: RevenueData = {
        contracts: prevContractsRevenue,
        reinstallation: 0,
        installation: 0,
        printing: 0,
        cutout: 0,
        operatingFees: 0,
        friendRentals: 0,
        partnerships: 0,
        total: prevContractsRevenue
      };

      setStats({
        current: currentRevenue,
        previous: previousRevenue,
        expenses: totalExpenses,
        netProfit: currentRevenue.total - totalExpenses
      });

    } catch (error: any) {
      console.error('Error fetching revenue data:', error);
      toast.error('فشل في تحميل بيانات الإيرادات');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(amount);
  };

  const calculateChange = (current: number, previous: number) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
  };

  const getPeriodLabel = () => {
    switch (period) {
      case 'week': return 'أسبوعي';
      case 'month': return 'شهري';
      case 'year': return 'سنوي';
    }
  };

  const revenueItems = stats ? [
    {
      label: 'العقود والاتفاقيات',
      icon: FileText,
      amount: stats.current.contracts,
      color: 'text-blue-600 dark:text-blue-400',
      bgColor: 'bg-blue-500/10 dark:bg-blue-950/30',
      borderColor: 'border-blue-500/20 dark:border-blue-900/40'
    },
    {
      label: 'إعادة التركيب للوحات',
      icon: Wrench,
      amount: stats.current.reinstallation,
      color: 'text-amber-600 dark:text-amber-400',
      bgColor: 'bg-amber-500/10 dark:bg-amber-950/30',
      borderColor: 'border-amber-500/20 dark:border-amber-900/40'
    },
    {
      label: 'تكاليف تركيب الإعلانات',
      icon: Package,
      amount: stats.current.installation,
      color: 'text-emerald-600 dark:text-emerald-400',
      bgColor: 'bg-emerald-500/10 dark:bg-emerald-950/30',
      borderColor: 'border-emerald-500/20 dark:border-emerald-900/40'
    },
    {
      label: 'إيرادات الطباعة الرقمية',
      icon: Printer,
      amount: stats.current.printing,
      color: 'text-purple-600 dark:text-purple-400',
      bgColor: 'bg-purple-500/10 dark:bg-purple-950/30',
      borderColor: 'border-purple-500/20 dark:border-purple-900/40'
    },
    {
      label: 'قص ولصق الفينيل',
      icon: Package,
      amount: stats.current.cutout,
      color: 'text-rose-600 dark:text-rose-400',
      bgColor: 'bg-rose-500/10 dark:bg-rose-950/30',
      borderColor: 'border-rose-500/20 dark:border-rose-900/40'
    },
    {
      label: 'رسوم تشغيل العقود',
      icon: DollarSign,
      amount: stats.current.operatingFees,
      color: 'text-cyan-600 dark:text-cyan-400',
      bgColor: 'bg-cyan-500/10 dark:bg-cyan-950/30',
      borderColor: 'border-cyan-500/20 dark:border-cyan-900/40'
    },
    {
      label: 'إيجار اللوحات (شركات صديقة)',
      icon: Building2,
      amount: stats.current.friendRentals,
      color: 'text-indigo-600 dark:text-indigo-400',
      bgColor: 'bg-indigo-500/10 dark:bg-indigo-950/30',
      borderColor: 'border-indigo-500/20 dark:border-indigo-900/40'
    },
    {
      label: 'إيرادات اللوحات المشتركة',
      icon: Users,
      amount: stats.current.partnerships,
      color: 'text-teal-600 dark:text-teal-400',
      bgColor: 'bg-teal-500/10 dark:bg-teal-950/30',
      borderColor: 'border-teal-500/20 dark:border-teal-900/40'
    }
  ] : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-background">
        <div className="flex flex-col items-center gap-4">
          <BarChart3 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground font-medium">جاري تحميل وتحليل تقرير الإيرادات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-7xl mx-auto" dir="rtl">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/15 p-6 backdrop-blur-sm shadow-sm">
        <div className="absolute right-0 top-0 -z-10 h-32 w-32 rounded-full bg-primary/5 blur-3xl"></div>
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/dashboard')} className="shrink-0 rounded-xl border border-border bg-card">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">تقرير الإيرادات</h1>
              <p className="text-muted-foreground text-sm mt-1">
                تحليل مالي مفصل للواردات، النفقات، ومؤشرات الربحية
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground bg-muted/60 border border-border/60 px-3 py-2 rounded-xl">
            <Calendar className="h-4 w-4 text-primary" />
            <span className="font-numbers">
              {format(new Date(dateRanges.current.start), 'dd MMMM', { locale: ar })} - {format(new Date(dateRanges.current.end), 'dd MMMM yyyy', { locale: ar })}
            </span>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={period} onValueChange={(v) => setPeriod(v as any)} className="w-full space-y-6">
        <TabsList className="grid w-full max-w-md grid-cols-3 bg-muted/50 p-1 rounded-xl">
          <TabsTrigger value="week" className="rounded-lg font-bold">أسبوعي</TabsTrigger>
          <TabsTrigger value="month" className="rounded-lg font-bold">شهري</TabsTrigger>
          <TabsTrigger value="year" className="rounded-lg font-bold">سنوي</TabsTrigger>
        </TabsList>

        <TabsContent value={period} className="space-y-6 outline-none">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
            <Card className="bg-gradient-to-br from-primary/[0.08] to-primary/[0.02] border-primary/20 shadow-sm relative overflow-hidden group">
              <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-primary"></div>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">إجمالي الإيرادات</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl md:text-3xl font-black text-primary font-numbers">{formatCurrency(stats?.current.total || 0)}</span>
                  <span className="text-xs font-bold text-muted-foreground">د.ل</span>
                </div>
                {stats && stats.previous.total > 0 && (
                  <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                    <span className={calculateChange(stats.current.total, stats.previous.total) >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                      {calculateChange(stats.current.total, stats.previous.total).toFixed(1)}%
                    </span>
                    <span className="text-muted-foreground/85">مقارنة بالفترة السابقة</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-rose-500/[0.08] to-rose-500/[0.02] border-rose-500/20 shadow-sm relative overflow-hidden group">
              <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-rose-500"></div>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">إجمالي المصروفات</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl md:text-3xl font-black text-rose-600 dark:text-rose-400 font-numbers">{formatCurrency(stats?.expenses || 0)}</span>
                  <span className="text-xs font-bold text-muted-foreground">د.ل</span>
                </div>
                <div className="mt-2 text-xs font-semibold text-muted-foreground/85">
                  يمثل <span className="font-bold text-rose-600 font-numbers">{((stats?.expenses || 0) / (stats?.current.total || 1) * 100).toFixed(1)}%</span> من الإيرادات
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-emerald-500/[0.08] to-emerald-500/[0.02] border-emerald-500/20 shadow-sm relative overflow-hidden group">
              <div className="absolute right-0 top-0 bottom-0 w-1.5 bg-emerald-500"></div>
              <CardHeader className="pb-3">
                <CardTitle className="text-xs font-bold uppercase tracking-wider text-muted-foreground">صافي الأرباح التشغيلية</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl md:text-3xl font-black text-emerald-600 dark:text-emerald-400 font-numbers">{formatCurrency(stats?.netProfit || 0)}</span>
                  <span className="text-xs font-bold text-muted-foreground">د.ل</span>
                </div>
                <div className="mt-2 text-xs font-semibold text-muted-foreground/85">
                  هامش الربح التشغيلي: <span className="font-bold text-emerald-600 font-numbers">{((stats?.netProfit || 0) / (stats?.current.total || 1) * 100).toFixed(1)}%</span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Revenue Breakdown */}
          <Card className="border-border/60 bg-card/60 shadow-sm">
            <CardHeader className="border-b border-border/40">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" /> تفصيل مصادر الإيرادات التشغيلية
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {revenueItems.map((item, index) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={index}
                      className={`relative overflow-hidden rounded-xl border bg-background/50 p-5 space-y-4 transition-all hover:shadow-sm hover:border-primary/30 ${item.borderColor}`}
                    >
                      <div className="flex items-center justify-between">
                        <div className={`p-2.5 rounded-xl ${item.bgColor} ${item.color}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <Badge variant="outline" className={`font-numbers font-bold text-xs ${item.bgColor} ${item.color} border-none`}>
                          {((item.amount / (stats?.current.total || 1)) * 100).toFixed(1)}%
                        </Badge>
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-bold text-muted-foreground">{item.label}</p>
                        <p className={`text-2xl font-black font-numbers tracking-tight ${item.color}`}>
                          {formatCurrency(item.amount)}
                        </p>
                        <p className="text-[10px] font-bold text-muted-foreground">دينار ليبي</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Performance Indicators */}
          <Card className="border-border/60 bg-card/60 shadow-sm">
            <CardHeader className="border-b border-border/40">
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-primary" /> مؤشرات وتحليلات الأداء المالي
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-6">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="flex items-center justify-between p-4 bg-background border border-border/50 rounded-xl hover:shadow-sm transition-shadow">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-muted-foreground">متوسط الإيراد اليومي</span>
                    <p className="text-[11px] text-muted-foreground/75">إجمالي الواردات مقسوماً على عدد الأيام</p>
                  </div>
                  <span className="text-lg font-black text-primary font-numbers">
                    {formatCurrency((stats?.current.total || 0) / (period === 'week' ? 7 : period === 'month' ? 30 : 365))} <span className="text-xs font-bold text-muted-foreground">د.ل</span>
                  </span>
                </div>

                <div className="flex items-center justify-between p-4 bg-background border border-border/50 rounded-xl hover:shadow-sm transition-shadow">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-muted-foreground">أكبر مصدر للإيرادات</span>
                    <p className="text-[11px] text-muted-foreground/75">القسم الأكثر تحقيقاً للواردات حالياً</p>
                  </div>
                  <span className="text-sm font-extrabold text-primary">
                    {revenueItems.reduce((max, item) => item.amount > max.amount ? item : max, revenueItems[0])?.label || 'لا يوجد'}
                  </span>
                </div>

                <div className="flex items-center justify-between p-4 bg-background border border-border/50 rounded-xl hover:shadow-sm transition-shadow">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-muted-foreground">معدل صافي الربحية</span>
                    <p className="text-[11px] text-muted-foreground/75">نسبة الربح بعد تصفية المصروفات</p>
                  </div>
                  <span className="text-lg font-black text-emerald-600 dark:text-emerald-400 font-numbers">
                    {((stats?.netProfit || 0) / (stats?.current.total || 1) * 100).toFixed(2)}%
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}