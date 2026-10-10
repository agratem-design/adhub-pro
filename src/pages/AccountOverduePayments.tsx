import { BrowserWhatsAppBatchDialog } from "@/components/billing/BrowserWhatsAppBatch";
import { OverdueWorkspace } from '@/components/billing/OverdueWorkspace';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertCircle, Clock, DollarSign, User, CreditCard, Receipt, TrendingDown, MessageCircle, ArrowUpDown, Calendar, Search, Filter, CheckCircle, Loader2, Coins, Users, Send, Check, Copy } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import { useSendWhatsApp } from '@/hooks/useSendWhatsApp';
import { calculateTotalRemainingDebt, filterCompositeRelatedPrintedInvoices } from '@/components/billing/BillingUtils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface UnpaidInvoice {
  invoiceId: string;
  contractNumber: string | null;
  customerName: string;
  customerId: string | null;
  amount: number;
  createdAt: string;
  daysOverdue: number;
  adType?: string;
  type: 'printed' | 'sales' | 'composite';
  invoiceNumber?: string;
  notes?: string;
  invoiceName?: string;
}

interface CustomerAccountOverdue {
  customerId: string | null;
  customerName: string;
  totalOverdue: number;
  invoicesCount: number;
  oldestDate: string;
  oldestDaysOverdue: number;
  invoices: UnpaidInvoice[];
}

export default function AccountOverduePayments() {
  const navigate = useNavigate();
  const [customers, setCustomers] = useState<CustomerAccountOverdue[]>([]);
  const [loading, setLoading] = useState(true);
  const [phoneMap, setPhoneMap] = useState<Map<string, string>>(new Map());
  const { sendMessage: sendWhatsApp } = useSendWhatsApp();
  const [sendingId, setSendingId] = useState<string | null>(null);

  const [whatsappChoiceDialog, setWhatsappChoiceDialog] = useState<{
    open: boolean;
    invoice: UnpaidInvoice | null;
    customer: CustomerAccountOverdue | null;
  }>({
    open: false,
    invoice: null,
    customer: null,
  });
  const [copied, setCopied] = useState(false);

  // فلاتر
  const [searchTerm, setSearchTerm] = useState('');
  const [minDays, setMinDays] = useState<number>(0);
  const [minAmount, setMinAmount] = useState<string>('');
  const [sortBy, setSortBy] = useState<'oldest' | 'newest'>('oldest');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const [initialPrintedRes, initialSalesRes, initialCompositeRes] = await Promise.all([
        supabase
          .from('printed_invoices')
          .select(`id, contract_number, customer_name, customer_id, total_amount, created_at, paid, notes`)
          .eq('paid', false),
        supabase
          .from('sales_invoices')
          .select(`id, invoice_number, invoice_name, customer_name, customer_id, total_amount, remaining_amount, paid_amount, created_at, invoice_date, paid, notes`)
          .eq('paid', false),
        supabase
          .from('composite_tasks')
          .select(`id, task_number, customer_name, customer_id, customer_total, paid_amount, discount_amount, created_at, status, contract_id, combined_invoice_id, installation_task_id`)
          .is('combined_invoice_id', null)
          .neq('status', 'cancelled')
      ]);

      if (initialPrintedRes.error) {
        console.error('Error loading unpaid printed invoices:', initialPrintedRes.error);
        toast.error('خطأ في تحميل فواتير الطباعة');
        return;
      }
      if (initialSalesRes.error) {
        console.error('Error loading unpaid sales invoices:', initialSalesRes.error);
        toast.error('خطأ في تحميل فواتير المبيعات');
        return;
      }
      if (initialCompositeRes.error) {
        console.error('Error loading composite tasks:', initialCompositeRes.error);
        toast.error('خطأ في تحميل المهام المجمعة');
        return;
      }

      const invoices = initialPrintedRes.data || [];

      // ✅ جلب خصومات المهام المجمعة المرتبطة بهذه الفواتير
      const invoiceIds = invoices.map((i: any) => i.id);
      const ctDiscountByInvoice = new Map<string, number>();
      const ctByInvoice = new Map<string, { customerTotal: number; paid: number; discount: number }>();
      if (invoiceIds.length) {
        const { data: ctRows } = await supabase
          .from('composite_tasks')
          .select('combined_invoice_id, discount_amount')
          .in('combined_invoice_id', invoiceIds);
        (ctRows || []).forEach((r: any) => {
          if (r.combined_invoice_id) {
            ctDiscountByInvoice.set(
              r.combined_invoice_id,
              (ctDiscountByInvoice.get(r.combined_invoice_id) || 0) + (Number(r.discount_amount) || 0)
            );
          }
        });

        // اجلب print_tasks المرتبطة بهذه الفواتير
        const { data: ptRows } = await supabase
          .from('print_tasks')
          .select('id, invoice_id')
          .in('invoice_id', invoiceIds);
        const ptToInvoice = new Map<string, string>();
        (ptRows || []).forEach((pt: any) => {
          if (pt.invoice_id) ptToInvoice.set(pt.id, pt.invoice_id);
        });
        const ptIds = Array.from(ptToInvoice.keys());
        if (ptIds.length) {
          const { data: ctLinked } = await supabase
            .from('composite_tasks')
            .select('print_task_id, customer_total, paid_amount, discount_amount')
            .in('print_task_id', ptIds);
          (ctLinked || []).forEach((ct: any) => {
            const invId = ct.print_task_id ? ptToInvoice.get(ct.print_task_id) : null;
            if (!invId) return;
            const prev = ctByInvoice.get(invId) || { customerTotal: 0, paid: 0, discount: 0 };
            ctByInvoice.set(invId, {
              customerTotal: prev.customerTotal + (Number(ct.customer_total) || 0),
              paid: prev.paid + (Number(ct.paid_amount) || 0),
              discount: prev.discount + (Number(ct.discount_amount) || 0),
            });
          });
        }
      }

      // Fetch all contract IDs from sub-tasks (installation task items and tasks) for composite tasks
      const ctInstallTaskIds = (initialCompositeRes.data || [])
        .map((ct: any) => ct.installation_task_id)
        .filter(Boolean) as string[];

      const compositeTaskToContracts = new Map<string, number[]>();
      
      const realInstallMap = new Map<string, number>();

      if (ctInstallTaskIds.length > 0) {
        const [installItemsRes, installTasksRes] = await Promise.all([
          supabase
            .from('installation_task_items')
            .select('task_id, customer_installation_cost, reinstall_count, customer_original_install_cost, customer_reinstall_cost, billboard:billboards!installation_task_items_billboard_id_fkey(Contract_Number)')
            .in('task_id', ctInstallTaskIds),
          supabase
            .from('installation_tasks')
            .select('id, contract_ids, contract_id')
            .in('id', ctInstallTaskIds)
        ]);

        const installItems = installItemsRes.data || [];
        const installTasksData = installTasksRes.data || [];

        // حساب تكاليف التركيب الحقيقية لكل مهمة مجمعة
        installItems.forEach((row: any) => {
          const isReinstalled = (row.reinstall_count || 0) > 0;
          const origCost = Number(row.customer_original_install_cost) || Number(row.customer_installation_cost) || 0;
          const reinstallCost = isReinstalled
            ? (Number(row.customer_reinstall_cost) || Number(row.customer_installation_cost) || 0)
            : 0;
          const itemCost = isReinstalled ? (origCost + reinstallCost) : Number(row.customer_installation_cost) || 0;
          realInstallMap.set(row.task_id, (realInstallMap.get(row.task_id) || 0) + itemCost);
        });

        const installTaskToContracts = new Map<string, Set<number>>();
        installTasksData.forEach((it: any) => {
          const ids = it.contract_ids || (it.contract_id ? [it.contract_id] : []);
          if (ids && ids.length > 0) {
            installTaskToContracts.set(it.id, new Set(ids.map(Number)));
          }
        });

        installItems.forEach((row: any) => {
          const taskId = row.task_id as string;
          const contractNo = row.billboard?.Contract_Number;
          if (taskId && contractNo) {
            if (!installTaskToContracts.has(taskId)) {
              installTaskToContracts.set(taskId, new Set());
            }
            installTaskToContracts.get(taskId)!.add(Number(contractNo));
          }
        });

        (initialCompositeRes.data || []).forEach((ct: any) => {
          const set = ct.installation_task_id ? installTaskToContracts.get(ct.installation_task_id) : undefined;
          const derived = set ? Array.from(set) : [];
          const existing = ct.contract_id ? [ct.contract_id] : [];
          const combined = [...new Set([...existing, ...derived])].filter(Boolean);
          if (combined.length > 0) {
            compositeTaskToContracts.set(ct.id, combined);
          }
        });
      }

      // جلب أنواع الإعلانات من جدول العقود بشكل منفصل (تشمل عقود فواتير الطباعة وعقود المهام المجمعة)
      const contractNumbers = Array.from(
        new Set([
          ...invoices.flatMap((i: any) => {
            const nums = [];
            if (i.contract_number != null) nums.push(Number(i.contract_number));
            if (i.contract_numbers) {
              String(i.contract_numbers).split(',').forEach(numStr => {
                const n = Number(numStr.trim());
                if (!isNaN(n)) nums.push(n);
              });
            }
            return nums;
          }),
          ...(initialCompositeRes.data || []).flatMap((ct: any) => {
            const ids = compositeTaskToContracts.get(ct.id) || (ct.contract_id ? [ct.contract_id] : []);
            return ids;
          })
        ].filter((n: any) => n != null))
      );
      const contractCustomerMap = new Map<number, { adType: string; customerId: string | null; customerName: string }>();
      if (contractNumbers.length) {
        const { data: contracts } = await supabase
          .from('Contract')
          .select('Contract_Number, "Ad Type", "Customer Name", customer_id')
          .in('Contract_Number', contractNumbers as any);
        (contracts || []).forEach((c: any) => {
          if (c.Contract_Number != null) {
            contractCustomerMap.set(Number(c.Contract_Number), {
              adType: c['Ad Type'] || '',
              customerId: c.customer_id || null,
              customerName: c['Customer Name'] || '',
            });
          }
        });
      }

      const getAdTypeDisplay = (contractNumberStr: string | null, targetCustomerId?: string | null, targetCustomerName?: string) => {
        if (!contractNumberStr) return undefined;
        const parts = contractNumberStr.split(',').map(s => s.trim());
        const adTypes = parts
          .map(p => {
            const num = Number(p);
            const cInfo = contractCustomerMap.get(num);
            if (!cInfo) return null;
            if (targetCustomerId || targetCustomerName) {
              const customerIdMatches = targetCustomerId && cInfo.customerId && targetCustomerId === cInfo.customerId;
              const customerNameMatches = targetCustomerName && cInfo.customerName && targetCustomerName === cInfo.customerName;
              if (!customerIdMatches && !customerNameMatches) return null;
            }
            return cInfo.adType;
          })
          .filter(Boolean);
        return adTypes.length ? Array.from(new Set(adTypes)).join(' - ') : undefined;
      };

      const today = new Date();
      const map = new Map<string, CustomerAccountOverdue>();

      // 1. إضافة فواتير الطباعة
      for (const inv of invoices) {
        const createdAt = inv.created_at as string;
        const diffDays = Math.ceil((today.getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
        const rawAmount = Number(inv.total_amount) || 0;
        const ctDisc = ctDiscountByInvoice.get(inv.id) || 0;
        const ctInfo = ctByInvoice.get(inv.id);
        let effectiveAmount: number;
        if (ctInfo && ctInfo.customerTotal > 0) {
          effectiveAmount = Math.max(0, ctInfo.customerTotal - ctInfo.paid);
        } else {
          effectiveAmount = Math.max(0, rawAmount - ctDisc);
        }
        if (effectiveAmount <= 0.5) continue;
        
        const rawContracts = inv.contract_numbers 
          ? String(inv.contract_numbers).split(',').map(s => s.trim()).filter(Boolean)
          : (inv.contract_number != null ? [String(inv.contract_number)] : []);
        
        // Filter contracts to only those belonging to this customer
        const filteredContracts = rawContracts.filter(cStr => {
          const num = Number(cStr);
          const cInfo = contractCustomerMap.get(num);
          if (!cInfo) return true;
          if (cInfo.customerId && inv.customer_id) {
            return cInfo.customerId === inv.customer_id;
          }
          return cInfo.customerName === inv.customer_name;
        });

        const cNumStr = filteredContracts.length > 0 ? filteredContracts.join(',') : null;
        const item: UnpaidInvoice = {
          invoiceId: inv.id,
          contractNumber: cNumStr,
          customerName: inv.customer_name || 'غير معروف',
          customerId: inv.customer_id,
          amount: effectiveAmount,
          createdAt,
          daysOverdue: diffDays,
          adType: getAdTypeDisplay(cNumStr, inv.customer_id, inv.customer_name),
          type: 'printed',
          notes: inv.notes || undefined,
        };

        const key = item.customerId || item.customerName;
        if (!map.has(key)) {
          map.set(key, {
            customerId: item.customerId,
            customerName: item.customerName,
            totalOverdue: 0,
            invoicesCount: 0,
            oldestDate: item.createdAt,
            oldestDaysOverdue: item.daysOverdue,
            invoices: [],
          });
        }
        const c = map.get(key)!;
        c.invoices.push(item);
        c.totalOverdue += item.amount;
        c.invoicesCount += 1;
        if (new Date(item.createdAt) < new Date(c.oldestDate)) {
          c.oldestDate = item.createdAt;
          c.oldestDaysOverdue = item.daysOverdue;
        }
      }

      // 2. إضافة فواتير المبيعات
      for (const sale of initialSalesRes.data || []) {
        const createdAt = sale.invoice_date || sale.created_at || new Date().toISOString();
        const diffDays = Math.ceil((today.getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
        const amount = Number(sale.remaining_amount ?? (Number(sale.total_amount) - Number(sale.paid_amount || 0))) || 0;
        if (amount <= 0.5) continue;

        const item: UnpaidInvoice = {
          invoiceId: sale.id,
          contractNumber: null,
          customerName: sale.customer_name || 'غير معروف',
          customerId: sale.customer_id,
          amount: amount,
          createdAt,
          daysOverdue: diffDays,
          type: 'sales',
          invoiceNumber: sale.invoice_number || undefined,
          notes: sale.notes || undefined,
          invoiceName: sale.invoice_name || undefined,
        };

        const key = item.customerId || item.customerName;
        if (!map.has(key)) {
          map.set(key, {
            customerId: item.customerId,
            customerName: item.customerName,
            totalOverdue: 0,
            invoicesCount: 0,
            oldestDate: item.createdAt,
            oldestDaysOverdue: item.daysOverdue,
            invoices: [],
          });
        }
        const c = map.get(key)!;
        c.invoices.push(item);
        c.totalOverdue += item.amount;
        c.invoicesCount += 1;
        if (new Date(item.createdAt) < new Date(c.oldestDate)) {
          c.oldestDate = item.createdAt;
          c.oldestDaysOverdue = item.daysOverdue;
        }
      }

      // 3. إضافة المهام المجمعة غير المسددة بالكامل
      for (const ct of initialCompositeRes.data || []) {
        const createdAt = ct.created_at as string;
        const diffDays = Math.ceil((today.getTime() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24));
        const realInstallTotal = ct.installation_task_id && realInstallMap.has(ct.installation_task_id)
          ? realInstallMap.get(ct.installation_task_id)!
          : null;
        const total = realInstallTotal !== null
          ? (realInstallTotal + (Number(ct.customer_print_cost) || 0) + (Number(ct.customer_cutout_cost) || 0) - (Number(ct.discount_amount) || 0))
          : (Number(ct.customer_total) || 0);
        const paid = Number(ct.paid_amount) || 0;
        const amount = Math.max(0, total - paid);
        if (amount <= 0.5) continue;

        const rawTaskContracts = compositeTaskToContracts.get(ct.id) || (ct.contract_id ? [ct.contract_id] : []);
        
        // Filter contracts to only keep those belonging to this customer
        const taskContracts = rawTaskContracts.filter(cNum => {
          const cInfo = contractCustomerMap.get(cNum);
          if (!cInfo) return true;
          if (cInfo.customerId && ct.customer_id) {
            return cInfo.customerId === ct.customer_id;
          }
          return cInfo.customerName === ct.customer_name;
        });

        const cNumStr = taskContracts.length > 0 ? taskContracts.join(',') : null;
        const item: UnpaidInvoice = {
          invoiceId: ct.id,
          contractNumber: cNumStr,
          customerName: ct.customer_name || 'غير معروف',
          customerId: ct.customer_id,
          amount: amount,
          createdAt,
          daysOverdue: diffDays,
          adType: getAdTypeDisplay(cNumStr, ct.customer_id, ct.customer_name),
          type: 'composite',
          invoiceNumber: ct.task_number ? `مهمة #${ct.task_number}` : undefined,
        };

        const key = item.customerId || item.customerName;
        if (!map.has(key)) {
          map.set(key, {
            customerId: item.customerId,
            customerName: item.customerName,
            totalOverdue: 0,
            invoicesCount: 0,
            oldestDate: item.createdAt,
            oldestDaysOverdue: item.daysOverdue,
            invoices: [],
          });
        }
        const c = map.get(key)!;
        c.invoices.push(item);
        c.totalOverdue += item.amount;
        c.invoicesCount += 1;
        if (new Date(item.createdAt) < new Date(c.oldestDate)) {
          c.oldestDate = item.createdAt;
          c.oldestDaysOverdue = item.daysOverdue;
        }
      }

      const result = Array.from(map.values()).sort((a, b) => b.oldestDaysOverdue - a.oldestDaysOverdue);

      // ✅ استبعاد العملاء الذين رصيدهم الفعلي صفر
      const customerIds = result.map(r => r.customerId).filter((x): x is string => !!x);
      const remainingMap = new Map<string, number>();
      if (customerIds.length) {
        const [
          contractsRes,
          paymentsRes,
          salesRes,
          printedRes,
          purchasesRes,
          discountsRes,
          compositeRes,
          printTasksRes,
          cutoutTasksRes,
          customersRes,
          friendCompaniesRes,
          friendRentalsRes
        ] = await Promise.all([
          supabase.from('Contract').select('Total, customer_id, Contract_Number, friend_rental_data, "Contract Date"').in('customer_id', customerIds),
          supabase.from('customer_payments').select('customer_id, amount, entry_type, sales_invoice_id, printed_invoice_id, purchase_invoice_id, notes, distributed_payment_id').in('customer_id', customerIds),
          supabase.from('sales_invoices').select('customer_id, total_amount').in('customer_id', customerIds),
          supabase.from('printed_invoices').select('id, customer_id, total_amount, included_in_contract, invoice_type').in('customer_id', customerIds),
          supabase.from('purchase_invoices').select('customer_id, total_amount, used_as_payment').in('customer_id', customerIds),
          supabase.from('customer_general_discounts').select('customer_id, discount_value').eq('status', 'active').in('customer_id', customerIds),
          supabase.from('composite_tasks').select('id, customer_id, customer_total, combined_invoice_id, print_task_id, discount_amount').in('customer_id', customerIds),
          supabase.from('print_tasks').select('id, customer_id, invoice_id, is_composite, installation_task_id, composite_task_id').in('customer_id', customerIds),
          supabase.from('cutout_tasks').select('id, customer_id, invoice_id, is_composite, installation_task_id').in('customer_id', customerIds),
          supabase.from('customers').select('id, name, linked_friend_company_id').in('id', customerIds),
          supabase.from('friend_companies').select('id, name'),
          supabase.from('friend_billboard_rentals').select('*')
        ]);

        const byCustomer = <T extends { customer_id: string | null }>(rows: T[] | null) => {
          const m = new Map<string, T[]>();
          (rows || []).forEach((r) => {
            if (!r.customer_id) return;
            const arr = m.get(r.customer_id) || [];
            arr.push(r);
            m.set(r.customer_id, arr);
          });
          return m;
        };

        const cMap = byCustomer((contractsRes.data as any[]) || []);
        const pMap = byCustomer((paymentsRes.data as any[]) || []);
        const sMap = byCustomer((salesRes.data as any[]) || []);
        const piMap = byCustomer((printedRes.data as any[]) || []);
        const puMap = byCustomer((purchasesRes.data as any[]) || []);
        const dMap = byCustomer((discountsRes.data as any[]) || []);
        const ctMap = byCustomer((compositeRes.data as any[]) || []);
        const ptMap = byCustomer((printTasksRes.data as any[]) || []);
        const coMap = byCustomer((cutoutTasksRes.data as any[]) || []);

        const customersList = customersRes.data || [];
        const friendCompaniesList = friendCompaniesRes.data || [];
        const friendRentalsList = friendRentalsRes.data || [];

        for (const cid of customerIds) {
          const contracts = cMap.get(cid) || [];
          const payments = pMap.get(cid) || [];
          const sales = sMap.get(cid) || [];
          const printed = piMap.get(cid) || [];
          const purchases = puMap.get(cid) || [];
          const discounts = dMap.get(cid) || [];
          const composites = ctMap.get(cid) || [];
          const printTasks = ptMap.get(cid) || [];
          const cutoutTasks = coMap.get(cid) || [];

          // حساب إيجارات الشركات الصديقة
          let friendRentals = 0;
          const addedFriendBillboardRentals = new Set<string>();
          const addedFriendRentalGroups = new Set<string>();
          
          const customerObj = customersList.find((c: any) => c.id === cid);
          const linkedFriendCompanyId = customerObj?.linked_friend_company_id || null;
          const friendCompany = friendCompaniesList.find((fc: any) => fc.id === linkedFriendCompanyId);
          const linkedFriendCompanyName = friendCompany?.name || null;

          if (linkedFriendCompanyId) {
            // 1. إضافة من جدول friend_billboard_rentals
            const dbFriendRentals = friendRentalsList.filter((r: any) => r.friend_company_id === linkedFriendCompanyId);
            dbFriendRentals.forEach((rental: any) => {
              const rentalCost = Number(rental.friend_rental_cost) || Number(rental.customer_rental_price) || 0;
              const usedAsPayment = Number(rental.used_as_payment) || 0;
              const remainingAmount = Math.max(0, rentalCost - usedAsPayment);
              
              if (remainingAmount > 0) {
                friendRentals += remainingAmount;
                const contractNum = Number(rental.contract_number);
                const startDate = rental.start_date || '';
                const billboardId = rental.billboard_id;
                
                if (contractNum && billboardId) {
                  addedFriendBillboardRentals.add(`${Number(contractNum)}_${String(billboardId).trim()}`);
                }
                if (contractNum && !isNaN(contractNum)) {
                  addedFriendRentalGroups.add(`${contractNum}_${startDate}`);
                }
              }
            });
            
            // 2. إضافة من JSON العقود (مع التصفية والدبلرة)
            if (linkedFriendCompanyName) {
              for (const contract of contracts) {
                const friendData = contract.friend_rental_data as any;
                if (friendData) {
                  const items = typeof friendData === 'string' ? (() => { try { return JSON.parse(friendData); } catch { return []; } })() : friendData;
                  
                  const groupedByDate = new Map<string, number>();

                  const processItem = (cost: number, name: string | null, startDate: string, billboardId: any) => {
                    if (!name || name.trim() !== linkedFriendCompanyName.trim()) return;
                    
                    const isAlreadyAdded = billboardId && addedFriendBillboardRentals.has(`${Number(contract.Contract_Number)}_${String(billboardId).trim()}`);
                    if (isAlreadyAdded) return;
                    
                    const currentSum = groupedByDate.get(startDate) || 0;
                    groupedByDate.set(startDate, currentSum + cost);
                  };

                  if (Array.isArray(items)) {
                    for (const item of items) {
                      const cost = Number(item.friendRentalCost || item.friend_rental_cost || 0);
                      if (cost > 0) {
                        const name = item.friendCompanyName || item.friend_company_name || null;
                        const startDate = item.startDate || item.start_date || contract['Contract Date'] || '';
                        const bId = item.billboardId || item.billboard_id || null;
                        processItem(cost, name, startDate, bId);
                      }
                    }
                  } else if (typeof items === 'object') {
                    const entries = Object.entries(items) as [string, any][];
                    for (const [bId, entry] of entries) {
                      if (entry && typeof entry.rental_cost === 'number' && entry.rental_cost > 0) {
                        const name = entry.company_name || null;
                        const startDate = entry.startDate || entry.start_date || contract['Contract Date'] || '';
                        processItem(entry.rental_cost, name, startDate, bId);
                      }
                    }
                  }

                  // إضافة التكاليف المجمعة لكل تاريخ بدء
                  groupedByDate.forEach((totalCost, startDate) => {
                    const groupKey = `${contract.Contract_Number}_${startDate}`;
                    if (totalCost > 0 && !addedFriendRentalGroups.has(groupKey)) {
                      friendRentals += totalCost;
                      addedFriendRentalGroups.add(groupKey);
                    }
                  });
                }
              }
            }
          }

          // تصفية فواتير الطباعة التابعة للمهام المجمعة لتفادي الازدواجية
          const billablePrintedInvoices = filterCompositeRelatedPrintedInvoices(
            printed,
            composites,
            printTasks,
            cutoutTasks
          );

          // ✅ تصفية الفواتير في كائن العميل لتفادي عرض الفواتير المكررة
          const customerAcc = map.get(cid);
          if (customerAcc) {
            const billablePrintedIds = new Set(billablePrintedInvoices.map(inv => inv.id));
            customerAcc.invoices = customerAcc.invoices.filter(inv => {
              if (inv.type === 'printed') {
                return billablePrintedIds.has(inv.invoiceId);
              }
              return true;
            });
            customerAcc.invoicesCount = customerAcc.invoices.length;
            
            if (customerAcc.invoices.length > 0) {
              const oldestInvoice = customerAcc.invoices.reduce((oldest, current) => 
                current.daysOverdue > oldest.daysOverdue ? current : oldest
              , customerAcc.invoices[0]);
              customerAcc.oldestDate = oldestInvoice.createdAt;
              customerAcc.oldestDaysOverdue = oldestInvoice.daysOverdue;
            } else {
              customerAcc.oldestDaysOverdue = 0;
            }
          }

          const totalDiscounts = discounts.reduce((sum: number, d: any) => sum + (Number(d.discount_value) || 0), 0);

          // حساب المتبقي الإجمالي المعياري الصحيح
          const remaining = calculateTotalRemainingDebt(
            contracts,
            payments,
            sales,
            billablePrintedInvoices,
            purchases,
            totalDiscounts,
            composites,
            friendRentals
          );

          remainingMap.set(cid, remaining);
        }
      }

      const filteredResult = result.filter((r) => {
        if (!r.customerId) return true;
        const rem = remainingMap.get(r.customerId);
        if (rem == null) return true;
        return rem > 0.5 && r.invoices.length > 0;
      }).map((r) => {
        if (!r.customerId) return r;
        const rem = remainingMap.get(r.customerId);
        if (rem == null) return r;
        const filteredSum = r.invoices.reduce((sum, inv) => sum + inv.amount, 0);
        return { 
          ...r, 
          totalOverdue: Math.min(filteredSum, Math.max(0, rem)) 
        };
      }).filter(r => r.totalOverdue > 0.5);

      setCustomers(filteredResult);

      const customerNames = filteredResult.filter(r => !r.customerId).map(r => r.customerName);
      const pm = new Map<string, string>();
      if (customerIds.length) {
        const { data: cs } = await supabase.from('customers').select('id, phone').in('id', customerIds);
        (cs || []).forEach((c: any) => { if (c.phone) pm.set(c.id, c.phone); });
      }
      if (customerNames.length) {
        const { data: cs } = await supabase.from('customers').select('name, phone').in('name', customerNames);
        (cs || []).forEach((c: any) => { if (c.phone) pm.set(c.name, c.phone); });
      }
      setPhoneMap(pm);
    } catch (e) {
      console.error(e);
      toast.error('خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const sortedAndFiltered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const minAmt = parseFloat(minAmount || '0') || 0;
    
    const items = customers.filter(c =>
      (!term || c.customerName.toLowerCase().includes(term)) &&
      c.oldestDaysOverdue >= minDays &&
      c.totalOverdue >= minAmt
    );

    return [...items].sort((a, b) => {
      if (sortBy === 'oldest') {
        return b.oldestDaysOverdue - a.oldestDaysOverdue; // أقدم تأخير أولاً (رقم تأخير كبير)
      } else {
        return a.oldestDaysOverdue - b.oldestDaysOverdue; // أحدث تأخير أولاً (رقم تأخير صغير)
      }
    });
  }, [customers, searchTerm, minDays, minAmount, sortBy]);

  const totalAmount = sortedAndFiltered.reduce((s, c) => s + c.totalOverdue, 0);
  const totalInvoices = sortedAndFiltered.reduce((s, c) => s + c.invoicesCount, 0);

  const getPhone = (c: { customerId: string | null; customerName: string }) =>
    (c.customerId && phoneMap.get(c.customerId)) || phoneMap.get(c.customerName) || '';

  const formatPhone = (phone: string): string => {
    // Keep only numeric digits (strips spaces, hyphens, and invisible directional isolate characters)
    let cleaned = phone.replace(/\D/g, '');
    if (cleaned.startsWith('09') && cleaned.length === 10) {
      cleaned = '218' + cleaned.substring(1);
    } else if (cleaned.startsWith('9') && cleaned.length === 9) {
      cleaned = '218' + cleaned;
    }
    return cleaned;
  };

  const generateWhatsAppLink = (phone: string, message: string): string => {
    return `https://wa.me/${formatPhone(phone)}?text=${encodeURIComponent(message)}`;
  };

  const getInvoiceMessageText = (inv: UnpaidInvoice) => {
    const dateStr = new Date(inv.createdAt).toLocaleDateString('ar-LY');
    let typeName = 'فاتورة غير مسددة';
    let docRef = '';
    if (inv.type === 'printed') {
      typeName = 'فاتورة طباعة غير مسددة';
      if (inv.notes) typeName += ` (${inv.notes})`;
      if (inv.contractNumber) {
        docRef = inv.contractNumber.includes(',')
          ? `\n- عقود رقم: #${inv.contractNumber.split(',').join(', #')}`
          : `\n- عقد رقم: #${inv.contractNumber}`;
      }
      if (inv.adType) docRef += `\n- نوع الإعلان: ${inv.adType}`;
    } else if (inv.type === 'sales') {
      typeName = 'فاتورة مبيعات غير مسددة';
      if (inv.invoiceName) typeName += ` - ${inv.invoiceName}`;
      if (inv.notes) typeName += ` (${inv.notes})`;
      if (inv.invoiceNumber) docRef = `\n- رقم الفاتورة: ${inv.invoiceNumber}`;
    } else if (inv.type === 'composite') {
      typeName = 'مهمة مجمعة غير مسددة';
      if (inv.invoiceNumber) docRef = `\n- مرجع المهمة: ${inv.invoiceNumber}`;
      if (inv.contractNumber) {
        docRef += inv.contractNumber.includes(',')
          ? `\n- عقود رقم: #${inv.contractNumber.split(',').join(', #')}`
          : `\n- عقد رقم: #${inv.contractNumber}`;
      }
      if (inv.adType) docRef += `\n- نوع الإعلان: ${inv.adType}`;
    }
    return `السلام عليكم ورحمة الله وبركاته\n\nالسيد/ ${inv.customerName} المحترم،\n\nنود تذكيركم بـ ${typeName}:\n- تاريخ الإصدار: ${dateStr}\n- أيام التأخير: ${inv.daysOverdue} يوم\n- المبلغ: ${inv.amount.toLocaleString('en-US')} د.ل${docRef}\n\nنرجو المبادرة بالسداد.\n\nشكراً لتعاونكم.`;
  };

  const getComprehensiveMessageText = (customer: CustomerAccountOverdue) => {
    let invoiceDetails = '';
    customer.invoices.forEach((inv, index) => {
      const dateStr = new Date(inv.createdAt).toLocaleDateString('ar-LY');
      let typeName = '';
      let details = [];
      
      if (inv.type === 'printed') {
        typeName = 'فاتورة طباعة';
        if (inv.notes) typeName += ` (${inv.notes})`;
        if (inv.contractNumber) {
          details.push(inv.contractNumber.includes(',')
            ? `عقود #${inv.contractNumber.split(',').join(', #')}`
            : `عقد #${inv.contractNumber}`);
        }
      } else if (inv.type === 'sales') {
        typeName = 'فاتورة مبيعات';
        if (inv.invoiceName) typeName += ` - ${inv.invoiceName}`;
        if (inv.notes) typeName += ` (${inv.notes})`;
        if (inv.invoiceNumber) details.push(`رقم ${inv.invoiceNumber}`);
      } else if (inv.type === 'composite') {
        typeName = 'مهمة مجمعة';
        if (inv.invoiceNumber) details.push(`${inv.invoiceNumber}`);
        if (inv.contractNumber) {
          details.push(inv.contractNumber.includes(',')
            ? `عقود #${inv.contractNumber.split(',').join(', #')}`
            : `عقد #${inv.contractNumber}`);
        }
      }
      
      if (inv.adType) {
        details.push(`نوع الإعلان: ${inv.adType}`);
      }
      
      const detailsStr = details.length ? ` (${details.join(' - ')})` : '';
      invoiceDetails += `${index + 1}. ${typeName}${detailsStr}:\n`;
      invoiceDetails += `   - تاريخ الإصدار: ${dateStr}\n`;
      invoiceDetails += `   - أيام التأخير: ${inv.daysOverdue} يوم\n`;
      invoiceDetails += `   - المبلغ المطلوب: ${inv.amount.toLocaleString('en-US')} د.ل\n\n`;
    });
    
    return `السلام عليكم ورحمة الله وبركاته\n\nالسيد/ ${customer.customerName} المحترم،\n\nنود تذكيركم بمتأخرات الحساب والفواتير غير المسددة طرفكم بقيمة إجمالية قدرها (${customer.totalOverdue.toLocaleString('en-US')} د.ل) وتفصيلها كالتالي:\n\n${invoiceDetails}نرجو التكرم بالمبادرة بسداد المبالغ المستحقة في أقرب وقت.\n\nشكراً لحسن تعاونكم.`;
  };

  const sendInvoiceWhatsApp = async (inv: UnpaidInvoice) => {
    const phone = getPhone(inv);
    if (!phone) { toast.error('لا يوجد رقم هاتف مسجل لهذا الزبون'); return; }
    setSendingId(inv.invoiceId);
    try {
      const message = getInvoiceMessageText(inv);
      await sendWhatsApp({ phone, message });
    } catch (e) {
      console.error(e);
    } finally {
      setSendingId(null);
    }
  };

  const sendComprehensiveWhatsApp = async (customer: CustomerAccountOverdue) => {
    const phone = getPhone(customer);
    if (!phone) { toast.error('لا يوجد رقم هاتف مسجل لهذا الزبون'); return; }
    const idKey = customer.customerId || customer.customerName;
    setSendingId(idKey);
    try {
      const message = getComprehensiveMessageText(customer);
      await sendWhatsApp({ phone, message });
    } catch (e) {
      console.error(e);
    } finally {
      setSendingId(null);
    }
  };

  const markItemPaid = async (item: UnpaidInvoice) => {
    try {
      if (item.type === 'printed') {
        const { error } = await supabase.from('printed_invoices').update({ paid: true }).eq('id', item.invoiceId);
        if (error) throw error;
      } else if (item.type === 'sales') {
        const { error } = await supabase
          .from('sales_invoices')
          .update({ paid: true, remaining_amount: 0 })
          .eq('id', item.invoiceId);
        if (error) throw error;
      } else if (item.type === 'composite') {
        const { data: ct, error: getError } = await supabase
          .from('composite_tasks')
          .select('customer_total, discount_amount')
          .eq('id', item.invoiceId)
          .single();
        if (getError) throw getError;
        
        const total = Number(ct.customer_total) || 0;
        const discount = Number(ct.discount_amount) || 0;
        const targetPaid = Math.max(0, total - discount);
        
        const { error } = await supabase
          .from('composite_tasks')
          .update({ paid_amount: targetPaid })
          .eq('id', item.invoiceId);
        if (error) throw error;
      }
      toast.success('تم تسديد البند بنجاح');
      loadData();
    } catch (e) {
      console.error(e);
      toast.error('خطأ في تسديد البند');
    }
  };

  const getUrgencyBadge = (days: number) => {
    if (days >= 90) {
      return <Badge className="bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border border-red-500/20 font-semibold rounded-lg text-[10px] px-2.5 py-0.5">حرجة جداً (90+ يوم)</Badge>;
    } else if (days >= 30) {
      return <Badge className="bg-orange-500/10 text-orange-600 dark:text-orange-400 hover:bg-orange-500/20 border border-orange-500/20 font-semibold rounded-lg text-[10px] px-2.5 py-0.5">متأخرة (30+ يوم)</Badge>;
    } else if (days >= 7) {
      return <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20 border border-amber-500/20 font-semibold rounded-lg text-[10px] px-2.5 py-0.5">تنبيه (7+ أيام)</Badge>;
    }
    return <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 border border-emerald-500/20 font-semibold rounded-lg text-[10px] px-2.5 py-0.5">حديثة ({days} يوم)</Badge>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh] bg-background">
        <div className="flex flex-col items-center gap-4">
          <Clock className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground font-medium">جاري تحميل متأخرات الحسابات والفواتير...</p>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl">
      <OverdueWorkspace title="الفواتير والحسابات المتأخرة" description="راجع فواتير الطباعة والمبيعات والمهام المجمعة، مع المستحق الفعلي بعد احتساب رصيد الحساب." itemLabel="فواتير غير مسددة" totalAmount={totalAmount} totalItems={totalInvoices}
        headerAction={<BrowserWhatsAppBatchDialog recipients={sortedAndFiltered.map(customer=>({id:customer.customerId||customer.customerName,name:customer.customerName,phone:getPhone(customer),message:getComprehensiveMessageText(customer)}))}/>}
        search={searchTerm} onSearch={setSearchTerm} minDays={minDays} onMinDays={setMinDays} minAmount={minAmount} onMinAmount={setMinAmount} sort={sortBy} onSort={setSortBy} onRefresh={loadData}
        customers={sortedAndFiltered.map(customer=>({key:customer.customerId || customer.customerName,name:customer.customerName,amount:customer.totalOverdue,count:customer.invoicesCount,days:customer.oldestDaysOverdue,phone:getPhone(customer),
          onAccount:()=>navigate(`/admin/customer-billing?${customer.customerId?`id=${customer.customerId}&`:''}name=${encodeURIComponent(customer.customerName)}`),
          onReminder:()=>setWhatsappChoiceDialog({open:true,invoice:null,customer}),reminderDisabled:sendingId===(customer.customerId||customer.customerName)||!getPhone(customer),
          extra:customer.invoices.reduce((sum,invoice)=>sum+invoice.amount,0)-customer.totalOverdue>0.5?<div className="rounded-lg border border-info/25 bg-info/5 p-3 text-xs"><p className="font-semibold">رصيد الحساب محسوب في المستحق</p><p className="mt-1 leading-relaxed text-muted-foreground">مجموع أرصدة الفواتير {customer.invoices.reduce((sum,invoice)=>sum+invoice.amount,0).toLocaleString('ar-LY')} د.ل، والمستحق بعد تسوية رصيد الحساب {customer.totalOverdue.toLocaleString('ar-LY')} د.ل.</p></div>:undefined,
          items:customer.invoices.slice().sort((a,b)=>b.daysOverdue-a.daysOverdue).map(invoice=>({key:`${invoice.type}-${invoice.invoiceId}`,
            title:invoice.type==='printed'?'فاتورة طباعة':invoice.type==='sales'?`فاتورة مبيعات ${invoice.invoiceNumber||''}`:`مهمة مجمعة ${invoice.invoiceNumber?.replace(/^مهمة\s*/,'')||''}`,
            subtitle:[invoice.invoiceName,invoice.adType,invoice.notes].filter(Boolean).join(' · '),contract:invoice.contractNumber?`عقد #${invoice.contractNumber.split(',').join('، #')}`:undefined,amount:invoice.amount,date:invoice.createdAt,dateLabel:'تاريخ الإصدار',amountLabel:'متبقي الفاتورة',days:invoice.daysOverdue,
            onSettle:()=>markItemPaid(invoice),onReminder:()=>setWhatsappChoiceDialog({open:true,invoice,customer:null}),reminderDisabled:sendingId===invoice.invoiceId||!getPhone(invoice),
          })),
        }))}/>

      {/* WhatsApp Choice Dialog */}
      <Dialog open={whatsappChoiceDialog.open} onOpenChange={(open) => {
        setWhatsappChoiceDialog({ open, invoice: open ? whatsappChoiceDialog.invoice : null, customer: open ? whatsappChoiceDialog.customer : null });
        setCopied(false);
      }}>
        <DialogContent className="sm:max-w-md border-0 shadow-2xl rounded-2xl overflow-hidden p-0 bg-background" dir="rtl">
          <div className="bg-gradient-to-r from-emerald-600 to-teal-500 p-6 text-white relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full blur-2xl transform translate-x-8 -translate-y-8" />
            <DialogHeader className="space-y-1 relative z-10">
              <DialogTitle className="text-2xl font-bold flex items-center gap-3 text-white">
                <div className="bg-white/20 p-2 rounded-xl backdrop-blur-md">
                  <MessageCircle className="h-6 w-6 text-white animate-pulse" />
                </div>
                {whatsappChoiceDialog.invoice ? 'تنبيه الفاتورة المتأخرة' : 'تنبيه الحساب الموحد'}
              </DialogTitle>
              <p className="text-white/80 text-xs font-medium">إرسال إشعار تذكيري للزبون بمتأخرات الفواتير والخدمات</p>
            </DialogHeader>
          </div>
          
          <div className="p-6 space-y-5">
            {(whatsappChoiceDialog.invoice || whatsappChoiceDialog.customer) && (() => {
              const inv = whatsappChoiceDialog.invoice;
              const customer = whatsappChoiceDialog.customer;
              
              const phone = inv ? getPhone(inv) : (customer ? getPhone(customer) : '');
              const messageText = inv ? getInvoiceMessageText(inv) : (customer ? getComprehensiveMessageText(customer) : '');
              const waLink = phone ? generateWhatsAppLink(phone, messageText) : '#';

              const handleManualClick = (e: React.MouseEvent<HTMLAnchorElement>) => {
                if (!phone) {
                  e.preventDefault();
                  toast.error('لا يوجد رقم هاتف مسجل لهذا الزبون');
                  return;
                }
                setWhatsappChoiceDialog({ open: false, invoice: null, customer: null });
              };

              const handleApiWhatsApp = async () => {
                setWhatsappChoiceDialog({ open: false, invoice: null, customer: null });
                if (inv) {
                  await sendInvoiceWhatsApp(inv);
                } else if (customer) {
                  await sendComprehensiveWhatsApp(customer);
                }
              };

              const handleCopyText = () => {
                navigator.clipboard.writeText(messageText);
                setCopied(true);
                toast.success('تم نسخ نص الرسالة بنجاح');
                setTimeout(() => setCopied(false), 2000);
              };

              return (
                <>
                  <div className="flex items-center justify-between gap-4 p-4 rounded-xl bg-muted/40 border border-border/50 text-xs">
                    <div>
                      <span className="text-muted-foreground block mb-0.5">الزبون المستهدف</span>
                      <strong className="text-foreground text-sm block">{inv ? inv.customerName : (customer ? customer.customerName : '')}</strong>
                    </div>
                    <div className="text-left">
                      <span className="text-muted-foreground block mb-0.5">رقم الهاتف</span>
                      <strong className="text-foreground text-sm block">{phone || '—'}</strong>
                    </div>
                  </div>

                  <div className="space-y-2 relative">
                    <div className="flex items-center justify-between">
                      <Label className="text-xs font-bold text-muted-foreground">معاينة نص الرسالة التذكيرية:</Label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 text-xs gap-1.5 px-2 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer rounded-lg border border-border/50"
                        onClick={handleCopyText}
                      >
                        {copied ? (
                          <>
                            <Check className="h-3.5 w-3.5 text-emerald-600" />
                            <span className="text-emerald-600 font-semibold">تم النسخ</span>
                          </>
                        ) : (
                          <>
                            <Copy className="h-3.5 w-3.5" />
                            <span>نسخ النص</span>
                          </>
                        )}
                      </Button>
                    </div>
                    <textarea
                      readOnly
                      value={messageText}
                      className="w-full min-h-[160px] text-xs p-4 rounded-xl border bg-muted/20 resize-none leading-relaxed focus-visible:outline-none focus:border-emerald-500 focus:bg-background transition-all duration-200 font-sans shadow-inner"
                      dir="rtl"
                    />
                  </div>

                  <div className="grid grid-cols-1 gap-3 pt-2">
                    <Button
                      asChild
                      variant="outline"
                      className="h-16 flex items-center justify-start gap-4 border border-emerald-500/20 hover:border-emerald-500 bg-emerald-500/[0.01] hover:bg-emerald-500/[0.04] text-right px-4 cursor-pointer rounded-xl transition-all duration-200 shadow-sm"
                    >
                      <a
                        href={waLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={handleManualClick}
                      >
                        <div className="p-2 bg-emerald-500/10 rounded-lg shrink-0">
                          <MessageCircle className="h-6 w-6 text-emerald-600" />
                        </div>
                        <div>
                          <div className="font-bold text-sm text-foreground">إرسال يدوي (واتساب ويب / تطبيق)</div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 font-sans">فتح محادثة مباشرة وتجهيز نص الرسالة للنسخ والتعديل قبل الإرسال</div>
                        </div>
                      </a>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="h-16 flex items-center justify-start gap-4 border border-blue-500/20 hover:border-blue-500 bg-blue-500/[0.01] hover:bg-blue-500/[0.04] text-right px-4 rounded-xl cursor-pointer transition-all duration-200 shadow-sm"
                      onClick={handleApiWhatsApp}
                    >
                      <div className="p-2 bg-blue-500/10 rounded-lg shrink-0">
                        <Send className="h-6 w-6 text-blue-600" />
                      </div>
                      <div>
                        <div className="font-bold text-sm text-foreground">إرسال تلقائي (عبر منصة الربط API)</div>
                        <div className="text-[10px] text-muted-foreground mt-0.5 font-sans">إرسال الرسالة تلقائياً في الخلفية باستخدام منصة الربط المدمجة</div>
                      </div>
                    </Button>
                  </div>
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

