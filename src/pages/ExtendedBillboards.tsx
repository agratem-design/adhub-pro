import { useState, useEffect } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Plus, MapPin, Clock, Calendar, Search, Filter, FileText, User, RefreshCw, ArrowLeft, TimerReset } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { BillboardExtendRentalDialog } from '@/components/billboards/BillboardExtendRentalDialog';
import { useNavigate } from 'react-router-dom';

interface ExtendedBillboard {
  id: string;
  billboard_id: number;
  contract_number: number | null;
  extension_days: number;
  reason: string;
  extension_type: string;
  old_end_date: string;
  new_end_date: string;
  notes: string | null;
  created_at: string;
  billboard: any;
}

const EXTENSION_TYPE_LABELS: Record<string, string> = {
  'public_event': 'مناسبة عامة',
  'installation_delay': 'تأخير في التركيب',
  'manual': 'تمديد يدوي',
};

export default function ExtendedBillboards() {
  const [extensions, setExtensions] = useState<ExtendedBillboard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState<string>('all');
  const [extendDialogOpen, setExtendDialogOpen] = useState(false);
  const [selectedBillboard, setSelectedBillboard] = useState<any>(null);
  const navigate = useNavigate();

  const fetchExtensions = async () => {
    setLoading(true);
    try {
      // جلب جميع التمديدات
      const { data: extensionsData, error } = await supabase
        .from('billboard_extensions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // جلب بيانات اللوحات
      const billboardIds = extensionsData?.map(e => e.billboard_id) || [];
      const { data: billboards } = billboardIds.length
        ? await supabase.from('billboards').select('*').in('ID', billboardIds)
        : { data: [] as any[] };

      // دمج البيانات
      const enrichedExtensions: ExtendedBillboard[] = extensionsData?.map(ext => ({
        ...ext,
        billboard: billboards?.find(b => b.ID === ext.billboard_id)
      })) || [];

      setExtensions(enrichedExtensions);
    } catch (error) {
      console.error('Error fetching extensions:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchExtensions();
  }, []);

  const filteredExtensions = extensions.filter(ext => {
    const matchesSearch = 
      ext.billboard?.Billboard_Name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ext.reason?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ext.billboard_id.toString().includes(searchTerm);
    
    const matchesFilter = filterType === 'all' || ext.extension_type === filterType;
    
    return matchesSearch && matchesFilter;
  });

  // حساب إحصائيات
  const totalExtensionDays = extensions.reduce((sum, ext) => sum + ext.extension_days, 0);
  const extensionsByType = {
    public_event: extensions.filter(e => e.extension_type === 'public_event').length,
    installation_delay: extensions.filter(e => e.extension_type === 'installation_delay').length,
    manual: extensions.filter(e => e.extension_type === 'manual').length,
  };

  const handleExtendMore = (billboard: any) => {
    setSelectedBillboard(billboard);
    setExtendDialogOpen(true);
  };

  return (
    <>
      <div className="min-h-screen space-y-6 bg-muted/20 p-4 md:p-6" dir="rtl">
        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-l from-primary/15 via-card to-card p-5 shadow-sm md:p-7">
          <div className="absolute -left-10 -top-16 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20"><TimerReset className="h-6 w-6" /></div>
              <div>
                <div className="mb-1 flex items-center gap-2"><h1 className="text-2xl font-black tracking-tight md:text-3xl">اللوحات الممددة</h1><Badge className="bg-primary/15 text-primary hover:bg-primary/20">سجل التمديدات</Badge></div>
                <p className="text-sm text-muted-foreground">تابع مدد اللوحات وتواريخ توفرها الجديدة من مكان واحد.</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" className="cursor-pointer gap-2 bg-background/70 transition-all duration-200 hover:border-primary hover:text-primary" onClick={fetchExtensions} disabled={loading}><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />تحديث</Button>
              <div className="rounded-xl border border-primary/20 bg-background/70 px-4 py-2 text-center"><p className="text-2xl font-black text-primary">{extensions.length}</p><p className="text-[11px] text-muted-foreground">عملية تمديد</p></div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card className="border-border/80 shadow-sm">
          <CardContent className="p-4">
            <div className="mb-3 flex items-center gap-2 text-sm font-bold"><Filter className="h-4 w-4 text-primary" />تصفية سجل التمديدات</div>
            <div className="flex flex-col gap-3 md:flex-row">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث باسم اللوحة أو السبب..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-11 pr-10"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="h-11 w-full md:w-[220px]">
                  <Filter className="h-4 w-4 ml-2" />
                  <SelectValue placeholder="نوع التمديد" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع الأنواع</SelectItem>
                  <SelectItem value="public_event">مناسبة عامة</SelectItem>
                  <SelectItem value="installation_delay">تأخير في التركيب</SelectItem>
                  <SelectItem value="manual">تمديد يدوي</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Card className="border-primary/25 bg-primary/5 shadow-sm"><CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي التمديدات</p>
                  <p className="text-2xl font-bold text-primary">{extensions.length}</p>
                </div>
                <Plus className="h-8 w-8 text-primary" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-500/25 bg-blue-500/5 shadow-sm"><CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي الأيام</p>
                  <p className="text-2xl font-bold text-blue-600">{totalExtensionDays} يوم</p>
                </div>
                <Clock className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-emerald-500/25 bg-emerald-500/5 shadow-sm"><CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">مناسبات عامة</p>
                  <p className="text-2xl font-bold text-green-600">{extensionsByType.public_event}</p>
                </div>
                <Calendar className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-violet-500/25 bg-violet-500/5 shadow-sm"><CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">تأخير تركيب</p>
                  <p className="text-2xl font-bold text-purple-600">{extensionsByType.installation_delay}</p>
                </div>
                <Clock className="h-8 w-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Extensions Grid */}
        {loading ? (
          <div className="rounded-2xl border border-border bg-card py-16 text-center shadow-sm">
            <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-primary/20 border-t-primary" />
            <p className="text-sm text-muted-foreground">جاري تحميل سجل التمديدات...</p>
          </div>
        ) : filteredExtensions.length === 0 ? (
          <Card className="border-dashed shadow-sm"><CardContent className="py-16 text-center">
              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-muted"><TimerReset className="h-7 w-7 text-muted-foreground" /></div>
              <p className="text-lg font-bold">لا توجد نتائج</p>
              <p className="mt-1 text-sm text-muted-foreground">جرّب تغيير البحث أو نوع التمديد.</p>
              {(searchTerm || filterType !== 'all') && <Button variant="ghost" className="mt-3 cursor-pointer text-primary" onClick={() => { setSearchTerm(''); setFilterType('all'); }}>مسح الفلاتر</Button>}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredExtensions.map((ext) => (
              <Card 
                key={ext.id} 
                className="group overflow-hidden border-border/80 bg-card shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-xl"
              >
                {/* Billboard Image */}
                <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                  {ext.billboard?.Image_URL ? (
                    <img
                      src={ext.billboard.Image_URL}
                      alt={ext.billboard?.Billboard_Name || `لوحة #${ext.billboard_id}`}
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder.svg';
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-muted">
                      <FileText className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  
                  {/* Extension Days Badge */}
                  <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-primary px-3 py-1.5 text-white shadow-lg">
                    <Plus className="h-3.5 w-3.5" /><span className="text-xs font-bold">{ext.extension_days} يوم تمديد</span>
                  </div>
                  
                  {/* Billboard ID */}
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm font-bold">
                    #{ext.billboard_id}
                  </div>

                  {/* Extension Type */}
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary" className="border-0 bg-background/90 text-xs shadow-sm backdrop-blur">
                      {EXTENSION_TYPE_LABELS[ext.extension_type] || ext.extension_type}
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-4 space-y-3">
                  {/* Billboard Name */}
                  <h3 className="line-clamp-1 text-lg font-black">
                    {ext.billboard?.Billboard_Name || `لوحة #${ext.billboard_id}`}
                  </h3>

                  {/* Customer & Contract */}
                  <div className="space-y-2 text-sm">
                    {ext.contract_number && (
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          عقد #{ext.contract_number}
                        </Badge>
                        {ext.billboard?.Customer_Name && (
                          <span className="text-muted-foreground truncate flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {ext.billboard.Customer_Name}
                          </span>
                        )}
                      </div>
                    )}
                    
                    {/* Location */}
                    <div className="flex items-center gap-1 text-muted-foreground">
                      <MapPin className="h-4 w-4 flex-shrink-0" />
                      <span className="truncate">
                        {ext.billboard?.Municipality || 'غير محدد'} - {ext.billboard?.District || ''}
                      </span>
                    </div>

                    {/* Dates */}
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div className="rounded-lg border border-destructive/15 bg-destructive/5 p-2">
                        <span className="block text-muted-foreground">قبل التمديد</span>
                        <span className="mt-1 block font-bold text-destructive">{format(new Date(ext.old_end_date), 'dd MMM yyyy', { locale: ar })}</span>
                      </div>
                      <div className="rounded-lg border border-emerald-500/15 bg-emerald-500/5 p-2">
                        <span className="block text-muted-foreground">بعد التمديد</span>
                        <span className="mt-1 block font-bold text-emerald-700 dark:text-emerald-400">{format(new Date(ext.new_end_date), 'dd MMM yyyy', { locale: ar })}</span>
                      </div>
                    </div>
                  </div>

                  {/* Reason Box */}
                  <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                    <div className="flex items-center gap-2 mb-1">
                      <Plus className="h-4 w-4 text-primary" />
                      <span className="text-sm font-bold text-primary">
                        سبب التمديد
                      </span>
                    </div>
                    <p className="line-clamp-2 text-sm text-foreground/80">
                      {ext.reason}
                    </p>
                    {ext.notes && (
                      <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                        ملاحظات: {ext.notes}
                      </p>
                    )}
                  </div>

                  {/* Extension Date */}
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>
                      تم التمديد: {format(new Date(ext.created_at), 'dd/MM/yyyy HH:mm', { locale: ar })}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1 cursor-pointer transition-all duration-200 hover:border-primary hover:text-primary"
                      onClick={() => navigate(`/admin/contracts`)}
                    >
                      عرض العقد
                    </Button>
                    <Button 
                      size="sm" 
                      variant="default"
                      className="flex-1 cursor-pointer bg-primary transition-all duration-200 hover:bg-primary/90"
                      onClick={() => handleExtendMore(ext.billboard)}
                    >
                      <Plus className="h-4 w-4 ml-1" />
                      تمديد إضافي
                    </Button>
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
            onSuccess={fetchExtensions}
          />
        )}
      </div>
    </>
  );
}
