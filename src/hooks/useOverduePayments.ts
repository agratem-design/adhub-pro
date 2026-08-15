import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { computeOverdueData } from '@/utils/overdueCalculations';

interface CustomerOverdueInfo {
  hasOverdue: boolean;
  oldestDueDate: string | null;
  oldestDaysOverdue: number;
  totalOverdueAmount: number;
  overdueCount: number;
}

export function useOverduePayments(customerId: string | null, customerName: string) {
  const [overdueInfo, setOverdueInfo] = useState<CustomerOverdueInfo>({
    hasOverdue: false,
    oldestDueDate: null,
    oldestDaysOverdue: 0,
    totalOverdueAmount: 0,
    overdueCount: 0
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadOverdueForCustomer();
  }, [customerId, customerName]);

  const loadOverdueForCustomer = async () => {
    if (!customerId && !customerName) return;

    try {
      setLoading(true);
      
      let query = supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", customer_id, installments_data, Total, "Contract Date", "End Date"')
        .not('installments_data', 'is', null);

      if (customerId) {
        query = query.eq('customer_id', customerId);
      } else if (customerName) {
        query = query.ilike('Customer Name', `%${customerName}%`);
      }

      const { data: contracts, error } = await query;

      if (error) {
        console.error('Error loading contracts for customer:', error);
        return;
      }

      // Collect contract numbers
      const contractNumbers = (contracts || []).map((c: any) => c.Contract_Number);

      // Get payments for these contracts
      const { data: allPayments } = contractNumbers.length
        ? await supabase
            .from('customer_payments')
            .select('contract_number, customer_id, customer_name, amount, paid_at, entry_type')
            .in('contract_number', contractNumbers)
            .in('entry_type', ['payment', 'receipt', 'account_payment'])
        : { data: [], error: null } as any;

      // Get general payments (without contract)
      let acctPays: any[] = [];
      if (customerId) {
        const { data: generalPays } = await supabase
          .from('customer_payments')
          .select('customer_id, amount, entry_type, sales_invoice_id, printed_invoice_id, composite_task_id')
          .is('contract_number', null)
          .eq('customer_id', customerId)
          .in('entry_type', ['payment', 'receipt', 'account_payment']);
        acctPays = (generalPays || []).filter((p: any) => 
          p.sales_invoice_id === null && 
          p.printed_invoice_id === null && 
          p.composite_task_id === null
        );
      } else if (customerName) {
        const { data: generalPays } = await supabase
          .from('customer_payments')
          .select('customer_id, amount, entry_type, sales_invoice_id, printed_invoice_id, composite_task_id')
          .is('contract_number', null)
          .ilike('customer_name', `%${customerName}%`)
          .in('entry_type', ['payment', 'receipt', 'account_payment']);
        acctPays = (generalPays || []).filter((p: any) => 
          p.sales_invoice_id === null && 
          p.printed_invoice_id === null && 
          p.composite_task_id === null
        );
      }

      // Compute using unified utility
      const { customerOverdues } = computeOverdueData(
        contracts || [],
        allPayments || [],
        acctPays
      );

      const match = customerOverdues.find(c => 
        (customerId && c.customerId === customerId) || 
        (!customerId && c.customerName.toLowerCase() === customerName.toLowerCase())
      );

      if (match) {
        setOverdueInfo({
          hasOverdue: true,
          oldestDueDate: match.oldestDueDate,
          oldestDaysOverdue: match.oldestDaysOverdue,
          totalOverdueAmount: match.totalOverdue,
          overdueCount: match.overdueCount
        });
      } else {
        setOverdueInfo({
          hasOverdue: false,
          oldestDueDate: null,
          oldestDaysOverdue: 0,
          totalOverdueAmount: 0,
          overdueCount: 0
        });
      }
    } catch (error) {
      console.error('Error loading overdue payments:', error);
    } finally {
      setLoading(false);
    }
  };

  return { overdueInfo, loading };
}