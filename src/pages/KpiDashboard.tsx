import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Target, TrendingUp, TrendingDown, Percent, Building2, DollarSign,
  CheckCircle2, AlertTriangle, BarChart3, PieChart, Activity, Wallet,
  ArrowUpRight, ArrowDownRight, Layers, Users, Calendar
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ar } from 'date-fns/locale';
import { PieChart as RechartsPie, Pie, Cell, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Legend, LineChart, Line } from 'recharts';

const COLORS = ['hsl(var(--primary))', 'hsl(var(--destructive))', 'hsl(142 76% 36%)', 'hsl(38 92% 50%)', 'hsl(262 83% 58%)', 'hsl(199 89% 48%)'];

const KPI_TARGETS = {
  occupancyRate: 80,
  netProfitMargin: 50,
  collectionRate: 90,
};

interface KpiData {
  totalBillboards: number;
  occupiedBillboards: number;
  availableBillboards: number;
  maintenanceBillboards: number;
  grossRevenue: number;
  totalCosts: number;
  netProfit: number;
  totalInvoiced: number;
  totalCollected: number;
  occupancyRate: number;
  profitMargin: number;
  collectionRate: number;
  revenueByMonth: { month: string; revenue: number; costs: number; profit: number }[];
  costBreakdown: { name: string; value: number }[];
  topCustomers: { name: string; revenue: number; contracts: number }[];
}

const KpiDashboard = () => {
  const [kpiData, setKpiData] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('6');

  useEffect(() => {
    fetchKpiData();
  }, [period]);

  const fetchKpiData = async () => {
    setLoading(true);
    try {
      const monthsBack = parseInt(period);
      const startDate = format(startOfMonth(subMonths(new Date(), monthsBack - 1)), 'yyyy-MM-dd');
      const endDate = format(endOfMonth(new Date()), 'yyyy-MM-dd');

      // Parallel queries
      const [billboardsRes, contractsRes, paymentsRes, costCentersRes] = await Promise.all([
        supabase.from('billboards').select('ID, Status, Size, Level, Price, City, friend_company_id, maintenance_status, maintenance_type, is_visible_in_available, Contract_Number, Rent_End_Date'),
        supabase.from('Contract').select('Contract_Number, "Customer Name", "Ad Type", Total, "Total Rent", Discount, installation_cost, "Contract Date", "End Date", customer_id, billboards_count, billboard_prices').gte('End Date', startDate),
        supabase.from('customer_payments').select('amount, entry_type, paid_at, customer_name').gte('paid_at', startDate).lte('paid_at', endDate),
        supabase.from('billboard_cost_centers').select('billboard_id, cost_type, amount, frequency'),
      ]);

      const rawBillboards = billboardsRes.data || [];
      const contracts = contractsRes.data || [];
      const payments = paymentsRes.data || [];
      const costCenters = costCentersRes.data || [];

      // Helpers to exclude friendly, removed, hidden, and societ/debus size
      const isDeBusSociet = (b: any): boolean => {
        const size = String(b.Size || '').trim().toLowerCase();
        return size === 'سوسيت' || size === '2.5x4' || size === '2.5x4 ' || size.includes('سوسيت') || size.includes('دي باس') || size.includes('دي باص') || size.includes('debus') || size.includes('de-bus');
      };

      const isBillboardRemoved = (b: any): boolean => {
        const status = (b.Status || '').toString().trim().toLowerCase();
        const maintenanceStatus = String(b.maintenance_status || '').trim().toLowerCase();
        const maintenanceType = String(b.maintenance_type || '').trim();
        
        return (
          status === 'إزالة' || status === 'ازالة' || status === 'removed' ||
          maintenanceStatus === 'removed' || maintenanceStatus === 'تمت الإزالة' ||
          maintenanceStatus === 'تحتاج ازالة لغرض التطوير' || maintenanceStatus === 'لم يتم التركيب' ||
          maintenanceType === 'تمت الإزالة' || maintenanceType === 'تحتاج إزالة' || maintenanceType === 'لم يتم التركيب'
        );
      };

      // Filtered billboards for stats
      const billboards = rawBillboards.filter(b => {
        if (b.friend_company_id) return false;
        if (isBillboardRemoved(b)) return false;
        if (b.is_visible_in_available === false) return false;
        if (isDeBusSociet(b)) return false;
        return true;
      });

      // Billboard stats
      const totalBillboards = billboards.length;
      const occupiedBillboards = billboards.filter(b => b.Status === 'محجوز' || b.Status === 'مؤجر').length;
      const availableBillboards = billboards.filter(b => b.Status === 'متاح').length;
      const maintenanceBillboards = billboards.filter(b => b.Status === 'صيانة').length;

      // Map of billboard ID -> billboard object for easy lookup
      const billboardMap: Record<number, any> = {};
      rawBillboards.forEach(b => { billboardMap[Number(b.ID)] = b; });

      // Helper to calculate contract revenue adjusted for exclusions
      const getAdjustedContractRevenue = (c: any) => {
        let contractRevenue = 0;
        let distributed = false;

        if (c.billboard_prices) {
          try {
            const prices = typeof c.billboard_prices === 'string' ? JSON.parse(c.billboard_prices) : c.billboard_prices;
            if (Array.isArray(prices) && prices.length > 0) {
              prices.forEach((p: any) => {
                const bbId = Number(p.billboardId);
                const bbPrice = Number(p.contractPrice || p.priceAfterDiscount || p.totalBillboardPrice || 0);
                const bb = billboardMap[bbId];
                if (bb) {
                  const size = String(bb.Size || '').trim().toLowerCase();
                  const isSociet = size === 'سوسيت' || size === '2.5x4' || size === '2.5x4 ' || size.includes('سوسيت') || size.includes('دي باس') || size.includes('دي باص') || size.includes('debus') || size.includes('de-bus');
                  const isRemoved = isBillboardRemoved(bb);
                  const isHidden = bb.is_visible_in_available === false;
                  
                  if (!isRemoved && !isHidden && !isSociet && !bb.friend_company_id) {
                    contractRevenue += bbPrice;
                    distributed = true;
                  }
                }
              });
            }
          } catch (e) {}
        }

        if (!distributed) {
          const associatedBillboards = rawBillboards.filter(b => Number(b.Contract_Number) === Number(c.Contract_Number));
          if (associatedBillboards.length > 0) {
            const share = (Number(c.Total) || Number(c['Total Rent']) || 0) / associatedBillboards.length;
            associatedBillboards.forEach(bb => {
              const size = String(bb.Size || '').trim().toLowerCase();
              const isSociet = size === 'سوسيت' || size === '2.5x4' || size === '2.5x4 ' || size.includes('سوسيت') || size.includes('دي باس') || size.includes('دي باص') || size.includes('debus') || size.includes('de-bus');
              const isRemoved = isBillboardRemoved(bb);
              const isHidden = bb.is_visible_in_available === false;

              if (!isRemoved && !isHidden && !isSociet && !bb.friend_company_id) {
                contractRevenue += share;
              }
            });
          } else {
            contractRevenue = Number(c.Total) || Number(c['Total Rent']) || 0;
          }
        }
        return contractRevenue;
      };

      // Revenue
      const grossRevenue = contracts.reduce((sum, c) => sum + getAdjustedContractRevenue(c), 0);

      // Costs from cost centers
      const activeBillboardIds = new Set(billboards.map(b => b.ID));
      const filteredCostCenters = costCenters.filter(cc => activeBillboardIds.has(cc.billboard_id));
      const totalCostCenterCosts = filteredCostCenters.reduce((sum, cc) => {
        return sum + (cc.amount || 0);
      }, 0);

      // Installation + discount costs from contracts
      const installationCosts = contracts.reduce((sum, c) => sum + (c.installation_cost || 0), 0);
      const totalCosts = totalCostCenterCosts + installationCosts;

      const netProfit = grossRevenue - totalCosts;

      // Collection
      const receiptPayments = payments.filter(p => p.entry_type === 'receipt' || p.entry_type === 'payment' || p.entry_type === 'account_payment');
      const totalCollected = receiptPayments.reduce((sum, p) => sum + (p.amount || 0), 0);
      const totalInvoiced = grossRevenue;

      // KPIs
      const occupancyRate = totalBillboards > 0 ? (occupiedBillboards / totalBillboards) * 100 : 0;
      const profitMargin = grossRevenue > 0 ? (netProfit / grossRevenue) * 100 : 0;
      const collectionRate = totalInvoiced > 0 ? (totalCollected / totalInvoiced) * 100 : 0;

      // Revenue by month
      const revenueByMonth: { month: string; revenue: number; costs: number; profit: number }[] = [];
      for (let i = monthsBack - 1; i >= 0; i--) {
        const monthDate = subMonths(new Date(), i);
        const monthStr = format(monthDate, 'yyyy-MM');
        const monthLabel = format(monthDate, 'MMM yyyy', { locale: ar });
        
        const monthContracts = contracts.filter(c => {
          const contractDate = c['Contract Date'];
          return contractDate && contractDate.startsWith(monthStr);
        });
        const monthRevenue = monthContracts.reduce((s, c) => s + getAdjustedContractRevenue(c), 0);
        const monthCost = monthContracts.reduce((s, c) => s + (c.installation_cost || 0), 0);
        
        revenueByMonth.push({
          month: monthLabel,
          revenue: monthRevenue,
          costs: monthCost,
          profit: monthRevenue - monthCost,
        });
      }

      // Cost breakdown
      const costTypeMap: Record<string, number> = {};
      costCenters.forEach(cc => {
        const label = {
          land_rent: 'إيجار أرض',
          manufacturing: 'تصنيع',
          maintenance: 'صيانة',
          printing: 'طباعة',
          installation: 'تركيب',
          other: 'أخرى'
        }[cc.cost_type] || cc.cost_type;
        costTypeMap[label] = (costTypeMap[label] || 0) + (cc.amount || 0);
      });
      if (installationCosts > 0) {
        costTypeMap['تركيب (عقود)'] = (costTypeMap['تركيب (عقود)'] || 0) + installationCosts;
      }
      const costBreakdown = Object.entries(costTypeMap).map(([name, value]) => ({ name, value }));

      // Top customers
      const customerMap: Record<string, { revenue: number; contracts: number }> = {};
      contracts.forEach(c => {
        const name = c['Customer Name'] || 'غير محدد';
        if (!customerMap[name]) customerMap[name] = { revenue: 0, contracts: 0 };
        customerMap[name].revenue += c.Total || 0;
        customerMap[name].contracts += 1;
      });
      const topCustomers = Object.entries(customerMap)
        .map(([name, data]) => ({ name, ...data }))
        .sort((a, b) => b.revenue - a.revenue)
        .slice(0, 5);

      setKpiData({
        totalBillboards, occupiedBillboards, availableBillboards, maintenanceBillboards,
        grossRevenue, totalCosts, netProfit, totalInvoiced, totalCollected,
        occupancyRate, profitMargin, collectionRate,
        revenueByMonth, costBreakdown, topCustomers,
      });
    } catch (err) {
      console.error('KPI fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const getKpiStatus = (value: number, target: number) => {
    if (value >= target) return { color: 'text-green-600 dark:text-green-400', bg: 'bg-green-500/10', icon: CheckCircle2, label: 'ممتاز' };
    if (value >= target * 0.75) return { color: 'text-yellow-600 dark:text-yellow-400', bg: 'bg-yellow-500/10', icon: AlertTriangle, label: 'متوسط' };
    return { color: 'text-red-600 dark:text-red-400', bg: 'bg-red-500/10', icon: TrendingDown, label: 'ضعيف' };
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary" />
      </div>
    );
  }

  if (!kpiData) return null;

  const kpis = [
    {
      title: 'نسبة الإشغال',
      value: kpiData.occupancyRate,
      target: KPI_TARGETS.occupancyRate,
      suffix: '%',
      icon: Building2,
      detail: `${kpiData.occupiedBillboards} من ${kpiData.totalBillboards} لوحة`,
    },
    {
      title: 'هامش صافي الربح',
      value: kpiData.profitMargin,
      target: KPI_TARGETS.netProfitMargin,
      suffix: '%',
      icon: TrendingUp,
      detail: `${kpiData.netProfit.toLocaleString('ar-LY')} د.ل صافي`,
    },
    {
      title: 'معدل التحصيل',
      value: kpiData.collectionRate,
      target: KPI_TARGETS.collectionRate,
      suffix: '%',
      icon: Wallet,
      detail: `${kpiData.totalCollected.toLocaleString('ar-LY')} من ${kpiData.totalInvoiced.toLocaleString('ar-LY')} د.ل`,
    },
  ];

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Target className="h-7 w-7 text-primary" />
            لوحة قيادة مؤشرات الأداء
          </h1>
          <p className="text-muted-foreground text-sm mt-1">تحليل شامل للأداء التشغيلي والمالي</p>
        </div>
        <Select value={period} onValueChange={setPeriod}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="3">آخر 3 أشهر</SelectItem>
            <SelectItem value="6">آخر 6 أشهر</SelectItem>
            <SelectItem value="12">آخر سنة</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {kpis.map((kpi) => {
          const status = getKpiStatus(kpi.value, kpi.target);
          const StatusIcon = status.icon;
          const KpiIcon = kpi.icon;
          return (
            <Card key={kpi.title} className="border-border/50">
              <CardContent className="pt-6">
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-2.5 rounded-xl ${status.bg}`}>
                    <KpiIcon className={`h-5 w-5 ${status.color}`} />
                  </div>
                  <Badge variant="outline" className={status.color}>
                    <StatusIcon className="h-3 w-3 ml-1" />
                    {status.label}
                  </Badge>
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">{kpi.title}</p>
                  <p className={`text-3xl font-bold ${status.color}`}>
                    {kpi.value.toFixed(1)}{kpi.suffix}
                  </p>
                  <Progress value={Math.min(kpi.value, 100)} className="h-2" />
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>{kpi.detail}</span>
                    <span>الهدف: {kpi.target}{kpi.suffix}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Financial Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { title: 'إجمالي الإيراد', value: kpiData.grossRevenue, icon: DollarSign, color: 'text-primary' },
          { title: 'إجمالي التكاليف', value: kpiData.totalCosts, icon: Layers, color: 'text-orange-600 dark:text-orange-400' },
          { title: 'صافي الربح', value: kpiData.netProfit, icon: TrendingUp, color: kpiData.netProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400' },
          { title: 'المحصّل', value: kpiData.totalCollected, icon: Wallet, color: 'text-blue-600 dark:text-blue-400' },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.title} className="border-border/50">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted/50">
                    <Icon className={`h-4 w-4 ${item.color}`} />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">{item.title}</p>
                    <p className={`text-lg font-bold ${item.color}`}>
                      {item.value.toLocaleString('ar-LY')} <span className="text-xs">د.ل</span>
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue Trend */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              الإيرادات والتكاليف الشهرية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={kpiData.revenueByMonth}>
                <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                <XAxis dataKey="month" fontSize={11} />
                <YAxis fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                <Tooltip formatter={(v: number) => `${v.toLocaleString('ar-LY')} د.ل`} />
                <Legend />
                <Bar dataKey="revenue" name="الإيراد" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="costs" name="التكاليف" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                <Bar dataKey="profit" name="الربح" fill="hsl(142 76% 36%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Cost Breakdown Pie */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <PieChart className="h-4 w-4 text-primary" />
              توزيع التكاليف
            </CardTitle>
          </CardHeader>
          <CardContent>
            {kpiData.costBreakdown.length > 0 ? (
              <ResponsiveContainer width="100%" height={280}>
                <RechartsPie>
                  <Pie
                    data={kpiData.costBreakdown}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={100}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine
                  >
                    {kpiData.costBreakdown.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => `${v.toLocaleString('ar-LY')} د.ل`} />
                </RechartsPie>
              </ResponsiveContainer>
            ) : (
              <div className="h-[280px] flex items-center justify-center text-muted-foreground text-sm">
                <div className="text-center">
                  <Layers className="h-10 w-10 mx-auto mb-2 opacity-30" />
                  <p>لا توجد بيانات تكاليف مسجلة</p>
                  <p className="text-xs mt-1">أضف تكاليف في مركز تكلفة اللوحات</p>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Billboard Status + Top Customers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Billboard Status */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Building2 className="h-4 w-4 text-primary" />
              حالة اللوحات
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { label: 'مؤجرة/محجوزة', count: kpiData.occupiedBillboards, color: 'bg-green-500', pct: (kpiData.occupiedBillboards / kpiData.totalBillboards) * 100 },
                { label: 'متاحة', count: kpiData.availableBillboards, color: 'bg-blue-500', pct: (kpiData.availableBillboards / kpiData.totalBillboards) * 100 },
                { label: 'صيانة', count: kpiData.maintenanceBillboards, color: 'bg-orange-500', pct: (kpiData.maintenanceBillboards / kpiData.totalBillboards) * 100 },
              ].map((s) => (
                <div key={s.label} className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${s.color}`} />
                  <span className="text-sm flex-1">{s.label}</span>
                  <span className="font-bold text-sm">{s.count}</span>
                  <span className="text-xs text-muted-foreground w-12 text-left">{s.pct.toFixed(0)}%</span>
                </div>
              ))}
              <div className="border-t pt-2 flex justify-between font-bold text-sm">
                <span>الإجمالي</span>
                <span>{kpiData.totalBillboards} لوحة</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Top Customers */}
        <Card className="border-border/50">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="h-4 w-4 text-primary" />
              أعلى العملاء إيراداً
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {kpiData.topCustomers.map((c, i) => (
                <div key={c.name} className="flex items-center gap-3">
                  <span className="w-6 h-6 rounded-full bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">
                    {i + 1}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{c.name}</p>
                    <p className="text-xs text-muted-foreground">{c.contracts} عقد</p>
                  </div>
                  <span className="font-bold text-sm text-primary">
                    {c.revenue.toLocaleString('ar-LY')} د.ل
                  </span>
                </div>
              ))}
              {kpiData.topCustomers.length === 0 && (
                <p className="text-sm text-muted-foreground text-center py-4">لا توجد بيانات</p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default KpiDashboard;
