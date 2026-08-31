import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Printer, Eye, Search, FileText, DollarSign, TrendingUp, Receipt as ReceiptIcon, Edit, ArrowRightLeft } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { PrintedInvoiceEditDialog } from '@/components/billing/PrintedInvoiceEditDialog';
import { EnhancedDistributePaymentDialog } from '@/components/billing/EnhancedDistributePaymentDialog';
import { CompositeTaskInvoicePrint } from '@/components/composite-tasks/CompositeTaskInvoicePrint';
import ModernPrintInvoiceDialog from '@/components/billing/ModernPrintInvoiceDialog';

interface PrintedInvoice {
  id: string;
  invoice_number: string;
  customer_name: string;
  customer_id: string;
  printer_name: string;
  total_amount: number;
  printer_cost?: number;
  paid_amount: number;
  invoice_date: string;
  invoice_type: string;
  paid: boolean;
  locked: boolean;
  created_at: string;
  contract_number?: number;
  notes?: string;
}

export default function PrintedInvoicesPage() {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<PrintedInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [distributeDialogOpen, setDistributeDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<PrintedInvoice | null>(null);
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<string>('');
  const [selectedInvoiceForPrint, setSelectedInvoiceForPrint] = useState<any | null>(null);
  const [printOpenToPreview, setPrintOpenToPreview] = useState(true);
  const [printAuto, setPrintAuto] = useState(false);
  const [stats, setStats] = useState({
    totalInvoices: 0,
    totalAmount: 0,
    totalPaid: 0,
    totalRemaining: 0,
    totalProfit: 0,
    totalPrinterCost: 0
  });

  useEffect(() => {
    loadInvoices();
  }, []);

  const loadInvoices = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('printed_invoices')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // ✅ FIX: استبعاد فواتير المهام المجمعة وفواتير طباعة مهام مرتبطة بمهمة مجمعة (لتفادي التكرار)
      let filtered = (data || []) as any[];
      try {
        // 1) لا نعرض فواتير invoice_type=composite_task داخل فواتير الطباعة
        filtered = filtered.filter((inv) => inv?.invoice_type !== 'composite_task');

        // 2) استبعاد أي printed_invoice مرتبط بـ print_task داخل composite_task
        const { data: composite } = await supabase
          .from('composite_tasks')
          .select('combined_invoice_id, print_task_id')
          .not('print_task_id', 'is', null);

        const printTaskIds = (composite || []).map((c: any) => c.print_task_id).filter(Boolean);
        if (printTaskIds.length > 0) {
          const { data: printTasks } = await supabase
            .from('print_tasks')
            .select('invoice_id')
            .in('id', printTaskIds);

          const excluded = new Set<string>((printTasks || []).map((r: any) => r.invoice_id).filter(Boolean));
          filtered = filtered.filter((inv) => !excluded.has(inv.id));
        }
      } catch (e) {
        console.warn('Could not filter composite-related printed invoices:', e);
      }

      setInvoices(filtered as any);
      calculateStats(filtered as any);
    } catch (error) {
      console.error('Error loading invoices:', error);
      toast.error('فشل في تحميل فواتير الطباعة');
    } finally {
      setLoading(false);
    }
  };

  const loadCompositeTaskForInvoice = async (invoiceId: string) => {
    const { data, error } = await supabase
      .from('composite_tasks')
      .select(`
        *,
        installation_task:installation_tasks!composite_tasks_installation_task_id_fkey(*),
        print_task:print_tasks!composite_tasks_print_task_id_fkey(*),
        cutout_task:cutout_tasks!composite_tasks_cutout_task_id_fkey(*),
        contract:Contract!composite_tasks_contract_id_fkey(*),
        customer:customers!composite_tasks_customer_id_fkey(*)
      `)
      .eq('combined_invoice_id', invoiceId)
      .single();

    if (error) {
      console.error('Error loading composite task:', error);
      return null;
    }

    return data;
  };

  const calculateStats = (data: PrintedInvoice[]) => {
    const totalAmount = data.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
    const totalPaid = data.reduce((sum, inv) => sum + (Number(inv.paid_amount) || 0), 0);
    const totalPrinterCost = data.reduce((sum, inv) => sum + (Number(inv.printer_cost) || 0), 0);
    const totalProfit = totalAmount - totalPrinterCost;

    setStats({
      totalInvoices: data.length,
      totalAmount,
      totalPaid,
      totalRemaining: totalAmount - totalPaid,
      totalProfit,
      totalPrinterCost
    });
  };

  const filteredInvoices = invoices.filter(invoice =>
    invoice.invoice_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    invoice.printer_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewCustomer = (customerId: string, customerName: string) => {
    navigate(`/admin/customer-billing?id=${customerId}&name=${encodeURIComponent(customerName)}`);
  };

  const handleEditInvoice = (invoice: any) => {
    setSelectedInvoiceId(invoice.id);
    setEditDialogOpen(true);
  };

  const handleDistributePayment = (invoice: PrintedInvoice) => {
    setSelectedInvoice(invoice);
    setDistributeDialogOpen(true);
  };

  return (
    <div className="space-y-6 p-6">
      {/* الهيدر */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">فواتير الطباعة</h1>
          <p className="text-muted-foreground">إدارة وعرض جميع فواتير الطباعة</p>
        </div>
        <div className="flex gap-3">
          <Button
            onClick={loadInvoices}
            variant="outline"
            className="gap-2"
          >
            <FileText className="h-4 w-4" />
            تحديث
          </Button>
        </div>
      </div>

      {/* الإحصائيات */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900 border-blue-200 dark:border-blue-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-700 dark:text-blue-300">إجمالي الفواتير</p>
                <h3 className="text-2xl font-bold text-blue-900 dark:text-blue-100">{stats.totalInvoices}</h3>
              </div>
              <div className="p-3 bg-blue-200 dark:bg-blue-800 rounded-full">
                <FileText className="h-6 w-6 text-blue-700 dark:text-blue-200" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900 border-green-200 dark:border-green-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-green-700 dark:text-green-300">إجمالي المبيعات</p>
                <h3 className="text-2xl font-bold text-green-900 dark:text-green-100">
                  {stats.totalAmount.toLocaleString('ar-LY')} د.ل
                </h3>
              </div>
              <div className="p-3 bg-green-200 dark:bg-green-800 rounded-full">
                <DollarSign className="h-6 w-6 text-green-700 dark:text-green-200" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900 border-orange-200 dark:border-orange-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-orange-700 dark:text-orange-300">تكلفة المطابع</p>
                <h3 className="text-2xl font-bold text-orange-900 dark:text-orange-100">
                  {stats.totalPrinterCost.toLocaleString('ar-LY')} د.ل
                </h3>
              </div>
              <div className="p-3 bg-orange-200 dark:bg-orange-800 rounded-full">
                <Printer className="h-6 w-6 text-orange-700 dark:text-orange-200" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900 border-purple-200 dark:border-purple-800">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-purple-700 dark:text-purple-300">صافي الربح</p>
                <h3 className="text-2xl font-bold text-purple-900 dark:text-purple-100">
                  {stats.totalProfit.toLocaleString('ar-LY')} د.ل
                </h3>
              </div>
              <div className="p-3 bg-purple-200 dark:bg-purple-800 rounded-full">
                <TrendingUp className="h-6 w-6 text-purple-700 dark:text-purple-200" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* البحث */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            بحث في الفواتير
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Input
            placeholder="ابحث برقم الفاتورة، اسم العميل، أو اسم المطبعة..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-md"
          />
        </CardContent>
      </Card>

      {/* جدول الفواتير */}
      <Card>
        <CardHeader>
          <CardTitle>
            جميع فواتير الطباعة ({filteredInvoices.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              <p className="mt-2 text-muted-foreground">جارٍ التحميل...</p>
            </div>
          ) : filteredInvoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>لا توجد فواتير</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">رقم الفاتورة</TableHead>
                    <TableHead className="text-right">العميل</TableHead>
                    <TableHead className="text-right">المطبعة</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">إجمالي البيع</TableHead>
                    <TableHead className="text-right">تكلفة المطبعة</TableHead>
                    <TableHead className="text-right">الربح</TableHead>
                    <TableHead className="text-right">المدفوع</TableHead>
                    <TableHead className="text-right">المتبقي</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-right">إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredInvoices.map((invoice) => {
                    const remaining = (Number(invoice.total_amount) || 0) - (Number(invoice.paid_amount) || 0);
                    const profit = (Number(invoice.total_amount) || 0) - (Number(invoice.printer_cost) || 0);
                    
                    return (
                      <TableRow key={invoice.id}>
                        <TableCell className="font-mono font-semibold">
                          {invoice.invoice_number}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="link"
                            className="p-0 h-auto font-medium"
                            onClick={() => handleViewCustomer(invoice.customer_id, invoice.customer_name)}
                          >
                            {invoice.customer_name}
                          </Button>
                        </TableCell>
                        <TableCell>{invoice.printer_name || '—'}</TableCell>
                        <TableCell>
                          {invoice.invoice_date 
                            ? new Date(invoice.invoice_date).toLocaleDateString('ar-LY')
                            : new Date(invoice.created_at).toLocaleDateString('ar-LY')}
                        </TableCell>
                        <TableCell className="font-semibold">
                          {(Number(invoice.total_amount) || 0).toLocaleString('ar-LY')} د.ل
                        </TableCell>
                        <TableCell className="text-orange-600 font-semibold">
                          {(Number(invoice.printer_cost) || 0).toLocaleString('ar-LY')} د.ل
                        </TableCell>
                        <TableCell className="text-purple-600 font-bold">
                          {profit.toLocaleString('ar-LY')} د.ل
                        </TableCell>
                        <TableCell className="text-green-600 font-semibold">
                          {(Number(invoice.paid_amount) || 0).toLocaleString('ar-LY')} د.ل
                        </TableCell>
                        <TableCell className="text-red-600 font-semibold">
                          {remaining.toLocaleString('ar-LY')} د.ل
                        </TableCell>
                        <TableCell>
                          {invoice.paid ? (
                            <Badge className="bg-green-600">مسددة</Badge>
                          ) : remaining === 0 ? (
                            <Badge className="bg-green-600">مسددة</Badge>
                          ) : (Number(invoice.paid_amount) || 0) > 0 ? (
                            <Badge className="bg-orange-500">مسدد جزئياً</Badge>
                          ) : (
                            <Badge variant="destructive">غير مسددة</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setSelectedInvoiceForPrint(invoice);
                                setPrintOpenToPreview(true);
                                setPrintAuto(true);
                                setPrintDialogOpen(true);
                              }}
                              title="طباعة الفاتورة"
                              className="text-primary hover:text-primary hover:bg-primary/10 border-primary/30"
                            >
                              <Printer className="h-4 w-4" />
                            </Button>
                            {invoice.invoice_type === 'composite_task' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={async () => {
                                  const compositeTask = await loadCompositeTaskForInvoice(invoice.id);
                                  if (compositeTask) {
                                    const printComponent = document.createElement('div');
                                    const root = (await import('react-dom/client')).createRoot(printComponent);
                                    const { CompositeTaskInvoicePrint } = await import('@/components/composite-tasks/CompositeTaskInvoicePrint');
                                    root.render(<CompositeTaskInvoicePrint task={compositeTask as any} />);
                                    setTimeout(() => {
                                      const button = printComponent.querySelector('button');
                                      button?.click();
                                    }, 100);
                                  }
                                }}
                                title="طباعة فاتورة الزبون للمهمة المجمعة"
                                className="text-purple-600 hover:text-purple-700"
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleEditInvoice(invoice)}
                              title="تعديل الفاتورة"
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleDistributePayment(invoice)}
                              title="توزيع دفعة"
                              className="text-blue-600 hover:text-blue-700"
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleViewCustomer(invoice.customer_id, invoice.customer_name)}
                              title="عرض حساب العميل"
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* نافذة تعديل الفاتورة */}
      <PrintedInvoiceEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        invoiceId={selectedInvoiceId}
        onSuccess={loadInvoices}
      />

      {/* نافذة توزيع الدفعة */}
      {selectedInvoice && (
        <EnhancedDistributePaymentDialog
          open={distributeDialogOpen}
          onOpenChange={setDistributeDialogOpen}
          customerId={selectedInvoice.customer_id}
          customerName={selectedInvoice.customer_name}
          onSuccess={() => {
            loadInvoices();
            setDistributeDialogOpen(false);
            toast.success('تم توزيع الدفعة بنجاح');
          }}
        />
      )}

      {/* نافذة طباعة ومريعة الفاتورة العصرية */}
      <ModernPrintInvoiceDialog
        open={printDialogOpen}
        onClose={() => {
          setPrintDialogOpen(false);
          setSelectedInvoiceForPrint(null);
        }}
        customerId={selectedInvoiceForPrint?.customer_id}
        customerName={selectedInvoiceForPrint?.customer_name || ''}
        contracts={selectedInvoiceForPrint?.contract_number ? [{ Contract_Number: String(selectedInvoiceForPrint.contract_number), 'Customer Name': selectedInvoiceForPrint.customer_name, 'Ad Type': '', Total: selectedInvoiceForPrint.total_amount }] : []}
        selectedContracts={selectedInvoiceForPrint?.contract_number ? [String(selectedInvoiceForPrint.contract_number)] : []}
        onSelectContracts={() => {}}
        printItems={selectedInvoiceForPrint?.items || []}
        onUpdatePrintItem={() => {}}
        onRemoveItem={() => {}}
        includeAccountBalance={false}
        onIncludeAccountBalance={() => {}}
        accountPayments={0}
        onSaveInvoice={() => {
          loadInvoices();
          setPrintDialogOpen(false);
        }}
        initialInvoice={selectedInvoiceForPrint}
        openToPreview={printOpenToPreview}
        autoPrint={printAuto}
        onPrintInvoice={() => {}}
      />
    </div>
  );
}
