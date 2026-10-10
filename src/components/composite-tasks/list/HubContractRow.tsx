import { ContractDesignThumbnail } from './ContractDesignThumbnail';
import { ArrowLeft, CheckCircle2, FolderOpen, Image as ImageIcon, Layers, Wrench } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ContractPrintBadge } from './ContractPrintBadge';

export const money = (n: number) => `${Number(n || 0).toLocaleString('ar-LY')} د.ل`;
export const paymentStateOf = (total: number, paid: number) => {
  if (!total) return { key: 'free', label: 'مجانية', tone: 'text-muted-foreground bg-muted/50 border-border', bar: 'bg-muted-foreground/40' };
  if (paid >= total) return { key: 'paid', label: 'مسدد', tone: 'text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30', bar: 'bg-emerald-500' };
  if (paid > 0) return { key: 'partial', label: 'جزئي', tone: 'text-amber-800 dark:text-amber-400 bg-amber-500/10 border-amber-500/30', bar: 'bg-amber-500' };
  return { key: 'unpaid', label: 'غير مسدد', tone: 'text-destructive bg-destructive/10 border-destructive/20', bar: 'bg-destructive' };
};
export const MultiContractBadge = ({ group, compact = false }: { group: any; compact?: boolean }) => {
  const ids: number[] = group.contractIds || [];
  if (ids.length < 2) return null;
  const word = ids.length === 2 ? 'عقدين' : `${ids.length} عقود`;
  return <span className="inline-flex items-center gap-1 rounded-md border border-primary/30 bg-primary/10 px-2 py-1 text-xs font-semibold text-primary"><Layers className="h-3 w-3" />{compact ? `من ${word}` : `${group.hasReinstall ? 'إعادة تركيب' : 'تركيب'} من ${word}`}</span>;
};

export const HubContractRow=({group,selected,onSelect,onOpenTask}:{group:any;selected:boolean;onSelect:()=>void;onOpenTask?:()=>void})=>{
  const hasTask=group.operations?.[0]?.tasks?.some((t:any)=>t.installation_task_id);
  return <article className={cn('min-w-0 shrink-0 overflow-hidden rounded-xl border transition-colors duration-200',selected?'border-primary bg-primary/5':'border-border bg-card hover:border-primary/40')}><button type="button" onClick={onSelect} aria-pressed={selected} className="w-full cursor-pointer p-3 text-right focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"><div className="flex flex-col items-start gap-3"><ContractDesignThumbnail contractId={Number(group.contractId)} url={group.latestDesignUrls?.[0]} className="h-44 w-full" /><div className="min-w-0 w-full flex-1"><div className="flex items-center justify-between gap-2"><h3 className="min-w-0 truncate text-[14px] font-bold">{group.customerName}</h3><span className="shrink-0 text-[11px] text-muted-foreground">{group.groupCompletedBillboards}/{group.groupTotalBillboards}</span></div><p className="mt-1.5 line-clamp-1 text-[12px] text-muted-foreground" title={group.adType}>{group.adType||'نوع الإعلان غير محدد'}</p><div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground"><span>{group.isMultiContract?`${group.contractIds.length} عقود`:`عقد #${group.contractId}`}</span><span>{group.operations.length} عملية</span><ContractPrintBadge contractIds={group.contractIds} printEnabledContractIds={group.printEnabledContractIds}/></div></div></div></button>{hasTask&&onOpenTask&&<button type="button" onClick={onOpenTask} className="flex min-h-9 w-full cursor-pointer items-center justify-between gap-2 border-t border-border/70 px-3 py-2 text-[12px] font-semibold text-primary transition-colors hover:bg-primary/10"><span>إدارة أحدث مهمة</span><ArrowLeft className="h-4 w-4"/></button>}</article>;
};
