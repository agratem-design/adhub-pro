import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Printer, X, Filter, FileText, ChevronDown, ChevronUp, AlertTriangle, BarChart3, TrendingDown, Wallet, Hash, EyeOff, Eye, Layers } from 'lucide-react';
import { useState, useMemo, useEffect } from 'react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { DOCUMENT_TYPES } from '@/types/document-types';
import { usePrintTheme } from '@/hooks/usePrintTheme';
import { formatArabicNumber, formatDate } from '@/lib/printUtils';
import {
  PrintColumn,
  PrintTotalsItem,
  PrintDocumentData,
  createMeasurementsConfigFromSettings,
  openMeasurementsPrintWindow,
  MeasurementsHTMLOptions,
} from '@/lib/printMeasurements';

interface Contract {
  id: string;
  contract_number: string;
  customer_name: string;
  ad_type: string;
  feePercent: number;
  fullFeeAmount: number;
  collectedFeeAmount: number;
  rent_cost: number;
  installation_cost: number;
  print_cost: number;
  total_amount: number;
  total_paid: number;
  collectionPercentage: number;
  start_date: string;
}

interface Withdrawal {
  id: string;
  amount: number;
  date: string;
  method?: string;
  note?: string;
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

interface Billboard {
  ID: number;
  Billboard_Name: string;
  Size: string;
  Faces_Count: number;
  City: string;
  District: string;
  Level: string;
  Contract_Number: number;
  Price: number;
}

interface OperatingDuesPrintDialogProps {
  open: boolean;
  onClose: () => void;
  contracts: Contract[];
  withdrawals: Withdrawal[];
  closures: PeriodClosure[];
  excludedIds: Set<string>;
  totals: {
    totalContracts: number;
    poolTotal: number;
    totalWithdrawn: number;
    remainingPool: number;
  };
  settledContractIds?: Set<string>;
}

// =====================================================
// Table Mapping Functions
// =====================================================

function getContractsTableColumns(hideFinancials: boolean = false): PrintColumn[] {
  const cols: PrintColumn[] = [
    { key: 'index', header: '#', width: '2.5%', align: 'center' },
    { key: 'contract_number', header: 'رقم\nالعقد', width: '4%', align: 'center' },
    { key: 'customer_name', header: 'اسم العميل', width: '11%', align: 'right' },
    { key: 'ad_type', header: 'نوع\nالإعلان', width: '6%', align: 'center' },
    { key: 'start_date', header: 'تاريخ\nالعقد', width: '6.5%', align: 'center' },
    { key: 'fee_percent', header: '%', width: '3%', align: 'center' },
    { key: 'rent_cost', header: 'سعر\nالإيجار', width: '7.5%', align: 'center' },
    { key: 'installation_print', header: 'التركيب\nوالطباعة', width: '7%', align: 'center' },
    { key: 'total_amount', header: 'الإجمالي', width: '7.5%', align: 'center' },
    { key: 'total_paid', header: 'المدفوع', width: '7.5%', align: 'center' },
    { key: 'collection_percent', header: 'نسبة\nالتحصيل', width: '4.5%', align: 'center' },
    { key: 'full_fee', header: 'النسبة\nالكاملة', width: '7%', align: 'center' },
    { key: 'collected_fee', header: 'النسبة\nالمتحصلة', width: '7%', align: 'center' },
  ];
  if (!hideFinancials) {
    cols.push(
      { key: 'withdrawn_amount', header: 'المسحوب', width: '7%', align: 'center' },
      { key: 'withdrawn_percent', header: 'نسبة\nالسحب', width: '4.5%', align: 'center' },
    );
  }
  return cols;
}

/**
 * Compute FIFO withdrawal allocation per contract
 * Distributes total withdrawals across contracts sorted by contract_number (oldest first)
 */
function computeFifoAllocation(contracts: Contract[], totalWithdrawals: number): Map<string, number> {
  const allocation = new Map<string, number>();
  const sorted = [...contracts].sort((a, b) => {
    const na = parseInt(a.contract_number, 10);
    const nb = parseInt(b.contract_number, 10);
    return (Number.isFinite(na) ? na : 0) - (Number.isFinite(nb) ? nb : 0);
  });

  let remaining = totalWithdrawals;
  for (const c of sorted) {
    if (remaining <= 0 || c.collectedFeeAmount <= 0) {
      allocation.set(c.contract_number, 0);
      continue;
    }
    const allocated = Math.min(remaining, c.collectedFeeAmount);
    allocation.set(c.contract_number, allocated);
    remaining -= allocated;
  }
  return allocation;
}

function mapContractsToTableRows(contracts: Contract[], totalWithdrawals: number): Record<string, any>[] {
  const fifoAllocation = computeFifoAllocation(contracts, totalWithdrawals);

  return contracts.map((c, index) => {
    const withdrawn = fifoAllocation.get(c.contract_number) || 0;
    // ✅ نسبة السحب من القيمة المتحصلة فعلياً (حسب نسبة السداد)
    const withdrawnPct = c.collectedFeeAmount > 0 ? Math.min(100, (withdrawn / c.collectedFeeAmount) * 100) : 0;
    const isFullySettled = c.collectionPercentage >= 100 && withdrawnPct >= 99.9;

    return {
      index: index + 1,
      contract_number: c.contract_number,
      customer_name: c.customer_name,
      ad_type: c.ad_type || '—',
      start_date: c.start_date ? formatDate(c.start_date) : '—',
      fee_percent: `${c.feePercent.toFixed(c.feePercent % 1 === 0 ? 0 : 2)}%`,
      rent_cost: `${formatArabicNumber(c.rent_cost)} د.ل`,
      installation_print: `${formatArabicNumber(c.installation_cost + c.print_cost)} د.ل`,
      total_amount: `${formatArabicNumber(c.total_amount)} د.ل`,
      total_paid: `${formatArabicNumber(c.total_paid)} د.ل`,
      collection_percent: `${c.collectionPercentage.toFixed(c.collectionPercentage % 1 === 0 ? 0 : 2)}%`,
      full_fee: `${formatArabicNumber(c.fullFeeAmount)} د.ل`,
      collected_fee: `${formatArabicNumber(c.collectedFeeAmount)} د.ل`,
      withdrawn_amount: `${formatArabicNumber(withdrawn)} د.ل`,
      withdrawn_percent: isFullySettled 
        ? '<span style="color: #2563eb; font-weight: bold;">● 100%</span>' 
        : withdrawn > 0 
        ? `<span style="color: #f97316; font-weight: bold;">${withdrawnPct.toFixed(0)}%</span>` 
        : '<span style="color: #94a3b8;">0%</span>',
    };
  });
}

function getWithdrawalsTableColumns(): PrintColumn[] {
  return [
    { key: 'index', header: '#', width: '8%', align: 'center' },
    { key: 'date', header: 'التاريخ', width: '20%', align: 'center' },
    { key: 'amount', header: 'المبلغ', width: '25%', align: 'center' },
    { key: 'method', header: 'طريقة السحب', width: '20%', align: 'center' },
    { key: 'note', header: 'ملاحظات', width: '27%', align: 'right' },
  ];
}

function mapWithdrawalsToTableRows(withdrawals: Withdrawal[]): Record<string, any>[] {
  return withdrawals.map((w, index) => ({
    index: index + 1,
    date: formatDate(w.date),
    amount: `${formatArabicNumber(w.amount)} د.ل`,
    method: w.method || 'نقدي',
    note: w.note || '—',
  }));
}

function getOperatingDuesTotals(
  totals: { poolTotal: number; totalWithdrawn: number; remainingPool: number },
  contractsCount: number,
  hideFinancials: boolean = false,
  hideTotalWithdrawnFromTop: boolean = false
): PrintTotalsItem[] {
  const items: PrintTotalsItem[] = [
    {
      label: 'عدد العقود',
      value: `${contractsCount}`,
      bold: true,
    },
  ];
  if (!hideFinancials) {
    items.push({
      label: 'إجمالي النسب المستحقة',
      value: `${formatArabicNumber(totals.poolTotal)} د.ل`,
      bold: true,
    });
    if (!hideTotalWithdrawnFromTop) {
      items.push({
        label: 'إجمالي المسحوبات',
        value: `${formatArabicNumber(totals.totalWithdrawn)} د.ل`,
        bold: true,
      });
    }
  }
  items.push({
    label: 'الرصيد المتبقي',
    value: `${formatArabicNumber(totals.remainingPool)} د.ل`,
    highlight: true,
    bold: true,
  });
  return items;
}

export function OperatingDuesPrintDialog({
  open,
  onClose,
  contracts,
  withdrawals,
  closures,
  excludedIds,
  totals,
  settledContractIds
}: OperatingDuesPrintDialogProps) {
  const [filterType, setFilterType] = useState<'all' | 'contract_range' | 'date_range'>('all');
  const [contractFrom, setContractFrom] = useState<string>('');
  const [contractTo, setContractTo] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [showDetails, setShowDetails] = useState(false);
  const [hideFinancialDetails, setHideFinancialDetails] = useState(false);
  const [hideTotalWithdrawnFromTop, setHideTotalWithdrawnFromTop] = useState(false);
  const [hideTotalsRow, setHideTotalsRow] = useState(false);
  const [billboardsByContract, setBillboardsByContract] = useState<Record<string, Billboard[]>>({});
  const [loading, setLoading] = useState(false);
  const [periodPaymentContracts, setPeriodPaymentContracts] = useState<Set<string>>(new Set());
  
  const { settings, isLoading: themeLoading } = usePrintTheme(DOCUMENT_TYPES.ACCOUNT_STATEMENT);

  // Load billboards
  useEffect(() => {
    if (open) {
      loadBillboards();
    }
  }, [open]);

  // Load payments within the selected date range to identify active contracts
  useEffect(() => {
    if (filterType === 'date_range' && dateFrom && dateTo) {
      loadPeriodPayments(dateFrom, dateTo);
    } else {
      setPeriodPaymentContracts(new Set());
    }
  }, [filterType, dateFrom, dateTo]);

  const loadPeriodPayments = async (from: string, to: string) => {
    try {
      const { data } = await supabase
        .from('customer_payments')
        .select('contract_number')
        .gte('paid_at', from)
        .lte('paid_at', to)
        .not('contract_number', 'is', null);
      
      if (data) {
        const contractNums = new Set(data.map(p => String(p.contract_number)));
        setPeriodPaymentContracts(contractNums);
      }
    } catch (e) {
      console.error('Error loading period payments:', e);
    }
  };

  const loadBillboards = async () => {
    setLoading(true);
    try {
      const { data } = await supabase
        .from('billboards')
        .select('ID, Billboard_Name, Size, Faces_Count, City, District, Level, Contract_Number, Price');
      
      if (data) {
        const grouped: Record<string, Billboard[]> = {};
        data.forEach((b: any) => {
          if (b.Contract_Number) {
            const key = String(b.Contract_Number);
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(b);
          }
        });
        setBillboardsByContract(grouped);
      }
    } catch (e) {
      console.error('Error loading billboards:', e);
    }
    setLoading(false);
  };

  const contractNumbers = useMemo(() => {
    return contracts
      .map(c => c.contract_number)
      .filter(Boolean)
      .sort((a, b) => {
        const na = parseInt(a), nb = parseInt(b);
        if (!isNaN(na) && !isNaN(nb)) return nb - na;
        return b.localeCompare(a);
      });
  }, [contracts]);

  const isContractClosed = (contract: Contract) => {
    return closures.some(closure => {
      if (closure.closure_type === 'period' && closure.period_start && closure.period_end) {
        const contractDate = new Date(contract.start_date);
        const closureStart = new Date(closure.period_start);
        const closureEnd = new Date(closure.period_end);
        return contractDate >= closureStart && contractDate <= closureEnd;
      } else if (closure.closure_type === 'contract_range' && closure.contract_start && closure.contract_end) {
        const contractNum = contract.contract_number;
        return contractNum >= closure.contract_start && contractNum <= closure.contract_end;
      }
      return false;
    });
  };

  const filteredContracts = useMemo(() => {
    let filtered = contracts.filter(c => !isContractClosed(c) && !excludedIds.has(c.contract_number));
    
    if (filterType === 'contract_range' && contractFrom && contractTo) {
      const from = parseInt(contractFrom);
      const to = parseInt(contractTo);
      filtered = filtered.filter(c => {
        const num = parseInt(c.contract_number);
        return num >= from && num <= to;
      });
    } else if (filterType === 'date_range' && dateFrom && dateTo) {
      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      // Smart filtering: show contracts that:
      // 1. Started before or during the period AND still have remaining balance (not fully paid before the period)
      // 2. OR received payments during the selected period
      filtered = filtered.filter(c => {
        const contractDate = new Date(c.start_date);
        const contractNum = c.contract_number;
        
        // Contract received payments during the period
        const hadPaymentsInPeriod = periodPaymentContracts.has(contractNum);
        
        // Contract started before or during the period and has remaining balance
        const hasRemainingBalance = c.total_paid < c.total_amount;
        const startedBeforeOrDuringPeriod = contractDate <= to;
        
        return (startedBeforeOrDuringPeriod && hasRemainingBalance) || hadPaymentsInPeriod;
      });
    }
    
    return filtered;
  }, [contracts, filterType, contractFrom, contractTo, dateFrom, dateTo, closures, excludedIds, periodPaymentContracts]);

  const filteredWithdrawals = useMemo(() => {
    if (filterType === 'date_range' && dateFrom && dateTo) {
      const from = new Date(dateFrom);
      const to = new Date(dateTo);
      return withdrawals.filter(w => {
        const date = new Date(w.date);
        return date >= from && date <= to;
      });
    }
    return withdrawals;
  }, [withdrawals, filterType, dateFrom, dateTo]);

  // FIFO settlement for filtered contracts
  const filteredSettledIds = useMemo(() => {
    if (settledContractIds && filterType === 'all') return settledContractIds;
    // Recalculate FIFO for filtered view
    const settled = new Set<string>();
    const sorted = [...filteredContracts].sort((a, b) => {
      const na = parseInt(a.contract_number, 10);
      const nb = parseInt(b.contract_number, 10);
      return (Number.isFinite(na) ? na : 0) - (Number.isFinite(nb) ? nb : 0);
    });
    let remaining = filteredWithdrawals.reduce((sum, w) => sum + w.amount, 0);
    for (const c of sorted) {
      if (c.collectedFeeAmount <= 0) continue;
      if (remaining >= c.collectedFeeAmount) {
        remaining -= c.collectedFeeAmount;
        settled.add(c.contract_number);
      } else break;
    }
    return settled;
  }, [filteredContracts, filteredWithdrawals, settledContractIds, filterType]);

  const filteredTotals = useMemo(() => {
    const poolTotal = filteredContracts.reduce((sum, c) => sum + c.collectedFeeAmount, 0);
    const totalWithdrawn = filteredWithdrawals.reduce((sum, w) => sum + w.amount, 0);
    
    return {
      totalContracts: filteredContracts.length,
      poolTotal,
      totalWithdrawn,
      remainingPool: poolTotal - totalWithdrawn,
      settledCount: [...filteredSettledIds].filter(id => filteredContracts.some(c => c.contract_number === id)).length,
    };
  }, [filteredContracts, filteredWithdrawals, filteredSettledIds]);

  const handlePrint = () => {
    if (themeLoading) {
      toast.error('جاري تحميل إعدادات الطباعة...');
      return;
    }

    const filterText = filterType === 'contract_range' && contractFrom && contractTo 
      ? `من عقد ${contractFrom} إلى ${contractTo}`
      : filterType === 'date_range' && dateFrom && dateTo
      ? `من ${new Date(dateFrom).toLocaleDateString('ar-LY')} إلى ${new Date(dateTo).toLocaleDateString('ar-LY')}`
      : 'جميع العقود';

    const periodStart = filterType === 'date_range' && dateFrom 
      ? new Date(dateFrom).toLocaleDateString('ar-LY') 
      : filterType === 'contract_range' && contractFrom
      ? `عقد ${contractFrom}`
      : 'بداية السجل';
    
    const periodEnd = filterType === 'date_range' && dateTo 
      ? new Date(dateTo).toLocaleDateString('ar-LY') 
      : filterType === 'contract_range' && contractTo
      ? `عقد ${contractTo}`
      : 'حتى الآن';

    const config = createMeasurementsConfigFromSettings(settings);
    // Override font sizes for dense table (13-15 columns)
    config.table.header.fontSize = '8px';
    config.table.header.padding = '3px 2px';
    config.table.body.fontSize = '8px';
    config.table.body.padding = '3px 2px';
    config.page.fontSize = '8px';
    const printDate = new Date().toLocaleDateString('ar-LY');
    
    // Extract theme colors for consistent styling
    const headerBg = config.table.header.backgroundColor;
    const headerText = config.table.header.textColor;
    const borderColor = config.table.border.color;
    const bodyText = config.table.body.textColor;
    const evenRowBg = config.table.body.evenRowBackground;
    const oddRowBg = config.table.body.oddRowBackground;
    const totalsBg = config.totals.backgroundColor;
    const totalsText = config.totals.textColor;
    const partyBg = config.partyInfo.backgroundColor;
    const partyBorder = config.partyInfo.borderColor;

    // Document header
    const documentData: PrintDocumentData = {
      title: 'كشف مستحقات التشغيل',
      documentNumber: ``,
      date: printDate,
      additionalInfo: [
        { label: 'الفترة من', value: periodStart },
        { label: 'إلى', value: periodEnd },
      ]
    };

    // Statistics cards
    const statisticsCards = hideTotalsRow
      ? [
          { label: 'الرصيد المتبقي', value: `${formatArabicNumber(filteredTotals.remainingPool)} د.ل`, unit: '' },
        ]
      : hideFinancialDetails 
      ? [
          { label: 'عدد العقود', value: filteredTotals.totalContracts, unit: '' },
          { label: 'الرصيد المتبقي', value: `${formatArabicNumber(filteredTotals.remainingPool)} د.ل`, unit: '' },
        ]
      : hideTotalWithdrawnFromTop
      ? [
          { label: 'عدد العقود', value: filteredTotals.totalContracts, unit: '' },
          { label: 'إجمالي المستحقات', value: `${formatArabicNumber(filteredTotals.poolTotal)} د.ل`, unit: '' },
          { label: 'الرصيد المتبقي', value: `${formatArabicNumber(filteredTotals.remainingPool)} د.ل`, unit: '' },
        ]
      : [
          { label: 'عدد العقود', value: filteredTotals.totalContracts, unit: '' },
          { label: 'إجمالي المستحقات', value: `${formatArabicNumber(filteredTotals.poolTotal)} د.ل`, unit: '' },
          { label: 'المسحوب', value: `${formatArabicNumber(filteredTotals.totalWithdrawn)} د.ل`, unit: '' },
          { label: 'الرصيد المتبقي', value: `${formatArabicNumber(filteredTotals.remainingPool)} د.ل`, unit: '' },
        ];

    // Notes
    const notesText = `ملاحظة: هذه النسبة محسوبة من غير تكاليف الطباعة أو التركيب | العقود المسددة بالمسحوبات: ${filteredTotals.settledCount} من ${filteredTotals.totalContracts}`;

    // Print options for contracts
    const printOptions: MeasurementsHTMLOptions = {
      config,
      documentData,
      columns: getContractsTableColumns(hideFinancialDetails),
      rows: mapContractsToTableRows(filteredContracts, filteredTotals.totalWithdrawn),
      totals: getOperatingDuesTotals(filteredTotals, filteredContracts.length, hideFinancialDetails, hideTotalWithdrawnFromTop),
      totalsTitle: 'ملخص المستحقات',
      notes: notesText,
      statisticsCards,
      partyData: {
        title: 'نطاق الكشف',
        name: filterText,
        company: `فترة الكشف: ${periodStart} — ${periodEnd}`,
      },
      headerSwap: settings.header_swap ?? false,
    };

    // Generate additional sections for withdrawals
    let additionalContent = '';
    
    if (filteredWithdrawals.length > 0 && !hideFinancialDetails) {
      const withdrawalRows = mapWithdrawalsToTableRows(filteredWithdrawals);
      const withdrawalCols = getWithdrawalsTableColumns();
      
      additionalContent = `
        <div style="margin-top: 30px; page-break-before: auto;">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px; padding-bottom: 8px; border-bottom: 2px solid ${headerBg};">
            <span style="font-size: 14px; font-weight: bold; color: ${headerBg};">السحوبات</span>
            <span style="font-size: 12px; color: ${bodyText}; opacity: 0.7; margin-right: auto;">(${filteredWithdrawals.length})</span>
          </div>
          <table class="measurements-table" style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                ${withdrawalCols.map(col => `
                  <th style="width: ${col.width}; text-align: ${col.align};">
                    ${col.header}
                  </th>
                `).join('')}
              </tr>
            </thead>
            <tbody>
              ${withdrawalRows.map((row, idx) => `
                <tr class="${idx % 2 === 0 ? 'even-row' : 'odd-row'}">
                  ${withdrawalCols.map(col => `
                    <td style="text-align: ${col.align};">
                      ${row[col.key]}
                    </td>
                  `).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
    }

    // If showing details, add billboard details
    if (showDetails) {
      const contractsWithBillboards = filteredContracts.filter(c => {
        const bbs = billboardsByContract[c.contract_number];
        return bbs && bbs.length > 0;
      });

      if (contractsWithBillboards.length > 0) {
        additionalContent += `
          <div style="margin-top: 30px; page-break-before: always;">
            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 3px solid ${headerBg};">
              <span style="font-size: 16px; font-weight: bold; color: ${headerBg};">تفاصيل اللوحات لكل عقد</span>
              <span style="font-size: 12px; color: ${bodyText}; opacity: 0.7; margin-right: auto;">(${contractsWithBillboards.length} عقد)</span>
            </div>
            ${contractsWithBillboards.map(c => {
              const billboards = billboardsByContract[c.contract_number] || [];
              
              // Group by level
              const byLevel: Record<string, any[]> = {};
              billboards.forEach((b: any) => {
                const level = b.Level || 'غير محدد';
                if (!byLevel[level]) byLevel[level] = [];
                byLevel[level].push(b);
              });
              
              const totalBillboardRent = billboards.reduce((sum: number, b: any) => sum + (b.Price || 0), 0);
              
              return `
                <div style="background: linear-gradient(135deg, ${partyBg}, #ffffff); padding: 15px; margin-bottom: 20px; border: 1px solid ${borderColor}; border-radius: 8px; border-right: 4px solid ${headerBg};">
                  <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; padding-bottom: 10px; border-bottom: 1px solid ${borderColor};">
                    <div>
                      <span style="font-size: 14px; font-weight: bold; color: ${headerBg};">العقد رقم: ${c.contract_number}</span>
                      <span style="font-size: 12px; color: ${bodyText}; opacity: 0.7; margin-right: 10px;">${c.customer_name}</span>
                    </div>
                    <div style="font-size: 11px; color: ${bodyText};">
                      <span style="background: ${partyBg}; padding: 3px 8px; border-radius: 4px; margin-left: 8px; border: 1px solid ${borderColor};">لوحات: ${billboards.length}</span>
                      <span style="background: ${partyBg}; padding: 3px 8px; border-radius: 4px; margin-left: 8px; border: 1px solid ${borderColor};">الإيجار: ${formatArabicNumber(c.rent_cost)} د.ل</span>
                      <span style="background: ${partyBg}; padding: 3px 8px; border-radius: 4px; border: 1px solid ${borderColor};">المستحق: ${formatArabicNumber(c.collectedFeeAmount)} د.ل</span>
                    </div>
                  </div>
                  <table class="measurements-table" style="width: 100%; border-collapse: collapse; font-size: 10px;">
                    <thead>
                      <tr>
                        <th>المستوى</th>
                        <th>عدد اللوحات</th>
                        <th>إيجار اللوحات</th>
                        <th>النسبة (${c.feePercent}%)</th>
                        <th>النسبة المتحصلة (${c.collectionPercentage.toFixed(0)}%)</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${Object.entries(byLevel).map(([level, bbs], idx) => {
                        const levelRent = bbs.reduce((sum: number, b: any) => sum + (b.Price || 0), 0);
                        const fullLevelFee = levelRent * (c.feePercent / 100);
                        const collectedLevelFee = fullLevelFee * (c.collectionPercentage / 100);
                        return `
                          <tr class="${idx % 2 === 0 ? 'even-row' : 'odd-row'}">
                            <td style="text-align: center; font-weight: 500;">${level}</td>
                            <td style="text-align: center;">${bbs.length}</td>
                            <td style="text-align: center;">${formatArabicNumber(levelRent)} د.ل</td>
                            <td style="text-align: center;">${formatArabicNumber(fullLevelFee)} د.ل</td>
                            <td style="text-align: center; font-weight: bold; color: #059669;">${formatArabicNumber(collectedLevelFee)} د.ل</td>
                          </tr>
                        `;
                      }).join('')}
                      <tr class="subtotal-row">
                        <td style="text-align: center;">الإجمالي</td>
                        <td style="text-align: center;">${billboards.length}</td>
                        <td style="text-align: center;">${formatArabicNumber(totalBillboardRent)} د.ل</td>
                        <td style="text-align: center;">${formatArabicNumber(c.fullFeeAmount)} د.ل</td>
                        <td style="text-align: center; color: #059669;">${formatArabicNumber(c.collectedFeeAmount)} د.ل</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              `;
            }).join('')}
          </div>
        `;
      } else {
        additionalContent += `
          <div style="margin-top: 30px; padding: 20px; background: ${partyBg}; border: 1px solid ${borderColor}; border-radius: 8px; text-align: center;">
            <span style="color: ${bodyText}; font-size: 12px;">لا توجد لوحات مرتبطة بالعقود المحددة</span>
          </div>
        `;
      }
    }

    // Open print window with additional content
    openMeasurementsPrintWindow(
      { ...printOptions, additionalContent },
      `كشف مستحقات التشغيل - ${filterText}`,
      'billing-dues'
    );
    toast.success('تم فتح الكشف للطباعة بنجاح!');
  };

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[95vh] p-0">
        <DialogHeader className="px-4 py-3 border-b bg-gradient-to-l from-primary/5 to-background">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="p-1.5 rounded-md bg-primary/10">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div>
                <DialogTitle className="text-sm font-semibold">كشف مستحقات التشغيل</DialogTitle>
                <p className="text-xs text-muted-foreground">{filteredTotals.totalContracts} عقد</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              <Button onClick={handlePrint} disabled={loading || themeLoading} size="sm" className="gap-1.5 h-8 text-xs">
                <Printer className="h-3.5 w-3.5" />
                {loading || themeLoading ? 'تحميل...' : 'طباعة'}
              </Button>
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={onClose}>
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 max-h-[calc(95vh-60px)]">
          <div className="p-4 space-y-3">
            {/* Note */}
            <div className="flex items-center gap-1.5 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-md px-2.5 py-2">
              <AlertTriangle className="h-3 w-3 text-amber-600 dark:text-amber-400 shrink-0" />
              <p className="text-xs text-amber-800 dark:text-amber-200">
                هذه النسبة محسوبة من غير تكاليف الطباعة أو التركيب
              </p>
            </div>

            {/* Filter Options */}
            <div className="space-y-2 p-3 bg-muted/30 rounded-md border">
              <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Filter className="h-3 w-3" />
                <span>خيارات التصفية</span>
              </div>
              
              <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue placeholder="نوع التصفية" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">جميع العقود (من 1086)</SelectItem>
                  <SelectItem value="contract_range">نطاق أرقام العقود</SelectItem>
                  <SelectItem value="date_range">نطاق التواريخ</SelectItem>
                </SelectContent>
              </Select>

              {filterType === 'contract_range' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-0.5 block">من عقد</label>
                    <Select value={contractFrom} onValueChange={setContractFrom}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="اختر" />
                      </SelectTrigger>
                      <SelectContent>
                        {contractNumbers.map(num => (
                          <SelectItem key={num} value={num}>{num}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-0.5 block">إلى عقد</label>
                    <Select value={contractTo} onValueChange={setContractTo}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="اختر" />
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

              {filterType === 'date_range' && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-xs text-muted-foreground mb-0.5 block">من تاريخ</label>
                    <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-xs" />
                  </div>
                  <div>
                    <label className="text-xs text-muted-foreground mb-0.5 block">إلى تاريخ</label>
                    <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-xs" />
                  </div>
                </div>
              )}
            </div>

            {/* Summary Stats - compact */}
            <div className={`grid gap-2 ${hideFinancialDetails ? 'grid-cols-2' : hideTotalWithdrawnFromTop ? 'grid-cols-3' : 'grid-cols-2 md:grid-cols-4'}`}>
              <div className="bg-muted/50 rounded-md p-2 text-center border">
                <Hash className="h-3 w-3 mx-auto mb-0.5 text-muted-foreground" />
                <div className="text-[10px] text-muted-foreground">عدد العقود</div>
                <div className="text-sm font-bold">{filteredTotals.totalContracts}</div>
              </div>
              {!hideFinancialDetails && (
                <div className="bg-emerald-50 dark:bg-emerald-950/30 rounded-md p-2 text-center border border-emerald-200 dark:border-emerald-800">
                  <BarChart3 className="h-3 w-3 mx-auto mb-0.5 text-emerald-600 dark:text-emerald-400" />
                  <div className="text-[10px] text-muted-foreground">المجموع العام</div>
                  <div className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{filteredTotals.poolTotal.toLocaleString()} د.ل</div>
                </div>
              )}
              {!hideFinancialDetails && !hideTotalWithdrawnFromTop && (
                <div className="bg-red-50 dark:bg-red-950/30 rounded-md p-2 text-center border border-red-200 dark:border-red-800">
                  <TrendingDown className="h-3 w-3 mx-auto mb-0.5 text-red-600 dark:text-red-400" />
                  <div className="text-[10px] text-muted-foreground">المسحوب</div>
                  <div className="text-sm font-bold text-red-600 dark:text-red-400">{filteredTotals.totalWithdrawn.toLocaleString()} د.ل</div>
                </div>
              )}
              <div className="bg-blue-50 dark:bg-blue-950/30 rounded-md p-2 text-center border border-blue-200 dark:border-blue-800">
                <Wallet className="h-3 w-3 mx-auto mb-0.5 text-blue-600 dark:text-blue-400" />
                <div className="text-[10px] text-muted-foreground">الرصيد المتبقي</div>
                <div className="text-sm font-bold text-blue-600 dark:text-blue-400">{filteredTotals.remainingPool.toLocaleString()} د.ل</div>
              </div>
            </div>

            {/* Toggle Buttons - compact grid */}
            <div className="grid grid-cols-3 gap-1.5">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowDetails(!showDetails)}
                className="gap-1 h-7 text-[11px] px-2"
              >
                <Layers className="h-3 w-3" />
                {showDetails ? 'إخفاء اللوحات' : 'تفاصيل اللوحات'}
              </Button>
              <Button
                variant={hideFinancialDetails ? "default" : "outline"}
                size="sm"
                onClick={() => setHideFinancialDetails(!hideFinancialDetails)}
                className="gap-1 h-7 text-[11px] px-2"
              >
                {hideFinancialDetails ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                {hideFinancialDetails ? 'إظهار المسحوبات' : 'إخفاء المسحوبات'}
              </Button>
              <Button
                variant={hideTotalWithdrawnFromTop ? "default" : "outline"}
                size="sm"
                onClick={() => setHideTotalWithdrawnFromTop(!hideTotalWithdrawnFromTop)}
                className="gap-1 h-7 text-[11px] px-2"
                disabled={hideFinancialDetails}
              >
                {hideTotalWithdrawnFromTop ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                {hideTotalWithdrawnFromTop ? 'إظهار الإجمالي' : 'إخفاء الإجمالي'}
              </Button>
              <Button
                variant={hideTotalsRow ? "default" : "outline"}
                size="sm"
                onClick={() => setHideTotalsRow(!hideTotalsRow)}
                className="gap-1 h-7 text-[11px] px-2"
              >
                {hideTotalsRow ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                {hideTotalsRow ? 'إظهار المجموع العام' : 'إخفاء المجموع العام'}
              </Button>
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
