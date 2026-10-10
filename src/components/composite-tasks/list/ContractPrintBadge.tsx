import { Printer } from 'lucide-react';

export function ContractPrintBadge({ contractIds = [], printEnabledContractIds = [] }: {
  contractIds?: number[];
  printEnabledContractIds?: number[];
}) {
  const enabled = [...new Set(printEnabledContractIds)].filter(id => contractIds.includes(id));
  if (!enabled.length) return null;
  const allEnabled = contractIds.every(id => enabled.includes(id));
  const label = contractIds.length <= 1 ? 'العقد مع الطباعة' : allEnabled ? 'العقود مع الطباعة' :
    `مع الطباعة: ${enabled.map(id => `#${id}`).join('، ')}`;
  return (
    <span title="الطباعة مفعّلة في العقد، وتظهر حالة إنشاء مهمة الطباعة بشكل مستقل"
      className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-xs font-semibold text-primary">
      <Printer className="h-3 w-3 shrink-0" aria-hidden="true" />{label}
    </span>
  );
}
