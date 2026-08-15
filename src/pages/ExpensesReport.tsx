// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Progress } from '@/components/ui/progress';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Printer, Download, ChevronDown, ChevronLeft, FileText } from 'lucide-react';

interface ExpenseRow {
  id: string;
  description: string;
  amount: number;
  paid_amount: number;
  category: string;
  expense_date: string;
  payment_status: string;
  employee_id?: string;
  employee_name?: string;
  payment_source?: string;
  paid_via?: string;
}

interface PaymentRow {
  id: string;
  expense_id: string;
  amount: number;
  paid_at: string;
  paid_via: string;
  payment_source?: string;
  distributed_payment_id?: string;
  notes?: string;
}

export default function ExpensesReport() {
  const [loading, setLoading] = useState(false);
  const [expenses, setExpenses] = useState<ExpenseRow[]>([]);
  const [payments, setPayments] = useState<Record<string, PaymentRow[]>>({});
  const [employees, setEmployees] = useState<Array<{ id: string; name: string }>>([]);
  const [filterEmployee, setFilterEmployee] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [from, setFrom] = useState<string>('');
  const [to, setTo] = useState<string>('');
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    try {
      const [{ data: exps }, { data: emps }] = await Promise.all([
        supabase.from('expenses').select('id, description, amount, paid_amount, category, expense_date, payment_status, employee_id, payment_source, paid_via').order('expense_date', { ascending: false }),
        supabase.from('employees').select('id, name'),
      ]);
      const empMap = Object.fromEntries((emps || []).map((e: any) => [e.id, e.name]));
      setEmployees((emps as any) || []);
      setExpenses(((exps as any) || []).map((e: any) => ({ ...e, employee_name: e.employee_id ? empMap[e.employee_id] : undefined })));

      const ids = (exps || []).map((e: any) => e.id);
      if (ids.length) {
        const { data: pays } = await supabase.from('expense_payments').select('*').in('expense_id', ids).order('paid_at', { ascending: false });
        const grouped: Record<string, PaymentRow[]> = {};
        (pays || []).forEach((p: any) => {
          if (!grouped[p.expense_id]) grouped[p.expense_id] = [];
          grouped[p.expense_id].push(p);
        });
        setPayments(grouped);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const categories = useMemo(() => Array.from(new Set(expenses.map(e => e.category).filter(Boolean))), [expenses]);

  const filtered = useMemo(() => expenses.filter(e => {
    if (filterEmployee !== 'all' && e.employee_id !== filterEmployee) return false;
    if (filterStatus !== 'all' && e.payment_status !== filterStatus) return false;
    if (filterCategory !== 'all' && e.category !== filterCategory) return false;
    if (from && e.expense_date < from) return false;
    if (to && e.expense_date > to) return false;
    return true;
  }), [expenses, filterEmployee, filterStatus, filterCategory, from, to]);

  const totals = useMemo(() => {
    const total = filtered.reduce((s, e) => s + Number(e.amount || 0), 0);
    const paid = filtered.reduce((s, e) => s + Number(e.paid_amount || 0), 0);
    const remaining = total - paid;
    return { total, paid, remaining };
  }, [filtered]);

  const byEmployee = useMemo(() => {
    const map: Record<string, { name: string; total: number; paid: number; remaining: number }> = {};
    filtered.forEach(e => {
      const k = e.employee_id || '_none_';
      const name = e.employee_name || 'بدون موظف';
      if (!map[k]) map[k] = { name, total: 0, paid: 0, remaining: 0 };
      map[k].total += Number(e.amount || 0);
      map[k].paid += Number(e.paid_amount || 0);
      map[k].remaining += Math.max(0, Number(e.amount || 0) - Number(e.paid_amount || 0));
    });
    return Object.values(map).sort((a, b) => b.remaining - a.remaining);
  }, [filtered]);

  const statusBadge = (s: string) => {
    if (s === 'paid') return <Badge className="bg-green-600 text-white">مسدد</Badge>;
    if (s === 'partial') return <Badge className="bg-amber-500 text-white">جزئي</Badge>;
    return <Badge variant="destructive">غير مسدد</Badge>;
  };

  const exportCSV = () => {
    const headers = ['التاريخ', 'الوصف', 'الموظف', 'الفئة', 'القيمة', 'المسدد', 'المتبقي', 'الحالة', 'مصدر الأموال'];
    const rows = filtered.map(e => [
      e.expense_date,
      e.description,
      e.employee_name || '',
      e.category || '',
      e.amount,
      e.paid_amount || 0,
      Math.max(0, e.amount - (e.paid_amount || 0)),
      e.payment_status,
      e.payment_source || '',
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `كشف_المصروفات_${new Date().toISOString().split('T')[0]}.csv`;
    a.click(); URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4 p-4" dir="rtl">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-primary" />
            كشف المصروفات
          </CardTitle>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => window.print()}><Printer className="h-4 w-4 ml-1" /> طباعة</Button>
            <Button variant="outline" size="sm" onClick={exportCSV}><Download className="h-4 w-4 ml-1" /> CSV</Button>
            <Button variant="outline" size="sm" onClick={load}>تحديث</Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filters */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            <div>
              <Label className="text-xs">الموظف</Label>
              <Select value={filterEmployee} onValueChange={setFilterEmployee}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {employees.map(e => <SelectItem key={e.id} value={e.id}>{e.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">الحالة</Label>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  <SelectItem value="paid">مسدد</SelectItem>
                  <SelectItem value="partial">جزئي</SelectItem>
                  <SelectItem value="unpaid">غير مسدد</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">الفئة</Label>
              <Select value={filterCategory} onValueChange={setFilterCategory}>
                <SelectTrigger className="h-8"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">الكل</SelectItem>
                  {categories.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-xs">من تاريخ</Label>
              <Input type="date" className="h-8" value={from} onChange={(e) => setFrom(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">إلى تاريخ</Label>
              <Input type="date" className="h-8" value={to} onChange={(e) => setTo(e.target.value)} />
            </div>
          </div>

          {/* Totals */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card><CardContent className="p-3"><div className="text-xs text-muted-foreground">إجمالي المصروفات</div><div className="text-xl font-bold">{totals.total.toLocaleString('ar-LY')} د.ل</div></CardContent></Card>
            <Card className="border-green-500/30"><CardContent className="p-3"><div className="text-xs text-muted-foreground">المسدد</div><div className="text-xl font-bold text-green-600">{totals.paid.toLocaleString('ar-LY')} د.ل</div></CardContent></Card>
            <Card className="border-destructive/30"><CardContent className="p-3"><div className="text-xs text-muted-foreground">المتبقي</div><div className="text-xl font-bold text-destructive">{totals.remaining.toLocaleString('ar-LY')} د.ل</div></CardContent></Card>
          </div>

          {/* By employee */}
          {byEmployee.length > 0 && (
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">ديون الموظفين (المتبقي لهم)</CardTitle></CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الموظف</TableHead>
                      <TableHead>الإجمالي</TableHead>
                      <TableHead>المسدد</TableHead>
                      <TableHead>المتبقي</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {byEmployee.map((b, i) => (
                      <TableRow key={i}>
                        <TableCell>{b.name}</TableCell>
                        <TableCell>{b.total.toLocaleString('ar-LY')}</TableCell>
                        <TableCell className="text-green-600">{b.paid.toLocaleString('ar-LY')}</TableCell>
                        <TableCell className="font-bold text-destructive">{b.remaining.toLocaleString('ar-LY')}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          {/* Detailed table */}
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-8"></TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الوصف</TableHead>
                    <TableHead>الموظف</TableHead>
                    <TableHead>الفئة</TableHead>
                    <TableHead>القيمة</TableHead>
                    <TableHead>المسدد</TableHead>
                    <TableHead>المتبقي</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>مصدر الأموال</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map(e => {
                    const remaining = Math.max(0, Number(e.amount) - Number(e.paid_amount || 0));
                    const pct = Number(e.amount) > 0 ? (Number(e.paid_amount || 0) / Number(e.amount)) * 100 : 0;
                    const isOpen = !!expanded[e.id];
                    const exPays = payments[e.id] || [];
                    return (
                      <>
                        <TableRow key={e.id} className="cursor-pointer" onClick={() => setExpanded({ ...expanded, [e.id]: !isOpen })}>
                          <TableCell>{exPays.length > 0 && (isOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />)}</TableCell>
                          <TableCell className="text-xs">{e.expense_date}</TableCell>
                          <TableCell className="text-xs">{e.description}</TableCell>
                          <TableCell className="text-xs">{e.employee_name || '-'}</TableCell>
                          <TableCell className="text-xs">{e.category}</TableCell>
                          <TableCell className="text-xs font-bold">{Number(e.amount).toLocaleString('ar-LY')}</TableCell>
                          <TableCell className="text-xs text-green-600">{Number(e.paid_amount || 0).toLocaleString('ar-LY')}</TableCell>
                          <TableCell className="text-xs text-destructive font-bold">{remaining.toLocaleString('ar-LY')}</TableCell>
                          <TableCell>
                            <div className="space-y-1">
                              {statusBadge(e.payment_status)}
                              <Progress value={pct} className="h-1" />
                            </div>
                          </TableCell>
                          <TableCell className="text-xs">{e.payment_source || '-'}</TableCell>
                        </TableRow>
                        {isOpen && exPays.length > 0 && (
                          <TableRow>
                            <TableCell colSpan={10} className="bg-muted/20">
                              <div className="text-xs space-y-1 p-2">
                                <div className="font-bold mb-1">دفعات هذا المصروف:</div>
                                {exPays.map(p => (
                                  <div key={p.id} className="flex justify-between border-b border-border/30 py-1">
                                    <span>{new Date(p.paid_at).toLocaleDateString('ar-LY')}</span>
                                    <span>{p.paid_via === 'direct' ? 'سداد مباشر' : 'دفعة موزعة'}</span>
                                    <span>{p.payment_source}</span>
                                    <span className="font-bold">{Number(p.amount).toLocaleString('ar-LY')} د.ل</span>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    );
                  })}
                  {filtered.length === 0 && (
                    <TableRow><TableCell colSpan={10} className="text-center text-muted-foreground py-8">لا توجد مصروفات</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
