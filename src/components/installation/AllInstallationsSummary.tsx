import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
import { TaskTotalCostSummary } from '@/components/tasks/TaskTotalCostSummary';
import { supabase } from '@/integrations/supabase/client';
import { 
  Calculator, Coins, Wrench, Landmark, LayoutGrid, Building2,
  DollarSign, Clock, CheckCircle2, AlertCircle, Calendar, RefreshCw
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface AllInstallationsSummaryProps {
  siblingTasks: any[];
  currentTaskId: string;
  billboards: Record<number, any>;
  installationPrices: Record<number, number>;
  onRefresh: () => void;
  disabled?: boolean;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  completed: { label: 'مكتملة', color: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30', dot: 'bg-emerald-400' },
  in_progress: { label: 'قيد التنفيذ', color: 'bg-amber-500/15 text-amber-400 border-amber-500/30', dot: 'bg-amber-400' },
  pending: { label: 'جديدة', color: 'bg-slate-500/15 text-slate-400 border-slate-500/30', dot: 'bg-slate-400' },
  cancelled: { label: 'ملغاة', color: 'bg-red-500/15 text-red-400 border-red-500/30', dot: 'bg-red-400' },
};

export const AllInstallationsSummary: React.FC<AllInstallationsSummaryProps> = ({
  siblingTasks,
  currentTaskId,
  billboards,
  installationPrices,
  onRefresh,
  disabled = false,
}) => {
  const [taskItemsMap, setTaskItemsMap] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchAllItems = useCallback(async () => {
    if (!siblingTasks || siblingTasks.length === 0) return;
    setLoading(true);
    setError(null);
    try {
      const taskIds = siblingTasks.map(t => t.id);
      const { data, error: dbError } = await supabase
        .from('installation_task_items')
        .select('*')
        .in('task_id', taskIds);

      if (dbError) throw dbError;

      // Group by task_id
      const grouped: Record<string, any[]> = {};
      taskIds.forEach(id => {
        grouped[id] = [];
      });
      if (data) {
        data.forEach(item => {
          if (grouped[item.task_id]) {
            grouped[item.task_id].push(item);
          } else {
            grouped[item.task_id] = [item];
          }
        });
      }
      setTaskItemsMap(grouped);
    } catch (err: any) {
      console.error('Error fetching sibling task items:', err);
      setError(err.message || 'فشل في تحميل تفاصيل اللوحات');
    } finally {
      setLoading(false);
    }
  }, [siblingTasks]);

  useEffect(() => {
    fetchAllItems();
  }, [fetchAllItems]);

  const handleRefresh = useCallback(() => {
    fetchAllItems();
    onRefresh();
  }, [fetchAllItems, onRefresh]);

  // Build iteration groups for each task or task items
  const iterationGroups = useMemo(() => {
    const groups: Array<{
      id: string;
      label: string;
      items: any[];
      taskCompany: number;
      taskCustomer: number;
      status: string;
      isCurrent: boolean;
    }> = [];

    siblingTasks.forEach((t) => {
      const rawItems = taskItemsMap[t.id] || [];
      if (rawItems.length === 0) return;

      const maxReinstall = Math.max(0, ...rawItems.map(i => i.reinstall_count || 0));

      if (maxReinstall === 0) {
        // Single iteration task
        let taskCompany = 0;
        let taskCustomer = 0;
        rawItems.forEach(item => {
          const billboard = billboards[item.billboard_id];
          const totalFaces = billboard?.Faces_Count || 1;
          const facesToInstall = item.faces_to_install ?? totalFaces;
          const hasCompanyCost = item.company_installation_cost !== null && item.company_installation_cost !== undefined;
          const basicCompanyCost = hasCompanyCost
            ? item.company_installation_cost!
            : (() => {
                const fullCompanyCost = installationPrices[item.billboard_id] || 0;
                return (totalFaces > 1 && facesToInstall === 1) ? fullCompanyCost / 2 : fullCompanyCost;
              })();
          taskCompany += basicCompanyCost + (item.company_additional_cost || 0);
          taskCustomer += (item.customer_installation_cost || 0) + (item.additional_cost || 0);
        });

        groups.push({
          id: t.id,
          label: 'التركيب الأصلي (المرة الأولى)',
          items: rawItems,
          taskCompany,
          taskCustomer,
          status: t.status || 'completed',
          isCurrent: t.id === currentTaskId,
        });
      } else {
        // Task has reinstalls! Split into Iteration 1 (التركيب الأصلي) + Iteration 2 (إعادة تركيب 1)...
        let origCompany = 0;
        let origCustomer = 0;
        const origItems = rawItems.map(item => ({
          ...item,
          customer_installation_cost: item.customer_original_install_cost || item.customer_installation_cost || 0,
        }));

        rawItems.forEach(item => {
          const billboard = billboards[item.billboard_id];
          const totalFaces = billboard?.Faces_Count || 1;
          const facesToInstall = item.faces_to_install ?? totalFaces;
          const hasCompanyCost = item.company_installation_cost !== null && item.company_installation_cost !== undefined;
          const basicCompanyCost = hasCompanyCost
            ? item.company_installation_cost!
            : (() => {
                const fullCompanyCost = installationPrices[item.billboard_id] || 0;
                return (totalFaces > 1 && facesToInstall === 1) ? fullCompanyCost / 2 : fullCompanyCost;
              })();
          origCompany += basicCompanyCost + (item.company_additional_cost || 0);
          origCustomer += (item.customer_original_install_cost || item.customer_installation_cost || 0) + (item.additional_cost || 0);
        });

        groups.push({
          id: `${t.id}-orig`,
          label: 'التركيب الأصلي (المرة الأولى)',
          items: origItems,
          taskCompany: origCompany,
          taskCustomer: origCustomer,
          status: 'completed',
          isCurrent: t.id === currentTaskId,
        });

        for (let r = 1; r <= maxReinstall; r++) {
          const reItemsRaw = rawItems.filter(i => (i.reinstall_count || 0) >= r);
          const reItems = reItemsRaw.map(item => ({
            ...item,
            customer_installation_cost: item.customer_reinstall_cost || item.customer_installation_cost || 0,
          }));

          let reCustomer = 0;
          reItemsRaw.forEach(item => {
            reCustomer += (item.customer_reinstall_cost || item.customer_installation_cost || 0);
          });

          groups.push({
            id: `${t.id}-re-${r}`,
            label: `إعادة تركيب رقم ${r} (المرة ${r + 1})`,
            items: reItems,
            taskCompany: 0,
            taskCustomer: reCustomer,
            status: 'completed',
            isCurrent: t.id === currentTaskId,
          });
        }
      }
    });

    return groups;
  }, [siblingTasks, taskItemsMap, billboards, installationPrices, currentTaskId]);

  // Calculate totals across iteration groups
  const overallTotals = useMemo(() => {
    let companyTotal = 0;
    let customerTotal = 0;

    iterationGroups.forEach(g => {
      companyTotal += g.taskCompany;
      customerTotal += g.taskCustomer;
    });

    const mainCount = siblingTasks.reduce((sum, t) => sum + (taskItemsMap[t.id]?.length || 0), 0);

    return {
      companyTotal,
      customerTotal,
      profitTotal: customerTotal - companyTotal,
      countTotal: mainCount,
    };
  }, [iterationGroups, siblingTasks, taskItemsMap]);

  if (loading && Object.keys(taskItemsMap).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-8 bg-card border border-border rounded-xl space-y-3" dir="rtl">
        <RefreshCw className="h-6 w-6 animate-spin text-primary" />
        <span className="text-sm text-muted-foreground">جاري تحميل بيانات جميع مرات التركيب...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-sm text-right flex items-center gap-2" dir="rtl">
        <AlertCircle className="h-5 w-5 shrink-0" />
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* ── OVERALL SUMMARY CARD ── */}
      <Card className="overflow-hidden border-2 border-primary/20 bg-gradient-to-br from-card to-primary/[0.02]">
        <CardHeader className="py-4 px-5 border-b border-border/60 bg-muted/20">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Calculator className="h-5 w-5 text-primary" />
              <CardTitle className="text-base font-bold text-foreground">
                ملخص إجمالي لجميع مرات التركيب ({iterationGroups.length})
              </CardTitle>
            </div>
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20 font-bold">
              العقد بالكامل
            </Badge>
          </div>
        </CardHeader>

        <CardContent className="p-5 space-y-5">
          {/* Main Totals Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 rounded-xl bg-muted/40 border border-border/40 shadow-sm transition-all hover:bg-muted/60">
              <div className="text-2xl font-black text-foreground font-mono">
                {overallTotals.companyTotal.toLocaleString('ar-LY')}
              </div>
              <div className="text-xs font-semibold text-muted-foreground/90 mt-1">تكلفة الشركة الإجمالية</div>
            </div>

            <div className="p-4 rounded-xl bg-primary/5 border border-primary/15 shadow-sm transition-all hover:bg-primary/10">
              <div className="text-2xl font-black text-primary font-mono">
                {overallTotals.customerTotal.toLocaleString('ar-LY')}
              </div>
              <div className="text-xs font-semibold text-primary/80 mt-1">سعر الزبون الإجمالي</div>
            </div>

            <div className={cn(
              "p-4 rounded-xl border shadow-sm transition-all",
              overallTotals.profitTotal >= 0 
                ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600 dark:text-emerald-400" 
                : "bg-destructive/5 border-destructive/20 text-destructive"
            )}>
              <div className="text-2xl font-black font-mono">
                {overallTotals.profitTotal >= 0 ? '+' : ''}{overallTotals.profitTotal.toLocaleString('ar-LY')}
              </div>
              <div className="text-xs font-semibold mt-1">إجمالي الأرباح</div>
            </div>

            <div className="p-4 rounded-xl bg-muted/40 border border-border/40 shadow-sm transition-all hover:bg-muted/60">
              <div className="text-2xl font-black text-foreground font-mono">
                {overallTotals.countTotal}
              </div>
              <div className="text-xs font-semibold text-muted-foreground/90 mt-1">إجمالي اللوحات المجهّزة</div>
            </div>
          </div>

          <Separator className="bg-border/60" />
        </CardContent>
      </Card>

      {/* ── ACCORDION LIST OF SEPARATE COST SUMMARIES ── */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <Wrench className="h-4.5 w-4.5 text-primary" />
          <h3 className="text-sm font-bold text-foreground">قائمة تكاليف كل مرة على حدة</h3>
        </div>

        <Accordion type="single" collapsible defaultValue={iterationGroups[0]?.id} className="w-full space-y-3">
          {iterationGroups.map((g) => {
            const statusCfg = STATUS_CONFIG[g.status || 'pending'];
            const taskProfit = g.taskCustomer - g.taskCompany;

            return (
              <AccordionItem 
                value={g.id} 
                key={g.id} 
                className={cn(
                  "border border-border/80 rounded-xl overflow-hidden bg-card transition-all shadow-sm",
                  g.isCurrent ? "border-primary/40 ring-1 ring-primary/10 shadow-primary/5" : "hover:border-border-hover"
                )}
              >
                <AccordionTrigger className={cn(
                  "px-4 py-3.5 hover:no-underline hover:bg-muted/10 transition-colors flex items-center justify-between w-full text-right gap-3 [&[data-state=open]>svg]:rotate-180",
                  g.isCurrent && "bg-primary/[0.02]"
                )}>
                  <div className="flex flex-1 items-center justify-between flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                      <span className={cn("text-sm font-bold text-right", g.isCurrent ? "text-primary" : "text-foreground")}>
                        {g.label}
                      </span>
                    </div>

                    <div className="flex items-center gap-3 text-xs font-semibold text-muted-foreground/80 pl-2">
                      <span>اللوحات: <strong className="text-foreground">{g.items.length}</strong></span>
                      <span className="text-muted-foreground/35">|</span>
                      <span>سعر الزبون: <strong className="text-primary font-bold">{g.taskCustomer.toLocaleString('ar-LY')} د.ل</strong></span>
                      <span className="text-muted-foreground/35">|</span>
                      <span>الربح: <strong className={cn(taskProfit >= 0 ? "text-emerald-600" : "text-destructive")}>
                        {taskProfit >= 0 ? '+' : ''}{taskProfit.toLocaleString('ar-LY')} د.ل
                      </strong></span>
                      <span className="text-muted-foreground/35">|</span>
                      <span className={cn("px-2 py-0.5 rounded-full border font-bold text-[9px]", statusCfg?.color)}>
                        {statusCfg?.label || 'مكتملة'}
                      </span>
                    </div>
                  </div>
                </AccordionTrigger>

                <AccordionContent className="p-4 pt-0 border-t border-border/40">
                  <div className="mt-4">
                    <TaskTotalCostSummary
                      taskId={g.id}
                      taskItems={g.items}
                      installationPrices={installationPrices}
                      billboards={billboards}
                      onRefresh={handleRefresh}
                      disabled={disabled}
                    />
                  </div>
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </div>
    </div>
  );
};
