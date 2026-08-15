// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/sonner';
import { Edit, Trash2, Printer, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { Billboard } from '@/types';
import { fetchAllBillboards } from '@/services/supabaseService';
import { getMergedInvoiceStylesAsync } from '@/hooks/useInvoiceSettingsSync';


interface PaymentRow {
  id: string;
  customer_id: string | null;
  customer_name: string;
  contract_number: string | null;
  amount: number | null;
  method: string | null;
  reference: string | null;
  notes: string | null;
  paid_at: string | null;
  entry_type: string | null;
}

interface ContractRow {
  Contract_Number: string | null;
  "Customer Name": string | null;
  "Ad Type": string | null;
  "Total Rent": string | number | null;
  "Start Date"?: string | null;
  "End Date"?: string | null;
  customer_id?: string | null;
}

interface CustomerSummary {
  id: string;
  name: string;
  phone: string | null;
  company: string | null;
  contractsCount: number;
  totalRent: number;
  totalPaid: number;
  accountBalance: number; // New: separate account balance
}

export default function Customers() {
  const { confirm: systemConfirm } = useSystemDialog();
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const navigate = useNavigate();
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [customers, setCustomers] = useState<{id:string; name:string; phone?: string | null; company?: string | null}[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCustomer, setSelectedCustomer] = useState<string | null>(null);
  const [selectedCustomerName, setSelectedCustomerName] = useState<string>('');
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // print invoice dialog state
  const [printInvOpen, setPrintInvOpen] = useState(false);
  const [allBillboards, setAllBillboards] = useState<Billboard[]>([]);
  const [selectedContractsForInv, setSelectedContractsForInv] = useState<string[]>([]);
  const [sizeCounts, setSizeCounts] = useState<Record<string, number>>({});
  const [printPrices, setPrintPrices] = useState<Record<string, number>>({});
  const [includeAccountBalance, setIncludeAccountBalance] = useState(false);

  // add/edit customer states
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [customerNameInput, setCustomerNameInput] = useState('');
  const [customerPhoneInput, setCustomerPhoneInput] = useState('');
  const [customerCompanyInput, setCustomerCompanyInput] = useState('');
  const [syncing, setSyncing] = useState(false);

  // edit receipt states
  const [editReceiptOpen, setEditReceiptOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<PaymentRow | null>(null);
  const [receiptAmount, setReceiptAmount] = useState('');
  const [receiptMethod, setReceiptMethod] = useState('');
  const [receiptReference, setReceiptReference] = useState('');
  const [receiptNotes, setReceiptNotes] = useState('');
  const [receiptDate, setReceiptDate] = useState('');

  // add invoice/receipt dialog states
  const [addOpen, setAddOpen] = useState(false);
  const [addType, setAddType] = useState<'invoice'|'receipt'|'account_payment'>('receipt');
  const [addAmount, setAddAmount] = useState('');
  const [addMethod, setAddMethod] = useState('');
  const [addReference, setAddReference] = useState('');
  const [addNotes, setAddNotes] = useState('');
  const [addDate, setAddDate] = useState<string>(()=>new Date().toISOString().slice(0,10));
  const [addContract, setAddContract] = useState<string>('');

  // add previous debt dialog
  const [addDebtOpen, setAddDebtOpen] = useState(false);
  const [debtAmount, setDebtAmount] = useState('');
  const [debtNotes, setDebtNotes] = useState('');
  const [debtDate, setDebtDate] = useState<string>(()=>new Date().toISOString().slice(0,10));

  const loadData = async () => {
    try {
      console.log('Loading data...');
      const [pRes, cRes, cuRes] = await Promise.all([
        supabase.from('customer_payments').select('*').order('paid_at', { ascending: false }),
        supabase.from('Contract').select('*'),
        supabase.from('customers').select('*').order('name', { ascending: true })
      ]);

      console.log('Payments result:', pRes);
      console.log('Contracts result:', cRes);
      console.log('Customers result:', cuRes);

      if (pRes.error) {
        console.error('Payments error:', pRes.error);
      } else {
        setPayments(pRes.data || []);
      }

      if (cRes.error) {
        console.error('Contracts error:', cRes.error);
      } else {
        setContracts(cRes.data || []);
      }

      if (cuRes.error) {
        console.error('Customers error:', cuRes.error);
      } else {
        setCustomers(cuRes.data || []);
      }
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('خطأ في تحميل البيانات');
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // auto-derive size counts from selected contracts
  useEffect(() => {
    const sel = new Set(selectedContractsForInv);
    const boards = allBillboards.filter((b:any)=> sel.has(String((b as any).Contract_Number||'')) && (!selectedCustomerName || String((b as any).Customer_Name||'').toLowerCase().includes(selectedCustomerName.toLowerCase())));
    const counts: Record<string, number> = {};
    for (const b of boards) {
      const size = String((b as any).Size || (b as any).size || '—');
      counts[size] = (counts[size]||0) + 1;
    }
    setSizeCounts(counts);
  }, [selectedContractsForInv, allBillboards, selectedCustomerName]);

  // load print prices for sizes in current selection
  useEffect(() => {
    const sizes = Object.keys(sizeCounts);
    if (sizes.length === 0) { setPrintPrices({}); return; }
    (async () => {
      try {
        const { data, error } = await supabase
          .from('installation_print_pricing')
          .select('size, print_price')
          .in('size', sizes);
        if (!error && Array.isArray(data)) {
          const map: Record<string, number> = {};
          (data as any[]).forEach((r) => { map[String(r.size)] = Number(r.print_price) || 0; });
          setPrintPrices(map);
        } else {
          setPrintPrices({});
        }
      } catch {
        setPrintPrices({});
      }
    })();
  }, [sizeCounts]);

  // Build summary per customer using customers table, payments + contracts
  const customersSummary = useMemo((): CustomerSummary[] => {
    console.log('Building customer summary...');
    console.log('Customers:', customers);
    console.log('Contracts:', contracts);
    console.log('Payments:', payments);

    // initialize map from customers list with all customer data
    const map = new Map<string, CustomerSummary>();
    for (const c of (customers || [])) {
      const id = c.id;
      const name = c.name || '—';
      const phone = c.phone || null;
      const company = c.company || null;
      map.set(id, { 
        id, 
        name, 
        phone, 
        company, 
        contractsCount: 0, 
        totalRent: 0, 
        totalPaid: 0,
        accountBalance: 0
      });
    }

    // contracts info
    for (const ct of contracts) {
      const cid = ct.customer_id ?? null;
      const rent = Number(ct['Total Rent'] || 0) || 0;
      if (cid && map.has(cid)) {
        const cur = map.get(cid)!;
        cur.contractsCount += 1;
        cur.totalRent += rent;
      } else {
        // fallback: group by name if customer_id missing
        const name = (ct['Customer Name'] || '').toString() || '—';
        const key = `name:${name}`;
        if (!map.has(key)) {
          map.set(key, { 
            id: key, 
            name, 
            phone: null, 
            company: null, 
            contractsCount: 0, 
            totalRent: 0, 
            totalPaid: 0,
            accountBalance: 0
          });
        }
        const cur = map.get(key)!;
        cur.contractsCount += 1;
        cur.totalRent += rent;
      }
    }

    // payments - separate contract payments from account payments
    for (const p of payments) {
      const cid = (p.customer_id || null) as string | null;
      const amt = Number(p.amount || 0) || 0;
      
      if (cid && map.has(cid)) {
        const cur = map.get(cid)!;
        if (p.entry_type === 'account_payment' || !p.contract_number) {
          cur.accountBalance += amt;
        } else {
          cur.totalPaid += amt;
        }
      } else if (p.customer_name) {
        // try to find customer by name
        const match = Array.from(map.values()).find(x => x.name && x.name.toLowerCase() === String(p.customer_name).toLowerCase());
        if (match) {
          if (p.entry_type === 'account_payment' || !p.contract_number) {
            match.accountBalance += amt;
          } else {
            match.totalPaid += amt;
          }
        } else {
          const name = p.customer_name || '—';
          const key = `name:${name}`;
          if (!map.has(key)) {
            map.set(key, { 
              id: key, 
              name, 
              phone: null, 
              company: null, 
              contractsCount: 0, 
              totalRent: 0, 
              totalPaid: 0,
              accountBalance: 0
            });
          }
          const cur = map.get(key)!;
          if (p.entry_type === 'account_payment' || !p.contract_number) {
            cur.accountBalance += amt;
          } else {
            cur.totalPaid += amt;
          }
        }
      }
    }

    const result = Array.from(map.values()).sort((a, b) => b.totalRent - a.totalRent);
    console.log('Customer summary result:', result);
    return result;
  }, [payments, contracts, customers]);

  const totalAllPaid = payments.reduce((s, p) => s + (Number(p.amount) || 0), 0);

  const [detailsContracts, setDetailsContracts] = useState<ContractRow[]>([]);
  const [detailsPayments, setDetailsPayments] = useState<PaymentRow[]>([]);

  const openCustomer = async (idOrKey: string) => {
    console.log('Opening customer details for:', idOrKey);
    
    // idOrKey may be a real customer id, or a fallback key like 'name:Customer Name'
    let id = idOrKey;
    let nameFallback: string | null = null;
    if (typeof idOrKey === 'string' && idOrKey.startsWith('name:')) {
      nameFallback = idOrKey.slice(5);
      id = '';
    }

    // Find customer name for dialog title
    const customer = customers.find(c => c.id === id);
    const customerName = customer?.name || nameFallback || 'غير معروف';
    
    console.log('Customer found:', customer);
    console.log('Customer name:', customerName);
    
    setSelectedCustomer(idOrKey);
    setSelectedCustomerName(customerName);
    setDialogOpen(true);

    try {
      // First fetch payments for this customer (by id), fallback to name
      let paymentsData: PaymentRow[] = [];

      if (id) {
        console.log('Fetching payments by customer_id:', id);
        const pRes = await supabase
          .from('customer_payments')
          .select('*')
          .eq('customer_id', id)
          .order('paid_at', { ascending: false });
        
        console.log('Payments by ID result:', pRes);
        paymentsData = pRes.data || [];
      }

      // determine customer name if available (from customers list) or fallback
      const cust = customers.find(x => x.id === id);
      const name = cust?.name || nameFallback || null;

      if ((!paymentsData || paymentsData.length === 0) && name) {
        console.log('Fetching payments by customer name:', name);
        const pByName = await supabase
          .from('customer_payments')
          .select('*')
          .eq('customer_name', name)
          .order('paid_at', { ascending: false });
        
        console.log('Payments by name result:', pByName);
        paymentsData = pByName.data || [];
      }

      setDetailsPayments(paymentsData);

      // collect contract numbers from payments
      const contractNumbers = Array.from(new Set((paymentsData || []).map((p:any)=>p.contract_number).filter(Boolean)));
      console.log('Contract numbers from payments:', contractNumbers);

      // fetch contracts by customer_id if we have id, otherwise by name or contract numbers
      let contractsData: ContractRow[] = [];

      if (id) {
        console.log('Fetching contracts by customer_id:', id);
        const contractsById = await supabase
          .from('Contract')
          .select('*')
          .eq('customer_id', id);
        
        console.log('Contracts by ID result:', contractsById);
        contractsData = contractsById.data || [];
      }

      if ((contractsData || []).length === 0 && name) {
        console.log('Fetching contracts by customer name:', name);
        const byName = await supabase
          .from('Contract')
          .select('*')
          .eq('Customer Name', name);
        
        console.log('Contracts by name result:', byName);
        contractsData = byName.data || [];
      }

      if ((contractsData || []).length === 0 && contractNumbers.length > 0) {
        console.log('Fetching contracts by contract numbers:', contractNumbers);
        // attempt fetching by contract numbers
        const byNumbers = await supabase
          .from('Contract')
          .select('*')
          .in('Contract_Number', contractNumbers);
        
        console.log('Contracts by numbers result:', byNumbers);
        contractsData = byNumbers.data || [];
      }

      // dedupe by Contract_Number
      const seen = new Set();
      const deduped = [] as ContractRow[];
      for (const c of contractsData) {
        const key = String(c.Contract_Number || c['Contract Number'] || JSON.stringify(c));
        if (!seen.has(key)) { 
          seen.add(key); 
          deduped.push(c); 
        }
      }

      console.log('Final contracts data:', deduped);
      setDetailsContracts(deduped);

      // Collect all billboard IDs from this customer's contracts to load only their billboards dynamically
      const billboardIdsSet = new Set<number>();
      const billboardToContractMap = new Map<number, { contractNumber: string; customerName: string }>();
      
      deduped.forEach((contract: any) => {
        const idsStr = contract.billboard_ids;
        const contractNum = String(contract.Contract_Number || '');
        const custName = String(contract['Customer Name'] || contract.Customer_Name || '');
        if (idsStr) {
          String(idsStr)
            .split(',')
            .map((s: string) => parseInt(s.trim(), 10))
            .filter((n: number) => !isNaN(n))
            .forEach(id => {
              billboardIdsSet.add(id);
              billboardToContractMap.set(id, { contractNumber: contractNum, customerName: custName });
            });
        }
      });
      const billboardIds = Array.from(billboardIdsSet);

      let customerBillboards: any[] = [];
      if (billboardIds.length > 0) {
        try {
          const { data, error } = await supabase
            .from('billboards')
            .select('ID, Billboard_Name, Size, City, Level, Nearest_Landmark, Faces_Count, Price')
            .in('ID', billboardIds);
          
          if (!error && data) {
            customerBillboards = data.map((b: any) => {
              const mapping = billboardToContractMap.get(Number(b.ID));
              return {
                ...b,
                Contract_Number: mapping?.contractNumber || b.Contract_Number || '',
                Customer_Name: mapping?.customerName || b.Customer_Name || '',
                size: b.Size || '',
                faces: b.Faces_Count || 1
              };
            });
          }
        } catch (err) {
          console.warn('Error loading billboards for customer:', err);
        }
      }
      setAllBillboards(customerBillboards);
    } catch (e) {
      console.error('openCustomer error', e);
      setDetailsContracts([]);
      setDetailsPayments([]);
      toast.error('خطأ في تحميل بيانات العميل');
    }
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSelectedCustomer(null);
    setSelectedCustomerName('');
    setDetailsContracts([]);
    setDetailsPayments([]);
  };

  const customerContracts = detailsContracts;
  const customerPayments = detailsPayments;

  const openEditReceipt = (payment: PaymentRow) => {
    setEditingReceipt(payment);
    setReceiptAmount(String(payment.amount || ''));
    setReceiptMethod(payment.method || '');
    setReceiptReference(payment.reference || '');
    setReceiptNotes(payment.notes || '');
    setReceiptDate(payment.paid_at ? payment.paid_at.split('T')[0] : '');
    setEditReceiptOpen(true);
  };

  const saveReceiptEdit = async () => {
    if (!editingReceipt) return;
    
    try {
      const { error } = await supabase
        .from('customer_payments')
        .update({
          amount: Number(receiptAmount) || 0,
          method: receiptMethod || null,
          reference: receiptReference || null,
          notes: receiptNotes || null,
          paid_at: receiptDate ? new Date(receiptDate).toISOString() : null
        })
        .eq('id', editingReceipt.id);

      if (error) {
        console.error('Error updating receipt:', error);
        toast.error('فشل في تحديث الإيصال');
      } else {
        toast.success('تم تحديث الإيصال بنجاح');
        setEditReceiptOpen(false);
        setEditingReceipt(null);
        // Refresh the payments data
        if (selectedCustomer) {
          openCustomer(selectedCustomer);
        }
        loadData();
      }
    } catch (e) {
      console.error('Save receipt error:', e);
      toast.error('خطأ في حفظ الإيصال');
    }
  };

  const deleteReceipt = async (paymentId: string) => {
    if (!await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذا الإيصال؟', variant: 'destructive', confirmText: 'حذف' })) return;
    
    try {
      const { error } = await supabase
        .from('customer_payments')
        .delete()
        .eq('id', paymentId);

      if (error) {
        console.error('Error deleting receipt:', error);
        toast.error('فشل في حذف الإيصال');
      } else {
        toast.success('تم حذف الإيصال بنجاح');
        // Refresh the payments data
        if (selectedCustomer) {
          openCustomer(selectedCustomer);
        }
        loadData();
      }
    } catch (e) {
      console.error('Delete receipt error:', e);
      toast.error('خطأ في حذف الإيصال');
    }
  };

  const printReceipt = async (payment: PaymentRow) => {
    const styles = await getMergedInvoiceStylesAsync('receipt');

    const primary = styles.primaryColor || '#D4AF37';
    const secondary = styles.secondaryColor || '#B8860B';
    const baseUrl = window.location.origin;
    const logoUrl = styles.logoPath || '/logofaresgold.svg';
    const fullLogoUrl = logoUrl.startsWith('http') ? logoUrl : `${baseUrl}${logoUrl}`;

    const { unifiedHeaderFooterCss, unifiedHeaderHtml, unifiedFooterHtml } = await import('@/lib/unifiedInvoiceBase');

    const headerHtml = unifiedHeaderHtml({
      styles,
      fullLogoUrl,
      metaLinesHtml: `
        <div><strong>التاريخ:</strong> ${payment.paid_at ? new Date(payment.paid_at).toLocaleString('ar-LY') : new Date().toLocaleString('ar-LY')}</div>
        <div><strong>رقم العقد:</strong> ${payment.contract_number || (payment.entry_type === 'account_payment' ? 'حساب عام' : '—')}</div>
      `,
      titleAr: 'إيصال دفع',
      titleEn: 'PAYMENT RECEIPT',
    });

    const html = `
      <html dir="rtl">
        <head>
          <meta charset="utf-8">
          <title>إيصال دفع</title>
          <style>
            body { 
              font-family: '${styles.fontFamily || 'Arial'}', sans-serif; 
              padding: 20px; 
              max-width: 600px; 
              margin: auto;
              background: white;
              color: ${styles.customerSectionTextColor || '#333'};
            }
            ${unifiedHeaderFooterCss(styles)}
            .content {
              line-height: 2;
            }
            .row {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid ${styles.tableBorderColor || '#eee'};
            }
            .label {
              font-weight: bold;
              color: ${primary};
            }
            .value {
              color: ${styles.customerSectionTextColor || '#555'};
            }
            .amount {
              font-size: 24px;
              font-weight: bold;
              color: ${styles.totalTextColor || '#fff'};
              text-align: center;
              padding: 20px;
              background: ${styles.totalBgColor || primary};
              border-radius: 8px;
              margin: 20px 0;
            }
            @media print {
              body { margin: 0; padding: 20px; }
            }
          </style>
        </head>
        <body>
          ${headerHtml}
          
          <div class="content">
            <div class="row">
              <span class="label">اسم العميل:</span>
              <span class="value">${payment.customer_name || '—'}</span>
            </div>
            <div class="row">
              <span class="label">رقم العقد:</span>
              <span class="value">${payment.contract_number || (payment.entry_type === 'account_payment' ? 'حساب عام' : '—')}</span>
            </div>
            <div class="row">
              <span class="label">نوع الدفعة:</span>
              <span class="value">${payment.entry_type === 'account_payment' ? 'دفعة على الحساب' : payment.entry_type || '—'}</span>
            </div>
            <div class="row">
              <span class="label">طريقة الدفع:</span>
              <span class="value">${payment.method || '—'}</span>
            </div>
            <div class="row">
              <span class="label">المرجع:</span>
              <span class="value">${payment.reference || '—'}</span>
            </div>
            ${payment.notes ? `
            <div class="row">
              <span class="label">ملاحظات:</span>
              <span class="value">${payment.notes}</span>
            </div>
            ` : ''}
          </div>
          
          <div class="amount">
            المبلغ المدفوع: ${(Number(payment.amount) || 0).toLocaleString('en-US')} دينار ليبي
          </div>
          
          ${unifiedFooterHtml(styles)}
          
          <script>
            window.onload = function() {
              window.print();
            }
          </script>
        </body>
      </html>`;

    const w = window.open('', '_blank');
    if (w) {
      w.document.open();
      w.document.write(html);
      w.document.close();
    }
  };


  const printMultiContractInvoice = () => {
    if (selectedContractsForInv.length === 0) {
      toast.error('يرجى اختيار عقد واحد على الأقل');
      return;
    }

    const selectedContractData = customerContracts.filter(c => 
      selectedContractsForInv.includes(String(c.Contract_Number))
    );

    const contractTotal = selectedContractData.reduce((sum, contract) => 
      sum + (Number(contract['Total Rent']) || 0), 0
    );

    // Get account balance for this customer
    const accountBalance = customerPayments
      .filter(p => p.entry_type === 'account_payment' || !p.contract_number)
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);

    const printTotal = Object.entries(sizeCounts).reduce((sum, [size, qty]) => {
      const unitPrice = printPrices[size] || 0;
      return sum + (qty * unitPrice);
    }, 0);

    const finalTotal = contractTotal + printTotal + (includeAccountBalance ? accountBalance : 0);

    const contractRows = selectedContractData.map(contract => `
      <tr>
        <td>${contract.Contract_Number}</td>
        <td>${contract['Ad Type'] || '—'}</td>
        <td>${contract['Start Date'] ? new Date(contract['Start Date']).toLocaleDateString('ar-LY') : '—'}</td>
        <td>${contract['End Date'] ? new Date(contract['End Date']).toLocaleDateString('ar-LY') : '—'}</td>
        <td>${(Number(contract['Total Rent']) || 0).toLocaleString('en-US')} د.ل</td>
      </tr>
    `).join('');

    const printRows = Object.entries(sizeCounts).map(([size, qty]) => {
      const unitPrice = printPrices[size] || 0;
      const lineTotal = qty * unitPrice;
      return `
        <tr>
          <td>${size}</td>
          <td>${qty}</td>
          <td>${unitPrice.toLocaleString('en-US')} د.ل</td>
          <td>${lineTotal.toLocaleString('en-US')} د.ل</td>
        </tr>
      `;
    }).join('');

    const html = `<!DOCTYPE html><html dir="rtl"><head><meta charset="utf-8">
      <title>فاتورة شاملة - ${selectedCustomerName}</title>
      <style>
        body{font-family:Arial,sans-serif;padding:20px;max-width:900px;margin:auto}
        h1{font-size:24px;text-align:center;margin-bottom:20px}
        .customer-info{margin-bottom:20px;background:#f9f9f9;padding:15px;border-radius:5px}
        table{width:100%;border-collapse:collapse;margin:10px 0}
        th,td{border:1px solid #ddd;padding:8px;text-align:center}
        th{background:#f5f5f5;font-weight:bold}
        .total-row{background:#e8f5e8;font-weight:bold}
        .section-title{font-size:18px;font-weight:bold;margin:20px 0 10px 0;color:#333}
        .footer{margin-top:30px;text-align:center;color:#666}
      </style></head><body>
      <h1>فاتورة شاملة</h1>
      <div class="customer-info">
        <strong>العميل:</strong> ${selectedCustomerName}<br>
        <strong>التاريخ:</strong> ${new Date().toLocaleDateString('ar-LY')}<br>
        <strong>عدد العقود:</strong> ${selectedContractsForInv.length}
      </div>
      
      ${contractRows ? `
      <div class="section-title">تفاصيل العقود:</div>
      <table>
        <thead>
          <tr>
            <th>رقم العقد</th>
            <th>نوع الإعلان</th>
            <th>تاريخ البداية</th>
            <th>تاريخ النهاية</th>
            <th>المبلغ</th>
          </tr>
        </thead>
        <tbody>
          ${contractRows}
          <tr class="total-row">
            <td colspan="4">إجمالي العقود</td>
            <td>${contractTotal.toLocaleString('en-US')} د.ل</td>
          </tr>
        </tbody>
      </table>
      ` : ''}
      
      ${printRows ? `
      <div class="section-title">تفاصيل الطباعة:</div>
      <table>
        <thead>
          <tr>
            <th>المقاس</th>
            <th>الكمية</th>
            <th>سعر الوحدة</th>
            <th>الإجمالي</th>
          </tr>
        </thead>
        <tbody>
          ${printRows}
          <tr class="total-row">
            <td colspan="3">إجمالي الطباعة</td>
            <td>${printTotal.toLocaleString('en-US')} د.ل</td>
          </tr>
        </tbody>
      </table>
      ` : ''}
      
      <table>
        <tbody>
          ${includeAccountBalance ? `
          <tr>
            <td colspan="4">رصيد الحساب العام</td>
            <td>${accountBalance.toLocaleString('en-US')} د.ل</td>
          </tr>
          ` : ''}
          <tr class="total-row">
            <td colspan="4">الإجمالي النهائي</td>
            <td>${finalTotal.toLocaleString('en-US')} د.ل</td>
          </tr>
        </tbody>
      </table>
      
      <div class="footer">
        <p>شكراً لتعاملكم معنا</p>
      </div>
      
      <script>window.onload=function(){window.print();}</script>
      </body></html>`;

    const w = window.open('', '_blank'); 
    if (w) { 
      w.document.open(); 
      w.document.write(html); 
      w.document.close(); 
    }
  };

  const searchQ = search.trim().toLowerCase();
  const visible = customersSummary.filter(c => !searchQ || c.name.toLowerCase().includes(searchQ));

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card border-0 shadow-card">
        <CardHeader>
          <CardTitle>الزبائن - ملخص محسن</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-4">
            <Input placeholder="ابحث بالزبون" value={search} onChange={(e)=>setSearch(e.target.value)} />
            <div className="flex items-center justify-center gap-2">
              <Button onClick={() => { setCustomerNameInput(''); setCustomerPhoneInput(''); setCustomerCompanyInput(''); setEditingCustomerId(null); setNewCustomerOpen(true); }}>إضافة زبون جديد</Button>
              <Button disabled={syncing} onClick={async () => {
                try {
                  setSyncing(true);
                  const { data: sessionData } = await supabase.auth.getSession();
                  const token = (sessionData as any)?.session?.access_token || null;
                  const resp = await fetch('/.netlify/functions/sync-customers', {
                    method: 'POST',
                    headers: {
                      'content-type': 'application/json',
                      ...(token ? { authorization: `Bearer ${token}` } : {})
                    },
                    body: JSON.stringify({ createMissing: false })
                  });

                  let json: any = null;
                  try {
                    json = await resp.json();
                  } catch (err) {
                    // sometimes body stream may be consumed or invalid JSON; try text
                    try {
                      const text = await resp.text();
                      json = text ? { text } : null;
                    } catch (err2) {
                      json = null;
                    }
                  }

                  if (!resp.ok) {
                    console.error('sync error', json || resp.statusText);
                    toast.error((json && (json.error || json.text)) || 'فشل المزامنة');
                  } else {
                    toast.success(`تمت المزامنة. تم تحديث ${json?.updated || 0} عقود، إضافة عملاء: ${json?.createdCustomers || 0}`);
                    // reload data if something changed
                    if ((json?.updated || 0) > 0 || (json?.createdCustomers || 0) > 0) loadData();
                  }
                } catch (e) {
                  console.error('sync error', e);
                  toast.error('خطأ في المزامنة');
                } finally {
                  setSyncing(false);
                }
              }}>
                {syncing ? 'جاري المزامنة...' : 'مزامنة العملاء'}
              </Button>
            </div>
            <div className="flex items-center text-sm text-muted-foreground">إجمالي المدفوعات: {totalAllPaid.toLocaleString('en-US')} د.ل</div>
          </div>

          {/* Add/Edit customer dialog */}
          <Dialog open={newCustomerOpen} onOpenChange={setNewCustomerOpen}>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>{editingCustomerId ? 'تعديل الزبون' : 'إضافة زبون جديد'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 mt-4">
                <Input placeholder="اسم الزبون" value={customerNameInput} onChange={(e)=>setCustomerNameInput(e.target.value)} />
                <Input placeholder="هاتف" value={customerPhoneInput} onChange={(e)=>setCustomerPhoneInput(e.target.value)} />
                <Input placeholder="اسم الشركة" value={customerCompanyInput} onChange={(e)=>setCustomerCompanyInput(e.target.value)} />
                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setNewCustomerOpen(false)}>إلغاء</Button>
                  <Button onClick={async () => {
                    const name = customerNameInput.trim();
                    const phone = customerPhoneInput.trim();
                    const company = customerCompanyInput.trim();
                    if (!name) return;
                    try {
                      if (editingCustomerId) {
                        console.log('Updating customer:', editingCustomerId, { name, phone: phone || null, company: company || null });
                        const { error, data } = await supabase
                          .from('customers')
                          .update({ name, phone: phone || null, company: company || null })
                          .eq('id', editingCustomerId)
                          .select();
                        
                        console.log('Update result:', { error, data });
                        
                        if (!error) {
                          // Update local state with fresh data
                          setCustomers(prev => prev.map(c => c.id === editingCustomerId ? { 
                            ...c, 
                            name, 
                            phone: phone || null, 
                            company: company || null 
                          } : c));
                          
                          toast.success('تم تحديث بيانات العميل بنجاح');
                          setNewCustomerOpen(false);
                          setEditingCustomerId(null);
                          setCustomerNameInput('');
                          setCustomerPhoneInput('');
                          setCustomerCompanyInput('');
                          
                          // Reload data to ensure consistency
                          await loadData();
                        } else {
                          console.error('Update error:', error);
                          toast.error(`فشل في تحديث العميل: ${error.message}`);
                        }
                      } else {
                        const { data: newC, error } = await supabase
                          .from('customers')
                          .insert({ name, phone: phone || null, company: company || null })
                          .select()
                          .single();
                        
                        if (!error && newC && (newC as any).id) {
                          setCustomers(prev => [{ 
                            id: (newC as any).id, 
                            name: (newC as any).name || name, 
                            phone: (newC as any).phone || phone || null, 
                            company: (newC as any).company || company || null 
                          }, ...prev]);
                          
                          toast.success('تم إضافة العميل بنجاح');
                          setNewCustomerOpen(false);
                          setCustomerNameInput('');
                          setCustomerPhoneInput('');
                          setCustomerCompanyInput('');
                        } else {
                          console.error('Insert error:', error);
                          toast.error(`فشل في إضافة العميل: ${error?.message || 'خطأ غير معروف'}`);
                        }
                      }
                    } catch (e) {
                      console.error('customer save error', e);
                      toast.error('خطأ في حفظ بيانات العميل');
                    }
                  }}>حفظ</Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>

          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اسم الزبون</TableHead>
                  <TableHead>الهاتف</TableHead>
                  <TableHead>الشركة</TableHead>
                  <TableHead>عدد العقود</TableHead>
                  <TableHead>إجمالي الإيجار</TableHead>
                  <TableHead>المدفوع للعقود</TableHead>
                  <TableHead>رصيد الحساب</TableHead>
                  <TableHead>المتبقي</TableHead>
                  <TableHead>إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visible.map(c => {
                  const remaining = Math.max(0, c.totalRent - c.totalPaid);
                  return (
                    <TableRow key={c.id} className="hover:bg-card/50 transition-colors">
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell>{c.phone || '—'}</TableCell>
                      <TableCell>{c.company || '—'}</TableCell>
                      <TableCell className="text-right">{c.contractsCount}</TableCell>
                      <TableCell className="text-right font-semibold">{c.totalRent.toLocaleString('en-US')} د.ل</TableCell>
                      <TableCell className="text-right text-green-600">{c.totalPaid.toLocaleString('en-US')} د.ل</TableCell>
                      <TableCell className="text-right text-blue-600 font-semibold">{c.accountBalance.toLocaleString('en-US')} د.ل</TableCell>
                      <TableCell className="text-right text-red-600 font-semibold">{remaining.toLocaleString('en-US')} د.ل</TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button size="sm" onClick={() => { const id = typeof c.id === 'string' ? c.id : String(c.id); navigate(`/admin/customer-billing?id=${encodeURIComponent(id)}&name=${encodeURIComponent(c.name)}`); }}>عرض فواتير</Button>
                          <Button size="sm" variant="outline" onClick={() => { 
                            setEditingCustomerId(c.id); 
                            setCustomerNameInput(c.name); 
                            setCustomerPhoneInput(c.phone || ''); 
                            setCustomerCompanyInput(c.company || ''); 
                            setNewCustomerOpen(true); 
                          }}>تعديل</Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {visible.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center text-muted-foreground py-6">لا توجد بيانات</TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-xl">فواتير وعقود العميل: {selectedCustomerName}</DialogTitle>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>عقود العميل ({customerContracts.length})</span>
                    <span className="text-sm text-muted-foreground">إجمالي قيمة العقود</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {customerContracts.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>رقم العقد</TableHead>
                            <TableHead>نوع الإعلان</TableHead>
                            <TableHead>تاريخ البداية</TableHead>
                            <TableHead>تاريخ النهاية</TableHead>
                            <TableHead>القيمة الإجمالية</TableHead>
                            <TableHead>المدفوع</TableHead>
                            <TableHead>المتبقي</TableHead>
                            <TableHead>الحالة</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customerContracts.map(ct => {
                            const paidForContract = customerPayments.filter(p => (p.contract_number||'') === (ct.Contract_Number||'') && p.entry_type !== 'account_payment').reduce((s, x) => s + (Number(x.amount)||0), 0);
                            const totalRent = Number(ct['Total Rent'] || 0) || 0;
                            const remaining = Math.max(0, totalRent - paidForContract);
                            const endDate = ct['End Date'] ? new Date(ct['End Date']) : null;
                            const today = new Date();
                            const isExpired = endDate && endDate < today;
                            const isActive = endDate && endDate >= today;
                            
                            return (
                              <TableRow key={ct.Contract_Number}>
                                <TableCell className="font-medium">{ct.Contract_Number}</TableCell>
                                <TableCell>{ct['Ad Type'] || '—'}</TableCell>
                                <TableCell>{ct['Start Date'] ? new Date(ct['Start Date']).toLocaleDateString('ar-LY') : '—'}</TableCell>
                                <TableCell>{ct['End Date'] ? new Date(ct['End Date']).toLocaleDateString('ar-LY') : '—'}</TableCell>
                                <TableCell className="font-semibold">{totalRent.toLocaleString('en-US')} د.ل</TableCell>
                                <TableCell className="text-green-600">{paidForContract.toLocaleString('en-US')} د.ل</TableCell>
                                <TableCell className={remaining > 0 ? 'text-red-600 font-semibold' : 'text-green-600'}>{remaining.toLocaleString('en-US')} د.ل</TableCell>
                                <TableCell>
                                  {isExpired ? (
                                    <span className="px-2 py-1 bg-red-100 text-red-800 rounded text-xs">منتهي</span>
                                  ) : isActive ? (
                                    <span className="px-2 py-1 bg-green-100 text-green-800 rounded text-xs">نشط</span>
                                  ) : (
                                    <span className="px-2 py-1 bg-gray-100 text-gray-800 rounded text-xs">غير محدد</span>
                                  )}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>لا توجد عقود مسجلة لهذا العميل</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>سجل الدفعات والإيصالات ({customerPayments.length})</span>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => { setAddDebtOpen(true); setDebtAmount(''); setDebtNotes(''); setDebtDate(new Date().toISOString().slice(0,10)); }}>إضافة دين سابق</Button>
                      <Button size="sm" onClick={() => { setPrintInvOpen(true); setSelectedContractsForInv(customerContracts[0]?.Contract_Number ? [String(customerContracts[0]?.Contract_Number)] : []); }}>إضافة فاتورة طباعة</Button>
                      <Button size="sm" onClick={() => { setAddType('invoice'); setAddOpen(true); setAddAmount(''); setAddMethod(''); setAddReference(''); setAddNotes(''); setAddDate(new Date().toISOString().slice(0,10)); setAddContract(customerContracts[0]?.Contract_Number ? String(customerContracts[0]?.Contract_Number) : ''); }}>إضافة فاتورة</Button>
                      <Button size="sm" variant="outline" onClick={() => { setAddType('receipt'); setAddOpen(true); setAddAmount(''); setAddMethod(''); setAddReference(''); setAddNotes(''); setAddDate(new Date().toISOString().slice(0,10)); setAddContract(customerContracts[0]?.Contract_Number ? String(customerContracts[0]?.Contract_Number) : ''); }}>إضافة إيصال</Button>
                      <Button size="sm" className="bg-green-600 hover:bg-green-700" onClick={() => { setAddType('account_payment'); setAddOpen(true); setAddAmount(''); setAddMethod(''); setAddReference(''); setAddNotes(''); setAddDate(new Date().toISOString().slice(0,10)); setAddContract(''); }}>
                        <Plus className="h-4 w-4 ml-1" />
                        دفعة على الحساب
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {customerPayments.length > 0 ? (
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>رقم العقد</TableHead>
                            <TableHead>النوع</TableHead>
                            <TableHead>المبلغ</TableHead>
                            <TableHead>طريقة الدفع</TableHead>
                            <TableHead>المرجع</TableHead>
                            <TableHead>تاريخ الدفع</TableHead>
                            <TableHead>ملاحظات</TableHead>
                            <TableHead>إجراءات</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {customerPayments.map(p => (
                            <TableRow key={p.id}>
                              <TableCell className="font-medium">
                                {p.contract_number || (p.entry_type === 'account_payment' ? 'حساب عام' : '—')}
                              </TableCell>
                              <TableCell>
                                <span className={`px-2 py-1 rounded text-xs ${
                                  p.entry_type === 'account_payment' ? 'bg-green-100 text-green-800' :
                                  p.entry_type === 'receipt' ? 'bg-blue-100 text-blue-800' :
                                  p.entry_type === 'debt' ? 'bg-red-100 text-red-800' :
                                  'bg-gray-100 text-gray-800'
                                }`}>
                                  {p.entry_type === 'account_payment' ? 'دفعة حساب' :
                                   p.entry_type === 'receipt' ? 'إيصال' :
                                   p.entry_type === 'debt' ? 'دين سابق' :
                                   p.entry_type || '—'}
                                </span>
                              </TableCell>
                              <TableCell className="font-semibold text-green-600">{(Number(p.amount)||0).toLocaleString('en-US')} د.ل</TableCell>
                              <TableCell>{p.method || '—'}</TableCell>
                              <TableCell>{p.reference || '—'}</TableCell>
                              <TableCell>{p.paid_at ? new Date(p.paid_at).toLocaleDateString('ar-LY') : '—'}</TableCell>
                              <TableCell>{p.notes || '—'}</TableCell>
                              <TableCell>
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={() => printReceipt(p)} className="bg-blue-600 hover:bg-blue-700 text-white">
                                    طباعة إيصال
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={() => openEditReceipt(p)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button size="sm" variant="destructive" onClick={() => deleteReceipt(p.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      <p>لا توجد دفعات مسجلة لهذا العميل</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={closeDialog}>إغلاق</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Add Invoice/Receipt Dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {addType === 'invoice' ? 'إضافة فاتورة' : 
               addType === 'account_payment' ? 'إضافة دفعة على الحساب' : 
               'إضافة إيصال'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div className="text-sm text-muted-foreground">العميل: {selectedCustomerName}</div>
            
            {addType === 'account_payment' && (
              <div className="p-3 bg-green-50 border border-green-200 rounded">
                <p className="text-sm text-green-800">
                  هذه الدفعة ستُضاف إلى رصيد الحساب العام للعميل ولن تُربط بعقد محدد
                </p>
              </div>
            )}

            {addType !== 'account_payment' && (
              <div>
                <label className="text-sm font-medium">العقد</label>
                <Select value={addContract || 'none'} onValueChange={(v) => setAddContract(v === 'none' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر عقدًا أو اتركه فارغاً للحساب العام" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60">
                    <SelectItem value="none">حساب عام (بدون عقد محدد)</SelectItem>
                    {customerContracts.map((ct)=> (
                      <SelectItem key={String(ct.Contract_Number)} value={String(ct.Contract_Number)}>{String(ct.Contract_Number)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div>
              <label className="text-sm font-medium">المبلغ</label>
              <Input type="number" value={addAmount} onChange={(e)=>setAddAmount(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">طريقة الدفع</label>
              <Select value={addMethod} onValueChange={setAddMethod}>
                <SelectTrigger><SelectValue placeholder="اختر طريقة الدفع" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="نقدي">نقدي</SelectItem>
                  <SelectItem value="تحويل بنكي">تحويل بنكي</SelectItem>
                  <SelectItem value="شيك">شيك</SelectItem>
                  <SelectItem value="بطاقة ائتمان">بطاقة ائتمان</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">المرجع</label>
              <Input value={addReference} onChange={(e)=>setAddReference(e.target.value)} placeholder="رقم المرجع أو الشيك" />
            </div>
            <div>
              <label className="text-sm font-medium">التاريخ</label>
              <Input type="date" value={addDate} onChange={(e)=>setAddDate(e.target.value)} />
            </div>
            <div>
              <label className="text-sm font-medium">ملاحظات</label>
              <Input value={addNotes} onChange={(e)=>setAddNotes(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setAddOpen(false)}>إلغاء</Button>
              <Button onClick={async () => {
                try {
                  if (!addAmount) { toast.error('أدخل المبلغ'); return; }
                  const amt = Number(addAmount);
                  if (!amt || amt <= 0) { toast.error('المبلغ يجب أن يكون أكبر من صفر'); return; }
                  
                  const payload = {
                    customer_id: customers.find(c => c.name === selectedCustomerName)?.id || (typeof selectedCustomer === 'string' && !selectedCustomer.startsWith('name:') ? selectedCustomer : null),
                    customer_name: selectedCustomerName,
                    contract_number: addType === 'account_payment' ? null : (addContract || null),
                    amount: amt,
                    method: addMethod || null,
                    reference: addReference || null,
                    notes: addNotes || null,
                    paid_at: addDate ? new Date(addDate).toISOString() : new Date().toISOString(),
                    entry_type: addType === 'account_payment' ? 'account_payment' : addType,
                  } as any;
                  
                  const { error } = await supabase.from('customer_payments').insert(payload);
                  if (error) { console.error(error); toast.error('فشل الحفظ'); return; }
                  toast.success('تمت الإضافة بنجاح');
                  setAddOpen(false);
                  if (selectedCustomer) await openCustomer(selectedCustomer);
                  await loadData();
                } catch (e) {
                  console.error(e);
                  toast.error('خطأ غير متوقع');
                }
              }}>حفظ</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Receipt Dialog */}
      <Dialog open={editReceiptOpen} onOpenChange={setEditReceiptOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تعديل الإيصال</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-4">
            <div>
              <label className="text-sm font-medium">المبلغ</label>
              <Input
                type="number"
                value={receiptAmount}
                onChange={(e) => setReceiptAmount(e.target.value)}
                placeholder="المبلغ"
              />
            </div>
            <div>
              <label className="text-sm font-medium">طريقة الدفع</label>
              <Select value={receiptMethod} onValueChange={setReceiptMethod}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر طريقة الدفع" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="نقدي">نقدي</SelectItem>
                  <SelectItem value="تحويل بنكي">تحويل بنكي</SelectItem>
                  <SelectItem value="شيك">شيك</SelectItem>
                  <SelectItem value="بطاقة ائتمان">بطاقة ائتمان</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium">المرجع</label>
              <Input
                value={receiptReference}
                onChange={(e) => setReceiptReference(e.target.value)}
                placeholder="رقم المرجع أو الشيك"
              />
            </div>
            <div>
              <label className="text-sm font-medium">تاريخ الدفع</label>
              <Input
                type="date"
                value={receiptDate}
                onChange={(e) => setReceiptDate(e.target.value)}
              />
            </div>
            <div>
              <label className="text-sm font-medium">ملاحظات</label>
              <Input
                value={receiptNotes}
                onChange={(e) => setReceiptNotes(e.target.value)}
                placeholder="ملاحظات إضافية"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setEditReceiptOpen(false)}>إلغاء</Button>
              <Button onClick={saveReceiptEdit}>حفظ التعديلات</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Print Invoice Dialog (Enhanced) */}
      <Dialog open={printInvOpen} onOpenChange={setPrintInvOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>فاتورة شاملة محسنة</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="text-sm text-muted-foreground">العميل: {selectedCustomerName}</div>
            
            <div>
              <label className="text-sm font-medium mb-2 block">اختر العقود (يمكن اختيار أكثر من عقد):</label>
              <div className="space-y-2 max-h-40 overflow-y-auto border rounded p-3">
                {customerContracts.map((ct)=>{
                  const num = String(ct.Contract_Number||'');
                  const isSelected = selectedContractsForInv.includes(num);
                  return (
                    <div key={num} className="flex items-center space-x-2">
                      <Checkbox
                        id={`contract-${num}`}
                        checked={isSelected}
                        onCheckedChange={(checked) => {
                          if (checked) {
                            setSelectedContractsForInv(prev => [...prev, num]);
                          } else {
                            setSelectedContractsForInv(prev => prev.filter(c => c !== num));
                          }
                        }}
                      />
                      <label htmlFor={`contract-${num}`} className="text-sm cursor-pointer">
                        عقد رقم {num} - {ct['Ad Type'] || '—'} - {(Number(ct['Total Rent']) || 0).toLocaleString('en-US')} د.ل
                      </label>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="border rounded p-3">
              <div className="text-sm font-medium mb-2">عدد اللوحات حسب المقاس</div>
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="border px-2 py-1">المقاس</th>
                      <th className="border px-2 py-1">الكمية</th>
                      <th className="border px-2 py-1">سعر الوحدة (طباعة)</th>
                      <th className="border px-2 py-1">الإجمالي</th>
                      <th className="border px-2 py-1">إجراءات</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.keys(sizeCounts).length === 0 && (
                      <tr>
                        <td colSpan={5} className="text-center text-sm text-muted-foreground py-2">لا توجد لوحات للعقود المحددة</td>
                      </tr>
                    )}
                    {Object.entries(sizeCounts).map(([size, qty]) => {
                      const unit = Number(printPrices[size] || 0);
                      const line = (Number(qty)||0) * unit;
                      return (
                        <tr key={size}>
                          <td className="border px-2 py-1 text-center">{size}</td>
                          <td className="border px-2 py-1 text-center">
                            <Input type="number" className="w-24 mx-auto" value={String(qty)} onChange={(e)=> setSizeCounts((p)=> ({...p, [size]: Math.max(0, Number(e.target.value)||0)}))} />
                          </td>
                          <td className="border px-2 py-1 text-center">
                            <Input type="number" className="w-28 mx-auto" value={String(unit)} onChange={(e)=> setPrintPrices((p)=> ({...p, [size]: Math.max(0, Number(e.target.value)||0)}))} />
                          </td>
                          <td className="border px-2 py-1 text-center">{line.toLocaleString('ar-LY')} د.ل</td>
                          <td className="border px-2 py-1 text-center">
                            <Button variant="outline" size="sm" onClick={()=> setSizeCounts((p)=> { const c={...p}; delete c[size]; return c; })}>حذف</Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Checkbox
                id="include-account-balance"
                checked={includeAccountBalance}
                onCheckedChange={setIncludeAccountBalance}
              />
              <label htmlFor="include-account-balance" className="text-sm cursor-pointer">
                إضافة رصيد الحساب العام للعميل
              </label>
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setPrintInvOpen(false)}>إغلاق</Button>
              <Button onClick={printMultiContractInvoice} className="bg-blue-600 hover:bg-blue-700">
                <Printer className="h-4 w-4 ml-2" />
                طباعة الفاتورة الشاملة
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Previous Debt Dialog */}
      <Dialog open={addDebtOpen} onOpenChange={setAddDebtOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة دين سابق</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 mt-2">
            <div>
              <label className="text-sm font-medium">المبلغ</label>
              <Input type="number" value={debtAmount} onChange={(e)=> setDebtAmount(e.target.value)} placeholder="0" />
            </div>
            <div>
              <label className="text-sm font-medium">ملاحظات</label>
              <Input value={debtNotes} onChange={(e)=> setDebtNotes(e.target.value)} placeholder="ملاحظات" />
            </div>
            <div>
              <label className="text-sm font-medium">التاريخ</label>
              <Input type="date" value={debtDate} onChange={(e)=> setDebtDate(e.target.value)} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={()=> setAddDebtOpen(false)}>إلغاء</Button>
              <Button onClick={async ()=>{
                try {
                  if (!debtAmount) { toast.error('أدخل المبلغ'); return; }
                  const amt = Number(debtAmount);
                  if (!amt || amt <= 0) { toast.error('المبلغ يجب أن يكون أكبر من صفر'); return; }
                  
                  const payload = {
                    customer_id: customers.find(c => c.name === selectedCustomerName)?.id || (typeof selectedCustomer === 'string' && !selectedCustomer.startsWith('name:') ? selectedCustomer : null),
                    customer_name: selectedCustomerName,
                    contract_number: null,
                    amount: amt,
                    method: 'دين سابق',
                    reference: null,
                    notes: debtNotes || null,
                    paid_at: debtDate ? new Date(debtDate).toISOString() : new Date().toISOString(),
                    entry_type: 'debt',
                  } as any;
                  
                  const { error } = await supabase.from('customer_payments').insert(payload);
                  if (error) { console.error(error); toast.error('فشل الحفظ'); return; }
                  toast.success('تمت إضافة الدين');
                  setAddDebtOpen(false);
                  if (selectedCustomer) await openCustomer(selectedCustomer);
                  await loadData();
                } catch (e) {
                  console.error(e);
                  toast.error('خطأ غير متوقع');
                }
              }}>حفظ</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

    </div>
  );
}