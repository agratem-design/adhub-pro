import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Printer, X, Filter } from 'lucide-react';
import { useRef, useState, useMemo } from 'react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { formatAmount } from '@/lib/formatUtils';
import { preparePrintWindow, writePrintWindow } from '@/utils/printWindowHelper';

interface Contract {
  id: string;
  contract_number: string;
  customer_name: string;
  feePercent: number;
  feeAmount: number;
  fullFeeAmount: number;
  collectedFeeAmount: number;
  rent_cost: number;
  installation_cost: number;
  print_cost: number;
  total_amount: number;
  total_paid: number;
  collectionPercentage: number;
  start_date: string;
  status: string;
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

interface ExpensesPrintDialogProps {
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
}

export function ExpensesPrintDialog({
  open,
  onClose,
  contracts,
  withdrawals,
  closures,
  excludedIds,
  totals
}: ExpensesPrintDialogProps) {
  const printRef = useRef<HTMLDivElement>(null);
  
  // Filter states
  const [filterType, setFilterType] = useState<'all' | 'contract_range' | 'date_range'>('all');
  const [contractFrom, setContractFrom] = useState<string>('');
  const [contractTo, setContractTo] = useState<string>('');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [hideFinancialDetails, setHideFinancialDetails] = useState(false);
  // Get contract numbers sorted
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

  // Check if contract is closed
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

  // Filter contracts based on selection
  const filteredContracts = useMemo(() => {
    if (filterType === 'all') return contracts;
    
    return contracts.filter(contract => {
      if (filterType === 'contract_range' && contractFrom && contractTo) {
        const contractNum = contract.contract_number;
        return contractNum >= contractFrom && contractNum <= contractTo;
      } else if (filterType === 'date_range' && dateFrom && dateTo) {
        const contractDate = new Date(contract.start_date);
        const from = new Date(dateFrom);
        const to = new Date(dateTo);
        return contractDate >= from && contractDate <= to;
      }
      return true;
    });
  }, [contracts, filterType, contractFrom, contractTo, dateFrom, dateTo]);

  // Calculate filtered totals
  const filteredTotals = useMemo(() => {
    const activeContracts = filteredContracts.filter(contract => {
      return !isContractClosed(contract) && !excludedIds.has(contract.contract_number);
    });

    const poolTotal = activeContracts.reduce((sum, c) => sum + c.collectedFeeAmount, 0);
    
    // When filtering, use global totals for withdrawn/remaining since withdrawals aren't per-contract
    const isFiltered = filterType !== 'all';
    const totalWithdrawn = isFiltered ? totals.totalWithdrawn : totals.totalWithdrawn;
    const remainingPool = isFiltered 
      ? totals.remainingPool  // Always show global remaining when filtered
      : poolTotal - totals.totalWithdrawn;
    
    return {
      totalContracts: filteredContracts.length,
      activeContracts: activeContracts.length,
      poolTotal: isFiltered ? totals.poolTotal : poolTotal,
      totalWithdrawn,
      remainingPool
    };
  }, [filteredContracts, closures, excludedIds, totals, filterType]);

  const handlePrint = () => {
    if (!printRef.current) return;

    const filterText = filterType === 'contract_range' && contractFrom && contractTo 
      ? `من عقد ${contractFrom} إلى ${contractTo}`
      : filterType === 'date_range' && dateFrom && dateTo
      ? `من ${new Date(dateFrom).toLocaleDateString('ar-LY')} إلى ${new Date(dateTo).toLocaleDateString('ar-LY')}`
      : 'جميع العقود';
    const docTitle = `كشف مستحقات التشغيل - ${filterText}`;
    const printWindow = preparePrintWindow(docTitle);

    const fullHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${docTitle}</title>
        <style>
          @page { size: A4 landscape; margin: 15mm; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; direction: rtl; font-size: 11px; background: white; }
          .container { max-width: 100%; margin: 0 auto; padding: 15px; background: white; }
          .header { text-align: center; margin-bottom: 20px; border-bottom: 3px solid #2563eb; padding-bottom: 15px; }
          .header h1 { font-size: 24px; color: #1e40af; margin-bottom: 8px; }
          .header p { color: #64748b; font-size: 13px; }
          .stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; margin-bottom: 20px; }
          .stat-card { background: #f8fafc; padding: 12px; border-radius: 8px; text-align: center; border: 1px solid #e2e8f0; }
          .stat-label { font-size: 11px; color: #64748b; margin-bottom: 5px; }
          .stat-value { font-size: 18px; font-weight: bold; color: #1e40af; }
          .section { margin: 20px 0; }
          .section-title { font-size: 16px; font-weight: bold; color: #1e40af; margin-bottom: 12px; border-bottom: 2px solid #2563eb; padding-bottom: 6px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
          th, td { border: 1px solid #e2e8f0; padding: 6px 8px; text-align: right; }
          th { background: #f1f5f9; font-weight: 600; color: #475569; font-size: 11px; }
          td { font-size: 10px; }
          .badge { display: inline-block; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 500; }
          .badge-success { background: #dcfce7; color: #166534; }
          .badge-warning { background: #fef9c3; color: #854d0e; }
          .badge-danger { background: #fee2e2; color: #991b1b; }
          .badge-secondary { background: #f1f5f9; color: #475569; }
          .amount-positive { color: #16a34a; font-weight: 600; }
          .amount-negative { color: #dc2626; font-weight: 600; }
          .amount-excluded { color: #94a3b8; text-decoration: line-through; }
          .footer { margin-top: 30px; text-align: center; padding-top: 15px; border-top: 2px solid #e2e8f0; color: #64748b; font-size: 10px; }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
            .no-print { display: none !important; }
            .page-break { page-break-before: always; }
          }
        </style>
      </head>
      <body>
        ${printRef.current.innerHTML}
      </body>
      </html>
    `;

    writePrintWindow(printWindow, fullHtml, {
      title: docTitle,
      landscape: true,
      showDownloadPdf: true,
      showShare: true,
      autoPrint: true,
    });
  };

  return (
    <Dialog open={open} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        {/* Filter Section */}
        <div className="space-y-4 mb-4 p-4 bg-accent/5 rounded-lg no-print">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4" />
            <h3 className="font-semibold">تصفية الكشف</h3>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Select value={filterType} onValueChange={(v: any) => setFilterType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">جميع العقود (من 1086)</SelectItem>
                <SelectItem value="contract_range">نطاق أرقام العقود</SelectItem>
                <SelectItem value="date_range">نطاق التواريخ</SelectItem>
              </SelectContent>
            </Select>

            {filterType === 'contract_range' && (
              <>
                <Select value={contractFrom} onValueChange={setContractFrom}>
                  <SelectTrigger>
                    <SelectValue placeholder="من عقد" />
                  </SelectTrigger>
                  <SelectContent>
                    {contractNumbers.map(num => (
                      <SelectItem key={num} value={num}>{num}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={contractTo} onValueChange={setContractTo}>
                  <SelectTrigger>
                    <SelectValue placeholder="إلى عقد" />
                  </SelectTrigger>
                  <SelectContent>
                    {contractNumbers.map(num => (
                      <SelectItem key={num} value={num}>{num}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </>
            )}

            {filterType === 'date_range' && (
              <>
                <Input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  placeholder="من تاريخ"
                />
                <Input
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  placeholder="إلى تاريخ"
                />
              </>
            )}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex justify-end gap-2 mb-4 no-print">
          <Button
            variant={hideFinancialDetails ? "default" : "outline"}
            onClick={() => setHideFinancialDetails(!hideFinancialDetails)}
            className="gap-2"
          >
            {hideFinancialDetails ? 'إظهار التفاصيل المالية' : 'إخفاء المسحوبات والمستحقات'}
          </Button>
          <Button onClick={handlePrint} className="gap-2">
            <Printer className="h-4 w-4" />
            طباعة الكشف
          </Button>
          <Button variant="outline" onClick={onClose}>
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Print Content */}
        <div ref={printRef} className="space-y-4" dir="rtl">
          {/* Header */}
          <div className="header">
            <h1>كشف مستحقات التشغيل</h1>
            <p>تاريخ الطباعة: {format(new Date(), 'PPP', { locale: ar })}</p>
            {filterType === 'contract_range' && contractFrom && contractTo && (
              <p>من عقد {contractFrom} إلى {contractTo}</p>
            )}
            {filterType === 'date_range' && dateFrom && dateTo && (
              <p>من {new Date(dateFrom).toLocaleDateString('ar-LY')} إلى {new Date(dateTo).toLocaleDateString('ar-LY')}</p>
            )}
          </div>

          {/* Statistics */}
          <div className="stats-grid" style={{ gridTemplateColumns: hideFinancialDetails ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)' }}>
            <div className="stat-card">
              <div className="stat-label">إجمالي العقود</div>
              <div className="stat-value">{filteredTotals.totalContracts}</div>
            </div>
            {!hideFinancialDetails && (
              <div className="stat-card">
                <div className="stat-label">المجموع العام</div>
                <div className="stat-value amount-positive">{filteredTotals.poolTotal.toLocaleString()} د.ل</div>
              </div>
            )}
            {!hideFinancialDetails && (
              <div className="stat-card">
                <div className="stat-label">المسحوب</div>
                <div className="stat-value amount-negative">{filteredTotals.totalWithdrawn.toLocaleString()} د.ل</div>
              </div>
            )}
            <div className="stat-card">
              <div className="stat-label">الرصيد المتبقي</div>
              <div className="stat-value">{filteredTotals.remainingPool.toLocaleString()} د.ل</div>
            </div>
          </div>

          {/* Active Contracts Table */}
          <div className="section">
            <h2 className="section-title">العقود النشطة ({filteredTotals.activeContracts})</h2>
            <table>
              <thead>
                <tr>
                  <th>رقم العقد</th>
                  <th>اسم العميل</th>
                  <th>التاريخ</th>
                  <th>النسبة %</th>
                  <th>الإجمالي</th>
                  <th>المدفوع</th>
                  <th>التحصيل %</th>
                  <th>النسبة المتحصلة</th>
                  <th>الحالة</th>
                </tr>
              </thead>
              <tbody>
                {filteredContracts.map(contract => {
                  const isClosed = isContractClosed(contract);
                  const excluded = excludedIds.has(contract.contract_number);
                  
                  if (isClosed || excluded) return null;

                  return (
                    <tr key={contract.contract_number}>
                      <td>{contract.contract_number}</td>
                      <td>{contract.customer_name}</td>
                      <td>{contract.start_date ? new Date(contract.start_date).toLocaleDateString('ar-LY') : '—'}</td>
                      <td>
                        <span className="badge badge-secondary">
                          {contract.feePercent.toFixed(contract.feePercent % 1 === 0 ? 0 : 2)}%
                        </span>
                      </td>
                      <td>{formatAmount(contract.total_amount)} د.ل</td>
                      <td className="amount-positive">{formatAmount(contract.total_paid)} د.ل</td>
                      <td>
                        <span className={`badge ${
                          contract.collectionPercentage >= 100 ? 'badge-success' : 
                          contract.collectionPercentage >= 50 ? 'badge-warning' : 'badge-danger'
                        }`}>
                          {contract.collectionPercentage.toFixed(contract.collectionPercentage % 1 === 0 ? 0 : 2)}%
                        </span>
                      </td>
                      <td className="amount-positive">{formatAmount(contract.collectedFeeAmount)} د.ل</td>
                      <td><span className="badge badge-success">ضمن الحسبة</span></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Withdrawals Table */}
          {withdrawals.length > 0 && !hideFinancialDetails && (
            <div className="section">
              <h2 className="section-title">سجل السحوبات ({withdrawals.length})</h2>
              <table>
                <thead>
                  <tr>
                    <th>التاريخ</th>
                    <th>المبلغ</th>
                    <th>الطريقة</th>
                    <th>البيان</th>
                  </tr>
                </thead>
                <tbody>
                  {withdrawals.map(w => (
                    <tr key={w.id}>
                      <td>{new Date(w.date).toLocaleDateString('ar-LY')}</td>
                      <td className="amount-negative">{formatAmount(w.amount)} د.ل</td>
                      <td>{w.method || '—'}</td>
                      <td>{w.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Closures Table */}
          {closures.length > 0 && (
            <div className="section page-break">
              <h2 className="section-title">سجل التسكيرات ({closures.length})</h2>
              <table>
                <thead>
                  <tr>
                    <th>تاريخ التسكير</th>
                    <th>النوع</th>
                    <th>النطاق</th>
                    <th>عدد العقود</th>
                    <th>المبلغ</th>
                    <th>المسحوب</th>
                    <th>المتبقي</th>
                    <th>الملاحظات</th>
                  </tr>
                </thead>
                <tbody>
                  {closures.map(closure => (
                    <tr key={closure.id}>
                      <td>{new Date(closure.closure_date).toLocaleDateString('ar-LY')}</td>
                      <td>
                        <span className={`badge ${closure.closure_type === 'period' ? 'badge-success' : 'badge-secondary'}`}>
                          {closure.closure_type === 'period' ? 'فترة' : 'نطاق'}
                        </span>
                      </td>
                      <td>
                        {closure.closure_type === 'period' && closure.period_start && closure.period_end
                          ? `${new Date(closure.period_start).toLocaleDateString('ar-LY')} - ${new Date(closure.period_end).toLocaleDateString('ar-LY')}`
                          : closure.closure_type === 'contract_range' && closure.contract_start && closure.contract_end
                          ? `${closure.contract_start} - ${closure.contract_end}`
                          : '—'}
                      </td>
                      <td>{closure.total_contracts}</td>
                      <td>{formatAmount(closure.total_amount)} د.ل</td>
                      <td>{formatAmount(closure.total_withdrawn)} د.ل</td>
                      <td>{formatAmount(closure.remaining_balance)} د.ل</td>
                      <td>{closure.notes || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div className="footer">
            <p>نظام إدارة اللوحات الإعلانية - مستحقات التشغيل</p>
            <p>تم الطباعة في: {format(new Date(), 'PPP p', { locale: ar })}</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
