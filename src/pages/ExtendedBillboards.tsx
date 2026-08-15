import { useState, useEffect } from 'react';

import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Plus, MapPin, Clock, Calendar, Search, Filter, FileText, User } from 'lucide-react';
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
      const { data: billboards } = await supabase
        .from('billboards')
        .select('*')
        .in('ID', billboardIds);

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
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Plus className="h-7 w-7 text-orange-500" />
              اللوحات الممددة
            </h1>
            <p className="text-muted-foreground mt-1">
              جميع اللوحات التي تم تمديد إيجارها
            </p>
          </div>
          <Badge className="bg-orange-500 hover:bg-orange-600 text-lg px-4 py-2">
            {extensions.length} تمديد
          </Badge>
        </div>

        {/* Filters */}
        <Card>
          <CardContent className="pt-4">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث باسم اللوحة أو السبب..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pr-10"
                />
              </div>
              <Select value={filterType} onValueChange={setFilterType}>
                <SelectTrigger className="w-full md:w-[200px]">
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="border-orange-500/50 bg-orange-500/5">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي التمديدات</p>
                  <p className="text-2xl font-bold text-orange-600">{extensions.length}</p>
                </div>
                <Plus className="h-8 w-8 text-orange-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-blue-500/50 bg-blue-500/5">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">إجمالي الأيام</p>
                  <p className="text-2xl font-bold text-blue-600">{totalExtensionDays} يوم</p>
                </div>
                <Clock className="h-8 w-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-green-500/50 bg-green-500/5">
            <CardContent className="pt-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">مناسبات عامة</p>
                  <p className="text-2xl font-bold text-green-600">{extensionsByType.public_event}</p>
                </div>
                <Calendar className="h-8 w-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
          <Card className="border-purple-500/50 bg-purple-500/5">
            <CardContent className="pt-4">
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
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          </div>
        ) : filteredExtensions.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Plus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-lg text-muted-foreground">لا توجد تمديدات</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredExtensions.map((ext) => (
              <Card 
                key={ext.id} 
                className="overflow-hidden border-2 border-orange-200 dark:border-orange-900 hover:shadow-lg transition-shadow"
              >
                {/* Billboard Image */}
                <div className="relative aspect-video bg-muted">
                  {ext.billboard?.Image_URL ? (
                    <img
                      src={ext.billboard.Image_URL}
                      alt={ext.billboard?.Billboard_Name || `لوحة #${ext.billboard_id}`}
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
                  
                  {/* Extension Days Badge */}
                  <div className="absolute top-2 right-2 bg-orange-500 text-white px-3 py-1 rounded-full flex items-center gap-1 shadow-lg">
                    <Plus className="h-4 w-4" />
                    <span className="text-sm font-bold">{ext.extension_days} يوم</span>
                  </div>
                  
                  {/* Billboard ID */}
                  <div className="absolute bottom-2 left-2 bg-black/70 text-white px-2 py-1 rounded text-sm font-bold">
                    #{ext.billboard_id}
                  </div>

                  {/* Extension Type */}
                  <div className="absolute top-2 left-2">
                    <Badge variant="secondary" className="text-xs">
                      {EXTENSION_TYPE_LABELS[ext.extension_type] || ext.extension_type}
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-4 space-y-3">
                  {/* Billboard Name */}
                  <h3 className="font-bold text-lg line-clamp-1">
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
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">من:</span>
                        <span className="font-medium text-destructive">
                          {format(new Date(ext.old_end_date), 'dd/MM/yyyy')}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <span className="text-muted-foreground">إلى:</span>
                        <span className="font-medium text-green-600">
                          {format(new Date(ext.new_end_date), 'dd/MM/yyyy')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Reason Box */}
                  <div className="p-3 rounded-lg bg-orange-100 dark:bg-orange-900/30 border border-orange-300 dark:border-orange-800">
                    <div className="flex items-center gap-2 mb-1">
                      <Plus className="h-4 w-4 text-orange-600" />
                      <span className="font-bold text-sm text-orange-700 dark:text-orange-400">
                        سبب التمديد
                      </span>
                    </div>
                    <p className="text-sm text-orange-600 dark:text-orange-300 line-clamp-2">
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
                      className="flex-1"
                      onClick={() => navigate(`/admin/contracts`)}
                    >
                      عرض العقد
                    </Button>
                    <Button 
                      size="sm" 
                      variant="default"
                      className="flex-1 bg-orange-500 hover:bg-orange-600"
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
