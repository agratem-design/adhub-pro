import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Trash2, RefreshCw, AlertTriangle, CheckCircle, Clock, Search, Calendar, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { BillboardCleanupService, ExpiredBillboard } from "@/services/billboardCleanupService";

const BillboardCleanup = () => {
  const [expiredBillboards, setExpiredBillboards] = useState<ExpiredBillboard[]>([]);
  const [futureDateBillboards, setFutureDateBillboards] = useState<ExpiredBillboard[]>([]);
  const [loading, setLoading] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [cleanupLogs, setCleanupLogs] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);

  const fetchExpiredBillboards = async () => {
    setLoading(true);
    try {
      const billboards = await BillboardCleanupService.getExpiredBillboards();
      const futureBillboards = await BillboardCleanupService.getFutureDateBillboards();
      
      setExpiredBillboards(billboards.filter(b => b.issue_type === 'expired'));
      setFutureDateBillboards(billboards.filter(b => b.issue_type === 'future_dates').concat(futureBillboards));
    } catch (error) {
      console.error('Error fetching expired billboards:', error);
      toast.error('خطأ في جلب بيانات اللوحات المنتهية');
    } finally {
      setLoading(false);
    }
  };

  const fetchCleanupLogs = async () => {
    try {
      const logs = await BillboardCleanupService.getCleanupLogs(5);
      setCleanupLogs(logs);
    } catch (error) {
      console.error('Error fetching cleanup logs:', error);
    }
  };

  const searchBillboard = async () => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    try {
      const results = await BillboardCleanupService.searchBillboard(searchTerm);
      setSearchResults(results);
    } catch (error) {
      console.error('Error searching billboard:', error);
      toast.error('خطأ في البحث عن اللوحة');
    }
  };

  const cleanupAllExpiredBillboards = async () => {
    setCleaning(true);
    try {
      const cleanedCount = await BillboardCleanupService.cleanupAllExpiredBillboards();
      toast.success(`تم تنظيف ${cleanedCount} لوحة بنجاح`);
      await fetchExpiredBillboards();
      await fetchCleanupLogs();
    } catch (error) {
      console.error('Error cleaning up billboards:', error);
      toast.error('خطأ في عملية التنظيف');
    } finally {
      setCleaning(false);
    }
  };

  const cleanupSingleBillboard = async (billboardId: number) => {
    try {
      await BillboardCleanupService.cleanupSingleBillboard(billboardId);
      toast.success('تم تحرير اللوحة بنجاح');
      await fetchExpiredBillboards();
      await fetchCleanupLogs();
      setSearchResults([]);
    } catch (error) {
      console.error('Error cleaning single billboard:', error);
      toast.error('خطأ في تحرير اللوحة');
    }
  };

  useEffect(() => {
    fetchExpiredBillboards();
    fetchCleanupLogs();
  }, []);

  const getIssueTypeLabel = (issueType: string) => {
    switch (issueType) {
      case 'expired': return 'منتهي';
      case 'future_dates': return 'تواريخ مستقبلية';
      case 'invalid_dates': return 'تواريخ غير صالحة';
      default: return 'غير محدد';
    }
  };

  const getIssueTypeColor = (issueType: string) => {
    switch (issueType) {
      case 'expired': return 'destructive';
      case 'future_dates': return 'default';
      case 'invalid_dates': return 'secondary';
      default: return 'outline';
    }
  };

  const totalProblematicBillboards = expiredBillboards.length + futureDateBillboards.length;

  return (
    <div className="container mx-auto p-6 space-y-6" dir="rtl">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">تنظيف اللوحات المنتهية</h1>
          <p className="text-muted-foreground">إدارة اللوحات العالقة في عقود منتهية والمشكوك فيها</p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={fetchExpiredBillboards} 
            disabled={loading}
            variant="outline"
          >
            <RefreshCw className={`h-4 w-4 ml-2 ${loading ? 'animate-spin' : ''}`} />
            تحديث
          </Button>
          <Button 
            onClick={cleanupAllExpiredBillboards} 
            disabled={cleaning || totalProblematicBillboards === 0}
            className="bg-red-600 hover:bg-red-700"
          >
            <Trash2 className="h-4 w-4 ml-2" />
            {cleaning ? 'جاري التنظيف...' : 'تنظيف جميع اللوحات'}
          </Button>
        </div>
      </div>

      {/* البحث عن لوحة محددة */}
      <Card>
        <CardHeader>
          <CardTitle>البحث عن لوحة محددة</CardTitle>
          <CardDescription>
            ابحث بالاسم أو رقم العقد (مثل: ZL-ZL0708 أو 1105)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2">
            <Input
              placeholder="اسم اللوحة أو رقم العقد..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchBillboard()}
            />
            <Button onClick={searchBillboard}>
              <Search className="h-4 w-4 ml-2" />
              بحث
            </Button>
          </div>
          
          {searchResults.length > 0 && (
            <div className="mt-4 space-y-2">
              <h4 className="font-medium">نتائج البحث:</h4>
              {searchResults.map((billboard) => (
                <div key={billboard.ID} className="p-3 border rounded-lg">
                  <div className="flex justify-between items-start">
                    <div>
                      <h5 className="font-medium">{billboard.Billboard_Name}</h5>
                      <p className="text-sm text-muted-foreground">
                        العميل: {billboard.Customer_Name} | العقد: {billboard.Contract_Number}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        من: {billboard.Rent_Start_Date ? new Date(billboard.Rent_Start_Date).toLocaleDateString('ar-EG') : 'غير محدد'} 
                        {' '} إلى: {billboard.Rent_End_Date ? new Date(billboard.Rent_End_Date).toLocaleDateString('ar-EG') : 'غير محدد'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={billboard.Status === 'rented' ? 'destructive' : 'default'}>
                        {billboard.Status}
                      </Badge>
                      {billboard.Status === 'rented' && (
                        <Button 
                          onClick={() => cleanupSingleBillboard(billboard.ID)}
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                        >
                          <Trash2 className="h-3 w-3 ml-1" />
                          تحرير
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {totalProblematicBillboards === 0 ? (
        <Alert>
          <CheckCircle className="h-4 w-4" />
          <AlertDescription>
            ممتاز! لا توجد لوحات عالقة في عقود منتهية أو مشكوك فيها
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            تم العثور على {totalProblematicBillboards} لوحة تحتاج إلى تنظيف
            ({expiredBillboards.length} منتهية، {futureDateBillboards.length} ذات تواريخ مشكوك فيها)
          </AlertDescription>
        </Alert>
      )}

      {/* اللوحات المنتهية فعلياً */}
      {expiredBillboards.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-red-600">اللوحات المنتهية فعلياً</h2>
          {expiredBillboards.map((billboard) => (
            <Card key={billboard.ID} className="border-red-200">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{billboard.Billboard_Name}</CardTitle>
                    <CardDescription>
                      العميل: {billboard.Customer_Name} | العقد: {billboard.Contract_Number}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="destructive">
                      متأخر {billboard.days_past_rent_end} يوم
                    </Badge>
                    <Badge variant={getIssueTypeColor(billboard.issue_type)}>
                      {getIssueTypeLabel(billboard.issue_type)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex justify-between items-center">
                  <div className="text-sm text-muted-foreground">
                    تاريخ انتهاء الإيجار: {new Date(billboard.Rent_End_Date).toLocaleDateString('ar-EG')}
                  </div>
                  <Button 
                    onClick={() => cleanupSingleBillboard(billboard.ID)}
                    size="sm"
                    variant="outline"
                    className="text-red-600 border-red-200 hover:bg-red-50"
                  >
                    <Trash2 className="h-3 w-3 ml-1" />
                    تحرير اللوحة
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* اللوحات ذات التواريخ المستقبلية المشكوك فيها */}
      {futureDateBillboards.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xl font-semibold text-orange-600">اللوحات ذات التواريخ المستقبلية المشكوك فيها</h2>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              هذه اللوحات تحتوي على تواريخ في المستقبل لكنها تظهر كمنتهية. قد تكون هناك مشكلة في إدخال البيانات.
            </AlertDescription>
          </Alert>
          {futureDateBillboards.map((billboard) => (
            <Card key={billboard.ID} className="border-orange-200">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{billboard.Billboard_Name}</CardTitle>
                    <CardDescription>
                      العميل: {billboard.Customer_Name} | العقد: {billboard.Contract_Number}
                    </CardDescription>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="default">
                      تواريخ مستقبلية
                    </Badge>
                    <Badge variant="outline">
                      {billboard.Status}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4 inline ml-1" />
                    يبدأ: {new Date(billboard.Rent_Start_Date).toLocaleDateString('ar-EG')}
                    {' '} | ينتهي: {new Date(billboard.Rent_End_Date).toLocaleDateString('ar-EG')}
                  </div>
                  <div className="flex justify-end">
                    <Button 
                      onClick={() => cleanupSingleBillboard(billboard.ID)}
                      size="sm"
                      variant="outline"
                      className="text-orange-600 border-orange-200 hover:bg-orange-50"
                    >
                      <Trash2 className="h-3 w-3 ml-1" />
                      تحرير اللوحة
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>معلومات التنظيف التلقائي</CardTitle>
            <CardDescription>
              نظام التنظيف التلقائي للوحات المنتهية
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <p>• يتم فحص اللوحات المنتهية يومياً</p>
              <p>• يتم تحرير جميع اللوحات المنتهية تلقائياً</p>
              <p>• يتم اكتشاف اللوحات ذات التواريخ المشكوك فيها</p>
              <p>• يتم تحديث حالة اللوحات إلى "متاح"</p>
              <p>• يتم مسح معلومات العقد والعميل</p>
              <p>• يتم حفظ سجل بجميع العمليات</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>سجل عمليات التنظيف الأخيرة</CardTitle>
            <CardDescription>
              آخر 5 عمليات تنظيف
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {cleanupLogs.length === 0 ? (
                <p className="text-sm text-muted-foreground">لا توجد عمليات تنظيف مسجلة</p>
              ) : (
                cleanupLogs.map((log, index) => (
                  <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded">
                    <div className="flex items-center gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">
                        {new Date(log.cleanup_date).toLocaleDateString('ar-EG')}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">
                        {log.billboards_cleaned} لوحة
                      </Badge>
                      <Badge variant={log.cleanup_type === 'automatic' ? 'default' : 'outline'}>
                        {log.cleanup_type === 'automatic' ? 'تلقائي' : 'يدوي'}
                      </Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default BillboardCleanup;