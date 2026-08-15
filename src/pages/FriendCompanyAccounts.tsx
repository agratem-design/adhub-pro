import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DollarSign, TrendingUp, Building2, Calendar, FileText, Printer, Eye, MapPin, Clock } from 'lucide-react';

interface FriendCompany {
  company_id: string;
  company_name: string;
  total_billboards: number;
  total_contracts: number;
  total_paid_to_friend: number;
  total_revenue_from_customers: number;
  total_profit: number;
}

interface RentalWithDetails {
  id: string;
  billboard_id: number;
  billboard_name: string;
  billboard_size: string;
  municipality: string;
  district?: string;
  nearest_landmark?: string;
  ad_type?: string;
  contract_number: number;
  friend_company_id: string;
  friend_company_name: string;
  friend_rental_cost: number;
  customer_rental_price: number;
  profit: number;
  start_date: string;
  end_date: string;
  duration_days: number;
}

interface ContractGroup {
  contract_number: number;
  friend_company_name: string;
  friend_company_id: string;
  rentals: RentalWithDetails[];
  total_cost: number;
  total_profit: number;
  start_date: string;
  end_date: string;
}

export default function FriendCompanyAccounts() {
  const [selectedCompany, setSelectedCompany] = useState<FriendCompany | null>(null);
  const [selectedContract, setSelectedContract] = useState<ContractGroup | null>(null);

  // Fetch friend company financials
  const { data: financials, isLoading } = useQuery({
    queryKey: ['friend-company-financials'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('friend_company_financials')
        .select('*')
        .order('company_name');
      
      if (error) throw error;
      return data as FriendCompany[];
    }
  });

  // Fetch detailed rentals with billboard info
  const { data: rentals } = useQuery({
    queryKey: ['friend-rentals-detailed'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('friend_billboard_rentals')
        .select(`
          *,
          billboards:billboard_id (
            "Billboard_Name",
            "Size",
            "Municipality",
            "District",
            "Nearest_Landmark",
            "Ad_Type"
          ),
          friend_companies:friend_company_id (
            name
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map((rental: any) => {
        const startDate = new Date(rental.start_date);
        const endDate = new Date(rental.end_date);
        const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          id: rental.id,
          billboard_id: rental.billboard_id,
          billboard_name: rental.billboards?.Billboard_Name || `لوحة ${rental.billboard_id}`,
          billboard_size: rental.billboards?.Size || '-',
          municipality: rental.billboards?.Municipality || '-',
          district: rental.billboards?.District || '-',
          nearest_landmark: rental.billboards?.Nearest_Landmark || '-',
          ad_type: rental.billboards?.Ad_Type || '-',
          contract_number: rental.contract_number,
          friend_company_id: rental.friend_company_id,
          friend_company_name: rental.friend_companies?.name || '-',
          friend_rental_cost: Number(rental.friend_rental_cost) || 0,
          customer_rental_price: Number(rental.customer_rental_price) || 0,
          profit: Number(rental.profit) || 0,
          start_date: rental.start_date,
          end_date: rental.end_date,
          duration_days: durationDays
        } as RentalWithDetails;
      });
    }
  });

  // Group rentals by contract
  const contractGroups = useMemo(() => {
    if (!rentals) return [];
    
    const groups: { [key: string]: ContractGroup } = {};
    
    rentals.forEach(rental => {
      const key = `${rental.contract_number}-${rental.friend_company_id}`;
      if (!groups[key]) {
        groups[key] = {
          contract_number: rental.contract_number,
          friend_company_name: rental.friend_company_name,
          friend_company_id: rental.friend_company_id,
          rentals: [],
          total_cost: 0,
          total_profit: 0,
          start_date: rental.start_date,
          end_date: rental.end_date
        };
      }
      groups[key].rentals.push(rental);
      groups[key].total_cost += rental.friend_rental_cost;
      groups[key].total_profit += rental.profit;
    });
    
    return Object.values(groups).sort((a, b) => b.contract_number - a.contract_number);
  }, [rentals]);

  const companyContractGroups = useMemo(() => {
    if (!selectedCompany) return [];
    return contractGroups.filter(g => g.friend_company_id === selectedCompany.company_id);
  }, [contractGroups, selectedCompany]);

  const totalRevenue = financials?.reduce((sum, f) => sum + (Number(f.total_revenue_from_customers) || 0), 0) || 0;
  const totalPaid = financials?.reduce((sum, f) => sum + (Number(f.total_paid_to_friend) || 0), 0) || 0;
  const totalProfit = financials?.reduce((sum, f) => sum + (Number(f.total_profit) || 0), 0) || 0;

  const handlePrintInvoice = (contract: ContractGroup) => {
    const durationDays = contract.rentals[0]?.duration_days || 0;
    const durationMonths = Math.ceil(durationDays / 30);
    const formattedDate = new Date().toLocaleDateString('ar-LY');
    
    const invoiceHTML = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>فاتورة مشتريات - ${contract.friend_company_name}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4 portrait; margin: 0 !important; padding: 0 !important; }
          html, body {
            width: 210mm;
            height: 297mm;
            margin: 0;
            padding: 0;
            font-family: 'Segoe UI', Tahoma, sans-serif;
            direction: rtl;
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color-adjust: exact;
          }
          .invoice-container {
            width: 210mm;
            min-height: 297mm;
            padding: 10mm;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            background: white;
          }
          .header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            padding-bottom: 15px;
            border-bottom: 2px solid #000;
            margin-bottom: 20px;
          }
          .company-info {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
            text-align: right;
          }
          .company-logo {
            max-width: 180px;
            height: auto;
            margin-bottom: 8px;
          }
          .company-details {
            font-size: 11px;
            color: #666;
            line-height: 1.6;
          }
          .invoice-info {
            text-align: left;
          }
          .invoice-title {
            font-size: 24px;
            font-weight: bold;
            color: #dc2626;
            margin-bottom: 10px;
          }
          .invoice-details {
            font-size: 12px;
            line-height: 1.8;
            color: #333;
          }
          .customer-info {
            background: #f8f9fa;
            padding: 15px 20px;
            border-radius: 0;
            margin-bottom: 20px;
            border-right: 4px solid #dc2626;
          }
          .customer-title {
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 8px;
            color: #000;
          }
          .customer-details {
            font-size: 12px;
            line-height: 1.8;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .items-table th {
            background: #000;
            color: white;
            padding: 10px 8px;
            text-align: center;
            font-weight: bold;
            border: 1px solid #000;
            font-size: 11px;
          }
          .items-table td {
            padding: 10px 8px;
            text-align: center;
            border: 1px solid #ddd;
            font-size: 11px;
            vertical-align: middle;
          }
          .items-table tbody tr:nth-child(even) {
            background: #f8f9fa;
          }
          .duration-section {
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border-radius: 8px;
            padding: 15px;
            margin-bottom: 20px;
            border: 2px solid #f59e0b;
            text-align: center;
          }
          .duration-section h3 {
            color: #92400e;
            font-size: 14px;
            margin-bottom: 8px;
          }
          .duration-section .duration {
            font-size: 20px;
            font-weight: bold;
            color: #b45309;
          }
          .duration-section .dates {
            font-size: 12px;
            color: #78350f;
            margin-top: 8px;
          }
          .total-section {
            border-top: 2px solid #000;
            padding-top: 15px;
            margin-top: auto;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 8px 0;
            font-size: 14px;
          }
          .total-row.grand-total {
            font-size: 18px;
            font-weight: bold;
            background: #dc2626;
            color: white;
            padding: 15px 20px;
            margin-top: 10px;
          }
          .signatures {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 2px dashed #cbd5e1;
          }
          .signature-box {
            text-align: center;
          }
          .signature-box .label {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 40px;
          }
          .signature-box .line {
            border-bottom: 2px solid #000;
            width: 120px;
            margin: 0 auto;
          }
          .footer {
            margin-top: 20px;
            text-align: center;
            font-size: 10px;
            color: #666;
            border-top: 1px solid #ddd;
            padding-top: 10px;
          }
          @media print {
            .invoice-container {
              width: 210mm !important;
              min-height: 297mm !important;
              padding: 10mm !important;
            }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header">
            <div class="company-info">
              <img src="/logofaresgold.svg" alt="شعار الشركة" class="company-logo" onerror="this.style.display='none'">
            </div>
            
            <div class="invoice-info">
              <div class="invoice-title">فاتورة مشتريات</div>
              <div class="invoice-details">
                رقم الفاتورة: FBR-${contract.contract_number}<br>
                التاريخ: ${formattedDate}<br>
                العملة: دينار ليبي
              </div>
            </div>
          </div>
          
          <div class="customer-info">
            <div class="customer-title">بيانات المورد (الشركة الصديقة)</div>
            <div class="customer-details">
              <strong>الشركة:</strong> ${contract.friend_company_name}<br>
              <strong>رقم العقد:</strong> ${contract.contract_number}
            </div>
          </div>
          
          <table class="items-table">
            <thead>
              <tr>
                <th style="width: 8%">#</th>
                <th style="width: 32%">اللوحة</th>
                <th style="width: 12%">المقاس</th>
                <th style="width: 33%">الموقع</th>
                <th style="width: 15%">تكلفة الإيجار (د.ل)</th>
              </tr>
            </thead>
            <tbody>
              <!-- صف العقد الرئيسي -->
              <tr style="background: rgba(220, 38, 38, 0.05); font-weight: bold;">
                <td>1</td>
                <td style="font-weight: bold;">عقد رقم ${contract.contract_number}</td>
                <td>—</td>
                <td style="font-weight: 500;">عقد بقيمة إجمالية</td>
                <td style="font-weight: bold; color: #dc2626;">${contract.total_cost.toLocaleString('ar-LY')}</td>
              </tr>
              <!-- لوحات العقد الفرعية -->
              ${contract.rentals.map((rental, index) => {
                const location = [
                  `البلدية: ${rental.municipality || '—'}`,
                  `المنطقة: ${rental.district || '—'}`,
                  `أقرب نقطة: ${rental.nearest_landmark || '—'}`,
                  `نوع الإعلان: ${rental.ad_type || '—'}`
                ].join(' • ');

                return `
                  <tr style="font-size: 10px; opacity: 0.95;">
                    <td>↳</td>
                    <td style="font-weight: 500;">لوحة: ${rental.billboard_name}</td>
                    <td><span style="background: #e5e7eb; padding: 2px 6px; border-radius: 4px;">${rental.billboard_size}</span></td>
                    <td style="text-align: right; font-size: 10px;">${location}</td>
                    <td style="color: #777; font-weight: normal; font-size: 10px;">مضمن في العقد</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
          
          <div class="duration-section">
            <h3>مدة الإيجار</h3>
            <div class="duration">${durationDays} يوم (${durationMonths} شهر)</div>
            <div class="dates">
              من ${new Date(contract.start_date).toLocaleDateString('ar-LY')} 
              إلى ${new Date(contract.end_date).toLocaleDateString('ar-LY')}
            </div>
          </div>
          
          <div class="total-section">
            <div class="total-row">
              <span>عدد اللوحات:</span>
              <span>${contract.rentals.length} لوحة</span>
            </div>
            <div class="total-row grand-total">
              <span>إجمالي المستحق للشركة الصديقة:</span>
              <span>${contract.total_cost.toLocaleString('ar-LY')} د.ل</span>
            </div>
          </div>
          
          <div class="signatures">
            <div class="signature-box">
              <div class="label">توقيع المستلم</div>
              <div class="line"></div>
            </div>
            <div class="signature-box">
              <div class="label">ختم الشركة</div>
              <div class="line"></div>
            </div>
          </div>
          
          <div class="footer">
            <p>هذه الفاتورة تمثل تكلفة استئجار لوحات من شركة صديقة</p>
            <p>تم إصدارها بتاريخ: ${formattedDate}</p>
          </div>
        </div>
        
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(invoiceHTML);
      printWindow.document.close();
    }
  };

  return (
    <>
      <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">حسابات لوحات الأصدقاء</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            فواتير المشتريات والتقارير المالية للشركات الصديقة
          </p>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                إجمالي الإيرادات من الزبائن
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {totalRevenue.toLocaleString('ar-LY')} د.ل
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                إجمالي المدفوع للأصدقاء
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {totalPaid.toLocaleString('ar-LY')} د.ل
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                صافي الربح
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {totalProfit.toLocaleString('ar-LY')} د.ل
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Company Financial Summary */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              ملخص الشركات الصديقة
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
            ) : financials && financials.length > 0 ? (
              <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>الشركة</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">عدد اللوحات</TableHead>
                    <TableHead className="text-center hidden sm:table-cell">عدد العقود</TableHead>
                    <TableHead className="text-right">المدفوع للصديق</TableHead>
                    <TableHead className="text-right hidden md:table-cell">الإيرادات من الزبون</TableHead>
                    <TableHead className="text-right">صافي الربح</TableHead>
                    <TableHead className="text-center">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {financials.map((company) => (
                    <TableRow key={company.company_id}>
                      <TableCell className="font-medium">{company.company_name}</TableCell>
                      <TableCell className="text-center hidden sm:table-cell">
                        <Badge variant="secondary">{company.total_billboards}</Badge>
                      </TableCell>
                      <TableCell className="text-center hidden sm:table-cell">
                        <Badge variant="secondary">{company.total_contracts}</Badge>
                      </TableCell>
                      <TableCell className="text-right font-medium text-red-600">
                        {Number(company.total_paid_to_friend || 0).toLocaleString('ar-LY')} د.ل
                      </TableCell>
                      <TableCell className="text-right font-medium text-green-600 hidden md:table-cell">
                        {Number(company.total_revenue_from_customers || 0).toLocaleString('ar-LY')} د.ل
                      </TableCell>
                      <TableCell className="text-right font-bold text-blue-600">
                        {Number(company.total_profit || 0).toLocaleString('ar-LY')} د.ل
                      </TableCell>
                      <TableCell className="text-center">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedCompany(company)}
                        >
                          <Eye className="h-4 w-4 ml-1" />
                          عرض الفواتير
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                لا توجد بيانات مالية
              </div>
            )}
          </CardContent>
        </Card>

        {/* Contract Cards - Grouped by Contract */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              فواتير المشتريات (مجمعة حسب العقد)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground mb-4">
              عدد العقود: {contractGroups.length}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {contractGroups.map((contract) => (
                <Card key={`${contract.contract_number}-${contract.friend_company_id}`} className="overflow-hidden hover:shadow-lg transition-shadow">
                  {/* Contract Header */}
                  <div className="bg-gradient-to-l from-red-600 to-red-700 text-white p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-xs opacity-80">رقم العقد</p>
                        <p className="text-2xl font-bold">#{contract.contract_number}</p>
                      </div>
                      <Badge className="bg-white/20 text-white border-0">
                        {contract.rentals.length} لوحة
                      </Badge>
                    </div>
                    <p className="text-sm mt-2 opacity-90">{contract.friend_company_name}</p>
                  </div>
                  
                  {/* Billboards Preview */}
                  <div className="p-4 space-y-2 max-h-40 overflow-y-auto">
                    {contract.rentals.slice(0, 3).map((rental) => (
                      <div key={rental.id} className="flex items-center gap-2 text-sm bg-muted/50 rounded p-2">
                        <MapPin className="h-3 w-3 text-muted-foreground flex-shrink-0" />
                        <span className="truncate flex-1">{rental.billboard_name}</span>
                        <Badge variant="outline" className="text-xs">{rental.billboard_size}</Badge>
                      </div>
                    ))}
                    {contract.rentals.length > 3 && (
                      <p className="text-xs text-muted-foreground text-center">
                        +{contract.rentals.length - 3} لوحات أخرى
                      </p>
                    )}
                  </div>
                  
                  {/* Duration */}
                  <div className="px-4 py-2 bg-amber-50 dark:bg-amber-950/20 border-y">
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-amber-600" />
                      <span className="text-amber-700 dark:text-amber-500 font-medium">
                        {contract.rentals[0]?.duration_days || 0} يوم
                      </span>
                      <span className="text-muted-foreground text-xs">
                        ({new Date(contract.start_date).toLocaleDateString('ar-LY')} - {new Date(contract.end_date).toLocaleDateString('ar-LY')})
                      </span>
                    </div>
                  </div>
                  
                  {/* Footer */}
                  <div className="p-4 flex justify-between items-center">
                    <div>
                      <p className="text-xs text-muted-foreground">التكلفة</p>
                      <p className="text-lg font-bold text-red-600">
                        {contract.total_cost.toLocaleString('ar-LY')} د.ل
                      </p>
                    </div>
                    <Button
                      size="sm"
                      onClick={() => handlePrintInvoice(contract)}
                    >
                      <Printer className="h-4 w-4 ml-1" />
                      طباعة
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Company Details Dialog */}
        <Dialog open={!!selectedCompany} onOpenChange={() => setSelectedCompany(null)}>
          <DialogContent className="max-w-4xl max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                فواتير مشتريات - {selectedCompany?.company_name}
              </DialogTitle>
            </DialogHeader>
            
            {/* Company Summary */}
            {selectedCompany && (
              <div className="grid grid-cols-3 gap-4 mb-6">
                <Card className="bg-red-50 dark:bg-red-950/20">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">المدفوع للصديق</p>
                    <p className="text-xl font-bold text-red-600">
                      {Number(selectedCompany.total_paid_to_friend || 0).toLocaleString('ar-LY')} د.ل
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-green-50 dark:bg-green-950/20">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">الإيراد من الزبائن</p>
                    <p className="text-xl font-bold text-green-600">
                      {Number(selectedCompany.total_revenue_from_customers || 0).toLocaleString('ar-LY')} د.ل
                    </p>
                  </CardContent>
                </Card>
                <Card className="bg-blue-50 dark:bg-blue-950/20">
                  <CardContent className="p-4 text-center">
                    <p className="text-sm text-muted-foreground">صافي الربح</p>
                    <p className="text-xl font-bold text-blue-600">
                      {Number(selectedCompany.total_profit || 0).toLocaleString('ar-LY')} د.ل
                    </p>
                  </CardContent>
                </Card>
              </div>
            )}
            
            {/* Company Contracts as Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {companyContractGroups.map((contract) => (
                <Card key={`${contract.contract_number}-${contract.friend_company_id}`} className="overflow-hidden">
                  <div className="bg-gradient-to-l from-red-600 to-red-700 text-white p-3">
                    <div className="flex justify-between items-center">
                      <span className="font-bold">عقد #{contract.contract_number}</span>
                      <Badge className="bg-white/20 text-white border-0 text-xs">
                        {contract.rentals.length} لوحة
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="p-3 space-y-2">
                    {contract.rentals.map((rental) => (
                      <div key={rental.id} className="flex items-center justify-between text-sm bg-muted/30 rounded p-2">
                        <div className="flex items-center gap-2">
                          <MapPin className="h-3 w-3 text-muted-foreground" />
                          <span>{rental.billboard_name}</span>
                          <Badge variant="outline" className="text-xs">{rental.billboard_size}</Badge>
                        </div>
                        <span className="font-medium text-red-600">{rental.friend_rental_cost.toLocaleString('ar-LY')} د.ل</span>
                      </div>
                    ))}
                  </div>
                  
                  <div className="p-3 border-t flex justify-between items-center bg-muted/20">
                    <div>
                      <p className="text-xs text-muted-foreground">الإجمالي</p>
                      <p className="font-bold text-red-600">{contract.total_cost.toLocaleString('ar-LY')} د.ل</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => handlePrintInvoice(contract)}>
                      <Printer className="h-4 w-4 ml-1" />
                      طباعة
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}