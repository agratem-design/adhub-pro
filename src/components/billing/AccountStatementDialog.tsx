import React, { useState, useEffect, useMemo } from 'react';
import * as UIDialog from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Printer, Download, Eye, FileText, X, AlertCircle, Layers, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useAccountStatementPrint } from './AccountStatementPrint';
import {
  buildCanonicalCustomerLedger,
  RawCustomerFinancialSources,
  CanonicalCustomerLedgerResult,
  CanonicalLedgerEntry,
} from '@/lib/canonicalCustomerLedger';

interface AccountStatementDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customerId?: string;
  customerName?: string;
}

const CURRENCIES = [
  { code: 'LYD', name: 'دينار ليبي', symbol: 'د.ل', writtenName: 'دينار ليبي' },
  { code: 'USD', name: 'دولار أمريكي', symbol: '$', writtenName: 'دولار أمريكي' },
  { code: 'EUR', name: 'يورو', symbol: '€', writtenName: 'يورو' },
  { code: 'TND', name: 'دينار تونسي', symbol: 'د.ت', writtenName: 'دينار تونسي' },
  { code: 'TRY', name: 'ليرة تركية', symbol: '₺', writtenName: 'ليرة تركية' },
];

const formatArabicNumber = (num: number): string => {
  if (isNaN(num) || num === null || num === undefined) return '0';
  return num.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
};

const getTypeBadge = (entry: CanonicalLedgerEntry) => {
  switch (entry.type) {
    case 'contract':
      return { text: 'عقد إيجار لوحات طرقية', className: 'bg-blue-500/10 text-blue-400 border border-blue-500/20' };
    case 'composite_task':
      return { 
        text: entry.metadata?.badgeTitle || 'فاتورة طباعة', 
        className: 'bg-purple-500/10 text-purple-400 border border-purple-500/20' 
      };
    case 'cash_payment':
      return { text: 'سند قبض', className: 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' };
    case 'general_discount':
      return { text: 'خصم عام', className: 'bg-amber-500/10 text-amber-400 border border-amber-500/20' };
    case 'purchase_offset':
      return { text: 'مقاصة مشتريات', className: 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20' };
    case 'friend_company_offset':
      return { text: 'مقاصة صديقة', className: 'bg-teal-500/10 text-teal-400 border border-teal-500/20' };
    case 'sales_invoice':
      return { text: 'فاتورة مبيعات', className: 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' };
    case 'printed_invoice':
      return { text: 'فاتورة طباعة', className: 'bg-fuchsia-500/10 text-fuchsia-400 border border-fuchsia-500/20' };
    case 'opening_balance':
      return { text: 'رصيد سابق', className: 'bg-slate-500/10 text-slate-400 border border-slate-500/20' };
    default:
      return { text: 'حركة مالية', className: 'bg-muted/40 text-muted-foreground border border-border' };
  }
};

export default function AccountStatementDialog({ open, onOpenChange, customerId, customerName }: AccountStatementDialogProps) {
  const [statementMode, setStatementMode] = useState<'simple' | 'detailed'>('simple');
  const [isLoading, setIsLoading] = useState(false);
  const [customerData, setCustomerData] = useState<any>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [currency, setCurrency] = useState(CURRENCIES[0]);
  const [excludeFriendRentals, setExcludeFriendRentals] = useState(false);
  const [hideStopAdjustments, setHideStopAdjustments] = useState(true); // ON افتراضياً

  // المصادر الخام لقاعدة البيانات
  const [rawSources, setRawSources] = useState<RawCustomerFinancialSources>({
    contracts: [],
    payments: [],
    salesInvoices: [],
    printedInvoices: [],
    purchaseInvoices: [],
    generalDiscounts: [],
    compositeTasks: [],
    printTasks: [],
    cutoutTasks: [],
    pausedBillboards: [],
    friendBillboardRentals: [],
  });

  const { print: printStatement, isPrinting } = useAccountStatementPrint();

  // استخراج السنوات المتاحة
  const availableYears = useMemo(() => {
    const years = new Set<number>();
    (rawSources.contracts || []).forEach(c => {
      const dateStr = c['Contract Date'] || c.start_date || c.created_at;
      if (dateStr) {
        const year = new Date(dateStr).getFullYear();
        if (year && !isNaN(year)) years.add(year);
      }
    });
    years.add(new Date().getFullYear());
    return Array.from(years).sort((a, b) => b - a);
  }, [rawSources.contracts]);

  // بناء دفتر الأستاذ المالي المركزي الموحد (Canonical Customer Ledger)
  const ledgerResult: CanonicalCustomerLedgerResult = useMemo(() => {
    return buildCanonicalCustomerLedger(rawSources, {
      startDate,
      endDate,
      excludeFriendRentals,
      hidePaymentDistribution: statementMode === 'simple',
      hideStopAdjustments: statementMode === 'simple' ? hideStopAdjustments : false,
    });
  }, [rawSources, startDate, endDate, excludeFriendRentals, statementMode, hideStopAdjustments]);

  // تحميل البيانات عند فتح النافذة
  useEffect(() => {
    if (open) {
      loadAccountData();
    }
  }, [open, customerId, customerName]);

  const loadAccountData = async () => {
    setIsLoading(true);
    try {
      // 1. جلب بيانات العميل
      let customerInfo: any = null;
      let effectiveCustId = customerId;

      if (effectiveCustId) {
        const { data } = await supabase.from('customers').select('*').eq('id', effectiveCustId).single();
        customerInfo = data;
      } else if (customerName) {
        const { data } = await supabase.from('customers').select('*').ilike('name', `%${customerName}%`).limit(1).maybeSingle();
        customerInfo = data;
        if (data) effectiveCustId = data.id;
      }

      setCustomerData(customerInfo || { name: customerName || 'عميل غير محدد', id: effectiveCustId || '—' });

      // 2. جلب جميع المصادر المالية في وقت واحد (Parallel Fetching)
      const [
        contractsRes,
        paymentsRes,
        salesRes,
        printedRes,
        purchaseRes,
        discountsRes,
        compositeRes,
        printTasksRes,
        cutoutTasksRes,
        pausedRes,
        friendRentalsRes,
      ] = await Promise.all([
        effectiveCustId
          ? supabase.from('Contract').select('*').eq('customer_id', effectiveCustId).order('Contract Date', { ascending: true })
          : supabase.from('Contract').select('*').eq('Customer Name', customerName).order('Contract Date', { ascending: true }),

        effectiveCustId
          ? supabase.from('customer_payments').select('*').eq('customer_id', effectiveCustId).order('paid_at', { ascending: true })
          : supabase.from('customer_payments').select('*').eq('customer_name', customerName).order('paid_at', { ascending: true }),

        effectiveCustId
          ? supabase.from('sales_invoices').select('*').eq('customer_id', effectiveCustId).order('invoice_date', { ascending: true })
          : supabase.from('sales_invoices').select('*').eq('customer_name', customerName).order('invoice_date', { ascending: true }),

        effectiveCustId
          ? supabase.from('printed_invoices').select('*').eq('customer_id', effectiveCustId).order('invoice_date', { ascending: true })
          : supabase.from('printed_invoices').select('*').eq('customer_name', customerName).order('invoice_date', { ascending: true }),

        effectiveCustId
          ? supabase.from('purchase_invoices').select('*').eq('customer_id', effectiveCustId).order('invoice_date', { ascending: true })
          : supabase.from('purchase_invoices').select('*').eq('supplier_name', customerName).order('invoice_date', { ascending: true }),

        effectiveCustId
          ? supabase.from('customer_general_discounts').select('*').eq('customer_id', effectiveCustId).eq('status', 'active')
          : Promise.resolve({ data: [] }),

        effectiveCustId
          ? supabase.from('composite_tasks').select('*').eq('customer_id', effectiveCustId).order('created_at', { ascending: true })
          : Promise.resolve({ data: [] }),

        effectiveCustId
          ? supabase.from('print_tasks').select('*').eq('customer_id', effectiveCustId)
          : Promise.resolve({ data: [] }),

        effectiveCustId
          ? supabase.from('cutout_tasks').select('*').eq('customer_id', effectiveCustId)
          : Promise.resolve({ data: [] }),

        effectiveCustId
          ? supabase.from('paused_billboards').select('*')
          : Promise.resolve({ data: [] }),

        effectiveCustId && customerInfo?.linked_friend_company_id
          ? supabase.from('friend_billboard_rentals').select('*').eq('friend_company_id', customerInfo.linked_friend_company_id)
          : Promise.resolve({ data: [] }),
      ]);

      const contracts = (contractsRes.data || []) as any[];
      const contractNumbers = contracts.map(c => Number(c.Contract_Number)).filter(Boolean);

      // جلب بيانات العقود المرتبطة بإيجارات الشركات الصديقة لجلب نوع الإعلان بدقة
      const friendRentals = (friendRentalsRes.data || []) as any[];
      const friendContractNumbers = Array.from(
        new Set(friendRentals.map((fr: any) => Number(fr.contract_number)).filter(Boolean))
      );

      let allContractsList = contracts;
      if (friendContractNumbers.length > 0) {
        const missingContractNums = friendContractNumbers.filter(num => !contractNumbers.includes(num));
        if (missingContractNums.length > 0) {
          const { data: extContracts } = await supabase
            .from('Contract')
            .select('*')
            .in('Contract_Number', missingContractNums);
          if (extContracts && extContracts.length > 0) {
            allContractsList = [...contracts, ...extContracts];
          }
        }
      }

      // تصفية اللوحات الموقوفة للعقود التابعة لهذا العميل فقط
      const pausedList = (pausedRes.data || []).filter((pb: any) =>
        contractNumbers.includes(Number(pb.contract_number))
      );

      setRawSources({
        contracts,
        allContracts: allContractsList,
        payments: paymentsRes.data || [],
        salesInvoices: salesRes.data || [],
        printedInvoices: printedRes.data || [],
        purchaseInvoices: purchaseRes.data || [],
        generalDiscounts: discountsRes.data || [],
        compositeTasks: compositeRes.data || [],
        printTasks: printTasksRes.data || [],
        cutoutTasks: cutoutTasksRes.data || [],
        pausedBillboards: pausedList,
        friendBillboardRentals: friendRentalsRes.data || [],
        linkedFriendCompanyName: customerInfo?.linked_friend_company_name || null,
      });
    } catch (err) {
      console.error('Error loading canonical customer ledger data:', err);
      toast.error('حدث خطأ أثناء تحميل البيانات المالية للعميل');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePrint = async () => {
    if (!customerData) return;
    await printStatement({
      customerData: {
        id: customerData.id || '',
        name: customerData.name || customerName || 'عميل',
        company: customerData.company,
        phone: customerData.phone,
        email: customerData.email,
      },
      ledgerResult,
      mode: statementMode,
      currency,
      startDate,
      endDate,
      hidePaymentDistribution: statementMode === 'simple',
      hideStopAdjustments: statementMode === 'simple' ? hideStopAdjustments : false,
    });
  };

  const totals = ledgerResult.totals;
  const endingBalance = ledgerResult.endingBalance;

  return (
    <UIDialog.Dialog open={open} onOpenChange={onOpenChange}>
      <UIDialog.DialogContent className="w-full max-w-[72rem] h-[90vh] max-h-[90vh] overflow-hidden flex flex-col p-0">
        
        {/* شريط العنوان وزر التبديل بين الكشف المبسط والتفصيلي */}
        <UIDialog.DialogHeader className="p-4 border-b bg-card flex-shrink-0">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="p-2 bg-primary/10 text-primary rounded-lg">
                <FileText className="h-5 w-5" />
              </div>
              <div>
                <UIDialog.DialogTitle className="text-lg font-bold">
                  كشف حساب العميل: {customerData?.name || customerName}
                </UIDialog.DialogTitle>
                <div className="text-xs text-muted-foreground mt-0.5">
                  المصدر المالي الموحد (Canonical Single Source of Financial Truth)
                </div>
              </div>
            </div>

            {/* Toggle: مبسط (افتراضي) / تفصيلي + خيار إخفاء الإيقافات */}
            <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
              <div className="flex items-center bg-muted/60 p-1 rounded-xl border border-border">
                <button
                  type="button"
                  onClick={() => setStatementMode('simple')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    statementMode === 'simple'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  كشف الحساب (افتراضي)
                </button>
                <button
                  type="button"
                  onClick={() => setStatementMode('detailed')}
                  className={`flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                    statementMode === 'detailed'
                      ? 'bg-primary text-primary-foreground shadow-sm'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  كشف تفصيلي ومراجعة
                </button>
              </div>

              {/* خيار إخفاء الإيقافات (مفعّل افتراضياً) */}
              <label className="flex items-center gap-2 bg-muted/50 hover:bg-muted/80 px-3 py-1.5 rounded-xl border border-border/80 cursor-pointer select-none transition-colors">
                <input
                  type="checkbox"
                  id="hideStopAdjustments"
                  checked={hideStopAdjustments}
                  onChange={(e) => setHideStopAdjustments(e.target.checked)}
                  className="h-4 w-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
                />
                <span className="text-xs font-semibold text-foreground">
                  إخفاء الإيقافات
                </span>
                <span className="text-[10px] text-muted-foreground">
                  (مفعّل افتراضياً)
                </span>
              </label>
            </div>
          </div>
        </UIDialog.DialogHeader>

        {/* محتوى الكشف الداخلي */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {isLoading ? (
            <div className="text-center py-16">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4" />
              <p className="text-base font-semibold">جاري حساب وتدقيق دفتر الأستاذ المالي للعميل...</p>
              <p className="text-xs text-muted-foreground mt-1">يتم جلب العقود والدفعات والمهام والتسويات</p>
            </div>
          ) : (
            <>
              {/* شريط الفلاتر والخيارات */}
              <div className="bg-card/70 border border-border p-3.5 rounded-xl space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">من تاريخ:</label>
                    <Input
                      type="date"
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">إلى تاريخ:</label>
                    <Input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="h-9 text-xs"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-muted-foreground mb-1.5">العملة:</label>
                    <select
                      value={currency.code}
                      onChange={(e) => setCurrency(CURRENCIES.find(c => c.code === e.target.value) || CURRENCIES[0])}
                      className="w-full h-9 px-3 border border-input rounded-md text-xs bg-background text-foreground"
                    >
                      {CURRENCIES.map(curr => (
                        <option key={curr.code} value={curr.code}>
                          {curr.name} ({curr.symbol})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* أزرار الفلترة السريعة بالسنوات */}
                <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-border/50">
                  <span className="text-[11px] text-muted-foreground ml-2">نطاق سريع:</span>
                  <Button
                    variant={!startDate && !endDate ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                    className="h-7 text-xs px-2.5"
                  >
                    كافة المعاملات
                  </Button>
                  {availableYears.map(year => {
                    const yearStart = `${year}-01-01`;
                    const yearEnd = `${year}-12-31`;
                    const isActive = startDate === yearStart && endDate === yearEnd;
                    return (
                      <Button
                        key={year}
                        variant={isActive ? "default" : "outline"}
                        size="sm"
                        onClick={() => { setStartDate(yearStart); setEndDate(yearEnd); }}
                        className="h-7 text-xs px-2.5"
                      >
                        سنة {year}
                      </Button>
                    );
                  })}
                </div>
              </div>

              {/* بطاقات الملخص المالي المركزية */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-card border border-border p-3 rounded-xl">
                  <div className="text-xs text-muted-foreground font-semibold">إجمالي المستحقات</div>
                  <div className="text-lg font-black text-rose-500 mt-1">
                    {formatArabicNumber(totals.totalCustomerCharges)} {currency.symbol}
                  </div>
                </div>

                <div className="bg-card border border-border p-3 rounded-xl">
                  <div className="text-xs text-muted-foreground font-semibold">إجمالي المدفوع نقداً</div>
                  <div className="text-lg font-black text-emerald-500 mt-1">
                    {formatArabicNumber(totals.cashPayments)} {currency.symbol}
                  </div>
                </div>

                <div className="bg-card border border-border p-3 rounded-xl">
                  <div className="text-xs text-muted-foreground font-semibold">التسويات والمقاصة</div>
                  <div className="text-lg font-black text-cyan-500 mt-1">
                    {formatArabicNumber(totals.totalNonCashAdjustments)} {currency.symbol}
                  </div>
                </div>

                <div className={`p-3 rounded-xl border-2 ${endingBalance > 0 ? 'bg-rose-500/10 border-rose-500/40' : 'bg-emerald-500/10 border-emerald-500/40'}`}>
                  <div className={`text-xs font-bold ${endingBalance > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                    {endingBalance > 0 ? 'المتبقي على العميل' : endingBalance < 0 ? 'رصيد دائن للعميل' : 'الحساب مسدد'}
                  </div>
                  <div className={`text-lg font-black mt-1 ${endingBalance > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                    {formatArabicNumber(Math.abs(endingBalance))} {currency.symbol}
                  </div>
                </div>
              </div>

              {/* الجدول المالي الرئيسي */}
              <div className="border border-border rounded-xl overflow-hidden bg-card">
                <div className="p-3 border-b bg-muted/40 flex items-center justify-between">
                  <div className="font-bold text-sm">
                    {statementMode === 'simple' ? 'كشف الحساب' : 'دفتر الأستاذ التفصيلي والمراجعة'} ({ledgerResult.displayedEntries.length} حركة)
                  </div>
                  <div className="text-xs text-muted-foreground">
                    نسبة تسوية الحساب: {totals.repaymentPercentage}%
                  </div>
                </div>

                <div className="overflow-x-auto max-h-[380px]">
                  <table className="w-full text-xs text-right border-collapse">
                    <thead className="bg-muted/70 text-foreground sticky top-0 font-bold border-b">
                      {statementMode === 'simple' ? (
                        <tr>
                          <th className="p-2.5 text-center w-12">#</th>
                          <th className="p-2.5 text-center w-24">التاريخ</th>
                          <th className="p-2.5 text-right">البيان والتفاصيل</th>
                          <th className="p-2.5 text-center w-28 text-rose-400">المستحق (+)</th>
                          <th className="p-2.5 text-center w-28 text-emerald-400">المسدد / المخفض (-)</th>
                          <th className="p-2.5 text-center w-28">الرصيد المتبقي</th>
                        </tr>
                      ) : (
                        <tr>
                          <th className="p-2.5 text-center w-10">#</th>
                          <th className="p-2.5 text-center w-24">التاريخ</th>
                          <th className="p-2.5 text-center w-28">نوع الحركة</th>
                          <th className="p-2.5 text-right">البيان والمرجع</th>
                          <th className="p-2.5 text-center w-28 text-rose-400">مستحق (+)</th>
                          <th className="p-2.5 text-center w-28 text-emerald-400">سداد / تسوية (-)</th>
                          <th className="p-2.5 text-center w-28">الرصيد التراكمي</th>
                        </tr>
                      )}
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {ledgerResult.displayedEntries.map((entry, index) => {
                        const isOpening = entry.type === 'opening_balance';
                        const badge = getTypeBadge(entry);

                        if (statementMode === 'simple') {
                          return (
                            <tr key={entry.id} className={isOpening ? 'bg-primary/5 font-semibold' : index % 2 === 0 ? 'bg-background' : 'bg-card/40'}>
                              <td className="p-2.5 text-center text-muted-foreground">{isOpening ? '—' : index + 1}</td>
                              <td className="p-2.5 text-center">{entry.date || '—'}</td>
                              <td className="p-2.5 text-right">
                                <div className="font-semibold">{entry.description}</div>
                                {entry.subtitle && (
                                  <div className="text-[11px] text-muted-foreground mt-0.5">{entry.subtitle}</div>
                                )}
                              </td>
                              <td className="p-2.5 text-center font-bold text-rose-400">
                                {entry.displayCharge > 0 ? `${formatArabicNumber(entry.displayCharge)} ${currency.symbol}` : '—'}
                              </td>
                              <td className="p-2.5 text-center font-bold text-emerald-400">
                                {entry.displayReduction > 0 ? `${formatArabicNumber(entry.displayReduction)} ${currency.symbol}` : '—'}
                              </td>
                              <td className={`p-2.5 text-center font-black ${entry.runningBalance < 0 ? 'text-emerald-400 font-bold' : 'text-foreground'}`}>
                                {entry.runningBalance < 0
                                  ? `${formatArabicNumber(Math.abs(entry.runningBalance))} ${currency.symbol} (دائن)`
                                  : `${formatArabicNumber(entry.runningBalance)} ${currency.symbol}`}
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={entry.id} className={isOpening ? 'bg-primary/5 font-semibold' : index % 2 === 0 ? 'bg-background' : 'bg-card/40'}>
                            <td className="p-2.5 text-center text-muted-foreground">{isOpening ? '—' : index + 1}</td>
                            <td className="p-2.5 text-center">{entry.date || '—'}</td>
                            <td className="p-2.5 text-center">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${badge.className}`}>
                                {badge.text}
                              </span>
                            </td>
                            <td className="p-2.5 text-right">
                              <div className="font-semibold">{entry.description}</div>
                              <div className="text-[11px] text-muted-foreground mt-0.5">
                                المرجع: {entry.reference} {entry.notes && entry.notes !== '—' ? `| ملاحظات: ${entry.notes}` : ''}
                              </div>
                              {entry.subtitle && (
                                <div className="text-[10.5px] text-amber-400/90 mt-0.5">{entry.subtitle}</div>
                              )}
                            </td>
                            <td className="p-2.5 text-center font-bold text-rose-400">
                              {entry.displayCharge > 0 ? `${formatArabicNumber(entry.displayCharge)} ${currency.symbol}` : '—'}
                            </td>
                            <td className="p-2.5 text-center font-bold text-emerald-400">
                              {entry.displayReduction > 0 ? `${formatArabicNumber(entry.displayReduction)} ${currency.symbol}` : '—'}
                            </td>
                            <td className={`p-2.5 text-center font-black ${entry.runningBalance < 0 ? 'text-emerald-400 font-bold' : 'text-foreground'}`}>
                              {entry.runningBalance < 0
                                ? `${formatArabicNumber(Math.abs(entry.runningBalance))} ${currency.symbol} (دائن)`
                                : `${formatArabicNumber(entry.runningBalance)} ${currency.symbol}`}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>

        {/* الشريط السفلي وزر الطباعة */}
        <div className="p-3 border-t bg-card flex-shrink-0 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>

          <Button
            onClick={handlePrint}
            disabled={isLoading || isPrinting || ledgerResult.displayedEntries.length === 0}
            className="gap-2 bg-primary text-primary-foreground font-bold px-5"
          >
            <Printer className="h-4 w-4" />
            {isPrinting ? 'جاري التحضير...' : `طباعة ${statementMode === 'simple' ? 'كشف الحساب' : 'الكشف التفصيلي'}`}
          </Button>
        </div>

      </UIDialog.DialogContent>
    </UIDialog.Dialog>
  );
}
