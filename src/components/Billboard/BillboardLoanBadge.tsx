import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Clock } from 'lucide-react';
import type { BillboardLoan } from '@/hooks/useBillboardLoans';

interface Props {
  loan: BillboardLoan;
  className?: string;
}

export const BillboardLoanBadge: React.FC<Props> = ({ loan, className }) => {
  const today = new Date();
  const end = new Date(loan.end_date);
  const remaining = Math.max(0, Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  return (
    <Badge
      className={
        'bg-amber-500/95 text-white text-[10px] px-2 py-0.5 shadow-sm flex items-center gap-1 ' +
        (className || '')
      }
      title={`معارة للعقد ${loan.target_contract_number} حتى ${loan.end_date}`}
    >
      <Clock className="h-3 w-3" />
      معارة - {remaining} يوم مستحقة
    </Badge>
  );
};
