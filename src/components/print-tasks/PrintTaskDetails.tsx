import { useState, useMemo, useEffect } from 'react';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Clock, CheckCircle2, Printer, AlertCircle, Package, Edit2, Save, X, Trash2, Building2, FileText, MapPin, Landmark, ZoomIn, Ruler } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { DesignDisplayCard } from './DesignDisplayCard';
import { PrintReprintsSection } from './PrintReprintsSection';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { DesignImageWithBlur } from '@/components/DesignImageWithBlur';
import { UnifiedTaskInvoice, InvoiceType } from '@/components/composite-tasks/UnifiedTaskInvoice';
import { CompositeTaskWithDetails } from '@/types/composite-task';

interface PrintTaskItem {
  id: string;
  description: string;
  width: number;
  height: number;
  area: number;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  design_face_a: string | null;
  design_face_b: string | null;
  has_cutout?: boolean | null;
  cutout_quantity?: number;
  billboard_id?: number;
  billboards?: any;
  model_link?: string | null;
  status?: string;
}

interface DesignGroup {
  design: string | null;
  face: 'a' | 'b';
  size: string;
  quantity: number;
  area: number;
  width: number;
  height: number;
}

interface PrintTaskDetailsProps {
  task: any;
}

export function PrintTaskDetails({ task }: PrintTaskDetailsProps) {
  const queryClient = useQueryClient();
  const { confirm: systemConfirm } = useSystemDialog();
  const [editingPrices, setEditingPrices] = useState(false);
  const [customerPricePerMeter, setCustomerPricePerMeter] = useState(0);
  const [printerPricePerMeter, setPrinterPricePerMeter] = useState(0);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(task?.printer_id || null);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [currentInvoiceType, setCurrentInvoiceType] = useState<InvoiceType>('customer');
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  // جلب المهمة المجمعة المرتبطة بمهمة الطباعة
  const { data: linkedCompositeTask } = useQuery({
    queryKey: ['linked-composite-task', task?.id],
    enabled: !!task?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('composite_tasks')
        .select('*')
        .eq('print_task_id', task.id)
        .maybeSingle();
      if (error) throw error;
      return data as CompositeTaskWithDetails | null;
    }
  });

  // جلب قائمة المطابع
  const { data: printers = [] } = useQuery({
    queryKey: ['printers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('printers')
        .select('id, name')
        .order('name');
      if (error) throw error;
      return data || [];
    }
  });

  // تحديث المطبعة المختارة عند تغيير المهمة
  useEffect(() => {
    setSelectedPrinterId(task?.printer_id || null);
  }, [task?.printer_id]);

  // مزامنة قيم الأسعار مع بيانات المهمة والمهمة المجمعة
  useEffect(() => {
    if (!task) return;
    
    const totalArea = task.total_area || 1;
    
    // أولوية: المهمة المجمعة المرتبطة (linkedCompositeTask) ثم بيانات المهمة المباشرة
    let customerTotal = task.customer_total_amount || 0;
    let printerTotal = task.total_cost || 0;
    
    if (linkedCompositeTask) {
      // إذا كانت المهمة المجمعة موجودة، نستخدم قيمها حتى لو كانت صفر
      customerTotal = linkedCompositeTask.customer_print_cost ?? customerTotal;
      printerTotal = linkedCompositeTask.company_print_cost ?? printerTotal;
    }
    
    const printerPerMeter = totalArea > 0 ? printerTotal / totalArea : 0;
    const customerPerMeter = totalArea > 0 ? customerTotal / totalArea : 0;
    
    setCustomerPricePerMeter(customerPerMeter);
    setPrinterPricePerMeter(printerPerMeter);
  }, [task, linkedCompositeTask]);

  const { data: items = [] } = useQuery({
    queryKey: ['print-task-items', task?.id],
    enabled: !!task?.id,
    queryFn: async () => {
      if (!task?.id) return [];
      const { data, error } = await supabase
        .from('print_task_items')
        .select(`
          id,
          description,
          width,
          height,
          area,
          quantity,
          unit_cost,
          total_cost,
          status,
          design_face_a,
          design_face_b,
          model_link,
          has_cutout,
          cutout_quantity,
          billboard_id,
          billboards("ID", "Billboard_Name", "Size", "Contract_Number", "District", "Nearest_Landmark", "Faces_Count", "Image_URL")
        `)
        .eq('task_id', task.id)
        .order('id');
      
      if (error) throw error;
      return data as PrintTaskItem[];
    }
  });

  // Load cutout task items if available
  const { data: cutoutItems = [] } = useQuery({
    queryKey: ['cutout-task-items', task?.cutout_task_id],
    enabled: !!task?.cutout_task_id,
    queryFn: async () => {
      if (!task?.cutout_task_id) return [];
      const { data, error } = await supabase
        .from('cutout_task_items')
        .select('*')
        .eq('task_id', task.cutout_task_id);
      
      if (error) throw error;
      return data || [];
    }
  });

  // Create a map of billboard_id to cutout count
  const cutoutsByBillboard = useMemo(() => {
    const map = new Map();
    // Use cutout_quantity from print_task_items directly
    items.forEach((item: any) => {
      if (item.has_cutout && item.cutout_quantity && item.billboard_id) {
        if (!map.has(item.billboard_id)) {
          map.set(item.billboard_id, item.cutout_quantity);
        }
      }
    });
    return map;
  }, [items]);

  // Enrich items with cutout information
  const enrichedItems = useMemo(() => {
    return items.map(item => ({
      ...item,
      cutout_quantity: item.cutout_quantity || cutoutsByBillboard.get(item.billboard_id) || 0
    }));
  }, [items, cutoutsByBillboard]);

  const designGroups = useMemo(() => {
    const groups: Record<string, DesignGroup & { itemIds: string[]; statuses: string[] }> = {};

    enrichedItems.forEach(item => {
      const size = `${item.width}×${item.height}`;
      
      if (item.design_face_a) {
        const keyA = `${size}_${item.design_face_a}_a`;
        if (!groups[keyA]) {
          groups[keyA] = {
            design: item.design_face_a,
            face: 'a' as const,
            size,
            quantity: 0,
            area: item.width * item.height,
            width: item.width,
            height: item.height,
            itemIds: [],
            statuses: []
          };
        }
        groups[keyA].quantity += item.quantity;
        groups[keyA].itemIds.push(item.id);
        groups[keyA].statuses.push(item.status || 'pending');
      }

      if (item.design_face_b) {
        const keyB = `${size}_${item.design_face_b}_b`;
        if (!groups[keyB]) {
          groups[keyB] = {
            design: item.design_face_b,
            face: 'b' as const,
            size,
            quantity: 0,
            area: item.width * item.height,
            width: item.width,
            height: item.height,
            itemIds: [],
            statuses: []
          };
        }
        groups[keyB].quantity += item.quantity;
        groups[keyB].itemIds.push(item.id);
        groups[keyB].statuses.push(item.status || 'pending');
      }
    });

    return Object.values(groups);
  }, [enrichedItems]);

  // Group items by billboard for the card layout
  const billboardGroups = useMemo(() => {
    const groups = new Map<string, PrintTaskItem[]>();
    enrichedItems.forEach(item => {
      const key = item.billboard_id?.toString() || `solo_${item.id}`;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(item);
    });
    return Array.from(groups.entries());
  }, [enrichedItems]);

  const updateStatusMutation = useMutation({
    mutationFn: async (status: string) => {
      if (!task?.id) return;
      const { error } = await supabase
        .from('print_tasks')
        .update({ 
          status,
          completed_at: status === 'completed' ? new Date().toISOString() : null
        })
        .eq('id', task.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تحديث حالة المهمة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['print-tasks'] });
    },
    onError: (error: any) => {
      toast.error('فشل في تحديث الحالة: ' + error.message);
    }
  });

  const updateItemStatusMutation = useMutation({
    mutationFn: async ({ itemId, status }: { itemId: string; status: string }) => {
      const { error } = await supabase
        .from('print_task_items')
        .update({ status })
        .eq('id', itemId);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تحديث حالة البند بنجاح');
      queryClient.invalidateQueries({ queryKey: ['print-task-items'] });
    },
    onError: (error: any) => {
      toast.error('فشل في تحديث الحالة: ' + error.message);
    }
  });

  const deleteItemMutation = useMutation({
    mutationFn: async (itemId: string) => {
      const { error } = await supabase
        .from('print_task_items')
        .delete()
        .eq('id', itemId);
      if (error) throw error;

      // Recalculate total_area from remaining items
      const { data: remaining } = await supabase
        .from('print_task_items')
        .select('area, quantity')
        .eq('task_id', task.id);
      
      const newTotalArea = (remaining || []).reduce((sum: number, i: any) => sum + (i.area * i.quantity), 0);
      
      const { error: updateError } = await supabase
        .from('print_tasks')
        .update({ total_area: newTotalArea })
        .eq('id', task.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      toast.success('تم حذف البند وتحديث المساحة');
      queryClient.invalidateQueries({ queryKey: ['print-task-items'] });
      queryClient.invalidateQueries({ queryKey: ['print-tasks'] });
    },
    onError: (error: any) => {
      toast.error('فشل في حذف البند: ' + error.message);
    }
  });

  const deleteBillboardGroupMutation = useMutation({
    mutationFn: async (billboardId: number) => {
      // Delete all items for this billboard in this task
      const itemIds = enrichedItems
        .filter(i => i.billboard_id === billboardId)
        .map(i => i.id);
      
      if (itemIds.length === 0) return;
      
      const { error } = await supabase
        .from('print_task_items')
        .delete()
        .in('id', itemIds);
      if (error) throw error;

      // Recalculate total_area
      const { data: remaining } = await supabase
        .from('print_task_items')
        .select('area, quantity')
        .eq('task_id', task.id);
      
      const newTotalArea = (remaining || []).reduce((sum: number, i: any) => sum + (i.area * i.quantity), 0);
      
      await supabase
        .from('print_tasks')
        .update({ total_area: newTotalArea })
        .eq('id', task.id);
    },
    onSuccess: () => {
      toast.success('تم حذف اللوحة من مهمة الطباعة');
      queryClient.invalidateQueries({ queryKey: ['print-task-items'] });
      queryClient.invalidateQueries({ queryKey: ['print-tasks'] });
    },
    onError: (error: any) => {
      toast.error('فشل في حذف اللوحة: ' + error.message);
    }
  });

  const updatePricesMutation = useMutation({
    mutationFn: async () => {
      if (!task?.id) return;
      const totalArea = task.total_area || 0;
      const customerTotalAmount = customerPricePerMeter * totalArea;
      const totalCost = printerPricePerMeter * totalArea;
      
      // تحديث print_tasks
      const { error } = await supabase
        .from('print_tasks')
        .update({
          customer_total_amount: customerTotalAmount,
          total_cost: totalCost
        })
        .eq('id', task.id);
      
      if (error) throw error;
      
      // مزامنة مع composite_tasks إذا كان مرتبط (وتحديث الإجماليات لمنع اختلاف الأرقام)
      const { data: compositeTask, error: compositeError } = await supabase
        .from('composite_tasks')
        .select(
          'id, customer_installation_cost, customer_cutout_cost, company_installation_cost, company_cutout_cost, discount_amount'
        )
        .eq('print_task_id', task.id)
        .maybeSingle();

      if (compositeError) throw compositeError;

      if (compositeTask?.id) {
        const customerInstall = Number(compositeTask.customer_installation_cost) || 0;
        const customerCutout = Number(compositeTask.customer_cutout_cost) || 0;
        const companyInstall = Number(compositeTask.company_installation_cost) || 0;
        const companyCutout = Number(compositeTask.company_cutout_cost) || 0;
        const discountAmount = Number(compositeTask.discount_amount) || 0;

        const customerSubtotal = customerInstall + customerTotalAmount + customerCutout;
        const customerTotal = customerSubtotal - discountAmount;
        const companyTotal = companyInstall + totalCost + companyCutout;
        const netProfit = customerTotal - companyTotal;
        const profitPercentage = customerTotal > 0 ? (netProfit / customerTotal) * 100 : 0;

        const { error: updateCompositeError } = await supabase
          .from('composite_tasks')
          .update({
            customer_print_cost: customerTotalAmount,
            company_print_cost: totalCost,
            customer_total: customerTotal,
            company_total: companyTotal,
            net_profit: netProfit,
            profit_percentage: profitPercentage,
            updated_at: new Date().toISOString()
          })
          .eq('id', compositeTask.id);

        if (updateCompositeError) throw updateCompositeError;
      }
    },
    onSuccess: () => {
      toast.success('تم تحديث الأسعار بنجاح');
      setEditingPrices(false);
      queryClient.invalidateQueries({ queryKey: ['print-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['composite-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['linked-composite-task', task?.id] });
    },
    onError: (error: any) => {
      toast.error('فشل في تحديث الأسعار: ' + error.message);
    }
  });

  // تحديث المطبعة
  const updatePrinterMutation = useMutation({
    mutationFn: async (printerId: string) => {
      if (!task?.id) return;
      const { error } = await supabase
        .from('print_tasks')
        .update({ printer_id: printerId })
        .eq('id', task.id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تحديد المطبعة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['print-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['printer-accounts'] });
    },
    onError: (error: any) => {
      toast.error('فشل في تحديد المطبعة: ' + error.message);
    }
  });

  const deleteTaskMutation = useMutation({
    mutationFn: async () => {
      if (!task?.id) return;
      
      // Delete task items first
      const { error: itemsError } = await supabase
        .from('print_task_items')
        .delete()
        .eq('task_id', task.id);
      
      if (itemsError) throw itemsError;
      
      // Delete the task
      const { error: taskError } = await supabase
        .from('print_tasks')
        .delete()
        .eq('id', task.id);
      
      if (taskError) throw taskError;
    },
    onSuccess: () => {
      toast.success('تم حذف مهمة الطباعة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['print-tasks'] });
    },
    onError: (error: any) => {
      toast.error('فشل في حذف المهمة: ' + error.message);
    }
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
      case 'in_progress': return Printer;
      case 'cancelled': return AlertCircle;
      default: return Clock;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-400';
      case 'in_progress': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-400';
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

  // Calculate designs from enriched items
  const designs = enrichedItems
    .flatMap(item => [
      { url: item.design_face_a, face: 'a' as const },
      { url: item.design_face_b, face: 'b' as const }
    ])
    .filter(d => d.url);

  const hasDesigns = designs.length > 0;
  
  // حساب الربح بشكل صحيح
  const totalArea = task?.total_area || 0;
  const customerTotalAmount = customerPricePerMeter * totalArea;
  const printerTotal = printerPricePerMeter * totalArea;
  const profit = customerTotalAmount - printerTotal;
  const profitPercentage = printerTotal > 0 ? ((profit / printerTotal) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-lg shadow-blue-500/25">
            <Printer className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">{task.customer_name || 'بدون اسم'}</h2>
            <p className="text-sm text-muted-foreground">
              {(() => {
                const ids: number[] = Array.isArray((task as any)._contractIds) && (task as any)._contractIds.length > 0
                  ? (task as any)._contractIds
                  : (task.contract_id ? [task.contract_id] : []);

                const label = ids.length > 1 ? `عقود رقم: ${ids.join(', ')}` : (ids.length === 1 ? `عقد رقم: ${ids[0]}` : '');
                return `${label}${label ? ' | ' : ''}${task.printed_invoices?.invoice_number || `مهمة #${task.id.slice(0, 8)}`}`;
              })()}
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
              if (await systemConfirm({ title: 'تأكيد الحذف', message: 'هل أنت متأكد من حذف هذه المهمة؟ لا يمكن التراجع عن هذا الإجراء.', variant: 'destructive', confirmText: 'حذف' })) {
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
                setCurrentInvoiceType('print_vendor');
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

      {/* Printer Selection Card - يظهر دائماً لاختيار أو تغيير المطبعة */}
      <Card className={`shadow-lg ${task.printer_id ? 'border border-border' : 'border-2 border-amber-200 dark:border-amber-800 bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30'}`}>
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2 text-amber-700 dark:text-amber-400">
            <Building2 className="h-5 w-5" />
            {task.printer_id ? 'تغيير المطبعة' : 'اختر المطبعة لهذه المهمة'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-3">
            <Select
              value={selectedPrinterId || ''}
              onValueChange={(value) => setSelectedPrinterId(value)}
            >
              <SelectTrigger className="flex-1 bg-white dark:bg-slate-800">
                <SelectValue placeholder="اختر المطبعة..." />
              </SelectTrigger>
              <SelectContent>
                {printers.map((printer) => (
                  <SelectItem key={printer.id} value={printer.id}>
                    {printer.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              onClick={() => {
                if (selectedPrinterId) {
                  updatePrinterMutation.mutate(selectedPrinterId);
                }
              }}
              disabled={!selectedPrinterId || selectedPrinterId === task.printer_id || updatePrinterMutation.isPending}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <Save className="h-4 w-4 mr-2" />
              تأكيد
            </Button>
          </div>
        </CardContent>
      </Card>

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
                <div className="flex items-center gap-2">
                  <Select
                    value={selectedPrinterId || ''}
                    onValueChange={(value) => {
                      setSelectedPrinterId(value);
                      updatePrinterMutation.mutate(value);
                    }}
                    disabled={updatePrinterMutation.isPending}
                  >
                    <SelectTrigger className="h-8 text-xs">
                      <SelectValue placeholder="اختر..." />
                    </SelectTrigger>
                    <SelectContent>
                      {printers.map((printer) => (
                        <SelectItem key={printer.id} value={printer.id}>
                          {printer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>
            <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-700/50">
              <span className="text-xs text-muted-foreground block mb-1">المساحة الإجمالية</span>
              <span className="font-semibold text-slate-700 dark:text-slate-200">{task.total_area?.toFixed(2)} م²</span>
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
          
          {(task.notes || true) && (
            <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
              <span className="text-xs text-muted-foreground block mb-1">ملاحظات</span>
              <textarea
                className="w-full text-sm bg-transparent border border-border rounded-md px-3 py-2 min-h-[60px] resize-y focus:outline-none focus:ring-1 focus:ring-primary"
                defaultValue={task.notes || ''}
                placeholder="أضف ملاحظات..."
                onBlur={async (e) => {
                  const newNotes = e.target.value;
                  if (newNotes !== (task.notes || '')) {
                    const { error } = await supabase
                      .from('print_tasks')
                      .update({ notes: newNotes })
                      .eq('id', task.id);
                    if (error) {
                      toast.error('فشل في حفظ الملاحظات');
                    } else {
                      toast.success('تم حفظ الملاحظات');
                      queryClient.invalidateQueries({ queryKey: ['print-tasks'] });
                    }
                  }
                }}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Pricing Section */}
      <Card className="border-0 shadow-md bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border-b flex items-center justify-between">
          <h3 className="font-semibold text-blue-700 dark:text-blue-300 flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-blue-100 dark:bg-blue-900/50">
              <Edit2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
            </span>
            التسعير والأرباح
          </h3>
          <Button
            variant={editingPrices ? "destructive" : "outline"}
            size="sm"
            onClick={() => {
              if (editingPrices) {
                const taskTotalArea = task?.total_area || 1;
                setCustomerPricePerMeter(taskTotalArea > 0 ? (task?.customer_total_amount || 0) / taskTotalArea : 0);
                setPrinterPricePerMeter(taskTotalArea > 0 ? (task?.total_cost || 0) / taskTotalArea : 0);
              }
              setEditingPrices(!editingPrices);
            }}
            className="gap-1"
          >
            {editingPrices ? (
              <>
                <X className="h-4 w-4" />
                إلغاء
              </>
            ) : (
              <>
                <Edit2 className="h-4 w-4" />
                تعديل الأسعار
              </>
            )}
          </Button>
        </div>
        <div className="p-4">
        {editingPrices ? (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>سعر المتر للزبون (د.ل/م²) *</Label>
                <Input
                  type="number"
                  value={customerPricePerMeter}
                  onChange={(e) => setCustomerPricePerMeter(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.5"
                />
                <span className="text-xs text-muted-foreground">
                  الإجمالي: {(customerPricePerMeter * totalArea).toLocaleString()} د.ل
                </span>
              </div>
              <div>
                <Label>سعر المتر للمطبعة (د.ل/م²)</Label>
                <Input
                  type="number"
                  value={printerPricePerMeter}
                  onChange={(e) => setPrinterPricePerMeter(parseFloat(e.target.value) || 0)}
                  min="0"
                  step="0.5"
                />
                <span className="text-xs text-muted-foreground">
                  الإجمالي: {(printerPricePerMeter * totalArea).toLocaleString()} د.ل
                </span>
              </div>
              <div>
                <Label>الربح (تلقائي)</Label>
                <Input
                  type="number"
                  value={profit}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <Label>المساحة الإجمالية (م²)</Label>
                <Input
                  type="number"
                  value={totalArea.toFixed(2)}
                  disabled
                  className="bg-muted"
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => updatePricesMutation.mutate()}
                disabled={updatePricesMutation.isPending}
                className="flex-1"
              >
                <Save className="h-4 w-4 mr-2" />
                حفظ التغييرات
              </Button>
              <Button
                variant="outline"
                onClick={() => setEditingPrices(false)}
                className="flex-1"
              >
                إلغاء
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {/* تحذير إذا لم يتم تحديد سعر الزبون - فقط إذا لم يكن هناك مهمة مجمعة مرتبطة */}
            {!linkedCompositeTask && 
             (task?.customer_total_amount === 0 || !task?.customer_total_amount) && 
             printerPricePerMeter > 0 && (
              <div className="p-3 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-lg flex items-center gap-2 text-sm text-amber-700 dark:text-amber-400">
                <AlertCircle className="h-4 w-4 flex-shrink-0" />
                <span>لم يتم تحديد سعر الزبون. يرجى تعديل السعر وحفظه.</span>
              </div>
            )}
            
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/50 dark:to-indigo-950/50 border border-blue-100 dark:border-blue-800">
                <span className="text-xs text-blue-600 dark:text-blue-400 font-medium block mb-1">سعر المتر للزبون</span>
                <span className="font-bold text-xl text-blue-700 dark:text-blue-300">{customerPricePerMeter.toFixed(2)}</span>
                <span className="text-xs text-blue-600 dark:text-blue-400"> د.ل/م²</span>
                <div className="text-xs text-blue-500 dark:text-blue-400 mt-2 pt-2 border-t border-blue-200 dark:border-blue-700">
                  الإجمالي: <span className="font-semibold">{customerTotalAmount.toLocaleString()}</span> د.ل
                </div>
              </div>
              
              <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border border-slate-200 dark:border-slate-600">
                <span className="text-xs text-slate-600 dark:text-slate-400 font-medium block mb-1">سعر المتر للمطبعة</span>
                <span className="font-bold text-xl text-slate-700 dark:text-slate-200">{printerPricePerMeter.toFixed(2)}</span>
                <span className="text-xs text-slate-600 dark:text-slate-400"> د.ل/م²</span>
                <div className="text-xs text-slate-500 dark:text-slate-400 mt-2 pt-2 border-t border-slate-200 dark:border-slate-600">
                  الإجمالي: <span className="font-semibold">{printerTotal.toLocaleString()}</span> د.ل
                </div>
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
              
              <div className="p-4 rounded-xl bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border border-slate-200 dark:border-slate-600">
                <span className="text-xs text-slate-600 dark:text-slate-400 font-medium block mb-1">المساحة الإجمالية</span>
                <span className="font-bold text-xl text-slate-700 dark:text-slate-200">{totalArea.toFixed(2)}</span>
                <span className="text-xs text-slate-600 dark:text-slate-400"> م²</span>
              </div>
            </div>
          </div>
        )}
        </div>
      </Card>

      {/* Billboard-Grouped Items */}
      <Card className="border-0 shadow-md bg-white/80 dark:bg-slate-800/80 backdrop-blur-sm overflow-hidden">
        <div className="p-4 bg-gradient-to-r from-slate-50 to-slate-100 dark:from-slate-800 dark:to-slate-700 border-b">
          <h3 className="font-semibold text-slate-700 dark:text-slate-200">عناصر المهمة ({enrichedItems.length} عنصر)</h3>
        </div>
        <div className="p-4 space-y-4">
          {billboardGroups.map(([key, groupItems]) => {
            const firstItem = groupItems[0];
            const bb = firstItem.billboards;
            const bbName = bb?.Billboard_Name || `لوحة ${firstItem.billboard_id || ''}`;
            const bbSize = bb?.Size;
            const bbImage = bb?.Image_URL;
            // Collect designs from ALL items in the group (face A/B may be on different items)
            const designA = groupItems.find(i => i.design_face_a)?.design_face_a || null;
            const designB = groupItems.find(i => i.design_face_b)?.design_face_b || null;
            const groupTotalArea = groupItems.reduce((sum, i) => sum + (i.area * i.quantity), 0);
            const bbFacesCount = Number(bb?.Faces_Count) || 1;
            const actualPrintedFaces = groupItems.length;
            const isPartialFace = bbFacesCount > 1 && actualPrintedFaces < bbFacesCount;

            return (
              <div key={key} className="rounded-xl border border-border/50 bg-slate-50/50 dark:bg-slate-700/30 overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  {/* Design panel + size - right side (RTL page so flex-row puts this on right) */}
                  <div className="shrink-0 w-full md:w-[280px] border-b md:border-b-0 md:border-l border-border/30 bg-muted/30 p-3 space-y-2">
                    {/* Size badge */}
                    {bbSize && (
                      <div className="flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg bg-primary/10 border border-primary/20 text-sm font-semibold text-primary">
                        <Ruler className="h-4 w-4" />
                        {bbSize}
                      </div>
                    )}
                    {/* Billboard image */}
                    {bbImage && (
                      <div
                        className="relative w-full rounded-lg overflow-hidden border bg-white dark:bg-slate-800 cursor-pointer group"
                        style={{ height: '120px' }}
                        onClick={() => setLightboxImage(bbImage)}
                      >
                        <img src={bbImage} alt={bbName} className="w-full h-full object-cover" />
                        <div className="absolute bottom-0 inset-x-0 flex items-center justify-between px-2 py-1 bg-black/60 text-white text-[10px]" style={{ zIndex: 2 }}>
                          <span>صورة اللوحة</span>
                          <ZoomIn className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    )}
                    {designA && (
                      <div
                        className="relative w-full rounded-lg overflow-hidden border bg-white dark:bg-slate-800 cursor-pointer group mb-2"
                        style={{ height: '176px' }}
                        onClick={() => setLightboxImage(designA)}
                      >
                        <DesignImageWithBlur
                          src={designA}
                          alt="الوجه الأمامي A"
                          className="w-full h-full rounded-lg"
                        />
                        <div className="absolute bottom-0 inset-x-0 flex items-center justify-between px-2 py-1 bg-black/60 text-white text-[10px]" style={{ zIndex: 2 }}>
                          <span>الوجه A</span>
                          <ZoomIn className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    )}
                    {designB && (
                      <div
                        className="relative w-full rounded-lg overflow-hidden border bg-white dark:bg-slate-800 cursor-pointer group"
                        style={{ height: '176px' }}
                        onClick={() => setLightboxImage(designB)}
                      >
                        <DesignImageWithBlur
                          src={designB}
                          alt="الوجه الخلفي B"
                          className="w-full h-full rounded-lg"
                        />
                        <div className="absolute bottom-0 inset-x-0 flex items-center justify-between px-2 py-1 bg-black/60 text-white text-[10px]" style={{ zIndex: 2 }}>
                          <span>الوجه B</span>
                          <ZoomIn className="h-3.5 w-3.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                        </div>
                      </div>
                    )}
                    {!designA && !designB && (
                      <div className="w-full rounded-lg border bg-muted flex items-center justify-center" style={{ height: '176px' }}>
                        <Printer className="h-6 w-6 text-muted-foreground/50" />
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
                            وجه {actualPrintedFaces} من {bbFacesCount}
                          </Badge>
                        )}
                        {!isPartialFace && bbFacesCount > 1 && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400">
                            {bbFacesCount} أوجه
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {firstItem.billboard_id && (
                          <span className="font-mono text-xs text-muted-foreground/60">#{firstItem.billboard_id}</span>
                        )}
                        {firstItem.billboard_id && (
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-7 w-7 text-destructive hover:text-destructive hover:bg-destructive/10"
                            title="حذف اللوحة من مهمة الطباعة"
                            onClick={async () => {
                              if (await systemConfirm({ title: 'تأكيد الحذف', message: `هل تريد حذف "${bbName}" من مهمة الطباعة؟`, variant: 'destructive', confirmText: 'حذف' })) {
                                deleteBillboardGroupMutation.mutate(firstItem.billboard_id!);
                              }
                            }}
                            disabled={deleteBillboardGroupMutation.isPending}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-xs text-muted-foreground">
                      {bb?.District && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5 text-purple-500/70" />
                          {bb.District}
                        </span>
                      )}
                      {bb?.Nearest_Landmark && (
                        <span className="flex items-center gap-1">
                          <Landmark className="h-3.5 w-3.5 text-amber-500/70" />
                          {bb.Nearest_Landmark}
                        </span>
                      )}
                    </div>

                    {/* Items for this billboard */}
                    <div className="mt-3 space-y-2">
                      {groupItems.map(item => {
                        const faceLabel = item.design_face_b && !item.design_face_a
                          ? 'الوجه الخلفي (B)'
                          : item.design_face_a && item.design_face_b
                            ? 'وجهين (A+B)'
                            : 'الوجه الأمامي (A)';
                        const faceType = item.design_face_b && !item.design_face_a ? 'B' : 'A';

                        return (
                          <div key={item.id} className="flex flex-col gap-2 p-3 rounded-lg bg-white/60 dark:bg-slate-600/30 border border-border/30">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                                  faceType === 'B'
                                    ? 'bg-orange-100 dark:bg-orange-900 text-orange-700 dark:text-orange-300'
                                    : 'bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300'
                                }`}>
                                  {faceType}
                                </span>
                                <span className="text-sm font-medium">{faceLabel}</span>
                                {item.has_cutout && (
                                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">مجسم ×{item.cutout_quantity || 1}</Badge>
                                )}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Badge className={getStatusColor(task.status)}>
                                  {getStatusLabel(task.status)}
                                </Badge>
                                {groupItems.length > 1 && (
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-6 w-6 text-red-400 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950/50"
                                    title="حذف هذا الوجه"
                                    onClick={async () => {
                                      if (await systemConfirm({ title: 'تأكيد الحذف', message: `هل تريد حذف ${faceLabel} من هذه اللوحة؟ سيتم إعادة حساب المساحة الإجمالية.`, variant: 'destructive', confirmText: 'حذف' })) {
                                        deleteItemMutation.mutate(item.id);
                                      }
                                    }}
                                    disabled={deleteItemMutation.isPending}
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                            </div>

                            {/* Dimensions grid */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                              <div className="p-2 rounded-lg bg-blue-50 dark:bg-blue-950/40 border border-blue-200/50 dark:border-blue-800/50">
                                <div className="text-[10px] text-muted-foreground">العرض</div>
                                <div className="font-bold text-sm">{item.width} <span className="text-[10px] font-normal text-muted-foreground">م</span></div>
                              </div>
                              <div className="p-2 rounded-lg bg-green-50 dark:bg-green-950/40 border border-green-200/50 dark:border-green-800/50">
                                <div className="text-[10px] text-muted-foreground">الارتفاع</div>
                                <div className="font-bold text-sm">{item.height} <span className="text-[10px] font-normal text-muted-foreground">م</span></div>
                              </div>
                              <div className="p-2 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200/50 dark:border-amber-800/50">
                                <div className="text-[10px] text-muted-foreground">المساحة</div>
                                <div className="font-bold text-sm">{item.area.toFixed(2)} <span className="text-[10px] font-normal text-muted-foreground">م²</span></div>
                              </div>
                              <div className="p-2 rounded-lg bg-purple-50 dark:bg-purple-950/40 border border-purple-200/50 dark:border-purple-800/50">
                                <div className="text-[10px] text-muted-foreground">الكمية</div>
                                <div className="font-bold text-sm">×{item.quantity}</div>
                              </div>
                              <div className="p-2 rounded-lg bg-primary/10 border border-primary/30">
                                <div className="text-[10px] text-muted-foreground">إجمالي المساحة</div>
                                <div className="font-bold text-sm text-primary">{(item.area * item.quantity).toFixed(2)} <span className="text-[10px] font-normal">م²</span></div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Billboard total area */}
                    {groupItems.length > 1 && (
                      <div className="mt-2 pt-2 border-t border-border/30 flex items-center justify-between text-sm">
                        <span className="text-muted-foreground font-medium flex items-center gap-1.5">
                          <Ruler className="h-3.5 w-3.5" />
                          إجمالي مساحة اللوحة
                        </span>
                        <span className="font-bold text-primary">{groupTotalArea.toFixed(2)} م²</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Reprints Section */}
      <PrintReprintsSection
        taskId={task.id}
        items={enrichedItems}
        printerPricePerMeter={printerPricePerMeter}
        customerPricePerMeter={customerPricePerMeter}
      />

      {/* Design Summary Stats */}
      {hasDesigns && (
        <Card className="bg-primary/5 border-primary/20">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-muted-foreground">عدد اللوحات</div>
                <div className="text-2xl font-bold">{billboardGroups.length}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">إجمالي البنود</div>
                <div className="text-2xl font-bold">{enrichedItems.length}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">إجمالي المساحة</div>
                <div className="text-2xl font-bold text-primary">{items.reduce((sum, item) => sum + (item.area * item.quantity), 0).toFixed(2)} م²</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground">سعر الزبون</div>
                <div className="text-2xl font-bold text-primary">{customerTotalAmount.toLocaleString()} د.ل</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Lightbox Dialog */}
      <Dialog open={!!lightboxImage} onOpenChange={() => setLightboxImage(null)}>
        <DialogContent className="max-w-4xl p-2 bg-black/95 border-none">
          {lightboxImage && (
            <img src={lightboxImage} alt="تكبير التصميم" className="w-full h-auto max-h-[85vh] object-contain rounded" />
          )}
        </DialogContent>
      </Dialog>

      {/* Unified Invoice Dialog */}
      {linkedCompositeTask && (
        <UnifiedTaskInvoice
          open={invoiceDialogOpen}
          onOpenChange={setInvoiceDialogOpen}
          task={linkedCompositeTask}
          invoiceType={currentInvoiceType}
        />
      )}
    </div>
  );
}
