import React, { useState, useEffect } from 'react';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Scissors, Clock, CheckCircle2, AlertCircle, Package, Trash2, Printer, Building2, Save, FileText, Edit2, X, ZoomIn, MapPin, Landmark } from 'lucide-react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { CutoutCostSummary } from './CutoutCostSummary';
import { UnifiedTaskInvoice, InvoiceType } from '@/components/composite-tasks/UnifiedTaskInvoice';
import { CompositeTaskWithDetails } from '@/types/composite-task';
import { DesignImageWithBlur } from '@/components/DesignImageWithBlur';

interface CutoutTask {
  id: string;
  customer_name: string | null;
  status: string;
  total_quantity: number;
  unit_cost: number;
  total_cost: number;
  priority: string;
  due_date?: string | null;
  completed_at?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at?: string;
  printers?: { name: string } | null;
  customer_total_amount?: number;
  printer_id?: string;
  installation_task_id?: string | null;
  invoice_id?: string | null;
  contract_id?: number | null;
}

interface CutoutTaskItem {
  id: string;
  description: string | null;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  cutout_image_url: string | null;
  status: string;
  billboard_id: number | null;
  billboard_name?: string | null;
  billboard_size?: string | null;
  nearest_landmark?: string | null;
  district?: string | null;
  face_type?: 'A' | 'B' | null;
  billboard?: {
    design_face_a: string | null;
    design_face_b: string | null;
    Billboard_Name: string | null;
    Size: string | null;
    Nearest_Landmark: string | null;
    District: string | null;
    Faces_Count: number | null;
    Image_URL: string | null;
  } | null;
}

interface CutoutTaskDetailsProps {
  task: CutoutTask | null;
}

export function CutoutTaskDetails({ task }: CutoutTaskDetailsProps) {
  const queryClient = useQueryClient();
  const { confirm: systemConfirm } = useSystemDialog();
  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(task?.printer_id || null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [currentInvoiceType, setCurrentInvoiceType] = useState<InvoiceType>('customer');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // جلب المهمة المجمعة المرتبطة
  const { data: linkedCompositeTask } = useQuery({
    queryKey: ['linked-composite-task-cutout', task?.id],
    enabled: !!task?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('composite_tasks')
        .select('*')
        .eq('cutout_task_id', task!.id)
        .maybeSingle();
      if (error) throw error;
      return data as CompositeTaskWithDetails | null;
    }
  });

  const { data: printers = [] } = useQuery({
    queryKey: ['printers'],
    queryFn: async () => {
      const { data, error } = await supabase.from('printers').select('id, name').order('name');
      if (error) throw error;
      return data || [];
    }
  });

  useEffect(() => {
    setSelectedPrinterId(task?.printer_id || null);
  }, [task?.printer_id]);

  const { data: items = [], isLoading } = useQuery({
    queryKey: ['cutout-task-items', task?.id],
    queryFn: async () => {
      if (!task?.id) return [];
      const { data, error } = await supabase
        .from('cutout_task_items')
        .select('*')
        .eq('task_id', task.id)
        .order('created_at', { ascending: true });
      if (error) throw error;
      
      const itemsList = (data || []) as any[];
      
      // Fetch billboard basic info
      const billboardIds = itemsList.map(i => i.billboard_id).filter(Boolean);
      if (billboardIds.length > 0) {
        const { data: billboards } = await supabase
          .from('billboards')
          .select('ID, design_face_a, design_face_b, Billboard_Name, Size, Nearest_Landmark, District, Faces_Count, Image_URL')
          .in('ID', billboardIds);
        
        // Fetch design images from installation_task_items (most reliable source)
        let designMap = new Map<number, { design_face_a: string | null; design_face_b: string | null }>();
        if (task.contract_id) {
          const { data: installItems } = await supabase
            .from('installation_task_items')
            .select('billboard_id, design_face_a, design_face_b, task_id')
            .in('billboard_id', billboardIds);
          
          if (installItems) {
            // Filter by contract_id through installation_tasks
            const taskIds = [...new Set(installItems.map(i => i.task_id))];
            if (taskIds.length > 0) {
              const { data: installTasks } = await supabase
                .from('installation_tasks')
                .select('id, contract_id')
                .in('id', taskIds)
                .eq('contract_id', task.contract_id);
              
              const validTaskIds = new Set(installTasks?.map(t => t.id) || []);
              
              installItems.forEach((item: any) => {
                if (!validTaskIds.has(item.task_id)) return;
                const existing = designMap.get(item.billboard_id) || { design_face_a: null, design_face_b: null };
                if (item.design_face_a) existing.design_face_a = item.design_face_a;
                if (item.design_face_b) existing.design_face_b = item.design_face_b;
                designMap.set(item.billboard_id, existing);
              });
            }
          }
          
          // Fallback: try print_task_items if no designs found
          if (designMap.size === 0) {
            const { data: printItems } = await supabase
              .from('print_task_items')
              .select('billboard_id, design_face_a, design_face_b, task_id')
              .in('billboard_id', billboardIds);
            
            if (printItems) {
              const taskIds = [...new Set(printItems.map(i => i.task_id))];
              if (taskIds.length > 0) {
                const { data: printTasks } = await supabase
                  .from('print_tasks')
                  .select('id, contract_id')
                  .in('id', taskIds)
                  .eq('contract_id', task.contract_id);
                
                const validTaskIds = new Set(printTasks?.map(t => t.id) || []);
                
                printItems.forEach((item: any) => {
                  if (!validTaskIds.has(item.task_id)) return;
                  const existing = designMap.get(item.billboard_id) || { design_face_a: null, design_face_b: null };
                  if (item.design_face_a) existing.design_face_a = item.design_face_a;
                  if (item.design_face_b) existing.design_face_b = item.design_face_b;
                  designMap.set(item.billboard_id, existing);
                });
              }
            }
          }
        }
        
        if (billboards) {
          const bbMap = new Map<number, any>();
          billboards.forEach((b: any) => {
            const designs = designMap.get(b.ID);
            bbMap.set(b.ID, {
              ...b,
              design_face_a: designs?.design_face_a || b.design_face_a || null,
              design_face_b: designs?.design_face_b || b.design_face_b || null,
              Faces_Count: b.Faces_Count || 1,
            });
          });
          itemsList.forEach((item: any) => {
            if (item.billboard_id) {
              const bb = bbMap.get(item.billboard_id);
              item.billboard = bb || null;
              if (bb) {
                item.billboard_name = bb.Billboard_Name || null;
                item.billboard_size = bb.Size || null;
                item.nearest_landmark = bb.Nearest_Landmark || null;
                item.district = bb.District || null;
                // Detect face type from description
                item.face_type = (item.description?.includes('خلفي') || item.description?.includes('B')) ? 'B' : 'A';
              }
            }
          });
        }
      }
      
      return itemsList as CutoutTaskItem[];
    },
    enabled: !!task?.id
  });

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      if (!task?.id) return;
      const { error } = await supabase
        .from('cutout_tasks')
        .update({ status, completed_at: status === 'completed' ? new Date().toISOString() : null })
        .eq('id', task.id);
      if (error) throw error;
      
      // Sync items status with task status
      const itemStatus = status === 'completed' ? 'completed' : status === 'cancelled' ? 'cancelled' : 'pending';
      const { error: itemsError } = await supabase
        .from('cutout_task_items')
        .update({ status: itemStatus })
        .eq('task_id', task.id);
      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      toast.success('تم تحديث حالة المهمة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['cutout-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['cutout-task-items', task?.id] });
    },
    onError: (error: any) => { toast.error('فشل في تحديث الحالة: ' + error.message); }
  });

  const updatePrinterMutation = useMutation({
    mutationFn: async (printerId: string) => {
      if (!task?.id) return;
      const { error } = await supabase.from('cutout_tasks').update({ printer_id: printerId }).eq('id', task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تحديد المطبعة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['cutout-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['printer-accounts'] });
    },
    onError: (error: any) => { toast.error('فشل في تحديد المطبعة: ' + error.message); }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async () => {
      if (!task?.id) return;
      await supabase.from('installation_tasks').update({ cutout_task_id: null }).eq('cutout_task_id', task.id);
      if (task.invoice_id) {
        await supabase.from('printed_invoices').delete().eq('id', task.invoice_id);
      }
      await supabase.from('cutout_tasks').update({ installation_task_id: null, invoice_id: null }).eq('id', task.id);
      const { error } = await supabase.from('cutout_tasks').delete().eq('id', task.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم حذف مهمة المجسمات بنجاح');
      queryClient.invalidateQueries({ queryKey: ['cutout-tasks'] });
    },
    onError: (error: any) => { toast.error('فشل في حذف المهمة: ' + error.message); }
  });

  const deleteBillboardGroupMutation = useMutation({
    mutationFn: async (billboardId: number) => {
      const itemIds = items
        .filter(i => i.billboard_id === billboardId)
        .map(i => i.id);
      if (itemIds.length === 0) return;
      const { error } = await supabase
        .from('cutout_task_items')
        .delete()
        .in('id', itemIds);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم حذف اللوحة من مهمة المجسمات');
      queryClient.invalidateQueries({ queryKey: ['cutout-task-items', task?.id] });
      queryClient.invalidateQueries({ queryKey: ['cutout-tasks'] });
    },
    onError: (error: any) => { toast.error('فشل في حذف اللوحة: ' + error.message); }
  });

  if (!task) {
    return (
      <div className="flex items-center justify-center h-full text-muted-foreground">
        <div className="text-center">
          <Package className="h-16 w-16 mx-auto mb-4 opacity-50" />
          <p>اختر مهمة لعرض التفاصيل</p>
        </div>
      </div>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return CheckCircle2;
      case 'in_progress': return Scissors;
      case 'cancelled': return AlertCircle;
      default: return Clock;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400';
      case 'in_progress': return 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-400';
      case 'cancelled': return 'bg-red-100 text-red-700 dark:bg-red-900/50 dark:text-red-400';
      default: return 'bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-400';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'completed': return 'مكتمل';
      case 'in_progress': return 'قيد التنفيذ';
      case 'cancelled': return 'ملغي';
      default: return 'معلق';
    }
  };

  const StatusIcon = getStatusIcon(task.status);
  
  // Use composite task data if available for accurate pricing
  const displayCustomerAmount = linkedCompositeTask?.customer_cutout_cost || task.customer_total_amount || 0;
  const displayTotalCost = linkedCompositeTask?.company_cutout_cost || task.total_cost || 0;
  const profit = displayCustomerAmount - displayTotalCost;
  const profitPercentage = displayCustomerAmount > 0 ? ((profit / displayCustomerAmount) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-purple-500 to-pink-600 text-white shadow-lg shadow-purple-500/25">
            <Scissors className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{task.customer_name || 'بدون اسم'}</h2>
            <p className="text-sm text-muted-foreground">
              {task.contract_id ? `عقد رقم: ${task.contract_id} | ` : ''}مهمة #{task.id.slice(0, 8)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Badge className={`${getStatusColor(task.status)} gap-1 px-3 py-1`}>
            <StatusIcon className="h-4 w-4" />
            {getStatusLabel(task.status)}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950/50 border-red-200 dark:border-red-800"
            onClick={async () => {
              if (await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذه المهمة؟', variant: 'destructive', confirmText: 'حذف' })) {
                deleteTaskMutation.mutate();
              }
            }}
            disabled={deleteTaskMutation.isPending}
          >
            <Trash2 className="h-4 w-4 mr-2" />
            حذف المهمة
          </Button>
        </div>
      </div>

      {/* Task Status + Invoices at top */}
      <div className="flex flex-wrap items-center gap-3 p-3 bg-muted/30 rounded-lg">
        <label className="text-sm font-medium">حالة المهمة الكلية:</label>
        <Select
          value={task.status}
          onValueChange={(value) => updateStatusMutation.mutate(value)}
          disabled={updateStatusMutation.isPending}
        >
          <SelectTrigger className="w-48">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">معلق</SelectItem>
            <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
            <SelectItem value="completed">مكتمل</SelectItem>
            <SelectItem value="cancelled">ملغي</SelectItem>
          </SelectContent>
        </Select>

        <div className="mr-auto" />

        {linkedCompositeTask ? (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCurrentInvoiceType('cutout_vendor');
                setInvoiceDialogOpen(true);
              }}
              className="gap-2"
            >
              <Printer className="h-4 w-4" />
              فاتورة المطبعة
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCurrentInvoiceType('customer');
                setInvoiceDialogOpen(true);
              }}
              className="gap-2"
            >
              <FileText className="h-4 w-4" />
              فاتورة الزبون
            </Button>
          </>
        ) : (
          <span className="text-xs text-muted-foreground">لا توجد مهمة مجمعة مرتبطة للفواتير</span>
        )}
      </div>

      {/* Printer Selection Card */}
      {!task.printer_id && (
        <Card className="border-2 border-purple-200 dark:border-purple-800 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/30 dark:to-pink-950/30 shadow-lg">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2 text-purple-700 dark:text-purple-400">
              <Building2 className="h-5 w-5" />
              اختر المطبعة لهذه المهمة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-3">
              <Select value={selectedPrinterId || ''} onValueChange={(value) => setSelectedPrinterId(value)}>
                <SelectTrigger className="flex-1 bg-white dark:bg-slate-800">
                  <SelectValue placeholder="اختر المطبعة..." />
                </SelectTrigger>
                <SelectContent>
                  {printers.map((printer) => (
                    <SelectItem key={printer.id} value={printer.id}>{printer.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                onClick={() => { if (selectedPrinterId) updatePrinterMutation.mutate(selectedPrinterId); }}
                disabled={!selectedPrinterId || updatePrinterMutation.isPending}
                className="bg-purple-600 hover:bg-purple-700"
              >
                <Save className="h-4 w-4 mr-2" />
                تأكيد
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Basic Info Card */}
      <Card className="border-0 shadow-md bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border-b">
          <h3 className="font-semibold text-slate-700 dark:text-slate-200">معلومات المهمة</h3>
        </div>
        <div className="p-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
              <span className="text-xs text-muted-foreground block mb-1">المطبعة</span>
              {task.printer_id ? (
                <span className="font-semibold text-slate-700 dark:text-slate-200">{task.printers?.name || '-'}</span>
              ) : (
                <Select
                  value={selectedPrinterId || ''}
                  onValueChange={(value) => { setSelectedPrinterId(value); updatePrinterMutation.mutate(value); }}
                  disabled={updatePrinterMutation.isPending}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="اختر..." />
                  </SelectTrigger>
                  <SelectContent>
                    {printers.map((printer) => (
                      <SelectItem key={printer.id} value={printer.id}>{printer.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
              <span className="text-xs text-muted-foreground block mb-1">إجمالي القطع</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{task.total_quantity} قطعة</span>
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
              <span className="text-xs text-muted-foreground block mb-1">تاريخ الإنشاء</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {format(new Date(task.created_at), 'dd/MM/yyyy', { locale: ar })}
              </span>
            </div>
            {task.completed_at && (
              <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-900/30">
                <span className="text-xs text-emerald-600 dark:text-emerald-400 block mb-1">تاريخ الإكمال</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                  {format(new Date(task.completed_at), 'dd/MM/yyyy', { locale: ar })}
                </span>
              </div>
            )}
          </div>
          
          {task.notes && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <span className="text-xs text-muted-foreground block mb-1">ملاحظات</span>
              <p className="text-sm text-slate-600 dark:text-slate-300">{task.notes}</p>
            </div>
          )}
        </div>
      </Card>

      {/* Pricing Summary Cards */}
      {(() => {
        const totalQty = items.reduce((sum, i) => sum + i.quantity, 0);
        const customerUnitPrice = totalQty > 0 ? displayCustomerAmount / totalQty : 0;
        return (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <div className="p-4 rounded-xl bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/50 dark:to-pink-950/50 border border-purple-100 dark:border-purple-800">
              <span className="text-xs text-purple-600 dark:text-purple-400 font-medium block mb-1">سعر الزبون الإجمالي</span>
              <span className="font-bold text-xl text-purple-700 dark:text-purple-300">{displayCustomerAmount.toLocaleString()}</span>
              <span className="text-xs text-purple-600 dark:text-purple-400"> د.ل</span>
            </div>

            <div className="p-4 rounded-xl bg-gradient-to-br from-indigo-50 to-blue-50 dark:from-indigo-950/50 dark:to-blue-950/50 border border-indigo-100 dark:border-indigo-800">
              <span className="text-xs text-indigo-600 dark:text-indigo-400 font-medium block mb-1">سعر الوحدة للزبون</span>
              <span className="font-bold text-xl text-indigo-700 dark:text-indigo-300">{customerUnitPrice.toFixed(0)}</span>
              <span className="text-xs text-indigo-600 dark:text-indigo-400"> د.ل</span>
            </div>
            
            <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border border-slate-200 dark:border-slate-600">
              <span className="text-xs text-slate-600 dark:text-slate-400 font-medium block mb-1">تكلفة المطبعة</span>
              <span className="font-bold text-xl text-slate-700 dark:text-slate-200">{displayTotalCost.toLocaleString()}</span>
              <span className="text-xs text-slate-600 dark:text-slate-400"> د.ل</span>
            </div>
            
            <div className={`p-4 rounded-xl border ${profit >= 0 
              ? 'bg-gradient-to-br from-emerald-50 to-green-50 dark:from-emerald-950/50 dark:to-green-950/50 border-emerald-200 dark:border-emerald-800' 
              : 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/50 dark:to-rose-950/50 border-red-200 dark:border-red-800'}`}>
              <span className={`text-xs font-medium block mb-1 ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                الربح
              </span>
              <span className={`font-bold text-xl ${profit >= 0 ? 'text-emerald-700 dark:text-emerald-300' : 'text-red-700 dark:text-red-300'}`}>
                {profit.toLocaleString()}
              </span>
              <span className={`text-xs ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}> د.ل</span>
            </div>
            
            <div className={`p-4 rounded-xl border ${profitPercentage >= 0 
              ? 'bg-gradient-to-br from-violet-50 to-purple-50 dark:from-violet-950/50 dark:to-purple-950/50 border-violet-200 dark:border-violet-800' 
              : 'bg-gradient-to-br from-red-50 to-rose-50 dark:from-red-950/50 dark:to-rose-950/50 border-red-200 dark:border-red-800'}`}>
              <span className={`text-xs font-medium block mb-1 ${profitPercentage >= 0 ? 'text-violet-600 dark:text-violet-400' : 'text-red-600 dark:text-red-400'}`}>
                نسبة الربح
              </span>
              <span className={`font-bold text-xl ${profitPercentage >= 0 ? 'text-violet-700 dark:text-violet-300' : 'text-red-700 dark:text-red-300'}`}>
                {profitPercentage.toFixed(1)}%
              </span>
            </div>
          </div>
        );
      })()}

      {/* Detailed Cost Summary */}
      <CutoutCostSummary
        taskId={task.id}
        items={items}
        customerTotalAmount={displayCustomerAmount}
        unitCost={task.unit_cost || 0}
        totalCost={displayTotalCost}
        onRefresh={() => {
          queryClient.invalidateQueries({ queryKey: ['cutout-tasks'] });
          queryClient.invalidateQueries({ queryKey: ['cutout-task-items', task.id] });
          queryClient.invalidateQueries({ queryKey: ['linked-composite-task-cutout', task.id] });
        }}
      />

      {/* Items - grouped by billboard */}
      <Card className="border-0 shadow-md bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border-b">
          <h3 className="font-semibold text-slate-700 dark:text-slate-200">عناصر المهمة ({items.length} عنصر)</h3>
        </div>
        <div className="p-4">
          {isLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 w-full" />)}
            </div>
          ) : items.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا توجد عناصر لهذه المهمة</p>
          ) : (
            <div className="space-y-4">
              {(() => {
                // Group items by billboard_id
                const billboardGroups = new Map<string, CutoutTaskItem[]>();
                items.forEach(item => {
                  const key = item.billboard_id?.toString() || `solo_${item.id}`;
                  if (!billboardGroups.has(key)) billboardGroups.set(key, []);
                  billboardGroups.get(key)!.push(item);
                });

                return Array.from(billboardGroups.entries()).map(([key, groupItems]) => {
                  const firstItem = groupItems[0];
                  const bbName = firstItem.billboard_name || firstItem.billboard?.Billboard_Name || `لوحة ${firstItem.billboard_id || ''}`;
                  const bbSize = firstItem.billboard_size || firstItem.billboard?.Size;
                  const bbImage = firstItem.billboard?.Image_URL;
                  const landmark = firstItem.nearest_landmark || firstItem.billboard?.Nearest_Landmark;
                  const district = firstItem.district || firstItem.billboard?.District;
                  const designA = firstItem.billboard?.design_face_a;
                  const designB = firstItem.billboard?.design_face_b;
                  const bbFacesCount = Number(firstItem.billboard?.Faces_Count) || 1;
                  const actualFaces = groupItems.length;
                  const isPartialFace = bbFacesCount > 1 && actualFaces < bbFacesCount;

                  return (
                    <div key={key} className="rounded-xl border border-border/50 bg-slate-50/50 dark:bg-slate-700/30 overflow-hidden">
                      <div className="flex flex-col md:flex-row">
                        {/* Design panel - right side */}
                        <div className="shrink-0 w-full md:w-[240px] border-b md:border-b-0 md:border-l border-border/30 bg-muted/30 flex flex-col gap-1.5 p-2">
                          {/* Billboard image */}
                          {bbImage && (
                            <div 
                              className="relative w-full h-28 rounded-lg overflow-hidden border bg-white dark:bg-slate-800 cursor-pointer group"
                              onClick={() => setLightboxImage(bbImage)}
                            >
                              <img src={bbImage} alt={bbName} className="w-full h-full object-cover" />
                              <div className="absolute bottom-0 inset-x-0 flex items-center justify-between px-2 py-1 bg-black/60 text-white text-[10px]">
                                <span>صورة اللوحة</span>
                                <ZoomIn className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </div>
                          )}
                          {designA && (
                            <div 
                              className="relative w-full h-36 rounded-lg overflow-hidden border bg-white dark:bg-slate-800 cursor-pointer group"
                              onClick={() => setLightboxImage(designA)}
                            >
                              <DesignImageWithBlur
                                src={designA}
                                alt="الوجه الأمامي A"
                                className="w-full h-full rounded-lg"
                              />
                              <div className="absolute bottom-0 inset-x-0 flex items-center justify-between px-2 py-1 bg-black/60 text-white text-[10px]">
                                <span>الوجه A</span>
                                <ZoomIn className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </div>
                          )}
                          {designB && (
                            <div 
                              className="relative w-full h-36 rounded-lg overflow-hidden border bg-white dark:bg-slate-800 cursor-pointer group"
                              onClick={() => setLightboxImage(designB)}
                            >
                              <DesignImageWithBlur
                                src={designB}
                                alt="الوجه الخلفي B"
                                className="w-full h-full rounded-lg"
                              />
                              <div className="absolute bottom-0 inset-x-0 flex items-center justify-between px-2 py-1 bg-black/60 text-white text-[10px]">
                                <span>الوجه B</span>
                                <ZoomIn className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                              </div>
                            </div>
                          )}
                          {!designA && !designB && (
                            <div className="w-full h-36 rounded-lg border bg-muted flex items-center justify-center">
                              <Scissors className="h-6 w-6 text-muted-foreground/50" />
                            </div>
                          )}
                        </div>

                        {/* Billboard info & items - left side */}
                        <div className="flex-1 min-w-0 p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <h4 className="font-bold text-foreground">{bbName}</h4>
                              {isPartialFace && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-400">
                                  وجه {actualFaces} من {bbFacesCount}
                                </Badge>
                              )}
                              {!isPartialFace && bbFacesCount > 1 && (
                                <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                                  {bbFacesCount} أوجه
                                </Badge>
                              )}
                            </div>
                            {bbSize && <Badge variant="outline" className="text-xs">{bbSize}</Badge>}
                            {firstItem.billboard_id && (
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                                title="حذف اللوحة من مهمة المجسمات"
                                onClick={async () => {
                                  if (await systemConfirm({ title: 'تأكيد الحذف', message: `هل تريد حذف "${bbName}" من مهمة المجسمات؟`, variant: 'destructive', confirmText: 'حذف' })) {
                                    deleteBillboardGroupMutation.mutate(firstItem.billboard_id!);
                                  }
                                }}
                                disabled={deleteBillboardGroupMutation.isPending}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1 text-xs text-muted-foreground">
                            {district && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5 text-purple-500/70" />
                                {district}
                              </span>
                            )}
                            {landmark && (
                              <span className="flex items-center gap-1">
                                <Landmark className="h-3.5 w-3.5 text-amber-500/70" />
                                {landmark}
                              </span>
                            )}
                            {firstItem.billboard_id && <span className="font-mono text-muted-foreground/60">#{firstItem.billboard_id}</span>}
                          </div>

                          {/* Items for this billboard */}
                          <div className="mt-3 space-y-2">
                            {groupItems.map(item => {
                              const faceLabel = item.face_type === 'B' ? 'الوجه الخلفي (B)' : 'الوجه الأمامي (A)';
                              return (
                                <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-white/60 dark:bg-slate-600/30 border border-border/30">
                                  <div className="flex items-center gap-2">
                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                      item.face_type === 'B' 
                                        ? 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300' 
                                        : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                                    }`}>
                                      {item.face_type || 'A'}
                                    </span>
                                    <span className="text-sm">{faceLabel}</span>
                                  </div>
                                  <div className="flex items-center gap-4 text-sm">
                                    <span className="text-muted-foreground">
                                      الكمية: <span className="font-semibold text-foreground">{item.quantity}</span>
                                    </span>
                                    <span className="text-muted-foreground">
                                      سعر الوحدة: <span className="font-semibold text-foreground">{item.unit_cost.toFixed(2)} د.ل</span>
                                    </span>
                                    <span className="text-muted-foreground">
                                      الإجمالي: <span className="font-semibold text-foreground">{item.total_cost.toFixed(2)} د.ل</span>
                                    </span>
                                    <Badge className={getStatusColor(task.status)}>
                                      {getStatusLabel(task.status)}
                                    </Badge>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                });
              })()}
            </div>
          )}
        </div>
      </Card>

      {/* Unified Invoice Dialog */}
      {linkedCompositeTask && (
        <UnifiedTaskInvoice
          open={invoiceDialogOpen}
          onOpenChange={setInvoiceDialogOpen}
          task={linkedCompositeTask}
          invoiceType={currentInvoiceType}
        />
      )}

      {/* Lightbox Dialog */}
      <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
        <DialogContent className="max-w-4xl p-2 bg-black/95 border-none">
          {lightboxImage && (
            <img src={lightboxImage} alt="تكبير التصميم" className="w-full h-auto max-h-[85vh] object-contain rounded" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
