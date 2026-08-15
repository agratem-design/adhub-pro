import { describe, it, expect } from 'vitest';
import { calculateCustomerFinancials } from '../hooks/useCustomerFinancials';
import { calculateTotalRemainingDebt } from '../components/billing/BillingUtils';

describe('Customer Financials Calculation Engine', () => {
  it('correctly calculates total debt, total paid, and remaining debt for basic contract & payment', () => {
    const contracts = [{ Contract_Number: 101, Total: 10000, customer_id: 'cust-1' }];
    const payments = [
      { id: 'p1', customer_id: 'cust-1', amount: 4000, entry_type: 'receipt', contract_number: 101 },
    ];
    const salesInvoices: any[] = [];
    const printedInvoices: any[] = [];
    const purchaseInvoices: any[] = [];
    const discounts: any[] = [];
    const compositeTasks: any[] = [];

    const result = calculateCustomerFinancials(
      contracts,
      payments,
      salesInvoices,
      printedInvoices,
      purchaseInvoices,
      discounts,
      compositeTasks,
      0
    );

    expect(result.totalDebt).toBe(10000);
    expect(result.totalPaid).toBe(4000);
    expect(result.remainingDebt).toBe(6000);
    expect(result.repaymentPercentage).toBe(40);
  });

  it('correctly subtracts general discounts and friend company rentals from remaining debt', () => {
    const contracts = [{ Contract_Number: 102, Total: 20000, customer_id: 'cust-2' }];
    const payments = [
      { id: 'p2', customer_id: 'cust-2', amount: 5000, entry_type: 'account_payment' },
    ];
    const salesInvoices: any[] = [];
    const printedInvoices: any[] = [];
    const purchaseInvoices: any[] = [];
    const discounts = [{ id: 'd1', customer_id: 'cust-2', discount_value: 2000, status: 'active' }];
    const compositeTasks: any[] = [];
    const friendRentals = 3000;

    const remaining = calculateTotalRemainingDebt(
      contracts,
      payments,
      salesInvoices,
      printedInvoices,
      purchaseInvoices,
      2000,
      compositeTasks,
      friendRentals
    );

    // Remaining = 20,000 - 5,000 (paid) - 2,000 (discount) - 3,000 (friend rental) = 10,000
    expect(remaining).toBe(10000);
  });

  it('correctly incorporates sales invoices and composite tasks without invoice double-counting', () => {
    const contracts = [{ Contract_Number: 103, Total: 5000, customer_id: 'cust-3' }];
    const payments = [{ id: 'p3', customer_id: 'cust-3', amount: 2000, entry_type: 'payment' }];
    const salesInvoices = [{ id: 's1', total_amount: 1500, customer_id: 'cust-3' }];
    const printedInvoices = [
      { id: 'pr_standalone', total_amount: 800, customer_id: 'cust-3' },
    ];
    const purchaseInvoices: any[] = [];
    const discounts: any[] = [];
    const compositeTasks = [
      { id: 'comp_standalone', combined_invoice_id: null, customer_total: 500 },
    ];

    const result = calculateCustomerFinancials(
      contracts,
      payments,
      salesInvoices,
      printedInvoices,
      purchaseInvoices,
      discounts,
      compositeTasks,
      0
    );

    // Debt Breakdown: Contracts (5000) + Sales (1500) + Printed (800) + Composite (500) = 7800
    expect(result.debtBreakdown.contracts).toBe(5000);
    expect(result.debtBreakdown.salesInvoices).toBe(1500);
    expect(result.debtBreakdown.printedInvoices).toBe(800);
    expect(result.debtBreakdown.compositeTasks).toBe(500);
    expect(result.totalDebt).toBe(7800);
  });

  it('handles zero debt gracefully with 100% repayment percentage', () => {
    const result = calculateCustomerFinancials([], [], [], [], [], [], [], 0);
    expect(result.totalDebt).toBe(0);
    expect(result.remainingDebt).toBe(0);
    expect(result.repaymentPercentage).toBe(100);
  });
});
