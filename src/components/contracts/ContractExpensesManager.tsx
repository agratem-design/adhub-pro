// @ts-nocheck
import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, Plus, Trash2, Wrench, Printer, Home } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface ContractExpense {
  id?: string;
  contract_number: number;
  amount: number;
  reason: string;
  expense_type: 'installation' | 'print' | 'rental';
  created_at?: string;
}

interface ContractExpensesManagerProps {
  contractNumber: number | string;
  onTotalChange?: (totals: { installation: number; print: number; rental: number; total: number }) => void;
}

const EXPENSE_TYPE_CONFIG = {
  installation: {
    label: 'تركيب',
    icon: Wrench,
    color: 'bg-primary/10 text-primary border-primary/30',
    badgeClass: 'bg-primary/20 text-primary',
  },
  print: {
    label: 'طباعة',
    icon: Printer,
    color: 'bg-secondary/20 text-secondary-foreground border-secondary/30',
    badgeClass: 'bg-secondary/20 text-secondary-foreground',
  },
  rental: {
    label: 'إيجار',
    icon: Home,
    color: 'bg-accent/20 text-accent-foreground border-accent/30',
    badgeClass: 'bg-accent/20 text-accent-foreground',
  },
};

export const ContractExpensesManager: React.FC<ContractExpensesManagerProps> = ({
  contractNumber,
  onTotalChange,
}) => {
  const [expenses, setExpenses] = useState<ContractExpense[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // New expense form state
  const [newAmount, setNewAmount] = useState<string>('');
  const [newReason, setNewReason] = useState('');
  const [newType, setNewType] = useState<'installation' | 'print' | 'rental'>('installation');

  const numericContractNumber = Number(contractNumber);

  // Load expenses from DB
  const loadExpenses = async () => {
    if (!numericContractNumber || isNaN(numericContractNumber)) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('contract_expenses')
        .select('*')
        .eq('contract_number', numericContractNumber)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setExpenses((data as ContractExpense[]) || []);
    } catch (e) {
      console.error('Error loading expenses:', e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (numericContractNumber && !isNaN(numericContractNumber)) {
      loadExpenses();
    }
  }, [numericContractNumber]);

  // Notify parent about totals
  useEffect(() => {
    if (onTotalChange) {
      const totals = {
        installation: expenses.filter(e => e.expense_type === 'installation').reduce((s, e) => s + Number(e.amount), 0),
        print: expenses.filter(e => e.expense_type === 'print').reduce((s, e) => s + Number(e.amount), 0),
        rental: expenses.filter(e => e.expense_type === 'rental').reduce((s, e) => s + Number(e.amount), 0),
        total: expenses.reduce((s, e) => s + Number(e.amount), 0),
      };
      onTotalChange(totals);
    }
  }, [expenses]);

  const handleAdd = async () => {
    const amount = parseFloat(newAmount);
    if (!newReason.trim()) {
      toast.error('يرجى إدخال سبب المصروف');
      return;
    }
    if (!amount || amount <= 0) {
      toast.error('يرجى إدخال قيمة صحيحة');
      return;
    }

    setSaving(true);
    try {
      const newExpense: ContractExpense = {
        contract_number: numericContractNumber,
        amount,
        reason: newReason.trim(),
        expense_type: newType,
      };

      if (numericContractNumber && !isNaN(numericContractNumber)) {
        // Save to DB if contract exists
        const { data, error } = await supabase
          .from('contract_expenses')
          .insert(newExpense)
          .select()
          .single();

        if (error) throw error;
        setExpenses(prev => [...prev, data as ContractExpense]);
      } else {
        // Temp local state (new unsaved contract)
        setExpenses(prev => [...prev, { ...newExpense, id: `temp-${Date.now()}` }]);
      }

      setNewAmount('');
      setNewReason('');
      setNewType('installation');
      toast.success('تم إضافة المصروف');
    } catch (e: any) {
      console.error('Error adding expense:', e);
      toast.error('فشل في إضافة المصروف');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (expense: ContractExpense) => {
    try {
      if (expense.id && !expense.id.startsWith('temp-')) {
        const { error } = await supabase
          .from('contract_expenses')
          .delete()
          .eq('id', expense.id);
        if (error) throw error;
      }
      setExpenses(prev => prev.filter(e => e.id !== expense.id));
      toast.success('تم حذف المصروف');
    } catch (e) {
      console.error('Error deleting expense:', e);
      toast.error('فشل في حذف المصروف');
    }
  };

  // Group expenses by type for summary
  const grouped = {
    installation: expenses.filter(e => e.expense_type === 'installation'),
    print: expenses.filter(e => e.expense_type === 'print'),
    rental: expenses.filter(e => e.expense_type === 'rental'),
  };

  const totalExpenses = expenses.reduce((s, e) => s + Number(e.amount), 0);

  return (
    <Card className="card-elegant border-destructive/20">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="h-5 w-5 text-destructive" />
          المصاريف والخسائر
          {expenses.length > 0 && (
            <Badge variant="destructive" className="mr-auto text-xs">
              {expenses.length} عنصر • {totalExpenses.toLocaleString('ar-LY')} د.ل
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">

        {/* Add new expense form */}
        <div className="space-y-2 p-3 rounded-lg bg-muted/30 border border-border/50">
          <p className="text-xs text-muted-foreground font-medium">إضافة مصروف / خسارة جديدة</p>

          <div className="grid grid-cols-1 gap-2">
            {/* Type selector */}
            <Select value={newType} onValueChange={(v) => setNewType(v as any)}>
              <SelectTrigger className="h-8 text-sm">
                <SelectValue placeholder="نوع المصروف" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="installation">
                  <span className="flex items-center gap-2">
                    <Wrench className="h-3 w-3" /> تركيب
                  </span>
                </SelectItem>
                <SelectItem value="print">
                  <span className="flex items-center gap-2">
                    <Printer className="h-3 w-3" /> طباعة
                  </span>
                </SelectItem>
                <SelectItem value="rental">
                  <span className="flex items-center gap-2">
                    <Home className="h-3 w-3" /> إيجار
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>

            {/* Amount */}
            <Input
              type="number"
              min={0}
              placeholder="القيمة بالدينار (د.ل)"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              className="h-8 text-sm"
            />

            {/* Reason */}
            <Input
              placeholder="السبب / الوصف"
              value={newReason}
              onChange={(e) => setNewReason(e.target.value)}
              className="h-8 text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
          </div>

          <Button
            size="sm"
            className="w-full h-8 text-xs"
            onClick={handleAdd}
            disabled={saving}
          >
            <Plus className="h-3 w-3 ml-1" />
            {saving ? 'جاري الإضافة...' : 'إضافة'}
          </Button>
        </div>

        {/* Expenses list */}
        {loading ? (
          <div className="text-center text-xs text-muted-foreground py-3">جاري التحميل...</div>
        ) : expenses.length === 0 ? (
          <div className="text-center text-xs text-muted-foreground py-3 opacity-60">
            لا توجد مصاريف أو خسائر مسجلة
          </div>
        ) : (
          <div className="space-y-2">
            {/* Summary by type */}
            <div className="grid grid-cols-3 gap-1.5">
              {(Object.keys(grouped) as Array<keyof typeof grouped>).map(type => {
                const config = EXPENSE_TYPE_CONFIG[type];
                const total = grouped[type].reduce((s, e) => s + Number(e.amount), 0);
                if (total === 0) return null;
                return (
                  <div key={type} className={`rounded p-1.5 border text-center ${config.color}`}>
                    <div className="text-xs font-medium">{config.label}</div>
                    <div className="text-xs font-bold">{total.toLocaleString('ar-LY')}</div>
                  </div>
                );
              })}
            </div>

            {/* Individual items */}
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {expenses.map((expense) => {
                const config = EXPENSE_TYPE_CONFIG[expense.expense_type];
                const Icon = config.icon;
                return (
                  <div
                    key={expense.id}
                    className="flex items-center gap-2 p-2 rounded-lg bg-muted/20 border border-border/30 group"
                  >
                    <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    <Badge className={`text-[10px] px-1.5 py-0 shrink-0 ${config.badgeClass}`}>
                      {config.label}
                    </Badge>
                    <span className="text-xs text-muted-foreground flex-1 truncate">{expense.reason}</span>
                    <span className="text-xs font-bold text-destructive shrink-0">
                      {Number(expense.amount).toLocaleString('ar-LY')} د.ل
                    </span>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      onClick={() => handleDelete(expense)}
                    >
                      <Trash2 className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                );
              })}
            </div>

            {/* Total */}
            <div className="flex justify-between items-center pt-1 border-t border-border/40 text-sm">
              <span className="text-muted-foreground text-xs">إجمالي المصاريف والخسائر</span>
              <span className="font-bold text-destructive">{totalExpenses.toLocaleString('ar-LY')} د.ل</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default ContractExpensesManager;
