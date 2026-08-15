import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Edit, Trash2, Plus, ChevronDown, ChevronUp, Send, Wallet, CreditCard, AlertCircle, DollarSign, Coins, Receipt } from 'lucide-react';
import { PaymentRow } from './BillingTypes';
import { DistributedPaymentDetailsDialog } from './DistributedPaymentDetailsDialog';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Link2 } from 'lucide-react';
import { toast } from 'sonner';

interface PaymentSectionProps {
  payments: PaymentRow[];
  onEditReceipt: (payment: PaymentRow) => void;
  onDeleteReceipt: (id: string) => void;
  onPrintReceipt: (payment: PaymentRow) => void;
  onSendReceipt?: (payment: PaymentRow) => void;
  onAddDebt: () => void;
  onAddAccountPayment: () => void;
  onAddPurchaseFromCustomer?: () => void;
  onDeleteDistributedPayment?: (distributedPaymentId: string) => void;
  onEditDistributedPayment?: (distributedPaymentId: string, payments: PaymentRow[]) => void;
  showCollectionDetails?: boolean;
 totalRemainingDebt?: number; // المتبقي من إجمالي الديون (اختياري للتوافق مع المكونات القديمة)
  contracts?: Array<{ Contract_Number: number | string; 'Ad Type'?: string; ad_type?: string }>;
  onRefresh?: () => void | Promise<void>;
 customerId?: string; // 
}

const getPaymentTypeStyle = (entryType: string): string => {
  switch (entryType) {
    case 'receipt':
      return 'payment-type-receipt';
    case 'invoice':
      return 'payment-type-invoice';
    case 'debt':
      return 'payment-type-debt';
    case 'account_payment':
      return 'payment-type-account';
    default:
      return 'payment-type-default';
  }
};

const getPaymentTypeText = (entryType: string): string => {
  switch (entryType) {
    case 'payment':
      return 'دفعة';
    case 'account_payment':
      return 'دفعة حساب';
    case 'receipt':
      return 'إيصال';
    case 'debt':
      return 'دين سابق';
    case 'invoice':
      return 'فاتورة';
    case 'purchase_invoice':
      return 'فاتورة مشتريات';
    case 'sales_invoice':
      return 'فاتورة مبيعات';
    case 'printed_invoice':
      return 'فاتورة طباعة';
    case 'general_debit':
      return 'وارد عام';
    case 'general_credit':
      return 'صادر عام';
    default:
      return entryType || '—';
  }
};

const getPaymentTargetType = (payment: PaymentRow): string => {
  if (payment.contract_number) return 'عقد';
  if ((payment as any).composite_task_id) return 'مهمة مجمعة';
  if (payment.printed_invoice_id) return 'فاتورة طباعة';
  if (payment.sales_invoice_id) return 'فاتورة مبيعات';
  if (payment.purchase_invoice_id) return 'فاتورة مشتريات';
  if (payment.entry_type === 'payment') return 'دفعة';
  if (payment.entry_type === 'account_payment') return 'دفعة حساب';
  if (payment.entry_type === 'debt') return 'دين سابق';
  if (payment.entry_type === 'general_debit') return 'وارد عام';
  if (payment.entry_type === 'general_credit') return 'صادر عام';
  return '—';
};

const getPaymentTargetNumber = (payment: PaymentRow): string => {
  if (payment.contract_number) return `عقد رقم ${payment.contract_number}`;
  if ((payment as any).composite_task_id) return `مهمة مجمعة`;
  if (payment.printed_invoice_id) return `فاتورة طباعة`;
  if (payment.sales_invoice_id) return `فاتورة مبيعات`;
  if (payment.purchase_invoice_id) return `فاتورة مشتريات`;
  if (payment.entry_type === 'account_payment') return 'حساب عام';
  if (payment.entry_type === 'debt') return 'دين سابق';
  return '—';
};

// ✅ الحصول على البيان/الوصف التفصيلي للدفعة
const getPaymentStatement = (payment: PaymentRow): string => {
  // إذا كان هناك بيان مخصص
  if ((payment as any).statement_description) return (payment as any).statement_description;
  
  // عقد
  if (payment.contract_number) {
    return `دفعة على عقد رقم ${payment.contract_number}`;
  }
  
  // مهمة مجمعة
  if ((payment as any).composite_task_id) {
    const taskType = (payment as any).task_type;
    if (taskType === 'طباعة_تركيب') return 'مهمة طباعة وتركيب';
    if (taskType === 'طباعة_قص_تركيب') return 'مهمة طباعة وقص وتركيب';
    return 'مهمة مجمعة';
  }
  
  // فاتورة مبيعات
  if (payment.sales_invoice_id) {
    return 'فاتورة مبيعات';
  }
  
  // فاتورة طباعة
  if (payment.printed_invoice_id) {
    return 'فاتورة طباعة';
  }
  
  // فاتورة مشتريات
  if (payment.purchase_invoice_id) {
    return 'فاتورة مشتريات';
  }
  
  // أنواع أخرى
  if (payment.entry_type === 'account_payment') return 'دفعة على الحساب العام';
  if (payment.entry_type === 'debt') return 'دين سابق';
  if (payment.entry_type === 'general_debit') return 'وارد عام';
  if (payment.entry_type === 'general_credit') return 'صادر عام';
  
  return payment.notes || '—';
};

export function PaymentSection({
  payments,
  onEditReceipt,
  onDeleteReceipt,
  onPrintReceipt,
  onSendReceipt,
  onAddDebt,
  onAddAccountPayment,
  onAddPurchaseFromCustomer,
  onDeleteDistributedPayment,
  onEditDistributedPayment,
  showCollectionDetails = false,
  totalRemainingDebt = 0,
  contracts = [],
  onRefresh,
 customerId, // 
}: PaymentSectionProps) {
  const [expandedDistributions, setExpandedDistributions] = useState<Set<string>>(new Set());
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedDistribution, setSelectedDistribution] = useState<PaymentRow[] | null>(null);
  const [paymentsInCustody, setPaymentsInCustody] = useState<Set<string>>(new Set());
  const [custodyEmployeeNames, setCustodyEmployeeNames] = useState<Record<string, string>>({});
  const [paymentsWithWithdrawal, setPaymentsWithWithdrawal] = useState<Set<string>>(new Set());
  const [withdrawalEmployeeNames, setWithdrawalEmployeeNames] = useState<Record<string, string>>({});
  const [compositeTaskNumbers, setCompositeTaskNumbers] = useState<Record<string, number>>({});
  
  // ✅ حالة إيجارات لوحات الأصدقاء وفواتير المشتريات لتعبئة شارات المقايضة بالبيانات الصحيحة
  const [friendRentals, setFriendRentals] = useState<any[]>([]);
  const [friendContractsMap, setFriendContractsMap] = useState<Record<number, string>>({});
  const [purchaseInvoiceNotes, setPurchaseInvoiceNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!customerId) return;
    const loadFriendRentalsAndContracts = async () => {
      try {
        // 1. جلب الشركة الصديقة المرتبطة بالزبون أولاً
        const { data: customerData } = await supabase
          .from('customers')
          .select('linked_friend_company_id')
          .eq('id', customerId)
          .maybeSingle();

        const friendCompanyId = customerData?.linked_friend_company_id;
        if (friendCompanyId) {
          // 2. جلب إيجارات اللوحات لهذه الشركة
          const { data: rentals } = await supabase
            .from('friend_billboard_rentals')
            .select(`
              contract_number,
              billboard_id,
              billboards (
                Billboard_Name
              )
            `)
            .eq('friend_company_id', friendCompanyId);
          
          if (rentals) {
            setFriendRentals(rentals);
            const contractNums = [...new Set(rentals.map(r => r.contract_number).filter(Boolean))];
            if (contractNums.length > 0) {
              const { data: contractsData } = await supabase
                .from('Contract')
                .select('Contract_Number, ad_type, "Ad Type"')
                .in('Contract_Number', contractNums);
              if (contractsData) {
                const map: Record<number, string> = {};
                contractsData.forEach((c: any) => {
                  const type = c["Ad Type"] || c.ad_type || "";
                  if (type) map[c.Contract_Number] = type;
                });
                setFriendContractsMap(map);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error loading friend rentals and contracts:', error);
      }

      try {
        // جلب فواتير المشتريات وملاحظاتها للزبون الحالي
        const { data: purchaseData } = await supabase
          .from('purchase_invoices')
          .select('id, invoice_number, notes')
          .eq('customer_id', customerId);
        if (purchaseData) {
          const map: Record<string, string> = {};
          purchaseData.forEach((inv: any) => {
            const label = inv.notes || inv.invoice_number || "";
            if (inv.id) map[inv.id] = label;
            if (inv.invoice_number) map[inv.invoice_number] = label;
          });
          setPurchaseInvoiceNotes(map);
        }
      } catch (error) {
        console.error('Error loading purchase invoices notes:', error);
      }
    };
    loadFriendRentalsAndContracts();
  }, [customerId]);
  // ربط دفعة غير مرتبطة برقم عقد
  const [linkDialogOpen, setLinkDialogOpen] = useState(false);
  const [linkPaymentId, setLinkPaymentId] = useState<string | null>(null);
  const [linkContractNumber, setLinkContractNumber] = useState<string>('');
  const [linkSaving, setLinkSaving] = useState(false);

  const openLinkDialog = (payment: PaymentRow) => {
    setLinkPaymentId(payment.id);
    setLinkContractNumber('');
    setLinkDialogOpen(true);
  };

  const handleLinkToContract = async () => {
    if (!linkPaymentId || !linkContractNumber) {
      toast.error('اختر رقم العقد أولاً');
      return;
    }
    setLinkSaving(true);
    try {
      const num = Number(linkContractNumber);
      const { error } = await supabase
        .from('customer_payments')
        .update({ contract_number: isNaN(num) ? (linkContractNumber as any) : num, entry_type: 'receipt' })
        .eq('id', linkPaymentId);
      if (error) throw error;
      toast.success('تم ربط الدفعة بالعقد بنجاح');
      setLinkDialogOpen(false);
      setLinkPaymentId(null);
      setLinkContractNumber('');
      if (onRefresh) await onRefresh();
    } catch (err: any) {
      console.error('link to contract error:', err);
      toast.error('فشل ربط الدفعة بالعقد');
    } finally {
      setLinkSaving(false);
    }
  };

  const isUnlinkedPayment = (payment: PaymentRow): boolean => {
    if (payment.contract_number) return false;
    if (payment.distributed_payment_id) return false;
    if ((payment as any).composite_task_id) return false;
    if (payment.sales_invoice_id || payment.printed_invoice_id || payment.purchase_invoice_id) return false;
    return payment.entry_type === 'receipt' || payment.entry_type === 'payment' || payment.entry_type === 'account_payment';
  };

  // تحميل معلومات العهد المرتبطة بالدفعات الموزعة
  useEffect(() => {
    const loadCustodyInfo = async () => {
      const distributedIds = payments
        .filter(p => p.distributed_payment_id)
        .map(p => p.distributed_payment_id as string);
      
      const uniqueIds = [...new Set(distributedIds)];
      if (uniqueIds.length === 0) return;

      try {
        const { data } = await supabase
          .from('custody_accounts')
          .select('source_payment_id, employee_id')
          .in('source_payment_id', uniqueIds)
          .eq('source_type', 'distributed_payment');

        if (data && data.length > 0) {
          setPaymentsInCustody(new Set(data.map(d => d.source_payment_id).filter(Boolean) as string[]));
          
          // جلب أسماء الموظفين
          const employeeIds = [...new Set(data.map(d => d.employee_id).filter(Boolean))];
          if (employeeIds.length > 0) {
            const { data: employees } = await supabase
              .from('employees')
              .select('id, name')
              .in('id', employeeIds);
            
            if (employees) {
              const employeeMap: Record<string, string> = {};
              employees.forEach(emp => { employeeMap[emp.id] = emp.name; });
              
              const custodyNames: Record<string, string> = {};
              data.forEach(custody => {
                if (custody.source_payment_id && custody.employee_id) {
                  custodyNames[custody.source_payment_id] = employeeMap[custody.employee_id] || '';
                }
              });
              setCustodyEmployeeNames(custodyNames);
            }
          }
        }
      } catch (error) {
        console.error('Error loading custody info:', error);
      }
    };

    // تحميل معلومات سحب الرصيد للموظفين
    const loadWithdrawalInfo = async () => {
      const distributedIds = payments
        .filter(p => p.distributed_payment_id)
        .map(p => p.distributed_payment_id as string);
      
      const uniqueIds = [...new Set(distributedIds)];
      if (uniqueIds.length === 0) return;

      try {
        const { data } = await supabase
          .from('expenses_withdrawals')
          .select('distributed_payment_id, receiver_name')
          .in('distributed_payment_id', uniqueIds);

        if (data && data.length > 0) {
          const withdrawalSet = new Set<string>();
          const withdrawalNames: Record<string, string> = {};
          
          data.forEach(w => {
            if (w.distributed_payment_id) {
              withdrawalSet.add(w.distributed_payment_id);
              if (w.receiver_name) {
                withdrawalNames[w.distributed_payment_id] = w.receiver_name;
              }
            }
          });
          
          setPaymentsWithWithdrawal(withdrawalSet);
          setWithdrawalEmployeeNames(withdrawalNames);
        }
      } catch (error) {
        console.error('Error loading withdrawal info:', error);
      }
    };

    loadCustodyInfo();
    loadWithdrawalInfo();

    // تحميل أرقام المهام المجمعة المرتبطة بالدفعات
    const loadCompositeTaskNumbers = async () => {
      const compositeIds = [...new Set(
        payments
          .filter(p => (p as any).composite_task_id)
          .map(p => (p as any).composite_task_id as string)
      )];
      if (compositeIds.length === 0) return;
      try {
        const { data } = await supabase
          .from('composite_tasks')
          .select('id, task_number')
          .in('id', compositeIds);
        if (data) {
          const map: Record<string, number> = {};
          data.forEach((t: any) => { if (t.task_number) map[t.id] = t.task_number; });
          setCompositeTaskNumbers(map);
        }
      } catch (error) {
        console.error('Error loading composite task numbers:', error);
      }
    };
    loadCompositeTaskNumbers();
  }, [payments]);

  // ✅ حساب الرصيد التراكمي والمتبقي من الديون لكل دفعة
  const paymentsWithBalance = useMemo(() => {
    // نبدأ من المتبقي الحالي (الذي يتم حسابه في الأعلى)
    let runningRemaining = totalRemainingDebt;

    // رتب حسب التاريخ من الأحدث للأقدم
    const sortedPayments = [...payments].sort((a, b) => {
      const dateA = new Date(a.paid_at || a.created_at).getTime();
      const dateB = new Date(b.paid_at || b.created_at).getTime();
      return dateB - dateA; // الأحدث أولاً
    });

    // نحسب المتبقي لكل دفعة بترتيب عكسي (من الأحدث للأقدم)
    const computed = sortedPayments.map(payment => {
      const currentRemaining = runningRemaining;
      const amt = Number(payment.amount) || 0;
      
      // إيصالات ودفعات = ائتمان (يزيد المتبقي عند الرجوع للماضي)
      if (payment.entry_type === 'receipt' || payment.entry_type === 'payment' || payment.entry_type === 'account_payment' || payment.entry_type === 'general_credit') {
        runningRemaining = runningRemaining + amt;
      } 
      // ديون وفواتير = مدين (يقلل المتبقي عند الرجوع للماضي)
      else if (payment.entry_type === 'debt' || payment.entry_type === 'invoice' || payment.entry_type === 'general_debit') {
        runningRemaining = Math.max(0, runningRemaining - amt);
      }

      return {
        ...payment,
        remaining_debt: currentRemaining
      } as PaymentRow & { remaining_debt: number };
    });

    return computed; // العرض من الأحدث للأقدم
  }, [payments, totalRemainingDebt]);

  // ✅ تجميع الدفعات الموزعة وفصل الديون السابقة
  const { groupedPayments, individualPayments, previousDebts } = useMemo(() => {
    const grouped = new Map<string, PaymentRow[]>();
    const individual: PaymentRow[] = [];
    const debts: PaymentRow[] = [];

    paymentsWithBalance.forEach(payment => {
      if (payment.entry_type === 'debt') {
        debts.push(payment);
      } else if (payment.distributed_payment_id) {
        const existing = grouped.get(payment.distributed_payment_id) || [];
        grouped.set(payment.distributed_payment_id, [...existing, payment]);
      } else {
        individual.push(payment);
      }
    });

    return { groupedPayments: grouped, individualPayments: individual, previousDebts: debts };
  }, [paymentsWithBalance]);

  const toggleDistribution = (distributionId: string) => {
    const newExpanded = new Set(expandedDistributions);
    if (newExpanded.has(distributionId)) {
      newExpanded.delete(distributionId);
    } else {
      newExpanded.add(distributionId);
    }
    setExpandedDistributions(newExpanded);
  };

  const handleShowDetails = (distributionPayments: PaymentRow[]) => {
    setSelectedDistribution(distributionPayments);
    setDetailsDialogOpen(true);
  };

  // استخراج اسم العميل من أول دفعة
  const customerName = payments.length > 0 ? (payments[0].customer_name || '') : '';

  const handlePrintCombined = () => {
    if (!selectedDistribution || selectedDistribution.length === 0) return;
    const firstPayment = selectedDistribution[0];
    const totalAmount = selectedDistribution.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    // لا نحذف sessionStorage هنا - ReceiptPrintDialog سيقرأه ويحذفه
    // فقط نضيف معلومات التوزيع للملاحظات
    
    // دمج معلومات الدفعة الموزعة مع الملاحظات الأصلية
    const distributionInfo = `دفعة موزعة على ${selectedDistribution.length} عقود: ${selectedDistribution.map(p => p.contract_number).join(', ')}`;
    
    const originalNotes = firstPayment.notes?.trim();
    const combinedNotes = originalNotes 
      ? `${distributionInfo}\n\nملاحظات: ${originalNotes}`
      : distributionInfo;

    const combinedPayment: PaymentRow = {
      ...firstPayment,
      amount: totalAmount,
      contract_number: null,
      notes: combinedNotes
    };

    onPrintReceipt(combinedPayment);
  };

  const handleDeleteDistributed = () => {
    if (!selectedDistribution || selectedDistribution.length === 0) return;
    const distributedPaymentId = selectedDistribution[0].distributed_payment_id;
    if (distributedPaymentId && onDeleteDistributedPayment) {
      onDeleteDistributedPayment(distributedPaymentId);
    }
  };

  const summaryStats = useMemo(() => {
    let receipts = 0;
    let debts = 0;
    let credits = 0;
    
    payments.forEach(p => {
      const amt = Number(p.amount) || 0;
      if (p.entry_type === 'receipt' || p.entry_type === 'payment' || p.entry_type === 'general_debit') {
        receipts += amt;
      } else if (p.entry_type === 'debt') {
        debts += amt;
      } else if (p.entry_type === 'general_credit') {
        credits += amt;
      }
    });
    
    return { receipts, debts, credits };
  }, [payments]);

  return (
    <>
      {/* قسم الديون السابقة */}
      {previousDebts.length > 0 && (
        <div className="max-w-[96%] mx-auto px-6 mb-6">
          <Card className="border-0 shadow-lg overflow-hidden border-r-4 border-r-rose-500">
            <CardHeader className="bg-gradient-to-r from-rose-500/10 to-transparent py-4">
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-rose-500/20 rounded-xl flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                  </div>
                  <div>
                    <span className="text-rose-600 dark:text-rose-400 font-bold text-lg">الديون السابقة</span>
                    <p className="text-sm text-muted-foreground">{previousDebts.length} دين</p>
                  </div>
                </div>
                <Badge className="bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 text-lg px-4 py-1.5" variant="outline">
                  {previousDebts.reduce((sum, d) => sum + (Number(d.amount) || 0), 0).toLocaleString('ar-LY')} د.ل
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0 pb-4">
              <div className="rounded-xl border overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="text-right font-bold">رقم العقد</TableHead>
                      <TableHead className="text-right font-bold">المبلغ</TableHead>
                      <TableHead className="text-right font-bold">التاريخ</TableHead>
                      <TableHead className="text-right font-bold">ملاحظات</TableHead>
                      <TableHead className="text-right font-bold">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previousDebts.map(debt => (
                      <TableRow key={debt.id} id={`payment-${debt.id}`} className="hover:bg-rose-500/5 transition-all duration-300">
                        <TableCell className="font-bold">
                          {debt.contract_number || 'دين عام'}
                        </TableCell>
                        <TableCell className="font-bold text-rose-600 dark:text-rose-400">
                          {(Number(debt.amount) || 0).toLocaleString('ar-LY')} د.ل
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {debt.paid_at ? new Date(debt.paid_at).toLocaleDateString('ar-LY') : '—'}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{debt.notes || '—'}</TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              className="bg-emerald-600 hover:bg-emerald-700 text-white"
                              onClick={() => {
                                if (window.confirm('هل تريد تسديد هذا الدين؟')) {
                                  onEditReceipt(debt);
                                }
                              }}
                            >
                              تسديد
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => onEditReceipt(debt)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => onDeleteReceipt(debt.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <div className="max-w-[96%] mx-auto px-6 mb-6">
        <Card className="border border-amber-500/20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-2xl overflow-hidden relative group transition-all duration-300 hover:border-amber-500/30 rounded-2xl">
          <CardHeader className="bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border-b border-amber-500/20 text-white py-5">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-500/15 border border-amber-500/30 rounded-xl flex items-center justify-center shadow-lg">
                  <CreditCard className="h-6 w-6 text-amber-500" />
                </div>
                <div>
                  <CardTitle className="text-xl font-bold text-white">الدفعات والإيصالات</CardTitle>
                  <p className="text-white/70 text-sm mt-0.5">{groupedPayments.size + individualPayments.length} سجل</p>
                </div>
              </div>

              {/* أزرار الإجراءات */}
              <div className="flex gap-2 flex-wrap">
                <Button 
                  onClick={onAddAccountPayment}
                  className="bg-emerald-500 hover:bg-emerald-600 text-white shadow-md cursor-pointer transition-all duration-200"
                  size="sm"
                >
                  <Plus className="h-4 w-4 ml-2" />
                  دفعة على الحساب
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-6 px-6 pb-6">
            {payments.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 mb-5 select-none">
                {/* Total Collected / Receipts */}
                <div className="bg-slate-950/45 backdrop-blur-md border border-white/5 hover:border-emerald-500/30 rounded-2xl p-4 flex items-center justify-between shadow-sm transition-all duration-300 hover:-translate-y-0.5 group">
                  <div className="space-y-1 text-right">
                    <span className="text-[10px] sm:text-xs font-bold text-muted-foreground/75">إجمالي المقبوضات</span>
                    <p className="text-base sm:text-lg lg:text-xl font-black text-emerald-400">
                      {summaryStats.receipts.toLocaleString('ar-LY')} <span className="text-xs font-normal text-white/50 font-tajawal">د.ل</span>
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-green-500/10 text-green-400 group-hover:scale-110 transition-transform shrink-0">
                    <Coins className="h-4.5 w-4.5" />
                  </div>
                </div>

                {/* Total Registered Debts */}
                <div className="bg-slate-950/45 backdrop-blur-md border border-white/5 hover:border-amber-500/30 rounded-2xl p-4 flex items-center justify-between shadow-sm transition-all duration-300 hover:-translate-y-0.5 group">
                  <div className="space-y-1 text-right">
                    <span className="text-[10px] sm:text-xs font-bold text-muted-foreground/75">إجمالي الديون السابقة</span>
                    <p className="text-base sm:text-lg lg:text-xl font-black text-amber-400">
                      {summaryStats.debts.toLocaleString('ar-LY')} <span className="text-xs font-normal text-white/50 font-tajawal">د.ل</span>
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-400 group-hover:scale-110 transition-transform shrink-0">
                    <DollarSign className="h-4.5 w-4.5" />
                  </div>
                </div>

                {/* Total Disbursed / Refunds */}
                <div className="bg-slate-950/45 backdrop-blur-md border border-white/5 hover:border-rose-500/30 rounded-2xl p-4 flex items-center justify-between shadow-sm transition-all duration-300 hover:-translate-y-0.5 group">
                  <div className="space-y-1 text-right">
                    <span className="text-[10px] sm:text-xs font-bold text-muted-foreground/75">إجمالي الصادرات والمسترد</span>
                    <p className="text-base sm:text-lg lg:text-xl font-black text-rose-400">
                      {summaryStats.credits.toLocaleString('ar-LY')} <span className="text-xs font-normal text-white/50 font-tajawal">د.ل</span>
                    </p>
                  </div>
                  <div className="p-2.5 rounded-xl bg-rose-500/10 text-rose-400 group-hover:scale-110 transition-transform shrink-0">
                    <Wallet className="h-4.5 w-4.5" />
                  </div>
                </div>
              </div>
            )}
            {payments.length ? (
              <div className="overflow-x-auto border border-white/10 rounded-xl bg-slate-900/40">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/50 hover:bg-muted/50">
                      <TableHead className="text-right font-bold w-16">#</TableHead>
                      <TableHead className="text-right font-bold">نوع المدفوع له</TableHead>
                      <TableHead className="text-right font-bold">الرقم</TableHead>
                      <TableHead className="text-right font-bold">البيان</TableHead>
                      <TableHead className="text-right font-bold">النوع</TableHead>
                      <TableHead className="text-right font-bold">المبلغ</TableHead>
                      <TableHead className="text-right font-bold">الرصيد</TableHead>
                      <TableHead className="text-right font-bold">المتبقي من الديون</TableHead>
                      {showCollectionDetails && (
                        <>
                          <TableHead className="text-right font-bold">عمولة وسيط</TableHead>
                          <TableHead className="text-right font-bold">عمولة تحويل</TableHead>
                          <TableHead className="text-right font-bold">الصافي</TableHead>
                        </>
                      )}
                      <TableHead className="text-right font-bold">طريقة الدفع</TableHead>
                      <TableHead className="text-right font-bold">المرجع</TableHead>
                      <TableHead className="text-right font-bold">التاريخ</TableHead>
                      <TableHead className="text-right font-bold">ملاحظات</TableHead>
                      <TableHead className="text-right font-bold">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                <TableBody>
                  {/* عرض الدفعات الموزعة المجمعة - مرتبة من الأحدث للأقدم */}
                  {Array.from(groupedPayments.entries())
                    .sort(([, paymentsA], [, paymentsB]) => {
                      const dateA = new Date(paymentsA[0]?.paid_at || paymentsA[0]?.created_at || 0).getTime();
                      const dateB = new Date(paymentsB[0]?.paid_at || paymentsB[0]?.created_at || 0).getTime();
                      return dateB - dateA; // ترتيب تنازلي (الأحدث أولاً)
                    })
                    .map(([distributionId, distributionPayments]) => {
                    const isExpanded = expandedDistributions.has(distributionId);
                    const totalAmount = distributionPayments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
                    const firstPayment = distributionPayments[0];
                    const isInCustody = paymentsInCustody.has(distributionId);
                    const hasWithdrawal = paymentsWithWithdrawal.has(distributionId);

                    const hasUnlinkedChild = distributionPayments.some(p => isUnlinkedPayment(p));
                    const unlinkedChildSum = distributionPayments
                      .filter(p => isUnlinkedPayment(p))
                      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

                    const hasPurchaseInvoice = distributionPayments.some(p => p.purchase_invoice_id || p.notes?.includes('مشتريات') || p.notes?.includes('PUR-'));
                    const isBarter = distributionPayments.some(p => p.method === 'مقايضة');
                    
                    let friendContractNum: number | null = null;
                    let friendAdType: string | null = null;

                    const notesText = firstPayment?.notes || '';
                    const barterMatch = notesText.match(/عقد\s*(\d+)/);
                    if (barterMatch) {
                      friendContractNum = Number(barterMatch[1]);
                    } else {
                      const billboardMatch = notesText.match(/إيجار لوحة[:\s]+([^\n،,•]+)/);
                      const billboardNameInNotes = billboardMatch ? billboardMatch[1].trim() : '';
                      if (billboardNameInNotes) {
                        const matchedRental = friendRentals.find(r => 
                          r.billboards?.Billboard_Name?.trim() === billboardNameInNotes ||
                          r.billboard_id === billboardNameInNotes
                        );
                        if (matchedRental) {
                          friendContractNum = matchedRental.contract_number;
                        }
                      }
                    }
                    if (friendContractNum) {
                      const linkedContract = contracts.find(c => Number(c.Contract_Number) === friendContractNum);
                      friendAdType = linkedContract 
                        ? (linkedContract['Ad Type'] || linkedContract.ad_type || null)
                        : (friendContractsMap[friendContractNum] || null);
                    }

                    let purchaseNotes = '';
                    if (hasPurchaseInvoice) {
                      const linkedPurId = distributionPayments.find(p => p.purchase_invoice_id)?.purchase_invoice_id;
                      const purMatch = notesText.match(/PUR-\d+/);
                      const purCode = purMatch ? purMatch[0] : null;
                      purchaseNotes = (linkedPurId ? purchaseInvoiceNotes[linkedPurId] : null) || (purCode ? purchaseInvoiceNotes[purCode] : null) || '';
                    }

                    const adTypeSuffix = friendAdType ? ` - ${friendAdType}` : '';
                    
                    const barterLabel = hasPurchaseInvoice 
                      ? `مقايضة - ${purchaseNotes || 'فاتورة مشتريات'}`
                      : (friendContractNum 
                        ? `مقايضة - إيجار لوحة عقد #${friendContractNum}${adTypeSuffix}` 
                        : 'مقايضة - إيجار لوحة');

                    return (
                      <React.Fragment key={distributionId}>
                        <TableRow
                          className={`cursor-pointer transition-all duration-300 ${
                            hasUnlinkedChild
                              ? 'bg-red-500/10 hover:bg-red-500/15 border-r-4 border-r-red-500/70 shadow-[inset_0_0_15px_rgba(239,68,68,0.15)]'
                              : isInCustody 
                                ? 'bg-amber-100 dark:bg-amber-950/30 hover:bg-amber-200 dark:hover:bg-amber-950/50' 
                                : hasWithdrawal 
                                  ? 'bg-blue-100 dark:bg-blue-950/30 hover:bg-blue-200 dark:hover:bg-blue-950/50' 
                                  : 'bg-primary/5 hover:bg-primary/10'
                          }`}
                          onClick={() => toggleDistribution(distributionId)}
                        >
                          <TableCell className="font-bold text-primary">
                            <span className="inline-flex items-center justify-center min-w-[40px] h-8 px-3 rounded-lg bg-blue-500 text-white text-base font-bold shadow-sm">
                              {payments.findIndex(p => p.id === firstPayment.id) + 1}
                            </span>
                          </TableCell>
                          <TableCell className="font-bold" colSpan={2}>
                            <div className="flex items-center gap-2 flex-wrap">
                              {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              <Badge variant="secondary" className={isInCustody ? "bg-amber-200 text-amber-800 border-amber-400" : hasWithdrawal ? "bg-blue-200 text-blue-800 border-blue-400" : "bg-primary/20"}>
                                دفعة موزعة - {distributionPayments.length} بنود
                              </Badge>
                              {hasUnlinkedChild && (
                                <Badge variant="outline" className="bg-red-500/20 text-red-400 border-red-500/40 gap-1.5 font-extrabold animate-pulse">
 ️ يوجد رصيد غير مستعمل: {unlinkedChildSum.toLocaleString('ar-LY')} د.ل
                                </Badge>
                              )}
                              {/* عرض أرقام العقود/المهام المجمعة */}
                              <div className="flex flex-wrap gap-1">
                                {distributionPayments.map((p, idx) => {
                                  const compositeId = (p as any).composite_task_id;
                                  const taskNum = compositeId ? compositeTaskNumbers[compositeId] : null;
                                  return (
                                    <Badge key={idx} variant="outline" className="bg-slate-100 dark:bg-slate-800 text-xs">
                                      {compositeId 
                                        ? `مهمة مجمعة #${taskNum || '—'}`
                                        : `عقد ${p.contract_number || '—'} - ${(p as any).ad_type || 'غير محدد'}`
                                      }
                                    </Badge>
                                  );
                                })}
                              </div>
                              {isBarter && (
                                <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-400 dark:bg-purple-950/40 dark:text-purple-400 gap-1 font-semibold text-xs">
                                  <Link2 className="h-3 w-3" />
                                  {barterLabel}
                                </Badge>
                              )}
                              {isInCustody && (
                                <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-400 gap-1">
                                  <Wallet className="h-3 w-3" />
                                  عهدة: {custodyEmployeeNames[distributionId] || 'غير محدد'}
                                </Badge>
                              )}
                              {hasWithdrawal && (
                                <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-400 gap-1">
                                  <Wallet className="h-3 w-3" />
                                  دفع لموظف: {withdrawalEmployeeNames[distributionId] || 'غير محدد'}
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground text-sm">
                            دفعة موزعة على {distributionPayments.length} بنود
                          </TableCell>
                          <TableCell>
                            <span className={getPaymentTypeStyle('receipt')}>
                              دفعة موزعة
                            </span>
                          </TableCell>
                          <TableCell className="font-bold text-lg text-green-600">
                            {totalAmount.toLocaleString('ar-LY')} د.ل
                          </TableCell>
                          <TableCell className="font-bold text-blue-600">
                            {((firstPayment as any).balance_after || 0).toLocaleString('ar-LY')} د.ل
                          </TableCell>
                          <TableCell className={`font-bold ${((firstPayment as any).remaining_debt || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                            {((firstPayment as any).remaining_debt || 0).toLocaleString('ar-LY')} د.ل
                          </TableCell>
                          {showCollectionDetails && (
                            <>
                              <TableCell>
                                {firstPayment.collected_via_intermediary && (Number(firstPayment.intermediary_commission) || 0) > 0 ? (
                                  <span className="text-red-600 font-medium">
                                    {(Number(firstPayment.intermediary_commission) || 0).toLocaleString('ar-LY')} د.ل
                                  </span>
                                ) : '—'}
                              </TableCell>
                              <TableCell>
                                {firstPayment.collected_via_intermediary && (Number(firstPayment.transfer_fee) || 0) > 0 ? (
                                  <span className="text-red-600 font-medium">
                                    {(Number(firstPayment.transfer_fee) || 0).toLocaleString('ar-LY')} د.ل
                                  </span>
                                ) : '—'}
                              </TableCell>
                              <TableCell>
                                {firstPayment.collected_via_intermediary && firstPayment.net_amount ? (
                                  <span className="font-semibold text-primary">
                                    {(Number(firstPayment.net_amount) || 0).toLocaleString('ar-LY')} د.ل
                                  </span>
                                ) : '—'}
                              </TableCell>
                            </>
                          )}
                          <TableCell>{firstPayment.method || '—'}</TableCell>
                          <TableCell>{firstPayment.reference || '—'}</TableCell>
                          <TableCell>
                            {firstPayment.paid_at ? new Date(firstPayment.paid_at).toLocaleDateString('ar-LY') : '—'}
                          </TableCell>
                          <TableCell>{firstPayment.notes || 'دفعة على عقود متعددة'}</TableCell>
                          <TableCell>
                            <div className="expenses-actions-cell">
                              <Button
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleShowDetails(distributionPayments);
                                }}
                                className="bg-primary hover:bg-primary/90"
                              >
                                عرض التفاصيل
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>

                        {isExpanded && distributionPayments.map(payment => {
                          const isUnlinked = isUnlinkedPayment(payment);
                          return (
                            <TableRow 
                              key={payment.id} 
                              id={`payment-${payment.id}`} 
                              className={`transition-all duration-300 ${
                                isUnlinked 
                                  ? 'bg-red-500/10 hover:bg-red-500/15 border-r-4 border-r-red-500/70 shadow-[inset_0_0_15px_rgba(239,68,68,0.15)]' 
                                  : 'bg-accent/30 hover:bg-accent/40'
                              }`}
                            >
                            <TableCell className="pr-8">
                              <span className="inline-flex items-center justify-center min-w-[32px] h-6 px-2 rounded-md bg-blue-400 text-white text-sm font-bold">
                                {payments.findIndex(p => p.id === payment.id) + 1}
                              </span>
                            </TableCell>
                            <TableCell className="expenses-contract-number">
                              {getPaymentTargetType(payment)}
                            </TableCell>
                            <TableCell>
                              {getPaymentTargetNumber(payment)}
                            </TableCell>
                            <TableCell className="text-muted-foreground text-sm">
                              {getPaymentStatement(payment)}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1 items-start">
                                <span className={getPaymentTypeStyle(payment.entry_type)}>
                                  {getPaymentTypeText(payment.entry_type)}
                                </span>
                                {isUnlinked && (
                                  <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                                    <span className="relative flex h-1.5 w-1.5">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                                    </span>
                                    غير مستعملة
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="font-semibold stat-green">
                              {(Number(payment.amount) || 0).toLocaleString('ar-LY')} د.ل
                            </TableCell>
                            <TableCell>—</TableCell>
                            <TableCell className={`font-bold ${((payment as any).remaining_debt || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                              {((payment as any).remaining_debt || 0).toLocaleString('ar-LY')} د.ل
                            </TableCell>
                            <TableCell colSpan={showCollectionDetails ? 3 : 0}>—</TableCell>
                            <TableCell>—</TableCell>
                            <TableCell>—</TableCell>
                            <TableCell>{payment.notes || '—'}</TableCell>
                            <TableCell>
                              <div className="expenses-actions-cell">
                                <Button
                                  size="sm"
                                  onClick={() => onPrintReceipt(payment)}
                                  className="bg-blue-600 hover:bg-blue-700 text-white"
                                >
                                  طباعة
                                </Button>
                                {onSendReceipt && (
                                  <Button
                                    size="sm"
                                    onClick={() => onSendReceipt(payment)}
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                  >
                                    <Send className="h-4 w-4 ml-1" />
                                    إرسال
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                          );
                        })}
                      </React.Fragment>
                    );
                  })
                }

                  {/* عرض الدفعات الفردية */}
                  {individualPayments.map((payment) => {
                    const isUnlinked = isUnlinkedPayment(payment);
                    return (
                      <TableRow 
                        key={payment.id} 
                        id={`payment-${payment.id}`} 
                        className={`transition-all duration-300 ${isUnlinked ? 'bg-red-500/5 hover:bg-red-500/10 border-r-4 border-r-red-500/70 shadow-[inset_0_0_15px_rgba(239,68,68,0.05)]' : ''}`}
                      >
                      <TableCell className="font-bold text-primary">
                        <span className="inline-flex items-center justify-center min-w-[40px] h-8 px-3 rounded-lg bg-emerald-500 text-white text-base font-bold shadow-sm">
                          {payments.findIndex(p => p.id === payment.id) + 1}
                        </span>
                      </TableCell>
                      <TableCell className="expenses-contract-number">
                        {getPaymentTargetType(payment)}
                      </TableCell>
                      <TableCell>
                        {getPaymentTargetNumber(payment)}
                      </TableCell>
                      <TableCell className="text-muted-foreground text-sm">
                        {getPaymentStatement(payment)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1 items-start">
                          <span className={getPaymentTypeStyle(payment.entry_type)}>
                            {getPaymentTypeText(payment.entry_type)}
                          </span>
                          {isUnlinked && (
                            <span className="inline-flex items-center gap-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-red-500/20 text-red-400 border border-red-500/30 animate-pulse">
                              <span className="relative flex h-1.5 w-1.5">
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-red-500" />
                              </span>
                              غير مستعملة
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-semibold stat-green">
                        {(Number(payment.amount) || 0).toLocaleString('ar-LY')} د.ل
                      </TableCell>
                      <TableCell className="font-bold text-blue-600">
                        {((payment as any).balance_after || 0).toLocaleString('ar-LY')} د.ل
                      </TableCell>
                      <TableCell className={`font-bold ${((payment as any).remaining_debt || 0) > 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {((payment as any).remaining_debt || 0).toLocaleString('ar-LY')} د.ل
                      </TableCell>
                      {showCollectionDetails && (
                        <>
                          <TableCell>
                            {payment.collected_via_intermediary && (Number(payment.intermediary_commission) || 0) > 0 ? (
                              <span className="text-red-600 font-medium">
                                {(Number(payment.intermediary_commission) || 0).toLocaleString('ar-LY')} د.ل
                              </span>
                            ) : '—'}
                          </TableCell>
                          <TableCell>
                            {payment.collected_via_intermediary && (Number(payment.transfer_fee) || 0) > 0 ? (
                              <span className="text-red-600 font-medium">
                                {(Number(payment.transfer_fee) || 0).toLocaleString('ar-LY')} د.ل
                              </span>
                            ) : '—'}
                          </TableCell>
                          <TableCell>
                            {payment.collected_via_intermediary && payment.net_amount ? (
                              <span className="font-semibold text-primary">
                                {(Number(payment.net_amount) || 0).toLocaleString('ar-LY')} د.ل
                              </span>
                            ) : (Number(payment.amount) || 0).toLocaleString('ar-LY') + ' د.ل'}
                          </TableCell>
                        </>
                      )}
                      <TableCell>{payment.method || '—'}</TableCell>
                      <TableCell>{payment.reference || '—'}</TableCell>
                      <TableCell>
                        {payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('ar-LY') : '—'}
                      </TableCell>
                      <TableCell>{payment.notes || '—'}</TableCell>
                      <TableCell>
                        <div className="expenses-actions-cell">
                          <Button
                            size="sm"
                            onClick={() => onPrintReceipt(payment)}
                            className="bg-blue-600 hover:bg-blue-700 text-white"
                          >
                            طباعة إيصال
                          </Button>
                          {onSendReceipt && (
                            <Button
                              size="sm"
                              onClick={() => onSendReceipt(payment)}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              <Send className="h-4 w-4 ml-1" />
                              إرسال
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onEditReceipt(payment)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          {isUnlinkedPayment(payment) && contracts.length > 0 && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="border-amber-500 text-amber-600 hover:bg-amber-50 dark:hover:bg-amber-950"
                              title="ربط برقم عقد"
                              onClick={() => openLinkDialog(payment)}
                            >
                              <Link2 className="h-4 w-4 ml-1" />
                              ربط بعقد
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => onDeleteReceipt(payment.id)}
                          >
                            <Trash2 className="h-4 w-4" />
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
            <div className="expenses-empty-state text-center py-8">لا توجد دفعات</div>
          )}
        </CardContent>
      </Card>
    </div>

      {/* Dialog تفاصيل الدفعة الموزعة */}
      {selectedDistribution && (
        <DistributedPaymentDetailsDialog
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          groupedPayments={selectedDistribution}
          totalAmount={selectedDistribution.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)}
          onPrintCombined={handlePrintCombined}
          onPrintIndividual={onPrintReceipt}
          onDelete={handleDeleteDistributed}
          customerName={customerName}
          onEdit={onEditDistributedPayment ? () => {
            const distributedPaymentId = selectedDistribution[0].distributed_payment_id;
            if (distributedPaymentId) {
              onEditDistributedPayment(distributedPaymentId, selectedDistribution);
            }
          } : undefined}
        />
      )}

      {/* Dialog ربط دفعة بعقد */}
      <Dialog open={linkDialogOpen} onOpenChange={setLinkDialogOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>ربط الدفعة بعقد</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <p className="text-sm text-muted-foreground">
              اختر العقد الذي تريد ربط هذه الدفعة به. سيتم تحويلها من دفعة على الحساب العام إلى دفعة على العقد المحدد.
            </p>
            <Select value={linkContractNumber} onValueChange={setLinkContractNumber}>
              <SelectTrigger>
                <SelectValue placeholder="اختر رقم العقد" />
              </SelectTrigger>
              <SelectContent>
                {contracts.map((c) => (
                  <SelectItem key={String(c.Contract_Number)} value={String(c.Contract_Number)}>
                    عقد رقم {c.Contract_Number}
                    {(c['Ad Type'] || c.ad_type) ? ` — ${c['Ad Type'] || c.ad_type}` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setLinkDialogOpen(false)} disabled={linkSaving}>
              إلغاء
            </Button>
            <Button onClick={handleLinkToContract} disabled={linkSaving || !linkContractNumber}>
              {linkSaving ? 'جاري الحفظ...' : 'ربط بالعقد'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
