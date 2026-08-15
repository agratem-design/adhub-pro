// @ts-nocheck
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/components/ui/sonner';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Users, 
  Calendar,
  FileText,
  Search,
  Download,
  RefreshCw
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface RevenueStats {
  totalRevenue: number;
  totalDebt: number;
  monthlyRevenue: number;
  pendingPayments: number;
  activeCustomers: number;
}

interface PaymentRecord {
  id: string;
  customer_name: string;
  amount: number;
  method: string;
  created_at: string;
  entry_type: string;
  contract_number?: string;
  reference?: string;
}

interface CustomerBalance {
  customer_name: string;
  customer_id?: string;
  totalDebt: number;
  totalPaid: number;
  balance: number;
  lastPayment?: string;
}

export default function RevenueManagement() {
  const [stats, setStats] = useState<RevenueStats>({
    totalRevenue: 0,
    totalDebt: 0,
    monthlyRevenue: 0,
    pendingPayments: 0,
    activeCustomers: 0
  });
  
  const [recentPayments, setRecentPayments] = useState<PaymentRecord[]>([]);
  const [customerBalances, setCustomerBalances] = useState<CustomerBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const loadRevenueData = async () => {
    try {
      setLoading(true);

      // Load all payments
      const { data: payments } = await supabase
        .from('customer_payments')
        .select('*')
        .order('created_at', { ascending: false });

      // Load contracts for debt calculation
      const { data: contracts } = await supabase
        .from('Contract')
        .select('*');

      if (payments && contracts) {
        // Calculate stats
        const totalRevenue = payments
          .filter(p => p.entry_type === 'receipt' || p.entry_type === 'account_payment')
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

        const totalDebt = contracts
          .reduce((sum, c) => sum + (Number(c['Total Rent']) || 0), 0);

        const currentMonth = new Date().getMonth();
        const currentYear = new Date().getFullYear();
        const monthlyRevenue = payments
          .filter(p => {
            const paymentDate = new Date(p.created_at);
            return paymentDate.getMonth() === currentMonth && 
                   paymentDate.getFullYear() === currentYear &&
                   (p.entry_type === 'receipt' || p.entry_type === 'account_payment');
          })
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

        const pendingPayments = payments
          .filter(p => p.entry_type === 'invoice')
          .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

        const activeCustomers = new Set(contracts.map(c => c['Customer Name'])).size;

        setStats({
          totalRevenue,
          totalDebt,
          monthlyRevenue,
          pendingPayments,
          activeCustomers
        });

        // Set recent payments
        setRecentPayments(payments.slice(0, 20));

        // Calculate customer balances
        const customerMap = new Map<string, CustomerBalance>();
        
        contracts.forEach(contract => {
          const customerName = contract['Customer Name'];
          const debt = Number(contract['Total Rent']) || 0;
          
          if (!customerMap.has(customerName)) {
            customerMap.set(customerName, {
              customer_name: customerName,
              customer_id: contract.customer_id,
              totalDebt: 0,
              totalPaid: 0,
              balance: 0
            });
          }
          
          const customer = customerMap.get(customerName)!;
          customer.totalDebt += debt;
        });

        payments.forEach(payment => {
          if (payment.customer_name && customerMap.has(payment.customer_name)) {
            const customer = customerMap.get(payment.customer_name)!;
            
            if (payment.entry_type === 'receipt' || payment.entry_type === 'account_payment') {
              customer.totalPaid += Number(payment.amount) || 0;
              customer.lastPayment = payment.created_at;
            }
          }
        });

        // Calculate balances
        customerMap.forEach(customer => {
          customer.balance = customer.totalDebt - customer.totalPaid;
        });

        setCustomerBalances(Array.from(customerMap.values()));
      }
    } catch (error) {
      console.error('Error loading revenue data:', error);
      toast.error('فشل في تحميل بيانات الإيرادات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRevenueData();
  }, []);

  const filteredCustomers = customerBalances.filter(customer =>
    customer.customer_name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredPayments = recentPayments.filter(payment =>
    payment.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    payment.method?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const exportData = () => {
    const csvData = customerBalances.map(customer => ({
      'اسم العميل': customer.customer_name,
      'إجمالي الديون': customer.totalDebt,
      'المدفوع': customer.totalPaid,
      'الرصيد المتبقي': customer.balance,
      'آخر دفعة': customer.lastPayment ? format(new Date(customer.lastPayment), 'dd/MM/yyyy', { locale: ar }) : 'لا يوجد'
    }));
    
    const csv = [
      Object.keys(csvData[0]).join(','),
      ...csvData.map(row => Object.values(row).join(','))
    ].join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `revenue-report-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto px-3 md:px-4 py-4 md:py-6 space-y-4 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl md:text-3xl font-bold text-primary">إدارة الإيرادات والمقبوضات</h1>
            <p className="text-muted-foreground text-sm mt-1">تتبع الإيرادات والديون والمدفوعات</p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button variant="outline" onClick={exportData} size="sm" className="flex-1 sm:flex-none">
              <Download className="h-4 w-4 ml-2" />
              تصدير
            </Button>
            <Button variant="outline" onClick={loadRevenueData} disabled={loading} size="sm" className="flex-1 sm:flex-none">
              <RefreshCw className={`h-4 w-4 ml-2 ${loading ? 'animate-spin' : ''}`} />
              تحديث
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إجمالي الإيرادات</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.totalRevenue.toLocaleString('ar-LY')} د.ل
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إجمالي الديون</CardTitle>
              <DollarSign className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats.totalDebt.toLocaleString('ar-LY')} د.ل
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">إيرادات الشهر</CardTitle>
              <Calendar className="h-4 w-4 text-purple-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {stats.monthlyRevenue.toLocaleString('ar-LY')} د.ل
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">فواتير معلقة</CardTitle>
              <FileText className="h-4 w-4 text-orange-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-orange-600">
                {stats.pendingPayments.toLocaleString('ar-LY')} د.ل
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">العملاء النشطين</CardTitle>
              <Users className="h-4 w-4 text-indigo-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-indigo-600">
                {stats.activeCustomers}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
            <Input
              placeholder="البحث في العملاء أو المدفوعات..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="balances" className="space-y-4">
          <TabsList>
            <TabsTrigger value="balances">أرصدة العملاء</TabsTrigger>
            <TabsTrigger value="payments">المدفوعات الأخيرة</TabsTrigger>
          </TabsList>

          <TabsContent value="balances">
            <Card>
              <CardHeader>
                <CardTitle>أرصدة العملاء والديون المستحقة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>اسم العميل</TableHead>
                        <TableHead>إجمالي الديون</TableHead>
                        <TableHead>المدفوع</TableHead>
                        <TableHead>الرصيد المتبقي</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>آخر دفعة</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredCustomers.map((customer, index) => (
                        <TableRow key={index}>
                          <TableCell className="font-medium">
                            {customer.customer_name}
                          </TableCell>
                          <TableCell>
                            {customer.totalDebt.toLocaleString('ar-LY')} د.ل
                          </TableCell>
                          <TableCell className="text-green-600">
                            {customer.totalPaid.toLocaleString('ar-LY')} د.ل
                          </TableCell>
                          <TableCell className={customer.balance > 0 ? 'text-red-600' : 'text-green-600'}>
                            {customer.balance.toLocaleString('ar-LY')} د.ل
                          </TableCell>
                          <TableCell>
                            <Badge variant={customer.balance > 0 ? 'destructive' : 'default'}>
                              {customer.balance > 0 ? 'مديون' : 'مسدد'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {customer.lastPayment 
                              ? format(new Date(customer.lastPayment), 'dd/MM/yyyy', { locale: ar })
                              : 'لا يوجد'
                            }
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="payments">
            <Card>
              <CardHeader>
                <CardTitle>المدفوعات والمعاملات الأخيرة</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>العميل</TableHead>
                        <TableHead>المبلغ</TableHead>
                        <TableHead>الطريقة</TableHead>
                        <TableHead>النوع</TableHead>
                        <TableHead>رقم العقد</TableHead>
                        <TableHead>المرجع</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPayments.map((payment) => (
                        <TableRow key={payment.id}>
                          <TableCell>
                            {format(new Date(payment.created_at), 'dd/MM/yyyy HH:mm', { locale: ar })}
                          </TableCell>
                          <TableCell className="font-medium">
                            {payment.customer_name}
                          </TableCell>
                          <TableCell className={
                            payment.entry_type === 'receipt' || payment.entry_type === 'account_payment'
                              ? 'text-green-600' 
                              : 'text-blue-600'
                          }>
                            {Number(payment.amount).toLocaleString('ar-LY')} د.ل
                          </TableCell>
                          <TableCell>{payment.method}</TableCell>
                          <TableCell>
                            <Badge variant={
                              payment.entry_type === 'receipt' || payment.entry_type === 'account_payment'
                                ? 'default' 
                                : 'secondary'
                            }>
                              {payment.entry_type === 'receipt' ? 'إيصال' :
                               payment.entry_type === 'account_payment' ? 'دفعة' :
                               payment.entry_type === 'invoice' ? 'فاتورة' : payment.entry_type}
                            </Badge>
                          </TableCell>
                          <TableCell>{payment.contract_number || '—'}</TableCell>
                          <TableCell>{payment.reference || '—'}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}