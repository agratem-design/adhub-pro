import { printUnifiedDocument, escHtml, docMoney, docDate } from '@/lib/unifiedDocument';
import { toast } from 'sonner';
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
    // ✅ المستند الموحد — نفس قالب كل الفواتير، والألوان من إعدادات الطباعة (فاتورة المشتريات)
    const durationDays = contract.rentals[0]?.duration_days || 0;
    const durationMonths = Math.ceil(durationDays / 30);
    void printUnifiedDocument('purchase_invoice', {
      title: 'فاتورة مشتريات',
      subtitle: 'تكلفة استئجار لوحات من شركة صديقة',
      pageTitle: `فاتورة مشتريات FBR-${contract.contract_number} - ${contract.friend_company_name}`,
      info: [
        { label: 'المورد (الشركة الصديقة)', value: escHtml(contract.friend_company_name) },
        { label: 'رقم الفاتورة', value: `<bdi>FBR-${contract.contract_number}</bdi>` },
        { label: 'رقم العقد', value: `#${contract.contract_number}` },
        { label: 'مدة الإيجار', value: `${durationDays} يوم (${durationMonths} شهر)` },
        { label: 'الفترة', value: `${docDate(contract.start_date)} — ${docDate(contract.end_date)}` },
        { label: 'تاريخ الإصدار', value: docDate(new Date()) },
      ],
      total: { label: 'إجمالي المستحق للشركة الصديقة', value: docMoney(contract.total_cost) },
      sections: [{
        title: `لوحات العقد (${contract.rentals.length})`,
        aside: `عقد #${contract.contract_number}`,
        columns: [
          { key: 'i', header: '#', width: '5%' },
          { key: 'name', header: 'اللوحة', width: '24%', align: 'right' },
          { key: 'size', header: 'المقاس', width: '11%' },
          { key: 'loc', header: 'الموقع', align: 'right' },
          { key: 'ad', header: 'نوع الإعلان', width: '14%' },
        ],
        rows: contract.rentals.map((r, i) => ({
          i: i + 1,
          name: escHtml(r.billboard_name),
          size: `<bdi>${escHtml(r.billboard_size)}</bdi>`,
          loc: escHtml([r.municipality, r.district, r.nearest_landmark].filter(Boolean).join(' • ') || '—'),
          ad: escHtml(r.ad_type || '—'),
        })),
        footer: [{ label: 'قيمة العقد (شاملة كل اللوحات)', value: docMoney(contract.total_cost) }],
      }],
      signatures: [{ label: 'توقيع المستلم' }, { label: 'ختم الشركة' }],
    }, { driveFolder: 'billing-purchases' }).catch(() => toast.error('تعذرت الطباعة'));
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