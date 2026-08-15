import { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { ArrowRight, Printer, Trash2, RefreshCw, Plus } from 'lucide-react';
import { PrintTasksTable } from '@/components/print-tasks/PrintTasksTable';
import { PrintTaskDetails } from '@/components/print-tasks/PrintTaskDetails';
import { CreateManualPrintTask } from '@/components/print-tasks/CreateManualPrintTask';
import { UnifiedTaskInvoice, InvoiceType } from '@/components/composite-tasks/UnifiedTaskInvoice';
import { CompositeTaskWithDetails } from '@/types/composite-task';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

interface PrintTask {
  id: string;
  invoice_id: string | null;
  contract_id: number | null;
  customer_id: string | null;
  customer_name: string | null;
  printer_id: string | null;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  total_area: number;
  total_cost: number;
  customer_total_amount: number;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  price_per_meter: number;
  due_date: string | null;
  completed_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  is_composite: boolean;
  printers?: { name: string } | null;
  printed_invoices?: { invoice_number: string } | null;
  _contractIds?: number[];
}

export default function PrintTasks() {
  const queryClient = useQueryClient();
  const [selectedTask, setSelectedTask] = useState<any | null>(null);
  const [createManualDialogOpen, setCreateManualDialogOpen] = useState(false);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [invoiceType, setInvoiceType] = useState<InvoiceType>('customer');
  const [invoiceCompositeTask, setInvoiceCompositeTask] = useState<CompositeTaskWithDetails | null>(null);

  const { data: tasks = [], isLoading, refetch, isFetching } = useQuery({
    queryKey: ['print-tasks'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('print_tasks')
        .select(`
          *,
          printers!print_tasks_printer_id_fkey(name),
          printed_invoices!print_tasks_invoice_id_fkey(invoice_number)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const list = (data || []) as any[];

      // Derive contract IDs and design images from print task items
      const taskIds = list.map(t => t.id).filter(Boolean);
      if (taskIds.length > 0) {
        const { data: itemContracts, error: itemContractsError } = await supabase
          .from('print_task_items')
          .select('task_id, design_face_a, design_face_b, billboard:billboards!print_task_items_billboard_id_fkey(Contract_Number)')
          .in('task_id', taskIds);

        if (!itemContractsError) {
          const map = new Map<string, Set<number>>();
          const designMap = new Map<string, string[]>();
          (itemContracts || []).forEach((row: any) => {
            const id = row.task_id as string;
            const n = row.billboard?.Contract_Number;
            if (!id) return;
            if (n) {
              if (!map.has(id)) map.set(id, new Set());
              map.get(id)!.add(Number(n));
            }
            // Collect unique design URLs
            if (!designMap.has(id)) designMap.set(id, []);
            const designs = designMap.get(id)!;
            if (row.design_face_a && !designs.includes(row.design_face_a)) designs.push(row.design_face_a);
            if (row.design_face_b && !designs.includes(row.design_face_b)) designs.push(row.design_face_b);
          });

          list.forEach((t: any) => {
            const set = map.get(t.id);
            const derived = set ? Array.from(set).sort((a, b) => a - b) : [];
            t._contractIds = derived.length > 0 ? derived : [t.contract_id].filter(Boolean);
            t._designImages = designMap.get(t.id) || [];
          });
        } else {
          list.forEach((t: any) => { t._contractIds = [t.contract_id].filter(Boolean); t._designImages = []; });
        }
      }

      list.forEach((t: any) => {
        if (!t._contractIds || !Array.isArray(t._contractIds) || t._contractIds.length === 0) {
          t._contractIds = [t.contract_id].filter(Boolean);
        }
        if (!t._designImages) t._designImages = [];
        // Determine source
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

      // Fallback: fetch designs from installation_task_items for tasks with no designs
      const tasksWithoutDesigns = list.filter((t: any) => t._designImages.length === 0 && t.installation_task_id);
      if (tasksWithoutDesigns.length > 0) {
        const installIds = tasksWithoutDesigns.map((t: any) => t.installation_task_id).filter(Boolean);
        const { data: installItems } = await supabase
          .from('installation_task_items')
          .select('task_id, design_face_a, design_face_b')
          .in('task_id', installIds);

        if (installItems) {
          const installDesignMap = new Map<string, string[]>();
          installItems.forEach((row: any) => {
            if (!row.task_id) return;
            if (!installDesignMap.has(row.task_id)) installDesignMap.set(row.task_id, []);
            const arr = installDesignMap.get(row.task_id)!;
            if (row.design_face_a && !arr.includes(row.design_face_a)) arr.push(row.design_face_a);
            if (row.design_face_b && !arr.includes(row.design_face_b)) arr.push(row.design_face_b);
          });
          tasksWithoutDesigns.forEach((t: any) => {
            t._designImages = installDesignMap.get(t.installation_task_id) || [];
          });
        }
      }

      return list as any as PrintTask[];
    },
  });

  const cleanupDuplicatesMutation = useMutation({
    mutationFn: async () => {
      const { data: duplicates, error: fetchError } = await supabase
        .from('print_tasks')
        .select('id, contract_id, is_composite, created_at')
        .eq('is_composite', false)
        .order('created_at', { ascending: true });
      if (fetchError) throw fetchError;
      const contractTasks: Record<number, string[]> = {};
      duplicates?.forEach(task => {
        if (task.contract_id) {
          if (!contractTasks[task.contract_id]) contractTasks[task.contract_id] = [];
          contractTasks[task.contract_id].push(task.id);
        }
      });
      const tasksToDelete: string[] = [];
      Object.values(contractTasks).forEach(taskIds => {
        if (taskIds.length > 1) tasksToDelete.push(...taskIds.slice(0, -1));
      });
      if (tasksToDelete.length === 0) return { deleted: 0 };
      await supabase.from('print_task_items').delete().in('task_id', tasksToDelete);
      const { error: deleteError } = await supabase.from('print_tasks').delete().in('id', tasksToDelete);
      if (deleteError) throw deleteError;
      return { deleted: tasksToDelete.length };
    },
    onSuccess: (data) => { toast.success(`تم حذف ${data.deleted} مهمة مكررة`); refetch(); },
    onError: () => { toast.error('فشل في حذف المهام المكررة'); },
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: async ({ taskId, status }: { taskId: string; status: string }) => {
      const { error } = await supabase
        .from('print_tasks')
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

  const handlePrintInvoice = async (task: any, type: 'customer' | 'print_vendor' | 'installation_team') => {
    const { data } = await supabase
      .from('composite_tasks')
      .select('*')
      .eq('print_task_id', task.id)
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
    queryClient.invalidateQueries({ queryKey: ['print-task-items'] });
  };

  const duplicateCount = tasks.filter(t => !t.is_composite).reduce((acc, task) => {
    const key = task.contract_id?.toString() || '';
    if (!acc.seen[key]) { acc.seen[key] = true; } else { acc.count++; }
    return acc;
  }, { seen: {} as Record<string, boolean>, count: 0 }).count;

  const stats = {
    total: tasks.length,
    inProgress: tasks.filter(t => t.status === 'in_progress').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    pending: tasks.filter(t => t.status === 'pending').length,
    noPrinter: tasks.filter(t => !t.printer_id).length,
    totalArea: tasks.reduce((sum, t) => sum + (t.total_area || 0), 0),
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
            className="flex-1 overflow-auto p-3 sm:p-6"
          >
            {/* Back button + header */}
            <div className="mb-4 flex flex-col sm:flex-row sm:items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setSelectedTask(null)} className="gap-2 text-muted-foreground hover:text-foreground w-fit">
                <ArrowRight className="h-4 w-4" />
                العودة للقائمة
              </Button>
              <div className="flex items-center gap-2">
                <Printer className="h-5 w-5 text-blue-500" />
                <h2 className="text-base sm:text-lg font-bold truncate">{selectedTask.customer_name || 'مهمة طباعة'}</h2>
                {selectedTask.contract_id && (
                  <span className="text-sm text-muted-foreground font-mono">#{selectedTask.contract_id}</span>
                )}
              </div>
            </div>
            <PrintTaskDetails task={selectedTask} />
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
                  مهام الطباعة
                </h1>
                <p className="text-xs font-medium text-muted-foreground/80">
                  إدارة ومتابعة مهام طباعة اللوحات الإعلانية
                </p>
              </div>
              
              <div className="flex flex-wrap items-center gap-2 mr-auto" onClick={e => e.stopPropagation()}>
                {duplicateCount > 0 && (
                  <Button 
                    variant="destructive" 
                    size="sm" 
                    className="gap-2 rounded-xl px-4 h-10 text-xs font-black bg-red-500/10 text-red-400 border border-red-500/25 hover:bg-red-500/20 hover:border-red-500/40 transition-all hover:scale-[1.02]" 
                    onClick={() => cleanupDuplicatesMutation.mutate()} 
                    disabled={cleanupDuplicatesMutation.isPending}
                  >
                    <Trash2 className="h-3.5 w-3.5 animate-pulse" />
                    حذف {duplicateCount} مكررة
                  </Button>
                )}
                
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="gap-2 rounded-xl px-4 h-10 text-xs font-bold bg-background/50 border-border/30 text-muted-foreground hover:text-foreground hover:bg-muted/40 hover:border-primary/30 transition-all hover:scale-[1.02]" 
                  onClick={handleRefresh} 
                  disabled={isLoading || isFetching}
                >
                  <RefreshCw className={`h-3.5 w-3.5 text-blue-500 ${isFetching ? 'animate-spin' : ''}`} />
                  تحديث البيانات
                </Button>

                <Button 
                  size="sm" 
                  className="gap-2 rounded-xl px-5 h-10 text-xs font-black bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-lg shadow-blue-500/25 transition-all hover:scale-[1.02]" 
                  onClick={() => setCreateManualDialogOpen(true)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  مهمة طباعة يدوية
                </Button>
              </div>
            </div>
            <PrintTasksTable
              tasks={tasks}
              isLoading={isLoading}
              stats={stats}
              onOpenTask={(task) => setSelectedTask(task)}
              onAddTask={() => setCreateManualDialogOpen(true)}
              onRefresh={handleRefresh}
              onDeleteDuplicates={() => cleanupDuplicatesMutation.mutate()}
              duplicateCount={duplicateCount}
              isFetching={isFetching}
              onStatusChange={(taskId, status) => updateTaskStatusMutation.mutate({ taskId, status })}
              onPrintInvoice={handlePrintInvoice}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <CreateManualPrintTask
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
