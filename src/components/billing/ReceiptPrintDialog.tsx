import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import * as UIDialog from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Printer, X, Receipt } from 'lucide-react';
import { compositeTaskLabel } from '@/lib/compositeTaskLabel';
import { usePrintSettingsByType } from '@/store';
import { DOCUMENT_TYPES } from '@/types/document-types';
import { DEFAULT_PRINT_SETTINGS } from '@/types/print-settings';
import { printUnifiedReceipt } from './UnifiedReceiptPrint';
import { buildReceiptLineItems, loadReceiptGroup } from './receiptLineItems';
interface ReceiptPrintDialogProps {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  payment: any;
  customerName: string;
}

// ✅ العملات المدعومة
const CURRENCIES = [
  { code: 'LYD', name: 'دينار ليبي', symbol: 'د.ل', writtenName: 'دينار ليبي' },
  { code: 'USD', name: 'دولار أمريكي', symbol: '$', writtenName: 'دولار أمريكي' },
  { code: 'EUR', name: 'يورو', symbol: '€', writtenName: 'يورو' },
  { code: 'GBP', name: 'جنيه إسترليني', symbol: '£', writtenName: 'جنيه إسترليني' },
  { code: 'SAR', name: 'ريال سعودي', symbol: 'ر.س', writtenName: 'ريال سعودي' },
  { code: 'AED', name: 'درهم إماراتي', symbol: 'د.إ', writtenName: 'درهم إماراتي' },
];

// ✅ دالة تنسيق الأرقام العربية
const formatArabicNumber = (num: number): string => {
  if (isNaN(num) || num === null || num === undefined) return '0';
  
  const numStr = num.toString();
  const parts = numStr.split('.');
  const integerPart = parts[0];
  const decimalPart = parts[1];
  
  const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  
  if (decimalPart) {
    return `${formattedInteger}.${decimalPart}`;
  }
  
  return formattedInteger;
};

export default function ReceiptPrintDialog({ open, onOpenChange, payment, customerName }: ReceiptPrintDialogProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  // ✅ نفس إعدادات وتصميم إيصال الدفعة الموزعة
  const { settings: receiptSettings } = usePrintSettingsByType(DOCUMENT_TYPES.PAYMENT_RECEIPT);
  const [showCollectionDetails, setShowCollectionDetails] = useState(false);
  const [customerData, setCustomerData] = useState<{
    name: string;
    company: string | null;
    phone: string | null;
  } | null>(null);

  // ✅ الحصول على معلومات العملة
  const getCurrencyInfo = () => {
    const currencyCode = payment?.currency || 'LYD';
    const currency = CURRENCIES.find(c => c.code === currencyCode);
    return {
      code: currencyCode,
      symbol: currency?.symbol || 'د.ل',
      name: currency?.name || 'دينار ليبي',
      writtenName: currency?.writtenName || 'دينار ليبي'
    };
  };

  // ✅ تحميل بيانات العميل
  const loadCustomerData = async () => {
    try {
      const customerId = payment?.customer_id;
      
      if (customerId) {
        const { data, error } = await supabase
          .from('customers')
          .select('name, company, phone')
          .eq('id', customerId)
          .single();
        
        if (!error && data) {
          setCustomerData({
            name: data.name || customerName,
            company: data.company,
            phone: data.phone
          });
          return;
        }
      }
      
      // استخدام اسم العميل المرسل
      setCustomerData({
        name: customerName,
        company: null,
        phone: null
      });
      
    } catch (error) {
      console.error('Error loading customer data:', error);
      setCustomerData({
        name: customerName,
        company: null,
        phone: null
      });
    }
  };

  useEffect(() => {
    if (open && payment) {
      loadCustomerData();
    }
  }, [open, payment]);

  // ✅ حساب المتبقي من الديون في وقت الدفعة (وليس الوقت الحالي)
  const calculateRemainingBalance = async () => {
    try {
      const customerId = payment?.customer_id;
      if (!customerId) return null;

      // تاريخ الدفعة الحالية
      const paymentDate = payment?.paid_at ? new Date(payment.paid_at) : new Date();

      // جميع الدفعات حتى تاريخ هذه الدفعة (بما فيها)
      const { data: allPayments } = await supabase
        .from('customer_payments')
        .select('*')
        .eq('customer_id', customerId)
        .lte('paid_at', paymentDate.toISOString());

      // العقود
      const { data: contracts } = await supabase
        .from('Contract')
        .select('*')
        .eq('customer_id', customerId);

      // فواتير المبيعات حتى تاريخ الدفعة
      const { data: salesInvoices } = await supabase
        .from('sales_invoices')
        .select('*')
        .eq('customer_id', customerId)
        .lte('invoice_date', paymentDate.toISOString().split('T')[0]);

      // فواتير الطباعة حتى تاريخ الدفعة
      const { data: printedInvoices } = await supabase
        .from('printed_invoices')
        .select('*')
        .eq('customer_id', customerId)
        .lte('invoice_date', paymentDate.toISOString().split('T')[0]);

      // الخصومات النشطة حتى تاريخ الدفعة
      const { data: discounts } = await supabase
        .from('customer_general_discounts')
        .select('discount_value, applied_date')
        .eq('customer_id', customerId)
        .eq('status', 'active')
        .lte('applied_date', paymentDate.toISOString().split('T')[0]);
      const totalDiscounts = (discounts || []).reduce((sum, d: any) => sum + (Number(d.discount_value) || 0), 0);

      // المشتريات حتى تاريخ الدفعة
      const { data: purchaseInvoices } = await supabase
        .from('purchase_invoices')
        .select('*')
        .eq('customer_id', customerId)
        .lte('purchase_date', paymentDate.toISOString().split('T')[0]);

      // ✅ المهام المجمعة
      const { data: compositeTasks } = await supabase
        .from('composite_tasks')
        .select('*')
        .eq('customer_id', customerId);

      // مهام الطباعة وقص الموتيف لفلترة فواتير الطباعة
      const [printTasksRes, cutoutTasksRes] = await Promise.all([
        supabase
          .from('print_tasks')
          .select('id, invoice_id, is_composite, installation_task_id, composite_task_id')
          .eq('customer_id', customerId),
        supabase
          .from('cutout_tasks' as any)
          .select('id, invoice_id, is_composite, installation_task_id')
          .eq('customer_id', customerId)
      ]);

      // ✅ استخدام الدالة الموحدة مع جميع المعاملات
      const { calculateTotalRemainingDebt, filterCompositeRelatedPrintedInvoices } = await import('./BillingUtils');
      
      const filteredPrintedInvoices = filterCompositeRelatedPrintedInvoices(
        printedInvoices || [],
        compositeTasks || [],
        printTasksRes.data || [],
        cutoutTasksRes.data || []
      );

      const remainingBalance = calculateTotalRemainingDebt(
        (contracts || []) as any[],
        (allPayments || []) as any[],
        salesInvoices || [],
        filteredPrintedInvoices,
        purchaseInvoices || [],
        totalDiscounts,
        compositeTasks || [],
        0 // لا نطرح إيجارات الصديقة من ديون الزبون في إيصال الاستلام
      );

      return {
        remainingBalance
      };
    } catch (error) {
      console.error('Error calculating general debt:', error);
      return null;
    }
  };

  // ✅ طباعة الإيصال
  const handlePrintReceipt = async () => {
    if (!payment || !customerData) {
      toast.error('لا توجد بيانات دفعة أو عميل للطباعة');
      return;
    }

    setIsGenerating(true);
    
    try {
      // No popup test needed - using inline dialog

      // حساب الرصيد المتبقي
      const balanceInfo = await calculateRemainingBalance();

      // قراءة معلومات الوسيط (العهدة/الموظف/السحوبات) من sessionStorage
      let intermediaryInfo: { custodyInfo?: any[]; employeeAdvances?: any[]; withdrawals?: any[]; showIntermediary?: boolean } | null = null;
      try {
        const storedInfo = sessionStorage.getItem('printReceiptIntermediaryInfo');
        if (storedInfo) {
          intermediaryInfo = JSON.parse(storedInfo);
          sessionStorage.removeItem('printReceiptIntermediaryInfo');
        }
      } catch (e) {
        console.error('Error parsing intermediary info:', e);
      }

      // استخراج معلومات المستلم (الموظف صاحب العهدة أو السلفة أو السحب)
      const custodyReceiverName = intermediaryInfo?.custodyInfo?.[0]?.employee_name || null;
      const employeeReceiverName = intermediaryInfo?.employeeAdvances?.[0]?.employee_name || null;
      const withdrawalReceiverName = intermediaryInfo?.withdrawals?.[0]?.receiver_name || null;
      const receiverName = custodyReceiverName || employeeReceiverName || withdrawalReceiverName || null;

      // استخراج معلومات العقود الموزعة من الملاحظات
      const distributedContractsMatch = payment.notes?.match(/دفعة موزعة على (\d+) عقود: ([\d,\s]+)/);
      const isDistributedPayment = !!distributedContractsMatch;
      const distributedContracts = distributedContractsMatch ? distributedContractsMatch[2].split(',').map((c: string) => c.trim()) : [];

      // ✅ تحديد نوع الدفعة ومصدرها
      const isCompositeTaskPayment = !!(payment as any).composite_task_id;
      const isSalesInvoicePayment = !!(payment as any).sales_invoice_id;
      const isPrintedInvoicePayment = !!(payment as any).printed_invoice_id;
      
      // جلب بيانات المهمة المجمعة
      let compositeTaskInfo: any = null;
      if (isCompositeTaskPayment) {
        try {
          const { data } = await supabase
            .from('composite_tasks')
            .select('task_type, customer_total, contract_id, installation_task_id, task_number, print_task_id, cutout_task_id')
            .eq('id', (payment as any).composite_task_id)
            .single();
          compositeTaskInfo = data;

          if (data?.installation_task_id) {
            const { data: it } = await supabase
              .from('installation_tasks')
              .select('id, task_type, reinstallation_number')
              .eq('id', data.installation_task_id)
              .single();
            if (it) {
              compositeTaskInfo.reinstallation_number = it.reinstallation_number;
              compositeTaskInfo.task_type = it.task_type || compositeTaskInfo.task_type;
            }
          }
          if (data?.contract_id) {
            const { data: c } = await supabase
              .from('Contract')
              .select('"Ad Type"')
              .eq('Contract_Number', data.contract_id)
              .single();
            if (c) {
              compositeTaskInfo.ad_type = c['Ad Type'];
            }
          }
        } catch (e) {
          console.error('Error fetching composite task:', e);
        }
      }

      // جلب بيانات فاتورة المبيعات
      let salesInvoiceInfo: { invoice_number?: string; notes?: string; total_amount?: number } | null = null;
      if (isSalesInvoicePayment) {
        try {
          const { data } = await supabase
            .from('sales_invoices')
            .select('invoice_number, notes, total_amount')
            .eq('id', (payment as any).sales_invoice_id)
            .single();
          salesInvoiceInfo = data;
        } catch (e) {
          console.error('Error fetching sales invoice:', e);
        }
      }

      // جلب بيانات فاتورة الطباعة
      let printedInvoiceInfo: { invoice_number?: string; total_amount?: number; printer_name?: string } | null = null;
      if (isPrintedInvoicePayment) {
        try {
          const { data } = await supabase
            .from('printed_invoices')
            .select('invoice_number, total_amount, printer_name')
            .eq('id', (payment as any).printed_invoice_id)
            .single();
          printedInvoiceInfo = data;
        } catch (e) {
          console.error('Error fetching printed invoice:', e);
        }
      }

      // جلب بيانات العقود لنوع الإعلان
      let contractsData: { [key: string]: string } = {};
      if (isDistributedPayment && distributedContracts.length > 0) {
        try {
          const { data: contracts } = await supabase
            .from('Contract')
            .select('Contract_Number, "Ad Type"')
            .in('Contract_Number', distributedContracts.map(Number));
          
          if (contracts) {
            contracts.forEach((c: any) => {
              contractsData[c.Contract_Number] = c['Ad Type'] || 'لوحة إعلانية';
            });
          }
        } catch (e) {
          console.error('Error fetching contracts data:', e);
        }
      }

      // ✅ تحديد البيان/الوصف للدفعة
      const getPaymentDescription = () => {
        if (isDistributedPayment) return `دفعة موزعة على ${distributedContracts.length} عقود`;
        if (isCompositeTaskPayment && compositeTaskInfo) {
          const components: string[] = [];
          if (compositeTaskInfo.print_task_id) components.push('طباعة');
          if (compositeTaskInfo.cutout_task_id) components.push('قص');
          if (compositeTaskInfo.installation_task_id) components.push('تركيب');
          const taskComponents = components.length > 0 ? components.join(' + ') : 'مهمة مجمعة';

          const label = compositeTaskLabel({
            id: (payment as any).composite_task_id,
            task_number: compositeTaskInfo.task_number,
            contract_id: compositeTaskInfo.contract_id,
            task_type: compositeTaskInfo.task_type,
            reinstallation_number: compositeTaskInfo.reinstallation_number,
            installation_task_id: compositeTaskInfo.installation_task_id,
          });

          const rawAdType = compositeTaskInfo.ad_type ? String(compositeTaskInfo.ad_type).trim() : '';
          const desc = rawAdType && rawAdType !== 'لوحة إعلانية' ? `${rawAdType} (${taskComponents})` : taskComponents;
          return `${label} — ${desc}`;
        }
        if (isSalesInvoicePayment && salesInvoiceInfo) {
          return `فاتورة مبيعات${salesInvoiceInfo.invoice_number ? ` رقم ${salesInvoiceInfo.invoice_number}` : ''}${salesInvoiceInfo.notes ? ` - ${salesInvoiceInfo.notes}` : ''}`;
        }
        if (isPrintedInvoicePayment && printedInvoiceInfo) {
          return `فاتورة طباعة${printedInvoiceInfo.invoice_number ? ` رقم ${printedInvoiceInfo.invoice_number}` : ''}${printedInvoiceInfo.printer_name ? ` - ${printedInvoiceInfo.printer_name}` : ''}`;
        }
        if (payment.contract_number) return `عقد رقم ${payment.contract_number}`;
        if (payment.entry_type === 'account_payment') return 'دفعة على الحساب العام';
        return 'دفعة';
      };

      // استخراج الملاحظات الأصلية بدون معلومات التوزيع والتكرارات
      let cleanNotes = payment.notes || '';
      // إزالة معلومات البنوك المتكررة
      cleanNotes = cleanNotes
        .replace(/(من:\s*[^|]+\s*\|\s*إلى:\s*[^|]+\s*\|\s*)+/g, '')
        .replace(/من:\s*[^|]+\s*\|\s*إلى:\s*[^|]+/g, '')
        .replace(/\|\s*\|/g, '|')
        .replace(/^\s*\|\s*/g, '')
        .replace(/\s*\|\s*$/g, '')
        .trim();
      
      if (isDistributedPayment) {
        // إزالة معلومات التوزيع من الملاحظات للعرض
        cleanNotes = cleanNotes.replace(/دفعة موزعة على \d+ عقود: [\d,\s]+\n*/g, '').trim();
        // إزالة معلومات العهدة والموظف
 cleanNotes = cleanNotes.replace(/ تم التحويل لعهدة مالية:[\s\S]*?(?=\n\n|$)/g, '').trim();
 cleanNotes = cleanNotes.replace(/ تم تسليم جزء للموظفين:[\s\S]*?(?=\n\n|$)/g, '').trim();
        cleanNotes = cleanNotes.replace(/ملاحظات:\s*/g, '').trim();
      }

      const currencyInfo = getCurrencyInfo();

      // ✅ تصميم موحّد: نفس إيصال الدفعة الموزعة (جدول البنود + تفاصيل السداد + ملخص الدفعة)
      const groupRows = await loadReceiptGroup(payment);
      const lineItems = await buildReceiptLineItems(groupRows);
      const groupAmount = groupRows.reduce((sum: number, r: any) => sum + (Number(r.amount) || 0), 0);
      void getPaymentDescription; void isDistributedPayment;

      await printUnifiedReceipt(receiptSettings || DEFAULT_PRINT_SETTINGS, {
        payment: {
          id: payment.id,
          amount: groupRows.length > 1 ? groupAmount : (Number(payment.amount) || 0),
          paid_at: payment.paid_at,
          method: payment.method || 'نقدي',
          reference: payment.reference || undefined,
          notes: cleanNotes || undefined,
          contract_number: payment.contract_number ?? null,
          collector_name: showCollectionDetails ? (payment.collector_name || undefined) : undefined,
          receiver_name: showCollectionDetails ? (payment.receiver_name || receiverName || undefined) : (receiverName || undefined),
          delivery_location: showCollectionDetails ? (payment.delivery_location || undefined) : undefined,
          source_bank: payment.source_bank || undefined,
          destination_bank: payment.destination_bank || undefined,
          transfer_reference: payment.transfer_reference || undefined,
          transfer_image_url: payment.transfer_image_url || undefined,
          distributed_payment_id: payment.distributed_payment_id || undefined,
        },
        customerData: {
          id: payment.customer_id || '',
          name: customerData.name,
          company: customerData.company || undefined,
          phone: customerData.phone || undefined,
        },
        currency: currencyInfo,
        distributedContracts: lineItems,
        ...(balanceInfo ? { balanceInfo: { remainingBalance: balanceInfo.remainingBalance, totalPaid: 0 } } : {}),
      });
      onOpenChange(false);

    } catch (error) {
      console.error('Error in handlePrintReceipt:', error);
      const errorMessage = error instanceof Error ? error.message : 'خطأ غير معروف';
      toast.error(`حدث خطأ أثناء تحضير الإيصال للطباعة: ${errorMessage}`);
    } finally {
      setIsGenerating(false);
    }
  };

  const currencyInfo = getCurrencyInfo();

  return (
    <UIDialog.Dialog open={open} onOpenChange={onOpenChange}>
      <UIDialog.DialogContent className="expenses-dialog-content">
        <UIDialog.DialogHeader>
          <UIDialog.DialogTitle className="flex items-center gap-2">
            <Receipt className="h-5 w-5" />
            طباعة إيصال الاستلام
          </UIDialog.DialogTitle>
        </UIDialog.DialogHeader>
        
        <div className="space-y-6">
          {isGenerating ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-lg font-semibold">جاري تحضير الإيصال للطباعة...</p>
              <p className="text-sm text-gray-600 mt-2">يتم تحميل بيانات العميل وتحضير التخطيط</p>
            </div>
          ) : (
            <>
              {/* معلومات العملة */}
              <div className="bg-gradient-to-br from-card to-primary/10 p-4 rounded-lg border border-primary/30">
                <div className="flex items-center gap-3">
                  <div className="text-2xl text-primary">{currencyInfo.symbol}</div>
                  <div>
                    <div className="font-semibold text-primary">عملة الدفعة: {currencyInfo.name}</div>
                    <div className="text-sm text-muted-foreground">
                      المبلغ سيظهر بكلمة "{currencyInfo.writtenName}" في الإيصال المطبوع
                    </div>
                  </div>
                </div>
              </div>

              {/* معاينة بيانات الإيصال */}
              <div className="bg-card/80 backdrop-blur-sm p-4 rounded-lg border border-primary/20">
                <h3 className="font-semibold mb-2 text-primary">معاينة بيانات الإيصال:</h3>
                <div className="text-sm space-y-1">
                  <p><strong>العميل:</strong> {customerData?.name || 'غير محدد'}</p>
                  {customerData?.company && (
                    <p><strong>الشركة:</strong> {customerData.company}</p>
                  )}
                  {customerData?.phone && (
                    <p><strong>الهاتف:</strong> {customerData.phone}</p>
                  )}
                  <p><strong>المبلغ:</strong> {formatArabicNumber(payment?.amount || 0)} {currencyInfo.symbol}</p>
                  <p><strong>طريقة الدفع:</strong> {payment?.method || 'نقدي'}</p>
                  <p><strong>تاريخ الدفعة:</strong> {payment?.paid_at 
                    ? new Date(payment.paid_at).toLocaleDateString('ar-LY')
                    : new Date().toLocaleDateString('ar-LY')}</p>
                  {payment?.contract_id && (
                    <p><strong>رقم العقد:</strong> {payment.contract_id}</p>
                  )}
                  {payment?.notes && (
                    <p><strong>ملاحظات:</strong> {
                      (payment.notes || '')
                        .replace(/(من:\s*[^|]+\s*\|\s*إلى:\s*[^|]+\s*\|\s*)+/g, '')
                        .replace(/من:\s*[^|]+\s*\|\s*إلى:\s*[^|]+/g, '')
                        .replace(/\|\s*\|/g, '|')
                        .replace(/^\s*\|\s*/g, '')
                        .replace(/\s*\|\s*$/g, '')
                        .trim() || '—'
                    }</p>
                  )}
                </div>
              </div>

              {/* خيار إظهار بيانات التحصيل */}
              <div className="flex items-center gap-2 p-4 bg-muted rounded-lg">
                <input
                  type="checkbox"
                  id="showCollectionDetails"
                  checked={showCollectionDetails}
                  onChange={(e) => setShowCollectionDetails(e.target.checked)}
                  className="h-4 w-4 cursor-pointer"
                />
                <label htmlFor="showCollectionDetails" className="cursor-pointer text-sm">
                  إظهار بيانات التحصيل عبر الوسيط (المحصل، المستلم، مكان التسليم)
                </label>
              </div>

              {/* أزرار العمليات */}
              <div className="flex gap-2 justify-end">
                <Button 
                  variant="outline" 
                  onClick={() => onOpenChange(false)}
                  className="border-primary/30 hover:bg-primary/10"
                >
                  إغلاق
                </Button>
                <Button 
                  onClick={handlePrintReceipt}
                  className="bg-gradient-to-r from-primary to-primary-glow hover:from-primary-glow hover:to-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300"
                  disabled={isGenerating}
                >
                  <Printer className="h-4 w-4 ml-2" />
                  طباعة الإيصال
                </Button>
              </div>
            </>
          )}
        </div>
      </UIDialog.DialogContent>
    </UIDialog.Dialog>
  );
}