import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { toast } from '@/components/ui/sonner';
import { 
  ArrowLeft, Calendar, User, DollarSign, MapPin, FileText, Percent, 
  Wrench, Eye, Phone, Mail, Building, Clock, CheckCircle, AlertCircle,
  Printer, Edit, TrendingUp, TrendingDown, Minus, ImageIcon, PaintBucket,
  ChevronDown, ChevronUp, LayoutGrid, List
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate, useParams } from 'react-router-dom';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BillboardImage } from '@/components/BillboardImage';
import ContractPDFDialog from '@/pages/ContractPDFDialog';
import { ContractExpensesManager } from '@/components/contracts/ContractExpensesManager';

interface Contract {
  [key: string]: any;
}

interface BillboardData {
  id: string;
  name: string;
  location: string;
  city: string;
  size: string;
  level: string;
  price: number;
  image?: string;
  faces?: number;
  designFaceA?: string;
  designFaceB?: string;
}

interface DesignData {
  billboardId: string;
  designFaceA?: string;
  designFaceB?: string;
  installedFaceA?: string;
  installedFaceB?: string;
  status?: string;
}

export default function ContractView() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const [contract, setContract] = useState<Contract | null>(null);
  const [billboards, setBillboards] = useState<BillboardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [billboardDesigns, setBillboardDesigns] = useState<Map<string, DesignData>>(new Map());
  const [costSectionOpen, setCostSectionOpen] = useState(true);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [pdfOpen, setPdfOpen] = useState(false);

  useEffect(() => {
    if (id) {
      loadContract();
    }
  }, [id]);

  const loadContract = async () => {
    try {
      setLoading(true);
      
      let { data, error } = await (supabase as any)
        .from('Contract')
        .select('*')
        .eq('Contract_Number', id)
        .single();

      if (error && error.code === 'PGRST116') {
        const { data: dataById, error: errorById } = await (supabase as any)
          .from('Contract')
          .select('*')
          .eq('ID', id)
          .single();
        
        data = dataById;
        error = errorById;
      }

      if (error) {
        console.error('Error loading contract:', error);
        toast.error('فشل في تحميل العقد');
        return;
      }

      setContract(data);
      await loadBillboardsFromContract(data);
      await loadDesignsFromInstallationTasks(data);
      
    } catch (error) {
      console.error('Error loading contract:', error);
      toast.error('فشل في تحميل العقد');
    } finally {
      setLoading(false);
    }
  };

  const loadDesignsFromInstallationTasks = async (contractData: Contract) => {
    try {
      const contractId = contractData.Contract_Number || contractData.ID;
      
      const { data: tasks } = await supabase
        .from('installation_tasks')
        .select('id')
        .eq('contract_id', contractId);
      
      if (!tasks || tasks.length === 0) return;
      
      const taskIds = tasks.map(t => t.id);
      const { data: items } = await supabase
        .from('installation_task_items')
        .select('billboard_id, design_face_a, design_face_b, installed_image_face_a_url, installed_image_face_b_url, status')
        .in('task_id', taskIds);
      
      if (items && items.length > 0) {
        const designsMap = new Map<string, DesignData>();
        items.forEach((item: any) => {
          designsMap.set(String(item.billboard_id), {
            billboardId: String(item.billboard_id),
            designFaceA: item.design_face_a,
            designFaceB: item.design_face_b,
            installedFaceA: item.installed_image_face_a_url,
            installedFaceB: item.installed_image_face_b_url,
            status: item.status
          });
        });
        setBillboardDesigns(designsMap);
      }
    } catch (error) {
      console.error('Error loading designs:', error);
    }
  };

  const loadBillboardsFromContract = async (contractData: Contract) => {
    try {
      let billboardsToLoad: BillboardData[] = [];

      // ✅ جلب أسعار اللوحات التاريخية من العقد
      let billboardPricesMap: Record<string, number> = {};
      if (contractData.billboard_prices) {
        try {
          const pricesData = typeof contractData.billboard_prices === 'string'
            ? JSON.parse(contractData.billboard_prices)
            : contractData.billboard_prices;
          if (Array.isArray(pricesData)) {
            pricesData.forEach((item: any) => {
              const key = String(item.billboardId ?? item.billboard_id ?? item.ID ?? item.id ?? '');
              if (!key) return;
              const priceValue = item.finalPrice ?? item.priceAfterDiscount ?? item.netRentalAfterDiscount ?? item.price ?? item.priceBeforeDiscount ?? item.price_before_discount ?? item.billboardPrice ?? item.billboard_rent_price;
              const price = Math.round(Number(priceValue));
              if (!Number.isNaN(price)) billboardPricesMap[key] = price;
            });
          }
        } catch (e) {
          console.warn('Failed to parse billboard_prices:', e);
        }
      }

      if (contractData.billboard_ids) {
        const ids = contractData.billboard_ids.split(',').map((id: string) => parseInt(id.trim())).filter((id: number) => !isNaN(id));
        
        if (ids.length > 0) {
          const { data: billboardsData, error } = await (supabase as any)
            .from('billboards')
            .select('ID, Billboard_Name, Size, City, Level, Nearest_Landmark, Faces_Count, Image_URL, Price')
            .in('ID', ids);

          if (!error && billboardsData) {
            billboardsToLoad = billboardsData.map((b: any) => {
              const billboardId = String(b.ID);
              // ✅ استخدام السعر التاريخي من العقد إذا كان متوفراً
              const historicalPrice = billboardPricesMap[billboardId];
              return {
                id: billboardId,
                name: b.Billboard_Name || `لوحة ${b.ID}`,
                location: b.Nearest_Landmark || '',
                city: b.City || '',
                size: b.Size || '',
                level: b.Level || 'A',
                price: historicalPrice !== undefined ? historicalPrice : (Number(b.Price) || 0),
                faces: b.Faces_Count || 2,
                image: b.Image_URL || ''
              };
            });
          }
        }
      }

      if (billboardsToLoad.length === 0 && contractData.billboards_data) {
        try {
          const billboardsData = JSON.parse(contractData.billboards_data);
          if (Array.isArray(billboardsData)) {
            billboardsToLoad = billboardsData;
          }
        } catch (e) {
          console.warn('Failed to parse billboards_data:', e);
        }
      }

      setBillboards(billboardsToLoad);
    } catch (error) {
      console.error('Error loading billboards from contract:', error);
      setBillboards([]);
    }
  };

  const getFieldValue = (contract: Contract, ...fieldNames: string[]) => {
    for (const fieldName of fieldNames) {
      if (contract[fieldName] !== undefined && contract[fieldName] !== null && contract[fieldName] !== '') {
        return contract[fieldName];
      }
    }
    return '';
  };

  const getNumericFieldValue = (contract: Contract, ...fieldNames: string[]) => {
    for (const fieldName of fieldNames) {
      const value = contract[fieldName];
      if (value !== undefined && value !== null && !isNaN(Number(value))) {
        return Number(value);
      }
    }
    return 0;
  };

  const getContractStatus = () => {
    if (!contract) return { status: 'غير محدد', variant: 'secondary' as const, icon: null };
    
    const today = new Date();
    const endDateStr = getFieldValue(contract, 'End Date', 'end_date', 'End_Date');
    const startDateStr = getFieldValue(contract, 'Contract Date', 'start_date', 'Start_Date');
    const endDate = endDateStr ? new Date(endDateStr) : null;
    const startDate = startDateStr ? new Date(startDateStr) : null;

    if (!endDate || !startDate) {
      return { status: 'غير محدد', variant: 'secondary' as const, icon: null };
    }

    if (today < startDate) {
      return { status: 'لم يبدأ', variant: 'secondary' as const, icon: <Clock className="h-4 w-4" /> };
    } else if (today > endDate) {
      return { status: 'منتهي', variant: 'destructive' as const, icon: <AlertCircle className="h-4 w-4" /> };
    } else {
      const daysRemaining = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      if (daysRemaining <= 7) {
        return { status: `ينتهي خلال ${daysRemaining} أيام`, variant: 'outline' as const, icon: <Clock className="h-4 w-4" />, className: 'border-orange-500 text-orange-500' };
      }
      return { status: 'نشط', variant: 'default' as const, icon: <CheckCircle className="h-4 w-4" /> };
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('ar-LY', {
      style: 'decimal',
      minimumFractionDigits: 0,
      maximumFractionDigits: 2
    }).format(amount || 0);
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '—';
    try {
      return new Date(dateString).toLocaleDateString('ar-LY');
    } catch {
      return dateString;
    }
  };

  const getDaysRemaining = () => {
    if (!contract) return 0;
    const today = new Date();
    const endDateStr = getFieldValue(contract, 'End Date', 'end_date', 'End_Date');
    if (!endDateStr) return 0;
    
    try {
      const endDate = new Date(endDateStr);
      const diffTime = endDate.getTime() - today.getTime();
      return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    } catch {
      return 0;
    }
  };

  const getPaymentProgress = () => {
    if (!contract) return { percentage: 0, paid: 0, remaining: 0, total: 0 };
    
    const totalCost = getNumericFieldValue(contract, 'Total', 'total_cost', 'Total_Cost');
    const totalPaid = getNumericFieldValue(contract, 'Total Paid', 'total_paid', 'Total_Paid');
    // استخدم قيمة Remaining المخزنة إذا كانت متوفرة، وإلا احسبها
    const storedRemaining = getNumericFieldValue(contract, 'Remaining', 'remaining');
    const remaining = storedRemaining > 0 ? storedRemaining : Math.max(0, totalCost - totalPaid);
    const actualPaid = totalCost - remaining;
    const percentage = totalCost > 0 ? (actualPaid / totalCost) * 100 : 0;
    
    return { percentage, paid: actualPaid, remaining, total: totalCost };
  };

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-6" dir="rtl">
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          <p className="mr-3 text-muted-foreground">جاري تحميل العقد...</p>
        </div>
      </div>
    );
  }

  if (!contract) {
    return (
      <div className="container mx-auto px-4 py-6" dir="rtl">
        <div className="text-center py-20">
          <h2 className="text-2xl font-bold text-muted-foreground">العقد غير موجود</h2>
          <p className="text-muted-foreground mt-2">العقد رقم {id} غير موجود في النظام</p>
          <Button onClick={() => navigate('/admin/contracts')} className="mt-4">
            العودة إلى قائمة العقود
          </Button>
        </div>
      </div>
    );
  }

  const contractStatus = getContractStatus();
  const daysRemaining = getDaysRemaining();
  const paymentProgress = getPaymentProgress();

  const customerName = getFieldValue(contract, 'Customer Name', 'customer_name', 'Customer_Name');
  const adType = getFieldValue(contract, 'Ad Type', 'ad_type', 'Ad_Type') || 'غير محدد';
  const startDate = getFieldValue(contract, 'Contract Date', 'start_date', 'Start_Date');
  const endDate = getFieldValue(contract, 'End Date', 'end_date', 'End_Date');
  const phone = getFieldValue(contract, 'Phone', 'phone');
  
  const rentCost = getNumericFieldValue(contract, 'Total Rent', 'rent_cost', 'Rent_Cost');
  const installationCost = getNumericFieldValue(contract, 'installation_cost', 'Installation Cost');
  const printCost = getNumericFieldValue(contract, 'print_cost', 'Print Cost');
  const operatingFee = getNumericFieldValue(contract, 'fee', 'Operating Fee', 'operating_fee');
  const discount = getNumericFieldValue(contract, 'Discount', 'discount');
  const totalCost = getNumericFieldValue(contract, 'Total', 'total_cost', 'Total_Cost');
  const contractNumber = contract.Contract_Number || contract.ID;

  return (
    <div className="container mx-auto px-4 py-6 space-y-6" dir="rtl">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <Button
            variant="outline"
            onClick={() => navigate('/admin/contracts')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            العودة
          </Button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-bold text-foreground">
                العقد #{contractNumber}
              </h1>
              <Badge variant={contractStatus.variant} className={`gap-1 text-base px-3 py-1 ${(contractStatus as any).className || ''}`}>
                {contractStatus.icon}
                {contractStatus.status}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-1">{customerName}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigate(`/admin/contracts/edit?contract=${contractNumber}`)}
            className="gap-2"
          >
            <Edit className="h-4 w-4" />
            تعديل
          </Button>
          <Button variant="outline" className="gap-2" onClick={() => setPdfOpen(true)}>
            <Printer className="h-4 w-4" />
            طباعة
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-500/20 rounded-lg">
                <MapPin className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">اللوحات</p>
                <p className="text-2xl font-bold font-manrope">{billboards.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-500/20 rounded-lg">
                <DollarSign className="h-5 w-5 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">المدفوع</p>
                <p className="text-2xl font-bold text-green-600 font-manrope">{formatCurrency(paymentProgress.paid)}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-500/20 rounded-lg">
                <Clock className="h-5 w-5 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">الأيام المتبقية</p>
                <p className={`text-2xl font-bold font-manrope ${daysRemaining < 0 ? 'text-destructive' : daysRemaining < 30 ? 'text-orange-500' : 'text-green-500'}`}>
                  {daysRemaining < 0 ? Math.abs(daysRemaining) : daysRemaining}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-500/20 rounded-lg">
                <TrendingUp className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">نسبة السداد</p>
                <p className="text-2xl font-bold font-manrope">{paymentProgress.percentage.toFixed(0)}%</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Payment Progress */}
      <Card>
        <CardContent className="p-4">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">تقدم السداد</span>
            <span className="text-sm text-muted-foreground font-manrope">
              {formatCurrency(paymentProgress.paid)} / {formatCurrency(paymentProgress.total)} د.ل
            </span>
          </div>
          <Progress value={paymentProgress.percentage} className="h-3" />
          <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground font-manrope">
            <span>المدفوع: {formatCurrency(paymentProgress.paid)} د.ل</span>
            <span>المتبقي: {formatCurrency(paymentProgress.remaining)} د.ل</span>
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer & Contract Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  معلومات العميل
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">اسم العميل</p>
                  <p className="font-semibold text-lg">{customerName || 'غير محدد'}</p>
                </div>
                {phone && (
                  <div className="flex items-center gap-2 font-manrope">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span dir="ltr">{phone}</span>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">نوع الإعلان</p>
                  <Badge variant="outline">{adType}</Badge>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  مدة العقد
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-muted-foreground">البداية</p>
                    <p className="font-semibold font-manrope">{formatDate(startDate)}</p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">النهاية</p>
                    <p className="font-semibold font-manrope">{formatDate(endDate)}</p>
                  </div>
                </div>
                <div className={`p-2 rounded-lg text-center font-manrope ${
                  daysRemaining < 0 ? 'bg-destructive/10 text-destructive' :
                  daysRemaining < 30 ? 'bg-orange-500/10 text-orange-600' :
                  'bg-green-500/10 text-green-600'
                }`}>
                  {daysRemaining < 0 
                    ? `منتهي منذ ${Math.abs(daysRemaining)} يوم`
                    : `${daysRemaining} يوم متبقي`
                  }
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Billboards Section */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5 text-primary" />
                  اللوحات الإعلانية ({billboards.length})
                </CardTitle>
                <div className="flex items-center gap-2">
                  <Button
                    variant={viewMode === 'grid' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('grid')}
                  >
                    <LayoutGrid className="h-4 w-4" />
                  </Button>
                  <Button
                    variant={viewMode === 'list' ? 'default' : 'outline'}
                    size="sm"
                    onClick={() => setViewMode('list')}
                  >
                    <List className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {billboards.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  لا توجد لوحات مرتبطة بهذا العقد
                </div>
              ) : viewMode === 'grid' ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {billboards.map((billboard) => {
                    const design = billboardDesigns.get(billboard.id);
                    // الأولوية: صورة التركيب > التصميم > صورة اللوحة
                    const installedImage = design?.installedFaceA || design?.installedFaceB;
                    const designImage = design?.designFaceA || design?.designFaceB;
                    const displayImage = installedImage || designImage;
                    const isInstalled = design?.status === 'completed' && installedImage;
                    
                    return (
                      <Card key={billboard.id} className="overflow-hidden group hover:shadow-lg transition-all">
                        {/* Display Image - Priority: Installed > Design > Billboard */}
                        <div className="relative h-40 w-full overflow-hidden bg-muted">
                          {displayImage ? (
                            <>
                              <img
                                src={displayImage}
                                alt={isInstalled ? "صورة التركيب" : "التصميم"}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).style.display = 'none';
                                }}
                              />
                              <div className="absolute top-2 left-2">
                                <Badge className={`gap-1 ${isInstalled ? 'bg-green-600' : 'bg-primary/90'} text-primary-foreground`}>
                                  {isInstalled ? (
                                    <>
                                      <CheckCircle className="h-3 w-3" />
                                      مُركب
                                    </>
                                  ) : (
                                    <>
                                      <ImageIcon className="h-3 w-3" />
                                      تصميم
                                    </>
                                  )}
                                </Badge>
                              </div>
                            </>
                          ) : (
                            <BillboardImage
                              billboard={{
                                ID: billboard.id,
                                Billboard_Name: billboard.name,
                                Image_URL: billboard.image,
                                image_name: billboard.image
                              }}
                              className="w-full h-full object-cover"
                              alt={billboard.name}
                            />
                          )}
                        </div>
                        
                        <CardContent className="p-4 space-y-2">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-lg">{billboard.name}</h3>
                            <Badge variant="outline">{billboard.level}</Badge>
                          </div>
                          
                          <p className="text-sm text-muted-foreground flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {billboard.location} - {billboard.city}
                          </p>
                          
                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">الحجم: <span className="font-medium text-foreground">{billboard.size}</span></span>
                            {billboard.faces && (
                              <span className="text-muted-foreground">{billboard.faces} وجه</span>
                            )}
                          </div>

                          <div className="flex items-center justify-between text-sm">
                            <span className="text-muted-foreground">السعر</span>
                            <span className="font-semibold text-primary font-manrope">{formatCurrency(billboard.price)} د.ل</span>
                          </div>
                          
                          {/* Design Preview Thumbnails */}
                          {design && (design.designFaceA || design.designFaceB) && (
                            <div className="flex gap-2 pt-2 border-t">
                              {design.designFaceA && (
                                <div className="flex-1">
                                  <p className="text-xs text-muted-foreground mb-1">الوجه A</p>
                                  <img 
                                    src={design.designFaceA} 
                                    alt="الوجه A" 
                                    className="w-full h-16 object-cover rounded border"
                                  />
                                </div>
                              )}
                              {design.designFaceB && (
                                <div className="flex-1">
                                  <p className="text-xs text-muted-foreground mb-1">الوجه B</p>
                                  <img 
                                    src={design.designFaceB} 
                                    alt="الوجه B" 
                                    className="w-full h-16 object-cover rounded border"
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-2">
                  {billboards.map((billboard) => {
                    const design = billboardDesigns.get(billboard.id);
                    const installedImage = design?.installedFaceA || design?.installedFaceB;
                    const designImage = design?.designFaceA || design?.designFaceB;
                    const displayImage = installedImage || designImage;
                    const isInstalled = design?.status === 'completed' && installedImage;
                    
                    return (
                      <div key={billboard.id} className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                        {displayImage ? (
                          <img
                            src={displayImage}
                            alt={billboard.name}
                            className="w-16 h-16 object-cover rounded"
                          />
                        ) : (
                          <BillboardImage
                            billboard={{
                              ID: billboard.id,
                              Billboard_Name: billboard.name,
                              Image_URL: billboard.image,
                              image_name: billboard.image
                            }}
                            className="w-16 h-16 object-cover rounded"
                            alt={billboard.name}
                          />
                        )}
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{billboard.name}</span>
                            <Badge variant="outline" className="text-xs">{billboard.level}</Badge>
                            {isInstalled ? (
                              <Badge className="text-xs gap-1 bg-green-600">
                                <CheckCircle className="h-3 w-3" />
                                مُركب
                              </Badge>
                            ) : designImage ? (
                              <Badge className="text-xs gap-1">
                                <ImageIcon className="h-3 w-3" />
                                تصميم
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-sm text-muted-foreground">{billboard.location} - {billboard.city}</p>
                        </div>
                        <div className="text-left">
                          <p className="text-sm text-muted-foreground">{billboard.size}</p>
                          <p className="font-semibold text-primary font-manrope">{formatCurrency(billboard.price)} د.ل</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar - Financial Summary */}
        <div className="space-y-4">
          {/* Cost Breakdown */}
          <Collapsible open={costSectionOpen} onOpenChange={setCostSectionOpen}>
            <Card>
              <CollapsibleTrigger asChild>
                <CardHeader className="cursor-pointer hover:bg-muted/50 transition-colors">
                  <CardTitle className="flex items-center justify-between">
                    <span className="flex items-center gap-2">
                      <DollarSign className="h-5 w-5 text-primary" />
                      تفاصيل التكلفة
                    </span>
                    {costSectionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </CardTitle>
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="space-y-3 pt-0">
                  <div className="flex justify-between items-center py-2">
                    <span className="text-muted-foreground">الإيجار</span>
                    <span className="font-semibold text-green-600 font-manrope">{formatCurrency(rentCost)} د.ل</span>
                  </div>
                  
                  {installationCost > 0 && (
                    <div className="flex justify-between items-center py-2 border-t">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Wrench className="h-3 w-3" />
                        التركيب
                      </span>
                      <span className="font-medium text-orange-500 font-manrope">{formatCurrency(installationCost)} د.ل</span>
                    </div>
                  )}
                  
                  {printCost > 0 && (
                    <div className="flex justify-between items-center py-2 border-t">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <PaintBucket className="h-3 w-3" />
                        الطباعة
                      </span>
                      <span className="font-medium text-purple-500 font-manrope">{formatCurrency(printCost)} د.ل</span>
                    </div>
                  )}
                  
                  {operatingFee > 0 && (
                    <div className="flex justify-between items-center py-2 border-t">
                      <span className="text-muted-foreground flex items-center gap-1">
                        <Percent className="h-3 w-3" />
                        رسوم التشغيل
                      </span>
                      <span className="font-medium text-blue-500 font-manrope">{formatCurrency(operatingFee)} د.ل</span>
                    </div>
                  )}
                  
                  {discount > 0 && (
                    <div className="flex justify-between items-center py-2 border-t text-destructive">
                      <span>الخصم</span>
                      <span className="font-medium font-manrope">-{formatCurrency(discount)} د.ل</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between items-center py-3 border-t-2 border-primary/30 bg-primary/5 -mx-6 px-6">
                    <span className="font-bold text-lg">الإجمالي</span>
                    <span className="font-bold text-2xl text-primary font-manrope">{formatCurrency(totalCost)} د.ل</span>
                  </div>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>

          {/* Payment Status */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                حالة السداد
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">المدفوع</span>
                <span className="font-semibold text-green-600 font-manrope">{formatCurrency(paymentProgress.paid)} د.ل</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">المتبقي</span>
                <span className={`font-semibold font-manrope ${paymentProgress.remaining > 0 ? 'text-destructive' : 'text-green-600'}`}>
                  {formatCurrency(paymentProgress.remaining)} د.ل
                </span>
              </div>
              <Progress value={paymentProgress.percentage} className="h-2" />
              <p className="text-center text-sm text-muted-foreground font-manrope">
                {paymentProgress.percentage.toFixed(0)}% مكتمل
              </p>
            </CardContent>
          </Card>

          {/* Contract Info */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <FileText className="h-4 w-4 text-primary" />
                معلومات العقد
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">رقم العقد</span>
                <span className="font-mono font-semibold font-manrope">#{contractNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">تاريخ الإنشاء</span>
                <span className="font-manrope">{formatDate(contract.created_at || '')}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">الحالة</span>
                <Badge variant={contractStatus.variant} className={(contractStatus as any).className}>
                  {contractStatus.status}
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* مصاريف وخسائر العقد */}
      {contractNumber && (
        <div className="max-w-md mx-auto px-4 pb-4">
          <ContractExpensesManager contractNumber={Number(contractNumber)} />
        </div>
      )}
      
      {/* PDF Dialog */}
      <ContractPDFDialog
        open={pdfOpen}
        onOpenChange={setPdfOpen}
        contract={contract}
      />
    </div>
  );
}
