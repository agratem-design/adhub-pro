import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { toast } from '@/components/ui/sonner';
import { Printer, Calculator, Receipt, Info, FileText } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { fetchAllBillboards } from '@/services/supabaseService';
// Legacy print imports removed - unified engine used via PrintInvoicePrint
import { getContractWithBillboards } from '@/services/contractService';

// Import components
import { SummaryCards } from '@/components/billing/SummaryCards';
import { ContractSection } from '@/components/billing/ContractSection';
import { PaymentSection } from '@/components/billing/PaymentSection';
import ModernPrintInvoiceDialog from '@/components/billing/ModernPrintInvoiceDialog';
import { SalesSection } from '@/components/billing/SalesSection';

// ✅ Import new receipt and account statement dialogs
import ReceiptPrintDialog from '@/components/billing/ReceiptPrintDialog';
import AccountStatementDialog from '@/components/billing/AccountStatementDialog';
import { SendReceiptDialog } from '@/components/billing/SendReceiptDialog';

// ✅ Import unified financial hook
import { useCustomerFinancials } from '@/hooks/useCustomerFinancials';

// Import types and utilities
import {
  PaymentRow,
  ContractRow,
  PrintedInvoiceRow,
} from '@/components/billing/BillingTypes';

import {
  getContractDetails,
  translateInvoiceType
} from '@/components/billing/BillingUtils';

interface PrintItem {
  size: string;
  quantity: number;
  faces: number; // عدد الأوجه لكل لوحة
  totalFaces: number; // إجمالي الأوجه (quantity × faces)
  area: number;
  pricePerMeter: number;
  totalArea: number;
  totalPrice: number;
  sortOrder: number;
  width: number;
  height: number;
}

export default function CustomerBilling() {
  const location = useLocation();
  const navigate = useNavigate();
  const params = new URLSearchParams(location.search);
  const paramId = params.get('id') || '';
  const paramName = params.get('name') || '';
  const modernPrintFlag = params.get('modernPrint');

  // Basic state
  const [customerId, setCustomerId] = useState<string>(paramId);
  const [customerName, setCustomerName] = useState<string>(paramName);
  const [contracts, setContracts] = useState<ContractRow[]>([]);
  const [payments, setPayments] = useState<PaymentRow[]>([]);
  const [printedInvoices, setPrintedInvoices] = useState<PrintedInvoiceRow[]>([]);
  const [salesInvoices, setSalesInvoices] = useState<any[]>([]);
  const [allBillboards, setAllBillboards] = useState<any[]>([]);

  // ✅ استخدام الـ hook الموحد للحسابات المالية
  const customerFinancials = useCustomerFinancials(customerId || null);

  // Dialog states
  const [editReceiptOpen, setEditReceiptOpen] = useState(false);
  const [editingReceipt, setEditingReceipt] = useState<PaymentRow | null>(null);
  const [editReceiptAmount, setEditReceiptAmount] = useState('');
  const [editReceiptMethod, setEditReceiptMethod] = useState('');
  const [editReceiptReference, setEditReceiptReference] = useState('');
  const [editReceiptNotes, setEditReceiptNotes] = useState('');
  const [editReceiptDate, setEditReceiptDate] = useState('');

  const [addDebtOpen, setAddDebtOpen] = useState(false);
  const [debtAmount, setDebtAmount] = useState('');
  const [debtNotes, setDebtNotes] = useState('');
  const [debtDate, setDebtDate] = useState<string>(()=> new Date().toISOString().slice(0,10));

  // Enhanced print invoice states
  const [printContractInvoiceOpen, setPrintContractInvoiceOpen] = useState(false);
  const [selectedContractsForInv, setSelectedContractsForInv] = useState<string[]>([]);
  const [editingInvoice, setEditingInvoice] = useState<any | null>(null);
  const [printOpenToPreview, setPrintOpenToPreview] = useState(false);
  const [printAuto, setPrintAuto] = useState(false);
  const [printForPrinter, setPrintForPrinter] = useState(false);
  const [sizeCounts, setSizeCounts] = useState<Record<string, number>>({});
  const [printPrices, setPrintPrices] = useState<Record<string, number>>({});
  const [sizeAreas, setSizeAreas] = useState<Record<string, number>>({});
  const [sizeFaces, setSizeFaces] = useState<Record<string, number>>({});
  const [printItems, setPrintItems] = useState<PrintItem[]>([]);
  const [includeAccountBalance, setIncludeAccountBalance] = useState(false);

  // Contract PDF Dialog state
  const [contractPDFOpen, setContractPDFOpen] = useState(false);
  const [selectedContractForPDF, setSelectedContractForPDF] = useState<any>(null);

  // ✅ NEW: Receipt and Account Statement dialog states
  const [receiptPrintOpen, setReceiptPrintOpen] = useState(false);
  const [selectedPaymentForReceipt, setSelectedPaymentForReceipt] = useState<any>(null);
  const [accountStatementOpen, setAccountStatementOpen] = useState(false);
  const [sendReceiptOpen, setSendReceiptOpen] = useState(false);
  const [selectedPaymentForSend, setSelectedPaymentForSend] = useState<any>(null);

  // Account payment dialog states
  const [accountPaymentOpen, setAccountPaymentOpen] = useState(false);
  const [accountPaymentAmount, setAccountPaymentAmount] = useState('');
  const [accountPaymentMethod, setAccountPaymentMethod] = useState('');
  const [accountPaymentReference, setAccountPaymentReference] = useState('');
  const [accountPaymentNotes, setAccountPaymentNotes] = useState('');
  const [accountPaymentDate, setAccountPaymentDate] = useState<string>(()=> new Date().toISOString().slice(0,10));
  const [accountPaymentContract, setAccountPaymentContract] = useState('');
  const [accountPaymentToGeneral, setAccountPaymentToGeneral] = useState(true);

  // ✅ FIXED: Use history.replaceState to avoid triggering React Router re-render
  useEffect(() => {
    if (modernPrintFlag) {
      setPrintContractInvoiceOpen(true);
      const cleanedParams = new URLSearchParams(location.search);
      cleanedParams.delete('modernPrint');
      const nextSearch = cleanedParams.toString();
      const newUrl = `${location.pathname}${nextSearch ? `?${nextSearch}` : ''}`;
      window.history.replaceState(null, '', newUrl);
    }
  }, [modernPrintFlag]);

  // Initialize customer data
  useEffect(() => {
    (async () => {
      try {
        if (customerId && !customerName) {
          const { data } = await supabase.from('customers').select('name').eq('id', customerId).single();
          setCustomerName(data?.name || '');
        }
        if (!customerId && customerName) {
          const { data } = await supabase.from('customers').select('id').ilike('name', customerName).limit(1).maybeSingle();
          if (data?.id) setCustomerId(data.id);
        }
      } catch {}
    })();
  }, [customerId, customerName]);

  // ✅ FIXED: Load data with proper contract-payment relationship

  const loadData = async () => {
    try {
      let paymentsData: PaymentRow[] = [];
      if (customerId) {
        const p = await (supabase as any).from('customer_payments').select('*').eq('customer_id', customerId).order('created_at', { ascending: true });
        if (!p.error) paymentsData = (p.data || []) as PaymentRow[];
      }
      if ((!paymentsData || paymentsData.length === 0) && customerName) {
        const p = await (supabase as any).from('customer_payments').select('*').ilike('customer_name', `%${customerName}%`).order('created_at', { ascending: true });
        if (!p.error) paymentsData = (p.data || []) as PaymentRow[];
      }

      let contractsData: ContractRow[] = [];
      if (customerId) {
        const c = await (supabase as any).from('Contract').select('*').eq('customer_id', customerId);
        if (!c.error) contractsData = (c.data || []) as ContractRow[];
      }
      if ((!contractsData || contractsData.length === 0) && customerName) {
        const c = await (supabase as any).from('Contract').select('*').ilike('Customer Name', `%${customerName}%`);
        if (!c.error) contractsData = (c.data || []) as ContractRow[];
      }
      setContracts(contractsData);

      // ✅ إيجارات الشركات الصديقة يتم تحميلها من الـ hook الموحد

      let printedInvoicesData: PrintedInvoiceRow[] = [];
      try {
        if (customerId) {
          const { data, error } = await (supabase as any)
            .from('printed_invoices')
            .select('*')
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false });
          if (!error && data) {
            // ✅ فلترة الفواتير لاستبعاد فواتير الطباعة والقص الناتجة من مهام التركيب
            // لأنها محسوبة ضمن المهام المجمعة
            const compositePrintTaskIds = new Set<string>();
            const compositeCutoutTaskIds = new Set<string>();
            
            // جلب المهام المجمعة للحصول على ids الفواتير المرتبطة
            const { data: compositeTasks } = await supabase
              .from('composite_tasks')
              .select('print_task_id, cutout_task_id, combined_invoice_id')
              .eq('customer_id', customerId);
            
            if (compositeTasks) {
              for (const ct of compositeTasks) {
                if (ct.print_task_id) compositePrintTaskIds.add(ct.print_task_id);
                if (ct.cutout_task_id) compositeCutoutTaskIds.add(ct.cutout_task_id);
              }
            }
            
            // جلب invoice_ids من مهام الطباعة والقص المجمعة
            const compositeInvoiceIds = new Set<string>();
            
            // ✅ إضافة combined_invoice_id من المهام المجمعة مباشرة
            if (compositeTasks) {
              for (const ct of compositeTasks) {
                if (ct.combined_invoice_id) compositeInvoiceIds.add(ct.combined_invoice_id);
              }
            }
            
            if (compositePrintTaskIds.size > 0) {
              const { data: printTasks } = await supabase
                .from('print_tasks')
                .select('invoice_id')
                .in('id', Array.from(compositePrintTaskIds));
              printTasks?.forEach((pt: any) => {
                if (pt.invoice_id) compositeInvoiceIds.add(pt.invoice_id);
              });
            }
            
            if (compositeCutoutTaskIds.size > 0) {
              const { data: cutoutTasks } = await supabase
                .from('cutout_tasks')
                .select('invoice_id')
                .in('id', Array.from(compositeCutoutTaskIds));
              cutoutTasks?.forEach((ct: any) => {
                if (ct.invoice_id) compositeInvoiceIds.add(ct.invoice_id);
              });
            }
            
            // فلترة الفواتير لاستبعاد تلك المرتبطة بالمهام المجمعة
            printedInvoicesData = data.filter((inv: any) => !compositeInvoiceIds.has(inv.id));
          }
        } else if (customerName) {
          // Fallback: if no customerId, try to match by customer name (fuzzy)
          const { data, error } = await (supabase as any)
            .from('printed_invoices')
            .select('*')
            .ilike('customer_name', `%${customerName}%`)
            .order('created_at', { ascending: false });
          if (!error && data) printedInvoicesData = data;
        }
      } catch (e) {
        console.warn('Error loading printed_invoices:', e);
        printedInvoicesData = [];
      }
      setPrintedInvoices(printedInvoicesData || []);

      // تحميل فواتير المبيعات
      let salesInvoicesData: any[] = [];
      try {
        if (customerId) {
          const { data, error } = await supabase
            .from('sales_invoices')
            .select('*')
            .eq('customer_id', customerId)
            .order('created_at', { ascending: false });
          if (!error && data) salesInvoicesData = data;
        }
      } catch (e) {
        console.warn('Error loading sales_invoices:', e);
        salesInvoicesData = [];
      }
      setSalesInvoices(salesInvoicesData || []);

      // تحميل دفعات فواتير المبيعات وإضافتها إلى payments
      try {
        if (customerId) {
          const { data, error } = await supabase
            .from('sales_invoice_payments')
            .select('*')
            .eq('customer_id', customerId);

          if (!error && data) {
            const salesPayments = data.map(payment => ({
              ...payment,
              entry_type: 'sales_invoice' as const,
              customer_name: customerName
            }));
            paymentsData = [...paymentsData, ...salesPayments as any];
          }
        }
      } catch (e) {
        console.warn('Error loading sales_invoice_payments:', e);
      }

      // تحميل دفعات فواتير المشتريات وإضافتها إلى payments
      try {
        if (customerId) {
          const { data, error } = await supabase
            .from('purchase_invoice_payments')
            .select('*')
            .eq('customer_id', customerId);

          if (!error && data) {
            const purchasePayments = data.map(payment => ({
              ...payment,
              entry_type: 'purchase_invoice' as const,
              customer_name: customerName
            }));
            paymentsData = [...paymentsData, ...purchasePayments as any];
          }
        }
      } catch (e) {
        console.warn('Error loading purchase_invoice_payments:', e);
      }

      setPayments(paymentsData);
      // ✅ الخصومات يتم تحميلها من الـ hook الموحد

      try {
        const billboards = await fetchAllBillboards();
        setAllBillboards(billboards as any);
      } catch {
        setAllBillboards([]);
      }
    } catch (e) {
      console.error(e);
      toast.error('فشل تحميل البيانات');
    }
  };

  useEffect(() => { loadData(); }, [customerId, customerName]);

  // ✅ إصلاح حساب عدد الأوجه - حساب إجمالي الأوجه من جميع اللوحات
  useEffect(() => {
    const sel = new Set(selectedContractsForInv);
    const boards = allBillboards.filter((b: any) => 
      sel.has(String(b.Contract_Number || '')) && 
      (!customerName || String(b.Customer_Name || '').toLowerCase().includes(customerName.toLowerCase()))
    );
    
    const counts: Record<string, number> = {};
    const totalFacesPerSize: Record<string, number> = {};
    const facesPerBoard: Record<string, number> = {};
    
    for (const b of boards) {
      const size = String(b.Size || b.size || '—');
      const faceCount = Number(b.Faces || b.faces || b.Number_of_Faces || b.Faces_Count || b.faces_count || 1);
      
      counts[size] = (counts[size] || 0) + 1;
      totalFacesPerSize[size] = (totalFacesPerSize[size] || 0) + faceCount;
      
      // حفظ عدد الأوجه لكل لوحة (للعرض)
      if (!facesPerBoard[size]) {
        facesPerBoard[size] = faceCount;
      }
    }
    
    setSizeCounts(counts);
    setSizeFaces(facesPerBoard);
    
    console.log('✅ حساب الأوجه الجديد:', {
      counts,
      totalFacesPerSize,
      facesPerBoard
    });
  }, [selectedContractsForInv, allBillboards, customerName]);

  // Load size information and print prices
  useEffect(() => {
    const sizes = Object.keys(sizeCounts);
    if (sizes.length === 0) { 
      setPrintPrices({});
      setSizeAreas({});
      return; 
    }

    (async () => {
      try {
        let sizeData: any[] = [];
        
        // Query sizes table using raw SQL to avoid type errors
        const { data: sizeData2, error } = await supabase.rpc('show_tables_summary' as any) as any;
        
        if (!error) {
          // Fallback: query sizes directly
          const { data: directSizes } = await supabase
            .from('sizes' as any)
            .select('name, width, height')
            .in('name', sizes) as any;
          
          if (directSizes) {
            sizeData = directSizes;
          }
        }

        const areas: Record<string, number> = {};
        const prices: Record<string, number> = {};
        
        sizes.forEach(size => {
          const sizeInfo = sizeData.find(s => s.name === size);
          if (sizeInfo && sizeInfo.width && sizeInfo.height) {
            const width = parseFloat(sizeInfo.width);
            const height = parseFloat(sizeInfo.height);
            areas[size] = width * height;
          } else {
            areas[size] = 1;
          }
          prices[size] = 25;
        });

        setSizeAreas(areas);
        setPrintPrices(prices);

        try {
          const { data: pricingData, error: pricingError } = await supabase
            .from('installation_print_pricing')
            .select('size, print_price')
            .in('size', sizes);
          
          if (!pricingError && Array.isArray(pricingData)) {
            const updatedPrices = { ...prices };
            pricingData.forEach((r: any) => {
              if (r.size && r.print_price) {
                updatedPrices[r.size] = Number(r.print_price) || 25;
              }
            });
            setPrintPrices(updatedPrices);
          }
        } catch (pricingErr) {
          console.log('Could not load pricing data, using defaults');
        }

      } catch (err) {
        console.error('Error loading size data:', err);
        const defaultAreas: Record<string, number> = {};
        const defaultPrices: Record<string, number> = {};
        sizes.forEach(size => {
          defaultAreas[size] = 1;
          defaultPrices[size] = 25;
        });
        setSizeAreas(defaultAreas);
        setPrintPrices(defaultPrices);
      }
    })();
  }, [sizeCounts]);

  // ✅ تحديث حساب عناصر الطباعة مع إجمالي الأوجه الصحيح
  useEffect(() => {
    if (Object.keys(sizeCounts).length > 0) {
      const sel = new Set(selectedContractsForInv);
      const boards = allBillboards.filter((b: any) => 
        sel.has(String(b.Contract_Number || '')) && 
        (!customerName || String(b.Customer_Name || '').toLowerCase().includes(customerName.toLowerCase()))
      );

      const items: PrintItem[] = Object.entries(sizeCounts).map(([size, quantity]) => {
        const area = sizeAreas[size] || 1;
        const facesPerBoard = sizeFaces[size] || 1;
        const pricePerMeter = printPrices[size] || 25;
        
        // ✅ حساب إجمالي الأوجه من جميع اللوحات بهذا المقاس
        const boardsOfThisSize = boards.filter(b => String(b.Size || b.size || '—') === size);
        const totalFaces = boardsOfThisSize.reduce((sum, board) => {
          const boardFaces = Number((board as any).Faces_Count || (board as any).faces || facesPerBoard);
          return sum + boardFaces;
        }, 0);

        const totalArea = area * totalFaces;
        const totalPrice = totalArea * pricePerMeter;

        console.log(`✅ ${size}: ${quantity} لوحة، ${facesPerBoard} وجه/لوحة، إجمالي الأوجه: ${totalFaces}`);

        return {
          size,
          quantity,
          faces: facesPerBoard,
          totalFaces,
          area,
          pricePerMeter,
          totalArea,
          totalPrice,
          sortOrder: 0,
          width: 0,
          height: 0
        };
      });
      setPrintItems(items);
    } else {
      setPrintItems([]);
    }
  }, [sizeCounts, sizeAreas, printPrices, sizeFaces, selectedContractsForInv, allBillboards, customerName]);

  // ✅ استخدام البيانات المالية من الـ hook الموحد
  // هذا يضمن توحيد الحسابات في جميع أجزاء التطبيق
  const totalDebits = customerFinancials.totalDebt;
  const totalCredits = customerFinancials.totalPaid;
  const totalDiscounts = customerFinancials.totalDiscounts;
  const balance = customerFinancials.remainingDebt;
  const totalFriendRentals = customerFinancials.totalFriendRentals;
  const totalPurchases = customerFinancials.totalPurchases;

  // ✅ إصلاح حساب رصيد الحساب العام - فقط المدفوعات العامة
  const accountPayments = useMemo(() => 
    payments.filter(p => p.entry_type === 'account_payment')
      .reduce((s, p) => s + (Number(p.amount) || 0), 0), [payments]);

  // ✅ حساب إجمالي مبيعات الزبون (فواتير المبيعات)
  const totalSales = useMemo(() => {
    return payments.reduce((s, p) => {
      const amount = Number(p.amount) || 0;
      if (p.entry_type === 'sales_invoice') {
        return s + amount;
      }
      return s;
    }, 0);
  }, [payments]);

  // ✅ FIXED: Calculate payments per contract using proper type conversion
  const getContractPayments = (contractNumber: number | string): number => {
    const contractNumStr = String(contractNumber);
    return payments
      .filter(p => {
        const paymentContractNum = String(p.contract_number || '');
        const isMatch = paymentContractNum === contractNumStr;
        // ✅ FIXED: إضافة 'payment' للدفعات الموزعة
        const isValidType = p.entry_type === 'receipt' || p.entry_type === 'account_payment' || p.entry_type === 'payment';
        return isMatch && isValidType;
      })
      .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  };

  // ✅ NEW: Calculate remaining balance for each contract
  const getContractRemaining = (contract: ContractRow): number => {
    const contractTotal = Number((contract as any)['Total']) || 0;
    const contractNum = typeof contract.Contract_Number === 'string' 
      ? contract.Contract_Number 
      : String(contract.Contract_Number);
    const contractPaid = getContractPayments(contractNum);
    return contractTotal - contractPaid;
  };

  // Event handlers
  const openEditReceipt = (payment: PaymentRow) => {
    setEditingReceipt(payment);
    setEditReceiptAmount(String(payment.amount || ''));
    setEditReceiptMethod(payment.method || '');
    setEditReceiptReference(payment.reference || '');
    setEditReceiptNotes(payment.notes || '');
    setEditReceiptDate(payment.paid_at ? payment.paid_at.split('T')[0] : '');
    setEditReceiptOpen(true);
  };

  // ✅ NEW: Open receipt print dialog
  const openReceiptPrint = (payment: PaymentRow) => {
    setSelectedPaymentForReceipt(payment);
    setReceiptPrintOpen(true);
  };

  // ✅ NEW: Open send receipt dialog
  const openSendReceipt = (payment: PaymentRow) => {
    setSelectedPaymentForSend(payment);
    setSendReceiptOpen(true);
  };

  // ✅ NEW: Open account statement dialog
  const openAccountStatement = () => {
    setAccountStatementOpen(true);
  };

  const saveReceiptEdit = async () => {
    if (!editingReceipt) return;
    try {
      const { error } = await supabase.from('customer_payments').update({
        amount: Number(editReceiptAmount) || 0,
        method: editReceiptMethod || null,
        reference: editReceiptReference || null,
        notes: editReceiptNotes || null,
        paid_at: editReceiptDate ? new Date(editReceiptDate).toISOString() : null,
      }).eq('id', editingReceipt.id).select();
      
      if (error) { 
        console.error('Update error:', error);
        toast.error('فشل في تحديث الإيصال: ' + error.message); 
        return; 
      }
      
      toast.success('تم تحديث الإيصال');
      setEditReceiptOpen(false); 
      setEditingReceipt(null);
      await loadData();
    } catch (e) {
      console.error(e); 
      toast.error('خطأ في حفظ الإيصال');
    }
  };

  const deleteReceipt = async (id: string) => {
    if (!window.confirm('تأكيد حذف الإيصال؟')) return;
    try {
      const { error } = await supabase.from('customer_payments').delete().eq('id', id);
      if (error) { 
        toast.error('فشل الحذف'); 
        return; 
      }
      toast.success('تم الحذف');
      await loadData();
    } catch (e) { 
      console.error(e); 
      toast.error('خطأ في الحذف'); 
    }
  };

  const updatePrintItem = (index: number, field: keyof PrintItem, value: number) => {
    const newItems = [...printItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'quantity' || field === 'pricePerMeter' || field === 'totalFaces') {
      newItems[index].totalArea = newItems[index].area * newItems[index].totalFaces;
      newItems[index].totalPrice = newItems[index].totalArea * newItems[index].pricePerMeter;
    }
    
    setPrintItems(newItems);
  };

  const removeItem = (index: number) => {
    const newItems = printItems.filter((_, i) => i !== index);
    setPrintItems(newItems);
  };

  // ...existing code... (printing is now handled inside ModernPrintInvoiceDialog)

  // Print a saved invoice object (same style as modern print)
  const printSavedInvoice = (invoice: PrintedInvoiceRow) => {
    // Open the ModernPrintInvoiceDialog prefilled in preview mode and auto-print (normal)
    openEditPrintedInvoice(invoice, true, true, false);
  };

  // Print a saved invoice with printer-friendly layout (for internal print shop)
  const printSavedInvoiceForPrinter = (invoice: PrintedInvoiceRow) => {
    // Open the ModernPrintInvoiceDialog prefilled in preview mode and auto-print for printer
    openEditPrintedInvoice(invoice, true, true, true);
  };

  // Edit a saved printed invoice
  const openEditPrintedInvoice = (invoice: PrintedInvoiceRow, preview: boolean = false, auto: boolean = false, forPrinter: boolean = false) => {
    // Ensure print_items is parsed (it might be stored as a JSON string)
    let editable = invoice as any;
    try {
      const raw = (invoice as any).print_items ?? (invoice as any).print_items_json ?? (invoice as any).items ?? (invoice as any).items_json ?? null;
      if (raw && typeof raw === 'string') {
        try { editable = { ...editable, print_items: JSON.parse(raw) }; } catch (e) { /* ignore parse error */ }
      } else if (raw && Array.isArray(raw)) {
        editable = { ...editable, print_items: raw };
      }
    } catch (e) {
      // ignore
    }
    console.log('CustomerBilling: opening saved invoice for edit:', { invoice, editable });
    setEditingInvoice(editable as any);
    // Open the same modern print dialog for editing
    const initialContractNums = Array.isArray(invoice.contract_numbers) 
      ? invoice.contract_numbers.map(String) 
      : (invoice.contract_numbers 
        ? String(invoice.contract_numbers).split(',').map(s=>s.trim()) 
        : (invoice.contract_number ? [String(invoice.contract_number)] : []));
    setSelectedContractsForInv(Array.from(new Set(initialContractNums)));
    setPrintOpenToPreview(preview);
    setPrintAuto(auto);
    setPrintForPrinter(forPrinter);
    setPrintContractInvoiceOpen(true);
  };

  const deletePrintedInvoice = async (invoice: PrintedInvoiceRow) => {
    if (!invoice || !invoice.id) return;
    if (!window.confirm('تأكيد حذف الفاتورة؟')) return;
    try {
      // التحقق مما إذا كانت الفاتورة مرتبطة بمهمة مجمعة
      const { data: compositeTask } = await supabase
        .from('composite_tasks')
        .select('id, print_task_id, cutout_task_id')
        .eq('combined_invoice_id', invoice.id)
        .maybeSingle();
      
      if (compositeTask) {
        // حذف فواتير الطباعة والقص المرتبطة
        if (compositeTask.print_task_id) {
          const { data: printTask } = await supabase
            .from('print_tasks')
            .select('invoice_id')
            .eq('id', compositeTask.print_task_id)
            .single();
          
          if (printTask?.invoice_id) {
            await supabase.from('customer_payments').delete().eq('printed_invoice_id', printTask.invoice_id);
            await supabase.from('printed_invoices').delete().eq('id', printTask.invoice_id);
          }
        }
        
        if (compositeTask.cutout_task_id) {
          const { data: cutoutTask } = await supabase
            .from('cutout_tasks')
            .select('invoice_id')
            .eq('id', compositeTask.cutout_task_id)
            .single();
          
          if (cutoutTask?.invoice_id) {
            await supabase.from('customer_payments').delete().eq('printed_invoice_id', cutoutTask.invoice_id);
            await supabase.from('printed_invoices').delete().eq('id', cutoutTask.invoice_id);
          }
        }
        
        // تحديث المهمة المجمعة
        await supabase
          .from('composite_tasks')
          .update({ combined_invoice_id: null, invoice_generated: false })
          .eq('id', compositeTask.id);
      }
      
      // حذف سجلات الدفع المرتبطة بالفاتورة
      await supabase.from('customer_payments').delete().eq('printed_invoice_id', invoice.id);
      
      const { error } = await (supabase as any).from('printed_invoices').delete().eq('id', invoice.id);
      if (error) { console.error('delete error', error); toast.error('فشل حذف الفاتورة'); return; }
      toast.success('تم حذف الفاتورة وجميع الفواتير المرتبطة');
      await loadData();
    } catch (e) {
      console.error('Failed to delete printed invoice', e);
      toast.error('فشل حذف الفاتورة');
    }
  };

  const saveContractInvoiceToAccount = async () => {
    if (selectedContractsForInv.length === 0) {
      toast.error('يرجى اختيار عقد واحد على الأقل لحفظ الفاتورة');
      return;
    }

    try {
      const printTotal = printItems.reduce((sum, item) => sum + item.totalPrice, 0);
      
      if (printTotal <= 0) {
        toast.error('لا يمكن حفظ فاتورة بقيمة صفر أو أقل');
        return;
      }

      // Generate a unique invoice number
      const invoice_number = `PRINT-${new Date().getTime()}`;

      // Prepare notes from print items
      const notes = printItems.map(item => 
        `${item.size}: ${item.quantity} لوحة, ${item.totalFaces} وجه, ${item.totalArea.toFixed(2)}م²`
      ).join('; ');

      // The user schema indicates contract_number is not nullable.
      // We will use the first selected contract number. If multiple are selected, we can consider how to handle it.
      // For now, we'll enforce selecting only one contract to save, or just use the first.
      // Let's use the first one for now.
      const contract_number = Number(selectedContractsForInv[0]);
      if (isNaN(contract_number)) {
        toast.error('رقم العقد المختار غير صالح.');
        return;
      }

      // The actual insert is handled by ModernPrintInvoiceDialog (it inserts with the selected invoice_type).
      // Here we just refresh the data and close the dialog (this function is passed as onSaveInvoice).
      toast.success('تم حفظ فاتورة الطباعة بنجاح. جارٍ تحديث السجل...');
      setPrintContractInvoiceOpen(false);
      // Clear state after saving
      setSelectedContractsForInv([]);
      setSizeCounts({});
      setPrintItems([]);
      await loadData();
    } catch (e) { 
      console.error('Invoice save error:', e); 
      toast.error(`خطأ غير متوقع: ${(e as Error).message}`); 
    }
  };

  return (
    <div className="expenses-container">
      {/* Header */}
      <Card className="expenses-preview-card">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-gradient-primary rounded-lg">
                <Receipt className="h-6 w-6 text-primary-foreground" />
              </div>
              <div>
                <CardTitle className="expenses-preview-title">فواتير وإيصالات العميل</CardTitle>
                <p className="text-muted-foreground">{customerName || '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                onClick={() => navigate('/admin/customers')} 
                className="gap-2 expenses-action-btn"
              >
                رجوع للزبائن
              </Button>
 {/* NEW: Only modern buttons - removed old ones */}
              <Button 
                onClick={openAccountStatement}
                className="gap-2 expenses-action-btn bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700 text-white font-semibold"
              >
                <FileText className="h-4 w-4" />
                كشف حساب الزبون
              </Button>
              <Button 
                onClick={() => {
                  setEditingInvoice(null);
                  setSelectedContractsForInv(contracts[0]?.Contract_Number ? [String(contracts[0]?.Contract_Number)] : []);
                  setPrintContractInvoiceOpen(true);
                }} 
                className="gap-2 expenses-action-btn bg-gradient-to-r from-primary to-primary-glow hover:from-primary-glow hover:to-primary text-primary-foreground shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Calculator className="h-4 w-4" />
                فاتورة طباعة عصرية
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Summary Cards */}
      <SummaryCards
        totalRent={customerFinancials.debtBreakdown.contracts}
        totalCredits={totalCredits}
        balance={balance}
        totalDiscounts={totalDiscounts}
        totalGeneralDebt={totalDebits}
        accountPayments={accountPayments}
        totalPurchases={totalPurchases}
        totalSales={totalSales}
        totalPrintedInvoices={customerFinancials.debtBreakdown.printedInvoices}
        totalFriendRentals={totalFriendRentals}
      />

 {/* FIXED: Use ContractSection component instead of inline table */}
      <ContractSection 
        contracts={contracts}
        payments={payments}
      />

      {/* Payments Section */}
      <PaymentSection 
        payments={payments}
        onEditReceipt={openEditReceipt}
        onDeleteReceipt={deleteReceipt}
        onPrintReceipt={openReceiptPrint}
        onSendReceipt={openSendReceipt}
        onAddDebt={() => { setAddDebtOpen(true); setDebtAmount(''); setDebtNotes(''); setDebtDate(new Date().toISOString().slice(0,10)); }}
        onAddAccountPayment={() => { setAccountPaymentOpen(true); setAccountPaymentAmount(''); setAccountPaymentMethod(''); setAccountPaymentReference(''); setAccountPaymentNotes(''); setAccountPaymentDate(new Date().toISOString().slice(0,10)); setAccountPaymentContract(''); setAccountPaymentToGeneral(true); }}
        totalRemainingDebt={balance}
        contracts={contracts as any}
        onRefresh={loadData}
      />

      {/* Sales Section */}
      <div className="mt-6">
        <SalesSection customerId={customerId} invoices={salesInvoices} onRefresh={loadData} />
      </div>

      {/* Printed Invoices Section */}
      <Card className="expenses-preview-card mt-6">
        <CardHeader>
          <CardTitle className="expenses-preview-title">فواتير الطباعة والتركيب المحفوظة</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="expenses-table-container">
            <table className="w-full">
              <thead>
                <tr className="expenses-table-header">
                  <th>رقم الفاتورة</th>
                  <th>التاريخ</th>
                  <th>النوع</th>
                  <th>أرقام العقود</th>
                  <th>نوع الإعلان</th>
                  <th>الإجمالي</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {printedInvoices.length > 0 ? (
                  printedInvoices.map((invoice) => (
                    <tr key={invoice.id} className="expenses-table-row">
                      <td className="num">{invoice.invoice_number}</td>
                      <td>{invoice.invoice_date ? new Date(invoice.invoice_date).toLocaleDateString('ar-LY') : ''}</td>
                      <td><Badge variant="outline">{translateInvoiceType(invoice.invoice_type)}</Badge></td>
                      <td className="num">{Array.isArray(invoice.contract_numbers) ? invoice.contract_numbers.join(', ') : (invoice.contract_numbers ?? invoice.contract_number ?? '')}</td>
                      <td className="text-xs max-w-[200px] truncate" title={getInvoiceAdTypes(invoice)}>{getInvoiceAdTypes(invoice)}</td>
                      <td className="expenses-amount-calculated num">
                        {((invoice.total_amount ?? 0) as number).toLocaleString('ar-LY')} د.ل
                      </td>
                      <td className="flex items-center justify-center gap-2 py-2">
                        <Button variant="outline" size="sm" onClick={() => printSavedInvoice(invoice)}>
                          <Printer className="h-4 w-4 ml-1" />
                          طباعة
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => printSavedInvoiceForPrinter(invoice)}>
                          <FileText className="h-4 w-4 ml-1" />
                          للمطبعة
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => openEditPrintedInvoice(invoice)}>
                          تعديل
                        </Button>
                        <Button variant="destructive" size="sm" onClick={() => deletePrintedInvoice(invoice)}>
                          حذف
                        </Button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr className="expenses-table-row">
                    <td colSpan={7} className="text-center text-muted-foreground py-6">
                      لا توجد فواتير طباعة محفوظة لهذا العميل.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Modern Print Invoice Dialog */}
      <ModernPrintInvoiceDialog
        open={printContractInvoiceOpen}
        onClose={() => { setPrintContractInvoiceOpen(false); setPrintOpenToPreview(false); setEditingInvoice(null); setPrintAuto(false); setPrintForPrinter(false); }}
        customerId={customerId}
        customerName={customerName}
        contracts={contracts as any}
        selectedContracts={selectedContractsForInv}
        onSelectContracts={setSelectedContractsForInv}
        printItems={printItems as any}
        onUpdatePrintItem={updatePrintItem}
        onRemoveItem={removeItem}
        includeAccountBalance={includeAccountBalance}
        onIncludeAccountBalance={setIncludeAccountBalance}
        accountPayments={accountPayments}
        onPrintInvoice={()=>{}}
  onSaveInvoice={async () => { setEditingInvoice(null); setPrintOpenToPreview(false); setPrintAuto(false); setPrintForPrinter(false); await saveContractInvoiceToAccount(); }}
        initialInvoice={editingInvoice}
        openToPreview={printOpenToPreview}
    autoPrint={printAuto}
    autoPrintForPrinter={printForPrinter}
      />

 {/* NEW: Receipt Print Dialog */}
      <ReceiptPrintDialog
        open={receiptPrintOpen}
        onOpenChange={setReceiptPrintOpen}
        payment={selectedPaymentForReceipt}
        customerName={customerName}
      />

 {/* NEW: Account Statement Dialog */}
      <AccountStatementDialog
        open={accountStatementOpen}
        onOpenChange={setAccountStatementOpen}
        customerId={customerId}
        customerName={customerName}
      />

 {/* NEW: Send Receipt Dialog */}
      <SendReceiptDialog
        open={sendReceiptOpen}
        onOpenChange={setSendReceiptOpen}
        payment={selectedPaymentForSend}
        customerName={customerName}
      />

      {/* Account Payment Dialog */}
      <Dialog open={accountPaymentOpen} onOpenChange={setAccountPaymentOpen}>
        <DialogContent className="max-w-md expenses-dialog-content" dir="rtl">
          <DialogHeader className="border-b border-slate-600 pb-4">
            <DialogTitle className="text-lg font-bold text-yellow-400 text-right">دفع�� على الحساب</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="bg-slate-700 p-3 rounded-lg border border-slate-600">
              <div className="text-sm text-slate-300 mb-1 font-medium">العميل:</div>
              <div className="font-semibold text-yellow-400">{customerName}</div>
            </div>
            
            <div className="bg-slate-700 border border-slate-600 rounded-lg p-3">
              <div className="text-sm font-semibold text-slate-300 mb-2 flex items-center gap-2">
                <Info className="h-4 w-4" />
                اختر وجهة الدفعة:
              </div>
              <div className="space-y-2">
                <label className={`flex items-center gap-2 cursor-pointer p-3 rounded-lg border-2 transition-all ${
                  accountPaymentToGeneral 
                    ? 'border-yellow-500 bg-yellow-900/20 text-yellow-300' 
                    : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500'
                }`}>
                  <input
                    type="radio"
                    name="payment-destination"
                    checked={accountPaymentToGeneral}
                    onChange={() => setAccountPaymentToGeneral(true)}
                    className="w-4 h-4 text-yellow-600"
                  />
                  <span className="text-sm font-medium">إضافة إلى الحساب العام</span>
                </label>
                <label className={`flex items-center gap-2 cursor-pointer p-3 rounded-lg border-2 transition-all ${
                  !accountPaymentToGeneral 
                    ? 'border-yellow-500 bg-yellow-900/20 text-yellow-300' 
                    : 'border-slate-600 bg-slate-800 text-slate-300 hover:border-slate-500'
                }`}>
                  <input
                    type="radio"
                    name="payment-destination"
                    checked={!accountPaymentToGeneral}
                    onChange={() => setAccountPaymentToGeneral(false)}
                    className="w-4 h-4 text-yellow-600"
                  />
                  <span className="text-sm font-medium">إضافة إلى عقد محدد</span>
                </label>
              </div>
            </div>

            {!accountPaymentToGeneral && (
              <div className="space-y-2">
                <label className="text-sm font-semibold text-slate-300 block">العقد</label>
                <Select value={accountPaymentContract} onValueChange={setAccountPaymentContract}>
                  <SelectTrigger className="text-right bg-slate-700 border-slate-600 text-slate-200">
                    <SelectValue placeholder="اختر عقدًا" />
                  </SelectTrigger>
                  <SelectContent className="max-h-60 bg-slate-700 border-slate-600">
                    {contracts.map((ct)=> (
                      <SelectItem key={String(ct.Contract_Number)} value={String(ct.Contract_Number)} className="text-slate-200">
                        عقد رقم {String(ct.Contract_Number)} - {ct['Ad Type']}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {!accountPaymentToGeneral && accountPaymentContract && (
              <div className="bg-green-900/20 border border-green-700 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="h-4 w-4 text-green-400" />
                  <span className="font-semibold text-sm text-green-300">تفاصيل العقد</span>
                </div>
                {(() => {
                  const contract = contracts.find(c => String(c.Contract_Number) === accountPaymentContract);
                  if (!contract) return null;
                  const contractTotal = Number((contract as any)['Total']) || 0;
                  const contractNum = typeof contract.Contract_Number === 'string' 
                    ? contract.Contract_Number 
                    : String(contract.Contract_Number);
                  const contractPaid = getContractPayments(contractNum);
                  const contractRemaining = contractTotal - contractPaid;
                  
                  return (
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-400">إجمالي العقد:</span>
                        <span className="font-semibold text-slate-200">{contractTotal.toLocaleString('ar-LY')} د.ل</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-400">المدفوع:</span>
                        <span className="font-semibold text-green-400">{contractPaid.toLocaleString('ar-LY')} د.ل</span>
                      </div>
                      <div className="flex justify-between border-t border-slate-600 pt-1">
                        <span className="text-slate-400">المتبقي:</span>
                        <span className={`font-bold ${contractRemaining > 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {contractRemaining.toLocaleString('ar-LY')} د.ل
                        </span>
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300 block">المبلغ</label>
              <Input 
                type="number" 
                value={accountPaymentAmount} 
                onChange={(e)=> setAccountPaymentAmount(e.target.value)}
                className="text-right bg-slate-700 border-slate-600 text-slate-200"
                placeholder="أدخل المبلغ"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300 block">طريقة الدفع</label>
              <Select value={accountPaymentMethod} onValueChange={setAccountPaymentMethod}>
                <SelectTrigger className="text-right bg-slate-700 border-slate-600 text-slate-200">
                  <SelectValue placeholder="اختر طريقة الدفع" />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  <SelectItem value="نقدي" className="text-slate-200">نقدي</SelectItem>
                  <SelectItem value="تحويل بنكي" className="text-slate-200">تحويل بنكي</SelectItem>
                  <SelectItem value="شيك" className="text-slate-200">شيك</SelectItem>
                  <SelectItem value="بطاقة ائتمان" className="text-slate-200">بطاقة ائتمان</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300 block">المرجع</label>
              <Input 
                value={accountPaymentReference} 
                onChange={(e)=> setAccountPaymentReference(e.target.value)}
                className="text-right bg-slate-700 border-slate-600 text-slate-200"
                placeholder="رقم المرجع (اختياري)"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300 block">التاريخ</label>
              <Input 
                type="date" 
                value={accountPaymentDate} 
                onChange={(e)=> setAccountPaymentDate(e.target.value)}
                className="text-right bg-slate-700 border-slate-600 text-slate-200"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-300 block">ملاحظات</label>
              <Input 
                value={accountPaymentNotes} 
                onChange={(e)=> setAccountPaymentNotes(e.target.value)}
                className="text-right bg-slate-700 border-slate-600 text-slate-200"
                placeholder="ملاحظات إضافية (اختياري)"
              />
            </div>

            <div className="flex justify-end gap-2 pt-4 border-t border-slate-600">
              <Button 
                variant="outline" 
                onClick={()=> setAccountPaymentOpen(false)} 
                className="px-4 border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                إلغاء
              </Button>
              <Button onClick={async () => {
                try {
                  if (!accountPaymentAmount) { toast.error('أدخل المبلغ'); return; }
                  const amt = Number(accountPaymentAmount);
                  if (!amt || amt <= 0) { toast.error('المبلغ يجب أن يكون أكبر من صفر'); return; }
                  
                  if (!accountPaymentToGeneral && !accountPaymentContract) {
                    toast.error('يرجى اختي��ر عقد');
                    return;
                  }
                  
                  const contractNumber = accountPaymentToGeneral ? null : 
                    (accountPaymentContract ? (isNaN(Number(accountPaymentContract)) ? null : Number(accountPaymentContract)) : null);
                  
                  const payload = {
                    customer_id: customerId || null,
                    customer_name: customerName,
                    contract_number: contractNumber,
                    amount: amt,
                    method: accountPaymentMethod || null,
                    reference: accountPaymentReference || null,
                    notes: accountPaymentNotes || null,
                    paid_at: accountPaymentDate ? new Date(accountPaymentDate).toISOString() : new Date().toISOString(),
                    entry_type: accountPaymentToGeneral ? 'account_payment' : 'receipt',
                  };
                  
                  const { error } = await supabase.from('customer_payments').insert(payload).select();
                  if (error) { 
                    console.error('Insert error:', error);
                    toast.error('فشل الحفظ: ' + error.message); 
                    return; 
                  }
                  
                  toast.success('تم الحفظ بنجاح');
                  setAccountPaymentOpen(false);
                  
                  setAccountPaymentAmount('');
                  setAccountPaymentMethod('');
                  setAccountPaymentReference('');
                  setAccountPaymentNotes('');
                  setAccountPaymentContract('');
                  setAccountPaymentToGeneral(true);
                  
                  await loadData();
                } catch (e) { 
                  console.error('Unexpected error:', e); 
                  toast.error('خطأ غير متوقع: ' + (e as Error).message); 
                }
              }} className="px-4 bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-slate-900 font-semibold">
                حفظ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit receipt dialog */}
      <Dialog open={editReceiptOpen} onOpenChange={setEditReceiptOpen}>
        <DialogContent className="max-w-md expenses-dialog-content">
          <DialogHeader className="border-b border-slate-600 pb-4">
            <DialogTitle className="text-yellow-400">تعديل الإيصال</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium text-slate-300">المبلغ</label>
              <Input type="number" value={editReceiptAmount} onChange={(e)=> setEditReceiptAmount(e.target.value)} className="bg-slate-700 border-slate-600 text-slate-200" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300">طريقة الدفع</label>
              <Select value={editReceiptMethod} onValueChange={setEditReceiptMethod}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-200">
                  <SelectValue placeholder="اختر طريقة الدفع" />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  <SelectItem value="نقدي" className="text-slate-200">نقدي</SelectItem>
                  <SelectItem value="تحويل بنكي" className="text-slate-200">تحويل بنكي</SelectItem>
                  <SelectItem value="شيك" className="text-slate-200">شيك</SelectItem>
                  <SelectItem value="بطاقة ائتمان" className="text-slate-200">بطاقة ائتمان</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300">المرجع</label>
              <Input value={editReceiptReference} onChange={(e)=> setEditReceiptReference(e.target.value)} className="bg-slate-700 border-slate-600 text-slate-200" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300">تاريخ الدفع</label>
              <Input type="date" value={editReceiptDate} onChange={(e)=> setEditReceiptDate(e.target.value)} className="bg-slate-700 border-slate-600 text-slate-200" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300">ملاحظات</label>
              <Input value={editReceiptNotes} onChange={(e)=> setEditReceiptNotes(e.target.value)} className="bg-slate-700 border-slate-600 text-slate-200" />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-600">
              <Button 
                variant="outline" 
                onClick={()=> setEditReceiptOpen(false)} 
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                إلغاء
              </Button>
              <Button 
                onClick={saveReceiptEdit} 
                className="bg-slate-700 hover:bg-slate-600 text-yellow-400"
              >
                حفظ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add previous debt */}
      <Dialog open={addDebtOpen} onOpenChange={setAddDebtOpen}>
        <DialogContent className="max-w-md expenses-dialog-content">
          <DialogHeader className="border-b border-slate-600 pb-4">
            <DialogTitle className="text-yellow-400">إضافة دين سابق</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div>
              <label className="text-sm font-medium text-slate-300">المبلغ</label>
              <Input type="number" value={debtAmount} onChange={(e)=> setDebtAmount(e.target.value)} className="bg-slate-700 border-slate-600 text-slate-200" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300">ملاحظات</label>
              <Input value={debtNotes} onChange={(e)=> setDebtNotes(e.target.value)} className="bg-slate-700 border-slate-600 text-slate-200" />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300">التاريخ</label>
              <Input type="date" value={debtDate} onChange={(e)=> setDebtDate(e.target.value)} className="bg-slate-700 border-slate-600 text-slate-200" />
            </div>
            <div className="flex justify-end gap-2 pt-4 border-t border-slate-600">
              <Button 
                variant="outline" 
                onClick={()=> setAddDebtOpen(false)} 
                className="border-slate-600 text-slate-300 hover:bg-slate-700"
              >
                إلغاء
              </Button>
              <Button onClick={async () => {
                try {
                  if (!debtAmount) { toast.error('أدخل المبلغ'); return; }
                  const amt = Number(debtAmount);
                  if (!amt || amt <= 0) { toast.error('المبلغ يجب أن يكون أكبر من صفر'); return; }
                  
                  const payload = {
                    customer_id: customerId || null,
                    customer_name: customerName,
                    contract_number: null,
                    amount: amt,
                    method: 'دين سابق',
                    reference: null,
                    notes: debtNotes || null,
                    paid_at: debtDate ? new Date(debtDate).toISOString() : new Date().toISOString(),
                    entry_type: 'debt',
                  };
                  
                  const { error } = await supabase.from('customer_payments').insert(payload).select();
                  if (error) { 
                    console.error('Debt insert error:', error); 
                    toast.error('فشل الحفظ: ' + error.message); 
                    return; 
                  }
                  toast.success('تمت الإضافة');
                  setAddDebtOpen(false);
                  
                  setDebtAmount('');
                  setDebtNotes('');
                  
                  await loadData();
                } catch (e) { 
                  console.error('Debt save error:', e); 
                  toast.error('خطأ غير متوقع: ' + (e as Error).message); 
                }
              }} className="bg-red-600 hover:bg-red-700 text-white">
                حفظ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
