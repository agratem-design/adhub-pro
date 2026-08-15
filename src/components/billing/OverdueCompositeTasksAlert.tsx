import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Clock, Layers, MessageCircle, Loader2 } from 'lucide-react';
import { formatAmount } from '@/lib/formatUtils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { useSendWhatsApp } from '@/hooks/useSendWhatsApp';

interface OverdueCompositeTask {
  id: string;
  taskNumber: number;
  taskType: string;
  customerName: string;
  customerTotal: number;
  paidAmount: number;
  remainingAmount: number;
  createdAt: string;
  daysOverdue: number;
  contractId: number | null;
  adType: string;
  contractIds?: number[];
  adTypes?: string[];
}

export function OverdueCompositeTasksAlert() {
  const [overdueTasks, setOverdueTasks] = useState<OverdueCompositeTask[]>([]);
  const [loading, setLoading] = useState(true);
  const { sendMessage } = useSendWhatsApp();
  const [sendingFor, setSendingFor] = useState<string | null>(null);

  useEffect(() => {
    loadOverdueTasks();
  }, []);

  const loadOverdueTasks = async () => {
    try {
      setLoading(true);
      const today = new Date();
      const overdue: OverdueCompositeTask[] = [];

      const { data: tasks, error } = await supabase
        .from('composite_tasks')
        .select('id, task_number, task_type, customer_name, customer_total, paid_amount, created_at, status, contract_id, installation_task_id')
        .not('status', 'eq', 'cancelled');

      if (error) {
        console.error('Error loading composite tasks:', error);
        return;
      }

      // Fetch all contract IDs from sub-tasks (installation task items)
      const installationTaskIds = Array.from(
        new Set((tasks || []).map(t => t.installation_task_id).filter(Boolean))
      ) as string[];

      const taskToContractsMap = new Map<string, number[]>();
      
      // Initialize map with task's default contract_id
      (tasks || []).forEach(t => {
        if (t.contract_id) {
          taskToContractsMap.set(t.id, [t.contract_id]);
        }
      });

      const realInstallMap = new Map<string, number>();

      if (installationTaskIds.length > 0) {
        const [installItemsRes, installTasksRes] = await Promise.all([
          supabase
            .from('installation_task_items')
            .select('task_id, customer_installation_cost, reinstall_count, customer_original_install_cost, customer_reinstall_cost, billboard:billboards!installation_task_items_billboard_id_fkey(Contract_Number)')
            .in('task_id', installationTaskIds),
          supabase
            .from('installation_tasks')
            .select('id, contract_ids, contract_id')
            .in('id', installationTaskIds)
        ]);

        const installItems = installItemsRes.data || [];
        const installTasksData = installTasksRes.data || [];

        // حساب تكاليف التركيب الحقيقية لكل مهمة
        installItems.forEach((row: any) => {
          const isReinstalled = (row.reinstall_count || 0) > 0;
          const origCost = Number(row.customer_original_install_cost) || Number(row.customer_installation_cost) || 0;
          const reinstallCost = isReinstalled
            ? (Number(row.customer_reinstall_cost) || Number(row.customer_installation_cost) || 0)
            : 0;
          const itemCost = isReinstalled ? (origCost + reinstallCost) : Number(row.customer_installation_cost) || 0;
          realInstallMap.set(row.task_id, (realInstallMap.get(row.task_id) || 0) + itemCost);
        });

        const installTaskToContracts = new Map<string, Set<number>>();
        
        // 1. Map from installation tasks table
        installTasksData.forEach((it: any) => {
          const ids = it.contract_ids || (it.contract_id ? [it.contract_id] : []);
          if (ids && ids.length > 0) {
            installTaskToContracts.set(it.id, new Set(ids.map(Number)));
          }
        });

        // 2. Map from installation task items
        installItems.forEach((row: any) => {
          const taskId = row.task_id as string;
          const contractNo = row.billboard?.Contract_Number;
          if (taskId && contractNo) {
            if (!installTaskToContracts.has(taskId)) {
              installTaskToContracts.set(taskId, new Set());
            }
            installTaskToContracts.get(taskId)!.add(Number(contractNo));
          }
        });

        (tasks || []).forEach(t => {
          const set = t.installation_task_id ? installTaskToContracts.get(t.installation_task_id) : undefined;
          const derived = set ? Array.from(set) : [];
          const existing = taskToContractsMap.get(t.id) || [];
          const combined = [...new Set([...existing, ...derived])].filter(Boolean);
          if (combined.length > 0) {
            taskToContractsMap.set(t.id, combined);
          }
        });
      }

      // Fetch ad types and customer info for all contract IDs
      const allContractIds = [...new Set(Array.from(taskToContractsMap.values()).flat())];
      const contractCustomerMap = new Map<number, { adType: string; customerId: string | null; customerName: string }>();
      
      if (allContractIds.length > 0) {
        const { data: contractsData } = await supabase
          .from('Contract')
          .select('Contract_Number, "Ad Type", "Customer Name", customer_id')
          .in('Contract_Number', allContractIds);
        for (const c of contractsData || []) {
          if (c.Contract_Number != null) {
            contractCustomerMap.set(c.Contract_Number, {
              adType: c['Ad Type'] || '',
              customerId: c.customer_id || null,
              customerName: c['Customer Name'] || '',
            });
          }
        }
      }

      for (const task of tasks || []) {
        const realInstallTotal = task.installation_task_id && realInstallMap.has(task.installation_task_id)
          ? realInstallMap.get(task.installation_task_id)!
          : null;
        const customerTotal = realInstallTotal !== null
          ? (realInstallTotal + (Number(task.customer_print_cost) || 0) + (Number(task.customer_cutout_cost) || 0) - (Number(task.discount_amount) || 0))
          : (Number(task.customer_total) || 0);
        const paidAmount = Number(task.paid_amount) || 0;
        const remaining = customerTotal - paidAmount;
        
        if (remaining <= 0 || customerTotal <= 0) continue;

        const createdAt = new Date(task.created_at || '');
        const diffDays = Math.ceil((today.getTime() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
        
        if (diffDays > 15) {
          const rawTaskContracts = taskToContractsMap.get(task.id) || [];
          
          // Filter contracts to only keep those belonging to this customer
          const taskContracts = rawTaskContracts.filter(cNum => {
            const cInfo = contractCustomerMap.get(cNum);
            if (!cInfo) return true;
            if (cInfo.customerId && task.customer_id) {
              return cInfo.customerId === task.customer_id;
            }
            return cInfo.customerName === task.customer_name;
          });

          const uniqueAdTypes = [...new Set(taskContracts.map(cId => contractCustomerMap.get(cId)?.adType).filter(Boolean))];

          overdue.push({
            id: task.id,
            taskNumber: task.task_number,
            taskType: task.task_type,
            customerName: task.customer_name || 'غير معروف',
            customerTotal,
            paidAmount,
            remainingAmount: remaining,
            createdAt: task.created_at || '',
            daysOverdue: diffDays,
            contractIds: taskContracts,
            adTypes: uniqueAdTypes,
            contractId: taskContracts[0] || null,
            adType: uniqueAdTypes.join(' / '),
          });
        }
      }

      overdue.sort((a, b) => b.remainingAmount - a.remainingAmount);
      setOverdueTasks(overdue.slice(0, 10));
    } catch (error) {
      console.error('Error loading overdue composite tasks:', error);
      toast.error('خطأ في تحميل المهام المجمعة المتأخرة');
    } finally {
      setLoading(false);
    }
  };

  const getTaskTypeLabel = (type: string) => {
    const map: Record<string, string> = {
      'installation_print': 'تركيب + طباعة',
      'installation_print_cutout': 'تركيب + طباعة + قص',
      'installation_cutout': 'تركيب + قص',
      'print_cutout': 'طباعة + قص',
      'installation': 'تركيب',
      'print': 'طباعة',
      'cutout': 'قص',
    };
    return map[type] || type;
  };

  const sendWhatsAppReminder = async (task: OverdueCompositeTask) => {
    setSendingFor(task.id);
    try {
      const { data: customer } = await supabase
        .from('customers')
        .select('phone')
        .eq('name', task.customerName)
        .maybeSingle();
      
      if (!customer?.phone) {
        toast.error('لا يوجد رقم هاتف مسجل لهذا العميل');
        return;
      }

      const contractText = task.contractIds && task.contractIds.length > 0
        ? `\nعقد/عقود رقم: ${task.contractIds.join(', ')}`
        : '';
      const adTypeText = task.adTypes && task.adTypes.length > 0
        ? `\nنوع الإعلان: ${task.adTypes.join(' / ')}`
        : '';

      const message = `مرحباً ${task.customerName},\nنود تذكيركم بوجود مبلغ متأخر قدره ${formatAmount(task.remainingAmount)} د.ل على مهمة ${getTaskTypeLabel(task.taskType)} رقم #${task.taskNumber}.${contractText}${adTypeText}\nعدد أيام التأخير: ${task.daysOverdue} يوم.\nنرجو التواصل معنا لتسوية المبلغ.\nشكراً لتعاونكم.`;

      await sendMessage({ phone: customer.phone, message });
    } catch (error) {
      console.error('Error sending WhatsApp:', error);
    } finally {
      setSendingFor(null);
    }
  };

  if (loading) {
    return (
      <Card className="border-purple-300 dark:border-purple-700">
        <CardContent className="p-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="h-5 w-5 animate-spin" />
            <span>جاري تحميل المهام المجمعة المتأخرة...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (overdueTasks.length === 0) return null;

  return (
    <Card className="border-purple-400 dark:border-purple-600 bg-gradient-to-br from-purple-500/5 to-violet-500/10">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-purple-600 dark:text-purple-400 text-base">
          <Layers className="h-5 w-5" />
          مهام مجمعة متأخرة ({overdueTasks.length})
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          {overdueTasks.map((task) => (
            <Card
              key={task.id}
              className="border-purple-300/40 dark:border-purple-700/40 bg-background hover:shadow-lg transition-all hover:-translate-y-1"
            >
              <CardContent className="p-4">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <Badge className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300 border-purple-300 dark:border-purple-700">
                      {task.daysOverdue} يوم
                    </Badge>
                    <span className="font-bold text-foreground text-sm">#{task.taskNumber}</span>
                  </div>
                  
                  <div className="space-y-2 text-sm">
                    <div className="font-semibold text-foreground truncate" title={task.customerName}>
                      {task.customerName}
                    </div>
                    {task.contractIds && task.contractIds.length > 0 ? (
                      <div className="text-xs text-muted-foreground">
                        {task.contractIds.length > 1 ? `عقود #${task.contractIds.join(', #')}` : `عقد #${task.contractIds[0]}`}
                        {task.adTypes && task.adTypes.length > 0 && (
                          <span className="mr-1 text-purple-600 dark:text-purple-400"> ({task.adTypes.join(' / ')})</span>
                        )}
                      </div>
                    ) : task.contractId ? (
                      <div className="text-xs text-muted-foreground">
                        عقد #{task.contractId}
                        {task.adType && <span className="mr-1 text-purple-600 dark:text-purple-400"> ({task.adType})</span>}
                      </div>
                    ) : null}
                    <div className="text-xs text-muted-foreground truncate">
                      {getTaskTypeLabel(task.taskType)}
                    </div>
                    <div className="text-purple-600 dark:text-purple-400 font-bold text-lg">
                      {formatAmount(task.remainingAmount)} د.ل
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(task.createdAt).toLocaleDateString('ar-LY')}
                    </div>
                  </div>

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => sendWhatsAppReminder(task)}
                    disabled={sendingFor === task.id}
                    className="w-full text-xs border-green-500 text-green-600 hover:bg-green-50 dark:hover:bg-green-950"
                  >
                    {sendingFor === task.id ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <MessageCircle className="h-3 w-3 ml-1" />
                    )}
                    تنبيه واتساب
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
