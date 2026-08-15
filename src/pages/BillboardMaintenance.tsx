// @ts-nocheck
import { useState, useEffect, useMemo, startTransition } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Wrench, Search, Plus, Calendar, TriangleAlert as AlertTriangle, CircleCheck as CheckCircle, Clock, Settings, FileText, Printer, Download, Filter, LayoutGrid, List } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { MaintenanceBillboardCard } from '@/components/maintenance/MaintenanceBillboardCard';
import { ManageMaintenanceStatusesDialog } from '@/components/maintenance/ManageMaintenanceStatusesDialog';

interface Billboard {
  ID: number;
  Billboard_Name: string;
  Nearest_Landmark: string;
  District: string;
  Municipality: string;
  Size: string;
  Status: string;
  maintenance_status: string;
  maintenance_date: string | null;
  maintenance_notes: string | null;
  maintenance_type: string | null;
  maintenance_cost: number | null;
  next_maintenance_date: string | null;
  maintenance_priority: string;
  Image_URL: string | null;
  GPS_Link: string | null;
}

interface MaintenanceRecord {
  id: string;
  billboard_id: number;
  maintenance_type: string;
  maintenance_date: string;
  description: string;
  cost: number | null;
  technician_name: string | null;
  status: string;
  priority: string;
  billboard?: {
    Billboard_Name: string;
    Nearest_Landmark: string;
  };
}

export default function BillboardMaintenance() {
  const [billboards, setBillboards] = useState<Billboard[]>([]);
  const [maintenanceHistory, setMaintenanceHistory] = useState<MaintenanceRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [selectedBillboard, setSelectedBillboard] = useState<Billboard | null>(null);
  const [isMaintenanceDialogOpen, setIsMaintenanceDialogOpen] = useState(false);
  const [manageStatusesOpen, setManageStatusesOpen] = useState(false);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [activeTab, setActiveTab] = useState('all');
  const [dynamicStatuses, setDynamicStatuses] = useState<any[]>([]);
  const [maintenanceForm, setMaintenanceForm] = useState({
    type: '',
    description: '',
    cost: '',
    technician: '',
    priority: 'normal',
    scheduledDate: ''
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      // تحميل حالات الصيانة الديناميكية
      const { data: statusesData } = await supabase
        .from('maintenance_statuses')
        .select('*')
        .order('created_at');
      setDynamicStatuses(statusesData || []);

      // تحميل اللوحات التي لها حالة صيانة غير operational
      const { data: billboardsData, error: billboardsError } = await supabase
        .from('billboards')
        .select('*')
        .not('maintenance_status', 'is', null)
        .neq('maintenance_status', 'operational')
        .neq('maintenance_status', '')
        .order('Billboard_Name');

      if (billboardsError) throw billboardsError;

      // تحميل سجل الصيانة
      const { data: historyData, error: historyError } = await supabase
        .from('maintenance_history')
        .select(`
          *,
          billboard:billboards!billboard_id(Billboard_Name, Nearest_Landmark)
        `)
        .order('maintenance_date', { ascending: false });

      if (historyError) throw historyError;

      setBillboards(billboardsData || []);
      setMaintenanceHistory(historyData || []);
    } catch (error) {
      console.error('Error loading data:', error);
      toast({
        title: "خطأ في تحميل البيانات",
        description: "تعذر تحميل بيانات الصيانة",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const found = dynamicStatuses.find(s => s.name === status);
    const label = found?.label || status || 'غير محدد';
    const color = found?.color || '#6b7280';
    return (
      <Badge variant="outline" style={{ borderColor: color, color }}>
        {label}
      </Badge>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const priorityConfig = {
      low: { label: 'منخفضة', className: 'text-blue bg-blue-100' },
      normal: { label: 'عادية', className: 'text-green bg-green-100' },
      high: { label: 'عالية', className: 'text-orange bg-orange-100' },
      urgent: { label: 'عاجلة', className: 'text-red bg-red-100' }
    };

    const config = priorityConfig[priority as keyof typeof priorityConfig] || priorityConfig.normal;
    return (
      <Badge className={config.className}>
        {config.label}
      </Badge>
    );
  };

  const handleMaintenanceSubmit = async () => {
    if (!selectedBillboard || !maintenanceForm.type || !maintenanceForm.description) {
      toast({
        title: "بيانات ناقصة",
        description: "يرجى ملء جميع الحقول المطلوبة",
        variant: "destructive"
      });
      return;
    }

    try {
      // إضافة سجل صيانة جديد
      const { error: historyError } = await supabase
        .from('maintenance_history')
        .insert({
          billboard_id: selectedBillboard.ID,
          maintenance_type: maintenanceForm.type,
          description: maintenanceForm.description,
          cost: maintenanceForm.cost ? parseFloat(maintenanceForm.cost) : null,
          technician_name: maintenanceForm.technician || null,
          priority: maintenanceForm.priority,
          maintenance_date: maintenanceForm.scheduledDate || new Date().toISOString()
        });

      if (historyError) throw historyError;

      // تحديث حالة اللوحة
      const newStatus = maintenanceForm.type === 'إصلاح' ? 'repair_needed' : 'maintenance';
      
      // تحديد القيم حسب نوع الصيانة
      const updateData: any = {
        maintenance_status: newStatus,
        maintenance_date: new Date().toISOString(),
        maintenance_notes: maintenanceForm.description,
        maintenance_type: maintenanceForm.type,
        maintenance_cost: maintenanceForm.cost ? parseFloat(maintenanceForm.cost) : null,
        maintenance_priority: maintenanceForm.priority
      };

      // إذا كان نوع الصيانة "إزالة للتطوير" أو "تمت الإزالة" أو "تحتاج إزالة"، تغيير Status و maintenance_status
      if (maintenanceForm.type === 'إزالة للتطوير' || maintenanceForm.type === 'تمت الإزالة' || maintenanceForm.type === 'تحتاج إزالة') {
        updateData.Status = 'إزالة';
        updateData.maintenance_status = 'removed'; // تمت الإزالة
      }

      const { error: updateError } = await supabase
        .from('billboards')
        .update(updateData)
        .eq('ID', selectedBillboard.ID);

      if (updateError) throw updateError;

      toast({
        title: "تم بنجاح",
        description: (maintenanceForm.type === 'إزالة للتطوير' || maintenanceForm.type === 'تمت الإزالة' || maintenanceForm.type === 'تحتاج إزالة')
          ? "تم تغيير حالة اللوحة إلى 'إزالة' ولن تظهر في اللوحات المتاحة" 
          : "تم إضافة سجل الصيانة وتحديث حالة اللوحة"
      });

      setIsMaintenanceDialogOpen(false);
      setMaintenanceForm({
        type: '',
        description: '',
        cost: '',
        technician: '',
        priority: 'normal',
        scheduledDate: ''
      });
      // ✅ تأجيل تحديث الحالة حتى تُكمل animation إغلاق النافذة
      const _selectedId = selectedBillboard?.ID;
      const _updateDataSnapshot = { ...updateData };
      const _isRemovedSnapshot = _updateDataSnapshot.Status === 'إزالة';
      setTimeout(() => {
        startTransition(() => {
          if (_isRemovedSnapshot) {
            setBillboards(prev => prev.filter(b => b.ID !== _selectedId));
          } else {
            setBillboards(prev => prev.map(b =>
              b.ID === _selectedId
                ? { ...b, ..._updateDataSnapshot }
                : b
            ));
          }
        });
      }, 250);
    } catch (error) {
      console.error('Error submitting maintenance:', error);
      toast({
        title: "خطأ في الحفظ",
        description: "تعذر حفظ بيانات الصيانة",
        variant: "destructive"
      });
    }
  };

  const handleStatusChange = async (billboardId: number, newStatus: string) => {
    // ✅ تأجيل 50ms حتى يُكمل Radix Select إغلاق قائمته قبل إعادة رسم الصفحة
    const _billboardId = billboardId;
    const _newStatus = newStatus;
    setTimeout(() => {
      startTransition(() => {
        setBillboards(prev => prev.map(b =>
          b.ID === _billboardId
            ? { ...b, maintenance_status: _newStatus, maintenance_date: new Date().toISOString() }
            : b
        ));
      });
    }, 50);
    try {
      const { error } = await supabase
        .from('billboards')
        .update({ 
          maintenance_status: newStatus,
          maintenance_date: new Date().toISOString()
        })
        .eq('ID', billboardId);

      if (error) throw error;

      toast({
        title: "تم التحديث",
        description: "تم تحديث حالة اللوحة بنجاح"
      });
    } catch (error) {
      // التراجع عند الخطأ
      console.error('Error updating status:', error);
      loadData();
      toast({
        title: "خطأ في التحديث",
        description: "تعذر تحديث حالة اللوحة",
        variant: "destructive"
      });
    }
  };

  // ✅ تقرير طباعة محسن مطابق لتقارير العقود
  const printMaintenanceReport = async () => {
    const filteredBillboards = getFilteredBillboards();

    if (filteredBillboards.length === 0) {
      toast({
        title: 'لا توجد بيانات للطباعة',
        description: 'يرجى التأكد من توفر لوحات ضمن نتائج الصيانة قبل الطباعة.',
        variant: 'destructive',
      });
      return;
    }

      const normalizeBoard = (board: Billboard) => {
      const id = String(board.ID ?? '').trim();
      const name = board.Billboard_Name?.trim() || (id ? `لوحة ${id}` : 'لوحة غير معروفة');
      const image = board.Image_URL?.trim() || '';
      const municipality = board.Municipality?.trim() || '';
      const district = board.District?.trim() || '';
      const landmark = board.Nearest_Landmark?.trim() || '';
      const size = board.Size?.trim() || '';
      const rawFaces =
        (board as Record<string, unknown>).Faces ??
        (board as Record<string, unknown>)['Number_of_Faces'] ??
        '';
      const maintenanceType = board.maintenance_type?.trim() || '';
      const faces = String(rawFaces ?? '').trim() || maintenanceType;
      let coords = String(
        (board as Record<string, unknown>).GPS_Coordinates ??
          board.GPS_Link ??
          (board as Record<string, unknown>).GPS ??
          '',
      ).trim();

      if (coords && coords !== 'null' && coords !== 'undefined') {
        if (!coords.startsWith('http')) {
          coords = `https://www.google.com/maps?q=${encodeURIComponent(coords)}`;
        }
      } else {
        const lat = (board as Record<string, unknown>).Latitude ?? (board as Record<string, unknown>).lat;
        const lng = (board as Record<string, unknown>).Longitude ?? (board as Record<string, unknown>).lng;
        if (lat != null && lng != null) {
          coords = `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
        } else {
          coords = '';
        }
      }

      const foundStatus = dynamicStatuses.find(s => s.name === board.maintenance_status);
      const maintenanceStatus = foundStatus?.label || board.maintenance_status || 'غير محدد';

      const priorityLabel = board.maintenance_priority === 'low'
        ? 'منخفضة'
        : board.maintenance_priority === 'normal'
          ? 'عادية'
          : board.maintenance_priority === 'high'
            ? 'عالية'
            : board.maintenance_priority === 'urgent'
              ? 'عاجلة'
              : 'غير محدد';

      const lastMaintenanceDate = board.maintenance_date
        ? new Date(board.maintenance_date).toLocaleDateString('ar-LY')
        : '';

      return {
        id,
        name,
        image,
        municipality,
        district,
        landmark,
        size,
        faces,
        status: maintenanceStatus,
        priority: priorityLabel,
        lastMaintenanceDate,
        mapLink: coords,
      };
    };

    const normalizedBoards = filteredBillboards.map(normalizeBoard);
    type NormalizedBoard = (typeof normalizedBoards)[number];

    const START_Y = 63.53;
    const ROW_H = 13.818;
    const PAGE_H = 297;
    const ROWS_PER_PAGE = Math.max(1, Math.floor((PAGE_H - START_Y) / ROW_H));

    const tablePagesHtml = normalizedBoards
      .reduce((pages: NormalizedBoard[][], row, index) => {
        const pageIndex = Math.floor(index / ROWS_PER_PAGE);
        if (!pages[pageIndex]) pages[pageIndex] = [];
        pages[pageIndex].push(row);
        return pages;
      }, [] as NormalizedBoard[][])
      .map(
        (pageRows) => `
              <div class="template-container page">
                <img src="/in1.svg" alt="خلفية جدول اللوحات" class="template-image" onerror="console.warn('Failed to load in1.svg')" />
                <div class="table-area">
                  <table class="btable" dir="rtl">
                    <colgroup>
                      <col style="width:18mm" />
                      <col style="width:22mm" />
                      <col style="width:22mm" />
                      <col style="width:22mm" />
                      <col style="width:40mm" />
                      <col style="width:20mm" />
                      <col style="width:20mm" />
                      <col style="width:20mm" />
                    </colgroup>
                    <tbody>
                      ${pageRows
                        .map(
                          (row) => `
                          <tr>
                            <td class="c-name">${row.name || row.id}</td>
                            <td class="c-img">${
                              row.image
                                ? `<img src="${row.image}" alt="صورة اللوحة" onerror="this.style.display='none'" />`
                                : ''
                            }</td>
                            <td>${row.municipality}</td>
                            <td>${row.district}</td>
                            <td>${row.landmark}</td>
                            <td>${row.size || '-'}${row.status ? `<div class="cell-sub">${row.status}</div>` : ''}</td>
                            <td>${row.priority}${row.faces ? `<div class="cell-sub">${row.faces}</div>` : ''}</td>
                            <td>${row.mapLink
                              ? `<a href="${row.mapLink}" target="_blank" rel="noopener">الخريطة</a>${
                                  row.lastMaintenanceDate
                                    ? `<div class="cell-sub">${row.lastMaintenanceDate}</div>`
                                    : ''
                                }`
                              : row.lastMaintenanceDate}
                            </td>
                          </tr>`
                        )
                        .join('')}
                    </tbody>
                  </table>
                </div>
              </div>
            `,
      )
      .join('');

    const html = `<!DOCTYPE html>
        <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>تقرير صيانة اللوحات</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
            @font-face { font-family: 'Doran'; src: url('/Doran-Regular.otf') format('opentype'); font-weight: 400; font-style: normal; font-display: swap; }
            @font-face { font-family: 'Doran'; src: url('/Doran-Bold.otf') format('opentype'); font-weight: 700; font-style: normal; font-display: swap; }
            * { margin: 0 !important; padding: 0 !important; box-sizing: border-box; }
            html, body { width: 100% !important; height: 100% !important; overflow: hidden; font-family: 'Noto Sans Arabic','Doran','Arial Unicode MS',Arial,sans-serif; direction: rtl; text-align: right; background: #fff; color: #000; }
            .template-container { position: relative; width: 100vw; height: 100vh; overflow: hidden; display: block; }
            .template-image { position: absolute; inset: 0; width: 100% !important; height: 100% !important; object-fit: cover; object-position: center; z-index: 1; display: block; }
            .page { page-break-after: always; page-break-inside: avoid; }
            .table-area { position: absolute; top: 63.53mm; left: 12.8765mm; right: 12.8765mm; z-index: 20; }
            .btable { width: 100%; border-collapse: collapse; border-spacing: 0; font-size: 8px; font-family: 'Doran','Noto Sans Arabic','Arial Unicode MS',Arial,sans-serif; table-layout: fixed; border: 0.2mm solid #000; }
            .btable tr { height: 15mm; }
            .btable td { border: 0.2mm solid #000; padding: 0 1mm; vertical-align: middle; text-align: center; background: transparent; color: #000; white-space: normal; word-break: break-word; overflow: hidden; height: 15mm; }
            .btable td a { color: #0047AB; text-decoration: none; }
            .cell-sub { margin-top: 2px; font-size: 7px; color: #333; }
            .c-img { height: 100%; padding: 0.5mm !important; }
            .c-img img { width: 100%; height: 100%; max-height: 14mm; object-fit: contain; object-position: center; display: block; }
            @media print { html, body { width: 210mm !important; min-height: 297mm !important; height: auto !important; margin:0 !important; padding:0 !important; overflow: visible !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .template-container { width: 210mm !important; height: 297mm !important; position: relative !important; }
              .template-image { width: 210mm !important; height: 297mm !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              @page { size: A4; margin: 0 !important; padding: 0 !important; } .controls{display:none!important}
            }
            .controls{position:fixed;bottom:16px;left:50%;transform:translateX(-50%);z-index:99}
            .controls button{padding:8px 14px;border:0;border-radius:6px;background:#0066cc;color:#fff;cursor:pointer}
          </style>
        </head>
        <body>
          ${tablePagesHtml}
          <div class="controls"><button onclick="window.print()">طباعة</button></div>
        </body>
        </html>`;

    const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
    showPrintPreview(html, 'كشف الصيانة', 'maintenance');
  };

  // إزالة اللوحة من قائمة الصيانة عند تغيير حالتها إلى "بحالة جيدة"
  const handleCompleteMaintenanceAndRemove = async (billboardId: number) => {
    // إزالة تفاؤلية فورية من القائمة
    setBillboards(prev => prev.filter(b => b.ID !== billboardId));
    try {
      const { error } = await supabase
        .from('billboards')
        .update({ 
          maintenance_status: 'operational',
          maintenance_date: new Date().toISOString()
        })
        .eq('ID', billboardId);

      if (error) throw error;

      toast({
        title: "تم إكمال الصيانة",
        description: "تم إكمال صيانة اللوحة وإزالتها من القائمة"
      });
    } catch (error) {
      // التراجع عند الخطأ - إعادة تحميل البيانات
      console.error('Error completing maintenance:', error);
      loadData();
      toast({
        title: "خطأ في التحديث",
        description: "تعذر إكمال الصيانة",
        variant: "destructive"
      });
    }
  };

  const getFilteredBillboards = () => {
    return billboards.filter(billboard => {
      const matchesSearch = 
        billboard.Billboard_Name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        billboard.Nearest_Landmark?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        billboard.District?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(billboard.ID).includes(searchTerm);
      
      const matchesTab = activeTab === 'all' || billboard.maintenance_status === activeTab;
      const matchesStatus = statusFilter === 'all' || billboard.maintenance_status === statusFilter;
      const matchesPriority = priorityFilter === 'all' || billboard.maintenance_priority === priorityFilter;

      return matchesSearch && matchesTab && matchesStatus && matchesPriority;
    });
  };

  // حساب عدد اللوحات لكل حالة
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = { all: billboards.length };
    billboards.forEach(b => {
      const s = b.maintenance_status || 'unknown';
      counts[s] = (counts[s] || 0) + 1;
    });
    return counts;
  }, [billboards]);

  // الحالات الموجودة فعلياً في اللوحات المحملة
  const activeStatuses = useMemo(() => {
    const unique = new Set(billboards.map(b => b.maintenance_status).filter(Boolean));
    return dynamicStatuses.filter(s => unique.has(s.name));
  }, [billboards, dynamicStatuses]);

  if (loading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center h-32">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            <span className="mr-2">جاري تحميل بيانات الصيانة...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const filteredBillboards = getFilteredBillboards();

  return (
    <div className="space-y-6">
      {/* رأس القسم */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-gradient-primary rounded-lg">
            <Wrench className="h-6 w-6 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-2xl font-bold">صيانة اللوحات الطرقية</h2>
            <p className="text-muted-foreground">إدارة ومتابعة اللوحات التي تحتاج صيانة أو بها مشاكل</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" className="gap-2" onClick={() => setManageStatusesOpen(true)}>
            <Settings className="h-4 w-4" />
            إدارة الحالات
          </Button>
          <Button variant="outline" className="gap-2" onClick={printMaintenanceReport}>
            <Printer className="h-4 w-4" />
            طباعة التقرير
          </Button>
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            تصدير
          </Button>
        </div>
      </div>

      {/* تبويبات حسب حالة الصيانة */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="all" className="gap-1">
            الكل <Badge variant="secondary" className="text-xs px-1.5">{statusCounts.all || 0}</Badge>
          </TabsTrigger>
          {activeStatuses.map(s => (
            <TabsTrigger key={s.name} value={s.name} className="gap-1">
              <span className="inline-block w-2 h-2 rounded-full" style={{ backgroundColor: s.color }} />
              {s.label}
              <Badge variant="secondary" className="text-xs px-1.5">{statusCounts[s.name] || 0}</Badge>
            </TabsTrigger>
          ))}
        </TabsList>
      </Tabs>

      {/* البحث والفلاتر */}
      <Card>
        <CardContent className="p-4">
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex-1 relative min-w-[200px]">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="ابحث في اللوحات..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10"
              />
            </div>

            <Select value={priorityFilter} onValueChange={setPriorityFilter}>
              <SelectTrigger className="w-48">
                <SelectValue placeholder="فلترة حسب الأولوية" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع الأولويات</SelectItem>
                <SelectItem value="low">منخفضة</SelectItem>
                <SelectItem value="normal">عادية</SelectItem>
                <SelectItem value="high">عالية</SelectItem>
                <SelectItem value="urgent">عاجلة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* اللوحات */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>اللوحات التي تحتاج صيانة ({filteredBillboards.length})</CardTitle>
          <div className="flex items-center gap-2">
            <Button
              variant={viewMode === 'cards' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('cards')}
              className="h-8 gap-1"
            >
              <LayoutGrid className="h-4 w-4" />
              كروت
            </Button>
            <Button
              variant={viewMode === 'table' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setViewMode('table')}
              className="h-8 gap-1"
            >
              <List className="h-4 w-4" />
              جدول
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {viewMode === 'cards' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredBillboards.map((billboard) => (
                <MaintenanceBillboardCard
                  key={billboard.ID}
                  billboard={billboard}
                  onMaintenanceClick={(b) => {
                    setSelectedBillboard(b);
                    setIsMaintenanceDialogOpen(true);
                  }}
                  onCompleteClick={handleCompleteMaintenanceAndRemove}
                  onStatusChange={handleStatusChange}
                />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-right p-3 font-medium">اسم اللوحة</th>
                    <th className="text-right p-3 font-medium">الموقع</th>
                    <th className="text-right p-3 font-medium">الحجم</th>
                    <th className="text-right p-3 font-medium">الحالة</th>
                    <th className="text-right p-3 font-medium">الأولوية</th>
                    <th className="text-right p-3 font-medium">آخر صيانة</th>
                    <th className="text-right p-3 font-medium">التكلفة</th>
                    <th className="text-right p-3 font-medium">الإجراءات</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBillboards.map((billboard) => (
                    <tr key={billboard.ID} className="border-b hover:bg-muted/50">
                      <td className="p-3 font-medium">
                        {billboard.Billboard_Name || `لوحة رقم ${billboard.ID}`}
                      </td>
                      <td className="p-3">{billboard.Nearest_Landmark || billboard.District || 'غير محدد'}</td>
                      <td className="p-3">{billboard.Size || 'غير محدد'}</td>
                      <td className="p-3">{getStatusBadge(billboard.maintenance_status)}</td>
                      <td className="p-3">{getPriorityBadge(billboard.maintenance_priority)}</td>
                      <td className="p-3">
                        {billboard.maintenance_date 
                          ? new Date(billboard.maintenance_date).toLocaleDateString('ar-LY')
                          : 'لا يوجد'
                        }
                      </td>
                      <td className="p-3">
                        {billboard.maintenance_cost 
                          ? `${billboard.maintenance_cost.toLocaleString()} د.ل`
                          : 'غير محدد'
                        }
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 gap-1 text-xs"
                            onClick={() => {
                              setSelectedBillboard(billboard);
                              setIsMaintenanceDialogOpen(true);
                            }}
                          >
                            <Wrench className="h-3 w-3" />
                            صيانة
                          </Button>
                          <Button
                            size="sm"
                            variant="default"
                            className="h-7 gap-1 text-xs"
                            onClick={() => handleCompleteMaintenanceAndRemove(billboard.ID)}
                          >
                            <CheckCircle className="h-3 w-3" />
                            إكمال
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {filteredBillboards.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              لا توجد لوحات تحتاج صيانة حالياً
            </div>
          )}
        </CardContent>
      </Card>

      {/* نافذة إضافة صيانة */}
      <Dialog open={isMaintenanceDialogOpen} onOpenChange={setIsMaintenanceDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة سجل صيانة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {selectedBillboard && (
              <div className="p-3 bg-muted rounded-lg">
                <p className="font-medium">{selectedBillboard.Billboard_Name || `لوحة رقم ${selectedBillboard.ID}`}</p>
                <p className="text-sm text-muted-foreground">{selectedBillboard.Nearest_Landmark || selectedBillboard.District}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="maintenance-type">ملاحظات الصيانة</Label>
              <Input
                id="maintenance-type"
                placeholder="اكتب ملاحظات الصيانة..."
                value={maintenanceForm.type}
                onChange={(e) => setMaintenanceForm(prev => ({ ...prev, type: e.target.value }))}
                list="maintenance-suggestions"
              />
              <datalist id="maintenance-suggestions">
                <option value="صيانة دورية" />
                <option value="إصلاح" />
                <option value="تنظيف" />
                <option value="استبدال قطع" />
                <option value="فحص" />
                <option value="طباعة" />
                <option value="تركيب" />
                <option value="دهان" />
                <option value="كهرباء" />
                <option value="لحام" />
                <option value="لم يتم التركيب" />
                <option value="تحتاج إزالة" />
                <option value="إزالة للتطوير" />
                <option value="تمت الإزالة" />
              </datalist>
              {(maintenanceForm.type === 'إزالة للتطوير' || maintenanceForm.type === 'تمت الإزالة' || maintenanceForm.type === 'تحتاج إزالة') && (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg dark:bg-yellow-900/20 dark:border-yellow-800">
                  <p className="text-sm font-medium text-yellow-800 dark:text-yellow-400 flex items-center gap-2">
                    <AlertTriangle className="h-4 w-4" />
                    تنبيه: حالة إزالة
                  </p>
                  <p className="text-xs text-yellow-700 dark:text-yellow-500 mt-1">
                    سيتم تغيير حالة اللوحة ولن تظهر في قوائم المتاح
                  </p>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">الوصف *</Label>
              <Textarea
                id="description"
                placeholder="وصف تفصيلي للصيانة المطلوبة..."
                value={maintenanceForm.description}
                onChange={(e) => setMaintenanceForm(prev => ({ ...prev, description: e.target.value }))}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="cost">التكلفة (د.ل)</Label>
                <Input
                  id="cost"
                  type="number"
                  placeholder="0"
                  value={maintenanceForm.cost}
                  onChange={(e) => setMaintenanceForm(prev => ({ ...prev, cost: e.target.value }))}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="priority">الأولوية</Label>
                <Select
                  value={maintenanceForm.priority}
                  onValueChange={(value) => setMaintenanceForm(prev => ({ ...prev, priority: value }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">منخفضة</SelectItem>
                    <SelectItem value="normal">عادية</SelectItem>
                    <SelectItem value="high">عالية</SelectItem>
                    <SelectItem value="urgent">عاجلة</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="technician">اسم الفن  </Label>
              <Input
                id="technician"
                placeholder="اسم الفني المسؤول"
                value={maintenanceForm.technician}
                onChange={(e) => setMaintenanceForm(prev => ({ ...prev, technician: e.target.value }))}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="scheduled-date">تاريخ الصيانة المجدولة</Label>
              <Input
                id="scheduled-date"
                type="datetime-local"
                value={maintenanceForm.scheduledDate}
                onChange={(e) => setMaintenanceForm(prev => ({ ...prev, scheduledDate: e.target.value }))}
              />
            </div>

            <div className="flex gap-2 pt-4">
              <Button onClick={handleMaintenanceSubmit} className="flex-1">
                حفظ
              </Button>
              <Button
                variant="outline"
                onClick={() => setIsMaintenanceDialogOpen(false)}
                className="flex-1"
              >
                إلغاء
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <ManageMaintenanceStatusesDialog
        open={manageStatusesOpen}
        onOpenChange={setManageStatusesOpen}
        onChanged={loadData}
      />
    </div>
  );
}
