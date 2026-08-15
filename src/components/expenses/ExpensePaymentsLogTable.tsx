import { useMemo, useState } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Receipt, ExternalLink, User } from 'lucide-react';
import { format } from 'date-fns';
import { useExpensePaymentsLog } from '@/hooks/useExpensePaymentsLog';

interface Props {
  employees: { id: string; name: string }[];
  refreshKey?: number;
}

export function ExpensePaymentsLogTable({ employees, refreshKey = 0 }: Props) {
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [employeeId, setEmployeeId] = useState('all');
  const [source, setSource] = useState<'all' | 'customer_payment' | 'direct' | 'custody'>('all');

  const { rows, loading } = useExpensePaymentsLog(
    { dateFrom, dateTo, employeeId, source },
    refreshKey
  );

  const totals = useMemo(() => {
    const total = rows.reduce((s, r) => s + r.amount, 0);
    const fromCustomers = rows.filter(r => r.customer_id).reduce((s, r) => s + r.amount, 0);
    const direct = total - fromCustomers;
    return { total, fromCustomers, direct, count: rows.length };
  }, [rows]);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
          <div className="text-xs text-muted-foreground">عدد التسديدات</div>
          <div className="text-xl font-bold text-primary">{totals.count}</div>
        </div>
        <div className="p-3 rounded-lg bg-green-500/5 border border-green-500/20">
          <div className="text-xs text-muted-foreground">إجمالي المسدد</div>
          <div className="text-xl font-bold text-green-600">{totals.total.toLocaleString('en-US')} د.ل</div>
        </div>
        <div className="p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
          <div className="text-xs text-muted-foreground">من دفعات الزبائن</div>
          <div className="text-xl font-bold text-blue-600">{totals.fromCustomers.toLocaleString('en-US')} د.ل</div>
        </div>
        <div className="p-3 rounded-lg bg-orange-500/5 border border-orange-500/20">
          <div className="text-xs text-muted-foreground">سداد مباشر / عهدة</div>
          <div className="text-xl font-bold text-orange-600">{totals.direct.toLocaleString('en-US')} د.ل</div>
        </div>
      </div>

      {/* Filters */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-3 bg-muted/50 rounded-lg">
        <div>
          <Label className="text-xs">من تاريخ</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">إلى تاريخ</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-8 text-sm" />
        </div>
        <div>
          <Label className="text-xs">الموظف</Label>
          <Select value={employeeId} onValueChange={setEmployeeId}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">المصدر</Label>
          <Select value={source} onValueChange={(v) => setSource(v as any)}>
            <SelectTrigger className="h-8 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="customer_payment">من دفعة زبون</SelectItem>
              <SelectItem value="custody">من عهدة موظف</SelectItem>
              <SelectItem value="direct">سداد مباشر</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : (
        <Table dir="rtl">
          <TableHeader>
            <TableRow>
              <TableHead className="text-right">التاريخ</TableHead>
              <TableHead className="text-right">المصروف</TableHead>
              <TableHead className="text-right">الموظف</TableHead>
              <TableHead className="text-right">المبلغ</TableHead>
              <TableHead className="text-right">الوسيلة</TableHead>
              <TableHead className="text-right">مصدر الدفعة</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {rows.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">لا توجد تسديدات</TableCell></TableRow>
            ) : rows.map(r => (
              <TableRow key={r.id}>
                <TableCell className="text-xs">{r.paid_at ? format(new Date(r.paid_at), 'dd/MM/yyyy HH:mm') : '-'}</TableCell>
                <TableCell>
                  <div className="text-sm font-medium truncate max-w-xs">{r.expense_description || '-'}</div>
                  {r.expense_category && <Badge variant="outline" className="text-[10px] mt-0.5">{r.expense_category}</Badge>}
                </TableCell>
                <TableCell className="text-sm">{r.employee_name || '-'}</TableCell>
                <TableCell className="font-bold">{r.amount.toLocaleString('en-US')} د.ل</TableCell>
                <TableCell className="text-xs">{r.paid_via || r.payment_source || '-'}</TableCell>
                <TableCell>
                  {r.customer_id ? (
                    <div className="flex items-center gap-1.5 text-xs">
                      <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 gap-1">
                        <Receipt className="h-3 w-3" />
                        دفعة زبون
                      </Badge>
                      <div className="flex flex-col">
                        <span className="font-semibold flex items-center gap-1"><User className="h-3 w-3" />{r.customer_name}</span>
                        {r.customer_payment_amount != null && (
                          <span className="text-muted-foreground text-[10px]">دفعة: {r.customer_payment_amount.toLocaleString('en-US')} د.ل</span>
                        )}
                      </div>
                    </div>
                  ) : (r.payment_source || '').includes('custody') || (r.paid_via || '').includes('عهدة') ? (
                    <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">عهدة موظف</Badge>
                  ) : (
                    <Badge variant="outline">سداد مباشر</Badge>
                  )}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </div>
  );
}