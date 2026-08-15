import { useState } from 'react';
import { formatAmount } from '@/lib/formatUtils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Printer, DollarSign, Trash2, Edit, ArrowRightLeft, Coins, Wallet } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { PurchaseInvoicePaymentDialog } from './PurchaseInvoicePaymentDialog';
import { PurchaseInvoiceEditDialog } from './PurchaseInvoiceEditDialog';
import { EnhancedDistributePaymentDialog } from './EnhancedDistributePaymentDialog';
import { generatePurchaseInvoiceHTML } from './InvoiceTemplates';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface PurchaseInvoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  customer_id: string;
  customer_name: string;
  total_amount: number;
  paid_amount: number;
  paid?: boolean;
  locked?: boolean;
  invoice_name: string | null;
  notes: string | null;
  used_as_payment?: number;
}

interface PurchaseInvoicesSectionProps {
  customerId: string;
  customerName: string;
  invoices: PurchaseInvoice[];
  onRefresh: () => void;
}

export function PurchaseInvoicesSection({
  customerId,
  customerName,
  invoices,
  onRefresh
}: PurchaseInvoicesSectionProps) {
  const [paymentDialogOpen, setPaymentDialogOpen] = useState(false);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [useAsPaymentDialogOpen, setUseAsPaymentDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<PurchaseInvoice | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoiceToDelete, setInvoiceToDelete] = useState<PurchaseInvoice | null>(null);

  const handleAddPayment = (invoice: PurchaseInvoice) => {
    if (invoice.locked) {
      toast.error('لا يمكن إضافة دفعات لفاتورة مسددة بالكامل');
      return;
    }
    setSelectedInvoice(invoice);
    setPaymentDialogOpen(true);
  };

  const handleEdit = (invoice: PurchaseInvoice) => {
    setSelectedInvoice(invoice);
    setEditDialogOpen(true);
  };

  const handleUseAsPayment = (invoice: PurchaseInvoice) => {
    const availableCredit = Number(invoice.total_amount) - Number(invoice.used_as_payment || 0);
    if (availableCredit <= 0) {
      toast.error('لا يوجد رصيد متاح لاستخدامه كدفعة');
      return;
    }
    const completeInvoice: PurchaseInvoice = {
      ...invoice,
      customer_id: invoice.customer_id || customerId,
      customer_name: invoice.customer_name || customerName,
    };
    setSelectedInvoice(completeInvoice);
    setUseAsPaymentDialogOpen(true);
  };

  const handlePrint = async (invoice: PurchaseInvoice) => {
    try {
      const { data: items, error } = await supabase
        .from('purchase_invoice_items')
        .select('*')
        .eq('invoice_id', invoice.id)
        .order('created_at', { ascending: true });

      if (error) throw error;

      const invoiceData = {
        invoiceNumber: invoice.invoice_number,
        invoiceDate: invoice.invoice_date,
        customerName: invoice.customer_name,
        invoiceName: invoice.invoice_name || 'فاتورة مشتريات',
        items: (items || []).map((item: any) => ({
          description: item.item_name,
          quantity: item.quantity,
          unit: item.unit || '',
          unitPrice: item.unit_price,
          total: item.total_price,
          image_url: item.image_url || undefined
        })),
        totalAmount: invoice.total_amount,
        notes: invoice.notes || undefined
      };

      const html = await generatePurchaseInvoiceHTML(invoiceData);
      const { showPrintPreview } = await import('@/components/print/PrintPreviewDialog');
      showPrintPreview(html, `فاتورة مشتريات ${invoice.invoice_number} - ${invoice.customer_name}`, 'billing-invoices');
    } catch (error) {
      console.error('Error printing invoice:', error);
      toast.error('فشل طباعة الفاتورة');
    }
  };

  const handleDelete = async () => {
    if (!invoiceToDelete) return;

    try {
      // 1. إلغاء ربط دفعات المقايضة المرتبطة بهذه الفاتورة
      await supabase
        .from('customer_payments')
        .update({ purchase_invoice_id: null })
        .eq('purchase_invoice_id', invoiceToDelete.id);

      // 2. حذف حركة فاتورة المشتريات (السالبة) من جدول customer_payments
      await supabase
        .from('customer_payments')
        .delete()
        .eq('entry_type', 'purchase_invoice')
        .or(`purchase_invoice_id.eq.${invoiceToDelete.id},notes.like.%${invoiceToDelete.invoice_number}%`);

      // 3. حذف فاتورة المشتريات نفسها
      const { error } = await supabase
        .from('purchase_invoices')
        .delete()
        .eq('id', invoiceToDelete.id);

      if (error) throw error;

      toast.success('تم حذف الفاتورة بنجاح');
      onRefresh();
    } catch (error) {
      console.error('Error deleting invoice:', error);
      toast.error('فشل حذف الفاتورة');
    } finally {
      setDeleteDialogOpen(false);
      setInvoiceToDelete(null);
    }
  };

  if (invoices.length === 0) {
    return null;
  }

  const totalAmount = invoices.reduce((sum, inv) => sum + (Number(inv.total_amount) || 0), 0);
  const totalPaid = invoices.reduce((sum, inv) => sum + (Number(inv.paid_amount || 0) + Number(inv.used_as_payment || 0)), 0);
  const totalRemaining = Math.max(0, totalAmount - totalPaid);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-5 select-none">
        {/* Total Card */}
        <div className="bg-slate-950/45 backdrop-blur-md border border-white/5 hover:border-amber-500/30 rounded-2xl p-4 flex items-center justify-between shadow-sm transition-all duration-300 hover:-translate-y-0.5 group">
          <div className="space-y-1 text-right">
            <span className="text-[10px] sm:text-xs font-bold text-muted-foreground/75">إجمالي المبلغ</span>
            <p className="text-base sm:text-lg lg:text-xl font-black text-white">
              {totalAmount.toLocaleString('ar-LY')} <span className="text-xs font-normal text-white/50 font-tajawal">د.ل</span>
            </p>
          </div>
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform shrink-0">
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

      <div className="space-y-3">
        {invoices.map((invoice) => {
          const paidAmount = Number(invoice.paid_amount || 0);
          const usedAsPayment = Number(invoice.used_as_payment || 0);
          const totalAmount = Number(invoice.total_amount);
          const totalSettled = paidAmount + usedAsPayment;
          const remaining = Math.max(0, totalAmount - totalSettled);
          const isFullySettled = totalSettled >= totalAmount;
          const availableCredit = Math.max(0, totalAmount - usedAsPayment);
          
          return (
            <div
              key={invoice.id}
              className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 bg-slate-900/60 rounded-xl border border-white/10 hover:border-amber-500/20 hover:bg-slate-900/80 transition-all duration-200"
            >
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="font-bold text-white text-base">#{invoice.invoice_number}</span>
                  {invoice.invoice_name && (
                    <span className="text-amber-400 font-bold text-sm">{invoice.invoice_name}</span>
                  )}
                  <Badge
                    variant={isFullySettled || invoice.paid ? 'default' : remaining > 0 ? 'destructive' : 'secondary'}
                    className={isFullySettled || invoice.paid 
                      ? 'bg-green-500/10 text-green-400 border border-green-500/30' 
                      : remaining > 0 
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/30' 
                        : 'bg-slate-700/50 text-slate-300 border border-slate-600/30'}
                  >
                    {isFullySettled || invoice.paid ? (usedAsPayment >= totalAmount ? 'مستخدمة كدفعة' : 'مسددة') : remaining > 0 ? 'غير مسددة' : 'جزئي'}
                  </Badge>
                  {invoice.locked && (
                    <Badge variant="outline" className="border-amber-500/30 bg-amber-500/5 text-amber-400">مقفلة</Badge>
                  )}
                  {usedAsPayment > 0 && (
                    <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/5 text-emerald-400 font-medium">
                      مستعملة كدفعة: {formatAmount(usedAsPayment)} د.ل
                    </Badge>
                  )}
                  {usedAsPayment > 0 && availableCredit > 0.01 && (
                    <Badge variant="outline" className="border-amber-500/40 bg-amber-500/10 text-amber-500 font-bold animate-pulse">
                      يوجد فائض يحتاج توزيع: {formatAmount(availableCredit)} د.ل
                    </Badge>
                  )}
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm pt-1">
                  <div className="text-white/60">
                    التاريخ: <span className="text-white font-medium">{new Date(invoice.invoice_date).toLocaleDateString('ar-LY')}</span>
                  </div>
                  <div className="text-white/60">
                    الإجمالي: <span className="font-bold text-white">{formatAmount(Number(invoice.total_amount))} د.ل</span>
                  </div>
                  <div className="text-white/60">
                    المتبقي: <span className={`font-bold ${remaining > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>{formatAmount(remaining)} د.ل</span>
                  </div>
                  <div className="text-white/60">
                    الرصيد المتاح: <span className="font-bold text-emerald-400">{formatAmount(availableCredit)} د.ل</span>
                  </div>
                </div>

                {invoice.notes && (
                  <div className="text-xs text-white/50 bg-white/5 rounded px-2.5 py-1 border border-white/5 w-fit">
                    ملاحظات: {invoice.notes}
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 md:justify-end">
                <Button size="sm" variant="outline" onClick={() => handlePrint(invoice)} className="border-white/10 text-white hover:bg-white/5 cursor-pointer transition-all duration-200">
                  <Printer className="h-4 w-4 ml-2" />طباعة
                </Button>
                <Button size="sm" variant="outline" onClick={() => handleEdit(invoice)} className="border-amber-500/30 text-amber-500 hover:bg-amber-500/10 cursor-pointer transition-all duration-200">
                  <Edit className="h-4 w-4 ml-2" />تعديل
                </Button>
                {availableCredit > 0 && (
                  <Button size="sm" variant="outline" onClick={() => handleUseAsPayment(invoice)} className="border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10 cursor-pointer transition-all duration-200">
                    <ArrowRightLeft className="h-4 w-4 ml-2" />استخدام كدفعة
                  </Button>
                )}
                {!invoice.locked && remaining > 0 && (
                  <Button size="sm" onClick={() => handleAddPayment(invoice)} className="bg-green-600 text-white hover:bg-green-700 cursor-pointer transition-all duration-200">
                    <DollarSign className="h-4 w-4 ml-2" />سداد
                  </Button>
                )}
                {!invoice.locked && (
                  <Button size="sm" variant="destructive" onClick={() => { setInvoiceToDelete(invoice); setDeleteDialogOpen(true); }} className="cursor-pointer transition-all duration-200">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <PurchaseInvoicePaymentDialog
        open={paymentDialogOpen}
        onOpenChange={setPaymentDialogOpen}
        invoice={selectedInvoice}
        customerId={customerId}
        onPaymentAdded={onRefresh}
      />

      <PurchaseInvoiceEditDialog
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        invoice={selectedInvoice}
        onSuccess={onRefresh}
      />

      {selectedInvoice && (
        <EnhancedDistributePaymentDialog
          open={useAsPaymentDialogOpen}
          onOpenChange={setUseAsPaymentDialogOpen}
          customerId={customerId}
          customerName={customerName}
          purchaseInvoice={{
            id: selectedInvoice.id,
            invoice_number: selectedInvoice.invoice_number,
            total_amount: selectedInvoice.total_amount,
            used_as_payment: selectedInvoice.used_as_payment || 0
          }}
          onSuccess={onRefresh}
        />
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent className="bg-card border-border" dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-foreground">تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription className="text-muted-foreground">
              هل أنت متأكد من حذف هذه الفاتورة؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="border-border text-muted-foreground hover:bg-muted">إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
