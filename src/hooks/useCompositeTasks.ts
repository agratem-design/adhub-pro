import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { CompositeTask, CompositeTaskWithDetails, CreateCompositeTaskInput, UpdateCompositeTaskCostsInput } from '@/types/composite-task';
import { toast } from 'sonner';

export const useCompositeTasks = (customerId?: string) => {
  const [compositeTasks, setCompositeTasks] = useState<CompositeTaskWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCompositeTasks = async () => {
    try {
      setLoading(true);
      let query = supabase
        .from('composite_tasks')
        .select(`
          *,
          installation_task:installation_tasks(*),
          print_task:print_tasks(*),
          cutout_task:cutout_tasks(*),
          contract:Contract(*),
          customer:customers(*)
        `)
        .order('created_at', { ascending: false });

      if (customerId) {
        query = query.eq('customer_id', customerId);
      }

      const { data, error } = await query;

      if (error) throw error;
      setCompositeTasks((data || []) as CompositeTaskWithDetails[]);
    } catch (error: any) {
      console.error('Error fetching composite tasks:', error);
      toast.error('فشل تحميل المهام المجمعة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCompositeTasks();
  }, [customerId]);

  const createCompositeTask = async (input: CreateCompositeTaskInput) => {
    try {
      const { data, error } = await supabase
        .from('composite_tasks')
        .insert([{
          contract_id: input.contract_id,
          customer_id: input.customer_id,
          customer_name: input.customer_name,
          task_type: input.task_type,
          installation_task_id: input.installation_task_id,
          print_task_id: input.print_task_id || null,
          cutout_task_id: input.cutout_task_id || null,
          customer_installation_cost: input.customer_installation_cost,
          company_installation_cost: input.company_installation_cost,
          customer_print_cost: input.customer_print_cost,
          company_print_cost: input.company_print_cost,
          customer_cutout_cost: input.customer_cutout_cost,
          company_cutout_cost: input.company_cutout_cost,
          notes: input.notes || null,
          status: 'pending'
        }])
        .select()
        .single();

      if (error) throw error;

      toast.success('تم إنشاء المهمة المجمعة بنجاح');
      await fetchCompositeTasks();
      return data;
    } catch (error: any) {
      console.error('Error creating composite task:', error);
      toast.error('فشل إنشاء المهمة المجمعة');
      throw error;
    }
  };

  const updateCompositeTaskCosts = async (input: UpdateCompositeTaskCostsInput) => {
    try {
      // جلب المهمة الحالية للحصول على معرفات المهام المرتبطة
      const { data: currentTask, error: fetchError } = await supabase
        .from('composite_tasks')
        .select('print_task_id, cutout_task_id')
        .eq('id', input.id)
        .single();
      
      if (fetchError) throw fetchError;

      const updateData: any = {};
      
      // تحديث التكاليف الجديدة
      if (input.customer_installation_cost !== undefined) updateData.customer_installation_cost = input.customer_installation_cost;
      if (input.company_installation_cost !== undefined) updateData.company_installation_cost = input.company_installation_cost;
      if (input.customer_print_cost !== undefined) updateData.customer_print_cost = input.customer_print_cost;
      if (input.company_print_cost !== undefined) updateData.company_print_cost = input.company_print_cost;
      if (input.customer_cutout_cost !== undefined) updateData.customer_cutout_cost = input.customer_cutout_cost;
      if (input.company_cutout_cost !== undefined) updateData.company_cutout_cost = input.company_cutout_cost;
      if (input.discount_amount !== undefined) updateData.discount_amount = input.discount_amount;
      if (input.discount_reason !== undefined) updateData.discount_reason = input.discount_reason;
      if (input.notes !== undefined) updateData.notes = input.notes;
      if (input.cost_allocation !== undefined) updateData.cost_allocation = input.cost_allocation;
      if (input.print_discount !== undefined) updateData.print_discount = input.print_discount;
      if (input.print_discount_reason !== undefined) updateData.print_discount_reason = input.print_discount_reason;
      if (input.cutout_discount !== undefined) updateData.cutout_discount = input.cutout_discount;
      if (input.cutout_discount_reason !== undefined) updateData.cutout_discount_reason = input.cutout_discount_reason;
      if (input.installation_discount !== undefined) updateData.installation_discount = input.installation_discount;
      if (input.installation_discount_reason !== undefined) updateData.installation_discount_reason = input.installation_discount_reason;

      const { error } = await supabase
        .from('composite_tasks')
        .update(updateData)
        .eq('id', input.id);

      if (error) throw error;

      // مزامنة القيم مع print_tasks إذا كانت مرتبطة
      if (currentTask?.print_task_id && (input.customer_print_cost !== undefined || input.company_print_cost !== undefined)) {
        await supabase
          .from('print_tasks')
          .update({
            customer_total_amount: input.customer_print_cost ?? 0,
            total_cost: input.company_print_cost ?? 0
          })
          .eq('id', currentTask.print_task_id);
      }

      // مزامنة القيم مع cutout_tasks إذا كانت مرتبطة
      if (currentTask?.cutout_task_id && (input.customer_cutout_cost !== undefined || input.company_cutout_cost !== undefined)) {
        await supabase
          .from('cutout_tasks')
          .update({
            customer_total_amount: input.customer_cutout_cost ?? 0,
            total_cost: input.company_cutout_cost ?? 0
          })
          .eq('id', currentTask.cutout_task_id);
      }

      toast.success('تم تحديث التكاليف بنجاح');
      await fetchCompositeTasks();
    } catch (error: any) {
      console.error('Error updating composite task costs:', error);
      toast.error('فشل تحديث التكاليف');
      throw error;
    }
  };

  const updateCompositeTaskStatus = async (id: string, status: CompositeTask['status']) => {
    try {
      const { error } = await supabase
        .from('composite_tasks')
        .update({ status })
        .eq('id', id);

      if (error) throw error;

      toast.success('تم تحديث حالة المهمة');
      await fetchCompositeTasks();
    } catch (error: any) {
      console.error('Error updating composite task status:', error);
      toast.error('فشل تحديث حالة المهمة');
      throw error;
    }
  };

  const linkCombinedInvoice = async (compositeTaskId: string, invoiceId: string) => {
    try {
      const { error } = await supabase
        .from('composite_tasks')
        .update({ combined_invoice_id: invoiceId })
        .eq('id', compositeTaskId);

      if (error) throw error;

      toast.success('تم ربط الفاتورة الموحدة');
      await fetchCompositeTasks();
    } catch (error: any) {
      console.error('Error linking combined invoice:', error);
      toast.error('فشل ربط الفاتورة الموحدة');
      throw error;
    }
  };

  const deleteCompositeTask = async (id: string) => {
    try {
      const { error } = await supabase
        .from('composite_tasks')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast.success('تم حذف المهمة المجمعة');
      await fetchCompositeTasks();
    } catch (error: any) {
      console.error('Error deleting composite task:', error);
      toast.error('فشل حذف المهمة المجمعة');
      throw error;
    }
  };

  const generateUnifiedInvoice = async (taskId: string) => {
    try {
      const task = compositeTasks.find(t => t.id === taskId);
      if (!task) {
        throw new Error('المهمة غير موجودة');
      }

      // ✅ تنظيف الفواتير اليتيمة من مهام الطباعة/القص المرتبطة قبل إنشاء الفاتورة الموحدة
      if (task.print_task_id) {
        const { data: printTask } = await supabase
          .from('print_tasks')
          .select('invoice_id')
          .eq('id', task.print_task_id)
          .single();
        
        if (printTask?.invoice_id) {
          // حذف سجلات الدفع المرتبطة بالفاتورة اليتيمة
          await supabase.from('customer_payments').delete().eq('printed_invoice_id', printTask.invoice_id);
          // حذف الفاتورة اليتيمة
          await supabase.from('printed_invoices').delete().eq('id', printTask.invoice_id);
          // إزالة الربط من مهمة الطباعة
          await supabase.from('print_tasks').update({ invoice_id: null }).eq('id', task.print_task_id);
        }
      }

      if (task.cutout_task_id) {
        const { data: cutoutTask } = await supabase
          .from('cutout_tasks')
          .select('invoice_id')
          .eq('id', task.cutout_task_id)
          .single();
        
        if (cutoutTask?.invoice_id) {
          await supabase.from('customer_payments').delete().eq('printed_invoice_id', cutoutTask.invoice_id);
          await supabase.from('printed_invoices').delete().eq('id', cutoutTask.invoice_id);
          await supabase.from('cutout_tasks').update({ invoice_id: null }).eq('id', task.cutout_task_id);
        }
      }

      // 1. Fetch current items of installation_task to get updated installation cost
      let newCustomerInstall = 0;
      let newCompanyInstall = 0;
      if (task.installation_task_id) {
        const { data: installItems } = await supabase
          .from('installation_task_items')
          .select('customer_installation_cost, company_installation_cost, additional_cost, reinstall_count, customer_original_install_cost, customer_reinstall_cost')
          .eq('task_id', task.installation_task_id);
        if (installItems) {
          installItems.forEach(i => {
            const isReinstalled = (i.reinstall_count || 0) > 0;
            const itemCost = isReinstalled
              ? (Number(i.customer_original_install_cost) || 0) + (Number(i.customer_reinstall_cost) || Number(i.customer_installation_cost) || 0)
              : (Number(i.customer_installation_cost) || 0);
            newCustomerInstall += itemCost;
            newCompanyInstall += (Number(i.company_installation_cost) || 0) + (Number(i.additional_cost) || 0);
          });
        }
      }

      // 2. Fetch current total of print_task
      let newCustomerPrint = 0;
      let newCompanyPrint = 0;
      if (task.print_task_id) {
        const { data: printTask } = await supabase
          .from('print_tasks')
          .select('customer_total_amount, total_cost')
          .eq('id', task.print_task_id)
          .single();
        if (printTask) {
          newCustomerPrint = Number(printTask.customer_total_amount) || 0;
          newCompanyPrint = Number(printTask.total_cost) || 0;
        }
      }

      // 3. Fetch current total of cutout_task
      let newCustomerCutout = 0;
      let newCompanyCutout = 0;
      if (task.cutout_task_id) {
        const { data: cutoutTask } = await supabase
          .from('cutout_tasks')
          .select('customer_total_amount, total_cost')
          .eq('id', task.cutout_task_id)
          .single();
        if (cutoutTask) {
          newCustomerCutout = Number(cutoutTask.customer_total_amount) || 0;
          newCompanyCutout = Number(cutoutTask.total_cost) || 0;
        }
      }

      // Calculate totals
      const discountAmount = task.discount_amount || 0;
      const customerSubtotal = newCustomerInstall + newCustomerPrint + newCustomerCutout;
      const customerTotal = customerSubtotal - discountAmount;
      const companyTotal = newCompanyInstall + newCompanyPrint + newCompanyCutout;
      const netProfit = customerTotal - companyTotal;
      const profitPercentage = customerTotal > 0 ? (netProfit / customerTotal) * 100 : 0;

      // Update the composite task with recalculated values in the database first
      await supabase
        .from('composite_tasks')
        .update({
          customer_installation_cost: newCustomerInstall,
          company_installation_cost: newCompanyInstall,
          customer_print_cost: newCustomerPrint,
          company_print_cost: newCompanyPrint,
          customer_cutout_cost: newCustomerCutout,
          company_cutout_cost: newCompanyCutout,
          customer_total: customerTotal,
          company_total: companyTotal,
          net_profit: netProfit,
          profit_percentage: profitPercentage,
          updated_at: new Date().toISOString(),
        })
        .eq('id', taskId);

      // توليد رقم فاتورة فريد
      const invoiceNumber = `CT-${task.contract_id}-${Date.now()}`;

      // إنشاء فاتورة موحدة في جدول printed_invoices
      const { data: invoice, error } = await supabase
        .from('printed_invoices')
        .insert({
          invoice_number: invoiceNumber,
          customer_id: task.customer_id,
          customer_name: task.customer_name || '',
          contract_number: task.contract_id || 0,
          printer_name: 'مهمة مجمعة',
          invoice_date: new Date().toISOString().split('T')[0],
          total_amount: customerTotal,
          paid_amount: 0,
          paid: false,
          notes: `فاتورة موحدة للمهمة المجمعة - عقد #${task.contract_id}\n` +
                 `تركيب: ${newCustomerInstall || 0} د.ل\n` +
                 (newCustomerPrint ? `طباعة: ${newCustomerPrint} د.ل\n` : '') +
                 (newCustomerCutout ? `قص: ${newCustomerCutout} د.ل\n` : '') +
                 (task.notes ? `\nملاحظات: ${task.notes}` : ''),
          invoice_type: 'composite_task',
          locked: false
        })
        .select()
        .single();

      if (error) throw error;

      // تحديث المهمة المجمعة بربطها بالفاتورة
      const { error: updateError } = await supabase
        .from('composite_tasks')
        .update({
          combined_invoice_id: invoice.id,
          invoice_generated: true,
          invoice_date: new Date().toISOString().split('T')[0]
        })
        .eq('id', taskId);

      if (updateError) throw updateError;

      // ✅ إضافة سجل الدين في حساب الزبون مع ربطه بالفاتورة
      await supabase.from('customer_payments').insert({
        customer_id: task.customer_id,
        customer_name: task.customer_name,
 printed_invoice_id: invoice.id, // ربط بالفاتورة لتجنب التكرار
        amount: -customerTotal,
        entry_type: 'invoice',
        paid_at: new Date().toISOString().split('T')[0],
        method: 'حساب',
        notes: `مهمة مجمعة - عقد #${task.contract_id}`
      });

      toast.success('تم إنشاء الفاتورة الموحدة بنجاح');
      await fetchCompositeTasks();
      return invoice;
    } catch (error: any) {
      console.error('Error generating unified invoice:', error);
      toast.error('فشل في إنشاء الفاتورة الموحدة');
      throw error;
    }
  };

  return {
    compositeTasks,
    loading,
    fetchCompositeTasks,
    createCompositeTask,
    updateCompositeTaskCosts,
    updateCompositeTaskStatus,
    linkCombinedInvoice,
    deleteCompositeTask,
    generateUnifiedInvoice
  };
};
