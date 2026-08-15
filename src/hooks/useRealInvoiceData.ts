import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { InvoiceTemplateType } from '@/types/invoice-templates';

export interface RealInvoiceData {
  id: string;
  invoiceNumber: string;
  date: string;
  contractNumber?: string;
  customer?: {
    name: string;
    company?: string;
    phone?: string;
    period?: string;
  };
  billboards?: Array<{
    id: number;
    name: string;
    size: string;
    faces: number;
    location: string;
    price: number;
  }>;
  items?: Array<{
    description: string;
    size?: string;
    unit?: string;
    qty: number;
    unitPrice: number;
    total: number;
  }>;
  services?: Array<{
    description: string;
    qty: number;
    unitPrice: number;
    total: number;
  }>;
  transactions?: Array<{
    date: string;
    description: string;
    debit: number;
    credit: number;
    balance: number;
  }>;
  payment?: {
    amount: number;
    method: string;
    reference: string;
    previousBalance: number;
    newBalance: number;
  };
  team?: {
    name: string;
    leader: string;
    members: number;
  };
  custodyInfo?: {
    employeeName: string;
    accountNumber: string;
    initialAmount: number;
    currentBalance: number;
  };
  balance?: {
    total?: number;
    spent?: number;
    remaining: number;
    totalDebit?: number;
    totalCredit?: number;
  };
  subtotal?: number;
  discount?: number;
  total?: number;
}

export interface InvoiceListItem {
  id: string;
  label: string;
  date: string;
  customerName?: string;
}

// Fetch list of available invoices for a type
export function useInvoiceList(templateType: InvoiceTemplateType, enabled: boolean = false) {
  const [data, setData] = useState<InvoiceListItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const fetchList = useCallback(async () => {
    if (!enabled) return;
    
    setIsLoading(true);
    
    try {
      let items: InvoiceListItem[] = [];

      switch (templateType) {
        case 'contract':
        case 'offer': {
          const { data: contracts } = await supabase
            .from('Contract')
            .select('Contract_Number, "Contract Date", "Customer Name"')
            .order('Contract_Number', { ascending: false })
            .limit(50);
          
          items = (contracts || []).map(c => ({
            id: String(c.Contract_Number),
            label: `عقد رقم ${c.Contract_Number}`,
            date: c['Contract Date'] || '',
            customerName: c['Customer Name'] || '',
          }));
          break;
        }

        case 'receipt':
        case 'team_payment': {
          const { data: payments } = await supabase
            .from('customer_payments')
            .select('id, paid_at, customer_name, amount')
            .order('created_at', { ascending: false })
            .limit(50);
          
          items = (payments || []).map(p => ({
            id: p.id,
            label: `إيصال ${p.id.substring(0, 8)} - ${p.amount?.toLocaleString()} د.ل`,
            date: p.paid_at || '',
            customerName: p.customer_name || '',
          }));
          break;
        }

        case 'custody': {
          const { data: accounts } = await supabase
            .from('custody_accounts')
            .select('id, account_number, custody_name, created_at')
            .order('created_at', { ascending: false })
            .limit(50);
          
          items = (accounts || []).map(a => ({
            id: a.id,
            label: `عهدة ${a.account_number} - ${a.custody_name || ''}`,
            date: a.created_at?.split('T')[0] || '',
            customerName: a.custody_name || '',
          }));
          break;
        }

        case 'account_statement':
        case 'overdue_notice': {
          const { data: customers } = await supabase
            .from('customers')
            .select('id, name, company, created_at')
            .order('created_at', { ascending: false })
            .limit(50);
          
          items = (customers || []).map(c => ({
            id: c.id,
            label: `كشف حساب ${c.name}`,
            date: c.created_at?.split('T')[0] || '',
            customerName: c.name || '',
          }));
          break;
        }

        case 'print_invoice':
        case 'print_task': {
          const { data: tasks } = await supabase
            .from('print_tasks')
            .select('id, created_at, customer_name, total_cost')
            .order('created_at', { ascending: false })
            .limit(50);
          
          items = (tasks || []).map(t => ({
            id: t.id,
            label: `مهمة طباعة ${t.id.substring(0, 8)} - ${t.total_cost?.toLocaleString() || 0} د.ل`,
            date: t.created_at?.split('T')[0] || '',
            customerName: t.customer_name || '',
          }));
          break;
        }

        case 'cutout_task': {
          const { data: tasks } = await supabase
            .from('cutout_tasks')
            .select('id, created_at, customer_name, total_cost')
            .order('created_at', { ascending: false })
            .limit(50);
          
          items = (tasks || []).map(t => ({
            id: t.id,
            label: `مهمة قص ${t.id.substring(0, 8)} - ${t.total_cost?.toLocaleString() || 0} د.ل`,
            date: t.created_at?.split('T')[0] || '',
            customerName: t.customer_name || '',
          }));
          break;
        }

        case 'installation': {
          const { data: tasks } = await supabase
            .from('installation_tasks')
            .select('id, created_at, contract_id')
            .order('created_at', { ascending: false })
            .limit(50);
          
          items = (tasks || []).map(t => ({
            id: t.id,
            label: `مهمة تركيب ${t.id.substring(0, 8)}`,
            date: t.created_at?.split('T')[0] || '',
            customerName: '',
          }));
          break;
        }

        case 'sales_invoice': {
          const { data: invoices } = await supabase
            .from('sales_invoices')
            .select('id, invoice_number, invoice_date, total_amount, customers(name)')
            .order('created_at', { ascending: false })
            .limit(50);
          
          items = (invoices || []).map(i => ({
            id: i.id,
            label: `فاتورة مبيعات ${i.invoice_number || i.id.substring(0, 8)} - ${i.total_amount?.toLocaleString() || 0} د.ل`,
            date: i.invoice_date || '',
            customerName: (i.customers as any)?.name || '',
          }));
          break;
        }

        case 'purchase_invoice': {
          const { data: invoices } = await supabase
            .from('purchase_invoices')
            .select('id, invoice_number, invoice_date, total_amount, customers(name)')
            .order('created_at', { ascending: false })
            .limit(50);
          
          items = (invoices || []).map(i => ({
            id: i.id,
            label: `فاتورة مشتريات ${i.invoice_number || i.id.substring(0, 8)} - ${i.total_amount?.toLocaleString() || 0} د.ل`,
            date: i.invoice_date || '',
            customerName: (i.customers as any)?.name || '',
          }));
          break;
        }

        case 'composite_task': {
          const { data: tasks } = await supabase
            .from('composite_tasks')
            .select('id, created_at, customer_name, total_cost')
            .order('created_at', { ascending: false })
            .limit(50);
          
          items = (tasks || []).map(t => ({
            id: t.id,
            label: `مهمة مجمعة ${t.id.substring(0, 8)} - ${t.total_cost?.toLocaleString() || 0} د.ل`,
            date: t.created_at?.split('T')[0] || '',
            customerName: t.customer_name || '',
          }));
          break;
        }

        case 'friend_rental': {
          const { data: contracts } = await supabase
            .from('Contract')
            .select('Contract_Number, "Contract Date", "Customer Name"')
            .not('friend_rental_data', 'is', null)
            .order('Contract_Number', { ascending: false })
            .limit(50);
          
          items = (contracts || []).map(c => ({
            id: String(c.Contract_Number),
            label: `إيجار صديق رقم ${c.Contract_Number}`,
            date: c['Contract Date'] || '',
            customerName: c['Customer Name'] || '',
          }));
          break;
        }

        default:
          break;
      }

      setData(items);
    } catch (error) {
      console.error('Error fetching invoice list:', error);
    }
    
    setIsLoading(false);
  }, [templateType, enabled]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  return { data, isLoading, refetch: fetchList };
}

// Fetch specific invoice data by ID
export function useRealInvoiceData(templateType: InvoiceTemplateType, enabled: boolean = false, selectedId?: string) {
  const [data, setData] = useState<RealInvoiceData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!enabled) {
      console.log('[useRealInvoiceData] Disabled, skipping fetch');
      return;
    }
    
    console.log(`[useRealInvoiceData] Fetching data for type: ${templateType}, selectedId: ${selectedId}`);
    setIsLoading(true);
    setError(null);
    
    try {
      let result: RealInvoiceData | null = null;

      switch (templateType) {
        case 'contract':
        case 'offer': {
          let query = supabase
            .from('Contract')
            .select('*, customers(*)');
          
          if (selectedId) {
            query = query.eq('Contract_Number', parseInt(selectedId));
          } else {
            query = query.order('Contract_Number', { ascending: false }).limit(1);
          }
          
          const { data: contract } = await query.single();
          
          if (contract) {
            let billboards: any[] = [];
            if (contract.billboard_ids) {
              const ids = contract.billboard_ids.split(',').map((id: string) => parseInt(id.trim())).filter((id: number) => !isNaN(id));
              if (ids.length > 0) {
                const { data: bbs } = await supabase.from('billboards').select('*').in('ID', ids);
                billboards = bbs || [];
              }
            }
            
            result = {
              id: String(contract.Contract_Number),
              invoiceNumber: `INV-${contract.Contract_Number}`,
              date: contract['Contract Date'] || new Date().toISOString().split('T')[0],
              contractNumber: String(contract.Contract_Number),
              customer: {
                name: contract['Customer Name'] || 'غير محدد',
                company: contract.Company || '',
                phone: contract.Phone || '',
                period: contract.Duration || '',
              },
              billboards: billboards.map((b) => ({
                id: b.ID,
                name: b.Billboard_Name || `لوحة ${b.ID}`,
                size: b.Size || 'غير محدد',
                faces: b.Faces_Count || 1,
                location: b.City || 'غير محدد',
                price: b.Price || 0,
              })),
              subtotal: contract['Total Rent'] || 0,
              discount: contract.Discount || 0,
              total: contract.Total || 0,
            };
          }
          break;
        }

        case 'receipt':
        case 'team_payment': {
          let query = supabase
            .from('customer_payments')
            .select('*, customers(*)');
          
          if (selectedId) {
            query = query.eq('id', selectedId);
          } else {
            query = query.order('created_at', { ascending: false }).limit(1);
          }
          
          const { data: payment } = await query.single();
          
          if (payment) {
            result = {
              id: payment.id,
              invoiceNumber: `REC-${payment.id.substring(0, 8)}`,
              date: payment.paid_at || new Date().toISOString().split('T')[0],
              customer: {
                name: payment.customer_name || (payment.customers as any)?.name || 'غير محدد',
                phone: (payment.customers as any)?.phone || '',
              },
              payment: {
                amount: payment.amount || 0,
                method: payment.method || 'نقدي',
                reference: payment.reference || '',
                previousBalance: 0,
                newBalance: 0,
              },
              team: templateType === 'team_payment' ? {
                name: payment.collector_name || 'فريق',
                leader: '',
                members: 0,
              } : undefined,
            };
          }
          break;
        }

        case 'custody': {
          let query = supabase
            .from('custody_accounts')
            .select('*, employees(*), custody_transactions(*)');
          
          if (selectedId) {
            query = query.eq('id', selectedId);
          } else {
            query = query.eq('status', 'active').order('created_at', { ascending: false }).limit(1);
          }
          
          const { data: custody } = await query.single();
          
          if (custody) {
            const transactions = ((custody as any).custody_transactions || []).slice(0, 10);
            let runningBalance = custody.initial_amount;
            
            result = {
              id: custody.id,
              invoiceNumber: `CUS-${custody.account_number}`,
              date: new Date().toISOString().split('T')[0],
              custodyInfo: {
                employeeName: (custody.employees as any)?.name || custody.custody_name || 'غير محدد',
                accountNumber: custody.account_number,
                initialAmount: custody.initial_amount,
                currentBalance: custody.current_balance,
              },
              transactions: transactions.map((t: any) => {
                const isDebit = t.transaction_type === 'expense' || t.transaction_type === 'debit';
                if (isDebit) runningBalance -= t.amount;
                else runningBalance += t.amount;
                return {
                  date: t.transaction_date || t.created_at?.split('T')[0],
                  description: t.description || 'حركة مالية',
                  debit: isDebit ? t.amount : 0,
                  credit: !isDebit ? t.amount : 0,
                  balance: runningBalance,
                };
              }),
              balance: {
                total: custody.initial_amount,
                spent: custody.initial_amount - custody.current_balance,
                remaining: custody.current_balance,
              },
            };
          }
          break;
        }

        case 'account_statement':
        case 'overdue_notice': {
          let query = supabase
            .from('customers')
            .select('*');
          
          if (selectedId) {
            query = query.eq('id', selectedId);
          } else {
            query = query.order('created_at', { ascending: false }).limit(1);
          }
          
          const { data: customer } = await query.single();
          
          if (customer) {
            const { data: payments } = await supabase
              .from('customer_payments')
              .select('*')
              .eq('customer_id', customer.id)
              .order('paid_at', { ascending: false })
              .limit(10);
            
            let totalDebit = 0;
            let totalCredit = 0;
            const txns = (payments || []).map((p) => {
              const isCredit = p.amount > 0;
              if (isCredit) totalCredit += p.amount;
              return {
                date: p.paid_at?.split('T')[0] || '',
                description: p.notes || 'دفعة',
                debit: 0,
                credit: isCredit ? p.amount : 0,
                balance: totalCredit,
              };
            });
            
            result = {
              id: customer.id,
              invoiceNumber: `STM-${customer.id.substring(0, 8)}`,
              date: new Date().toISOString().split('T')[0],
              customer: {
                name: customer.name,
                company: customer.company || '',
                phone: customer.phone || '',
              },
              transactions: txns,
              balance: {
                totalDebit,
                totalCredit,
                remaining: totalDebit - totalCredit,
              },
            };
          }
          break;
        }

        case 'print_invoice':
        case 'print_task': {
          let query = supabase
            .from('print_tasks')
            .select('*, customers(*)');
          
          if (selectedId) {
            query = query.eq('id', selectedId);
          } else {
            query = query.order('created_at', { ascending: false }).limit(1);
          }
          
          const { data: task } = await query.single();
          
          if (task) {
            result = {
              id: task.id,
              invoiceNumber: `PT-${task.id.substring(0, 8)}`,
              date: task.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
              customer: {
                name: task.customer_name || (task.customers as any)?.name || 'غير محدد',
                phone: (task.customers as any)?.phone || '',
              },
              items: [{
                description: 'طباعة فليكس',
                size: `${task.total_area || 0} متر مربع`,
                qty: 1,
                unitPrice: task.price_per_meter || 0,
                total: task.total_cost || 0,
              }],
              subtotal: task.total_cost || 0,
              discount: 0,
              total: task.total_cost || 0,
            };
          }
          break;
        }

        case 'cutout_task': {
          let query = supabase
            .from('cutout_tasks')
            .select('*, customers(*)');
          
          if (selectedId) {
            query = query.eq('id', selectedId);
          } else {
            query = query.order('created_at', { ascending: false }).limit(1);
          }
          
          const { data: task } = await query.single();
          
          if (task) {
            result = {
              id: task.id,
              invoiceNumber: `CT-${task.id.substring(0, 8)}`,
              date: task.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
              customer: {
                name: task.customer_name || (task.customers as any)?.name || 'غير محدد',
                phone: (task.customers as any)?.phone || '',
              },
              items: [{
                description: 'قص مجسمات',
                qty: task.total_quantity || 1,
                unitPrice: task.unit_cost || 0,
                total: task.total_cost || 0,
              }],
              subtotal: task.total_cost || 0,
              discount: 0,
              total: task.total_cost || 0,
            };
          }
          break;
        }

        case 'installation': {
          let query = supabase
            .from('installation_tasks')
            .select('*, installation_teams(*), customers(*)');
          
          if (selectedId) {
            query = query.eq('id', selectedId);
          } else {
            query = query.order('created_at', { ascending: false }).limit(1);
          }
          
          const { data: task } = await query.single();
          
          if (task) {
            const taskAny = task as any;
            result = {
              id: task.id,
              invoiceNumber: `INS-${task.id.substring(0, 8)}`,
              date: task.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
              customer: {
                name: taskAny.customer_name || (task.customers as any)?.name || 'غير محدد',
                phone: (task.customers as any)?.phone || '',
              },
              team: {
                name: (task.installation_teams as any)?.name || 'فريق التركيب',
                leader: (task.installation_teams as any)?.leader_name || '',
                members: (task.installation_teams as any)?.members_count || 0,
              },
              services: [{
                description: 'خدمة التركيب',
                qty: 1,
                unitPrice: taskAny.total_cost || 0,
                total: taskAny.total_cost || 0,
              }],
              subtotal: taskAny.total_cost || 0,
              discount: 0,
              total: taskAny.total_cost || 0,
            };
          }
          break;
        }

        case 'sales_invoice': {
          let query = supabase
            .from('sales_invoices')
            .select('*, customers(*)');
          
          if (selectedId) {
            query = query.eq('id', selectedId);
          } else {
            query = query.order('created_at', { ascending: false }).limit(1);
          }
          
          const { data: invoice } = await query.single();
          
          if (invoice) {
            const invoiceAny = invoice as any;
            const items = Array.isArray(invoiceAny.items) ? invoiceAny.items : [];
            result = {
              id: invoice.id,
              invoiceNumber: invoice.invoice_number || `SI-${invoice.id.substring(0, 8)}`,
              date: invoice.invoice_date || new Date().toISOString().split('T')[0],
              customer: {
                name: (invoice.customers as any)?.name || 'غير محدد',
                phone: (invoice.customers as any)?.phone || '',
              },
              items: items.map((item: any) => ({
                description: item.description || 'منتج',
                qty: item.quantity || 1,
                unitPrice: item.unit_price || 0,
                total: item.total || 0,
              })),
              subtotal: invoiceAny.subtotal || invoice.total_amount || 0,
              discount: invoice.discount || 0,
              total: invoiceAny.total || invoice.total_amount || 0,
            };
          }
          break;
        }

        case 'purchase_invoice': {
          let query = supabase
            .from('purchase_invoices')
            .select('*, customers(*)');
          
          if (selectedId) {
            query = query.eq('id', selectedId);
          } else {
            query = query.order('created_at', { ascending: false }).limit(1);
          }
          
          const { data: invoice } = await query.single();
          
          if (invoice) {
            const invoiceAny = invoice as any;
            const items = Array.isArray(invoiceAny.items) ? invoiceAny.items : [];
            result = {
              id: invoice.id,
              invoiceNumber: invoice.invoice_number || `PI-${invoice.id.substring(0, 8)}`,
              date: invoice.invoice_date || new Date().toISOString().split('T')[0],
              customer: {
                name: (invoice.customers as any)?.name || 'غير محدد',
                phone: (invoice.customers as any)?.phone || '',
              },
              items: items.map((item: any) => ({
                description: item.description || 'منتج',
                qty: item.quantity || 1,
                unitPrice: item.unit_price || 0,
                total: item.total || 0,
              })),
              subtotal: invoiceAny.subtotal || invoice.total_amount || 0,
              discount: invoiceAny.discount || 0,
              total: invoiceAny.total || invoice.total_amount || 0,
            };
          }
          break;
        }

        case 'composite_task': {
          let query = supabase
            .from('composite_tasks')
            .select('*, customers(*)');
          
          if (selectedId) {
            query = query.eq('id', selectedId);
          } else {
            query = query.order('created_at', { ascending: false }).limit(1);
          }
          
          const { data: task } = await query.single();
          
          if (task) {
            const items = [];
            if (task.print_cost) items.push({ description: 'خدمة الطباعة', qty: 1, unitPrice: task.print_cost, total: task.print_cost });
            if (task.installation_cost) items.push({ description: 'خدمة التركيب', qty: 1, unitPrice: task.installation_cost, total: task.installation_cost });
            if (task.cutout_cost) items.push({ description: 'خدمة القص', qty: 1, unitPrice: task.cutout_cost, total: task.cutout_cost });
            
            result = {
              id: task.id,
              invoiceNumber: `CMB-${task.id.substring(0, 8)}`,
              date: task.created_at?.split('T')[0] || new Date().toISOString().split('T')[0],
              customer: {
                name: task.customer_name || (task.customers as any)?.name || 'غير محدد',
                phone: (task.customers as any)?.phone || '',
              },
              items,
              subtotal: task.total_cost || 0,
              discount: task.discount_amount || 0,
              total: (task.total_cost || 0) - (task.discount_amount || 0),
            };
          }
          break;
        }

        case 'friend_rental': {
          let query = supabase
            .from('Contract')
            .select('*')
            .not('friend_rental_data', 'is', null);
          
          if (selectedId) {
            query = query.eq('Contract_Number', parseInt(selectedId));
          } else {
            query = query.order('Contract_Number', { ascending: false }).limit(1);
          }
          
          const { data: contract } = await query.single();
          
          if (contract) {
            result = {
              id: String(contract.Contract_Number),
              invoiceNumber: `FR-${contract.Contract_Number}`,
              date: contract['Contract Date'] || new Date().toISOString().split('T')[0],
              customer: {
                name: contract['Customer Name'] || 'غير محدد',
                phone: contract.Phone || '',
              },
              subtotal: contract['Total Rent'] || 0,
              discount: contract.Discount || 0,
              total: contract.Total || 0,
            };
          }
          break;
        }

        default:
          break;
      }

      console.log(`[useRealInvoiceData] Result for ${templateType}:`, result ? 'Data found' : 'No data');
      if (result) {
        console.log(`[useRealInvoiceData] invoiceNumber: ${result.invoiceNumber}, date: ${result.date}, customer: ${result.customer?.name}`);
      }
      setData(result);
    } catch (error) {
      console.error('[useRealInvoiceData] Error fetching real invoice data:', error);
      setError('فشل في جلب البيانات');
      // Fallback to null so sample data is used
      setData(null);
    }
    
    setIsLoading(false);
  }, [templateType, enabled, selectedId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, isLoading, error, refetch: fetchData };
}
