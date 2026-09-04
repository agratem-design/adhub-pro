import type { DistributableItem, EmployeeBalance, EmployeePaymentDistribution, CustodyDistribution } from '@/components/billing/distribute-payment/types';

export interface DistributionDraft {
  amount: number;
  fees: number;
  items: DistributableItem[];
  saveCredit: boolean;
  employees: EmployeePaymentDistribution[];
  balances: EmployeeBalance[];
  custody: CustodyDistribution[];
  custodyAmount: number;
  expenses: { expense_id: string; amount: number }[];
}

export const money = (amount: number) => Math.round((amount + Number.EPSILON) * 100) / 100;
const valid = (amount: number) => Number.isFinite(amount) && amount >= 0;

export function validateDistribution(draft: DistributionDraft): string[] {
  const errors: string[] = [];
  if (!valid(draft.amount) || draft.amount <= 0) errors.push('أدخل مبلغ دفعة أكبر من صفر.');
  if (!valid(draft.fees) || draft.fees > draft.amount) errors.push('العمولات يجب أن تكون بين صفر وقيمة الدفعة.');
  const selected = draft.items.filter(item => item.selected);
  if (selected.some(item => !valid(item.allocatedAmount) || money(item.allocatedAmount) > money(item.remainingAmount))) errors.push('راجع مبالغ العقود والفواتير؛ لا يمكن تجاوز المستحق.');
  const customerTotal = money(selected.reduce((sum, item) => sum + item.allocatedAmount, 0));
  if (customerTotal > money(draft.amount)) errors.push('توزيع العقود والفواتير يتجاوز قيمة الدفعة.');
  if (customerTotal < money(draft.amount) && !draft.saveCredit) errors.push('وزّع المتبقي على العميل أو احفظه كرصيد حساب.');
  const employeeTotals = new Map<string, number>();
  for (const row of draft.employees) {
    if (!row.employeeId || !valid(row.amount) || row.amount <= 0) { errors.push('حدد الموظف ومبلغًا موجبًا لكل دفعة موظف.'); break; }
    if (row.paymentType === 'from_balance') employeeTotals.set(row.employeeId, money((employeeTotals.get(row.employeeId) || 0) + row.amount));
  }
  // Multiple operating recipients draw from the same operating pool.
  const poolTotals = new Map<string, { amount: number; available: number }>();
  for (const [employeeId, amount] of employeeTotals) {
    const balance = draft.balances.find(row => row.employeeId === employeeId);
    if (!balance || amount > money(balance.pendingAmount)) errors.push('سداد مستحقات الموظف يتجاوز رصيده المتاح؛ حدّث البيانات أو خفّض المبلغ.');
    if (balance) {
      const key = balance.teamId || (balance.teamName === 'مصروفات التشغيل' ? 'operating' : employeeId);
      const pool = poolTotals.get(key) || { amount: 0, available: balance.pendingAmount };
      pool.amount = money(pool.amount + amount);
      poolTotals.set(key, pool);
    }
  }
  if ([...poolTotals.values()].some(pool => pool.amount > money(pool.available))) errors.push('مجموع السحوبات يتجاوز الرصيد المشترك للتشغيل أو الفريق.');
  if (draft.custody.some(row => !row.employeeId || !valid(row.amount) || row.amount <= 0)) errors.push('حدد المستلم ومبلغًا موجبًا لكل عهدة.');
  if (new Set(draft.custody.map(row => row.employeeId)).size !== draft.custody.length) errors.push('لا يمكن تكرار المستلم في العهدة نفسها.');
  const custodyTotal = money(draft.custody.reduce((sum, row) => sum + row.amount, 0));
  if (!valid(draft.custodyAmount) || custodyTotal !== money(draft.custodyAmount)) errors.push('مجموع العهد المسلّمة يجب أن يساوي المبلغ المخصص للعهد.');
  if (draft.expenses.some(row => !row.expense_id || !valid(row.amount) || row.amount <= 0)) errors.push('حدد المصروف ومبلغ سداد موجبًا.');
  if (new Set(draft.expenses.map(row => row.expense_id)).size !== draft.expenses.length) errors.push('المصروف مكرر في التوزيع.');
  const outflow = money(draft.fees + custodyTotal + draft.employees.reduce((sum, row) => sum + row.amount, 0) + draft.expenses.reduce((sum, row) => sum + row.amount, 0));
  if (outflow > money(draft.amount)) errors.push('المصروف للموظفين والعهد والمصروفات والعمولات يتجاوز الأموال المستلمة.');
  return [...new Set(errors)];
}
