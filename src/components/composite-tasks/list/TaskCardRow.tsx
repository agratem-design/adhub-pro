import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { CheckCircle2, Clock, FileText, ImagePlus, Layers, Loader2, MoreHorizontal, Printer, Scissors, Shuffle, Sparkles, Trash2, Users, Wrench } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import { fetchContractDesignUrls } from '@/lib/contractDesignUtils';
import { normalizeContractId } from '@/lib/compositeTaskContractIdentity';
import type { InvoiceType } from '../UnifiedTaskInvoice';
import { DesignPanel } from './DesignPanel';
import { ContractPrintBadge } from './ContractPrintBadge';
import { money, paymentStateOf } from './HubContractRow';

export const TaskCardRow = ({ task, idx, operationInstallationTaskIds, onDelete, onOpenInvoice,
  onNavigateToPayment, onCreatePrintTask, onManageDesigns, onDistributeDesigns,
  onPrintInstallationTask, onOpenInstallationTask, workflowBusy,
}: {
  task: any; idx: number; operationInstallationTaskIds: string[];
  onDelete: (task: any) => void;
  onOpenInvoice: (task: any, type: InvoiceType) => void;
  onNavigateToPayment: (distributedPaymentId: string, customerId: string, customerName: string) => void;
  onCreatePrintTask?: (installationTaskId: string) => void;
  onManageDesigns: (task: any, relatedTaskIds: string[]) => void;
  onDistributeDesigns: (task: any, relatedTaskIds: string[]) => void;
  onPrintInstallationTask: (task: any) => void;
  onOpenInstallationTask: (task: any) => void;
  workflowBusy?: boolean;
}) => {
  const [fallbackUrls, setFallbackUrls] = useState<string[]>([]);
  const ownUrls = task.designUrls || [];
  useEffect(() => {
    setFallbackUrls([]);
    if (ownUrls.length) return;
    const id = normalizeContractId(task.contract_id);
    if (!id) return;
    let cancelled = false;
    fetchContractDesignUrls(id).then(urls => { if (!cancelled) setFallbackUrls(urls || []); });
    return () => { cancelled = true; };
  }, [task.contract_id, ownUrls.join('|')]);
  const images = ownUrls.length ? ownUrls : fallbackUrls.length ? fallbackUrls : task.installationImages || [];
  const total = Number(task.customer_total) || 0;
  const paid = Number(task._totalPaid) || 0;
  const remaining = Math.max(0, total - paid);
  const companyInstall = Number(task.company_installation_cost) || 0;
  const cost = task.task_type === 'new_installation' ? Math.max(0, (Number(task.company_total) || 0) - companyInstall) : Number(task.company_total) || 0;
  const profit = total - cost;
  const pay = paymentStateOf(total, paid);
  const count = Number(task.installationItemCount) || 0;
  const done = Number(task.completedItemCount) || 0;
  const assigned = Number(task.assignedDesignCount) || 0;
  const hasPrint = Boolean(task.print_task_id);
  const hasInvoice = Boolean(task.combined_invoice_id || task.invoice_generated);
  const hasCutout = Number(task.customer_cutout_cost) > 0 || Number(task.company_cutout_cost) > 0;
  const contracts = task.contractIds || (task.contract_id ? [Number(task.contract_id)] : []);
  const typeLabel = task.task_type === 'reinstallation' ? `إعادة تركيب ${task.reinstallationNumber || ''}` : 'تركيب جديد';
  const status = task.status === 'completed' ? 'مكتملة' : task.status === 'cancelled' ? 'ملغاة' : task.status === 'in_progress' ? 'قيد التنفيذ' : 'بانتظار التنفيذ';
  const buttonClass = 'min-h-10 cursor-pointer gap-2 rounded-lg text-xs transition-all duration-200';

  return <article className="min-w-0 rounded-xl border border-border bg-card p-3" dir="rtl">
    <div className="flex flex-col items-start gap-3">
      <div className="relative h-48 w-full shrink-0 overflow-hidden rounded-lg border border-border bg-muted"><DesignPanel urls={images} accent="hsl(var(--primary))" label={ownUrls.length || fallbackUrls.length ? "تصميم المهمة" : "صورة التركيب"}/></div>
      <div className="min-w-0 w-full flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-[14px] font-bold">{task.teamName||`مهمة ${idx+1}`}</h3><span className={cn('rounded-md px-2 py-1 text-[11px]',task.status==='completed'?'bg-success/10 text-success':'bg-muted text-muted-foreground')}>{status}</span></div><p className="mt-1 text-[12px] text-muted-foreground">{typeLabel}{task.task_number?` · م#${task.task_number}`:''}</p><div className="mt-2 flex flex-wrap gap-2 text-[11px] text-muted-foreground"><span>عقد #{contracts.join('، #')}</span><ContractPrintBadge contractIds={contracts} printEnabledContractIds={task.printEnabledContractIds}/></div></div>
    </div>
    <div className="mt-3 grid grid-cols-2 gap-3 rounded-lg bg-muted/30 p-2.5">{[{label:'التركيب',value:done,total:count},{label:'توزيع التصاميم',value:assigned,total:count}].map(v=><div key={v.label}><div className="flex items-center justify-between gap-2 text-[11px]"><span className="text-muted-foreground">{v.label}</span><b className="tabular-nums">{v.value}/{v.total}</b></div><div role="progressbar" aria-label={v.label} aria-valuenow={v.value} aria-valuemin={0} aria-valuemax={v.total||1} className="mt-2 h-1 overflow-hidden rounded-full bg-muted"><span className="block h-full bg-primary" style={{width:`${v.total?Math.min(100,v.value/v.total*100):0}%`}}/></div></div>)}</div>
    <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground"><span>{hasPrint?`الطباعة: ${task.printerName||'مهمة مرتبطة'}`:'لم تنشأ مهمة طباعة'}</span><span>{hasInvoice?'الفاتورة صادرة':'الفاتورة غير صادرة'}</span>{task.created_at&&<span>{format(new Date(task.created_at),'dd/MM/yyyy',{locale:ar})}</span>}</div>
    {task.installation_task_id&&<div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4"><Button onClick={()=>onOpenInstallationTask(task)} className="min-h-10 text-[12px]"><Wrench className="h-4 w-4"/>إدارة اللوحات</Button><Button variant="outline" disabled={workflowBusy} onClick={()=>onPrintInstallationTask(task)} className="min-h-10 border-primary/40 text-[12px] font-semibold text-primary"><Printer className="h-4 w-4"/>طباعة التركيب</Button><Button variant="outline" disabled={workflowBusy} onClick={()=>onManageDesigns(task,operationInstallationTaskIds)} className="min-h-10 text-[12px]">{workflowBusy?<Loader2 className="h-4 w-4 animate-spin"/>:<ImagePlus className="h-4 w-4"/>}التصاميم</Button><Button variant="outline" disabled={workflowBusy} onClick={()=>onDistributeDesigns(task,operationInstallationTaskIds)} className="min-h-10 text-[12px]"><Shuffle className="h-4 w-4"/>التوزيع</Button></div>}
    <div className="mt-3 flex items-center justify-between gap-2 border-t border-border pt-2">
      <details className="min-w-0 flex-1"><summary className="cursor-pointer text-[12px] text-muted-foreground">الحساب والدفعات · {pay.label}</summary><div className="mt-3 space-y-3"><dl className="grid grid-cols-2 gap-3 text-[12px]">{[{label:'قيمة الزبون',value:total},{label:'المدفوع',value:paid},{label:'المتبقي',value:remaining},{label:'تكلفة التنفيذ',value:cost},{label:'صافي الربح',value:profit},{label:'الخصم',value:Number(task.discount_amount)||0}].map(v=><div key={v.label}><dt className="text-muted-foreground">{v.label}</dt><dd className="mt-1 font-semibold tabular-nums">{money(v.value)}</dd></div>)}</dl>{task.task_type==='new_installation'&&companyInstall>0&&<p className="text-[11px] text-muted-foreground">التركيب الأول {money(companyInstall)} ضمن العقد.</p>}{task._payments?.map((p:any,i:number)=><button key={p.id} disabled={!p.distributed_payment_id} onClick={()=>onNavigateToPayment(p.distributed_payment_id,task.customer_id||'',task.customer_name||'')} className="mr-1 min-h-9 cursor-pointer rounded-md border border-border px-2 text-[11px]">دفعة #{p.rowNumber||i+1} · {money(Number(p.amount))}</button>)}</div></details>
      <DropdownMenu dir="rtl"><DropdownMenuTrigger asChild><Button variant="ghost" size="sm" className="shrink-0 text-[12px]"><MoreHorizontal className="h-4 w-4"/>إجراءات</Button></DropdownMenuTrigger><DropdownMenuContent align="end">
        <DropdownMenuItem onClick={()=>onOpenInvoice(task,'customer')} className="cursor-pointer"><FileText className="ml-2 h-4 w-4"/>{hasInvoice?'فاتورة الزبون':'معاينة وإصدار الفاتورة'}</DropdownMenuItem>
        {hasPrint?<DropdownMenuItem onClick={()=>onOpenInvoice(task,'print_vendor')} className="cursor-pointer">فاتورة المطبعة</DropdownMenuItem>:task.installation_task_id&&onCreatePrintTask?<DropdownMenuItem onClick={()=>onCreatePrintTask(task.installation_task_id)} className="cursor-pointer">إنشاء مهمة طباعة</DropdownMenuItem>:null}
        {hasCutout&&<DropdownMenuItem onClick={()=>onOpenInvoice(task,'cutout_vendor')} className="cursor-pointer">فاتورة القص</DropdownMenuItem>}
        {task.installation_task_id&&<DropdownMenuItem onClick={()=>onOpenInvoice(task,'installation_team')} className="cursor-pointer">فاتورة الفرقة</DropdownMenuItem>}

        <DropdownMenuItem onClick={()=>window.open(`/design-studio?composite_task_id=${task.id}`,'_blank')} className="cursor-pointer">استوديو التصميم</DropdownMenuItem><DropdownMenuSeparator/><DropdownMenuItem onClick={()=>onDelete(task)} className="cursor-pointer text-destructive">حذف المهمة</DropdownMenuItem>
      </DropdownMenuContent></DropdownMenu>
    </div>
  </article>;
};
