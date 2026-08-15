import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  TrendingUp, TrendingDown, DollarSign, Building2, Users, Search,
  Download, Filter, BarChart3, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format, subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { ar } from 'date-fns/locale';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from 'recharts';

interface BillboardProfit {
  id: number;
  name: string;
  size: string;
  city: string;
  revenue: number;
  costs: number;
  profit: number;
  margin: number;
  contracts: number;
}

interface CustomerProfit {
  id: string;
  name: string;
  revenue: number;
  costs: number;
  profit: number;
  margin: number;
  contracts: number;
  billboards: number;
}

const ProfitabilityReports = () => {
  const [tab, setTab] = useState('billboards');
  const [period, setPeriod] = useState('current');
  const [search, setSearch] = useState('');
  const [billboardProfits, setBillboardProfits] = useState<BillboardProfit[]>([]);
  const [customerProfits, setCustomerProfits] = useState<CustomerProfit[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, [period]);

  const getDateRange = () => {
    const now = new Date();
    if (period === 'current') return { start: format(startOfMonth(now), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
    if (period === 'last') {
      const last = subMonths(now, 1);
      return { start: format(startOfMonth(last), 'yyyy-MM-dd'), end: format(endOfMonth(last), 'yyyy-MM-dd') };
    }
    if (period === 'quarter') return { start: format(startOfMonth(subMonths(now, 2)), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
    return { start: format(startOfMonth(subMonths(now, 11)), 'yyyy-MM-dd'), end: format(endOfMonth(now), 'yyyy-MM-dd') };
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const { start, end } = getDateRange();

      const [billboardsRes, contractsRes, costCentersRes] = await Promise.all([
        supabase.from('billboards').select('ID, Billboard_Name, Size, City, Price'),
        supabase.from('Contract').select('Contract_Number, "Customer Name", customer_id, Total, "Total Rent", installation_cost, billboard_ids, billboards_count, "Contract Date", "End Date"')
          .gte('"Contract Date"', start).lte('"Contract Date"', end),
        supabase.from('billboard_cost_centers').select('billboard_id, cost_type, amount'),
      ]);

      const billboards = billboardsRes.data || [];
      const contracts = contractsRes.data || [];
      const costCenters = costCentersRes.data || [];

      // Cost per billboard from cost centers
      const costMap: Record<number, number> = {};
      costCenters.forEach(cc => {
        costMap[cc.billboard_id] = (costMap[cc.billboard_id] || 0) + (cc.amount || 0);
      });

      // Billboard profits
      const bbMap: Record<number, BillboardProfit> = {};
      billboards.forEach(b => {
        bbMap[b.ID] = {
          id: b.ID,
          name: b.Billboard_Name || `لوحة ${b.ID}`,
          size: b.Size || '',
          city: b.City || '',
          revenue: 0,
          costs: costMap[b.ID] || 0,
          profit: 0,
          margin: 0,
          contracts: 0,
        };
      });

      // Customer profits
      const custMap: Record<string, CustomerProfit> = {};

      contracts.forEach(c => {
        const ids = c.billboard_ids ? c.billboard_ids.split(',').map((s: string) => parseInt(s.trim())).filter((n: number) => !isNaN(n)) : [];
        const perBillboard = ids.length > 0 ? (c.Total || 0) / ids.length : 0;
        const installPerBb = ids.length > 0 ? (c.installation_cost || 0) / ids.length : 0;

        ids.forEach((bid: number) => {
          if (bbMap[bid]) {
            bbMap[bid].revenue += perBillboard;
            bbMap[bid].costs += installPerBb;
            bbMap[bid].contracts += 1;
          }
        });

        const custKey = c.customer_id || c['Customer Name'] || 'unknown';
        if (!custMap[custKey]) {
          custMap[custKey] = {
            id: custKey,
            name: c['Customer Name'] || 'غير محدد',
            revenue: 0, costs: 0, profit: 0, margin: 0, contracts: 0, billboards: 0,
          };
        }
        custMap[custKey].revenue += c.Total || 0;
        custMap[custKey].costs += c.installation_cost || 0;
        custMap[custKey].contracts += 1;
        custMap[custKey].billboards += ids.length;
      });

      // Calculate profits
      Object.values(bbMap).forEach(bb => {
        bb.profit = bb.revenue - bb.costs;
        bb.margin = bb.revenue > 0 ? (bb.profit / bb.revenue) * 100 : 0;
      });
      Object.values(custMap).forEach(cp => {
        cp.profit = cp.revenue - cp.costs;
        cp.margin = cp.revenue > 0 ? (cp.profit / cp.revenue) * 100 : 0;
      });

      setBillboardProfits(Object.values(bbMap).filter(b => b.revenue > 0 || b.costs > 0).sort((a, b) => b.profit - a.profit));
      setCustomerProfits(Object.values(custMap).sort((a, b) => b.profit - a.profit));
    } catch (err) {
      console.error('Profitability fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  const filteredBillboards = billboardProfits.filter(b =>
    b.name.includes(search) || b.city.includes(search) || b.size.includes(search)
  );
  const filteredCustomers = customerProfits.filter(c => c.name.includes(search));

  const totalRevenue = (tab === 'billboards' ? filteredBillboards : filteredCustomers).reduce((s, i) => s + i.revenue, 0);
  const totalCosts = (tab === 'billboards' ? filteredBillboards : filteredCustomers).reduce((s, i) => s + i.costs, 0);
  const totalProfit = totalRevenue - totalCosts;
  const overallMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

  // Chart data - top 10
  const chartData = (tab === 'billboards' ? filteredBillboards : filteredCustomers).slice(0, 10).map(i => ({
    name: i.name.length > 15 ? i.name.substring(0, 15) + '...' : i.name,
    profit: i.profit,
  }));

  const periodLabel = {
    current: format(new Date(), 'MMMM yyyy', { locale: ar }),
    last: format(subMonths(new Date(), 1), 'MMMM yyyy', { locale: ar }),
    quarter: 'آخر 3 أشهر',
    year: 'آخر سنة',
  }[period] || '';

  return (
    <div className="space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <BarChart3 className="h-7 w-7 text-primary" />
            تقارير الربحية
          </h1>
          <p className="text-muted-foreground text-sm mt-1">تحليل صافي الربح لكل لوحة وعميل — {periodLabel}</p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={period} onValueChange={setPeriod}>
            <SelectTrigger className="w-32 sm:w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="current">الشهر الحالي</SelectItem>
              <SelectItem value="last">الشهر السابق</SelectItem>
              <SelectItem value="quarter">آخر 3 أشهر</SelectItem>
              <SelectItem value="year">آخر سنة</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'الإيراد', value: totalRevenue, icon: DollarSign, color: 'text-primary' },
          { label: 'التكاليف', value: totalCosts, icon: TrendingDown, color: 'text-orange-600 dark:text-orange-400' },
          { label: 'صافي الربح', value: totalProfit, icon: TrendingUp, color: totalProfit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600' },
          { label: 'هامش الربح', value: overallMargin, icon: BarChart3, color: overallMargin >= 50 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600', isCurrency: false },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label} className="border-border/50">
              <CardContent className="pt-4 pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <Icon className={`h-4 w-4 ${s.color}`} />
                  <span className="text-xs text-muted-foreground">{s.label}</span>
                </div>
                <p className={`text-lg font-bold ${s.color}`}>
                  {s.isCurrency === false ? `${s.value.toFixed(1)}%` : `${s.value.toLocaleString('ar-LY')} د.ل`}
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-col md:flex-row md:items-center gap-4 mb-4">
          <TabsList>
            <TabsTrigger value="billboards" className="gap-1">
              <Building2 className="h-4 w-4" />
              حسب اللوحة
            </TabsTrigger>
            <TabsTrigger value="customers" className="gap-1">
              <Users className="h-4 w-4" />
              حسب العميل
            </TabsTrigger>
          </TabsList>
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pr-9"
            />
          </div>
        </div>

        {/* Chart */}
        {chartData.length > 0 && (
          <Card className="border-border/50 mb-4">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-muted-foreground">
                أعلى 10 {tab === 'billboards' ? 'لوحات' : 'عملاء'} ربحية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={chartData} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis type="number" fontSize={11} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
                  <YAxis type="category" dataKey="name" fontSize={11} width={120} />
                  <Tooltip formatter={(v: number) => `${v.toLocaleString('ar-LY')} د.ل`} />
                  <Bar dataKey="profit" name="صافي الربح" radius={[0, 4, 4, 0]}>
                    {chartData.map((entry, i) => (
                      <Cell key={i} fill={entry.profit >= 0 ? 'hsl(142 76% 36%)' : 'hsl(var(--destructive))'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        {/* Tables */}
        <TabsContent value="billboards">
          <Card className="border-border/50">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="p-3 text-right font-medium">#</th>
                      <th className="p-3 text-right font-medium">اللوحة</th>
                      <th className="p-3 text-right font-medium">المقاس</th>
                      <th className="p-3 text-right font-medium">المدينة</th>
                      <th className="p-3 text-right font-medium">الإيراد</th>
                      <th className="p-3 text-right font-medium">التكاليف</th>
                      <th className="p-3 text-right font-medium">صافي الربح</th>
                      <th className="p-3 text-right font-medium">الهامش</th>
                      <th className="p-3 text-right font-medium">العقود</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">جاري التحميل...</td></tr>
                    ) : filteredBillboards.length === 0 ? (
                      <tr><td colSpan={9} className="p-8 text-center text-muted-foreground">لا توجد بيانات</td></tr>
                    ) : (
                      filteredBillboards.map((b, i) => (
                        <tr key={b.id} className="border-b hover:bg-muted/20 transition-colors">
                          <td className="p-3 text-muted-foreground">{i + 1}</td>
                          <td className="p-3 font-medium">{b.name}</td>
                          <td className="p-3">{b.size}</td>
                          <td className="p-3">{b.city}</td>
                          <td className="p-3 text-primary font-medium">{b.revenue.toLocaleString('ar-LY')}</td>
                          <td className="p-3 text-orange-600 dark:text-orange-400">{b.costs.toLocaleString('ar-LY')}</td>
                          <td className={`p-3 font-bold ${b.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600'}`}>
                            {b.profit.toLocaleString('ar-LY')}
                          </td>
                          <td className="p-3">
                            <Badge variant={b.margin >= 50 ? 'default' : b.margin >= 0 ? 'secondary' : 'destructive'} className="text-xs">
                              {b.margin.toFixed(1)}%
                            </Badge>
                          </td>
                          <td className="p-3">{b.contracts}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers">
          <Card className="border-border/50">
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b bg-muted/30">
                      <th className="p-3 text-right font-medium">#</th>
                      <th className="p-3 text-right font-medium">العميل</th>
                      <th className="p-3 text-right font-medium">الإيراد</th>
                      <th className="p-3 text-right font-medium">التكاليف</th>
                      <th className="p-3 text-right font-medium">صافي الربح</th>
                      <th className="p-3 text-right font-medium">الهامش</th>
                      <th className="p-3 text-right font-medium">العقود</th>
                      <th className="p-3 text-right font-medium">اللوحات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {loading ? (
                      <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">جاري التحميل...</td></tr>
                    ) : filteredCustomers.length === 0 ? (
                      <tr><td colSpan={8} className="p-8 text-center text-muted-foreground">لا توجد بيانات</td></tr>
                    ) : (
                      filteredCustomers.map((c, i) => (
                        <tr key={c.id} className="border-b hover:bg-muted/20 transition-colors">
                          <td className="p-3 text-muted-foreground">{i + 1}</td>
                          <td className="p-3 font-medium">{c.name}</td>
                          <td className="p-3 text-primary font-medium">{c.revenue.toLocaleString('ar-LY')}</td>
                          <td className="p-3 text-orange-600 dark:text-orange-400">{c.costs.toLocaleString('ar-LY')}</td>
                          <td className={`p-3 font-bold ${c.profit >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600'}`}>
                            {c.profit.toLocaleString('ar-LY')}
                          </td>
                          <td className="p-3">
                            <Badge variant={c.margin >= 50 ? 'default' : c.margin >= 0 ? 'secondary' : 'destructive'} className="text-xs">
                              {c.margin.toFixed(1)}%
                            </Badge>
                          </td>
                          <td className="p-3">{c.contracts}</td>
                          <td className="p-3">{c.billboards}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfitabilityReports;
