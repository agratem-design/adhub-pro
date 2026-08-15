import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface ExpensePaymentLogRow {
  id: string;
  expense_id: string;
  amount: number;
  paid_at: string;
  paid_via: string | null;
  payment_source: string | null;
  distributed_payment_id: string | null;
  notes: string | null;
  // joined
  expense_description: string | null;
  expense_category: string | null;
  expense_amount: number | null;
  employee_id: string | null;
  employee_name: string | null;
  // from customer_payments (when distributed_payment_id matches)
  customer_id: string | null;
  customer_name: string | null;
  customer_payment_id: string | null;
  customer_payment_method: string | null;
  customer_payment_amount: number | null;
}

interface Filters {
  dateFrom?: string;
  dateTo?: string;
  employeeId?: string;
  customerId?: string;
  source?: 'all' | 'customer_payment' | 'direct' | 'custody';
}

export function useExpensePaymentsLog(filters: Filters = {}, refreshKey = 0) {
  const [rows, setRows] = useState<ExpensePaymentLogRow[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      let q = supabase
        .from('expense_payments')
        .select('id, expense_id, amount, paid_at, paid_via, payment_source, distributed_payment_id, notes')
        .order('paid_at', { ascending: false })
        .limit(2000);

      if (filters.dateFrom) q = q.gte('paid_at', filters.dateFrom);
      if (filters.dateTo) q = q.lte('paid_at', filters.dateTo + 'T23:59:59');

      const { data: payments, error } = await q;
      if (error) throw error;
      const pays = payments || [];
      if (!pays.length) { setRows([]); return; }

      const expenseIds = Array.from(new Set(pays.map(p => p.expense_id).filter(Boolean)));
      const distIds = Array.from(new Set(pays.map(p => p.distributed_payment_id).filter(Boolean) as string[]));

      const [{ data: exps }, { data: custPays }] = await Promise.all([
        expenseIds.length
          ? supabase.from('expenses').select('id, description, category, amount, employee_id').in('id', expenseIds)
          : Promise.resolve({ data: [] as any[] }),
        distIds.length
          ? supabase.from('customer_payments').select('id, distributed_payment_id, customer_id, customer_name, method, amount').in('distributed_payment_id', distIds)
          : Promise.resolve({ data: [] as any[] }),
      ]);

      const empIds = Array.from(new Set((exps || []).map((e: any) => e.employee_id).filter(Boolean)));
      const { data: emps } = empIds.length
        ? await supabase.from('employees').select('id, name').in('id', empIds)
        : { data: [] as any[] };

      const expMap: Record<string, any> = Object.fromEntries((exps || []).map((e: any) => [e.id, e]));
      const empMap: Record<string, string> = Object.fromEntries((emps || []).map((e: any) => [e.id, e.name]));
      // pick first matching customer_payment per distributed_payment_id
      const cpMap: Record<string, any> = {};
      for (const cp of (custPays || [])) {
        const k = cp.distributed_payment_id as string;
        if (k && !cpMap[k]) cpMap[k] = cp;
      }

      let merged: ExpensePaymentLogRow[] = pays.map((p: any) => {
        const exp = expMap[p.expense_id] || {};
        const cp = p.distributed_payment_id ? cpMap[p.distributed_payment_id] : null;
        return {
          id: p.id,
          expense_id: p.expense_id,
          amount: Number(p.amount || 0),
          paid_at: p.paid_at,
          paid_via: p.paid_via,
          payment_source: p.payment_source,
          distributed_payment_id: p.distributed_payment_id,
          notes: p.notes,
          expense_description: exp.description || null,
          expense_category: exp.category || null,
          expense_amount: exp.amount != null ? Number(exp.amount) : null,
          employee_id: exp.employee_id || null,
          employee_name: exp.employee_id ? (empMap[exp.employee_id] || null) : null,
          customer_id: cp?.customer_id || null,
          customer_name: cp?.customer_name || null,
          customer_payment_id: cp?.id || null,
          customer_payment_method: cp?.method || null,
          customer_payment_amount: cp?.amount != null ? Number(cp.amount) : null,
        };
      });

      if (filters.employeeId && filters.employeeId !== 'all') {
        merged = merged.filter(r => r.employee_id === filters.employeeId);
      }
      if (filters.customerId && filters.customerId !== 'all') {
        merged = merged.filter(r => r.customer_id === filters.customerId);
      }
      if (filters.source && filters.source !== 'all') {
        if (filters.source === 'customer_payment') merged = merged.filter(r => !!r.customer_id);
        else if (filters.source === 'custody') merged = merged.filter(r => (r.payment_source || '').includes('custody') || (r.paid_via || '').includes('عهدة'));
        else if (filters.source === 'direct') merged = merged.filter(r => !r.customer_id && !((r.payment_source || '').includes('custody')));
      }

      setRows(merged);
    } catch (err) {
      console.error('useExpensePaymentsLog error:', err);
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [filters.dateFrom, filters.dateTo, filters.employeeId, filters.customerId, filters.source, refreshKey]);

  useEffect(() => { load(); }, [load]);

  return { rows, loading, refresh: load };
}