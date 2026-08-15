import { describe, it, expect } from 'vitest';
import { computeOverdueData } from '@/utils/overdueCalculations';

describe('computeOverdueData', () => {
  it('should return empty lists when no overdue contracts exist', () => {
    const res = computeOverdueData([], [], []);
    expect(res.overdueInstallments).toEqual([]);
    expect(res.customerOverdues).toEqual([]);
  });

  it('should identify past due installments with remaining unpaid balance', () => {
    const pastDate = '2023-01-01';
    const contracts = [
      {
        Contract_Number: 101,
        'Customer Name': 'شركة الأمل',
        customer_id: 'cust-1',
        Total: 5000,
        installments_data: [
          { amount: 2000, dueDate: pastDate, description: 'الدفعة الأولى' },
          { amount: 3000, dueDate: '2099-01-01', description: 'الدفعة الثانية' }
        ]
      }
    ];

    // Customer paid only 500 for contract 101
    const payments = [
      { contract_number: 101, amount: 500, paid_at: '2023-01-02' }
    ];

    const res = computeOverdueData(contracts, payments, []);
    expect(res.overdueInstallments.length).toBe(1);
    expect(res.overdueInstallments[0].contractNumber).toBe(101);
    expect(res.overdueInstallments[0].installmentAmount).toBe(1500); // 2000 - 500
    expect(res.customerOverdues.length).toBe(1);
    expect(res.customerOverdues[0].totalOverdue).toBe(1500);
  });

  it('should not mark fully paid installments as overdue', () => {
    const pastDate = '2023-01-01';
    const contracts = [
      {
        Contract_Number: 102,
        'Customer Name': 'شركة النور',
        customer_id: 'cust-2',
        Total: 2000,
        installments_data: [
          { amount: 2000, dueDate: pastDate, description: 'دفعة كاملة' }
        ]
      }
    ];

    const payments = [
      { contract_number: 102, amount: 2000, paid_at: '2023-01-01' }
    ];

    const res = computeOverdueData(contracts, payments, []);
    expect(res.overdueInstallments.length).toBe(0);
    expect(res.customerOverdues.length).toBe(0);
  });
});
