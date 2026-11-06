import { usePersistedState } from '@/hooks/usePersistedState';
import { useAuth } from '@/contexts/AuthContext';
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Receipt, Search, CreditCard, TrendingUp, TrendingDown, Plus, ChevronDown, ChevronRight, Printer, Edit, Wallet, User, AlertCircle, Filter, Send, RefreshCw } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { EnhancedDistributePaymentDialog } from '@/components/billing/EnhancedDistributePaymentDialog';
import { DistributedPaymentDetailsDialog } from '@/components/billing/DistributedPaymentDetailsDialog';
import { PaymentsStatementPrintDialog } from '@/components/billing/PaymentsStatementPrintDialog';
import { SendPaymentsReportDialog } from '@/components/billing/SendPaymentsReportDialog';
import { useUnifiedReceiptPrint } from '@/components/billing/UnifiedReceiptPrint';
import { printDistributedUnifiedReceipt } from '@/components/billing/distributedReceiptPrint';

import { calculateTotalRemainingDebt, filterCompositeRelatedPrintedInvoices } from '@/components/billing/BillingUtils';
import './PaymentsReceiptsPage.css';

interface Payment {
  id: string;
  customer_id: string;
  customer_name: string;
  company_name?: string | null;
  amount: number;
  paid_at: string;
  method: string;
  reference: string;
  notes: string;
  entry_type: string;
  contract_number: number | null;
  distributed_payment_id: string | null;
  created_at: string;
  collector_name: string | null;
  receiver_name: string | null;
  intermediary_commission: number | null;
  collected_via_intermediary: boolean;
  balance_after: number;
  remaining_debt: number;
  purchase_invoice_id?: string | null;
  printed_invoice_id?: string | null;
  ad_type?: string | null;
}

interface CustodyInfo {
  custody_id: string;
  employee_name: string;
  initial_amount: number;
  current_balance: number;
}

interface GroupedPayment {
  id: string;
  distributedPaymentId: string;
  totalAmount: number;
  customerName: string;
  companyName?: string | null;
  customerId: string;
  method: string;
  paidAt: string;
  distributions: Payment[];
  custodyInfo?: CustodyInfo | null;
}

export default function PaymentsReceiptsPage() {
  const { canEdit: canEditAuth } = useAuth();
  const canEditSection = canEditAuth('payments');
  const navigate = useNavigate();
  const { print: printReceipt } = useUnifiedReceiptPrint();
  const [payments, setPayments] = useState<Payment[]>([]);
  const [contractTotals, setContractTotals] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = usePersistedState('paymentsReceiptsPage.searchTerm', '');
  const [adTypeFilter, setAdTypeFilter] = usePersistedState<string>('paymentsReceiptsPage.adTypeFilter', 'all');
  const [adTypeSearch, setAdTypeSearch] = useState('');
  const [distributeDialogOpen, setDistributeDialogOpen] = useState(false);
  const [customerSelectDialogOpen, setCustomerSelectDialogOpen] = useState(false);
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('');
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [stats, setStats] = useState({
    totalPayments: 0,
    totalReceipts: 0,
    totalCredits: 0,
    totalDebits: 0
  });
  const [showCollectionDetails, setShowCollectionDetails] = usePersistedState('paymentsReceiptsPage.showCollectionDetails', false);
  const [isPrinting, setIsPrinting] = useState(false);
  const [distributedPaymentDialogOpen, setDistributedPaymentDialogOpen] = useState(false);
  const [selectedDistributedPayments, setSelectedDistributedPayments] = useState<Payment[]>([]);
  const [statementPrintDialogOpen, setStatementPrintDialogOpen] = useState(false);
  const [reportDialogOpen, setReportDialogOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());
  const [custodyDataMap, setCustodyDataMap] = useState<Record<string, CustodyInfo>>({});
  const distributeOpenFrameRef = useRef<number | null>(null);
  const [pendingDistributeOpen, setPendingDistributeOpen] = useState(false);
  
  // ✅ حالة تعديل الدفعة الموزعة
  const [editingDistributedPaymentId, setEditingDistributedPaymentId] = useState<string | null>(null);
  const [editingDistributedPayments, setEditingDistributedPayments] = useState<Payment[]>([]);
  
  const [friendRentals, setFriendRentals] = useState<any[]>([]);
  const [friendContractsMap, setFriendContractsMap] = useState<Record<number, string>>({});
  const [purchaseInvoiceNotes, setPurchaseInvoiceNotes] = useState<Record<string, string>>({});

  useEffect(() => {
    loadPayments();
  }, []);

  useEffect(() => {
    return () => {
      if (distributeOpenFrameRef.current !== null) {
        window.cancelAnimationFrame(distributeOpenFrameRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!pendingDistributeOpen || customerSelectDialogOpen || !selectedCustomerId) return;

    if (distributeOpenFrameRef.current !== null) {
      window.cancelAnimationFrame(distributeOpenFrameRef.current);
    }

    const firstFrame = window.requestAnimationFrame(() => {
      const secondFrame = window.requestAnimationFrame(() => {
        document.body.style.pointerEvents = '';
        setDistributeDialogOpen(true);
        setPendingDistributeOpen(false);
        distributeOpenFrameRef.current = null;
      });
      distributeOpenFrameRef.current = secondFrame;
    });

    distributeOpenFrameRef.current = firstFrame;
  }, [pendingDistributeOpen, customerSelectDialogOpen, selectedCustomerId]);

  const fetchAllFinancialData = async () => {
    try {
      const [contractsResult, salesInvoicesResult, printedInvoicesResult, purchaseInvoicesResult, discountsResult, compositeTasksResult, printTasksResult, cutoutTasksResult] = await Promise.all([
        supabase.from('Contract').select('Contract_Number, customer_id, Total, "Customer Name", friend_rental_data'),
        supabase.from('sales_invoices').select('customer_id, total_amount'),
        supabase.from('printed_invoices').select('id, customer_id, total_amount, included_in_contract'),
        supabase.from('purchase_invoices').select('customer_id, total_amount, used_as_payment'),
        supabase.from('customer_general_discounts').select('customer_id, discount_value, status').eq('status', 'active'),
        supabase.from('composite_tasks').select('customer_id, customer_total, combined_invoice_id'),
        supabase.from('print_tasks').select('id, customer_id, invoice_id, is_composite, installation_task_id, composite_task_id'),
        supabase.from('cutout_tasks' as any).select('id, customer_id, invoice_id, is_composite, installation_task_id'),
      ]);

      setContractTotals(Object.fromEntries((contractsResult.data || []).map((c: any) => [Number(c.Contract_Number), Number(c.Total) || 0])));
      return {
        contracts: contractsResult.data || [],
        salesInvoices: salesInvoicesResult.data || [],
        printedInvoices: printedInvoicesResult.data || [],
        purchaseInvoices: purchaseInvoicesResult.data || [],
        discounts: discountsResult.data || [],
        compositeTasks: compositeTasksResult.data || [],
        printTasks: printTasksResult.data || [],
        cutoutTasks: cutoutTasksResult.data || [],
      };
    } catch (error) {
      console.error('خطأ في جلب البيانات المالية:', error);
      return { 
        contracts: [], 
        salesInvoices: [], 
        printedInvoices: [], 
        purchaseInvoices: [], 
        discounts: [], 
        compositeTasks: [],
        printTasks: [],
        cutoutTasks: []
      };
    }
  };

  // ✅ جلب بيانات العهد المرتبطة بالدفعات الموزعة
  const loadCustodyData = async (distributedPaymentIds: string[]) => {
    if (distributedPaymentIds.length === 0) return {};
    
    try {
      const { data: custodyData } = await supabase
        .from('custody_accounts')
        .select(`
          id,
          source_payment_id,
          initial_amount,
          current_balance,
          employee_id,
          employees(name)
        `)
        .in('source_payment_id', distributedPaymentIds);

      const custodyMap: Record<string, CustodyInfo> = {};
      if (custodyData) {
        custodyData.forEach((custody: any) => {
          if (custody.source_payment_id) {
            custodyMap[custody.source_payment_id] = {
              custody_id: custody.id,
              employee_name: custody.employees?.name || 'غير معروف',
              initial_amount: custody.initial_amount || 0,
              current_balance: custody.current_balance || 0,
            };
          }
        });
      }
      return custodyMap;
    } catch (error) {
      console.error('خطأ في جلب بيانات العهد:', error);
      return {};
    }
  };

  const loadPayments = async () => {
    try {
      setLoading(true);
      
      const { data: paymentsData, error: paymentsError } = await supabase
        .from('customer_payments')
        .select('*')
        .order('paid_at', { ascending: false });

      if (paymentsError) throw paymentsError;

      // Load friend rentals and purchase invoices
      const [rentalsRes, purchaseInvoicesRes] = await Promise.all([
        supabase.from('friend_billboard_rentals').select('contract_number, billboard_id, billboards(Billboard_Name)'),
        supabase.from('purchase_invoices').select('id, invoice_code, notes')
      ]);

      if (rentalsRes.data) {
        setFriendRentals(rentalsRes.data);
      }

      if (purchaseInvoicesRes.data) {
        const pNotes: Record<string, string> = {};
        purchaseInvoicesRes.data.forEach((p: any) => {
          if (p.notes) {
            pNotes[p.id] = p.notes;
            if (p.invoice_code) {
              pNotes[p.invoice_code] = p.notes;
            }
          }
        });
        setPurchaseInvoiceNotes(pNotes);
      }

      const { data: contractsAdTypes } = await supabase
        .from('Contract')
        .select('Contract_Number, "Ad Type"');
      
      const adTypeMap: Record<number, string> = {};
      (contractsAdTypes || []).forEach((c: any) => {
        if (c.Contract_Number && c['Ad Type']) {
          adTypeMap[c.Contract_Number] = c['Ad Type'];
        }
      });
      setFriendContractsMap(adTypeMap);

      const { data: customersData } = await supabase
        .from('customers')
        .select('id, name, company');
      
      const customerCompanyMap: Record<string, string> = {};
      (customersData || []).forEach((c: any) => {
        if (c.id && c.company) {
          customerCompanyMap[c.id] = c.company;
        }
      });

      const { data: existingPurchaseInvoices } = await supabase
        .from('purchase_invoices')
        .select('id, customer_name, customer_id, invoice_name');
      
      const existingPurchaseInvoiceIds = new Set(existingPurchaseInvoices?.map(inv => inv.id) || []);
      const purchaseInvoiceCustomerMap: Record<string, string> = {};
      (existingPurchaseInvoices || []).forEach((inv: any) => {
        if (inv.id) {
          purchaseInvoiceCustomerMap[inv.id] = inv.invoice_name || inv.customer_name || 'مورد';
        }
      });

      const { data: existingPrintedInvoices } = await supabase
        .from('printed_invoices')
        .select('id, printer_name, customer_name');
      
      const existingPrintedInvoiceIds = new Set(existingPrintedInvoices?.map(inv => inv.id) || []);
      const printedInvoiceMap: Record<string, { printer: string; customer: string }> = {};
      (existingPrintedInvoices || []).forEach((inv: any) => {
        if (inv.id) {
          printedInvoiceMap[inv.id] = {
            printer: inv.printer_name || '',
            customer: inv.customer_name || ''
          };
        }
      });
      
      // جلب أنواع الإعلانات للمهام المجمعة وفواتير المبيعات
      const compositeIds = [...new Set((paymentsData || []).filter(p => (p as any).composite_task_id).map(p => (p as any).composite_task_id as string))];
      const compositeAdTypesMap: Record<string, string> = {};
      if (compositeIds.length > 0) {
        const { data: ctData } = await supabase
          .from('composite_tasks')
          .select('id, contract_id')
          .in('id', compositeIds);
        if (ctData) {
          ctData.forEach((ct: any) => {
            const cNum = Number(ct.contract_id);
            if (cNum && adTypeMap[cNum]) {
              compositeAdTypesMap[ct.id] = adTypeMap[cNum];
            }
          });
        }
      }

      const filteredPaymentsData = (paymentsData || []).filter(payment => {
        if (payment.entry_type === 'purchase_invoice' && payment.purchase_invoice_id) {
          return existingPurchaseInvoiceIds.has(payment.purchase_invoice_id);
        }
        if (payment.printed_invoice_id) {
          return existingPrintedInvoiceIds.has(payment.printed_invoice_id);
        }
        return true;
      }).map(payment => {
        let customerName = payment.customer_name;
        let companyName = customerCompanyMap[payment.customer_id] || null;
        
        if (payment.entry_type === 'purchase_invoice' && payment.purchase_invoice_id) {
          const supplierInfo = purchaseInvoiceCustomerMap[payment.purchase_invoice_id];
          if (supplierInfo) {
            customerName = `${payment.customer_name || ''} ← ${supplierInfo}`;
          }
        }
        
        if (payment.printed_invoice_id) {
          const printInfo = printedInvoiceMap[payment.printed_invoice_id];
          if (printInfo?.printer) {
            const printerLabel = `مطبعة: ${printInfo.printer}`;
            companyName = companyName ? `${companyName} | ${printerLabel}` : printerLabel;
          }
        }

        const compId = (payment as any).composite_task_id;
        const resolvedAdType = payment.contract_number 
          ? adTypeMap[payment.contract_number] 
          : (compId && compositeAdTypesMap[compId] ? compositeAdTypesMap[compId] : null);
        
        return {
          ...payment,
          customer_name: customerName,
          company_name: companyName,
          ad_type: resolvedAdType
        };
      });

      const distributedPaymentIds = [...new Set(filteredPaymentsData.filter(p => p.distributed_payment_id).map(p => p.distributed_payment_id as string))];
      const custodyMap = await loadCustodyData(distributedPaymentIds);
      setCustodyDataMap(custodyMap);

      const financialData = await fetchAllFinancialData();
      const paymentsWithBalance = calculateBalances(
        filteredPaymentsData, 
        financialData.contracts,
        financialData.salesInvoices,
        financialData.printedInvoices,
        financialData.purchaseInvoices,
        financialData.discounts,
        financialData.compositeTasks,
        (financialData as any).printTasks || [],
        (financialData as any).cutoutTasks || []
      );
      setPayments(paymentsWithBalance);
      calculateStats(paymentsWithBalance);
    } catch (error: any) {
      console.error('خطأ في تحميل الدفعات:', error);
      toast.error(`فشل في تحميل الدفعات والإيصالات`);
    } finally {
      setLoading(false);
    }
  };

  const calculateBalances = (
    payments: any[], 
    contracts: any[],
    salesInvoices: any[],
    printedInvoices: any[],
    purchaseInvoices: any[],
    discounts: any[],
    compositeTasks: any[] = [],
    printTasks: any[] = [],
    cutoutTasks: any[] = []
  ): Payment[] => {
    const customerDiscounts: Record<string, number> = {};
    discounts.forEach(discount => {
      if (!customerDiscounts[discount.customer_id]) customerDiscounts[discount.customer_id] = 0;
      customerDiscounts[discount.customer_id] += Number(discount.discount_value) || 0;
    });

    const customerFriendRentals: Record<string, number> = {};
    (contracts || []).forEach((c: any) => {
      const cid = c.customer_id;
      if (!cid) return;
      const fr = c.friend_rental_data;
      if (fr && typeof fr === 'object') {
        const entries = Object.values(fr) as any[];
        for (const entry of entries) {
          if (entry && typeof entry.rental_cost === 'number') {
            customerFriendRentals[cid] = (customerFriendRentals[cid] || 0) + entry.rental_cost;
          }
        }
      }
    });

    const byCustomer: Record<string, any[]> = {};
    payments.forEach(p => {
      const cid = p.customer_id || '__none__';
      if (!byCustomer[cid]) byCustomer[cid] = [];
      byCustomer[cid].push(p);
    });

    const remainingByPaymentId: Record<string, number> = {};
    const balanceAfterByPaymentId: Record<string, number> = {};

    Object.keys(byCustomer).forEach((cid) => {
      const cPayments = [...byCustomer[cid]].sort((a, b) => {
        const ta = new Date(a.paid_at || 0).getTime();
        const tb = new Date(b.paid_at || 0).getTime();
        if (ta !== tb) return ta - tb;
        return (a.id || '').localeCompare(b.id || '');
      });
      const customerContracts = contracts.filter(c => c.customer_id === cid);
      const customerSalesInvoices = salesInvoices.filter(inv => inv.customer_id === cid);
      const rawCustomerPrintedInvoices = printedInvoices.filter(inv => inv.customer_id === cid);
      const customerPurchaseInvoices = purchaseInvoices.filter(inv => inv.customer_id === cid);
      const customerCompositeTasks = compositeTasks.filter(t => t.customer_id === cid);
      const customerPrintTasks = printTasks.filter(t => t.customer_id === cid);
      const customerCutoutTasks = cutoutTasks.filter(t => t.customer_id === cid);
      const totalDiscounts = customerDiscounts[cid] || 0;
      const friendRentals = customerFriendRentals[cid] || 0;

      const customerPrintedInvoices = filterCompositeRelatedPrintedInvoices(
        rawCustomerPrintedInvoices,
        customerCompositeTasks,
        customerPrintTasks,
        customerCutoutTasks
      );

      let runningBalance = 0;
      for (let i = 0; i < cPayments.length; i++) {
        const p = cPayments[i];
        if (['receipt', 'payment', 'account_payment', 'general_credit'].includes(p.entry_type)) {
          runningBalance += Number(p.amount) || 0;
        } else if (['debt', 'general_debit'].includes(p.entry_type)) {
          runningBalance -= Number(p.amount) || 0;
        }
        balanceAfterByPaymentId[p.id] = runningBalance;

        const paymentsUpToHere = cPayments.slice(0, i + 1);
        const remaining = calculateTotalRemainingDebt(
          customerContracts,
          paymentsUpToHere,
          customerSalesInvoices,
          customerPrintedInvoices,
          customerPurchaseInvoices,
          totalDiscounts,
          customerCompositeTasks,
          friendRentals
        );
        remainingByPaymentId[p.id] = Math.max(0, remaining);
      }
    });

    return payments.map(payment => ({
      ...payment,
      balance_after: balanceAfterByPaymentId[payment.id] ?? 0,
      remaining_debt: remainingByPaymentId[payment.id] ?? 0,
    }));
  };

  const calculateStats = (data: Payment[]) => {
    const receipts = data.filter(p => ['receipt', 'payment', 'account_payment'].includes(p.entry_type));
    const debits = data.filter(p => ['debt', 'general_debit'].includes(p.entry_type));
    setStats({
      totalPayments: data.length,
      totalReceipts: receipts.length,
      totalCredits: receipts.reduce((sum, p) => sum + (Number(p.amount) || 0), 0),
      totalDebits: debits.reduce((sum, p) => sum + (Number(p.amount) || 0), 0)
    });
  };

  const uniqueAdTypes = useMemo(() => {
    const types = new Set<string>();
    payments.forEach(p => { if (p.ad_type) types.add(p.ad_type); });
    return Array.from(types).sort();
  }, [payments]);

  const filteredPayments = useMemo(() => {
    const matchingGroupIds = new Set<string>();
    if (adTypeFilter !== 'all') {
      payments.forEach(p => {
        if (p.distributed_payment_id && p.ad_type === adTypeFilter) {
          matchingGroupIds.add(p.distributed_payment_id);
        }
      });
    }

    return payments.filter(payment => {
      const matchesSearch = 
        payment.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.reference?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.notes?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        payment.contract_number?.toString().includes(searchTerm);
      
      let matchesAdType: boolean;
      if (adTypeFilter === 'all') {
        matchesAdType = true;
      } else if (payment.distributed_payment_id) {
        matchesAdType = matchingGroupIds.has(payment.distributed_payment_id);
      } else {
        matchesAdType = payment.ad_type === adTypeFilter;
      }
      
      return matchesSearch && matchesAdType;
    });
  }, [payments, searchTerm, adTypeFilter]);

  const { groupedPayments, standalonePayments } = useMemo(() => {
    const groups: Record<string, GroupedPayment> = {};
    const standalone: Payment[] = [];
    
    filteredPayments.forEach(payment => {
      if (payment.distributed_payment_id) {
        const groupId = payment.distributed_payment_id;
        if (!groups[groupId]) {
          const custodyInfo = custodyDataMap[groupId] || null;
          
          groups[groupId] = {
            id: groupId,
            distributedPaymentId: groupId,
            totalAmount: 0,
            customerName: payment.customer_name,
            companyName: payment.company_name,
            customerId: payment.customer_id,
            method: payment.method,
            paidAt: payment.paid_at,
            distributions: [],
            custodyInfo
          };
        }
        groups[groupId].totalAmount += Number(payment.amount) || 0;
        groups[groupId].distributions.push(payment);
      } else {
        standalone.push(payment);
      }
    });

    Object.values(groups).forEach(group => {
      group.distributions.sort((a, b) => new Date(b.paid_at).getTime() - new Date(a.paid_at).getTime());
    });

    return { groupedPayments: Object.values(groups), standalonePayments: standalone };
  }, [filteredPayments, custodyDataMap]);

  const sortedItems = useMemo(() => {
    const items: Array<{ type: 'group' | 'payment'; data: GroupedPayment | Payment; date: Date }> = [];
    groupedPayments.forEach(group => items.push({ type: 'group', data: group, date: new Date(group.paidAt) }));
    standalonePayments.forEach(payment => items.push({ type: 'payment', data: payment, date: new Date(payment.paid_at) }));
    return items.sort((a, b) => b.date.getTime() - a.date.getTime());
  }, [groupedPayments, standalonePayments]);

  const getEntryTypeText = (entryType: string): string => {
    const types: Record<string, string> = {
      'payment': 'دفعة', 'account_payment': 'دفعة حساب', 'receipt': 'إيصال',
      'debt': 'دين سابق', 'invoice': 'فاتورة', 'general_debit': 'وارد عام',
      'general_credit': 'صادر عام', 'purchase_invoice': 'فاتورة مشتريات',
      'sales_invoice': 'فاتورة مبيعات', 'printed_invoice': 'فاتورة طباعة'
    };
    return types[entryType] || entryType || '—';
  };

  const getEntryTypeStyle = (entryType: string) => {
    if (['receipt', 'payment', 'account_payment', 'general_credit'].includes(entryType)) {
      return 'bg-green-500/10 text-green-700 dark:text-green-400 border border-green-500/20';
    }
    if (['debt', 'general_debit'].includes(entryType)) {
      return 'bg-red-500/10 text-red-700 dark:text-red-400 border border-red-500/20';
    }
    if (['invoice', 'purchase_invoice'].includes(entryType)) {
      return 'bg-orange-500/10 text-orange-700 dark:text-orange-400 border border-orange-500/20';
    }
    return 'bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20';
  };

  const handleViewCustomer = (customerId: string, customerName: string) => {
    navigate(`/admin/customer-billing?id=${customerId}&name=${encodeURIComponent(customerName)}`);
  };

  const handleAddDistributedPayment = () => {
    setPendingDistributeOpen(false);
    setCustomerSelectDialogOpen(true);
    loadCustomers();
  };

  const loadCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const { data: customersData, error } = await supabase
        .from('customers')
        .select('id, name, company, phone')
        .order('name');
      
      if (error) throw error;
      
      const [paymentsResult, contractsResult] = await Promise.all([
        supabase.from('customer_payments').select('customer_id'),
        supabase.from('Contract').select('customer_id')
      ]);
      
      const activeCustomerIds = new Set<string>();
      (paymentsResult.data || []).forEach(p => p.customer_id && activeCustomerIds.add(p.customer_id));
      (contractsResult.data || []).forEach(c => c.customer_id && activeCustomerIds.add(c.customer_id));
      
      const activeCustomers = (customersData || []).filter(c => activeCustomerIds.has(c.id));
      setCustomers(activeCustomers);
    } catch (error) {
      toast.error('فشل في تحميل قائمة العملاء');
    } finally {
      setLoadingCustomers(false);
    }
  };

  const handleSelectCustomer = (customerId: string, customerName: string) => {
    setSelectedCustomerId(customerId);
    setSelectedCustomerName(customerName);
    setPendingDistributeOpen(true);
    setCustomerSelectDialogOpen(false);
  };

  const handleViewDistributedPayment = async (distributedPaymentId: string) => {
    try {
      const { data, error } = await supabase.from('customer_payments').select('*').eq('distributed_payment_id', distributedPaymentId);
      if (error) throw error;
      if (!data || data.length === 0) { toast.error('لم يتم العثور على الدفعة'); return; }
      
      const financialData = await fetchAllFinancialData();
      const paymentsWithBalance = calculateBalances(
        data, 
        financialData.contracts, 
        financialData.salesInvoices, 
        financialData.printedInvoices, 
        financialData.purchaseInvoices, 
        financialData.discounts, 
        financialData.compositeTasks,
        (financialData as any).printTasks || [],
        (financialData as any).cutoutTasks || []
      );
      setSelectedDistributedPayments(paymentsWithBalance);
      setDistributedPaymentDialogOpen(true);
    } catch (error) {
      toast.error('فشل في تحميل تفاصيل الدفعة');
    }
  };

  const toggleGroupExpansion = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const filteredCustomers = customers.filter(customer =>
    customer.name?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    customer.company?.toLowerCase().includes(customerSearchTerm.toLowerCase()) ||
    customer.phone?.includes(customerSearchTerm)
  );

  // ═══════════ عرض جديد: الفترة والتصفية وتفاصيل التحصيل ═══════════
  const [period, setPeriod] = usePersistedState<'today' | 'week' | 'month' | '3m' | 'year' | 'all' | 'custom'>('paymentsReceiptsPage.period', 'month');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [methodFilter, setMethodFilter] = usePersistedState('paymentsReceiptsPage.methodFilter', 'all');
  const [kindFilter, setKindFilter] = usePersistedState<'all' | 'in' | 'out' | 'barter'>('paymentsReceiptsPage.kindFilter', 'all');
  const [distFilter, setDistFilter] = usePersistedState<'all' | 'open' | 'undistributed' | 'partial'>('paymentsReceiptsPage.distFilter', 'all');
  const [viaOnly, setViaOnly] = useState(false);
  const [visibleCount, setVisibleCount] = useState(60);

  const isoDay = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const range = useMemo(() => {
    const now = new Date();
    const back = (days: number) => { const d = new Date(now); d.setDate(d.getDate() - days); return isoDay(d); };
    switch (period) {
      case 'today': return { from: isoDay(now), to: isoDay(now) };
      case 'week': return { from: back(6), to: isoDay(now) };
      case 'month': return { from: back(29), to: isoDay(now) };
      case '3m': return { from: back(89), to: isoDay(now) };
      case 'year': return { from: back(364), to: isoDay(now) };
      case 'custom': return { from: fromDate || '0000-01-01', to: toDate || '9999-12-31' };
      default: return { from: '0000-01-01', to: '9999-12-31' };
    }
  }, [period, fromDate, toDate]);

  const CREDIT = ['receipt', 'payment', 'account_payment', 'general_credit'];
  const DEBIT = ['debt', 'general_debit'];
  const num = (v: unknown) => Number(v) || 0;
  const fmt = (v: number) => Math.round(v).toLocaleString('en-US');
  const LINK_FIELDS = ['contract_number', 'sales_invoice_id', 'printed_invoice_id', 'purchase_invoice_id', 'composite_task_id'] as const;
  /** حالة توزيع مقبوضة: الأجزاء المربوطة بعقد أو فاتورة أو مهمة هي الموزَّعة، والباقي غير موزع */
  const distributionOf = (rows: any[], total: number) => {
    const allocated = rows.reduce((s, p) => s + (LINK_FIELDS.some(f => p[f]) ? num(p.amount) : 0), 0);
    const remaining = Math.max(0, Math.round((total - allocated) * 100) / 100);
    const status: 'undistributed' | 'partial' | 'distributed' = allocated <= 0.01 ? 'undistributed' : remaining > 0.01 ? 'partial' : 'distributed';
    return { status, remaining };
  };
  const methods = useMemo(() => [...new Set(payments.map(p => p.method).filter(Boolean))].sort(), [payments]);

  type Row = { key: string; date: string; customerId: string; customer: string; company?: string | null; rows: Payment[]; total: number; isGroup: boolean };
  const allRows = useMemo<Row[]>(() => sortedItems.map(it => it.type === 'group'
    ? (() => { const g = it.data as GroupedPayment; return { key: g.id, date: g.paidAt, customerId: g.customerId, customer: g.customerName, company: g.companyName, rows: g.distributions, total: g.totalAmount, isGroup: true }; })()
    : (() => { const p = it.data as Payment; return { key: p.id, date: p.paid_at, customerId: p.customer_id, customer: p.customer_name, company: p.company_name, rows: [p], total: num(p.amount), isGroup: false }; })()), [sortedItems]);

  const rowsInView = useMemo(() => allRows.filter(r => {
    const d = String(r.date || '').slice(0, 10);
    if (d < range.from || d > range.to) return false;
    const first: any = r.rows[0];
    if (methodFilter !== 'all' && first.method !== methodFilter) return false;
    if (kindFilter === 'in' && !CREDIT.includes(first.entry_type)) return false;
    if (kindFilter === 'out' && !DEBIT.includes(first.entry_type)) return false;
    if (kindFilter === 'barter' && first.method !== 'مقايضة') return false;
    if (viaOnly && !r.rows.some((p: any) => p.collected_via_intermediary)) return false;
    if (distFilter !== 'all') {
      if (!CREDIT.includes(first.entry_type)) return false;
      const { status } = distributionOf(r.rows, r.total);
      if (distFilter === 'open' ? status === 'distributed' : status !== distFilter) return false;
    }
    return true;
  }), [allRows, range, methodFilter, kindFilter, viaOnly, distFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const kpi = useMemo(() => {
    let collected = 0, debits = 0, viaAmount = 0, commission = 0, fees = 0, viaCount = 0, receipts = 0;
    const byMethod = new Map<string, number>();
    rowsInView.forEach(r => {
      const first: any = r.rows[0];
      if (CREDIT.includes(first.entry_type)) {
        collected += r.total; receipts += 1;
        byMethod.set(first.method || 'غير محدد', (byMethod.get(first.method || 'غير محدد') || 0) + r.total);
        const via = r.rows.some((p: any) => p.collected_via_intermediary);
        if (via) { viaCount += 1; viaAmount += r.total; }
        r.rows.forEach((p: any) => { commission += num(p.intermediary_commission); fees += num(p.transfer_fee); });
      } else if (DEBIT.includes(first.entry_type)) debits += r.total;
    });
    return { collected, debits, viaAmount, commission, fees, viaCount, receipts, net: collected - commission - fees, byMethod: [...byMethod.entries()].sort((a, b) => b[1] - a[1]) };
  }, [rowsInView]); // eslint-disable-line react-hooks/exhaustive-deps

  // المدفوع لكل عقد (من كل القيود المحمّلة) لحساب المتبقي الحالي على العقد
  const contractPaidMap = useMemo(() => {
    const m: Record<number, number> = {};
    payments.forEach((p: any) => {
      if (!p.contract_number || !['receipt', 'payment', 'account_payment'].includes(p.entry_type)) return;
      const k = Number(p.contract_number);
      m[k] = (m[k] || 0) + (Number(p.amount) || 0);
    });
    return m;
  }, [payments]);
  const targetLabel = (p: any): string => {
    if (p.contract_number) return `عقد #${p.contract_number}${p.ad_type ? ` · ${p.ad_type}` : ''}`;
    if (p.printed_invoice_id) return 'فاتورة طباعة';
    if (p.sales_invoice_id) return 'فاتورة مبيعات';
    if (p.composite_task_id) return `أمر تركيب${p.ad_type ? ` · ${p.ad_type}` : ''}`;
    if (p.purchase_invoice_id || p.entry_type === 'purchase_invoice') return `مشتريات${purchaseInvoiceNotes[p.purchase_invoice_id] ? ` · ${purchaseInvoiceNotes[p.purchase_invoice_id]}` : ''}`;
    if (DEBIT.includes(p.entry_type)) return getEntryTypeText(p.entry_type);
    return 'على الحساب';
  };
  const barterNote = (rows: any[]): string | null => {
    if (rows[0]?.method !== 'مقايضة') return null;
    const notesText = rows[0]?.notes || '';
    const m = notesText.match(/عقد\s*(\d+)/);
    let cn: number | null = m ? Number(m[1]) : null;
    if (!cn) {
      const bm = notesText.match(/إيجار لوحة[:\s]+([^\n،,•]+)/);
      const name = bm ? bm[1].trim() : '';
      const rent = name ? friendRentals.find(r => r.billboards?.Billboard_Name?.trim() === name || r.billboard_id === name) : null;
      if (rent) cn = rent.contract_number;
    }
    if (rows.some(d => d.purchase_invoice_id || d.notes?.includes('PUR-'))) return 'مقايضة بفاتورة مشتريات';
    return cn ? `مقايضة · إيجار عقد #${cn}${friendContractsMap[cn] ? ` · ${friendContractsMap[cn]}` : ''}` : 'مقايضة · إيجار لوحة';
  };

  // طباعة الإيصال مباشرة من القائمة — نفس قالب الإيصال الموحد المستخدم في نافذة التفاصيل
  const [printingKey, setPrintingKey] = useState<string | null>(null);
  const handlePrintReceipt = async (r: Row) => {
    setPrintingKey(r.key);
    try {
      await printDistributedUnifiedReceipt(r.rows as any, r.customer || '', r.total, printReceipt);
    } catch (e: any) {
      toast.error(e?.message || 'تعذرت طباعة الإيصال');
    } finally {
      setPrintingKey(null);
    }
  };

  const openDetails = async (r: Row) => {
    if (r.isGroup) { handleViewDistributedPayment(r.key); return; }
    setSelectedDistributedPayments(r.rows);
    setDistributedPaymentDialogOpen(true);
  };

  const PERIODS: [typeof period, string][] = [['today', 'اليوم'], ['week', 'أسبوع'], ['month', '30 يوماً'], ['3m', '3 أشهر'], ['year', 'سنة'], ['all', 'الكل'], ['custom', 'مخصص']];

  return (
    <div className="mx-auto max-w-full space-y-4 p-4 md:p-6" dir="rtl">
      {/* الرأس */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground"><Receipt className="h-5 w-5" /></div>
          <div>
            <h1 className="text-2xl font-bold">الدفعات والإيصالات</h1>
            <p className="text-sm text-muted-foreground">كل المقبوضات والتوزيعات مع تفاصيل التحصيل (الوسيط والعمولة)</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="h-9" onClick={() => setReportDialogOpen(true)}><Send className="h-4 w-4" />إرسال تقرير</Button>
          <Button variant="outline" size="sm" className="h-9" onClick={() => setStatementPrintDialogOpen(true)}><Printer className="h-4 w-4" />طباعة كشف</Button>
          {canEditSection && <Button size="sm" className="h-9" onClick={handleAddDistributedPayment}><Plus className="h-4 w-4" />دفعة موزعة جديدة</Button>}
          <Button variant="outline" size="icon" className="h-9 w-9" onClick={loadPayments} title="تحديث"><RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /></Button>
        </div>
      </header>

      {/* المؤشرات للفترة المحددة */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {[
          { label: 'المحصّل', value: `${fmt(kpi.collected)} د.ل`, sub: `${kpi.receipts} عملية`, tone: 'text-emerald-600 dark:text-emerald-400', icon: TrendingUp },
          { label: 'صافي بعد الرسوم', value: `${fmt(kpi.net)} د.ل`, sub: kpi.commission + kpi.fees > 0 ? `بعد خصم ${fmt(kpi.commission + kpi.fees)}` : 'بدون رسوم', tone: '', icon: Wallet },
          { label: 'عبر وسيط', value: `${fmt(kpi.viaAmount)} د.ل`, sub: `${kpi.viaCount} عملية`, tone: 'text-sky-600 dark:text-sky-400', icon: User },
          { label: 'عمولات الوسطاء', value: `${fmt(kpi.commission)} د.ل`, sub: 'من المبالغ المحصلة', tone: kpi.commission ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground', icon: CreditCard },
          { label: 'رسوم التحويل', value: `${fmt(kpi.fees)} د.ل`, sub: 'تحويلات مصرفية', tone: kpi.fees ? 'text-amber-600 dark:text-amber-400' : 'text-muted-foreground', icon: CreditCard },
          { label: 'ديون وصادرات', value: `${fmt(kpi.debits)} د.ل`, sub: 'قيود مدينة', tone: kpi.debits ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground', icon: TrendingDown },
        ].map(k => (
          <div key={k.label} className="rounded-xl border border-border bg-card p-3">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground"><k.icon className="h-3.5 w-3.5" />{k.label}</div>
            <div className={`mt-1 text-lg font-bold tabular-nums ${k.tone}`}>{k.value}</div>
            <div className="text-[11px] text-muted-foreground">{k.sub}</div>
          </div>
        ))}
      </section>
      {kpi.byMethod.length > 1 && (
        <div className="flex flex-wrap gap-2 text-xs">
          {kpi.byMethod.map(([m, v]) => (
            <button key={m} type="button" onClick={() => setMethodFilter(methodFilter === m ? 'all' : m)}
              className={`rounded-full border px-3 py-1 ${methodFilter === m ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-background text-muted-foreground hover:bg-muted'}`}>
              {m}: <b className="tabular-nums">{fmt(v)}</b> ({kpi.collected ? Math.round((v / kpi.collected) * 100) : 0}%)
            </button>
          ))}
        </div>
      )}

      {/* التصفية */}
      <section className="space-y-2 rounded-xl border border-border bg-card p-3">
        <div className="flex flex-wrap gap-1.5">
          {PERIODS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => { setPeriod(k); setVisibleCount(60); }}
              className={`rounded-lg border px-3 py-1.5 text-sm ${period === k ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-background hover:bg-muted'}`}>{l}</button>
          ))}
          {period === 'custom' && (
            <div className="flex items-center gap-1.5">
              <Input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="h-9 w-40" />
              <span className="text-xs text-muted-foreground">إلى</span>
              <Input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="h-9 w-40" />
            </div>
          )}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[220px] flex-1">
            <Search className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="زبون، رقم عقد، مرجع، ملاحظة" className="h-9 pr-9" />
          </div>
          <Select value={kindFilter} onValueChange={v => setKindFilter(v as any)}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">كل الأنواع</SelectItem><SelectItem value="in">مقبوضات</SelectItem><SelectItem value="out">ديون وصادرات</SelectItem><SelectItem value="barter">مقايضة</SelectItem></SelectContent>
          </Select>
          <Select value={distFilter} onValueChange={v => setDistFilter(v as any)}>
            <SelectTrigger className="h-9 w-[170px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل حالات التوزيع</SelectItem>
              <SelectItem value="open">غير موزعة أو جزئياً</SelectItem>
              <SelectItem value="undistributed">غير موزعة</SelectItem>
              <SelectItem value="partial">موزعة جزئياً</SelectItem>
            </SelectContent>
          </Select>
          <Select value={methodFilter} onValueChange={setMethodFilter}>
            <SelectTrigger className="h-9 w-[140px]"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">كل الطرق</SelectItem>{methods.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent>
          </Select>
          {uniqueAdTypes.length > 0 && (
            <Select value={adTypeFilter} onValueChange={setAdTypeFilter}>
              <SelectTrigger className="h-9 w-[160px]"><SelectValue placeholder="نوع الإعلان" /></SelectTrigger>
              <SelectContent className="max-h-72"><SelectItem value="all">كل الإعلانات</SelectItem>{uniqueAdTypes.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
            </Select>
          )}
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs">
            <input type="checkbox" checked={viaOnly} onChange={e => setViaOnly(e.target.checked)} className="accent-primary" />عبر وسيط فقط
          </label>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs">
            <input type="checkbox" checked={showCollectionDetails} onChange={e => setShowCollectionDetails(e.target.checked)} className="accent-primary" />تفاصيل التحصيل لكل عملية
          </label>
        </div>
      </section>

      {/* القائمة */}
      {loading ? (
        <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted/60" />)}</div>
      ) : !rowsInView.length ? (
        <div className="rounded-xl border border-dashed border-border p-10 text-center text-muted-foreground">لا توجد عمليات في هذه الفترة</div>
      ) : (
        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <div className="hidden grid-cols-[92px_minmax(0,1.4fr)_minmax(0,1.6fr)_120px_110px_110px_124px] gap-3 border-b border-border bg-muted/50 px-4 py-2 text-xs font-semibold text-muted-foreground lg:grid">
            <span>التاريخ</span><span>الزبون</span><span>الوجهة</span><span className="text-left">المبلغ المستلم</span><span className="text-left">المتبقي</span><span>الطريقة</span><span />
          </div>
          {rowsInView.slice(0, visibleCount).map(r => {
            const first: any = r.rows[0];
            const isDebit = DEBIT.includes(first.entry_type);
            const via = r.rows.some((p: any) => p.collected_via_intermediary);
            const comm = r.rows.reduce((s: number, p: any) => s + num(p.intermediary_commission), 0);
            const fee = r.rows.reduce((s: number, p: any) => s + num(p.transfer_fee), 0);
            const barter = barterNote(r.rows);
            const custody = r.isGroup ? custodyDataMap[r.key] : null;
            const expanded = expandedGroups.has(r.key);
            const targets = [...new Set(r.rows.map(targetLabel))];
            const dist = CREDIT.includes(first.entry_type) ? distributionOf(r.rows, r.total) : null;
            return (
              <div key={r.key} className="border-b border-border last:border-b-0">
                <div className="grid grid-cols-2 items-center gap-x-3 gap-y-1 px-4 py-3 lg:grid-cols-[92px_minmax(0,1.4fr)_minmax(0,1.6fr)_120px_110px_110px_124px]">
                  <span className="text-xs tabular-nums text-muted-foreground">{String(r.date || '').slice(0, 10).split('-').reverse().join('/')}</span>
                  <button type="button" className="min-w-0 text-right" onClick={() => navigate(`/admin/customer-account?id=${r.customerId}&name=${encodeURIComponent(r.customer || '')}`)}>
                    <span className="block truncate font-semibold hover:text-primary">{r.customer || '—'}</span>
                    {r.company && <span className="block truncate text-[11px] text-muted-foreground">{r.company}</span>}
                  </button>
                  <div className="col-span-2 flex min-w-0 flex-wrap items-center gap-1 lg:col-span-1">
                    {r.isGroup && <button type="button" onClick={() => toggleGroupExpansion(r.key)} className="flex items-center gap-0.5 rounded-md bg-primary/10 px-1.5 py-0.5 text-[11px] font-semibold text-primary">{expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}{dist?.status === 'partial' ? 'موزعة جزئياً' : 'موزعة'} ({r.rows.length})</button>}
                    {!r.isGroup && <span className={`rounded-md px-1.5 py-0.5 text-[11px] ${getEntryTypeStyle(first.entry_type)}`}>{getEntryTypeText(first.entry_type)}</span>}
                    {targets.slice(0, 3).map(t => <span key={t} className="truncate rounded-md border border-border px-1.5 py-0.5 text-[11px]">{t}</span>)}
                    {targets.length > 3 && <span className="text-[11px] text-muted-foreground">+{targets.length - 3}</span>}
                    {dist && dist.status !== 'distributed' && (
                      <span className={`rounded-md px-1.5 py-0.5 text-[11px] font-semibold ${dist.status === 'undistributed' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400' : 'bg-amber-500/10 text-amber-700 dark:text-amber-300'}`}>
                        {dist.status === 'undistributed' ? `غير موزعة · ${fmt(r.total)} د.ل` : `متبقٍ غير موزع ${fmt(dist.remaining)} د.ل`}
                      </span>
                    )}
                    {barter && <span className="rounded-md bg-purple-500/10 px-1.5 py-0.5 text-[11px] text-purple-700 dark:text-purple-300">{barter}</span>}
                    {via && <span className="rounded-md bg-sky-500/10 px-1.5 py-0.5 text-[11px] text-sky-700 dark:text-sky-300">وسيط: {first.collector_name || '—'}</span>}
                    {custody && <span className="rounded-md bg-amber-500/10 px-1.5 py-0.5 text-[11px] text-amber-700 dark:text-amber-300">عهدة: {custody.employee_name}</span>}
                  </div>
                  <div className="lg:text-left">
                    <div className="text-[10px] text-muted-foreground lg:hidden">{isDebit ? 'قيد مدين' : 'المبلغ المستلم'}</div>
                    <span className={`text-base font-bold tabular-nums ${isDebit ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{isDebit ? '−' : ''}{fmt(r.total)} <span className="text-[11px] font-normal text-muted-foreground">د.ل</span></span>
                    {(comm > 0 || fee > 0) && <div className="text-[10px] text-muted-foreground">الصافي {fmt(r.total - comm - fee)}</div>}
                  </div>
                  {(() => {
                    const cs = [...new Set(r.rows.map((p: any) => Number(p.contract_number)).filter(Boolean))] as number[];
                    const known = cs.filter(c => contractTotals[c] !== undefined);
                    const contractRem = known.reduce((s2, c) => s2 + Math.max(0, (contractTotals[c] || 0) - (contractPaidMap[c] || 0)), 0);
                    const custRem = num(first.remaining_debt);
                    return (
                      <div className="space-y-0.5 text-[11px] leading-tight lg:text-left">
                        {known.length > 0 && (
                          <div>
                            <span className="text-muted-foreground">{known.length === 1 ? `على العقد #${known[0]}: ` : `على العقود (${known.length}): `}</span>
                            <b className={`tabular-nums ${contractRem > 0.01 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{contractRem > 0.01 ? `${fmt(contractRem)} د.ل` : 'مسدد ✓'}</b>
                          </div>
                        )}
                        <div>
                          <span className="text-muted-foreground">على الزبون بعدها: </span>
                          <b className={`tabular-nums ${custRem > 0.01 ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>{custRem > 0.01 ? `${fmt(custRem)} د.ل` : 'لا شيء'}</b>
                        </div>
                      </div>
                    );
                  })()}
                  <span className="text-xs text-muted-foreground">{first.method || '—'}</span>
                  <div className="flex justify-end gap-1">
                    {CREDIT.includes(first.entry_type) && (
                      <Button size="sm" variant="outline" className="h-8 w-8 p-0" title="طباعة الإيصال" aria-label="طباعة الإيصال" disabled={printingKey === r.key}
                        onClick={() => handlePrintReceipt(r)}>
                        <Printer className={`h-3.5 w-3.5 ${printingKey === r.key ? 'animate-pulse' : ''}`} />
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="h-8 px-2 text-xs" onClick={() => openDetails(r)}><Edit className="h-3.5 w-3.5" />تفاصيل</Button>
                  </div>
                </div>
                {(showCollectionDetails || via) && CREDIT.includes(first.entry_type) && (via || comm || fee || first.source_bank || first.transfer_reference) && (
                  <div className="flex flex-wrap gap-x-4 gap-y-1 bg-sky-500/[0.04] px-4 pb-2.5 pt-0 text-xs text-muted-foreground lg:pr-[116px]">
                    {via && <span>المحصِّل: <b className="text-foreground">{first.collector_name || '—'}</b> ← سُلِّم إلى <b className="text-foreground">{first.receiver_name || '—'}</b>{first.delivery_location ? ` · ${first.delivery_location}` : ''}{first.collection_date ? ` · ${String(first.collection_date).split('-').reverse().join('/')}` : ''}</span>}
                    {comm > 0 && <span>عمولة الوسيط: <b className="tabular-nums text-amber-600">{fmt(comm)} د.ل</b></span>}
                    {fee > 0 && <span>رسوم التحويل: <b className="tabular-nums text-amber-600">{fmt(fee)} د.ل</b></span>}
                    {(comm > 0 || fee > 0) && <span>الصافي: <b className="tabular-nums text-foreground">{fmt(r.total - comm - fee)} د.ل</b></span>}
                    {(first.source_bank || first.destination_bank) && <span>تحويل: {first.source_bank || '—'} ← {first.destination_bank || '—'}{first.transfer_reference ? ` (${first.transfer_reference})` : ''}</span>}
                  </div>
                )}
                {r.isGroup && expanded && (
                  <div className="space-y-1 border-t border-dashed border-border bg-muted/20 px-4 py-2">
                    {r.rows.map((p: any) => (
                      <div key={p.id} className="flex items-center gap-3 text-xs">
                        <span className="text-primary">↳</span>
                        <span className="min-w-0 flex-1 truncate">{targetLabel(p)}{p.notes ? <span className="text-muted-foreground"> · {p.notes}</span> : null}</span>
                        <b className="tabular-nums">{fmt(num(p.amount))} د.ل</b>
                      </div>
                    ))}
                    {custody && <div className="text-xs text-amber-700 dark:text-amber-300">عهدة لدى {custody.employee_name}: {fmt(custody.initial_amount)} د.ل · الرصيد الحالي {fmt(custody.current_balance)} د.ل</div>}
                  </div>
                )}
              </div>
            );
          })}
          {rowsInView.length > visibleCount && (
            <div className="p-3 text-center"><Button variant="outline" size="sm" onClick={() => setVisibleCount(c => c + 60)}>عرض المزيد ({rowsInView.length - visibleCount})</Button></div>
          )}
        </section>
      )}
      {/* Customer Select Dialog */}
      {!distributeDialogOpen && (
        <Dialog open={customerSelectDialogOpen} onOpenChange={setCustomerSelectDialogOpen}>
          <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col overflow-hidden bg-gradient-to-br from-card via-card to-accent/5 border-border/50 shadow-2xl">
            <DialogHeader className="border-b border-border/50 pb-4 bg-gradient-to-l from-primary/5 to-transparent -mx-6 -mt-6 px-6 pt-6 rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-gradient-to-br from-primary to-primary/80 shadow-lg shadow-primary/20 text-white">
                  <User className="h-5 w-5" />
                </div>
                <div>
                  <DialogTitle className="text-lg font-bold text-foreground">اختيار العميل</DialogTitle>
                  <DialogDescription className="text-sm text-muted-foreground mt-0.5">اختر العميل لإنشاء دفعة موزعة</DialogDescription>
                </div>
              </div>
            </DialogHeader>
            <div className="space-y-3 flex-1 overflow-hidden flex flex-col pt-4">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث باسم العميل، الشركة، أو رقم الهاتف..."
                  value={customerSearchTerm}
                  onChange={(e) => setCustomerSearchTerm(e.target.value)}
                  className="pr-10 h-11 bg-background/80 text-base border-border/80"
                  autoFocus
                />
              </div>
              
              {loadingCustomers ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  <p className="text-muted-foreground text-sm font-medium">جاري تحميل العملاء...</p>
                </div>
              ) : filteredCustomers.length === 0 ? (
                <div className="text-center py-12">
                  <User className="h-12 w-12 mx-auto text-muted-foreground/30 mb-3" />
                  <p className="text-muted-foreground">لا توجد نتائج مطابقة</p>
                </div>
              ) : (
                <div className="flex-1 overflow-y-auto border border-border/50 rounded-xl divide-y divide-border/30 bg-background/30">
                  <div className="px-3 py-2 bg-muted/70 text-xs text-muted-foreground sticky top-0 z-10 font-bold">
                    {filteredCustomers.length} عميل متاح
                  </div>
                  {filteredCustomers.map((customer) => (
                    <div
                      key={customer.id}
                      className="flex items-center gap-3 px-4 py-3.5 hover:bg-primary/5 cursor-pointer transition-all duration-200 group"
                      onClick={() => handleSelectCustomer(customer.id, customer.name)}
                    >
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-primary font-bold text-sm shrink-0 group-hover:from-primary/30 group-hover:to-primary/10 transition-all border border-primary/10">
                        {customer.name?.charAt(0) || '؟'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-foreground group-hover:text-primary transition-colors truncate">{customer.name}</div>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          {customer.company && <span className="truncate">{customer.company}</span>}
                          {customer.phone && (
                            <>
                              {customer.company && <span>•</span>}
                              <span dir="ltr" className="font-numbers">{customer.phone}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary transition-all group-hover:translate-x-[-4px]" />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Distribute Payment Dialog */}
      <EnhancedDistributePaymentDialog
        open={distributeDialogOpen}
        onOpenChange={(isOpen) => {
          setDistributeDialogOpen(isOpen);
          if (!isOpen) {
            setSelectedCustomerId('');
            setSelectedCustomerName('');
            setPendingDistributeOpen(false);
            document.body.style.pointerEvents = '';
          }
        }}
        customerId={selectedCustomerId}
        customerName={selectedCustomerName}
        onSuccess={() => {
          loadPayments();
          setDistributeDialogOpen(false);
          toast.success('تم إضافة الدفعة الموزعة بنجاح');
        }}
      />

      {/* Edit distributed payment dialog */}
      <EnhancedDistributePaymentDialog
        open={editingDistributedPaymentId !== null}
        onOpenChange={(open) => {
          if (!open) {
            setEditingDistributedPaymentId(null);
            setEditingDistributedPayments([]);
          }
        }}
        customerId={selectedCustomerId}
        customerName={selectedCustomerName}
        onSuccess={() => {
          loadPayments();
          setEditingDistributedPaymentId(null);
          setEditingDistributedPayments([]);
          toast.success('تم تعديل الدفعة الموزعة بنجاح');
        }}
        editMode={true}
        editingDistributedPaymentId={editingDistributedPaymentId}
        editingPayments={editingDistributedPayments}
      />

      {selectedDistributedPayments.length > 0 && (
        <DistributedPaymentDetailsDialog
          open={distributedPaymentDialogOpen}
          onOpenChange={setDistributedPaymentDialogOpen}
          groupedPayments={selectedDistributedPayments as any}
          totalAmount={selectedDistributedPayments.reduce((sum, p) => sum + p.amount, 0)}
          onPrintCombined={() => printDistributedUnifiedReceipt(selectedDistributedPayments as any, selectedDistributedPayments[0]?.customer_name || '', selectedDistributedPayments.reduce((s, p) => s + (Number(p.amount) || 0), 0), printReceipt).catch((e: any) => toast.error(e.message))}
          onPrintIndividual={(p: any) => printDistributedUnifiedReceipt([p], p.customer_name || '', Number(p.amount) || 0, printReceipt).catch((e: any) => toast.error(e.message))}
          onDelete={async () => {
            const distId = selectedDistributedPayments[0]?.distributed_payment_id;
            if (!distId) {
              // دفعة منفردة: الحذف المباشر (المشغّلات تنظف السلف والسحوبات وسدادات المصاريف المرتبطة)
              const single = selectedDistributedPayments[0];
              if (!single) return;
              const { error } = await supabase.from('customer_payments').delete().eq('id', single.id);
              if (error) { toast.error(`فشل الحذف: ${error.message}`); return; }
              toast.success('تم حذف الدفعة');
              setDistributedPaymentDialogOpen(false);
              loadPayments();
              return;
            }
            // التأكيد يتم داخل نافذة التفاصيل
            try {
              const { data: expensePaysToDelete } = await supabase
                .from('expense_payments')
                .select('expense_id, amount')
                .eq('distributed_payment_id', distId);

              await supabase.from('expense_payments').delete().eq('distributed_payment_id', distId);

              const affectedExpenseIds = Array.from(new Set((expensePaysToDelete || []).map((r: any) => r.expense_id).filter(Boolean)));
              for (const expId of affectedExpenseIds) {
                const { data: remainingPays } = await supabase
                  .from('expense_payments')
                  .select('amount')
                  .eq('expense_id', expId);
                const newPaid = (remainingPays || []).reduce((s: number, r: any) => s + (Number(r.amount) || 0), 0);
                const { data: expRow } = await supabase
                  .from('expenses')
                  .select('amount')
                  .eq('id', expId)
                  .single();
                const total = Number((expRow as any)?.amount || 0);
                const status = newPaid <= 0 ? 'unpaid' : (newPaid + 0.01 >= total ? 'paid' : 'partial');
                await supabase.from('expenses').update({ paid_amount: newPaid, payment_status: status }).eq('id', expId);
              }

              await supabase.from('expenses_withdrawals').delete().eq('distributed_payment_id', distId);
              await supabase.from('employee_advances').delete().eq('distributed_payment_id', distId);
              const { data: custodyAccounts } = await supabase
                .from('custody_accounts')
                .select('id')
                .eq('source_payment_id', distId)
                .eq('source_type', 'distributed_payment');
              if (custodyAccounts && custodyAccounts.length > 0) {
                const custodyIds = custodyAccounts.map((c: any) => c.id);
                await supabase.from('custody_transactions').delete().in('custody_account_id', custodyIds);
                await supabase.from('custody_expenses').delete().in('custody_account_id', custodyIds);
                await supabase.from('custody_accounts').delete().in('id', custodyIds);
              }

              const { error } = await supabase
                .from('customer_payments')
                .delete()
                .eq('distributed_payment_id', distId);
              if (error) throw error;
              toast.success('تم حذف الدفعة الموزعة وتنظيف المصروفات المرتبطة');
              setDistributedPaymentDialogOpen(false);
              loadPayments?.();
            } catch (e: any) {
              console.error('Delete distributed payment failed:', e);
              toast.error(`فشل حذف الدفعة: ${e.message || 'خطأ غير معروف'}`);
            }
          }}
          customerName={selectedDistributedPayments[0]?.customer_name || ''}
          onEdit={!selectedDistributedPayments[0]?.distributed_payment_id ? undefined : () => {
            const distId = selectedDistributedPayments[0]?.distributed_payment_id;
            if (distId) {
              setEditingDistributedPaymentId(distId);
              setEditingDistributedPayments(selectedDistributedPayments);
              setSelectedCustomerId(selectedDistributedPayments[0]?.customer_id || '');
              setSelectedCustomerName(selectedDistributedPayments[0]?.customer_name || '');
              setDistributedPaymentDialogOpen(false);
            }
          }}
        />
      )}

      {/* Print Statement Dialog */}
      <PaymentsStatementPrintDialog
        open={statementPrintDialogOpen}
        onOpenChange={setStatementPrintDialogOpen}
        payments={filteredPayments}
      />

      {/* Send Report Dialog */}
      <SendPaymentsReportDialog
        open={reportDialogOpen}
        onOpenChange={setReportDialogOpen}
        payments={filteredPayments}
      />
    </div>
  );
}
