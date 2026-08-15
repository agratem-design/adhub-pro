import { useState } from 'react';
import { formatAmount } from '@/lib/formatUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Printer, Trash2, Edit, DollarSign, Coins, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { generateSalesInvoiceHTML } from './InvoiceTemplates';
import { SalesInvoiceEditDialog } from './SalesInvoiceEditDialog';
import { SalesInvoicePaymentDialog } from './SalesInvoicePaymentDialog';

interface SalesItem {
  item_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
}

interface SalesSectionProps {
  customerId: string;
  invoices: any[];
  onRefresh: () => void;
}

export function SalesSection({
  customerId,
  invoices,
  onRefresh
}: SalesSectionProps) {
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<any>(null);
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [selectedForPayment, setSelectedForPayment] = useState<any>(null);
  const [selectedInvoices, setSelectedInvoices] = useState<Set<string>>(new Set());

  const toggleInvoice = (invoiceId: string) => {
    const newSelected = new Set(selectedInvoices);
    if (newSelected.has(invoiceId)) {
      newSelected.delete(invoiceId);
    } else {
      newSelected.add(invoiceId);
    }
    setSelectedInvoices(newSelected);
  };

  const toggleAll = () => {
    if (selectedInvoices.size === invoices.length) {
      setSelectedInvoices(new Set());
    } else {
      setSelectedInvoices(new Set(invoices.map(inv => inv.id)));
    }
  };

  const handleEdit = (invoice: any) => {
    setSelectedInvoice(invoice);
    setEditDialogOpen(true);
  };

  const handleAddPayment = (invoice: any) => {
    setSelectedForPayment(invoice);
    setPaymentDialogOpen(true);
  };

  const handleDelete = async (invoiceId: string, invoiceNumber: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الفاتورة؟')) return;

    try {
      // حذف الدفعة المرتبطة أولاً
      await supabase
        .from('customer_payments')
        .delete()
        .eq('sales_invoice_id', invoiceId);

      // حذف الفاتورة
      const { error } = await supabase
        .from('sales_invoices')
        .delete()
        .eq('id', invoiceId);

      if (error) throw error;

      toast.success('تم حذف الفاتورة بنجاح');
      onRefresh();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error('فشل حذف الفاتورة');
    }
  };

  const handlePrint = async (invoice: any) => {
    const items = typeof invoice.items === 'string' ? JSON.parse(invoice.items) : invoice.items;
    const invoiceData = {
      invoiceNumber: invoice.invoice_number,
      invoiceDate: invoice.invoice_date,
      invoiceName: invoice.invoice_name || undefined,
      customerName: invoice.customer_name,
      items: items.map((item: any) => ({
        description: item.item_name,
        quantity: item.quantity,
        unit: item.unit || '',
        unitPrice: item.unit_price,
        total: item.total_price,
        image_url: item.image_url || undefined
      })),
      discount: invoice.discount || 0,
      totalAmount: invoice.total_amount,
      notes: invoice.notes || undefined
    };

    const html = await generateSalesInvoiceHTML(invoiceData);
    const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
    showPrintPreview(html, `فاتورة مبيعات ${invoice.invoice_number}${invoice.invoice_name ? ' - ' + invoice.invoice_name : ''}`, 'billing-invoices');
  };

  // حساب الإحصائيات
  const totalAmount = invoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + (Number(inv.paid_amount) || 0), 0);
  const totalRemaining = Math.max(0, totalAmount - totalPaid);
  const paidCount = invoices.filter(inv => (Number(inv.total_amount) || 0) - (Number(inv.paid_amount) || 0) <= 0.01).length;

  return (
    <>
    <Card className="border border-emerald-500/20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-2xl overflow-hidden relative group transition-all duration-300 hover:border-emerald-500/30 rounded-2xl mt-6">
      <CardHeader className="bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent border-b border-emerald-500/20 text-white py-5">
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 w-full">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-emerald-500/15 border border-emerald-500/30 rounded-xl flex items-center justify-center shadow-lg">
              <DollarSign className="h-6 w-6 text-emerald-500" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold text-white">فواتير المبيعات</CardTitle>
              <p className="text-white/70 text-sm mt-0.5">{invoices.length} فاتورة • {paidCount} مسددة</p>
            </div>
          </div>

          {selectedInvoices.size > 0 && (
            <span className="text-sm text-white/70">
              تم اختيار {selectedInvoices.size} فاتورة
            </span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-6 px-6 pb-6">
        {invoices.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-5 select-none">
            {/* Total Card */}
            <div className="bg-slate-950/45 backdrop-blur-md border border-white/5 hover:border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between shadow-sm transition-all duration-300 hover:-translate-y-0.5 group">
              <div className="space-y-1 text-right">
                <span className="text-[10px] sm:text-xs font-bold text-muted-foreground/75">إجمالي المبلغ</span>
                <p className="text-base sm:text-lg lg:text-xl font-black text-white">
                  {totalAmount.toLocaleString('ar-LY')} <span className="text-xs font-normal text-white/50 font-tajawal">د.ل</span>
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-400 group-hover:scale-110 transition-transform shrink-0">
                <DollarSign className="h-4.5 w-4.5" />
              </div>
            </div>

            {/* Paid Card */}
            <div className="bg-slate-950/45 backdrop-blur-md border border-white/5 hover:border-green-500/30 rounded-2xl p-4 flex items-center justify-between shadow-sm transition-all duration-300 hover:-translate-y-0.5 group">
              <div className="space-y-1 text-right">
                <span className="text-[10px] sm:text-xs font-bold text-muted-foreground/75">إجمالي المدفوع</span>
                <p className="text-base sm:text-lg lg:text-xl font-black text-green-400">
                  {totalPaid.toLocaleString('ar-LY')} <span className="text-xs font-normal text-white/50 font-tajawal">د.ل</span>
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-green-500/10 text-green-400 group-hover:scale-110 transition-transform shrink-0">
                <Coins className="h-4.5 w-4.5" />
              </div>
            </div>

            {/* Remaining Card */}
            <div className="bg-slate-950/45 backdrop-blur-md border border-white/5 hover:border-rose-500/30 rounded-2xl p-4 flex items-center justify-between shadow-sm transition-all duration-300 hover:-translate-y-0.5 group">
              <div className="space-y-1 text-right">
                <span className="text-[10px] sm:text-xs font-bold text-muted-foreground/75">المبلغ المتبقي</span>
                <p className="text-base sm:text-lg lg:text-xl font-black text-rose-400">
                  {totalRemaining.toLocaleString('ar-LY')} <span className="text-xs font-normal text-white/50 font-tajawal">د.ل</span>
                </p>
              </div>
              <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 group-hover:scale-110 transition-transform shrink-0">
                <Wallet className="h-4.5 w-4.5" />
              </div>
            </div>
          </div>
        )}
        {invoices.length > 0 ? (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50 hover:bg-muted/50">
                  <TableHead className="text-right font-bold w-12">
                    <Checkbox 
                      checked={selectedInvoices.size === invoices.length && invoices.length > 0}
                      onCheckedChange={toggleAll}
                    />
                  </TableHead>
                  <TableHead className="text-right font-bold">رقم الفاتورة</TableHead>
                  <TableHead className="text-right font-bold">عنوان الفاتورة</TableHead>
                  <TableHead className="text-right font-bold">التاريخ</TableHead>
                  <TableHead className="text-right font-bold">المبلغ الإجمالي</TableHead>
                  <TableHead className="text-right font-bold">المدفوع</TableHead>
                  <TableHead className="text-right font-bold">المتبقي</TableHead>
                  <TableHead className="text-right font-bold">الحالة</TableHead>
                  <TableHead className="text-right font-bold">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {invoices.map((invoice, idx) => {
                  const invoiceTotal = Number(invoice.total_amount) || 0;
                  const paidAmount = Number(invoice.paid_amount) || 0;
                  const remaining = invoiceTotal - paidAmount;
                  const isPaid = remaining <= 0.01;
                  const paymentPercentage = invoiceTotal > 0 ? Math.round((paidAmount / invoiceTotal) * 100) : 0;

                  return (
                    <TableRow 
                      key={invoice.id} 
                      className={`group transition-all duration-200 ${
                        selectedInvoices.has(invoice.id) 
                          ? 'bg-green-500/10' 
                          : isPaid 
                            ? 'bg-green-50/50 dark:bg-green-900/10' 
                            : idx % 2 === 0 
                              ? 'bg-background hover:bg-accent/50' 
                              : 'hover:bg-accent/50'
                      }`}
                    >
                      <TableCell className="py-4">
                        <Checkbox
                          checked={selectedInvoices.has(invoice.id)}
                          onCheckedChange={() => toggleInvoice(invoice.id)}
                        />
                      </TableCell>
                      <TableCell className="font-bold text-primary py-4">
                        #{invoice.invoice_number}
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="font-medium">{invoice.invoice_name || '—'}</span>
                      </TableCell>
                      <TableCell className="py-4 text-muted-foreground">
                        {invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('ar-LY') : '—'}
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="font-bold text-foreground">{formatAmount(invoiceTotal)}</span>
                        <span className="text-xs text-muted-foreground mr-1">د.ل</span>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">{formatAmount(paidAmount)}</span>
                        <span className="text-xs text-muted-foreground mr-1">د.ل</span>
                      </TableCell>
                      <TableCell className="py-4">
                        <span className={`font-bold ${remaining > 0 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                          {formatAmount(remaining)}
                        </span>
                        <span className="text-xs text-muted-foreground mr-1">د.ل</span>
                      </TableCell>
                      <TableCell className="py-4">
                        <Badge className={`text-xs ${
                          isPaid 
                            ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30' 
                            : paymentPercentage >= 50
                              ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30'
                              : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30'
                        }`} variant="outline">
                          {isPaid ? 'مسددة' : `${paymentPercentage}% مدفوع`}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right py-4">
                        <div className="flex gap-2 justify-end">
                          {!isPaid && (
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleAddPayment(invoice)}
                              className="bg-blue-600 hover:bg-blue-700"
                            >
                              <DollarSign className="h-4 w-4 ml-1" />
                              سداد
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleEdit(invoice)}
                          >
                            <Edit className="h-4 w-4 ml-1" />
                            تعديل
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handlePrint(invoice)}
                          >
                            <Printer className="h-4 w-4 ml-1" />
                            طباعة
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => handleDelete(invoice.id, invoice.invoice_number)}
                          >
                            <Trash2 className="h-4 w-4 ml-1" />
                            حذف
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <DollarSign className="h-12 w-12 mb-4 opacity-30" />
            <p className="text-lg font-medium">لا توجد فواتير مبيعات</p>
            <p className="text-sm">لم يتم العثور على فواتير مبيعات لهذا العميل</p>
          </div>
        )}
      </CardContent>
    </Card>

    <SalesInvoiceEditDialog
      open={editDialogOpen}
      onOpenChange={setEditDialogOpen}
      invoice={selectedInvoice}
      onSuccess={onRefresh}
    />

    <SalesInvoicePaymentDialog
      open={paymentDialogOpen}
      onOpenChange={setPaymentDialogOpen}
      invoice={selectedForPayment}
      customerId={customerId}
      onPaymentAdded={onRefresh}
    />
    </>
  );
}
