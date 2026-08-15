import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { 
  MapPin, BarChart3, TrendingUp, Loader2, Calendar, 
  Building2, DollarSign, Layers, Filter, Download, ChevronDown, ChevronUp
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import MunicipalityStatementPrint from '@/components/municipality/MunicipalityStatementPrint';
import { 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, 
  ResponsiveContainer, PieChart, Pie, Cell, Legend 
} from 'recharts';

interface MuniStats {
  municipality: string;
  totalBillboards: number;
  rentedBillboards: number;
  availableBillboards: number;
  activeContracts: number;
  totalRevenue: number;
  totalInstallation: number;
  totalPrint: number;
  netRevenue: number;
  occupancyRate: number;
}

const COLORS = [
  'hsl(var(--primary))',
  'hsl(210, 70%, 55%)',
  'hsl(150, 60%, 45%)',
  'hsl(35, 85%, 55%)',
  'hsl(0, 65%, 55%)',
  'hsl(270, 60%, 55%)',
  'hsl(180, 55%, 45%)',
  'hsl(320, 60%, 55%)',
  'hsl(60, 70%, 45%)',
  'hsl(100, 50%, 45%)',
];

const formatCurrency = (val: number) => {
  if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
  if (val >= 1000) return `${(val / 1000).toFixed(0)}K`;
  return val.toLocaleString();
};

const MunicipalityStats = () => {
  const [loading, setLoading] = useState(true);
  const [billboards, setBillboards] = useState<any[]>([]);
  const [contracts, setContracts] = useState<any[]>([]);
  const [municipalityOrder, setMunicipalityOrder] = useState<Record<string, number>>({});
  const [expandedMuni, setExpandedMuni] = useState<string | null>(null);
  
  // Date filters
  const [dateMode, setDateMode] = useState<'all' | 'range' | 'year' | 'month'>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear().toString());

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const [bbRes, contractRes, muniRes, historyRes] = await Promise.all([
          supabase.from('billboards').select('ID, Billboard_Name, Municipality, Contract_Number, Status, Size, Level, maintenance_status, maintenance_type, Image_URL, Nearest_Landmark, Ad_Type, Customer_Name, design_face_a, design_face_b, Faces_Count, friend_company_id, is_visible_in_available'),
          supabase.from('Contract').select('Contract_Number, "Contract Date", "End Date", "Total Rent", Total, Discount, installation_cost, print_cost, billboard_prices, "Customer Name", "Ad Type", include_installation_in_price, include_print_in_billboard_price'),
          supabase.from('municipalities').select('name, sort_order').order('sort_order'),
          supabase.from('billboard_history').select('billboard_id, contract_number, design_face_a_url, design_face_b_url, installed_image_face_a_url, installed_image_face_b_url'),
        ]);
        
        setBillboards(bbRes.data || []);
        setContracts(contractRes.data || []);
        
        // Build history map: billboard_id -> history data
        const histMap: Record<string, any> = {};
        (historyRes.data || []).forEach((h: any) => {
          const key = `${h.billboard_id}_${h.contract_number}`;
          histMap[key] = h;
        });
        (window as any).__bbHistoryMap = histMap;
        
        const mOrd: Record<string, number> = {};
        (muniRes.data || []).forEach((m: any) => { mOrd[m.name] = m.sort_order ?? 999; });
        setMunicipalityOrder(mOrd);
      } catch (err) {
        console.error(err);
        toast.error('فشل في تحميل البيانات');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  // Filter contracts by date
  const filteredContracts = useMemo(() => {
    if (dateMode === 'all') return contracts;
    
    return contracts.filter((c: any) => {
      const contractDate = c['Contract Date'];
      if (!contractDate) return false;
      
      const d = new Date(contractDate);
      
      if (dateMode === 'year') {
        return d.getFullYear().toString() === selectedYear;
      }
      if (dateMode === 'month') {
        const yearMonth = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
        const selMonth = startDate?.slice(0, 7);
        return yearMonth === selMonth;
      }
      if (dateMode === 'range') {
        if (startDate && d < new Date(startDate)) return false;
        if (endDate && d > new Date(endDate)) return false;
        return true;
      }
      return true;
    });
  }, [contracts, dateMode, startDate, endDate, selectedYear]);

  // Contract lookup by number
  const contractMap = useMemo(() => {
    const map: Record<number, any> = {};
    filteredContracts.forEach((c: any) => { map[c.Contract_Number] = c; });
    return map;
  }, [filteredContracts]);

  // Non-removed, visible, own, and non-debus/societ billboards
  const activeBillboards = useMemo(() => {
    return billboards.filter((b: any) => {
      // Exclude friendly
      if (b.friend_company_id) return false;
      // Exclude hidden
      if (b.is_visible_in_available === false) return false;
      // Exclude debus/societ size
      const size = String(b.Size || '').trim().toLowerCase();
      const isSociet = size === 'سوسيت' || size === '2.5x4' || size === '2.5x4 ' || size.includes('سوسيت') || size.includes('دي باس') || size.includes('دي باص') || size.includes('debus') || size.includes('de-bus');
      if (isSociet) return false;
      
      // Exclude removed
      const s = String(b.Status ?? '').trim();
      const ms = String(b.maintenance_status ?? '').trim();
      const mt = String(b.maintenance_type ?? '').trim();
      const isRemoved = s === 'إزالة' || s === 'ازالة' || s.toLowerCase() === 'removed' || ms === 'removed' || mt === 'تمت الإزالة' || ms === 'تمت الإزالة' || ms === 'تحتاج ازالة لغرض التطوير' || ms === 'لم يتم التركيب' || mt === 'تحتاج إزالة' || mt === 'لم يتم التركيب';
      return !isRemoved;
    });
  }, [billboards]);

  // Parse billboard_prices from contracts into a per-billboard price map
  const billboardPriceMap = useMemo(() => {
    const map: Record<number, { rent: number; printCost: number; installationCost: number; total: number }> = {};
    for (const c of filteredContracts) {
      if (!c.billboard_prices) continue;
      try {
        const prices = typeof c.billboard_prices === 'string' ? JSON.parse(c.billboard_prices) : c.billboard_prices;
        if (Array.isArray(prices)) {
          const bbCount = prices.length || 1;
          const includeInstall = c.include_installation_in_price === true;
          const includePrint = c.include_print_in_billboard_price === true;
          const contractInstall = (c.installation_cost || 0) / bbCount;
          const contractPrint = (c.print_cost || 0) / bbCount;
          
          for (const p of prices) {
            const bbId = Number(p.billboardId);
            if (!bbId) continue;
            const contractPrice = p.contractPrice || p.priceAfterDiscount || 0;
            
            // Installation: if included in price, it's already in contractPrice, extract it
            // If not included, it's separate from contractPrice
            let inst = 0;
            let rent = contractPrice;
            
            if (includeInstall) {
              // Installation is inside contractPrice, so rent = contractPrice - installation
              inst = contractInstall;
              rent = contractPrice - contractInstall;
            } else {
              // Installation is separate
              inst = (p.installationCost || 0) + contractInstall;
            }
            
            let prnt = 0;
            if (includePrint) {
              // Print is inside contractPrice
              prnt = contractPrint;
              rent = rent - contractPrint;
            } else {
              prnt = (p.printCost || 0) + contractPrint;
            }
            
            map[bbId] = {
              rent: Math.max(rent, 0),
              printCost: prnt,
              installationCost: inst,
              total: contractPrice + (includeInstall ? 0 : inst) + (includePrint ? 0 : prnt),
            };
          }
        }
      } catch { /* skip malformed */ }
    }
    return map;
  }, [filteredContracts]);

  // Fallback: count billboards per contract for contracts without billboard_prices
  const billboardsPerContract = useMemo(() => {
    const counts: Record<number, number> = {};
    for (const b of activeBillboards) {
      if (b.Contract_Number && contractMap[b.Contract_Number]) {
        counts[b.Contract_Number] = (counts[b.Contract_Number] || 0) + 1;
      }
    }
    return counts;
  }, [activeBillboards, contractMap]);

  // Stats per municipality
  const stats = useMemo((): MuniStats[] => {
    const muniMap: Record<string, { bbs: any[]; revenue: number; installation: number; print: number; contracts: Set<number> }> = {};
    
    for (const b of activeBillboards) {
      const muni = b.Municipality || 'غير محدد';
      if (!muniMap[muni]) muniMap[muni] = { bbs: [], revenue: 0, installation: 0, print: 0, contracts: new Set() };
      muniMap[muni].bbs.push(b);
      
      if (b.Contract_Number && contractMap[b.Contract_Number]) {
        const c = contractMap[b.Contract_Number];
        muniMap[muni].contracts.add(b.Contract_Number);
        
        // Use per-billboard pricing if available
        const bbPrice = billboardPriceMap[b.ID];
        if (bbPrice) {
          muniMap[muni].revenue += bbPrice.rent;
          muniMap[muni].installation += bbPrice.installationCost;
          muniMap[muni].print += bbPrice.printCost;
        } else {
          // Fallback: split total rent equally
          const bbCount = billboardsPerContract[b.Contract_Number] || 1;
          muniMap[muni].revenue += (c['Total Rent'] || 0) / bbCount;
          muniMap[muni].installation += (c.installation_cost || 0) / bbCount;
          muniMap[muni].print += (c.print_cost || 0) / bbCount;
        }
      }
    }

    const result: MuniStats[] = [];
    for (const [muni, data] of Object.entries(muniMap)) {
      const rented = data.bbs.filter(b => b.Contract_Number && contractMap[b.Contract_Number]).length;
      const rev = Math.round(data.revenue);
      const inst = Math.round(data.installation);
      const prnt = Math.round(data.print);
      
      result.push({
        municipality: muni,
        totalBillboards: data.bbs.length,
        rentedBillboards: rented,
        availableBillboards: data.bbs.length - rented,
        activeContracts: data.contracts.size,
        totalRevenue: rev,
        totalInstallation: inst,
        totalPrint: prnt,
        netRevenue: rev - inst - prnt,
        occupancyRate: data.bbs.length > 0 ? (rented / data.bbs.length) * 100 : 0,
      });
    }

    return result.sort((a, b) => (municipalityOrder[a.municipality] ?? 999) - (municipalityOrder[b.municipality] ?? 999));
  }, [activeBillboards, contractMap, billboardPriceMap, billboardsPerContract, municipalityOrder]);

  // Detail: rented billboards per municipality, grouped by contract
  const rentedDetails = useMemo(() => {
    const map: Record<string, Record<number, { 
      contractNumber: number; 
      customerName: string; 
      adType: string;
      billboards: { bbId: number; bbName: string; imageUrl: string; landmark: string; endDate: string; startDate: string; durationMonths: number; revenue: number; installation: number; print: number; net: number; designA: string; designB: string; installedImageA: string; installedImageB: string; size: string; facesCount: number }[] 
    }>> = {};
    
    for (const b of activeBillboards) {
      if (!b.Contract_Number || !contractMap[b.Contract_Number]) continue;
      const muni = b.Municipality || 'غير محدد';
      if (!map[muni]) map[muni] = {};
      
      const c = contractMap[b.Contract_Number];
      if (!map[muni][b.Contract_Number]) {
        map[muni][b.Contract_Number] = {
          contractNumber: b.Contract_Number,
          customerName: c['Customer Name'] || b.Customer_Name || '—',
          adType: c['Ad Type'] || b.Ad_Type || '—',
          billboards: [],
        };
      }
      
      const bbPrice = billboardPriceMap[b.ID];
      let rev = 0, inst = 0, prnt = 0;
      
      if (bbPrice) {
        rev = bbPrice.rent;
        inst = bbPrice.installationCost;
        prnt = bbPrice.printCost;
      } else {
        const bbCount = billboardsPerContract[b.Contract_Number] || 1;
        rev = (c['Total Rent'] || 0) / bbCount;
        inst = (c.installation_cost || 0) / bbCount;
        prnt = (c.print_cost || 0) / bbCount;
      }
      
      const endDate = c['End Date'] || '';
      const startDate = c['Contract Date'] || '';
      let durationMonths = 0;
      if (startDate && endDate) {
        const s = new Date(startDate);
        const e = new Date(endDate);
        durationMonths = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24 * 30.44));
      }

      const histKey = `${b.ID}_${b.Contract_Number}`;
      const hist = ((window as any).__bbHistoryMap || {})[histKey];
      
      map[muni][b.Contract_Number].billboards.push({
        bbId: b.ID,
        bbName: b.Billboard_Name || `لوحة ${b.ID}`,
        imageUrl: b.Image_URL || '',
        landmark: b.Nearest_Landmark || '',
        endDate,
        startDate,
        durationMonths,
        revenue: Math.round(rev),
        installation: Math.round(inst),
        print: Math.round(prnt),
        net: Math.round(rev - inst - prnt),
        designA: hist?.design_face_a_url || b.design_face_a || '',
        designB: hist?.design_face_b_url || b.design_face_b || '',
        installedImageA: hist?.installed_image_face_a_url || '',
        installedImageB: hist?.installed_image_face_b_url || '',
        size: b.Size || '',
        facesCount: b.Faces_Count || 1,
      });
    }
    
    return map;
  }, [activeBillboards, contractMap, billboardPriceMap, billboardsPerContract]);

  // Totals
  const totals = useMemo(() => ({
    billboards: stats.reduce((s, m) => s + m.totalBillboards, 0),
    rented: stats.reduce((s, m) => s + m.rentedBillboards, 0),
    revenue: stats.reduce((s, m) => s + m.totalRevenue, 0),
    installation: stats.reduce((s, m) => s + m.totalInstallation, 0),
    print: stats.reduce((s, m) => s + m.totalPrint, 0),
    netRevenue: stats.reduce((s, m) => s + m.netRevenue, 0),
    contracts: stats.reduce((s, m) => s + m.activeContracts, 0),
  }), [stats]);

  // Chart data - top 10 by revenue
  const chartData = useMemo(() => {
    return [...stats]
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10)
      .map(s => ({
        name: s.municipality.length > 12 ? s.municipality.slice(0, 12) + '…' : s.municipality,
        fullName: s.municipality,
        revenue: s.totalRevenue,
        rented: s.rentedBillboards,
        available: s.availableBillboards,
      }));
  }, [stats]);

  // Pie data - occupancy
  const pieData = useMemo(() => {
    return [
      { name: 'مؤجرة', value: totals.rented },
      { name: 'متاحة', value: totals.billboards - totals.rented },
    ];
  }, [totals]);

  const years = useMemo(() => {
    const yrs = new Set<string>();
    contracts.forEach((c: any) => {
      const d = c['Contract Date'];
      if (d) yrs.add(new Date(d).getFullYear().toString());
    });
    return [...yrs].sort((a, b) => Number(b) - Number(a));
  }, [contracts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center space-y-3">
          <Loader2 className="h-10 w-10 animate-spin text-primary mx-auto" />
          <p className="text-muted-foreground">جاري تحميل الإحصائيات...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* Hero Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 p-6 text-white">
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4wNSI+PHBhdGggZD0iTTM2IDE4YTYgNiAwIDEgMSAxMiAwIDYgNiAwIDAgMS0xMiAwek0xMiA0OGE2IDYgMCAxIDEgMTIgMCA2IDYgMCAwIDEtMTIgMHoiLz48L2c+PC9nPjwvc3ZnPg==')] opacity-30" />
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-white/15 backdrop-blur-sm">
              <Building2 className="h-7 w-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">إحصائيات البلديات</h1>
              <p className="text-white/80 text-sm mt-0.5">تحليل التأجير والإيرادات حسب البلدية</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-center px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm">
              <div className="text-2xl font-bold">{stats.length}</div>
              <div className="text-xs text-white/70">بلدية</div>
            </div>
            <div className="text-center px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm">
              <div className="text-2xl font-bold">{totals.billboards}</div>
              <div className="text-xs text-white/70">لوحة</div>
            </div>
            <div className="text-center px-4 py-2 rounded-xl bg-white/10 backdrop-blur-sm">
              <div className="text-2xl font-bold">{formatCurrency(totals.netRevenue)}</div>
              <div className="text-xs text-white/70">صافي الإيراد</div>
            </div>
          </div>
        </div>
      </div>

      {/* Date Filters */}
      <Card className="border-0 shadow-md">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-3">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium">تصفية حسب الفترة</span>
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">الفترة</Label>
              <Select value={dateMode} onValueChange={(v: any) => setDateMode(v)}>
                <SelectTrigger className="h-9 w-36"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الفترات</SelectItem>
                  <SelectItem value="year">سنة محددة</SelectItem>
                  <SelectItem value="month">شهر محدد</SelectItem>
                  <SelectItem value="range">فترة مخصصة</SelectItem>
                </SelectContent>
              </Select>
            </div>
            
            {dateMode === 'year' && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">السنة</Label>
                <Select value={selectedYear} onValueChange={setSelectedYear}>
                  <SelectTrigger className="h-9 w-28"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            )}

            {dateMode === 'month' && (
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">الشهر</Label>
                <Input type="month" value={startDate?.slice(0, 7) || ''} onChange={e => setStartDate(e.target.value + '-01')} className="h-9 w-44" dir="ltr" />
              </div>
            )}

            {dateMode === 'range' && (
              <>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">من</Label>
                  <Input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="h-9 w-40" dir="ltr" />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">إلى</Label>
                  <Input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="h-9 w-40" dir="ltr" />
                </div>
              </>
            )}

            {dateMode !== 'all' && (
              <Button variant="ghost" size="sm" onClick={() => { setDateMode('all'); setStartDate(''); setEndDate(''); }}>
                مسح
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Layers className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totals.billboards}</div>
                <div className="text-xs text-muted-foreground">إجمالي اللوحات</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{totals.rented}</div>
                <div className="text-xs text-muted-foreground">مؤجرة</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-violet-500/10">
                <DollarSign className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{formatCurrency(totals.revenue)}</div>
                <div className="text-xs text-muted-foreground">إجمالي الإيجار</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <Building2 className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{formatCurrency(totals.installation)}</div>
                <div className="text-xs text-muted-foreground">تكلفة التركيب</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-orange-500/10">
                <BarChart3 className="h-5 w-5 text-orange-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{formatCurrency(totals.print)}</div>
                <div className="text-xs text-muted-foreground">تكلفة الطباعة</div>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className="border-0 shadow-sm">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <DollarSign className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold">{formatCurrency(totals.netRevenue)}</div>
                <div className="text-xs text-muted-foreground">صافي الإيراد</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue Bar Chart */}
        <Card className="lg:col-span-2 border-0 shadow-md">
          <CardContent className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-primary" />
              أعلى 10 بلديات إيراداً
            </h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} layout="vertical" margin={{ right: 20, left: 10, top: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
                  <XAxis 
                    type="number" 
                    tickFormatter={formatCurrency} 
                    tick={{ fontSize: 11, fill: 'hsl(var(--foreground))' }}
                    stroke="hsl(var(--border))"
                  />
                  <YAxis 
                    type="category" 
                    dataKey="name" 
                    tick={{ fontSize: 13, fill: 'hsl(var(--foreground))', fontWeight: 600 }} 
                    width={110}
                    tickLine={false}
                    axisLine={false}
                  />
                  <Tooltip 
                    formatter={(value: number) => [value.toLocaleString() + ' د.ل', 'الإيراد']}
                    labelFormatter={(label) => chartData.find(d => d.name === label)?.fullName || label}
                    contentStyle={{ 
                      borderRadius: '10px', 
                      fontSize: '13px', 
                      border: '1px solid hsl(var(--border))', 
                      boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                      backgroundColor: 'hsl(var(--popover))',
                      color: 'hsl(var(--popover-foreground))',
                    }}
                    labelStyle={{ color: 'hsl(var(--foreground))', fontWeight: 600 }}
                  />
                  <Bar dataKey="revenue" radius={[0, 6, 6, 0]} maxBarSize={26} barSize={22}>
                    {chartData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Occupancy Pie */}
        <Card className="border-0 shadow-md">
          <CardContent className="p-5">
            <h3 className="font-semibold mb-4 flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />
              نسبة الإشغال الكلية
            </h3>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%" cy="45%"
                    innerRadius={55} outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={{ stroke: 'hsl(var(--muted-foreground))' }}
                  >
                    <Cell fill="hsl(150, 60%, 45%)" />
                    <Cell fill="hsl(var(--muted-foreground))" />
                  </Pie>
                  <Tooltip 
                    formatter={(value: number) => [value, 'لوحة']} 
                    contentStyle={{ 
                      backgroundColor: 'hsl(var(--popover))', 
                      color: 'hsl(var(--popover-foreground))',
                      borderRadius: '8px',
                      border: '1px solid hsl(var(--border))',
                    }}
                  />
                  <Legend 
                    wrapperStyle={{ color: 'hsl(var(--foreground))' }}
                    formatter={(value) => <span style={{ color: 'hsl(var(--foreground))' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Municipality Table */}
      <Card className="border-0 shadow-md overflow-hidden">
        <CardContent className="p-0">
          <div className="p-4 border-b bg-muted/30">
            <h3 className="font-semibold flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              تفاصيل البلديات
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/20">
                  <th className="text-right p-3 font-medium text-muted-foreground">#</th>
                  <th className="text-right p-3 font-medium text-muted-foreground">البلدية</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">اللوحات</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">مؤجرة</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">متاحة</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">العقود</th>
                  <th className="text-center p-3 font-medium text-muted-foreground">نسبة الإشغال</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">الإيجار</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">التركيب</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">الطباعة</th>
                  <th className="text-left p-3 font-medium text-muted-foreground">الإجمالي</th>
                  <th className="text-center p-3 font-medium text-muted-foreground w-10"></th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s, idx) => {
                  const isExpanded = expandedMuni === s.municipality;
                  const details = rentedDetails[s.municipality] || {};
                  return (
                    <React.Fragment key={s.municipality}>
                      <tr 
                        className={cn("border-b transition-colors hover:bg-muted/30 cursor-pointer", idx % 2 === 0 && "bg-muted/5")}
                        onClick={() => setExpandedMuni(isExpanded ? null : s.municipality)}
                      >
                        <td className="p-3 text-muted-foreground text-xs">
                          <div className="flex items-center gap-1">
                            {s.rentedBillboards > 0 && (
                              isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
                            )}
                            {idx + 1}
                          </div>
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                            <span className="font-medium">{s.municipality}</span>
                          </div>
                        </td>
                        <td className="p-3 text-center">
                          <Badge variant="outline" className="font-mono">{s.totalBillboards}</Badge>
                        </td>
                        <td className="p-3 text-center">
                          <Badge className="bg-emerald-500/10 text-emerald-700 border-emerald-200 hover:bg-emerald-500/10 font-mono">
                            {s.rentedBillboards}
                          </Badge>
                        </td>
                        <td className="p-3 text-center">
                          <span className="text-muted-foreground">{s.availableBillboards}</span>
                        </td>
                        <td className="p-3 text-center font-mono">{s.activeContracts}</td>
                        <td className="p-3 text-center">
                          <div className="flex items-center gap-2 justify-center">
                            <div className="w-16 h-1.5 rounded-full bg-muted overflow-hidden">
                              <div 
                                className="h-full rounded-full transition-all"
                                style={{ 
                                  width: `${Math.min(s.occupancyRate, 100)}%`,
                                  backgroundColor: s.occupancyRate > 70 ? 'hsl(150, 60%, 45%)' : s.occupancyRate > 40 ? 'hsl(35, 85%, 55%)' : 'hsl(0, 65%, 55%)'
                                }}
                              />
                            </div>
                            <span className="text-xs font-mono">{s.occupancyRate.toFixed(0)}%</span>
                          </div>
                        </td>
                        <td className="p-3 text-left">
                          <span className="font-bold text-sm">{s.totalRevenue.toLocaleString()}</span>
                          <span className="text-[10px] text-muted-foreground mr-1">د.ل</span>
                        </td>
                        <td className="p-3 text-left">
                          <span className="text-sm">{s.totalInstallation > 0 ? s.totalInstallation.toLocaleString() : '-'}</span>
                        </td>
                        <td className="p-3 text-left">
                          <span className="text-sm">{s.totalPrint > 0 ? s.totalPrint.toLocaleString() : '-'}</span>
                        </td>
                        <td className="p-3 text-left">
                          <span className="font-bold text-sm text-emerald-600">{(s.totalRevenue + s.totalInstallation + s.totalPrint).toLocaleString()}</span>
                          <span className="text-[10px] text-muted-foreground mr-1">د.ل</span>
                        </td>
                        <td className="p-3 text-center" onClick={(e) => e.stopPropagation()}>
                          {s.rentedBillboards > 0 && (
                            <MunicipalityStatementPrint
                              municipalityName={s.municipality}
                              contractGroups={Object.values(details)}
                              stats={{
                                totalBillboards: s.totalBillboards,
                                rentedBillboards: s.rentedBillboards,
                                totalRevenue: s.totalRevenue,
                                totalInstallation: s.totalInstallation,
                                totalPrint: s.totalPrint,
                                netRevenue: s.netRevenue,
                              }}
                            />
                          )}
                        </td>
                      </tr>
                      {isExpanded && details && Object.keys(details).length > 0 && (
                        <>
                          {Object.values(details).map((contractGroup) => (
                            <React.Fragment key={`${s.municipality}-c-${contractGroup.contractNumber}`}>
                              {/* Contract header */}
                              <tr className="bg-primary/5 border-b">
                                <td className="p-2" colSpan={2}></td>
                                <td className="p-2" colSpan={10}>
                                  <div className="flex items-center gap-3 text-xs">
                                    <Badge variant="outline" className="font-mono text-xs">عقد {contractGroup.contractNumber}</Badge>
                                    <span className="font-semibold">{contractGroup.customerName}</span>
                                    <Badge variant="secondary" className="text-[10px]">{contractGroup.adType}</Badge>
                                    <span className="text-muted-foreground">({contractGroup.billboards.length} لوحات)</span>
                                  </div>
                                </td>
                              </tr>
                              {/* Billboards in this contract */}
                              {contractGroup.billboards.map((d) => (
                                <tr key={`${s.municipality}-${d.bbId}`} className="bg-muted/5 border-b border-dashed">
                                  <td className="p-2" colSpan={2}></td>
                                  <td className="p-2" colSpan={3}>
                                    <div className="flex items-center gap-2">
                                      {d.imageUrl ? (
                                        <img 
                                          src={d.imageUrl} 
                                          alt={d.bbName}
                                          className="w-8 h-8 rounded object-cover flex-shrink-0"
                                          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                        />
                                      ) : (
                                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                                          <Layers className="h-3 w-3 text-muted-foreground" />
                                        </div>
                                      )}
                                      <div className="min-w-0">
                                        <div className="text-xs font-medium truncate">{d.bbName}</div>
                                        {d.landmark && (
                                          <div className="text-[10px] text-muted-foreground truncate flex items-center gap-0.5">
                                            <MapPin className="h-2.5 w-2.5 flex-shrink-0" />
                                            {d.landmark}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  </td>
                                  <td className="p-2 text-center text-[10px] text-muted-foreground whitespace-nowrap">
                                    <div>{d.durationMonths > 0 ? `${d.durationMonths} شهر` : '—'}</div>
                                    {d.endDate && <div className="text-[9px]">{new Date(d.endDate).toLocaleDateString('ar-LY')}</div>}
                                  </td>
                                  <td className="p-2 text-left text-xs font-mono">{d.revenue.toLocaleString()}</td>
                                  <td className="p-2 text-left text-xs font-mono">{d.installation > 0 ? d.installation.toLocaleString() : '-'}</td>
                                  <td className="p-2 text-left text-xs font-mono">{d.print > 0 ? d.print.toLocaleString() : '-'}</td>
                                  <td className="p-2 text-left text-xs font-mono text-emerald-600">{(d.revenue + d.installation + d.print).toLocaleString()}</td>
                                </tr>
                              ))}
                            </React.Fragment>
                          ))}
                        </>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-muted/40 font-bold">
                  <td className="p-3" colSpan={2}>الإجمالي</td>
                  <td className="p-3 text-center">{totals.billboards}</td>
                  <td className="p-3 text-center">{totals.rented}</td>
                  <td className="p-3 text-center">{totals.billboards - totals.rented}</td>
                  <td className="p-3 text-center">{totals.contracts}</td>
                  <td className="p-3 text-center font-mono">{totals.billboards > 0 ? ((totals.rented / totals.billboards) * 100).toFixed(0) : 0}%</td>
                  <td className="p-3 text-left">{totals.revenue.toLocaleString()} د.ل</td>
                  <td className="p-3 text-left">{totals.installation.toLocaleString()}</td>
                  <td className="p-3 text-left">{totals.print.toLocaleString()}</td>
                  <td className="p-3 text-left text-emerald-600">{(totals.revenue + totals.installation + totals.print).toLocaleString()} د.ل</td>
                  <td className="p-3"></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MunicipalityStats;
