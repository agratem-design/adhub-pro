import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowRight, Scissors, RefreshCw, Plus } from 'lucide-react';
import { CutoutTasksTable } from '@/components/cutout-tasks/CutoutTasksTable';
import { CutoutTaskDetails } from '@/components/cutout-tasks/CutoutTaskDetails';
import { CreateManualCutoutTask } from '@/components/cutout-tasks/CreateManualCutoutTask';
import { UnifiedTaskInvoice, InvoiceType } from '@/components/composite-tasks/UnifiedTaskInvoice';
import { CompositeTaskWithDetails } from '@/types/composite-task';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface CutoutTask {
  id: string;
  installation_task_id?: string | null;
  contract_id?: number | null;
  customer_id?: string | null;
  customer_name: string | null;
  printer_id?: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  total_quantity: number;
  unit_cost: number;
  total_cost: number;
  customer_total_amount?: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  due_date?: string | null;
  completed_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
  printers?: { name: string } | null;
}

export default function CutoutTasks() {
  const queryClient = useQueryClient();
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [createManualDialogOpen, setCreateManualDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('customer');
  const [invoiceCompositeTask, setInvoiceCompositeTask] = useState<CompositeTaskWithDetails | null>(null);

  const { data: tasks = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['cutout-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cutout_tasks')
        .select(`
          *,
          printers:printer_id(name)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const list = (data || []) as any[];

      const installTaskIds = list.map(t => t.installation_task_id).filter(Boolean);
      
      if (installTaskIds.length > 0) {
        const { data: installItems } = await supabase
          .from('installation_task_items')
          .select('task_id, design_face_a, design_face_b')
          .in('task_id', installTaskIds);

        if (installItems) {
          const installDesignMap = new Map<string, string[]>();
          installItems.forEach((row: any) => {
            if (!row.task_id) return;
            if (!installDesignMap.has(row.task_id)) installDesignMap.set(row.task_id, []);
            const arr = installDesignMap.get(row.task_id)!;
            if (row.design_face_a && !arr.includes(row.design_face_a)) arr.push(row.design_face_a);
            if (row.design_face_b && !arr.includes(row.design_face_b)) arr.push(row.design_face_b);
          });
          list.forEach((t: any) => {
            t._designImages = t.installation_task_id ? (installDesignMap.get(t.installation_task_id) || []) : [];
          });
        }
      }
      list.forEach((t: any) => {
        if (!t._designImages) t._designImages = [];
        t._source = t.installation_task_id ? 'installation' : t.contract_id ? 'contract' : 'manual';
      });

      // Fetch ad_type from Contract table
      const contractIds = [...new Set(list.filter((t: any) => t.contract_id).map((t: any) => t.contract_id))];
      if (contractIds.length > 0) {
        const { data: contracts } = await supabase
          .from('Contract')
          .select('"Contract_Number", "Ad Type"')
          .in('Contract_Number', contractIds);
        if (contracts) {
          const adTypeMap = new Map<number, string>();
          contracts.forEach((c: any) => { if (c['Ad Type']) adTypeMap.set(c.Contract_Number, c['Ad Type']); });
          list.forEach((t: any) => { t._adType = t.contract_id ? (adTypeMap.get(t.contract_id) || null) : null; });
        }
      }

      return list as any as CutoutTask[];
    },
  });

  const selectedTask = selectedTaskId ? tasks.find(t => t.id === selectedTaskId) || null : null;

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const { error } = await supabase
        .from('cutout_tasks')
        .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null })
        .eq('id', taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تحديث الحالة');
      refetch();
    },
    onError: () => { toast.error('فشل في تحديث الحالة'); },
  });

  const handlePrintInvoice = async (task: any, type: 'customer' | 'cutout_vendor' | 'installation_team') => {
    const { data } = await supabase
      .from('composite_tasks')
      .select('*')
      .eq('cutout_task_id', task.id)
      .maybeSingle();
    if (!data) {
      toast.error('لا توجد مهمة مجمعة مرتبطة');
      return;
    }
    setInvoiceCompositeTask(data as CompositeTaskWithDetails);
    setInvoiceType(type);
    setInvoiceDialogOpen(true);
  };

  const handleRefresh = () => {
    refetch();
    queryClient.invalidateQueries({ queryKey: ['cutout-task-items'] });
  };

  const stats = {
    total: tasks.length,
    pending: tasks.filter(t => t.status === 'pending').length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    noPrinter: tasks.filter(t => !t.printer_id).length,
    totalQuantity: tasks.reduce((sum, t) => sum + (t.total_quantity || 0), 0),
    totalCost: tasks.reduce((sum, t) => sum + (t.total_cost || 0), 0),
    totalRevenue: tasks.reduce((sum, t) => sum + (t.customer_total_amount || 0), 0),
  };

  return (
    <div className="flex flex-col min-h-full">
      <AnimatePresence mode="wait">
        {selectedTask ? (
          <motion.div
            key="detail"
            initial={{ opacity: 0, x: -30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 30 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="flex-1 overflow-auto p-6"
          >
            <div className="mb-4 flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setSelectedTaskId(null)} className="gap-2 text-muted-foreground hover:text-foreground">
                <ArrowRight className="h-4 w-4" />
                العودة للقائمة
              </Button>
              <div className="flex items-center gap-2">
                <Scissors className="h-5 w-5 text-purple-500" />
                <h2 className="text-lg font-bold">{selectedTask.customer_name || 'مهمة مجسمات'}</h2>
                {selectedTask.contract_id && (
                  <span className="text-sm text-muted-foreground font-mono">#{selectedTask.contract_id}</span>
                )}
              </div>
            </div>
            <CutoutTaskDetails task={selectedTask} />
          </motion.div>
        ) : (
          <motion.div
            key="list"
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="flex-1 overflow-auto p-3 sm:p-6"
          >
            <div className="mb-6 flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-card/45 backdrop-blur-md border border-border/30 rounded-[22px] p-5 shadow-lg select-none">
              <div className="space-y-1 text-right">
                <h1 className="text-3xl font-black tracking-tight text-foreground bg-gradient-to-r from-foreground to-foreground/80 bg-clip-text">
                  مهام المجسمات
                </h1>
                <p className="text-xs font-medium text-muted-foreground/80">
                  إدارة ومتابعة مهام قص وتجهيز المجسمات الإعلانية
                </p>
              </div>
              
              <div className="flex flex-wrap items-center gap-2 mr-auto" onClick={e => e.stopPropagation()}>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 rounded-xl px-4 h-10 text-xs font-bold bg-background/50 border-border/30 text-muted-foreground hover:text-foreground hover:bg-muted/40 hover:border-primary/30 transition-all hover:scale-[1.02]" 
                  onClick={handleRefresh} 
                  disabled={isLoading || isFetching}
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-purple-500 ${isFetching ? 'animate-spin' : ''}`} />
                  تحديث البيانات
                </Button>

                <Button 
                  size="sm" 
                  className="gap-2 rounded-xl px-5 h-10 text-xs font-black bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 text-white shadow-lg shadow-purple-500/25 transition-all hover:scale-[1.02]" 
                  onClick={() => setCreateManualDialogOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  مهمة مجسمات يدوية
                </Button>
              </div>
            </div>
            <CutoutTasksTable
              tasks={tasks}
              isLoading={isLoading}
              stats={stats}
              onOpenTask={(task) => setSelectedTaskId(task.id)}
              onAddTask={() => setCreateManualDialogOpen(true)}
              onRefresh={handleRefresh}
              isFetching={isFetching}
              onStatusChange={(taskId, status) => updateTaskStatusMutation.mutate({ taskId, status })}
              onPrintInvoice={handlePrintInvoice}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <CreateManualCutoutTask
        open={createManualDialogOpen}
        onOpenChange={setCreateManualDialogOpen}
        onSuccess={() => refetch()}
      />

      {invoiceCompositeTask && (
        <UnifiedTaskInvoice
          open={invoiceDialogOpen}
          onOpenChange={setInvoiceDialogOpen}
          task={invoiceCompositeTask}
          invoiceType={invoiceType}
        />
      )}
    </div>
  );
}
