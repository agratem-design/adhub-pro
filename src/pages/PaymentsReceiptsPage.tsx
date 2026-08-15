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
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [adTypeFilter, setAdTypeFilter] = useState<string>('all');
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
  const [showCollectionDetails, setShowCollectionDetails] = useState(false);
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
        
        return {
          ...payment,
          customer_name: customerName,
          company_name: companyName,
          ad_type: payment.contract_number ? adTypeMap[payment.contract_number] : null
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

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-full mx-auto" dir="rtl">
      {/* Premium Glassmorphic Header */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border border-primary/15 p-6 md:p-8 backdrop-blur-sm shadow-sm">
        <div className="absolute right-0 top-0 -z-10 h-32 w-32 rounded-full bg-primary/5 blur-3xl"></div>
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 md:w-14 md:h-14 bg-gradient-to-br from-primary to-primary/80 rounded-2xl flex items-center justify-center shadow-lg shadow-primary/20 text-white shrink-0">
              <Receipt className="h-6 w-6 md:h-7 md:w-7" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-foreground tracking-tight">الدفعات والإيصالات</h1>
              <p className="text-muted-foreground text-sm mt-1">
                إدارة وتوزيع ومتابعة جميع المقبوضات المالية والتوزيعات والحسابات
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2.5 w-full md:w-auto">
            <Button onClick={() => setReportDialogOpen(true)} variant="outline" className="h-10 text-xs font-semibold gap-1.5 flex-1 sm:flex-none">
              <Send className="h-3.5 w-3.5" /> إرسال تقرير
            </Button>
            <Button onClick={() => setStatementPrintDialogOpen(true)} variant="outline" className="h-10 text-xs font-semibold gap-1.5 flex-1 sm:flex-none">
              <Printer className="h-3.5 w-3.5" /> طباعة كشف
            </Button>
            <Button onClick={handleAddDistributedPayment} className="h-10 text-xs font-semibold gap-1.5 bg-primary hover:bg-primary/90 text-white shadow-sm flex-1 sm:flex-none">
              <Plus className="h-3.5 w-3.5" /> دفعة موزعة جديدة
            </Button>
            <Button onClick={loadPayments} variant="outline" size="icon" className="h-10 w-10 shrink-0">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Cards Dashboard */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        <Card className="border-border/50 bg-card/60 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">إجمالي المعاملات</p>
              <h3 className="text-3xl font-black text-foreground tracking-tight font-numbers">{stats.totalPayments}</h3>
            </div>
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
              <CreditCard className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/60 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">عدد الإيصالات</p>
              <h3 className="text-3xl font-black text-foreground tracking-tight font-numbers">{stats.totalReceipts}</h3>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shadow-inner">
              <Receipt className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/60 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">إجمالي الواردات</p>
              <h3 className="text-xl md:text-2xl font-black text-emerald-600 tracking-tight font-numbers">
                {stats.totalCredits.toLocaleString('en-US')} <span className="text-xs font-bold text-muted-foreground">د.ل</span>
              </h3>
            </div>
            <div className="h-12 w-12 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-600 shadow-inner">
              <TrendingUp className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-border/50 bg-card/60 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <CardContent className="p-5 flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider">إجمالي الصادرات</p>
              <h3 className="text-xl md:text-2xl font-black text-rose-600 tracking-tight font-numbers">
                {stats.totalDebits.toLocaleString('en-US')} <span className="text-xs font-bold text-muted-foreground">د.ل</span>
              </h3>
            </div>
            <div className="h-12 w-12 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-600 shadow-inner">
              <TrendingDown className="h-5 w-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Search Console */}
      <Card className="border-border/50 bg-card/40 backdrop-blur-sm shadow-sm print:hidden">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4.5 w-4.5 text-muted-foreground/60" />
              <Input
                placeholder="ابحث باسم العميل، رقم العقد، أو الملاحظات..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-9 h-10 border-border/80 focus-visible:ring-primary/20 bg-background/80"
              />
            </div>
            <div className="flex items-center gap-3">
              <Select value={adTypeFilter} onValueChange={setAdTypeFilter}>
                <SelectTrigger className="w-[170px] h-10 border-border/80 bg-background/85">
                  <Filter className="h-3.5 w-3.5 ml-2 text-muted-foreground" />
                  <SelectValue placeholder="نوع الإعلان" />
                </SelectTrigger>
                <SelectContent>
                  <div className="p-2">
                    <Input
                      placeholder="ابحث نوع الإعلان..."
                      value={adTypeSearch}
                      onChange={(e) => setAdTypeSearch(e.target.value)}
                      className="h-8 text-xs"
                      autoFocus
                    />
                  </div>
                  <SelectItem value="all">كل الأنواع</SelectItem>
                  {uniqueAdTypes
                    .filter(type => !adTypeSearch || type.includes(adTypeSearch))
                    .map(type => (
                      <SelectItem key={type} value={type}>{type}</SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <div className="flex gap-2 shrink-0">
                <Badge variant="outline" className="h-7 bg-purple-50 dark:bg-purple-950/40 border-purple-200 dark:border-purple-900/50 text-purple-700 dark:text-purple-300 font-semibold">{groupedPayments.length} مجمعة</Badge>
                <Badge variant="outline" className="h-7 font-semibold">{standalonePayments.length} مستقلة</Badge>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main List Container */}
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/40 bg-muted/40">
          <CardTitle className="text-base font-bold">كل المعاملات المالية ({filteredPayments.length})</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-20 gap-3">
              <div className="h-8 w-8 animate-spin border-2 border-primary border-t-transparent rounded-full"></div>
              <p className="text-muted-foreground text-sm font-medium">جاري تحميل وتحديث البيانات...</p>
            </div>
          ) : filteredPayments.length === 0 ? (
            <div className="text-center py-16 text-muted-foreground">
              <Receipt className="h-12 w-12 mx-auto mb-3 opacity-30" />
              <p className="font-semibold text-sm">لم يتم العثور على أي دفعات أو إيصالات مالية</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/80 border-b border-border/50 text-muted-foreground text-[13px] font-bold">
                    <th className="text-center px-4 py-3.5 w-12">#</th>
                    <th className="text-right px-4 py-3.5 w-28">التاريخ</th>
                    <th className="text-right px-4 py-3.5">العميل</th>
                    <th className="text-center px-4 py-3.5">نوع العملية</th>
                    <th className="text-center px-4 py-3.5">نوع الإعلان</th>
                    <th className="text-center px-4 py-3.5 w-32">المبلغ</th>
                    <th className="text-center px-4 py-3.5 w-32">المتبقي للحساب</th>
                    <th className="text-center px-4 py-3.5 w-24">رقم العقد</th>
                    <th className="text-center px-4 py-3.5 w-28">الوسيلة</th>
                    <th className="text-center px-4 py-3.5 w-24">الإجراءات</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {sortedItems.map((item, itemIndex) => {
                    if (item.type === 'group') {
                      const group = item.data as GroupedPayment;
                      const isExpanded = expandedGroups.has(group.id);
                      const contractsList = [...new Set(group.distributions.filter(d => d.contract_number).map(d => d.contract_number))];
                      const hasCustody = !!group.custodyInfo;
                      const adTypes = [...new Set(group.distributions.filter(d => d.ad_type).map(d => d.ad_type))];
                      
                      return (
                        <React.Fragment key={group.id}>
                          {/* Group Header Row */}
                          <tr 
                            className="bg-purple-500/[0.03] dark:bg-purple-500/[0.01] hover:bg-purple-500/[0.07] dark:hover:bg-purple-500/[0.04] cursor-pointer transition-colors border-r-4 border-r-purple-500"
                            onClick={() => toggleGroupExpansion(group.id)}
                          >
                            <td className="px-4 py-3.5 text-center text-xs font-bold text-purple-600">{sortedItems.length - itemIndex}</td>
                            <td className="px-4 py-3.5 font-medium whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                {isExpanded ? <ChevronDown className="h-4 w-4 text-purple-600" /> : <ChevronRight className="h-4 w-4 text-purple-600" />}
                                <span className="text-xs font-numbers">{new Date(group.paidAt).toLocaleDateString('ar-LY')}</span>
                              </div>
                            </td>
                            <td className="px-4 py-3.5">
                              <div className="flex flex-col">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <Button 
                                    variant="link" 
                                    className="p-0 h-auto font-bold text-sm text-foreground hover:text-purple-600 justify-start" 
                                    onClick={(e) => { e.stopPropagation(); handleViewCustomer(group.customerId, group.customerName); }}
                                  >
                                    {group.customerName}
                                  </Button>
                                  {group.method === 'مقايضة' && (() => {
                                     const firstDist = group.distributions[0];
                                     const hasPurchaseInvoice = group.distributions.some(d => d.purchase_invoice_id || d.notes?.includes('مشتريات') || d.notes?.includes('PUR-'));
                                     
                                     let friendContractNum: number | null = null;
                                     let friendAdType: string | null = null;

                                     const notesText = firstDist?.notes || '';
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
                                       friendAdType = friendContractsMap[friendContractNum] || null;
                                     }

                                     let purchaseNotes = '';
                                     if (hasPurchaseInvoice) {
                                       const linkedPurId = group.distributions.find(d => d.purchase_invoice_id)?.purchase_invoice_id;
                                       const purMatch = notesText.match(/PUR-\d+/);
                                       const purCode = purMatch ? purMatch[0] : null;
                                       purchaseNotes = (linkedPurId ? purchaseInvoiceNotes[linkedPurId] : null) || (purCode ? purchaseInvoiceNotes[purCode] : null) || '';
                                     }

                                     const adTypeSuffix = friendAdType ? ` - ${friendAdType}` : '';
                                     
                                     const barterLabel = hasPurchaseInvoice 
                                       ? `مقايضة - ${purchaseNotes || 'فاتورة مشتريات'}`
                                       : (friendContractNum 
                                         ? `مقايضة - إيجار عقد #${friendContractNum}${adTypeSuffix}` 
                                         : 'مقايضة - إيجار لوحة');
                                     return (
                                       <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300 text-[10px] gap-1 px-1.5 py-0 font-bold">
                                         {barterLabel}
                                       </Badge>
                                     );
                                   })()}
                                  {hasCustody && (
                                    <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 text-[10px] gap-1 px-1.5 py-0 font-bold">
                                      <Wallet className="h-3 w-3" /> عهدة
                                    </Badge>
                                  )}
                                </div>
                                {group.companyName && (
                                  <span className="text-[11px] text-muted-foreground mt-0.5">{group.companyName}</span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <Badge className="bg-purple-500/10 text-purple-700 dark:text-purple-300 border border-purple-500/20 text-xs font-bold">
                                مجمعة ({group.distributions.length})
                              </Badge>
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              {adTypes.length > 0 ? (
                                <div className="flex flex-wrap gap-1 justify-center">
                                  {adTypes.slice(0, 2).map((ad, i) => (
                                    <Badge key={i} variant="outline" className="text-[10px] bg-blue-500/5 text-blue-700 dark:text-blue-300 border-blue-500/10 font-bold">{ad}</Badge>
                                  ))}
                                  {adTypes.length > 2 && <span className="text-[11px] text-muted-foreground font-semibold">+{adTypes.length - 2}</span>}
                                </div>
                              ) : <span className="text-muted-foreground/60">—</span>}
                            </td>
                            <td className="px-4 py-3.5 text-center">
                              <span className="font-extrabold text-[15px] text-purple-700 dark:text-purple-400 font-numbers">
                                {group.totalAmount.toLocaleString('en-US')} <span className="text-xs font-semibold text-muted-foreground">د.ل</span>
                              </span>
                            </td>
                            <td className={`px-4 py-3.5 text-center font-bold font-numbers ${(group.distributions[0]?.remaining_debt || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                              {(group.distributions[0]?.remaining_debt || 0).toLocaleString('en-US')}
                            </td>
                            <td className="px-4 py-3.5 text-center text-xs text-primary font-bold whitespace-nowrap font-numbers">
                              {contractsList.length > 0 ? contractsList.slice(0, 2).map(c => `#${c}`).join('، ') : '—'}
                            </td>
                            <td className="px-4 py-3.5 text-center text-xs text-muted-foreground font-medium">
                              {group.method || '—'}
                            </td>
                            <td className="px-4 py-3.5 text-center" onClick={(e) => e.stopPropagation()}>
                              <Button size="sm" variant="outline" onClick={() => handleViewDistributedPayment(group.distributedPaymentId)} className="h-7 px-2.5 text-[11px] font-bold border-border/80">
                                <Edit className="h-3 w-3 ml-1 text-primary" /> تفاصيل
                              </Button>
                            </td>
                          </tr>
                          
                          {/* Expanded Content */}
                          {isExpanded && (
                            <>
                              {hasCustody && group.custodyInfo && (
                                <tr className="bg-amber-500/[0.02] dark:bg-amber-500/[0.01]">
                                  <td colSpan={10} className="px-6 py-2.5 border-r-4 border-amber-400">
                                    <div className="flex items-center gap-4 flex-wrap text-[13px] text-muted-foreground">
                                      <div className="flex items-center gap-1.5 text-amber-700 dark:text-amber-400 font-bold">
                                        <Wallet className="h-4 w-4" />
                                        <span>عهدة مالية مرتبطة</span>
                                      </div>
                                      <span>لدى الموظف: <strong className="text-foreground">{group.custodyInfo.employee_name}</strong></span>
                                      <span>المبلغ: <strong className="text-amber-700 dark:text-amber-400 font-numbers">{group.custodyInfo.initial_amount.toLocaleString('en-US')} د.ل</strong></span>
                                      <span>الرصيد الحالي: <strong className={`font-numbers ${group.custodyInfo.current_balance > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{group.custodyInfo.current_balance.toLocaleString('en-US')} د.ل</strong></span>
 {group.custodyInfo.current_balance === 0 && <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 text-[10px] font-bold border-none"> مسددة</Badge>}
                                    </div>
                                  </td>
                                </tr>
                              )}
                              
                              {group.distributions.map((dist, distIndex) => (
                                <tr key={dist.id} className={`border-r-4 border-purple-400 bg-purple-500/[0.01] ${distIndex % 2 === 0 ? 'bg-muted/10' : 'bg-muted/5'}`}>
                                  <td className="px-4 py-2.5 text-center text-xs text-muted-foreground/60">{distIndex + 1}</td>
                                  <td className="px-6 py-2.5 text-xs text-muted-foreground whitespace-nowrap">
                                    <span className="text-purple-400 font-bold ml-1">↳</span>
                                    <span className="font-numbers">{new Date(dist.paid_at).toLocaleDateString('ar-LY')}</span>
                                  </td>
                                  <td className="px-4 py-2.5 text-xs text-muted-foreground font-medium max-w-[280px] truncate">
                                    {dist.notes || '—'}
                                  </td>
                                  <td className="px-4 py-2.5 text-center">
                                    <Badge className={`${getEntryTypeStyle(dist.entry_type)} text-[10px] font-bold`}>{getEntryTypeText(dist.entry_type)}</Badge>
                                  </td>
                                  <td className="px-4 py-2.5 text-center text-xs text-muted-foreground font-medium">{dist.ad_type || '—'}</td>
                                  <td className="px-4 py-2.5 text-center font-bold font-numbers text-[14px]">
                                    {(Number(dist.amount) || 0).toLocaleString('en-US')} <span className="text-[10px] text-muted-foreground font-semibold">د.ل</span>
                                  </td>
                                  <td className="px-4 py-2.5 text-center text-muted-foreground/45">—</td>
                                  <td className="px-4 py-2.5 text-center text-xs text-primary font-bold font-numbers">
                                    {dist.contract_number ? `#${dist.contract_number}` : '—'}
                                  </td>
                                  <td className="px-4 py-2.5"></td>
                                  <td className="px-4 py-2.5"></td>
                                </tr>
                              ))}
                            </>
                          )}
                        </React.Fragment>
                      );
                    } else {
                      const payment = item.data as Payment;
                      return (
                        <tr key={payment.id} className={`hover:bg-muted/30 transition-colors ${itemIndex % 2 === 0 ? 'bg-muted/5' : ''}`}>
                          <td className="px-4 py-3.5 text-center text-xs font-bold text-muted-foreground">{sortedItems.length - itemIndex}</td>
                          <td className="px-4 py-3.5 font-medium whitespace-nowrap font-numbers">
                            {new Date(payment.paid_at || payment.created_at).toLocaleDateString('ar-LY')}
                          </td>
                          <td className="px-4 py-3.5">
                            <div className="flex flex-col">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Button 
                                  variant="link" 
                                  className="p-0 h-auto font-bold text-sm text-foreground hover:text-primary justify-start" 
                                  onClick={() => handleViewCustomer(payment.customer_id, payment.customer_name)}
                                >
                                  {payment.customer_name}
                                </Button>
                                {payment.method === 'مقايضة' && (() => {
                                  const hasPurchaseInvoice = !!payment.purchase_invoice_id || payment.notes?.includes('مشتريات') || payment.notes?.includes('PUR-');
                                  
                                  let friendContractNum: number | null = null;
                                  let friendAdType: string | null = null;

                                  const notesText = payment.notes || '';
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
                                    friendAdType = friendContractsMap[friendContractNum] || null;
                                  }

                                  let purchaseNotes = '';
                                  if (hasPurchaseInvoice) {
                                    const linkedPurId = payment.purchase_invoice_id;
                                    const purMatch = notesText.match(/PUR-\d+/);
                                    const purCode = purMatch ? purMatch[0] : null;
                                    purchaseNotes = (linkedPurId ? purchaseInvoiceNotes[linkedPurId] : null) || (purCode ? purchaseInvoiceNotes[purCode] : null) || '';
                                  }

                                  const adTypeSuffix = friendAdType ? ` - ${friendAdType}` : '';
                                  
                                  const barterLabel = hasPurchaseInvoice 
                                    ? `مقايضة - ${purchaseNotes || 'فاتورة مشتريات'}`
                                    : (friendContractNum 
                                      ? `مقايضة - إيجار عقد #${friendContractNum}${adTypeSuffix}` 
                                      : 'مقايضة - إيجار لوحة');
                                  return (
                                    <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300 text-[10px] gap-1 px-1.5 py-0 font-bold">
                                      {barterLabel}
                                    </Badge>
                                  );
                                })()}
                              </div>
                              {payment.company_name && (
                                <span className="text-[11px] text-muted-foreground mt-0.5">{payment.company_name}</span>
                              )}
                              {payment.notes && (
                                <span className="text-[11px] text-muted-foreground/80 mt-0.5 font-medium">{payment.notes}</span>
                              )}
                            </div>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            <Badge className={`${getEntryTypeStyle(payment.entry_type)} text-xs font-bold`}>{getEntryTypeText(payment.entry_type)}</Badge>
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {payment.ad_type ? <Badge variant="outline" className="text-[10px] font-bold">{payment.ad_type}</Badge> : <span className="text-muted-foreground/60">—</span>}
                          </td>
                          <td className={`px-4 py-3.5 text-center font-bold text-[15px] font-numbers ${Number(payment.amount) < 0 ? 'text-rose-600' : ''}`}>
                            {(Number(payment.amount) || 0).toLocaleString('en-US')} <span className="text-xs font-semibold text-muted-foreground">د.ل</span>
                          </td>
                          <td className={`px-4 py-3.5 text-center font-bold font-numbers ${(payment.remaining_debt || 0) > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                            {(payment.remaining_debt || 0).toLocaleString('en-US')}
                          </td>
                          <td className="px-4 py-3.5 text-center text-xs text-primary font-bold font-numbers">
                            {payment.contract_number ? `#${payment.contract_number}` : '—'}
                          </td>
                          <td className="px-4 py-3.5 text-center text-xs text-muted-foreground font-medium">
                            {payment.method || '—'}
                          </td>
                          <td className="px-4 py-3.5 text-center"></td>
                        </tr>
                      );
                    }
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
          onPrintCombined={() => toast.info('طباعة مجمعة قيد التطوير')}
          onPrintIndividual={() => toast.info('طباعة فردية قيد التطوير')}
          onDelete={async () => {
            const distId = selectedDistributedPayments[0]?.distributed_payment_id;
            if (!distId) { toast.error('معرف الدفعة غير موجود'); return; }
            if (!window.confirm('هل أنت متأكد من حذف الدفعة الموزعة بالكامل؟ سيتم حذف كل توزيعاتها وأي مصروفات مرتبطة بها سترجع لحالة "غير مسدد" تلقائياً.')) return;
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
          onEdit={() => {
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
