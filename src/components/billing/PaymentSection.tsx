import React, { useState, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import { Edit, Trash2, Plus, ChevronDown, ChevronUp, Send, Wallet, CreditCard, AlertCircle, DollarSign, Coins, AlertTriangle, ArrowRightLeft, Printer, Search } from 'lucide-react';
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
  onDistributePayment?: (payment: PaymentRow) => void;
  showCollectionDetails?: boolean;
  totalRemainingDebt?: number; // المتبقي من إجمالي الديون (اختياري للتوافق مع المكونات القديمة)
  contracts?: Array<{ Contract_Number: number | string; 'Ad Type'?: string; ad_type?: string }>;
  onRefresh?: () => void | Promise<void>;
  customerId?: string; // 
}

const fmtMoney = (n: number) => `${(Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 2 })} د.ل`;
const fmtDate = (d?: string | null) => (d ? new Date(d).toLocaleDateString('en-GB') : '—');

/** ألوان شارة الجهة المدفوع لها (متوافقة مع الوضعين الفاتح والداكن) */
const toneOf = (type: string): string => {
  switch (type) {
    case 'عقد': return 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300';
    case 'أمر عمل': return 'border-indigo-500/30 bg-indigo-500/10 text-indigo-700 dark:text-indigo-300';
    case 'فاتورة مبيعات': return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300';
    case 'فاتورة طباعة': return 'border-blue-500/30 bg-blue-500/10 text-blue-700 dark:text-blue-300';
    case 'فاتورة مشتريات': return 'border-purple-500/30 bg-purple-500/10 text-purple-700 dark:text-purple-300';
    case 'دفعة حساب': return 'border-cyan-500/30 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300';
    case 'دين سابق':
    case 'رصيد غير موزع': return 'border-rose-500/40 bg-rose-500/10 text-rose-700 dark:text-rose-300';
    default: return 'border-border bg-muted text-muted-foreground';
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

export interface PaymentTargetInfo {
  type: string;
  targetNumber: string;
  statement: string;
  badgeLabel: string;
  badgeColor: string;
}

export const getPaymentTargetInfo = (
  payment: PaymentRow,
  contractAdTypes: Record<number, string> = {},
  compositeTasksInfo: Record<string, { task_number?: number; contract_id?: number; ad_type?: string; task_type?: string }> = {},
  printedInvoices: Record<string, { invoice_number?: string; invoice_type?: string }> = {},
  salesInvoices: Record<string, { invoice_number?: string; invoice_name?: string }> = {},
  purchaseInvoices: Record<string, { invoice_number?: string }> = {}
): PaymentTargetInfo => {
  const compositeId = (payment as any).composite_task_id;
  const printedInvId = payment.printed_invoice_id;
  const salesInvId = payment.sales_invoice_id;
  const purchInvId = payment.purchase_invoice_id;
  const contractNum = payment.contract_number ? Number(payment.contract_number) : null;
  const notes = payment.notes || '';

  // 1. Composite Task
  if (compositeId) {
    const tInfo = compositeTasksInfo[compositeId];
    const taskNum = tInfo?.task_number || (notes.match(/(?:مهمة|أمر عمل)\s*(?:مجمعة)?\s*#?(\d+)/)?.[1]);
    const cId = tInfo?.contract_id || (notes.match(/عقد\s*#?(\d+)/)?.[1] ? Number(notes.match(/عقد\s*#?(\d+)/)?.[1]) : undefined);
    const adType = tInfo?.ad_type || (cId ? contractAdTypes[cId] : '') || (payment as any).ad_type || '';
    const numDisplay = taskNum ? `أمر عمل #${taskNum}` : cId ? `أمر عمل (عقد #${cId})` : 'أمر عمل';
    return {
      type: 'أمر عمل',
      targetNumber: numDisplay,
      statement: (payment as any).statement_description || `دفعة على ${numDisplay}${adType ? ` (${adType})` : ''}`,
      badgeLabel: `${numDisplay}${adType ? ` - ${adType}` : ''}`,
      badgeColor: 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
    };
  }

  // 2. Direct Contract Number
  if (contractNum) {
    const adType = contractAdTypes[contractNum] || (payment as any).ad_type || '';
    return {
      type: 'عقد',
      targetNumber: `عقد #${contractNum}`,
      statement: (payment as any).statement_description || `دفعة على عقد رقم #${contractNum}${adType ? ` (${adType})` : ''}`,
      badgeLabel: `عقد ${contractNum}${adType ? ` - ${adType}` : ''}`,
      badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30'
    };
  }

  // 3. Sales Invoice
  if (salesInvId || notes.includes('#SALE-') || notes.includes('فاتورة مبيعات')) {
    const inv = salesInvoices[salesInvId || ''];
    const numMatch = notes.match(/#SALE-[\w-]+/)?.[0] || (inv?.invoice_number ? `#${inv.invoice_number}` : '');
    const numDisplay = numMatch ? `فاتورة مبيعات ${numMatch}` : 'فاتورة مبيعات';
    const name = inv?.invoice_name || '';
    return {
      type: 'فاتورة مبيعات',
      targetNumber: numMatch || 'فاتورة مبيعات',
      statement: (payment as any).statement_description || `توزيع على ${numDisplay}${name ? ` (${name})` : ''}`,
      badgeLabel: `${numDisplay}${name ? ` - ${name}` : ''}`,
      badgeColor: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
    };
  }

  // 4. Print Invoice
  if (printedInvId || notes.includes('#INV-') || notes.includes('فاتورة طباعة')) {
    const inv = printedInvoices[printedInvId || ''];
    const numMatch = notes.match(/#INV-[\w-]+/)?.[0] || (inv?.invoice_number ? `#${inv.invoice_number}` : '');
    const numDisplay = numMatch ? `فاتورة طباعة ${numMatch}` : 'فاتورة طباعة';
    return {
      type: 'فاتورة طباعة',
      targetNumber: numMatch || 'فاتورة طباعة',
      statement: (payment as any).statement_description || `توزيع على ${numDisplay}`,
      badgeLabel: `${numDisplay}`,
      badgeColor: 'bg-blue-500/15 text-blue-300 border-blue-500/30'
    };
  }

  // 5. Purchase Invoice
  if (purchInvId || notes.includes('فاتورة مشتريات') || notes.includes('PUR-')) {
    const inv = purchaseInvoices[purchInvId || ''];
    const numMatch = notes.match(/PUR-\d+/)?.[0] || (inv?.invoice_number ? `#${inv.invoice_number}` : '') || purchInvId?.slice(0, 8) || '';
    const numDisplay = numMatch ? `فاتورة مشتريات ${numMatch}` : 'فاتورة مشتريات';
    return {
      type: 'فاتورة مشتريات',
      targetNumber: numMatch ? `#${numMatch}` : 'فاتورة مشتريات',
      statement: (payment as any).statement_description || `دفعة على ${numDisplay}`,
      badgeLabel: numDisplay,
      badgeColor: 'bg-purple-500/15 text-purple-300 border-purple-500/30'
    };
  }

  // 6. Contract mentioned in notes
  if (notes.includes('عقد #') || notes.match(/عقد\s*\d+/)) {
    const cMatch = notes.match(/عقد\s*#?(\d+)/)?.[1];
    const cNum = cMatch ? Number(cMatch) : null;
    const adType = cNum ? contractAdTypes[cNum] : '';
    return {
      type: 'عقد',
      targetNumber: cMatch ? `عقد #${cMatch}` : 'عقد',
      statement: (payment as any).statement_description || notes,
      badgeLabel: cMatch ? `عقد #${cMatch}${adType ? ` - ${adType}` : ''}` : notes,
      badgeColor: 'bg-amber-500/15 text-amber-300 border-amber-500/30'
    };
  }

  // 7. General Account Payment
  if (payment.entry_type === 'account_payment') {
    return {
      type: 'دفعة حساب',
      targetNumber: 'حساب عام',
      statement: (payment as any).statement_description || 'دفعة على الحساب العام للزبون',
      badgeLabel: 'دفعة على الحساب',
      badgeColor: 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30'
    };
  }

  // 8. Debt
  if (payment.entry_type === 'debt') {
    return {
      type: 'دين سابق',
      targetNumber: 'دين سابق',
      statement: (payment as any).statement_description || notes || 'دين سابق على الزبون',
      badgeLabel: 'دين سابق',
      badgeColor: 'bg-rose-500/15 text-rose-300 border-rose-500/30'
    };
  }

  // 9. Unallocated surplus or unlinked payment
  const isUnlinked = !contractNum && !compositeId && !salesInvId && !printedInvId && !purchInvId &&
    (payment.entry_type === 'payment' || payment.entry_type === 'receipt' || payment.entry_type === 'account_payment');

  if (isUnlinked) {
    const isSurplus = Boolean(payment.distributed_payment_id);
    return {
      type: 'رصيد غير موزع',
      targetNumber: isSurplus ? 'فائض دفعة' : 'غير محدد',
      statement: (payment as any).statement_description || notes || 'رصيد مدفوع غير موزع على عقود أو فواتير — يحتاج توزيع أو استرداد',
      badgeLabel: isSurplus
        ? `رصيد غير موزع (${(Number(payment.amount) || 0).toLocaleString('ar-LY')} د.ل)`
        : `رصيد غير موزع (${(Number(payment.amount) || 0).toLocaleString('ar-LY')} د.ل)`,
      badgeColor: 'bg-rose-500/20 text-rose-300 border-rose-500/50 shadow-xs font-bold'
    };
  }

  return {
    type: payment.entry_type === 'receipt' ? 'إيصال' : 'دفعة',
    targetNumber: '—',
    statement: (payment as any).statement_description || notes || 'دفعة عامة',
    badgeLabel: `دفعة (${(Number(payment.amount) || 0).toLocaleString('ar-LY')} د.ل)`,
    badgeColor: 'bg-slate-500/15 text-slate-300 border-slate-500/30'
  };
};

const getPaymentTargetType = (payment: PaymentRow): string => getPaymentTargetInfo(payment).type;
const getPaymentTargetNumber = (payment: PaymentRow): string => getPaymentTargetInfo(payment).targetNumber;
const getPaymentStatement = (payment: PaymentRow): string => getPaymentTargetInfo(payment).statement;

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
  onDistributePayment,
  showCollectionDetails = false,
  totalRemainingDebt = 0,
  contracts = [],
  onRefresh,
  customerId,
}: PaymentSectionProps) {
  const [expandedDistributions, setExpandedDistributions] = useState<Set<string>>(new Set());
  const [listQuery, setListQuery] = useState('');
  const [listFilter, setListFilter] = useState<'all' | 'single' | 'distributed' | 'unlinked'>('all');
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedDistribution, setSelectedDistribution] = useState<PaymentRow[] | null>(null);
  const [paymentsInCustody, setPaymentsInCustody] = useState<Set<string>>(new Set());
  const [custodyEmployeeNames, setCustodyEmployeeNames] = useState<Record<string, string>>({});
  const [paymentsWithWithdrawal, setPaymentsWithWithdrawal] = useState<Set<string>>(new Set());
  const [withdrawalEmployeeNames, setWithdrawalEmployeeNames] = useState<Record<string, string>>({});
  const [compositeTaskNumbers, setCompositeTaskNumbers] = useState<Record<string, number>>({});
  const [contractAdTypesMap, setContractAdTypesMap] = useState<Record<number, string>>({});
  const [compositeTasksInfoMap, setCompositeTasksInfoMap] = useState<Record<string, { task_number?: number; contract_id?: number; ad_type?: string; task_type?: string }>>({});
  const [printedInvoicesMap, setPrintedInvoicesMap] = useState<Record<string, { invoice_number?: string; invoice_type?: string }>>({});
  const [salesInvoicesMap, setSalesInvoicesMap] = useState<Record<string, { invoice_number?: string; invoice_name?: string }>>({});
  const [purchaseInvoicesMap, setPurchaseInvoicesMap] = useState<Record<string, { invoice_number?: string }>>({});
  
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
                .select('Contract_Number, "Ad Type"')
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

    // تحميل كامل مراجع الدفعات (عقود، أوامر عمل، فواتير مبيعات، فواتير طباعة ومشتريات)
    const loadAllPaymentReferences = async () => {
      if (!payments || payments.length === 0) return;
      try {
        const contractNums = new Set<number>();
        const compositeIds = new Set<string>();
        const salesIds = new Set<string>();
        const printedIds = new Set<string>();
        const purchaseIds = new Set<string>();

        payments.forEach(p => {
          if (p.contract_number) {
            const num = Number(p.contract_number);
            if (!isNaN(num)) contractNums.add(num);
          }
          if (p.notes) {
            const match = p.notes.match(/عقد\s*#?(\d+)/);
            if (match) contractNums.add(Number(match[1]));
          }
          const cid = (p as any).composite_task_id;
          if (cid) compositeIds.add(cid);
          if (p.sales_invoice_id) salesIds.add(p.sales_invoice_id);
          if (p.printed_invoice_id) printedIds.add(p.printed_invoice_id);
          if (p.purchase_invoice_id) purchaseIds.add(p.purchase_invoice_id);
        });

        // 1. Composite Tasks
        const fetchedCompositeInfo: Record<string, { task_number?: number; contract_id?: number; ad_type?: string; task_type?: string }> = {};
        if (compositeIds.size > 0) {
          const { data: ctData } = await supabase
            .from('composite_tasks')
            .select('id, task_number, contract_id, task_type')
            .in('id', Array.from(compositeIds));
          if (ctData) {
            const mapNum: Record<string, number> = {};
            ctData.forEach((t: any) => {
              const cId = t.contract_id ? Number(t.contract_id) : undefined;
              if (cId) contractNums.add(cId);
              if (t.task_number) mapNum[t.id] = t.task_number;
              fetchedCompositeInfo[t.id] = {
                task_number: t.task_number,
                contract_id: cId,
                task_type: t.task_type
              };
            });
            setCompositeTaskNumbers(mapNum);
          }
        }

        // 2. Contracts Ad Types
        const contractMap: Record<number, string> = {};
        if (contractNums.size > 0) {
          const { data: cData } = await supabase
            .from('Contract')
            .select('Contract_Number, "Ad Type"')
            .in('Contract_Number', Array.from(contractNums));
          if (cData) {
            cData.forEach((c: any) => {
              const adType = c['Ad Type'] || '';
              if (adType) contractMap[Number(c.Contract_Number)] = adType;
            });
            setContractAdTypesMap(contractMap);
          }
        }

        // Attach contract ad_type to composite tasks
        Object.keys(fetchedCompositeInfo).forEach(id => {
          const cId = fetchedCompositeInfo[id].contract_id;
          if (cId && contractMap[cId]) {
            fetchedCompositeInfo[id].ad_type = contractMap[cId];
          }
        });
        setCompositeTasksInfoMap(fetchedCompositeInfo);

        // 3. Sales Invoices
        if (salesIds.size > 0) {
          const { data: sData } = await supabase
            .from('sales_invoices')
            .select('id, invoice_number, invoice_name')
            .in('id', Array.from(salesIds));
          if (sData) {
            const sMap: Record<string, { invoice_number?: string; invoice_name?: string }> = {};
            sData.forEach((s: any) => {
              sMap[s.id] = { invoice_number: s.invoice_number, invoice_name: s.invoice_name };
            });
            setSalesInvoicesMap(sMap);
          }
        }

        // 4. Printed Invoices
        if (printedIds.size > 0) {
          const { data: pData } = await supabase
            .from('printed_invoices')
            .select('id, invoice_number, invoice_type')
            .in('id', Array.from(printedIds));
          if (pData) {
            const pMap: Record<string, { invoice_number?: string; invoice_type?: string }> = {};
            pData.forEach((pi: any) => {
              pMap[pi.id] = { invoice_number: pi.invoice_number, invoice_type: pi.invoice_type };
            });
            setPrintedInvoicesMap(pMap);
          }
        }

        // 5. Purchase Invoices
        if (purchaseIds.size > 0) {
          const { data: purData } = await supabase
            .from('purchase_invoices')
            .select('id, invoice_number')
            .in('id', Array.from(purchaseIds));
          if (purData) {
            const purMap: Record<string, { invoice_number?: string }> = {};
            purData.forEach((pur: any) => {
              purMap[pur.id] = { invoice_number: pur.invoice_number };
            });
            setPurchaseInvoicesMap(purMap);
          }
        }
      } catch (err) {
        console.error('Error loading payment references:', err);
      }
    };
    loadAllPaymentReferences();
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

  // التوسيع التلقائي للدفعات الموزعة التي تحتوي على رصيد غير مستعمل/موزع لتنبيه المستخدم
  useEffect(() => {
    const unlinkedDistIds = new Set<string>();
    groupedPayments.forEach((distPayments, distId) => {
      if (distPayments.some(p => isUnlinkedPayment(p))) {
        unlinkedDistIds.add(distId);
      }
    });
    if (unlinkedDistIds.size > 0) {
      setExpandedDistributions(prev => {
        const next = new Set(prev);
        unlinkedDistIds.forEach(id => next.add(id));
        return next;
      });
    }
  }, [groupedPayments]);

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

  // ═══════════ العرض: قائمة موحّدة (دفعات موزعة + فردية) مع بحث وتصفية ═══════════
  const indexOf = useMemo(() => new Map(payments.map((p, i) => [p.id, i + 1])), [payments]);
  const infoOf = (p: PaymentRow) => getPaymentTargetInfo(p, contractAdTypesMap, compositeTasksInfoMap, printedInvoicesMap, salesInvoicesMap, purchaseInvoicesMap);
  const dateOf = (p?: PaymentRow) => new Date(p?.paid_at || p?.created_at || 0).getTime();

  type ListRecord =
    | { kind: 'group'; id: string; items: PaymentRow[]; first: PaymentRow; total: number; date: number; unlinked: boolean }
    | { kind: 'single'; id: string; p: PaymentRow; date: number; unlinked: boolean };

  const records = useMemo<ListRecord[]>(() => {
    const list: ListRecord[] = [];
    groupedPayments.forEach((items, id) => list.push({
      kind: 'group', id, items, first: items[0],
      total: items.reduce((s, p) => s + (Number(p.amount) || 0), 0),
      date: dateOf(items[0]),
      unlinked: items.some(p => isUnlinkedPayment(p)),
    }));
    individualPayments.forEach(p => list.push({ kind: 'single', id: p.id, p, date: dateOf(p), unlinked: isUnlinkedPayment(p) }));
    return list.sort((a, b) => b.date - a.date);
  }, [groupedPayments, individualPayments]); // eslint-disable-line react-hooks/exhaustive-deps

  const visibleRecords = useMemo(() => {
    const q = listQuery.trim().toLowerCase();
    return records.filter(r => {
      if (listFilter === 'distributed' && r.kind !== 'group') return false;
      if (listFilter === 'single' && r.kind !== 'single') return false;
      if (listFilter === 'unlinked' && !r.unlinked) return false;
      if (!q) return true;
      const rows = r.kind === 'group' ? r.items : [r.p];
      return rows.some(p => {
        const info = infoOf(p);
        return [info.badgeLabel, info.statement, p.notes, p.reference, p.method, String(p.amount ?? ''), String(p.contract_number ?? '')]
          .some(v => String(v || '').toLowerCase().includes(q));
      });
    });
  }, [records, listQuery, listFilter, contractAdTypesMap, compositeTasksInfoMap, printedInvoicesMap, salesInvoicesMap, purchaseInvoicesMap]); // eslint-disable-line react-hooks/exhaustive-deps

  const unlinkedCount = records.filter(r => r.unlinked).length;
  const groupCount = records.filter(r => r.kind === 'group').length;

  const groupLabels = (items: PaymentRow[], distributionId: string) => {
    const firstPayment = items[0];
    const hasPurchaseInvoice = items.some(p => p.purchase_invoice_id || p.notes?.includes('مشتريات') || p.notes?.includes('PUR-'));
    const isBarter = items.some(p => p.method === 'مقايضة');
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
        const matchedRental = friendRentals.find(r => r.billboards?.Billboard_Name?.trim() === billboardNameInNotes || r.billboard_id === billboardNameInNotes);
        if (matchedRental) friendContractNum = matchedRental.contract_number;
      }
    }
    if (friendContractNum) {
      const linkedContract = contracts.find(c => Number(c.Contract_Number) === friendContractNum);
      friendAdType = linkedContract ? (linkedContract['Ad Type'] || linkedContract.ad_type || null) : (friendContractsMap[friendContractNum] || null);
    }
    let purchaseNotes = '';
    if (hasPurchaseInvoice) {
      const linkedPurId = items.find(p => p.purchase_invoice_id)?.purchase_invoice_id;
      const purCode = notesText.match(/PUR-\d+/)?.[0] || null;
      purchaseNotes = (linkedPurId ? purchaseInvoiceNotes[linkedPurId] : null) || (purCode ? purchaseInvoiceNotes[purCode] : null) || '';
    }
    const adTypeSuffix = friendAdType ? ` - ${friendAdType}` : '';
    const barterLabel = hasPurchaseInvoice
      ? `مقايضة - ${purchaseNotes || 'فاتورة مشتريات'}`
      : friendContractNum ? `مقايضة - إيجار لوحة عقد #${friendContractNum}${adTypeSuffix}` : 'مقايضة - إيجار لوحة';
    return {
      isBarter, barterLabel,
      custody: paymentsInCustody.has(distributionId) ? (custodyEmployeeNames[distributionId] || 'غير محدد') : null,
      withdrawal: paymentsWithWithdrawal.has(distributionId) ? (withdrawalEmployeeNames[distributionId] || 'غير محدد') : null,
    };
  };

  const Collection = ({ p }: { p: PaymentRow }) => (!showCollectionDetails || !p.collected_via_intermediary) ? null : (
    <div className="flex flex-wrap gap-x-3 text-[11px] text-muted-foreground">
      {(Number(p.intermediary_commission) || 0) > 0 && <span>عمولة وسيط <b className="text-destructive">{fmtMoney(Number(p.intermediary_commission))}</b></span>}
      {(Number(p.transfer_fee) || 0) > 0 && <span>عمولة تحويل <b className="text-destructive">{fmtMoney(Number(p.transfer_fee))}</b></span>}
      {p.net_amount ? <span>الصافي <b className="text-foreground">{fmtMoney(Number(p.net_amount))}</b></span> : null}
    </div>
  );

  const Meta = ({ p, statement }: { p: PaymentRow; statement?: string }) => {
    const parts = [p.method, p.reference ? `مرجع: ${p.reference}` : '', p.notes && p.notes !== statement ? p.notes : ''].filter(Boolean);
    return parts.length ? <div className="truncate text-xs text-muted-foreground" title={parts.join(' · ')}>{parts.join(' · ')}</div> : null;
  };

  const IconBtn = ({ title, onClick, children, tone }: { title: string; onClick: (e: React.MouseEvent) => void; children: React.ReactNode; tone?: 'danger' | 'warn' }) => (
    <Button type="button" size="icon" variant="ghost" title={title} aria-label={title} onClick={onClick}
      className={cn('h-8 w-8 text-muted-foreground hover:text-foreground', tone === 'danger' && 'hover:bg-destructive/10 hover:text-destructive', tone === 'warn' && 'text-amber-600 hover:bg-amber-500/10 hover:text-amber-700')}>
      {children}
    </Button>
  );

  const IndexDate = ({ n, p }: { n: number | string; p?: PaymentRow }) => (
    <div className="flex w-16 shrink-0 flex-col items-center gap-1 text-center">
      <span className="inline-flex h-7 min-w-[2rem] items-center justify-center rounded-md bg-muted px-2 text-xs font-bold tabular-nums">{n}</span>
      <span className="text-[11px] tabular-nums text-muted-foreground">{fmtDate(p?.paid_at)}</span>
    </div>
  );

  const Remaining = ({ p }: { p: PaymentRow }) => {
    const rem = Number((p as any).remaining_debt) || 0;
    return <div className={cn('text-[11px] tabular-nums', rem > 0 ? 'text-destructive' : 'text-emerald-600 dark:text-emerald-400')}>المتبقي بعدها {fmtMoney(rem)}</div>;
  };

  return (
    <>
      <div id="payments-section" className="mb-6 space-y-4" dir="rtl">
        {/* ── الديون السابقة ── */}
        {previousDebts.length > 0 && (
          <Card className="overflow-hidden border-rose-500/30">
            <div className="flex items-center justify-between gap-3 border-b border-rose-500/20 bg-rose-500/5 px-4 py-3">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-rose-600 dark:text-rose-400" />
                <span className="font-bold text-rose-700 dark:text-rose-400">الديون السابقة</span>
                <Badge variant="outline" className="text-xs">{previousDebts.length}</Badge>
              </div>
              <span className="font-bold tabular-nums text-rose-700 dark:text-rose-400">{fmtMoney(previousDebts.reduce((s, d) => s + (Number(d.amount) || 0), 0))}</span>
            </div>
            <div className="divide-y divide-border">
              {previousDebts.map(debt => (
                <div key={debt.id} id={`payment-${debt.id}`} className="flex flex-wrap items-center gap-3 px-4 py-2.5 transition-colors hover:bg-rose-500/5">
                  <IndexDate n={debt.contract_number ? `#${debt.contract_number}` : '—'} p={debt} />
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{debt.contract_number ? `عقد #${debt.contract_number}` : 'دين عام'}</div>
                    {debt.notes && <div className="truncate text-xs text-muted-foreground">{debt.notes}</div>}
                  </div>
                  <span className="font-bold tabular-nums text-rose-700 dark:text-rose-400">{fmtMoney(Number(debt.amount))}</span>
                  <div className="flex items-center gap-0.5">
                    <Button size="sm" className="h-8 bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => { if (window.confirm('هل تريد تسديد هذا الدين؟')) onEditReceipt(debt); }}>تسديد</Button>
                    <IconBtn title="تعديل" onClick={() => onEditReceipt(debt)}><Edit className="h-4 w-4" /></IconBtn>
                    <IconBtn title="حذف" tone="danger" onClick={() => onDeleteReceipt(debt.id)}><Trash2 className="h-4 w-4" /></IconBtn>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Card className="overflow-hidden">
          {/* ── الرأس ── */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10"><CreditCard className="h-5 w-5 text-primary" /></div>
              <div>
                <div className="font-bold">الدفعات والإيصالات</div>
                <div className="text-xs text-muted-foreground">{records.length} سجل{groupCount ? ` · ${groupCount} دفعة موزعة` : ''}</div>
              </div>
            </div>
            <Button size="sm" onClick={onAddAccountPayment} className="h-9 gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700">
              <Plus className="h-4 w-4" />دفعة على الحساب
            </Button>
          </div>

          <CardContent className="space-y-3 p-4">
            {payments.length > 0 && (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {[
                  { label: 'إجمالي المقبوضات', value: summaryStats.receipts, icon: Coins, cls: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-500/10' },
                  { label: 'إجمالي الديون السابقة', value: summaryStats.debts, icon: DollarSign, cls: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-500/10' },
                  { label: 'إجمالي الصادرات والمسترد', value: summaryStats.credits, icon: Wallet, cls: 'text-rose-600 dark:text-rose-400', bg: 'bg-rose-500/10' },
                ].map(s => (
                  <div key={s.label} className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-3 py-2.5">
                    <div>
                      <div className="text-[11px] font-semibold text-muted-foreground">{s.label}</div>
                      <div className={cn('text-lg font-black tabular-nums', s.cls)}>{fmtMoney(s.value)}</div>
                    </div>
                    <div className={cn('rounded-lg p-2', s.bg, s.cls)}><s.icon className="h-4 w-4" /></div>
                  </div>
                ))}
              </div>
            )}

            {unlinkedCount > 0 && (
              <button type="button" onClick={() => setListFilter('unlinked')}
                className="flex w-full items-center gap-2 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-right text-sm text-rose-700 transition-colors hover:bg-rose-500/15 dark:text-rose-300">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span className="flex-1"><b>{unlinkedCount}</b> سجل فيه رصيد غير موزع على عقود أو فواتير — يحتاج توزيع</span>
                <span className="text-xs underline">عرضها</span>
              </button>
            )}

            {/* ── البحث والتصفية ── */}
            {records.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-[200px] flex-1">
                  <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={listQuery} onChange={e => setListQuery(e.target.value)} placeholder="بحث بالعقد، الفاتورة، المرجع، الملاحظة أو المبلغ" className="h-9 pr-9" aria-label="بحث في الدفعات" />
                </div>
                <div role="radiogroup" aria-label="تصفية الدفعات" className="flex gap-1 rounded-lg border border-border bg-muted/30 p-1">
                  {([['all', 'الكل', records.length], ['single', 'فردية', records.length - groupCount], ['distributed', 'موزعة', groupCount], ['unlinked', 'غير موزع', unlinkedCount]] as const).map(([k, l, n]) => (
                    <button key={k} type="button" role="radio" aria-checked={listFilter === k} onClick={() => setListFilter(k)}
                      className={cn('h-7 rounded-md px-2.5 text-xs font-semibold transition-colors', listFilter === k ? 'bg-card shadow-sm ring-1 ring-primary/40' : 'text-muted-foreground hover:text-foreground')}>
                      {l} <span className="tabular-nums opacity-70">{n}</span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── القائمة ── */}
            {!payments.length ? (
              <div className="rounded-xl border border-dashed border-border py-10 text-center text-sm text-muted-foreground">لا توجد دفعات</div>
            ) : !visibleRecords.length ? (
              <div className="rounded-xl border border-dashed border-border py-8 text-center text-sm text-muted-foreground">لا توجد نتائج مطابقة</div>
            ) : (
              <div className="divide-y divide-border overflow-hidden rounded-xl border border-border">
                {visibleRecords.map(r => {
                  if (r.kind === 'single') {
                    const p = r.p;
                    const info = infoOf(p);
                    const isDebit = p.entry_type === 'general_credit';
                    return (
                      <div key={p.id} id={`payment-${p.id}`}
                        className={cn('flex flex-wrap items-start gap-3 px-3 py-3 transition-colors hover:bg-muted/30 sm:flex-nowrap sm:items-center', r.unlinked && 'border-r-4 border-r-rose-500 bg-rose-500/5')}>
                        <IndexDate n={indexOf.get(p.id) ?? '—'} p={p} />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="rounded bg-muted px-1.5 py-0.5 text-[11px] font-semibold text-muted-foreground">{getPaymentTypeText(p.entry_type)}</span>
                            <span className={cn('rounded-md border px-2 py-0.5 text-xs font-bold', toneOf(info.type))}>{info.badgeLabel}</span>
                            {r.unlinked && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[11px] font-bold text-rose-700 dark:text-rose-300">
                                <AlertTriangle className="h-3 w-3" />غير موزع
                              </span>
                            )}
                          </div>
                          <div className="truncate text-sm" title={info.statement}>{info.statement}</div>
                          <Meta p={p} statement={info.statement} />
                          <Collection p={p} />
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1 text-left">
                          <div className={cn('text-lg font-black tabular-nums', isDebit ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400')}>{isDebit ? '−' : ''}{fmtMoney(Number(p.amount))}</div>
                          <Remaining p={p} />
                          <div className="flex items-center gap-0.5">
                            {r.unlinked && onDistributePayment && (
                              <Button size="sm" className="h-8 gap-1 bg-rose-600 text-white hover:bg-rose-700" onClick={() => onDistributePayment(p)}>
                                <ArrowRightLeft className="h-3.5 w-3.5" />توزيع
                              </Button>
                            )}
                            <IconBtn title="طباعة إيصال" onClick={() => onPrintReceipt(p)}><Printer className="h-4 w-4" /></IconBtn>
                            {onSendReceipt && <IconBtn title="إرسال" onClick={() => onSendReceipt(p)}><Send className="h-4 w-4" /></IconBtn>}
                            <IconBtn title="تعديل" onClick={() => onEditReceipt(p)}><Edit className="h-4 w-4" /></IconBtn>
                            {r.unlinked && contracts.length > 0 && <IconBtn title="ربط بعقد" tone="warn" onClick={() => openLinkDialog(p)}><Link2 className="h-4 w-4" /></IconBtn>}
                            <IconBtn title="حذف" tone="danger" onClick={() => onDeleteReceipt(p.id)}><Trash2 className="h-4 w-4" /></IconBtn>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  const { id: distributionId, items, first, total } = r;
                  const isExpanded = expandedDistributions.has(distributionId);
                  const meta = groupLabels(items, distributionId);
                  const unlinkedSum = items.filter(p => isUnlinkedPayment(p)).reduce((s, p) => s + (Number(p.amount) || 0), 0);
                  return (
                    <div key={distributionId} id={`distribution-${distributionId}`} className={cn(r.unlinked && 'border-r-4 border-r-rose-500')}>
                      <div role="button" tabIndex={0} aria-expanded={isExpanded}
                        onClick={() => toggleDistribution(distributionId)}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleDistribution(distributionId); } }}
                        className={cn('flex cursor-pointer flex-wrap items-start gap-3 px-3 py-3 transition-colors hover:bg-muted/30 sm:flex-nowrap sm:items-center',
                          r.unlinked ? 'bg-rose-500/5' : meta.custody ? 'bg-amber-500/5' : meta.withdrawal ? 'bg-blue-500/5' : 'bg-primary/[0.03]')}>
                        <IndexDate n={indexOf.get(first.id) ?? '—'} p={first} />
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                            <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-bold text-primary">دفعة موزعة · {items.length} بنود</span>
                            {items.slice(0, 4).map(p => {
                              const info = infoOf(p);
                              return <span key={p.id} className={cn('rounded-md border px-2 py-0.5 text-[11px] font-bold', toneOf(info.type))}>{info.badgeLabel}</span>;
                            })}
                            {items.length > 4 && <span className="text-[11px] text-muted-foreground">+{items.length - 4}</span>}
                          </div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            {r.unlinked && (
                              <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/15 px-1.5 py-0.5 text-[11px] font-bold text-rose-700 dark:text-rose-300">
                                <AlertTriangle className="h-3 w-3" />رصيد غير موزع {fmtMoney(unlinkedSum)}
                              </span>
                            )}
                            {meta.isBarter && <span className="inline-flex items-center gap-1 rounded-md border border-purple-500/30 bg-purple-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-purple-700 dark:text-purple-300"><Link2 className="h-3 w-3" />{meta.barterLabel}</span>}
                            {meta.custody && <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-700 dark:text-amber-300"><Wallet className="h-3 w-3" />عهدة: {meta.custody}</span>}
                            {meta.withdrawal && <span className="inline-flex items-center gap-1 rounded-md border border-blue-500/30 bg-blue-500/10 px-1.5 py-0.5 text-[11px] text-blue-700 dark:text-blue-300"><Wallet className="h-3 w-3" />دفع لموظف: {meta.withdrawal}</span>}
                          </div>
                          <Meta p={first} />
                          <Collection p={first} />
                        </div>
                        <div className="flex shrink-0 flex-col items-end gap-1 text-left">
                          <div className="text-lg font-black tabular-nums text-emerald-600 dark:text-emerald-400">{fmtMoney(total)}</div>
                          <Remaining p={first} />
                          <Button size="sm" variant="outline" className="h-8" onClick={e => { e.stopPropagation(); handleShowDetails(items); }}>التفاصيل</Button>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="divide-y divide-border/60 border-t border-border/60 bg-muted/20">
                          {items.map(p => {
                            const info = infoOf(p);
                            const unlinked = isUnlinkedPayment(p);
                            return (
                              <div key={p.id} id={`payment-${p.id}`} className={cn('flex flex-wrap items-center gap-3 py-2 pl-3 pr-8 sm:flex-nowrap', unlinked && 'bg-rose-500/5')}>
                                <span className="inline-flex h-6 min-w-[1.75rem] items-center justify-center rounded bg-background px-1.5 text-[11px] font-bold tabular-nums ring-1 ring-border">{indexOf.get(p.id) ?? '—'}</span>
                                <div className="min-w-0 flex-1">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className={cn('rounded-md border px-2 py-0.5 text-[11px] font-bold', toneOf(info.type))}>{info.badgeLabel}</span>
                                    {unlinked && <span className="text-[11px] font-bold text-rose-700 dark:text-rose-300">غير موزع</span>}
                                  </div>
                                  <div className="truncate text-xs text-muted-foreground" title={info.statement}>{info.statement}{p.notes && p.notes !== info.statement ? ` · ${p.notes}` : ''}</div>
                                </div>
                                <span className={cn('shrink-0 font-bold tabular-nums', unlinked ? 'text-rose-600 dark:text-rose-400' : 'text-foreground')}>{fmtMoney(Number(p.amount))}</span>
                                <div className="flex shrink-0 items-center gap-0.5">
                                  {unlinked && onEditDistributedPayment && p.distributed_payment_id && (
                                    <Button size="sm" className="h-7 gap-1 bg-rose-600 text-xs text-white hover:bg-rose-700" onClick={() => onEditDistributedPayment(p.distributed_payment_id as string, items)}>
                                      <ArrowRightLeft className="h-3 w-3" />توزيع الفائض
                                    </Button>
                                  )}
                                  <IconBtn title="طباعة" onClick={() => onPrintReceipt(p)}><Printer className="h-4 w-4" /></IconBtn>
                                  {onSendReceipt && <IconBtn title="إرسال" onClick={() => onSendReceipt(p)}><Send className="h-4 w-4" /></IconBtn>}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
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
              setDetailsDialogOpen(false);
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
