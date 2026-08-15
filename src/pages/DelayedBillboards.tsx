import { useState, useEffect } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, MapPin, Clock, Calendar, Search, Filter, Plus, FileText } from 'lucide-react';
import { format, differenceInDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { BillboardExtendRentalDialog } from '@/components/billboards/BillboardExtendRentalDialog';
import { useNavigate } from 'react-router-dom';

interface DelayedBillboard {
  id: string;
  billboard_id: number;
  billboard: any;
  task_id: string;
  contract_id: number;
  customer_name: string;
  created_at: string;
  delay_days: number;
  team_name: string;
}

export default function DelayedBillboards() {
  const [delayedBillboards, setDelayedBillboards] = useState<DelayedBillboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterDays, setFilterDays] = useState<string>('all');
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [selectedBillboard, setSelectedBillboard] = useState<any>(null);
  const navigate = useNavigate();

  const fetchDelayedBillboards = async () => {
    setLoading(true);
    try {
      // جلب عناصر مهام التركيب غير المكتملة مع بيانات اللوحات
      const { data: taskItems, error } = await supabase
        .from('installation_task_items')
        .select(`
          id,
          billboard_id,
          task_id,
          created_at,
          status,
          installation_tasks!inner (
            id,
            contract_id,
            team_id,
            installation_teams (
              team_name
            )
          )
        `)
        .neq('status', 'completed');

      if (error) {
        console.error('Error fetching task items:', error);
        throw error;
      }

      // جلب بيانات اللوحات
      const billboardIds = taskItems?.map(item => item.billboard_id) || [];
      const { data: billboards } = await supabase
        .from('billboards')
        .select('*')
        .in('ID', billboardIds);

      // جلب بيانات العقود مع تاريخ البداية
      const contractIds = taskItems?.map(item => (item.installation_tasks as any)?.contract_id).filter(Boolean) || [];
      const { data: contracts } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Contract Date"')
        .in('Contract_Number', contractIds);

      // تصفية اللوحات المتأخرة (أكثر من 15 يوم من تاريخ العقد)
      const delayed: DelayedBillboard[] = [];

      taskItems?.forEach(item => {
        const contractId = (item.installation_tasks as any)?.contract_id;
        const contract = contracts?.find(c => c.Contract_Number === contractId);
        const billboard = billboards?.find(b => b.ID === item.billboard_id);

        // حساب التأخير من تاريخ العقد بدلاً من تاريخ إنشاء المهمة
        const contractDate = contract?.['Contract Date'];
        const referenceDate = contractDate ? new Date(contractDate) : new Date(item.created_at);
        const delayDays = differenceInDays(new Date(), referenceDate);

        if (delayDays > 15) {
          const teamName = (item.installation_tasks as any)?.installation_teams?.team_name || 'غير محدد';

          delayed.push({
            id: item.id,
            billboard_id: item.billboard_id,
            billboard,
            task_id: item.task_id,
            contract_id: contractId,
            customer_name: contract?.['Customer Name'] || 'غير محدد',
            created_at: contractDate || item.created_at,
            delay_days: delayDays,
            team_name: teamName
          });
        }
      });

      // ترتيب حسب الأكثر تأخيراً
      delayed.sort((a, b) => b.delay_days - a.delay_days);

      setDelayedBillboards(delayed);
    } catch (error) {
      console.error('Error fetching delayed billboards:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDelayedBillboards();
  }, []);

  const filteredBillboards = delayedBillboards.filter(item => {
    const matchesSearch = 
      item.billboard?.Billboard_Name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.billboard_id.toString().includes(searchTerm);
    
    const matchesFilter = filterDays === 'all' || 
      (filterDays === '15-30' && item.delay_days >= 15 && item.delay_days <= 30) ||
      (filterDays === '30-60' && item.delay_days > 30 && item.delay_days <= 60) ||
      (filterDays === '60+' && item.delay_days > 60);
    
    return matchesSearch && matchesFilter;
  });

  const getDelayReason = (delayDays: number) => {
    if (delayDays > 60) return 'تأخير شديد - يتجاوز 60 يوم';
    if (delayDays > 30) return 'تأخير كبير - يتجاوز 30 يوم';
    return 'تأخير - يتجاوز 15 يوم';
  };

  const getDelayColor = (delayDays: number) => {
    if (delayDays > 60) return 'bg-red-600';
    if (delayDays > 30) return 'bg-orange-500';
    return 'bg-yellow-500';
  };

  const handleExtend = (billboard: any) => {
    setSelectedBillboard(billboard);
    setExtendDialogOpen(true);
  };

  return (
    <>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <AlertTriangle className="h-7 w-7 text-red-500" />
              اللوحات المتأخرة في التركيب
            </h1>
            <p className="text-muted-foreground mt-1">
              اللوحات التي تجاوزت 15 يوم بدون تركيب
            </p>
          </div>
          <Badge variant="destructive" className="text-lg px-4 py-2">
            {delayedBillboards.length} لوحة متأخرة
          </Badge>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث باسم اللوحة أو العميل أو الرقم..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Select value={filterDays} onValueChange={setFilterDays}>
                <SelectTrigger className="w-full md:w-[200px]">
                  <Filter className="h-4 w-4 ml-2" />
                  <SelectValue placeholder="فترة التأخير" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الفترات</SelectItem>
                  <SelectItem value="15-30">15 - 30 يوم</SelectItem>
                  <SelectItem value="30-60">30 - 60 يوم</SelectItem>
                  <SelectItem value="60+">أكثر من 60 يوم</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="border-yellow-500/50 bg-yellow-500/5">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">تأخير 15-30 يوم</p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {delayedBillboards.filter(b => b.delay_days >= 15 && b.delay_days <= 30).length}
                  </p>
                </div>
                <Clock className="h-8 w-8 text-yellow-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-orange-500/50 bg-orange-500/5">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">تأخير 30-60 يوم</p>
                  <p className="text-2xl font-bold text-orange-600">
                    {delayedBillboards.filter(b => b.delay_days > 30 && b.delay_days <= 60).length}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-red-500/50 bg-red-500/5">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">تأخير أكثر من 60 يوم</p>
                  <p className="text-2xl font-bold text-red-600">
                    {delayedBillboards.filter(b => b.delay_days > 60).length}
                  </p>
                </div>
                <AlertTriangle className="h-8 w-8 text-red-500 animate-pulse" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Billboards Grid */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : filteredBillboards.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <AlertTriangle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg text-muted-foreground">لا توجد لوحات متأخرة</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredBillboards.map((item) => (
              <Card 
                key={item.id} 
                className="overflow-hidden border-2 border-red-200 dark:border-red-900 hover:shadow-lg transition-shadow"
              >
                {/* Billboard Image */}
                <div className="relative aspect-video bg-muted">
                  {item.billboard?.Image_URL ? (
                    <img
                      src={item.billboard.Image_URL}
                      alt={item.billboard?.Billboard_Name || `لوحة #${item.billboard_id}`}
                      className="w-full h-full object-cover"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder.svg';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <FileText className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  
                  {/* Delay Badge */}
                  <div className={`absolute top-2 right-2 ${getDelayColor(item.delay_days)} text-white px-3 py-1 rounded-full flex items-center gap-1 shadow-lg animate-pulse`}>
                    <AlertTriangle className="h-4 w-4" />
                    <span className="text-sm font-bold">{item.delay_days} يوم</span>
                  </div>
                  
                  {/* Billboard ID */}
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm font-bold">
                    #{item.billboard_id}
                  </div>
                </div>

                <CardContent className="p-4 space-y-3">
                  {/* Billboard Name */}
                  <h3 className="font-bold text-lg line-clamp-1">
                    {item.billboard?.Billboard_Name || `لوحة #${item.billboard_id}`}
                  </h3>

                  {/* Customer & Contract */}
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        عقد #{item.contract_id}
                      </Badge>
                      <span className="text-muted-foreground truncate">{item.customer_name}</span>
                    </div>
                    
                    {/* Location */}
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">
                        {item.billboard?.Municipality || 'غير محدد'} - {item.billboard?.District || ''}
                      </span>
                    </div>

                    {/* Team */}
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <span className="text-xs">الفريق:</span>
                      <Badge variant="secondary" className="text-xs">{item.team_name}</Badge>
                    </div>

                    {/* Created Date */}
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <Calendar className="h-4 w-4" />
                      <span className="text-xs">
                        تاريخ الإنشاء: {format(new Date(item.created_at), 'dd/MM/yyyy', { locale: ar })}
                      </span>
                    </div>
                  </div>

                  {/* Delay Reason Box */}
                  <div className={`p-3 rounded-lg ${
                    item.delay_days > 60 
                      ? 'bg-red-100 dark:bg-red-900/30 border border-red-300 dark:border-red-800' 
                      : item.delay_days > 30 
                        ? 'bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-800'
                        : 'bg-yellow-100 dark:bg-yellow-900/30 border border-yellow-300 dark:border-yellow-800'
                  }`}>
                    <div className="flex items-center gap-2 mb-1">
                      <AlertTriangle className={`h-4 w-4 ${
                        item.delay_days > 60 ? 'text-red-600' : item.delay_days > 30 ? 'text-orange-600' : 'text-yellow-600'
                      }`} />
                      <span className={`font-bold text-sm ${
                        item.delay_days > 60 ? 'text-red-700 dark:text-red-400' : item.delay_days > 30 ? 'text-orange-700 dark:text-orange-400' : 'text-yellow-700 dark:text-yellow-400'
                      }`}>
                        سبب التأخير
                      </span>
                    </div>
                    <p className={`text-sm ${
                      item.delay_days > 60 ? 'text-red-600 dark:text-red-300' : item.delay_days > 30 ? 'text-orange-600 dark:text-orange-300' : 'text-yellow-600 dark:text-yellow-300'
                    }`}>
                      {getDelayReason(item.delay_days)}
                    </p>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => navigate(`/tasks`)}
                    >
                      عرض المهمة
                    </Button>
                    {item.billboard?.Rent_End_Date && (
                      <Button 
                        size="sm" 
                        variant="default"
                        className="flex-1"
                        onClick={() => handleExtend(item.billboard)}
                      >
                        <Plus className="h-4 w-4 ml-1" />
                        تمديد
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Extend Dialog */}
        {selectedBillboard && (
          <BillboardExtendRentalDialog
            open={extendDialogOpen}
            onOpenChange={setExtendDialogOpen}
            billboard={{
              ID: selectedBillboard.ID,
              Billboard_Name: selectedBillboard.Billboard_Name,
              Rent_End_Date: selectedBillboard.Rent_End_Date,
              Contract_Number: selectedBillboard.Contract_Number
            }}
            onSuccess={fetchDelayedBillboards}
          />
        )}
      </div>
    </>
  );
}
