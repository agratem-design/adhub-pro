// @ts-nocheck
import { FinancePageHeader, FinanceStatCard, FinanceDialogContent, FinanceDialogHeader, FinanceDialogFooter } from '@/components/finance/FinanceUI';
import { useEffect, useMemo, useState, useRef } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import * as UIDialog from '@/components/ui/dialog';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, DollarSign, Plus, Calculator, TrendingUp, TrendingDown, Lock, Calendar, Hash, Printer, Edit, Trash2, ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, Wallet, FileText } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import ExpenseReceiptPrintDialog from '@/components/billing/ExpenseReceiptPrintDialog';
import { OperatingDuesPrintDialog } from '@/components/billing/OperatingDuesPrintDialog';
import { calculateOperatingFees, operatingFeeAccruals } from '@/lib/operatingFees';
import { groupPaymentSources, normalizeWithdrawal, type PaymentSource } from '@/lib/paymentSources';

interface Contract {
  id: string;
  contract_number: string;
  customer_name: string;
  ad_type: string;
  feePercent: number;
  feePercentInstallation: number;
  feePercentPrint: number;
  feeAmount: number;
  fullFeeAmount: number;
  collectedFeeAmount: number;
  rent_cost: number;
  installation_cost: number;
  print_cost: number;
  include_operating_in_installation: boolean;
  include_operating_in_print: boolean;
  total_amount: number;
  total_paid: number;
  collectionPercentage: number;
  start_date: string;
  status: string;
  friendFeeFull?: number;
  partnershipFeeFull?: number;
  friendCostsTotal?: number;
}

interface Withdrawal {
  id: string;
  amount: number;
  date: string;
  method?: string;
  note?: string;
  receiver_name?: string;
  sender_name?: string;
  distributed_payment_id?: string | null;
}

interface PeriodClosure {
  id: number;
  period_start?: string;
  period_end?: string;
  contract_start?: string;
  contract_end?: string;
  closure_date: string;
  closure_type: 'period' | 'contract_range';
  total_contracts: number;
  total_amount: number;
  total_withdrawn: number;
  remaining_balance: number;
  notes?: string;
}

const toNumber = (value: unknown): number => {
  if (value === null || value === undefined) {
    return 0;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : 0;
};

const normalizeContract = (record: any): Contract => {
  const contractNumberRaw = record?.Contract_Number ?? record?.contract_number ?? record?.id ?? record?.ID ?? '';
  const contractNumber = contractNumberRaw ? String(contractNumberRaw) : '';
  
  const rentCost = toNumber(record?.['Total Rent'] ?? record?.rent_cost ?? 0);
  const installationCost = toNumber(record?.installation_cost ?? 0);
  const printCost = toNumber(record?.print_cost ?? 0);
  
  const includeOperatingInInstallation = record?.include_operating_in_installation === true;
  const includeOperatingInPrint = record?.include_operating_in_print === true;
  
  const totalAmount = toNumber(record?.Total ?? record?.['Total'] ?? (rentCost + installationCost + printCost));
  
  const totalPaid = toNumber(record?.['Total Paid'] ?? 0);
  const collectionPercentage = totalAmount > 0 ? (totalPaid / totalAmount) * 100 : 0;
  
  // ✅ نسبة الإيجار
  const feePercent = toNumber(record?.operating_fee_rate);
  const normalizedFeePercent = Math.round(feePercent * 100) / 100;
  
  // ✅ نسب مستقلة للتركيب والطباعة
  const feePercentInstallation = toNumber(record?.operating_fee_rate_installation ?? feePercent);
  const feePercentPrint = toNumber(record?.operating_fee_rate_print ?? feePercent);
  
  const { fullFeeAmount, collectedFeeAmount, friendCosts: friendCostsTotal, friendFee: friendFeeFull, partnershipFee: partnershipFeeFull } = calculateOperatingFees(record, totalPaid);

  const feeAmount = collectedFeeAmount;

  const fallbackIdSource = record?.Contract_Number ?? record?.contract_number ?? record?.id ?? record?.ID;
  const id = fallbackIdSource ? String(fallbackIdSource) : `contract-${Math.random().toString(36).slice(2, 10)}`;

  return {
    id,
    contract_number: contractNumber,
    customer_name: record?.['Customer Name'] ?? record?.customer_name ?? '',
    ad_type: record?.['Ad Type'] ?? record?.ad_type ?? '',
    feePercent: normalizedFeePercent,
    feePercentInstallation,
    feePercentPrint,
    feeAmount,
    fullFeeAmount,
    collectedFeeAmount,
    rent_cost: rentCost,
    installation_cost: installationCost,
    print_cost: printCost,
    include_operating_in_installation: includeOperatingInInstallation,
    include_operating_in_print: includeOperatingInPrint,
    total_amount: totalAmount,
    total_paid: totalPaid,
    collectionPercentage: Math.round(collectionPercentage * 100) / 100,
    start_date: record?.['Contract Date'] ?? record?.start_date ?? record?.['Start Date'] ?? '',
    status: record?.status ?? 'active',
    friendFeeFull,
    partnershipFeeFull,
    friendCostsTotal,
  };
};

const formatPercent = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '0';
  }
  return value.toLocaleString('en-US', {
    maximumFractionDigits: value % 1 === 0 ? 0 : 2,
  });
};

interface RecentPayment {
  id: string;
  contract_number: string;
  customer_name: string;
  amount: number;
  paid_at: string;
  fee_rate: number;
  fee_amount: number;
}

export default function OperatingExpenses() {
  const { canEdit: canEditAuth } = useAuth();
  const canEditSection = canEditAuth('expenses');
  const navigate = useNavigate();
  const { confirm: systemConfirm } = useSystemDialog();
  const [contracts, setContracts] = useState<Contract[]>([]);
  const [withdrawals, setWithdrawals] = useState<Withdrawal[]>([]);
  const [paymentSources, setPaymentSources] = useState<Record<string, PaymentSource>>({});
  const [withdrawalSearch, setWithdrawalSearch] = useState('');
  const [withdrawalSourceFilter, setWithdrawalSourceFilter] = useState('all');
  const [selectedSource, setSelectedSource] = useState<PaymentSource | null>(null);
  const filteredWithdrawals = useMemo(() => withdrawals.filter(w => {
    if (withdrawalSourceFilter === 'distributed' && !w.distributed_payment_id) return false;
    if (withdrawalSourceFilter === 'manual' && w.distributed_payment_id) return false;
    const source = paymentSources[w.distributed_payment_id || ''];
    return [w.amount, w.note, w.receiver_name, w.sender_name, w.distributed_payment_id, source?.customerName, source?.contracts.join(' ')].join(' ').toLowerCase().includes(withdrawalSearch.trim().toLowerCase());
  }), [withdrawals, withdrawalSourceFilter, withdrawalSearch, paymentSources]);
  const [closures, setClosures] = useState<PeriodClosure[]>([]);
  const [excludedIds, setExcludedIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [ledgerNotice, setLedgerNotice] = useState('');
  const [contractWarnings, setContractWarnings] = useState<string[]>([]);
  const [recentPayments, setRecentPayments] = useState<RecentPayment[]>([]);
  const [allAdditions, setAllAdditions] = useState<RecentPayment[]>([]);
  const [allAdditionsOpen, setAllAdditionsOpen] = useState(false);
  
  const tableContainerRef = useRef<HTMLDivElement>(null);
  const [scrollPercent, setScrollPercent] = useState(0);
  const [canScroll, setCanScroll] = useState(false);
  const [isTableInViewport, setIsTableInViewport] = useState(false);
  const [scrollType, setScrollType] = useState<'negative' | 'positive' | 'inverted'>('negative');

  useEffect(() => {
    // Detect RTL scroll type on mount
    try {
      const div = document.createElement('div');
      div.dir = 'rtl';
      div.style.width = '1px';
      div.style.height = '1px';
      div.style.overflow = 'auto';
      div.style.position = 'absolute';
      div.style.top = '-9999px';
      
      const inner = document.createElement('div');
      inner.style.width = '2px';
      inner.style.height = '1px';
      div.appendChild(inner);
      document.body.appendChild(div);
      
      if (div.scrollLeft > 0) {
        setScrollType('inverted');
      } else {
        div.scrollLeft = -1;
        if (div.scrollLeft === -1) {
          setScrollType('negative');
        } else {
          setScrollType('positive');
        }
      }
      
      document.body.removeChild(div);
    } catch (e) {
      console.error('Error detecting RTL scroll type:', e);
    }
  }, []);

  const handleTableScroll = () => {
    if (tableContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = tableContainerRef.current;
      const maxScroll = scrollWidth - clientWidth;
      if (maxScroll > 0) {
        let pct = 0;
        if (scrollType === 'negative') {
          pct = (Math.abs(scrollLeft) / maxScroll) * 100;
        } else if (scrollType === 'positive') {
          pct = (scrollLeft / maxScroll) * 100;
        } else if (scrollType === 'inverted') {
          pct = ((maxScroll - scrollLeft) / maxScroll) * 100;
        }
        setScrollPercent(Math.min(100, Math.max(0, pct)));
      }
    }
  };

  const handleSliderChange = (value: number) => {
    if (tableContainerRef.current) {
      const { scrollWidth, clientWidth } = tableContainerRef.current;
      const maxScroll = scrollWidth - clientWidth;
      
      let targetScroll = 0;
      if (scrollType === 'negative') {
        targetScroll = -((value / 100) * maxScroll);
      } else if (scrollType === 'positive') {
        targetScroll = (value / 100) * maxScroll;
      } else if (scrollType === 'inverted') {
        targetScroll = maxScroll - ((value / 100) * maxScroll);
      }
      
      tableContainerRef.current.scrollLeft = targetScroll;
      setScrollPercent(value);
    }
  };

  const scrollTable = (direction: 'left' | 'right') => {
    if (tableContainerRef.current) {
      const scrollAmount = 400;
      tableContainerRef.current.scrollBy({
        left: direction === 'left' ? -scrollAmount : scrollAmount,
        behavior: 'smooth'
      });
    }
  };

  useEffect(() => {
    const container = tableContainerRef.current;
    if (!container) return;

    const checkScrollable = () => {
      const { scrollWidth, clientWidth } = container;
      setCanScroll(scrollWidth > clientWidth);
    };

    const checkVisibility = () => {
      const rect = container.getBoundingClientRect();
      // Table is considered visible if it overlaps vertically with the viewport
      const isVisible = rect.top < window.innerHeight && rect.bottom > 0;
      setIsTableInViewport(isVisible);
    };

    checkScrollable();
    checkVisibility();

    // ResizeObserver watches size adjustments (like when table data finishes loading)
    const resizeObserver = new ResizeObserver(() => {
      checkScrollable();
      checkVisibility();
    });
    resizeObserver.observe(container);

    // Event listeners
    container.addEventListener('scroll', handleTableScroll);
    window.addEventListener('scroll', checkVisibility, { capture: true, passive: true });
    window.addEventListener('resize', checkVisibility);

    const timer = setTimeout(() => {
      checkScrollable();
      checkVisibility();
    }, 500);

    return () => {
      resizeObserver.disconnect();
      container.removeEventListener('scroll', handleTableScroll);
      window.removeEventListener('scroll', checkVisibility, { capture: true });
      window.removeEventListener('resize', checkVisibility);
      clearTimeout(timer);
    };
  }, [contracts]);
  
  // Dialog states
  const [withdrawalOpen, setWithdrawalOpen] = useState(false);
  const [closureOpen, setClosureOpen] = useState(false);
  const [showWithdrawalReceiptDialog, setShowWithdrawalReceiptDialog] = useState(false);
  const [selectedWithdrawalForReceipt, setSelectedWithdrawalForReceipt] = useState<Withdrawal | null>(null);
  const [editingWithdrawal, setEditingWithdrawal] = useState<Withdrawal | null>(null);
  const [showPrintDialog, setShowPrintDialog] = useState(false);
  
  // Form states
  const [withdrawalAmount, setWithdrawalAmount] = useState<string>('');
  const [withdrawalDate, setWithdrawalDate] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [withdrawalMethod, setWithdrawalMethod] = useState<string>('');
  const [withdrawalNotes, setWithdrawalNotes] = useState<string>('');
  const [withdrawalReceiverName, setWithdrawalReceiverName] = useState<string>('');
  const [withdrawalSenderName, setWithdrawalSenderName] = useState<string>('');
  
  // Period closure form
  const [closureDate, setClosureDate] = useState<string>(() => new Date().toISOString().slice(0,10));
  const [closureType, setClosureType] = useState<'period' | 'contract_range'>('period');
  const [periodStart, setPeriodStart] = useState<string>('');
  const [periodEnd, setPeriodEnd] = useState<string>('');
  const [contractStart, setContractStart] = useState<string>('');
  const [contractEnd, setContractEnd] = useState<string>('');
  const [closureNotes, setClosureNotes] = useState<string>('');

  // Load data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Load contracts - ترتيب تنازلي حسب رقم العقد
      const { data: contractsData, error: contractsError } = await supabase
        .from('Contract')
        .select('*')
        .order('Contract_Number', { ascending: false });

      if (contractsError) {
        console.error('خطأ في تحميل العقود:', contractsError);
        toast.error('فشل في تحميل العقود');
      } else {
        // ✅ فقط العقود من 1086 وما بعدها (النسبة مفعّلة من هذا العقد)
        let mappedContracts = (contractsData || [])
          .map(normalizeContract)
          .filter(c => {
            const num = parseInt(c.contract_number, 10);
            return !isNaN(num) && num >= 1086;
          });

        // ✅ احتساب المدفوع فعلياً لكل عقد من جدول customer_payments (إيصالات + دفعات حساب + دفعات عامة)
        try {
          const { data: paymentsData, error: paymentsError } = await (supabase as any)
            .from('customer_payments')
            .select('id, contract_number, amount, entry_type, paid_at, customer_name')
            .order('paid_at', { ascending: false });
          if (paymentsError) throw paymentsError;

          const paidByContract: Record<string, number> = {};
          const validPayments: any[] = [];
          
          (paymentsData || []).forEach((p: any) => {
            const type = String(p.entry_type || '');
            // ✅ احتساب جميع أنواع الدفعات: receipt, account_payment, payment
            if (type === 'receipt' || type === 'account_payment' || type === 'payment') {
              const key = String(p.contract_number || '');
              if (!key) return; // تجاهل الدفعات العامة بدون رقم عقد
              paidByContract[key] = (paidByContract[key] || 0) + (Number(p.amount) || 0);
              validPayments.push(p);
            }
          });

          const mappedAdditions = operatingFeeAccruals(contractsData || [], validPayments).map(p => ({
            id: p.id, contract_number: String(p.contract_number), customer_name: p.customer_name || '',
            amount: Number(p.amount) || 0, paid_at: p.paid_at, fee_rate: p.fee_rate, fee_amount: p.fee_amount,
          }));
          setAllAdditions(mappedAdditions);
          setRecentPayments(mappedAdditions.slice(0, 10));

          mappedContracts = (contractsData || [])
            .map(record => normalizeContract({ ...record, 'Total Paid': paidByContract[String(record.Contract_Number)] || 0 }))
            .filter(contract => Number(contract.contract_number) >= 1086);
          const differences = (contractsData || []).filter(record => Number(record.Contract_Number) >= 1086 && toNumber(record['Total Paid']) !== (paidByContract[String(record.Contract_Number)] || 0));
          setLedgerNotice(differences.length ? `يعتمد الرصيد على سجل الدفعات الفعلي. الإجمالي المحفوظ قديم في ${differences.length} عقدًا ولا يُستخدم في هذا الحساب.` : 'يعتمد الرصيد على سجل الدفعات الفعلي.');
          setContractWarnings(mappedContracts.filter(c => c.total_paid > c.total_amount).map(c => `العقد ${c.contract_number}: قيمته ${c.total_amount.toLocaleString()} د.ل، والمسجل عليه ${c.total_paid.toLocaleString()} د.ل. راجع قيمة العقد وتخصيص الدفعات.`));
        } catch (e) {
          mappedContracts = [];
          setLedgerNotice('تعذر تحميل سجل الدفعات؛ لا يمكن اعتماد الرصيد الظاهر. أعد تحميل الصفحة.');
          toast.error('تعذر حساب مستحقات التشغيل من سجل الدفعات');
        }

        mappedContracts.sort((a, b) => {
          const numA = parseInt(a.contract_number, 10);
          const numB = parseInt(b.contract_number, 10);
          const safeA = Number.isFinite(numA) ? numA : 0;
          const safeB = Number.isFinite(numB) ? numB : 0;
          return safeB - safeA;
        });

        setContracts(mappedContracts);
      }

      // Load withdrawals
      try {
        const { data: withdrawalsData, error: withdrawalsError } = await supabase
          .from('expenses_withdrawals')
          .select('*')
          .order('date', { ascending: false });
        if (withdrawalsError) throw withdrawalsError;
        
        if (Array.isArray(withdrawalsData)) {
          const mappedWithdrawals = withdrawalsData.map(normalizeWithdrawal);
          setWithdrawals(mappedWithdrawals);
          const ids = [...new Set(mappedWithdrawals.map(w => w.distributed_payment_id).filter(Boolean))];
          if (ids.length) {
            const { data, error } = await supabase.from('customer_payments')
              .select('distributed_payment_id, customer_id, customer_name, amount, paid_at, contract_number, printed_invoice_id, sales_invoice_id, composite_task_id, reference')
              .in('distributed_payment_id', ids);
            if (error) throw error;
            setPaymentSources(groupPaymentSources(data || []));
          } else setPaymentSources({});
        }
      } catch (error) {
        console.error('خطأ في تحميل السحوبات:', error);
        toast.error('تعذر تحميل السحوبات أو مصادرها؛ أعد تحميل الصفحة للتحقق من الرصيد');
      }

      // Load period closures
      try {
        const { data: closuresData } = await supabase
          .from('period_closures')
          .select('*')
          .order('created_at', { ascending: false });
        
        if (Array.isArray(closuresData)) {
          setClosures(closuresData);
        }
      } catch (error) {
        console.error('خطأ في تحميل إغلاقات الفترات:', error);
      }

      // Load exclusions
      try {
        const { data: flagsData } = await supabase
          .from('expenses_flags')
          .select('contract_id, excluded');
        
        if (Array.isArray(flagsData)) {
          const excludedSet = new Set<string>();
          flagsData.forEach((flag: any) => {
            if (flag.excluded && flag.contract_id != null) {
              excludedSet.add(String(flag.contract_id));
            }
          });
          setExcludedIds(excludedSet);
        }
      } catch (error) {
        console.error('خطأ في تحميل حالات الاستبعاد:', error);
      }

    } catch (error) {
      console.error('خطأ عام في تحميل البيانات:', error);
      toast.error('حدث خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  // Check if contract is in any closed period
  const isContractClosed = (contract: Contract) => {
    return closures.some(closure => {
      if (closure.closure_type === 'period' && closure.period_start && closure.period_end) {
        const contractDate = new Date(contract.start_date);
        const closureStart = new Date(closure.period_start);
        const closureEnd = new Date(closure.period_end);
        return contractDate >= closureStart && contractDate <= closureEnd;
      } else if (closure.closure_type === 'contract_range' && closure.contract_start && closure.contract_end) {
        const contractNum = parseInt(contract.contract_number, 10) || 0;
        const rangeStart = parseInt(closure.contract_start, 10) || 0;
        const rangeEnd = parseInt(closure.contract_end, 10) || 0;
        return contractNum >= rangeStart && contractNum <= rangeEnd;
      }
      return false;
    });
  };

  // Get contracts in range that are not closed
  const getContractsInRange = () => {
    return contracts.filter(contract => {
      if (isContractClosed(contract) || excludedIds.has(contract.id.toString())) {
        return false;
      }

      // Apply current filter
      if (closureType === 'period' && periodStart && periodEnd) {
        const contractDate = new Date(contract.start_date);
        const start = new Date(periodStart);
        const end = new Date(periodEnd);
        return contractDate >= start && contractDate <= end;
      } else if (closureType === 'contract_range' && contractStart && contractEnd) {
        const contractNum = contract.contract_number;
        return contractNum >= contractStart && contractNum <= contractEnd;
      }
      
      return false;
    });
  };

  // ✅ إعادة حساب قيم التسكيرات ديناميكياً بنظام FIFO
  const computedClosures = useMemo(() => {
    if (closures.length === 0 || contracts.length === 0) return closures;

    // ترتيب جميع العقود من الأقدم للأحدث
    const allContractsSorted = [...contracts]
      .filter(c => !excludedIds.has(c.id.toString()))
      .sort((a, b) => {
        const na = parseInt(a.contract_number, 10);
        const nb = parseInt(b.contract_number, 10);
        return (Number.isFinite(na) ? na : 0) - (Number.isFinite(nb) ? nb : 0);
      });

    const totalWithdrawalsAll = withdrawals.reduce((sum, w) => sum + w.amount, 0);

    // تحديد أي عقد ينتمي لأي تسكيرة
    const closureForContract = (contract: Contract): PeriodClosure | null => {
      return closures.find(closure => {
        if (closure.closure_type === 'period' && closure.period_start && closure.period_end) {
          const contractDate = new Date(contract.start_date);
          return contractDate >= new Date(closure.period_start!) && contractDate <= new Date(closure.period_end!);
        } else if (closure.closure_type === 'contract_range' && closure.contract_start && closure.contract_end) {
          const cNum = parseInt(contract.contract_number, 10) || 0;
          const rStart = parseInt(closure.contract_start!, 10) || 0;
          const rEnd = parseInt(closure.contract_end!, 10) || 0;
          return cNum >= rStart && cNum <= rEnd;
        }
        return false;
      }) || null;
    };

    // توزيع المسحوبات بنظام FIFO على جميع العقود (مغلقة ومفتوحة)
    const withdrawnPerClosure: Record<number, number> = {};
    const totalAmountPerClosure: Record<number, number> = {};
    closures.forEach(cl => {
      withdrawnPerClosure[cl.id] = 0;
      totalAmountPerClosure[cl.id] = 0;
    });

    // حساب إجمالي النسبة المتحصلة لكل تسكيرة
    allContractsSorted.forEach(contract => {
      const cl = closureForContract(contract);
      if (cl) {
        totalAmountPerClosure[cl.id] += contract.collectedFeeAmount;
      }
    });

    // توزيع FIFO: الأقدم أولاً
    let remainingWithdrawals = totalWithdrawalsAll;
    for (const contract of allContractsSorted) {
      if (contract.collectedFeeAmount <= 0 || remainingWithdrawals <= 0) continue;
      const allocatable = Math.min(remainingWithdrawals, contract.collectedFeeAmount);
      const cl = closureForContract(contract);
      if (cl) {
        withdrawnPerClosure[cl.id] += allocatable;
      }
      remainingWithdrawals -= allocatable;
    }

    return closures.map(cl => ({
      ...cl,
      total_amount: totalAmountPerClosure[cl.id] ?? cl.total_amount,
      total_withdrawn: withdrawnPerClosure[cl.id] ?? 0,
      remaining_balance: (totalAmountPerClosure[cl.id] ?? cl.total_amount) - (withdrawnPerClosure[cl.id] ?? 0),
    }));
  }, [contracts, withdrawals, closures, excludedIds]);

  // ✅ حساب توزيع المسحوبات على كل عقد بنظام FIFO
  const fifoAllocationPerContract = useMemo(() => {
    const allocation = new Map<string, number>();
    const unclosed = contracts
      .filter(c => {
        if (excludedIds.has(c.id.toString())) return false;
        return !closures.some(closure => {
          if (closure.closure_type === 'period' && closure.period_start && closure.period_end) {
            const d = new Date(c.start_date);
            return d >= new Date(closure.period_start) && d <= new Date(closure.period_end);
          } else if (closure.closure_type === 'contract_range' && closure.contract_start && closure.contract_end) {
            const n = parseInt(c.contract_number, 10) || 0;
            return n >= (parseInt(closure.contract_start, 10) || 0) && n <= (parseInt(closure.contract_end, 10) || 0);
          }
          return false;
        });
      })
      .sort((a, b) => {
        const na = parseInt(a.contract_number, 10);
        const nb = parseInt(b.contract_number, 10);
        return (Number.isFinite(na) ? na : 0) - (Number.isFinite(nb) ? nb : 0);
      });

    const totalW = withdrawals.reduce((s, w) => s + w.amount, 0);
    const consumed = computedClosures.reduce((s, cl) => s + (cl.total_withdrawn || 0), 0);
    let remaining = Math.max(0, totalW - consumed);

    for (const c of unclosed) {
      if (remaining <= 0 || c.collectedFeeAmount <= 0) {
        allocation.set(c.contract_number, 0);
        continue;
      }
      const alloc = Math.min(remaining, c.collectedFeeAmount);
      allocation.set(c.contract_number, alloc);
      remaining -= alloc;
    }
    return allocation;
  }, [contracts, withdrawals, closures, excludedIds, computedClosures]);

  // ✅ اشتقاق العقود المسددة من التوزيع الفعلي - لا تكرار للمنطق
  const settledContractIds = useMemo(() => {
    const settled = new Set<string>();
    for (const contract of contracts) {
      const allocated = fifoAllocationPerContract.get(contract.contract_number) || 0;
      // العقد مسدد فقط إذا: 1) مدفوع بالكامل من الزبون 2) مغطى بالكامل من المسحوبات
      if (contract.collectionPercentage >= 100 && allocated >= contract.collectedFeeAmount && contract.collectedFeeAmount > 0) {
        settled.add(contract.contract_number);
      }
    }
    return settled;
  }, [contracts, fifoAllocationPerContract]);


  // Calculate totals with dependency on closures
  const totals = useMemo(() => {
    // Filter uncovered contracts (not closed and not excluded)
    const uncoveredContracts = contracts.filter(contract => {
      const id = contract.id.toString();
      
      // Skip excluded contracts
      if (excludedIds.has(id)) {
        return false;
      }
      
      // Skip closed contracts
      const isClosed = closures.some(closure => {
        if (closure.closure_type === 'period' && closure.period_start && closure.period_end) {
          const contractDate = new Date(contract.start_date);
          const closureStart = new Date(closure.period_start);
          const closureEnd = new Date(closure.period_end);
          return contractDate >= closureStart && contractDate <= closureEnd;
        } else if (closure.closure_type === 'contract_range' && closure.contract_start && closure.contract_end) {
          const contractNum = parseInt(contract.contract_number, 10);
          const closureStart = parseInt(closure.contract_start, 10);
          const closureEnd = parseInt(closure.contract_end, 10);
          return contractNum >= closureStart && contractNum <= closureEnd;
        }
        return false;
      });
      
      return !isClosed;
    });
    
    const totalContracts = uncoveredContracts.length;
    
    // Calculate pool total from uncovered contracts
    const poolTotal = uncoveredContracts.reduce((sum, contract) => {
      return sum + contract.collectedFeeAmount;
    }, 0);

    const totalWithdrawnAll = withdrawals.reduce((sum, w) => sum + w.amount, 0);
    // ✅ جميع المسحوبات تبدأ من عقد 1086 - لا يوجد مسحوبات قبلها
    const effectiveWithdrawals = totalWithdrawnAll - computedClosures.reduce((sum, closure) => sum + closure.total_withdrawn, 0);
    // ✅ الرصيد المتبقي = مجموع النسب المفتوحة - المسحوبات
    const remainingPool = poolTotal - effectiveWithdrawals;

    return {
      totalContracts,
      poolTotal,
      totalWithdrawn: totalWithdrawnAll,
      effectiveWithdrawals,
      remainingPool
    };
  }, [contracts, withdrawals, closures, excludedIds, computedClosures]);

  const tableTotals = useMemo(() => {
    return contracts.reduce((acc, c) => {
      const withdrawn = fifoAllocationPerContract.get(c.contract_number) || 0;
      return {
        rentCost: acc.rentCost + c.rent_cost,
        installationCost: acc.installationCost + c.installation_cost,
        printCost: acc.printCost + c.print_cost,
        totalAmount: acc.totalAmount + c.total_amount,
        totalPaid: acc.totalPaid + c.total_paid,
        fullFeeAmount: acc.fullFeeAmount + c.fullFeeAmount,
        collectedFeeAmount: acc.collectedFeeAmount + c.collectedFeeAmount,
        withdrawn: acc.withdrawn + withdrawn
      };
    }, {
      rentCost: 0,
      installationCost: 0,
      printCost: 0,
      totalAmount: 0,
      totalPaid: 0,
      fullFeeAmount: 0,
      collectedFeeAmount: 0,
      withdrawn: 0
    });
  }, [contracts, fifoAllocationPerContract]);

  // Add withdrawal
  const addWithdrawal = async () => {
    if (!canEditSection) return;
    if (!withdrawalAmount) {
      toast.error('يرجى إدخال مبلغ السحب');
      return;
    }

    if (!withdrawalDate) {
      toast.error('يرجى تحديد تاريخ السحب');
      return;
    }

    try {
      const amount = parseFloat(withdrawalAmount);
      if (!Number.isFinite(amount) || amount <= 0) {
        toast.error('أدخل مبلغ سحب أكبر من صفر');
        return;
      }
      if (editingWithdrawal?.distributed_payment_id) {
        toast.error('عدّل السحب من الدفعة الموزعة المرتبطة للحفاظ على تطابق الحسابات');
        return;
      }
      if (amount > totals.remainingPool + (editingWithdrawal?.amount || 0)) {
        toast.error('المبلغ يتجاوز رصيد مستحقات التشغيل المتاح');
        return;
      }
      
      // استخدام user_id من الجلسة الحالية
      const { data: { user } } = await supabase.auth.getUser();
      
      const withdrawalData = {
        amount,
        date: withdrawalDate,
        method: withdrawalMethod || null,
        note: withdrawalNotes || null,
        receiver_name: withdrawalReceiverName || null,
        sender_name: withdrawalSenderName || null,
        user_id: user?.id || null
      };

      if (editingWithdrawal) {
        // تحديث السحب الحالي
        const { data, error } = await supabase
          .from('expenses_withdrawals')
          .update(withdrawalData)
          .eq('id', editingWithdrawal.id)
          .select()
          .single();

        if (error) {
          toast.error(`فشل في تحديث السحب: ${error.message}`);
          return;
        }

        const updatedWithdrawal: Withdrawal = {
          id: data.id.toString(),
          amount: data.amount,
          date: data.date,
          method: data.method,
          note: data.note,
          receiver_name: data.receiver_name,
          sender_name: data.sender_name
        };

        setWithdrawals(prev => prev.map(w => w.id === updatedWithdrawal.id ? updatedWithdrawal : w));
        toast.success('تم تحديث السحب بنجاح');
      } else {
        // إضافة سحب جديد
        let data;
        const { data: insertData, error } = await supabase
          .from('expenses_withdrawals')
          .insert([withdrawalData])
          .select()
          .single();

        if (error) {
          console.error('خطأ في إضافة السحب:', error);
          
          // إذا كانت المشكلة في RLS، نحاول بدون user_id
          if (error.message?.includes('row-level security')) {
            const simpleData = {
              amount,
              date: withdrawalDate,
              method: withdrawalMethod || null,
              note: withdrawalNotes || null,
              receiver_name: withdrawalReceiverName || null,
              sender_name: withdrawalSenderName || null
            };
            
            const { data: retryData, error: retryError } = await supabase
              .from('expenses_withdrawals')
              .insert([simpleData])
              .select()
              .single();
              
            if (retryError) {
              toast.error(`فشل في إضافة السحب: ${retryError.message}`);
              return;
            }
            
            data = retryData;
          } else {
            toast.error(`حدث خطأ في إضافة السحب: ${error.message}`);
            return;
          }
        } else {
          data = insertData;
        }

        const newWithdrawal: Withdrawal = {
          id: data.id.toString(),
          amount: data.amount,
          date: data.date,
          method: data.method,
          note: data.note,
          receiver_name: data.receiver_name,
          sender_name: data.sender_name
        };

        setWithdrawals(prev => [newWithdrawal, ...prev]);
        toast.success('تم إضافة السحب بنجاح');
      }
      
      // Reset form
      setWithdrawalOpen(false);
      setEditingWithdrawal(null);
      setWithdrawalAmount('');
      setWithdrawalDate(new Date().toISOString().slice(0,10));
      setWithdrawalMethod('');
      setWithdrawalNotes('');
      setWithdrawalReceiverName('');
      setWithdrawalSenderName('');
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  // Delete withdrawal
  const deleteWithdrawal = async (id: string) => {
    if (!canEditSection) return;
    if (withdrawals.find(row => row.id === id)?.distributed_payment_id) {
      toast.error('عدّل السحب من الدفعة الموزعة المرتبطة للحفاظ على تطابق الحسابات');
      return;
    }
    if (!await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذا السحب؟', variant: 'destructive', confirmText: 'حذف' })) {
      return;
    }

    try {
      const { error } = await supabase
        .from('expenses_withdrawals')
        .delete()
        .eq('id', id);

      if (error) {
        toast.error(`فشل في حذف السحب: ${error.message}`);
        return;
      }

      setWithdrawals(prev => prev.filter(w => w.id !== id));
      toast.success('تم حذف السحب بنجاح');
    } catch (error) {
      console.error('خطأ في حذف السحب:', error);
      toast.error('حدث خطأ في حذف السحب');
    }
  };

  // Close period or contract range
  const closePeriodOrRange = async () => {
    if (!closureDate) {
      toast.error('يرجى تحديد تاريخ التسكير');
      return;
    }

    if (closureType === 'period') {
      if (!periodStart || !periodEnd) {
        toast.error('يرجى تحديد بداية ونهاية الفترة');
        return;
      }
      if (new Date(periodStart) >= new Date(periodEnd)) {
        toast.error('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
        return;
      }
    } else {
      if (!contractStart || !contractEnd) {
        toast.error('يرجى تحديد رقم العقد الأول والأخير');
        return;
      }
      if (contractStart >= contractEnd) {
        toast.error('رقم العقد الأول يجب أن يكون أصغر من رقم العقد الأخير');
        return;
      }
    }

    // Get contracts in this range
    const contractsInRange = getContractsInRange();
    
    if (contractsInRange.length === 0) {
      toast.error('لا توجد عقود في النطاق المحدد أو جميع العقود مسكرة مسبقاً');
      return;
    }

    // Calculate totals for this range
    const totalAmount = contractsInRange.reduce((sum, contract) => {
      // ✅ استخدام النسبة المتحصلة فعلياً
      return sum + contract.collectedFeeAmount;
    }, 0);

    // ✅ حساب المسحوبات المخصصة لهذه الفترة بنظام FIFO
    // جلب جميع العقود غير المسكّرة مرتبة من الأقدم للأحدث
    const allUnclosedSorted = contracts
      .filter(c => !isContractClosed(c) && !excludedIds.has(c.id.toString()))
      .sort((a, b) => {
        const na = parseInt(a.contract_number, 10);
        const nb = parseInt(b.contract_number, 10);
        return (Number.isFinite(na) ? na : 0) - (Number.isFinite(nb) ? nb : 0);
      });

    const closingContractNumbers = new Set(contractsInRange.map(c => c.contract_number));
    const totalAllWithdrawals = withdrawals.reduce((sum, w) => sum + w.amount, 0);
    // طرح المسحوبات المستهلكة من الإغلاقات السابقة
    const previouslyConsumed = computedClosures.reduce((sum, cl) => sum + (cl.total_withdrawn || 0), 0);
    let availableForFifo = Math.max(0, totalAllWithdrawals - previouslyConsumed);

    let withdrawnForClosing = 0;
    for (const contract of allUnclosedSorted) {
      if (contract.collectedFeeAmount <= 0 || availableForFifo <= 0) continue;
      const allocatable = Math.min(availableForFifo, contract.collectedFeeAmount);
      if (closingContractNumbers.has(contract.contract_number)) {
        withdrawnForClosing += allocatable;
      }
      availableForFifo -= allocatable;
    }

    const totalWithdrawn = withdrawnForClosing;
    const remainingBalance = totalAmount - totalWithdrawn;

    try {
      const closureData = {
        closure_type: closureType,
        period_start: closureType === 'period' ? periodStart : null,
        period_end: closureType === 'period' ? periodEnd : null,
        contract_start: closureType === 'contract_range' ? contractStart : null,
        contract_end: closureType === 'contract_range' ? contractEnd : null,
        closure_date: closureDate,
        total_contracts: contractsInRange.length,
        total_amount: totalAmount,
        total_withdrawn: totalWithdrawn,
        remaining_balance: remainingBalance,
        notes: closureNotes || null
      };

      const { data, error } = await supabase
        .from('period_closures')
        .insert([closureData])
        .select()
        .single();

      if (error) {
        console.error('خطأ في الإغلاق:', error);
        toast.error(`حدث خطأ في الإغلاق: ${error.message}`);
        return;
      }

      // Update closures state immediately to trigger recalculation
      setClosures(prev => [data, ...prev]);
      
      // Reset form
      setClosureOpen(false);
      setClosureDate(new Date().toISOString().slice(0,10));
      setPeriodStart('');
      setPeriodEnd('');
      setContractStart('');
      setContractEnd('');
      setClosureNotes('');
      
      const typeText = closureType === 'period' ? 'الفترة' : 'نطاق العقود';
      toast.success(`تم إغلاق ${typeText} بنجاح (${contractsInRange.length} عقد)`);
      
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  // Toggle exclusion
  const toggleExclusion = async (contractId: string, exclude: boolean) => {
    try {
      const { error } = await supabase
        .from('expenses_flags')
        .upsert({ contract_id: contractId, excluded: exclude });

      if (error) {
        console.error('خطأ في تحديث حالة الاستبعاد:', error);
        toast.error('تعذر تحديث حالة العقد');
        return;
      }

      const newExcludedIds = new Set(excludedIds);
      if (exclude) {
        newExcludedIds.add(contractId);
      } else {
        newExcludedIds.delete(contractId);
      }
      setExcludedIds(newExcludedIds);
      
      toast.success(exclude ? 'تم استبعاد العقد من الحسبة' : 'تم إرجاع العقد إلى الحسبة');
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  // Get unique contract numbers for dropdown
  const contractNumbers = useMemo(() => {
    return contracts
      .map(c => c.contract_number)
      .filter(Boolean)
      .sort((a, b) => {
        const na = parseInt(a), nb = parseInt(b);
        if (!isNaN(na) && !isNaN(nb)) return nb - na; // ترتيب تنازلي
        return b.localeCompare(a);
      });
  }, [contracts]);

  if (loading) {
    return (
      <div className="expenses-loading">
        <Loader2 className="expenses-loading-spinner" />
        <span>جاري التحميل...</span>
      </div>
    );
  }

  return (
    <div className="finance-page w-full max-w-[1440px] mx-auto px-4 md:px-6 py-6 space-y-6" dir="rtl">
      <FinancePageHeader title="مصروفات التشغيل" description="راجع مستحقات العقود المحصّلة، وتتبع السحوبات والدفعات التي موّلتها." icon={Calculator}
        actions={<>
          <Button variant="outline" onClick={() => setShowPrintDialog(true)} className="gap-2"><Printer className="h-4 w-4" /> طباعة الكشف</Button>
          {canEditSection && <><Button variant="outline" onClick={() => setClosureOpen(true)} className="gap-2"><Lock className="h-4 w-4" /> تسكير حساب</Button><Button onClick={() => { setEditingWithdrawal(null); setWithdrawalOpen(true); }} className="gap-2"><Plus className="h-4 w-4" /> تسجيل سحب</Button></>}
        </>} />
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3 sm:gap-4">
        <FinanceStatCard label="المتبقي للسحب" value={totals.remainingPool} icon={Wallet} tone={totals.remainingPool < 0 ? 'danger' : 'primary'} note="المستحق المحصّل − السحب الفعّال" />
        <FinanceStatCard label="المستحقات المحصّلة" value={totals.poolTotal} icon={TrendingUp} tone="success" note="للعقود المفتوحة بدءًا من 1086" />
        <FinanceStatCard label="إجمالي السحوبات" value={totals.totalWithdrawn} icon={TrendingDown} note="يشمل السحوبات المرتبطة بالدفعات" />
        <FinanceStatCard label="العقود المفتوحة" value={totals.totalContracts} icon={FileText} currency={false} note="بعد الاستبعادات وإغلاق الفترات" />
      </div>
      {ledgerNotice && <p className="rounded-xl border border-primary/20 bg-primary/5 p-4 text-sm text-muted-foreground">{ledgerNotice}</p>}
      {contractWarnings.length > 0 && <div role="alert" className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-amber-800 dark:text-amber-300 space-y-2"><p className="font-bold">بيانات تحتاج مراجعة قبل اعتماد الرصيد نهائيًا</p>{contractWarnings.map(warning => <p key={warning}>{warning}</p>)}</div>}

      {/* Recent Payments - آخر 10 دفعات زادت الرصيد */}
      {recentPayments.length > 0 && (
        <Card className="shadow-sm border-primary/10 overflow-hidden">
          <CardHeader className="finance-toolbar pb-4 bg-muted/20 border-b">
            <CardTitle className="text-sm font-bold flex items-center gap-2 text-foreground">
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              أحدث الدفعات وأثرها على مستحقات التشغيل
            </CardTitle>
            <Button 
              variant="ghost" 
              size="sm" 
              className="text-primary hover:text-primary/80 flex items-center gap-1 font-bold text-xs h-8 px-2"
              onClick={() => setAllAdditionsOpen(true)}
            >
              عرض جميع الإضافات
            </Button>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/50">
                  <TableRow>
                    <TableHead className="text-right text-xs font-bold">رقم العقد</TableHead>
                    <TableHead className="text-right text-xs font-bold">اسم العميل</TableHead>
                    <TableHead className="text-right text-xs font-bold">تاريخ الدفع</TableHead>
                    <TableHead className="text-right text-xs font-bold">مبلغ الدفعة</TableHead>
                    <TableHead className="text-right text-xs font-bold">النسبة %</TableHead>
                    <TableHead className="text-right text-xs font-bold">الزيادة في المستحقات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {recentPayments.map((payment) => (
                    <TableRow key={payment.id} className="hover:bg-muted/30 transition-colors border-b">
                      <TableCell className="text-right font-semibold font-manrope">#{payment.contract_number}</TableCell>
                      <TableCell className="text-right text-sm">{payment.customer_name || '—'}</TableCell>
                      <TableCell className="text-right font-manrope text-xs text-muted-foreground">
                        {payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('ar-LY') : '—'}
                      </TableCell>
                      <TableCell className="text-right font-manrope font-bold text-green-600 text-sm">
                        {payment.amount.toLocaleString()} د.ل
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="font-manrope text-xs font-semibold">{payment.fee_rate}%</Badge>
                      </TableCell>
                      <TableCell className="text-right font-manrope font-black text-primary text-sm">
                        +{payment.fee_amount.toLocaleString()} د.ل
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}


      {/* Preview Panel */}
      {((closureType === 'period' && periodStart && periodEnd) || 
        (closureType === 'contract_range' && contractStart && contractEnd)) && (
        <Card className="border-orange-500/20 bg-orange-500/[0.02] overflow-hidden">
          <CardHeader className="bg-orange-500/10 border-b py-3">
            <CardTitle className="text-sm font-bold text-orange-950 dark:text-orange-100 flex items-center gap-2">
              <Calendar className="h-4 w-4 text-orange-600" />
              معاينة التسكير ({closureType === 'period' ? 'بالفترة الزمنية' : 'بنطاق العقود'})
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {(() => {
                const contractsInRange = getContractsInRange();
                const totalAmount = contractsInRange.reduce((sum, contract) => {
                  return sum + contract.collectedFeeAmount;
                }, 0);
                
                return (
                  <>
                    <div className="p-3 bg-white dark:bg-black/20 rounded-xl border border-orange-500/10">
                      <p className="text-xs text-muted-foreground mb-1">عدد العقود المشمولة</p>
                      <p className="text-lg font-bold text-orange-950 dark:text-orange-100">{contractsInRange.length}</p>
                    </div>
                    <div className="p-3 bg-white dark:bg-black/20 rounded-xl border border-orange-500/10">
                      <p className="text-xs text-muted-foreground mb-1">إجمالي مبلغ التسكير</p>
                      <p className="text-lg font-bold text-orange-950 dark:text-orange-100">{totalAmount.toLocaleString()} د.ل</p>
                    </div>
                    <div className="p-3 bg-white dark:bg-black/20 rounded-xl border border-orange-500/10">
                      <p className="text-xs text-muted-foreground mb-1">
                        {closureType === 'period' ? 'تاريخ البدء' : 'العقد الأول'}
                      </p>
                      <p className="text-lg font-bold text-orange-950 dark:text-orange-100">
                        {closureType === 'period' 
                          ? new Date(periodStart).toLocaleDateString('ar-LY')
                          : contractStart
                        }
                      </p>
                    </div>
                    <div className="p-3 bg-white dark:bg-black/20 rounded-xl border border-orange-500/10">
                      <p className="text-xs text-muted-foreground mb-1">
                        {closureType === 'period' ? 'تاريخ الانتهاء' : 'العقد الأخير'}
                      </p>
                      <p className="text-lg font-bold text-orange-950 dark:text-orange-100">
                        {closureType === 'period' 
                          ? new Date(periodEnd).toLocaleDateString('ar-LY')
                          : contractEnd
                        }
                      </p>
                    </div>
                  </>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Contracts Table */}
      <Card className="border-primary/10 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/10 border-b pb-3">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Calculator className="h-4 w-4 text-primary" />
            مستحقات التشغيل - العقود وحالة الحسبة
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="relative group">
            {/* Floating Horizontal Scroll Helper Buttons */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
              <Button
                size="icon"
                variant="secondary"
                onClick={() => scrollTable('right')}
                className="h-10 w-10 rounded-full shadow-lg border border-orange-500/20 bg-background/80 dark:bg-card/80 backdrop-blur-md text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 pointer-events-auto transition-transform hover:scale-110 active:scale-95"
                title="تمرير لليمين"
              >
                <ChevronRight className="h-6 w-6" />
              </Button>
            </div>
            <div className="absolute left-3 top-1/2 -translate-y-1/2 z-20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
              <Button
                size="icon"
                variant="secondary"
                onClick={() => scrollTable('left')}
                className="h-10 w-10 rounded-full shadow-lg border border-orange-500/20 bg-background/80 dark:bg-card/80 backdrop-blur-md text-orange-600 dark:text-orange-400 hover:bg-orange-500/10 pointer-events-auto transition-transform hover:scale-110 active:scale-95"
                title="تمرير ليسار"
              >
                <ChevronLeft className="h-6 w-6" />
              </Button>
            </div>

            <div ref={tableContainerRef} className="overflow-x-auto">
              <Table>
              <TableHeader className="bg-muted/50">
                <TableRow className="whitespace-nowrap">
                  <TableHead className="text-right text-xs font-bold">رقم العقد</TableHead>
                  <TableHead className="text-right text-xs font-bold">اسم العميل</TableHead>
                  <TableHead className="text-right text-xs font-bold">نوع الإعلان</TableHead>
                  <TableHead className="text-right text-xs font-bold">تاريخ العقد</TableHead>
                  <TableHead className="text-right text-xs font-bold">النسبة %</TableHead>
                  <TableHead className="text-right text-xs font-bold">سعر الإيجار</TableHead>
                  <TableHead className="text-right text-xs font-bold">التركيب</TableHead>
                  <TableHead className="text-right text-xs font-bold">الطباعة</TableHead>
                  <TableHead className="text-right text-xs font-bold">الإجمالي الكلي</TableHead>
                  <TableHead className="text-right text-xs font-bold">المدفوع</TableHead>
                  <TableHead className="text-right text-xs font-bold">نسبة التحصيل</TableHead>
                  <TableHead className="text-right text-xs font-bold">النسبة الكاملة</TableHead>
                  <TableHead className="text-right text-xs font-bold">النسبة المتحصلة</TableHead>
                  <TableHead className="text-right text-xs font-bold">المسحوب</TableHead>
                  <TableHead className="text-right text-xs font-bold">نسبة السحب</TableHead>
                  <TableHead className="text-right text-xs font-bold">الحالة</TableHead>
                  <TableHead className="text-right text-xs font-bold">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contracts.map(contract => {
                  const id = contract.id.toString();
                  const excluded = excludedIds.has(id);
                  const closed = isContractClosed(contract);
                  
                  const formattedPercent = formatPercent(contract.feePercent);
                  const formattedRentCost = contract.rent_cost.toLocaleString('en-US', { maximumFractionDigits: 0 });
                  const formattedInstallCost = contract.installation_cost.toLocaleString('en-US', { maximumFractionDigits: 0 });
                  const formattedPrintCost = contract.print_cost.toLocaleString('en-US', { maximumFractionDigits: 0 });
                  const formattedTotal = contract.total_amount.toLocaleString('en-US', { maximumFractionDigits: 0 });
                  const formattedPaid = contract.total_paid.toLocaleString('en-US', { maximumFractionDigits: 0 });
                  const formattedCollectionPct = formatPercent(contract.collectionPercentage);
                  const formattedFullFee = contract.fullFeeAmount.toLocaleString('en-US', { maximumFractionDigits: 0 });
                  const formattedCollectedFee = contract.collectedFeeAmount.toLocaleString('en-US', { maximumFractionDigits: 0 });

                  const isFullyPaid = contract.collectionPercentage >= 100;
                  const isPartialPaid = contract.collectionPercentage > 0 && contract.collectionPercentage < 100;
                  const contractWithdrawn = fifoAllocationPerContract.get(contract.contract_number) || 0;
                  const contractWithdrawnPct = contract.collectedFeeAmount > 0 ? Math.min(100, (contractWithdrawn / contract.collectedFeeAmount) * 100) : 0;
                  const isSettledByWithdrawals = isFullyPaid && settledContractIds.has(contract.contract_number);

                  const hasNoPaid = contract.total_paid === 0;
                  const hasZeroRent = contract.rent_cost === 0;

                  let rowClassName = 'hover:bg-muted/40 transition-colors border-b';
                  if (isSettledByWithdrawals) {
                    rowClassName = 'bg-blue-500/[0.04] hover:bg-blue-500/[0.08] transition-colors border-b border-blue-500/10';
                  } else if (hasZeroRent) {
                    rowClassName = 'bg-muted/10 hover:bg-muted/20 transition-colors border-b';
                  } else if (hasNoPaid) {
                    rowClassName = 'bg-rose-500/[0.04] hover:bg-rose-500/[0.08] transition-colors border-b border-rose-500/10';
                  } else if (isFullyPaid) {
                    rowClassName = 'bg-emerald-500/[0.03] hover:bg-emerald-500/[0.07] transition-colors border-b border-emerald-500/10';
                  } else if (isPartialPaid) {
                    rowClassName = 'bg-amber-500/[0.03] hover:bg-amber-500/[0.07] transition-colors border-b border-amber-500/10';
                  }

                  return (
                    <TableRow 
                      key={id} 
                      className={`${rowClassName} whitespace-nowrap`}
                    >
                      <TableCell className="text-right font-semibold font-manrope">#{contract.contract_number}</TableCell>
                      <TableCell className="text-right text-sm font-medium">{contract.customer_name}</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground">{contract.ad_type || '—'}</TableCell>
                      <TableCell className="text-right font-manrope text-xs text-muted-foreground">{contract.start_date ? new Date(contract.start_date).toLocaleDateString('ar-LY') : '—'}</TableCell>
                      <TableCell className="text-right">
                        <Badge variant="secondary" className="font-manrope text-xs font-semibold">{formattedPercent}%</Badge>
                      </TableCell>
                      <TableCell className="text-right font-manrope text-sm font-semibold">{formattedRentCost} د.ل</TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground font-manrope">
                        {formattedInstallCost} د.ل
                        {contract.include_operating_in_installation && (
                          <Badge variant="outline" className="mr-1 text-[9px] px-1 py-0 border-blue-500/20 text-blue-600">{contract.feePercentInstallation}%</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground font-manrope">
                        {formattedPrintCost} د.ل
                        {contract.include_operating_in_print && (
                          <Badge variant="outline" className="mr-1 text-[9px] px-1 py-0 border-purple-500/20 text-purple-600">{contract.feePercentPrint}%</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right font-bold font-manrope text-sm">{formattedTotal} د.ل</TableCell>
                      <TableCell className="text-right font-bold text-green-600 font-manrope text-sm">{formattedPaid} د.ل</TableCell>
                      <TableCell className="text-right">
                        <Badge 
                          variant={isFullyPaid ? "default" : isPartialPaid ? "secondary" : "outline"}
                          className={`font-manrope text-xs ${
                            isFullyPaid ? 'bg-emerald-600 hover:bg-emerald-700 text-white' : 
                            isPartialPaid ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''
                          }`}
                        >
                          {formattedCollectionPct}%
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs text-muted-foreground font-manrope">{formattedFullFee} د.ل</TableCell>
                      <TableCell className={`text-right font-bold font-manrope text-sm ${
                        excluded || closed ? 'line-through text-muted-foreground' : 
                        (contract.collectedFeeAmount > 0 && contract.total_amount > 100) ? 'text-rose-600 dark:text-rose-500' : 
                        'text-foreground'
                      }`}>
                        {formattedCollectedFee} د.ل
                      </TableCell>
                      <TableCell className="text-right font-manrope font-semibold text-sm">
                        {(!closed && !excluded && contractWithdrawn > 0) 
                          ? `${contractWithdrawn.toLocaleString('en-US', { maximumFractionDigits: 0 })} د.ل` 
                          : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        {(!closed && !excluded && contract.collectedFeeAmount > 0) ? (
                          <Badge 
                            variant={contractWithdrawnPct >= 99.9 ? "default" : contractWithdrawnPct > 0 ? "secondary" : "outline"}
                            className={`font-manrope text-xs gap-1 ${
                              contractWithdrawnPct >= 99.9 ? 'bg-blue-600 hover:bg-blue-700 text-white' : 
                              contractWithdrawnPct > 0 ? 'bg-amber-500 hover:bg-amber-600 text-white' : ''
                            }`}
                          >
                            {contractWithdrawnPct >= 99.9 && <CheckCircle2 className="h-3 w-3" />}
                            {contractWithdrawnPct >= 99.9 ? '100%' : `${contractWithdrawnPct.toFixed(0)}%`}
                          </Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end">
                          {closed ? (
                            <Badge variant="destructive" className="bg-rose-600 hover:bg-rose-700">مسكر</Badge>
                          ) : excluded ? (
                            <Badge variant="secondary">مستبعد</Badge>
                          ) : (
                            <Badge variant="outline" className="border-emerald-500/30 text-emerald-600 bg-emerald-500/[0.02]">نشط</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {!closed && (
                            excluded ? (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs font-semibold px-2 hover:bg-primary/10 hover:text-primary transition-colors"
                                onClick={() => toggleExclusion(id, false)}
                              >
                                إرجاع
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-7 text-xs font-semibold px-2 border-rose-500/20 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 transition-colors"
                                onClick={() => toggleExclusion(id, true)}
                              >
                                استبعاد
                              </Button>
                            )
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
              <TableFooter className="bg-muted/60 font-bold border-t-2 border-border/80 whitespace-nowrap">
                <TableRow>
                  <TableCell className="text-right">المجموع الكلي</TableCell>
                  <TableCell className="text-right">—</TableCell>
                  <TableCell className="text-right">—</TableCell>
                  <TableCell className="text-right">—</TableCell>
                  <TableCell className="text-right">—</TableCell>
                  <TableCell className="text-right font-manrope">{tableTotals.rentCost.toLocaleString('en-US')} د.ل</TableCell>
                  <TableCell className="text-right font-manrope">{tableTotals.installationCost.toLocaleString('en-US')} د.ل</TableCell>
                  <TableCell className="text-right font-manrope">{tableTotals.printCost.toLocaleString('en-US')} د.ل</TableCell>
                  <TableCell className="text-right font-manrope">{tableTotals.totalAmount.toLocaleString('en-US')} د.ل</TableCell>
                  <TableCell className="text-right text-green-600 font-manrope">{tableTotals.totalPaid.toLocaleString('en-US')} د.ل</TableCell>
                  <TableCell className="text-right font-manrope">
                    {(tableTotals.totalAmount > 0 ? ((tableTotals.totalPaid / tableTotals.totalAmount) * 100).toFixed(0) : '0')}%
                  </TableCell>
                  <TableCell className="text-right font-manrope">{tableTotals.fullFeeAmount.toLocaleString('en-US')} د.ل</TableCell>
                  <TableCell className="text-right text-rose-600 font-manrope">{tableTotals.collectedFeeAmount.toLocaleString('en-US')} د.ل</TableCell>
                  <TableCell className="text-right font-manrope">{tableTotals.withdrawn.toLocaleString('en-US')} د.ل</TableCell>
                  <TableCell className="text-right font-manrope">
                    {(tableTotals.collectedFeeAmount > 0 ? ((tableTotals.withdrawn / tableTotals.collectedFeeAmount) * 100).toFixed(0) : '0')}%
                  </TableCell>
                  <TableCell className="text-right">—</TableCell>
                  <TableCell className="text-right">—</TableCell>
                </TableRow>
              </TableFooter>
            </Table>
          </div>

          {/* Floating Horizontal Scroll Slider */}
          {canScroll && isTableInViewport && (
            <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-[9999] bg-background/80 dark:bg-card/90 backdrop-blur-md border border-orange-500/30 shadow-2xl rounded-full px-4 py-2 flex items-center gap-3 w-[340px] md:w-[440px] transition-all duration-300 animate-in fade-in slide-in-from-bottom-4">
              <Button
                size="icon"
                variant="ghost"
                onClick={() => scrollTable('right')}
                className="h-8 w-8 rounded-full hover:bg-orange-500/10 text-orange-600 dark:text-orange-400"
                title="تمرير لليمين"
              >
                <ChevronRight className="h-5 w-5" />
              </Button>
              
              <div className="flex-1 flex items-center gap-2">
                <MoveHorizontal className="h-4 w-4 text-orange-500 shrink-0" />
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={scrollPercent}
                  onChange={(e) => handleSliderChange(Number(e.target.value))}
                  className="w-full h-1.5 bg-muted dark:bg-orange-950/30 rounded-lg appearance-none cursor-pointer accent-orange-600 dark:accent-orange-500 focus:outline-none"
                />
                <span className="text-[10px] font-manrope font-bold text-orange-600 dark:text-orange-400 w-8 text-center shrink-0">
                  {Math.round(scrollPercent)}%
                </span>
              </div>

              <Button
                size="icon"
                variant="ghost"
                onClick={() => scrollTable('left')}
                className="h-8 w-8 rounded-full hover:bg-orange-500/10 text-orange-600 dark:text-orange-400"
                title="تمرير لليسار"
              >
                <ChevronLeft className="h-5 w-5" />
              </Button>
            </div>
          )}
        </div>
      </CardContent>
    </Card>

      {/* Withdrawals History */}
      <Card className="border-primary/20 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/20 border-b space-y-4">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <TrendingDown className="h-4 w-4 text-rose-500" />
            سجل السحوبات من مستحقات التشغيل
          </CardTitle>
          <p className="text-sm text-muted-foreground">تتبع كل سحب إلى الدفعة التي موّلته، مع بيان المستلم والعقود المرتبطة.</p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Input aria-label="البحث في السحوبات" placeholder="ابحث بالمستلم، العميل، المبلغ أو رقم العقد" value={withdrawalSearch} onChange={e => setWithdrawalSearch(e.target.value)} className="sm:max-w-md bg-background" />
            <Select value={withdrawalSourceFilter} onValueChange={setWithdrawalSourceFilter}>
              <SelectTrigger className="sm:w-52 cursor-pointer" aria-label="مصدر السحب"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع المصادر</SelectItem>
                <SelectItem value="distributed">من دفعة موزعة</SelectItem>
                <SelectItem value="manual">غير مرتبط بدفعة</SelectItem>
              </SelectContent>
            </Select>
            <Badge variant="outline" className="self-start sm:self-center">{withdrawals.length} حركة</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-right text-xs font-bold">التاريخ</TableHead>
                  <TableHead className="text-right text-xs font-bold">المبلغ</TableHead>
                  <TableHead className="text-right text-xs font-bold">الطريقة</TableHead>
                  <TableHead className="text-right text-xs font-bold min-w-52">مصدر الأموال</TableHead>
                  <TableHead className="text-right text-xs font-bold">البيان</TableHead>
                  <TableHead className="text-right text-xs font-bold">المستلم/المسلم</TableHead>
                  <TableHead className="text-right text-xs font-bold">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredWithdrawals.map(withdrawal => (
                  <TableRow key={withdrawal.id} className="hover:bg-muted/30 transition-colors border-b">
                    <TableCell className="text-right font-manrope text-sm text-muted-foreground">{new Date(withdrawal.date).toLocaleDateString('ar-LY')}</TableCell>
                    <TableCell className="text-right font-bold font-manrope text-sm text-rose-600">
                      {withdrawal.amount.toLocaleString()} د.ل
                    </TableCell>
                    <TableCell className="text-right text-sm">{withdrawal.method || '—'}</TableCell>
                    <TableCell className="text-right">
                      {withdrawal.distributed_payment_id ? (
                        paymentSources[withdrawal.distributed_payment_id] ? (
                          <button type="button" onClick={() => setSelectedSource(paymentSources[withdrawal.distributed_payment_id!])} className="cursor-pointer text-right rounded-lg border border-primary/20 bg-primary/5 p-2.5 w-full hover:bg-primary/10 transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary">
                            <span className="block text-xs text-muted-foreground">دفعة موزعة من</span>
                            <span className="block font-semibold">{paymentSources[withdrawal.distributed_payment_id].customerName}</span>
                            <span className="block text-xs font-semibold text-primary mt-1">إجمالي الدفعة: {paymentSources[withdrawal.distributed_payment_id].amount.toLocaleString('ar-LY')} د.ل</span>
                            <span className="block text-xs text-muted-foreground mt-1">العقود: {paymentSources[withdrawal.distributed_payment_id].contracts.join('، ') || 'رصيد حساب / فواتير'}</span>
                            {paymentSources[withdrawal.distributed_payment_id].creditAmount > 0 && <span className="block text-xs text-emerald-700 dark:text-emerald-400 mt-1">رصيد العميل: {paymentSources[withdrawal.distributed_payment_id].creditAmount.toLocaleString('ar-LY')} د.ل</span>}
                          </button>
                        ) : <span className="text-xs text-amber-700 dark:text-amber-400">دفعة مرتبطة؛ تفاصيل المصدر غير متاحة<br /><span dir="ltr">{withdrawal.distributed_payment_id}</span></span>
                      ) : <Badge variant="secondary">غير مرتبط بدفعة</Badge>}
                    </TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{withdrawal.note || '—'}</TableCell>
                    <TableCell className="text-right text-xs">
                      {withdrawal.receiver_name && (
                        <div><span className="font-semibold text-muted-foreground">المستلم:</span> {withdrawal.receiver_name}</div>
                      )}
                      {withdrawal.sender_name && (
                        <div><span className="font-semibold text-muted-foreground">المسلم:</span> {withdrawal.sender_name}</div>
                      )}
                      {!withdrawal.receiver_name && !withdrawal.sender_name && '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 rounded-lg hover:bg-primary/10 hover:text-primary transition-colors"
                          onClick={() => {
                            setSelectedWithdrawalForReceipt(withdrawal);
                            setShowWithdrawalReceiptDialog(true);
                          }}
                          title="طباعة إيصال"
                        >
                          <Printer className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 rounded-lg hover:bg-blue-500/10 hover:text-blue-600 transition-colors"
                          onClick={() => {
                            setEditingWithdrawal(withdrawal);
                            setWithdrawalOpen(true);
                          }}
                          title="تعديل"
                          disabled={!canEditSection || !!withdrawal.distributed_payment_id}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 rounded-lg hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
                          onClick={() => deleteWithdrawal(withdrawal.id)}
                          title="حذف"
                          disabled={!canEditSection || !!withdrawal.distributed_payment_id}
                        >
                          <Trash2 className="h-4 w-4 text-rose-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {filteredWithdrawals.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                      {withdrawals.length ? 'لا توجد سحوبات تطابق البحث' : 'لا توجد سحوبات مسجلة'}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Closures History */}
      <Card className="border-primary/10 shadow-sm overflow-hidden">
        <CardHeader className="bg-muted/10 border-b pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold flex items-center gap-2">
            <Lock className="h-4 w-4 text-amber-500" />
            سجل التسكيرات وإغلاقات الفترات
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50">
                <TableRow>
                  <TableHead className="text-right text-xs font-bold">تاريخ التسكير</TableHead>
                  <TableHead className="text-right text-xs font-bold">النوع</TableHead>
                  <TableHead className="text-right text-xs font-bold">النطاق</TableHead>
                  <TableHead className="text-right text-xs font-bold">عدد العقود</TableHead>
                  <TableHead className="text-right text-xs font-bold">إجمالي المبلغ</TableHead>
                  <TableHead className="text-right text-xs font-bold">المسحوب</TableHead>
                  <TableHead className="text-right text-xs font-bold">المتبقي</TableHead>
                  <TableHead className="text-right text-xs font-bold">الملاحظات</TableHead>
                  <TableHead className="text-right text-xs font-bold">الإجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {computedClosures.map(closure => (
                  <TableRow key={closure.id} className="hover:bg-muted/30 transition-colors border-b">
                    <TableCell className="text-right font-manrope text-sm text-muted-foreground">{new Date(closure.closure_date).toLocaleDateString('ar-LY')}</TableCell>
                    <TableCell className="text-right">
                      <Badge variant={closure.closure_type === 'period' ? 'default' : 'secondary'} className="text-xs">
                        {closure.closure_type === 'period' ? 'فترة زمنية' : 'نطاق عقود'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right text-xs font-medium">
                      {closure.closure_type === 'period' && closure.period_start && closure.period_end ? 
                        `${new Date(closure.period_start).toLocaleDateString('ar-LY')} - ${new Date(closure.period_end).toLocaleDateString('ar-LY')}` :
                        closure.closure_type === 'contract_range' && closure.contract_start && closure.contract_end ?
                        `العقود ${closure.contract_start} - ${closure.contract_end}` :
                        '—'
                      }
                    </TableCell>
                    <TableCell className="text-right font-manrope font-semibold text-sm">{closure.total_contracts}</TableCell>
                    <TableCell className="text-right font-manrope font-semibold text-sm">{closure.total_amount.toLocaleString()} د.ل</TableCell>
                    <TableCell className="text-right font-manrope font-semibold text-sm text-rose-600">{closure.total_withdrawn.toLocaleString()} د.ل</TableCell>
                    <TableCell className="text-right font-manrope font-bold text-sm text-emerald-600">{closure.remaining_balance.toLocaleString()} د.ل</TableCell>
                    <TableCell className="text-right text-sm text-muted-foreground">{closure.notes || '—'}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex gap-2 justify-end">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 rounded-lg hover:bg-rose-500/10 hover:text-rose-600 transition-colors"
                          onClick={async () => {
                            if (!await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذه التسكيرة؟', variant: 'destructive', confirmText: 'حذف' })) return;
                            try {
                              const { error } = await supabase
                                .from('period_closures')
                                .delete()
                                .eq('id', closure.id);
                              
                              if (error) {
                                toast.error('فشل في حذف التسكيرة');
                                return;
                              }
                              
                              setClosures(prev => prev.filter(c => c.id !== closure.id));
                              toast.success('تم حذف التسكيرة بنجاح');
                            } catch (error) {
                              toast.error('حدث خطأ في حذف التسكيرة');
                            }
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-rose-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {closures.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                      لا توجد تسكيرات مسجلة
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      <UIDialog.Dialog open={!!selectedSource} onOpenChange={open => { if (!open) setSelectedSource(null); }}>
        <FinanceDialogContent dir="rtl" className="max-w-lg">
          <FinanceDialogHeader>
            <UIDialog.DialogTitle>مصدر السحب · دفعة موزعة</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>تفاصيل الدفعة الأصلية التي موّلت السحب.</UIDialog.DialogDescription>
          </FinanceDialogHeader>
          {selectedSource && <div className="space-y-4">
            <div className="rounded-xl bg-primary/5 border border-primary/20 p-4"><p className="text-sm text-muted-foreground">العميل</p><p className="font-bold text-lg">{selectedSource.customerName}</p><p className="font-manrope text-2xl mt-2">{selectedSource.amount.toLocaleString('ar-LY')} د.ل</p><p className="text-xs text-muted-foreground">إجمالي الدفعة الأصلية؛ قد يشمل أكثر من عقد</p></div>
            <dl className="grid grid-cols-2 gap-3 text-sm"><dt className="text-muted-foreground">الموزع على العقود والفواتير</dt><dd className="font-semibold">{selectedSource.allocatedAmount.toLocaleString('ar-LY')} د.ل</dd><dt className="text-muted-foreground">رصيد العميل غير الموزع</dt><dd className="font-semibold text-emerald-700 dark:text-emerald-400">{selectedSource.creditAmount.toLocaleString('ar-LY')} د.ل</dd><dt className="text-muted-foreground">تاريخ الدفعة</dt><dd>{selectedSource.paidAt ? new Date(selectedSource.paidAt).toLocaleDateString('ar-LY') : 'غير مسجل'}</dd><dt className="text-muted-foreground">العقود</dt><dd>{selectedSource.contracts.join('، ') || 'رصيد حساب / فواتير'}</dd><dt className="text-muted-foreground">المرجع</dt><dd>{selectedSource.reference || 'غير مسجل'}</dd></dl>
            <p className="text-xs text-muted-foreground break-all" dir="ltr">{selectedSource.distributedPaymentId}</p>
            {selectedSource.customerId && <Button className="w-full cursor-pointer transition-all duration-200" onClick={() => navigate(`/admin/customer-billing?id=${encodeURIComponent(selectedSource.customerId!)}`)}>فتح حساب العميل والدفعة المرتبطة</Button>}
          </div>}
        </FinanceDialogContent>
      </UIDialog.Dialog>

      {/* Add Withdrawal Dialog */}
      <UIDialog.Dialog open={withdrawalOpen} onOpenChange={(open) => {
        setWithdrawalOpen(open);
        if (!open) {
          setEditingWithdrawal(null);
          setWithdrawalAmount('');
          setWithdrawalDate(new Date().toISOString().slice(0,10));
          setWithdrawalMethod('');
          setWithdrawalNotes('');
          setWithdrawalReceiverName('');
          setWithdrawalSenderName('');
        } else if (editingWithdrawal) {
          setWithdrawalAmount(editingWithdrawal.amount.toString());
          setWithdrawalDate(editingWithdrawal.date);
          setWithdrawalMethod(editingWithdrawal.method || '');
          setWithdrawalNotes(editingWithdrawal.note || '');
          setWithdrawalReceiverName(editingWithdrawal.receiver_name || '');
          setWithdrawalSenderName(editingWithdrawal.sender_name || '');
        }
      }}>
        <FinanceDialogContent className="max-w-md p-6">
          <FinanceDialogHeader>
            <UIDialog.DialogTitle className="text-xl font-bold flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-orange-600" />
              {editingWithdrawal ? 'تعديل السحب' : 'تسجيل سحب جديد'}
            </UIDialog.DialogTitle>
            <UIDialog.DialogDescription className="text-xs">
              أدخل تفاصيل السحب من المجموع العام لمستحقات التشغيل.
            </UIDialog.DialogDescription>
          </FinanceDialogHeader>
          <div className="space-y-4 my-2">
            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">مبلغ السحب (د.ل) *</label>
              <Input
                type="number"
                placeholder="أدخل مبلغ السحب"
                value={withdrawalAmount}
                onChange={(e) => setWithdrawalAmount(e.target.value)}
                className="font-manrope"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">تاريخ السحب *</label>
              <Input
                type="date"
                value={withdrawalDate}
                onChange={(e) => setWithdrawalDate(e.target.value)}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">طريقة السحب</label>
              <Input
                placeholder="نقدي، تحويل بنكي، شيك..."
                value={withdrawalMethod}
                onChange={(e) => setWithdrawalMethod(e.target.value)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">اسم المستلم</label>
                <Input
                  placeholder="اسم المستلم"
                  value={withdrawalReceiverName}
                  onChange={(e) => setWithdrawalReceiverName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-1">اسم المسلم</label>
                <Input
                  placeholder="اسم المسلم"
                  value={withdrawalSenderName}
                  onChange={(e) => setWithdrawalSenderName(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground block mb-1">ملاحظات البيان</label>
              <Textarea
                placeholder="أدخل أي ملاحظات إضافية"
                value={withdrawalNotes}
                onChange={(e) => setWithdrawalNotes(e.target.value)}
                rows={2}
              />
            </div>
          </div>
          <FinanceDialogFooter className="flex justify-end gap-2 border-t pt-4 mt-2">
            <Button variant="outline" onClick={() => setWithdrawalOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={addWithdrawal} className="bg-orange-600 hover:bg-orange-700 text-white font-bold">
              {editingWithdrawal ? 'تحديث' : 'حفظ السحب'}
            </Button>
          </FinanceDialogFooter>
        </FinanceDialogContent>
      </UIDialog.Dialog>

      {/* Closure Dialog */}
      <UIDialog.Dialog open={closureOpen} onOpenChange={setClosureOpen}>
        <FinanceDialogContent className="max-w-lg">
          <FinanceDialogHeader>
            <UIDialog.DialogTitle>تسكير حساب</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              ا��تر طريقة التسكير: بالفترة الزمنية أو بنطاق أرقام العقود
            </UIDialog.DialogDescription>
          </FinanceDialogHeader>
          <div className="expenses-dialog-form">
            <div>
              <label className="expenses-form-label">تاريخ التسكير</label>
              <Input
                type="date"
                value={closureDate}
                onChange={(e) => setClosureDate(e.target.value)}
              />
            </div>

            <div>
              <label className="expenses-form-label">نوع التسكير</label>
              <Select value={closureType} onValueChange={(value: 'period' | 'contract_range') => setClosureType(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="period">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      تسكير بالفترة الزمنية
                    </div>
                  </SelectItem>
                  <SelectItem value="contract_range">
                    <div className="flex items-center gap-2">
                      <Hash className="h-4 w-4" />
                      تسكير بنطاق أرقام العقود
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {closureType === 'period' ? (
              <div className="expenses-form-grid">
                <div>
                  <label className="expenses-form-label">بداية الفترة</label>
                  <Input
                    type="date"
                    value={periodStart}
                    onChange={(e) => setPeriodStart(e.target.value)}
                  />
                </div>
                <div>
                  <label className="expenses-form-label">نهاية الفترة</label>
                  <Input
                    type="date"
                    value={periodEnd}
                    onChange={(e) => setPeriodEnd(e.target.value)}
                  />
                </div>
              </div>
            ) : (
              <div className="expenses-form-grid">
                <div>
                  <label className="expenses-form-label">من رقم العقد</label>
                  <Select value={contractStart} onValueChange={setContractStart}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر العقد الأول" />
                    </SelectTrigger>
                    <SelectContent>
                      {contractNumbers.map(num => (
                        <SelectItem key={num} value={num}>{num}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="expenses-form-label">إلى رقم العقد</label>
                  <Select value={contractEnd} onValueChange={setContractEnd}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر العقد الأخير" />
                    </SelectTrigger>
                    <SelectContent>
                      {contractNumbers.map(num => (
                        <SelectItem key={num} value={num}>{num}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div>
              <label className="expenses-form-label">ملاحظات التسكير</label>
              <Textarea
                placeholder="أدخل ملاحظات حول التسكير"
                value={closureNotes}
                onChange={(e) => setClosureNotes(e.target.value)}
              />
            </div>
          </div>
          <FinanceDialogFooter>
            <Button variant="outline" onClick={() => setClosureOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={closePeriodOrRange} variant="destructive">
              تسكير الحساب
            </Button>
          </FinanceDialogFooter>
        </FinanceDialogContent>
      </UIDialog.Dialog>

      {/* Withdrawal Receipt Print Dialog */}
      {selectedWithdrawalForReceipt && (
        <ExpenseReceiptPrintDialog
          open={showWithdrawalReceiptDialog}
          onOpenChange={setShowWithdrawalReceiptDialog}
          expense={{
            ...selectedWithdrawalForReceipt,
            description: 'سحب من مستحقات التشغيل',
            expense_date: selectedWithdrawalForReceipt.date,
            category: 'مستحقات التشغيل',
            payment_method: selectedWithdrawalForReceipt.method || '',
            notes: selectedWithdrawalForReceipt.note || '',
            receipt_number: `W-${selectedWithdrawalForReceipt.id.substring(0, 8)}`
          }}
        />
      )}

      {/* Operating Dues Print Dialog */}
      <OperatingDuesPrintDialog
        open={showPrintDialog}
        onClose={() => setShowPrintDialog(false)}
        contracts={contracts}
        withdrawals={withdrawals}
        closures={computedClosures}
        excludedIds={excludedIds}
        totals={totals}
        settledContractIds={settledContractIds}
      />

      {/* All Additions Dialog */}
      <UIDialog.Dialog open={allAdditionsOpen} onOpenChange={setAllAdditionsOpen}>
        <FinanceDialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6" dir="rtl">
          <FinanceDialogHeader className="pb-4 border-b">
            <UIDialog.DialogTitle className="text-xl font-bold flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-green-600" />
              مصادر جميع إضافات رسوم التشغيل ({allAdditions.length})
            </UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              سجل تفصيلي بكافة الدفعات التي رفعت رصيد مستحقات التشغيل.
            </UIDialog.DialogDescription>
          </FinanceDialogHeader>
          <div className="flex-1 overflow-y-auto my-4 pr-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">رقم العقد</TableHead>
                  <TableHead className="text-right">اسم العميل</TableHead>
                  <TableHead className="text-right">تاريخ الدفع</TableHead>
                  <TableHead className="text-right">مبلغ الدفعة</TableHead>
                  <TableHead className="text-right">النسبة %</TableHead>
                  <TableHead className="text-right">الزيادة في المستحقات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {allAdditions.map((payment) => (
                  <TableRow key={payment.id}>
                    <TableCell className="text-right font-manrope font-semibold">#{payment.contract_number}</TableCell>
                    <TableCell className="text-right">{payment.customer_name || '—'}</TableCell>
                    <TableCell className="text-right font-manrope">
                      {payment.paid_at ? new Date(payment.paid_at).toLocaleDateString('ar-LY') : '—'}
                    </TableCell>
                    <TableCell className="text-right font-manrope font-semibold text-green-600">
                      {payment.amount.toLocaleString()} د.ل
                    </TableCell>
                    <TableCell className="text-right">
                      <Badge variant="secondary" className="font-manrope">{payment.fee_rate}%</Badge>
                    </TableCell>
                    <TableCell className="text-right font-manrope font-bold text-primary">
                      +{payment.fee_amount.toLocaleString()} د.ل
                    </TableCell>
                  </TableRow>
                ))}
                {allAdditions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                      لا توجد أي إضافات مسجلة بعد.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          <FinanceDialogFooter className="pt-4 border-t">
            <Button onClick={() => setAllAdditionsOpen(false)}>إغلاق</Button>
          </FinanceDialogFooter>
        </FinanceDialogContent>
      </UIDialog.Dialog>
    </div>
  );
}
