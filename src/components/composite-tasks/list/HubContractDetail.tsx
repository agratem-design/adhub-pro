import { ContractDesignThumbnail } from './ContractDesignThumbnail';
import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';
import { fetchContractDesignUrls } from '@/lib/contractDesignUtils';
import { normalizeContractId } from '@/lib/compositeTaskContractIdentity';
import { Button, buttonVariants } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Building2, CalendarDays, ChevronDown, ChevronUp, Download, Edit, FileOutput, Layers,
  Loader2, Megaphone, Percent, Printer, RefreshCw, Sparkles, Users, Wrench, FolderOpen, Info,
} from 'lucide-react';
import { DesignPanel } from './DesignPanel';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { TaskCardRow } from './TaskCardRow';
import { MultiContractBadge, money, paymentStateOf } from './HubContractRow';
import { ContractPrintBadge } from './ContractPrintBadge';
import type { InvoiceType } from '../UnifiedTaskInvoice';

const ActionButton = ({ icon: Icon, children, onClick, disabled, primary, title }: any) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    title={title}
    className={cn(buttonVariants({ variant: primary ? 'default' : 'outline', size: 'sm' }), 'min-h-10 cursor-pointer gap-2 rounded-lg text-xs transition-all duration-200')}
  >
    {Icon && <Icon className={cn('h-3.5 w-3.5', Icon === Loader2 && 'animate-spin')} />}
    {children}
  </button>
);

export const HubContractDetail = (props: any) => {
  const {
    group, expandedOperations, toggleOperationExpansion, zipDownloadingGroup, handleDownloadGroupZip,
    handleCreatePrintTasksForGroup, handleCreateReinstallationForGroup, reinstallCreatingGroup,
    discountPopoverGroup, setDiscountPopoverGroup, discountAmount, setDiscountAmount, discountReason,
    setDiscountReason, discountTarget, setDiscountTarget, discountSaving, handleSaveDiscount,
    setGroupInvoiceTasks, setGroupInvoiceOpen, setEditingOperationTasks, setEditingTask, setEditDialogOpen,
    setDeleteTask, setInvoiceTask, setInvoiceType, setInvoiceOpen, navigate, handleOpenCreatePrintTask,
    loadInstallationWorkflow, workflowLoadingTaskId,
  } = props;

  const [fallbackUrls, setFallbackUrls] = useState<string[]>([]);
  const hasOwn = (group.latestDesignUrls?.length || 0) > 0;
  useEffect(() => {
    setFallbackUrls([]);
    if (hasOwn) return;
    const cId = normalizeContractId(group.contractId);
    if (!cId) return;
    let cancelled = false;
    fetchContractDesignUrls(cId).then(urls => { if (!cancelled && urls?.length) setFallbackUrls(urls.slice(0, 4)); });
    return () => { cancelled = true; };
  }, [hasOwn, group.contractId]);
  const isInstallPhoto = !group.latestDesignUrls?.length && !fallbackUrls.length && (group.latestInstallationUrls?.length || 0) > 0;
  const coverUrls = group.latestDesignUrls?.length ? group.latestDesignUrls : fallbackUrls.length ? fallbackUrls : group.latestInstallationUrls || [];
  const activeOperation = group.operations[0];
  const openTask = (task:any) => navigate(`/admin/installation-tasks?task=${encodeURIComponent(task.installation_task_id)}&from=hub`);
  return (
    <div className="min-w-0 overflow-hidden rounded-2xl border border-border bg-card" dir="rtl">
      <header className="border-b border-border p-4 sm:p-5">
        <div className="flex flex-col gap-4"><div className="relative h-52 w-full shrink-0 overflow-hidden rounded-xl border border-border bg-muted"><DesignPanel urls={coverUrls} accent="hsl(var(--primary))" label={isInstallPhoto?'صورة التركيب':'تصميم العقد'}/></div><div className="min-w-0 flex-1"><div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">{group.isMultiContract?<MultiContractBadge group={group} compact/>:<span>عقد #{group.contractId}</span>}<ContractPrintBadge contractIds={group.contractIds} printEnabledContractIds={group.printEnabledContractIds}/></div><h2 className="text-xl font-bold">{group.customerName}</h2><p className="mt-1 line-clamp-2 text-[12px] text-muted-foreground" title={group.adType}>{group.adType||'نوع الإعلان غير محدد'}</p>{group.companyName&&<p className="mt-1 text-[11px] text-muted-foreground">{group.companyName}</p>}</div></div>
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3"><span className="text-[12px] text-muted-foreground">{group.operations.length} عملية · {group.tasks.length} مهمة · {group.groupTotalBillboards} لوحة</span><div className="flex flex-wrap gap-2"><ActionButton icon={FolderOpen} onClick={()=>navigate(`/admin/contracts/edit?contract=${group.contractId}`)}>فتح العقد</ActionButton><ActionButton icon={reinstallCreatingGroup===group.key?Loader2:RefreshCw} disabled={reinstallCreatingGroup===group.key} onClick={()=>handleCreateReinstallationForGroup(group)}>إعادة تركيب جديدة</ActionButton></div></div>
      </header>
      <Tabs key={group.key} defaultValue="tasks" dir="rtl" className="p-3 sm:p-4">
        <TabsList className="mb-4 grid h-auto w-full grid-cols-3 gap-1 rounded-xl bg-muted/50 p-1"><TabsTrigger value="tasks" className="min-h-10 text-[12px] data-[state=active]:text-primary">المهام</TabsTrigger><TabsTrigger value="contracts" className="min-h-10 text-[12px] data-[state=active]:text-primary">العقود والصور</TabsTrigger><TabsTrigger value="accounts" className="min-h-10 text-[12px] data-[state=active]:text-primary">الحسابات</TabsTrigger></TabsList>
        <TabsContent value="tasks" className="space-y-4">
          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/35 px-3 py-2.5 text-[12px]"><span>تقدم التركيب</span><span className="font-semibold tabular-nums">{group.groupCompletedBillboards} / {group.groupTotalBillboards}</span><span className="text-primary">{group.groupProgressPercentage||0}%</span></div>
          {group.operations.map((operation:any,index:number)=>{
            const expansionKey=`${group.key}::${operation.key}`,open=expandedOperations.has(expansionKey),ids=operation.tasks.map((t:any)=>t.installation_task_id).filter(Boolean);
            const operationCost=operation.tasks.reduce((sum:number,t:any)=>sum+Number(t.operating_cost??t.company_total??0),0),operationValue=operation.tasks.reduce((sum:number,t:any)=>sum+Number(t.customer_total||0),0),operationPaid=operation.tasks.reduce((sum:number,t:any)=>sum+Number(t._totalPaid||0),0);
            return <section key={operation.key} className="rounded-xl border border-border"><header className="border-b border-border bg-muted/25 p-3"><div className="flex items-center gap-2"><button type="button" aria-expanded={open} onClick={()=>toggleOperationExpansion(expansionKey)} className="flex min-h-10 min-w-0 flex-1 cursor-pointer items-center gap-2 text-right"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"><Wrench className="h-4 w-4"/></span><span className="min-w-0"><span className="block text-[13px] font-bold">{operation.label}</span><span className="block text-[11px] text-muted-foreground">{operation.createdAt?format(new Date(operation.createdAt),'dd/MM/yyyy',{locale:ar}):''} · {operation.tasks.length} مهمة{index===0?' · الأحدث':''}</span></span>{open?<ChevronUp className="ms-auto h-4 w-4"/>:<ChevronDown className="ms-auto h-4 w-4"/>}</button></div><dl className="mt-3 grid grid-cols-3 gap-2 rounded-lg border border-border bg-card p-3">{[{label:'تكلفة التنفيذ',value:operationCost},{label:'قيمة الزبون',value:operationValue},{label:'المستحق على الزبون',value:Math.max(0,operationValue-operationPaid)}].map(v=><div key={v.label} className="min-w-0"><dt className="text-[10px] text-muted-foreground">{v.label}</dt><dd className="mt-1 break-words text-[12px] font-bold tabular-nums">{money(v.value)}</dd></div>)}</dl><div className="mt-3 flex flex-wrap gap-2">{operation.tasks.filter((t:any)=>t.installation_task_id).map((t:any)=><Button key={t.id} size="sm" className="h-10" onClick={()=>openTask(t)}><FolderOpen className="h-4 w-4"/>{operation.tasks.length===1?'إدارة اللوحات':`لوحات ${t.teamName||'المهمة'}`}</Button>)}<Button size="sm" variant="outline" className="h-10" aria-label={`طباعة ${operation.label}`} onClick={()=>{if(!ids.length){toast.error('لا توجد مهام تركيب مرتبطة');return;}loadInstallationWorkflow(operation.tasks[0],ids,'print');}}><Printer className="h-4 w-4"/>طباعة التركيب</Button></div></header>
              {open&&<div className="space-y-3 p-3">{operation.tasks.map((task:any,idx:number)=><TaskCardRow key={task.id} task={task} idx={idx} operationInstallationTaskIds={ids} onDelete={(t:any)=>setDeleteTask(t)} onOpenInvoice={(t:any,type:InvoiceType)=>{setInvoiceTask(t);setInvoiceType(type);setInvoiceOpen(true);}} onNavigateToPayment={(id:string,cid:string,name:string)=>navigate(`/admin/customer-billing?id=${cid}&name=${encodeURIComponent(name)}&highlight_payment=${id}`)} onCreatePrintTask={handleOpenCreatePrintTask} onManageDesigns={(t:any,ids:string[])=>loadInstallationWorkflow(t,ids,'designs')} onDistributeDesigns={(t:any,ids:string[])=>loadInstallationWorkflow(t,ids,'distribution')} onPrintInstallationTask={(t:any)=>loadInstallationWorkflow(t,ids,'print')} onOpenInstallationTask={openTask} workflowBusy={workflowLoadingTaskId===task.installation_task_id}/>)}</div>}
            </section>;
          })}
        </TabsContent>
        <TabsContent value="contracts" className="space-y-4"><h3 className="text-[14px] font-bold">العقود المرتبطة</h3><div className="grid gap-2 sm:grid-cols-2">{(group.contractBreakdown?.length?group.contractBreakdown:(group.contractIds||[group.contractId]).map((id:number)=>({contractId:id,count:0}))).map((c:any)=><a key={c.contractId} href={`/admin/contracts/edit?contract=${c.contractId}`} target="_blank" rel="noreferrer" className="flex cursor-pointer items-center justify-between gap-2 rounded-lg border border-border p-3 hover:border-primary"><ContractDesignThumbnail contractId={Number(c.contractId)} url={group.contractIds?.length===1?group.latestDesignUrls?.[0]:undefined}/><span className="min-w-0 flex-1"><b className="text-[13px]">عقد #{c.contractId}</b>{c.adType&&<span className="mt-1 block text-[12px] text-muted-foreground">{c.adType}</span>}</span><span className="shrink-0 text-[11px] text-muted-foreground">{c.count?`${c.count} لوحة`:'فتح'}</span></a>)}</div><div className="flex flex-wrap gap-2 border-t border-border pt-4"><ActionButton icon={Sparkles} onClick={()=>window.open(`/design-studio?contract_id=${group.contractId}`,'_blank')}>استوديو التصميم</ActionButton><ActionButton icon={zipDownloadingGroup===group.key?Loader2:Download} disabled={zipDownloadingGroup===group.key} onClick={()=>handleDownloadGroupZip({key:group.key,contractId:group.contractId,customerName:group.customerName})}>تحميل الصور</ActionButton></div></TabsContent>
        <TabsContent value="accounts" className="space-y-4"><dl className="grid grid-cols-2 gap-3">{[{label:'قيمة الزبون',value:group.groupTotal},{label:'المدفوع',value:group.groupPaid},{label:'المتبقي',value:group.groupRemaining},{label:'صافي الربح',value:group.groupProfit}].map(v=><div key={v.label} className="rounded-xl border border-border bg-muted/20 p-3"><dt className="text-[12px] text-muted-foreground">{v.label}</dt><dd className="mt-2 text-[15px] font-bold tabular-nums">{money(v.value)}</dd></div>)}</dl>
          {group.operations.map((operation:any,operationIndex:number)=>{
            const opCustomer=operation.tasks.reduce((v:number,t:any)=>v+(t.customer_total||0),0),opCompany=operation.tasks.reduce((v:number,t:any)=>v+(t.operating_cost??(t.company_total||0)),0),opProfit=opCustomer-opCompany,firstInstall=operation.tasks.every((t:any)=>t.task_type==='new_installation'),opInstall=operation.tasks.reduce((v:number,t:any)=>v+(t.company_installation_cost||0),0),opPrint=operation.tasks.reduce((v:number,t:any)=>v+(t.company_print_cost||0),0),opCutout=operation.tasks.reduce((v:number,t:any)=>v+(t.company_cutout_cost||0),0),opInstallIds=operation.tasks.map((t:any)=>t.installation_task_id).filter(Boolean),printable=operationIndex===0?operation.tasks.filter((t:any)=>!t.print_task_id&&t.installation_task_id):[];
            return <section key={operation.key} className="rounded-xl border border-border p-3"><h3 className="mb-3 text-[14px] font-bold">{operation.label}</h3>
                <dl className="grid grid-cols-2 gap-3 rounded-lg bg-muted/20 p-3 text-xs sm:grid-cols-3">
                  <div><dt className="text-muted-foreground">تكلفة التنفيذ</dt><dd className="font-semibold tabular-nums">{opCompany.toLocaleString('ar-LY')}</dd></div>
                  <div><dt className="text-muted-foreground">صافي الربح</dt><dd className={cn('font-semibold tabular-nums', opProfit >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-destructive')}>{opProfit.toLocaleString('ar-LY')}</dd></div>
                  <div><dt className="text-muted-foreground" title={firstInstall ? 'تكلفة التركيب الأول مغطاة بقيمة العقد' : undefined}>تركيب{firstInstall ? ' (ضمن العقد)' : ''}</dt><dd className="tabular-nums">{opInstall.toLocaleString('ar-LY')}</dd></div>
                  <div><dt className="text-muted-foreground">طباعة</dt><dd className="tabular-nums">{opPrint.toLocaleString('ar-LY')}</dd></div>
                  <div><dt className="text-muted-foreground">قص</dt><dd className="tabular-nums">{opCutout.toLocaleString('ar-LY')}</dd></div>
                </dl>

                <div className="flex flex-wrap items-center gap-2 border-t border-border pt-3">
                  <ActionButton icon={Edit} onClick={() => { setEditingOperationTasks(operation.tasks); setEditingTask(operation.tasks[0]); setEditDialogOpen(true); }}>
                    تعديل التكاليف
                  </ActionButton>
                  <ActionButton icon={FileOutput} onClick={() => { setGroupInvoiceTasks(operation.tasks); setGroupInvoiceOpen(true); }} title="فاتورة هذه العملية فقط">
                    فاتورة العملية
                  </ActionButton>
                  <ActionButton
                    icon={Printer}
                    onClick={() => {
                      if (opInstallIds.length === 0) { toast.error('لا توجد مهام تركيب مرتبطة بهذه العملية'); return; }
                      loadInstallationWorkflow(operation.tasks[0], opInstallIds, 'print');
                    }}
                  >
                    طباعة مهمة التركيب
                  </ActionButton>
                  {printable.length > 0 && (
                    <ActionButton icon={Printer} onClick={() => handleCreatePrintTasksForGroup(operation.tasks)}>
                      إنشاء مهام طباعة ({printable.length})
                    </ActionButton>
                  )}
                  {operationIndex === 0 && (
                    <Popover
                      open={discountPopoverGroup === group.key}
                      onOpenChange={(open) => {
                        if (open) {
                          setDiscountPopoverGroup(group.key);
                          const ts = activeOperation?.tasks || [];
                          setDiscountAmount(ts.reduce((s: number, t: any) => s + (t.discount_amount || 0), 0));
                          setDiscountReason(ts[0]?.discount_reason || '');
                          setDiscountTarget('all');
                        } else setDiscountPopoverGroup(null);
                      }}
                    >
                      <PopoverTrigger asChild>
                        <button type="button" className={buttonVariants({ variant: 'outline', size: 'sm' })}>
                          <Percent className="h-3.5 w-3.5" />الخصم
                        </button>
                      </PopoverTrigger>
                      <PopoverContent className="w-[min(360px,calc(100vw-32px))] rounded-xl p-4" side="bottom" align="end">
                        <div className="space-y-3 text-right" dir="rtl">
                          <h4 className="text-sm font-bold">خصم العملية الأحدث</h4>
                          <div className="overflow-hidden rounded-lg border border-border/40 text-xs">
                            <table className="w-full">
                              <thead className="bg-muted/40"><tr><th className="px-2 py-1.5 text-right">المهمة</th><th className="px-2 py-1.5 text-right">الإجمالي</th><th className="px-2 py-1.5 text-right">الخصم</th></tr></thead>
                              <tbody className="divide-y divide-border/30">
                                {(activeOperation?.tasks || []).map((t: any, i: number) => (
                                  <tr key={t.id}><td className="px-2 py-1">{t.teamName || `مهمة ${i + 1}`}</td><td className="px-2 py-1 tabular-nums">{(t.customer_total || 0).toLocaleString('ar-LY')}</td><td className="px-2 py-1 tabular-nums text-warning">{(t.discount_amount || 0).toLocaleString('ar-LY')}</td></tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">تطبيق على</Label>
                            <Select value={discountTarget} onValueChange={(v) => setDiscountTarget(v as any)}>
                              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">تقسيم نسبي على الجميع</SelectItem>
                                {(activeOperation?.tasks || []).map((t: any, i: number) => <SelectItem key={t.id} value={t.id}>{t.teamName || `مهمة ${i + 1}`}</SelectItem>)}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            <div className="space-y-1"><Label className="text-xs">المبلغ</Label><Input type="number" value={discountAmount} onChange={e => setDiscountAmount(Number(e.target.value))} className="h-9" /></div>
                            <div className="space-y-1"><Label className="text-xs">السبب</Label><Input value={discountReason} onChange={e => setDiscountReason(e.target.value)} className="h-9" placeholder="اختياري" /></div>
                          </div>
                          <Button size="sm" className="h-9 w-full" disabled={discountSaving} onClick={() => handleSaveDiscount(activeOperation?.tasks || [])}>
                            {discountSaving && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}حفظ الخصم
                          </Button>
                        </div>
                      </PopoverContent>
                    </Popover>
                  )}
                </div>
            </section>;
          })}
        </TabsContent>
      </Tabs>
    </div>
  );
};
