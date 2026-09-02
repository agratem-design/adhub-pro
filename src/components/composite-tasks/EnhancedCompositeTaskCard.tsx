import React, { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CompositeTaskWithDetails } from '@/types/composite-task';
import { Wrench, Printer, Scissors, FileText, Edit, Eye, TrendingUp, FileOutput, Loader2, Trash2, Users, AlertTriangle, RefreshCw, Pencil, Check, X as XIcon, Megaphone } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { CompositeProfitCard } from './CompositeProfitCard';
import { UnifiedTaskInvoice, InvoiceType } from './UnifiedTaskInvoice';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { fetchContractDesignUrls } from '@/lib/contractDesignUtils';

interface EnhancedCompositeTaskCardProps {
  task: CompositeTaskWithDetails;
  onEditCosts?: (task: CompositeTaskWithDetails) => void;
  onViewInvoice?: (task: CompositeTaskWithDetails) => void;
  onDelete?: () => void;
}

export const EnhancedCompositeTaskCard: React.FC<EnhancedCompositeTaskCardProps> = ({
  task,
  onEditCosts,
  onViewInvoice,
  onDelete
}) => {
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [isEditingName, setIsEditingName] = useState(false);
  const [editedName, setEditedName] = useState((task as any).task_name || '');
  const [savingName, setSavingName] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);
  const [contractInfo, setContractInfo] = useState<{ adTypes?: { contractId: number; adType: string }[]; contractIds?: number[] } | null>(null);
  const [designImages, setDesignImages] = useState<Array<{ url: string; face: 'a' | 'b' }>>([]);
  const [invoiceDialogOpen, setInvoiceDialogOpen] = useState(false);
  const [currentInvoiceType, setCurrentInvoiceType] = useState<InvoiceType>('customer');
  const [calculatedInstallCost, setCalculatedInstallCost] = useState<number>(0);
  const [realtimeCustomerInstall, setRealtimeCustomerInstall] = useState<number>(0);
  const [needsRecalculation, setNeedsRecalculation] = useState(false);
  const [recalculationReasons, setRecalculationReasons] = useState<string[]>([]);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const queryClient = useQueryClient();

  // التحقق من وجود فروقات في التكاليف
  useEffect(() => {
    const checkForMismatches = async () => {
      try {
        const reasons: string[] = [];
        let mismatchDetected = false;
        let actualCustomerInstall = 0;

        // التحقق من تكاليف التركيب
        if (task.installation_task_id) {
          const { data: installItems } = await supabase
            .from('installation_task_items')
            .select('customer_installation_cost, reinstall_count, customer_original_install_cost, customer_reinstall_cost')
            .eq('task_id', task.installation_task_id);
          
          if (installItems) {
            const isTaskReinstall = task.task_type === 'reinstallation';
            installItems.forEach(item => {
              const isReinstalled = isTaskReinstall && (item.reinstall_count || 0) > 0;
              const itemCost = isReinstalled
                ? (Number(item.customer_reinstall_cost) || Number(item.customer_installation_cost) || 0)
                : (Number(item.customer_installation_cost) || 0);
              actualCustomerInstall += itemCost;
            });
            setRealtimeCustomerInstall(actualCustomerInstall);
          }
          
          const diff = Math.abs(actualCustomerInstall - (task.customer_installation_cost || 0));
          if (diff > 1 && actualCustomerInstall > 0) {
            mismatchDetected = true;
            reasons.push(
              `تكلفة التركيب الفعلية (${actualCustomerInstall.toLocaleString()} د.ل) لا تتطابق مع التكلفة المخزنة (${(task.customer_installation_cost || 0).toLocaleString()} د.ل)`
            );
            // ✅ مزامنة فورية في قاعدة البيانات لضمان تطابق الفاتورة مع الكارت والدفاتر
            const newTotal = actualCustomerInstall + (task.customer_print_cost || 0) + (task.customer_cutout_cost || 0) - (task.discount_amount || 0);
            await supabase
              .from('composite_tasks')
              .update({
                customer_installation_cost: actualCustomerInstall,
                customer_total: newTotal,
              })
              .eq('id', task.id);
            
            queryClient.invalidateQueries({ queryKey: ['composite-tasks'] });
            onRefresh?.();
          }
        }

        // التحقق من تكاليف الطباعة
        if (task.print_task_id) {
          const { data: printTask } = await supabase
            .from('print_tasks')
            .select('customer_total_amount')
            .eq('id', task.print_task_id)
            .maybeSingle();
          
          const actualCustomerPrint = printTask ? (Number(printTask.customer_total_amount) || 0) : 0;
          const diff = Math.abs(actualCustomerPrint - (task.customer_print_cost || 0));
          if (diff > 1) {
            mismatchDetected = true;
            reasons.push(
              `تكلفة الطباعة الفعلية (${actualCustomerPrint.toLocaleString()} د.ل) لا تتطابق مع التكلفة المخزنة (${(task.customer_print_cost || 0).toLocaleString()} د.ل)`
            );
          }
        }

        // التحقق من تكاليف القص
        if (task.cutout_task_id) {
          const { data: cutoutTask } = await supabase
            .from('cutout_tasks')
            .select('customer_total_amount')
            .eq('id', task.cutout_task_id)
            .maybeSingle();
          
          const actualCustomerCutout = cutoutTask ? (Number(cutoutTask.customer_total_amount) || 0) : 0;
          const diff = Math.abs(actualCustomerCutout - (task.customer_cutout_cost || 0));
          if (diff > 1) {
            mismatchDetected = true;
            reasons.push(
              `تكلفة القص الفعلية (${actualCustomerCutout.toLocaleString()} د.ل) لا تتطابق مع التكلفة المخزنة (${(task.customer_cutout_cost || 0).toLocaleString()} د.ل)`
            );
          }
        }

        setNeedsRecalculation(mismatchDetected);
        setRecalculationReasons(reasons);
      } catch (error) {
        console.error('Error checking for mismatches:', error);
      }
    };

    checkForMismatches();
  }, [
    task.id,
    task.installation_task_id,
    task.print_task_id,
    task.cutout_task_id,
    task.customer_installation_cost,
    task.customer_print_cost,
    task.customer_cutout_cost,
    invoiceDialogOpen
  ]);

  const handleRecalculateCostsDirectly = async () => {
    setIsRecalculating(true);
    const tId = toast.loading('جاري إعادة حساب تكاليف المهمة...');
    try {
      // 1. Fetch current items of installation_task
      let newCustomerInstall = 0;
      let newCompanyInstall = 0;
      if (task.installation_task_id) {
        const { data: installItems } = await supabase
          .from('installation_task_items')
          .select('customer_installation_cost, company_installation_cost, additional_cost, reinstall_count, customer_original_install_cost, customer_reinstall_cost')
          .eq('task_id', task.installation_task_id);
        if (installItems) {
          const isTaskReinstall = task.task_type === 'reinstallation';
          installItems.forEach(i => {
            const isReinstalled = isTaskReinstall && (i.reinstall_count || 0) > 0;
            const itemCost = isReinstalled
              ? (Number(i.customer_reinstall_cost) || Number(i.customer_installation_cost) || 0)
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
          .maybeSingle();
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
          .maybeSingle();
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

      // Update composite_tasks table
      const { error } = await supabase
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
        .eq('id', task.id);

      if (error) throw error;

      // Also update the combined invoice if it exists
      if (task.combined_invoice_id) {
        await supabase.from('printed_invoices').update({
          print_cost: newCompanyPrint + newCompanyCutout,
          total_amount: customerTotal,
          notes: `فاتورة موحدة للمهمة المجمعة (معاد حسابها)\n` +
                 `تركيب: ${newCustomerInstall.toLocaleString()} د.ل\n` +
                 (newCustomerPrint > 0 ? `طباعة: ${newCustomerPrint.toLocaleString()} د.ل\n` : '') +
                 (newCustomerCutout > 0 ? `قص: ${newCustomerCutout.toLocaleString()} د.ل\n` : '') +
                 (discountAmount > 0 ? `خصم: ${discountAmount.toLocaleString()} د.ل\n` : '') +
                 (task.notes ? `\nملاحظات: ${task.notes}` : ''),
          updated_at: new Date().toISOString()
        } as any).eq('id', task.combined_invoice_id);

        // Sync customer payment entry
        await supabase.from('customer_payments')
          .update({
            amount: -customerTotal,
            notes: `مهمة مجمعة - عقد #${task.contract_id} (معاد حسابها)`
          })
          .eq('printed_invoice_id', task.combined_invoice_id)
          .eq('entry_type', 'invoice');
      }

      toast.dismiss(tId);
      toast.success('تم إعادة حساب وتحديث التكاليف بنجاح');
      queryClient.invalidateQueries({ queryKey: ['composite-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['print-tasks'] });
      
      setNeedsRecalculation(false);
      setRecalculationReasons([]);
    } catch (e: any) {
      toast.dismiss(tId);
      console.error(e);
      toast.error(e.message || 'حدث خطأ أثناء إعادة حساب التكاليف');
    } finally {
      setIsRecalculating(false);
    }
  };


  const openInvoice = (type: InvoiceType) => {
    setCurrentInvoiceType(type);
    setInvoiceDialogOpen(true);
  };

  // جلب معلومات العقود وأنواع الإعلان وصور التصميم
  useEffect(() => {
    const fetchContractInfo = async () => {
      try {
        let contractIds: number[] = [];
        
        if (Array.isArray((task as any).contract_ids) && (task as any).contract_ids.length > 0) {
          contractIds = [...(task as any).contract_ids].map(Number).filter(Boolean);
        } else if (Array.isArray((task as any).contractIds) && (task as any).contractIds.length > 0) {
          contractIds = [...(task as any).contractIds].map(Number).filter(Boolean);
        } else if (task.contract_id) {
          const cNo = Number(task.contract_id);
          if (Number.isFinite(cNo) && cNo > 0) {
            contractIds = [cNo];
          }
        }
          
          // جلب أنواع الإعلان من جميع العقود
          if (contractIds.length > 0) {
            const { data: contracts } = await supabase
              .from('Contract')
              .select('"Contract_Number", "Ad Type"')
              .in('Contract_Number', contractIds);
            
            setContractInfo({
              adTypes: contracts?.map(c => ({ 
                contractId: Number(c.Contract_Number), 
                adType: (c['Ad Type'] || '').trim() || 'غير محدد' 
              })).filter(a => a.adType !== 'غير محدد') || [],
              contractIds: contractIds
            });
          } else {
            setContractInfo({ adTypes: [], contractIds: [] });
          }
        } else {
          // جلب نوع الإعلان من العقد مباشرة
          const cNo = Number(task.contract_id);
          if (Number.isFinite(cNo) && cNo > 0) {
            contractIds = [cNo];
            const { data: contract } = await supabase
              .from('Contract')
              .select('"Ad Type"')
              .eq('Contract_Number', cNo)
              .maybeSingle();
            
            const rawAd = (contract?.['Ad Type'] || '').trim();
            setContractInfo({
              adTypes: rawAd ? [{ contractId: cNo, adType: rawAd }] : [],
              contractIds: [cNo]
            });
          } else {
            setContractInfo({ adTypes: [], contractIds: [] });
          }
        }

        // جلب صور التصميم بآلية مطابقة لـ ContractCard.tsx
        const contractNumber = Number(task.contract_id);
        const images: Array<{ url: string; face: 'a' | 'b' }> = [];
        
        if (Number.isFinite(contractNumber)) {
          const urls = await fetchContractDesignUrls(contractNumber);
          urls.forEach((u, idx) => {
            images.push({ url: u, face: idx % 2 === 0 ? 'a' : 'b' });
          });
        }
        
        // ثالثاً: فولباك من العقد مباشرة إذا لم توجد صور
        if (images.length === 0 && contractIds.length > 0) {
          const { data: billboards } = await supabase
            .from('billboards')
            .select('design_face_a, design_face_b')
            .in('Contract_Number', contractIds);
          
          if (billboards) {
            billboards.forEach((b: any) => {
              if (b.design_face_a && !seen.has(b.design_face_a)) {
                seen.add(b.design_face_a);
                images.push({ url: b.design_face_a, face: 'a' });
              }
              if (b.design_face_b && !seen.has(b.design_face_b)) {
                seen.add(b.design_face_b);
                images.push({ url: b.design_face_b, face: 'b' });
              }
            });
          }
        }
        
        setDesignImages(images.slice(0, 4)); // حد أقصى 4 صور
      } catch (error) {
        console.error('Error fetching contract info:', error);
      }
    };
    
    fetchContractInfo();
  }, [task.installation_task_id, task.contract_id, task.print_task_id]);

  // ✅ حساب تكلفة التركيب من جدول المقاسات (installation_price) + التكاليف الإضافية
  useEffect(() => {
    const calculateInstallCost = async () => {
      if (!task.installation_task_id) {
        setCalculatedInstallCost(0);
        return;
      }

      try {
        // جلب بيانات اللوحات من installation_task_items مع التكاليف الإضافية
        const { data: installItems } = await supabase
          .from('installation_task_items')
          .select('faces_to_install, reinstall_count, billboard:billboards!installation_task_items_billboard_id_fkey(Size, Faces_Count), additional_cost')
          .eq('task_id', task.installation_task_id);

        if (!installItems || installItems.length === 0) {
          setCalculatedInstallCost(0);
          return;
        }

        // جلب أسعار التركيب من جدول المقاسات
        const { data: sizesData } = await supabase
          .from('sizes')
          .select('name, installation_price');

        const sizesMap: Record<string, number> = {};
        sizesData?.forEach((s: any) => {
          sizesMap[s.name] = s.installation_price || 0;
        });

        // حساب إجمالي تكلفة التركيب + التكاليف الإضافية
        let total = 0;
        installItems.forEach((item: any) => {
          const billboardSize = item.billboard?.Size;
          const fullPrice = sizesMap[billboardSize] || 0;
          const facesToInstall = item.faces_to_install || 2;
          const totalFaces = item.billboard?.Faces_Count || 2;
          
          // حساب التكلفة بناءً على عدد الأوجه المطلوب تركيبها
          let installPrice = fullPrice;
          if (facesToInstall < totalFaces && totalFaces > 0) {
            installPrice = fullPrice * (facesToInstall / totalFaces);
          }
          
          total += installPrice;
          // إضافة التكاليف الإضافية
          total += item.additional_cost || 0;
        });

        setCalculatedInstallCost(total);
      } catch (error) {
        console.error('Error calculating install cost:', error);
        setCalculatedInstallCost(0);
      }
    };

    calculateInstallCost();
  }, [task.installation_task_id]);

  // Using UnifiedTaskInvoice now - old handlers removed

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: 'قيد الانتظار', variant: 'outline' },
      in_progress: { label: 'قيد التنفيذ', variant: 'default' },
      completed: { label: 'مكتمل', variant: 'secondary' },
      cancelled: { label: 'ملغي', variant: 'destructive' }
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  const getTaskTypeBadge = (type: string) => {
    if (type === 'new_installation') {
      return <Badge className="bg-blue-500">تركيب جديد (شامل)</Badge>;
    }
    return <Badge className="bg-orange-500">إعادة تركيب</Badge>;
  };

  const handleDelete = async () => {
    setDeleting(true);
    try {
      // حذف سجلات customer_payments المرتبطة بفواتير الطباعة والقص
      if (task.print_task_id) {
        const { data: printTask } = await supabase
          .from('print_tasks')
          .select('invoice_id')
          .eq('id', task.print_task_id)
          .single();
        
        if (printTask?.invoice_id) {
          // حذف سجلات الدفع المرتبطة بالفاتورة
          await supabase
            .from('customer_payments')
            .delete()
            .eq('printed_invoice_id', printTask.invoice_id);
          
          // حذف بنود مهمة الطباعة
          await supabase
            .from('print_task_items')
            .delete()
            .eq('task_id', task.print_task_id);
          
          // حذف مهمة الطباعة
          await supabase
            .from('print_tasks')
            .delete()
            .eq('id', task.print_task_id);
          
          // حذف الفاتورة
          await supabase
            .from('printed_invoices')
            .delete()
            .eq('id', printTask.invoice_id);
        }
      }

      if (task.cutout_task_id) {
        const { data: cutoutTask } = await supabase
          .from('cutout_tasks')
          .select('invoice_id')
          .eq('id', task.cutout_task_id)
          .single();
        
        if (cutoutTask?.invoice_id) {
          // حذف سجلات الدفع المرتبطة بالفاتورة
          await supabase
            .from('customer_payments')
            .delete()
            .eq('printed_invoice_id', cutoutTask.invoice_id);
          
          // حذف بنود مهمة القص
          await supabase
            .from('cutout_task_items')
            .delete()
            .eq('task_id', task.cutout_task_id);
          
          // حذف مهمة القص
          await supabase
            .from('cutout_tasks')
            .delete()
            .eq('id', task.cutout_task_id);
          
          // حذف الفاتورة
          await supabase
            .from('printed_invoices')
            .delete()
            .eq('id', cutoutTask.invoice_id);
        }
      }

      // حذف الفاتورة الموحدة إذا وجدت
      if (task.combined_invoice_id) {
        await supabase
          .from('customer_payments')
          .delete()
          .eq('printed_invoice_id', task.combined_invoice_id);
        
        await supabase
          .from('printed_invoices')
          .delete()
          .eq('id', task.combined_invoice_id);
      }

      // Clear the references to related tasks
      const { error: updateError } = await supabase
        .from('composite_tasks')
        .update({
          installation_task_id: null,
          print_task_id: null,
          cutout_task_id: null,
          combined_invoice_id: null
        })
        .eq('id', task.id);

      if (updateError) throw updateError;

      // Now delete the composite task
      const { error: deleteError } = await supabase
        .from('composite_tasks')
        .delete()
        .eq('id', task.id);

      if (deleteError) throw deleteError;

      toast.success('تم حذف المهمة المجمعة وجميع الفواتير المرتبطة بها');
      setShowDeleteDialog(false);
      if (onDelete) onDelete();
    } catch (error) {
      console.error('Error deleting composite task:', error);
      toast.error('فشل في حذف المهمة المجمعة');
    } finally {
      setDeleting(false);
    }
  };

  // Check if task has cutouts
  const hasCutouts = task.customer_cutout_cost > 0 || task.company_cutout_cost > 0;

  // حساب إجمالي الزبون الفعلي ديناميكياً لتفادي 5520 د.ل والمزامنة الفورية
  const realCustomerInstallCost = realtimeCustomerInstall > 0 ? realtimeCustomerInstall : (task.customer_installation_cost || 0);
  const displayCustomerTotal = realCustomerInstallCost + (task.customer_print_cost || 0) + (task.customer_cutout_cost || 0) - (task.discount_amount || 0);

  // تحديد حالة الإكمال بناءً على حالة المهمة
  const isCompleted = task.status === 'completed';
  const isPartiallyCompleted = task.status === 'in_progress';

  // لا نظهر التصميم هنا لأنه يظهر في CollapsibleGroupCard
  return (
    <div className={`relative rounded-lg transition-all duration-300 ${
      isCompleted 
        ? 'ring-2 ring-green-500/50 bg-green-50/30 dark:bg-green-950/20' 
        : isPartiallyCompleted 
          ? 'ring-2 ring-amber-500/50 bg-amber-50/30 dark:bg-amber-950/20' 
          : ''
    }`}>
      <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="space-y-2">
            <CardTitle className="text-lg text-foreground">
              {task.customer_name || 'غير محدد'} - 
              {contractInfo?.contractIds && contractInfo.contractIds.length > 1 ? (
                <span> عقود #{contractInfo.contractIds.join(', #')}</span>
              ) : (
                <span> عقد #{task.contract_id}</span>
              )}
            </CardTitle>
            {/* اسم المهمة مع إمكانية التعديل */}
            {isEditingName ? (
              <div className="flex items-center gap-2 mt-1">
                <Input
                  ref={nameInputRef}
                  value={editedName}
                  onChange={e => setEditedName(e.target.value)}
                  placeholder="أدخل اسم المهمة..."
                  className="h-8 text-sm max-w-[250px]"
                  onKeyDown={async e => {
                    if (e.key === 'Enter') {
                      setSavingName(true);
                      await supabase.from('composite_tasks').update({ task_name: editedName.trim() || null }).eq('id', task.id);
                      setSavingName(false);
                      setIsEditingName(false);
                      toast.success('تم تحديث اسم المهمة');
                    } else if (e.key === 'Escape') {
                      setEditedName((task as any).task_name || '');
                      setIsEditingName(false);
                    }
                  }}
                  autoFocus
                />
                <button
                  onClick={async () => {
                    setSavingName(true);
                    await supabase.from('composite_tasks').update({ task_name: editedName.trim() || null }).eq('id', task.id);
                    setSavingName(false);
                    setIsEditingName(false);
                    toast.success('تم تحديث اسم المهمة');
                  }}
                  disabled={savingName}
                  className="p-1.5 rounded-md hover:bg-emerald-500/10 text-emerald-500 transition-colors"
                >
                  {savingName ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                </button>
                <button
                  onClick={() => { setEditedName((task as any).task_name || ''); setIsEditingName(false); }}
                  className="p-1.5 rounded-md hover:bg-red-500/10 text-red-500 transition-colors"
                >
                  <XIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsEditingName(true)}
                className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-1 group/name cursor-pointer"
              >
                <Pencil className="h-3 w-3 opacity-0 group-hover/name:opacity-100 transition-opacity" />
                <span>{(task as any).task_name || 'انقر لإضافة اسم للمهمة...'}</span>
              </button>
            )}
            <div className="flex gap-2 flex-wrap items-center">
              {getTaskTypeBadge(task.task_type)}
              {getStatusBadge(task.status)}
              {contractInfo?.adTypes && contractInfo.adTypes.length > 0 && (
                contractInfo.adTypes.length === 1 ? (
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md text-xs font-black bg-amber-500/10 text-amber-300 border border-amber-500/30 shadow-sm">
                    <Megaphone className="h-3 w-3 text-amber-400 shrink-0" />
                    <span>نوع الإعلان: {contractInfo.adTypes[0].adType}</span>
                  </span>
                ) : (
                  contractInfo.adTypes.map((info, idx) => (
                    <span key={idx} className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs font-black bg-amber-500/10 text-amber-300 border border-amber-500/30 shadow-sm">
                      <Megaphone className="h-3 w-3 text-amber-400 shrink-0" />
                      <span>#{info.contractId}: {info.adType}</span>
                    </span>
                  ))
                )
              )}
              {task.invoice_generated && (
                <Badge className="bg-primary/20 text-primary border-primary/30">
                  <FileText className="h-3 w-3 mr-1" />
                  فاتورة صادرة
                </Badge>
              )}
            </div>
          </div>
          {/* المستحق على الزبون - بارز في الهيدر */}
          <div className="flex flex-col items-end gap-1">
            <div className="text-[11px] text-muted-foreground">المستحق على الزبون</div>
            <div className="text-2xl font-bold text-emerald-600 dark:text-emerald-400">
              {displayCustomerTotal.toLocaleString('en-US')} د.ل
            </div>
            <div className="text-xs text-muted-foreground">
              {format(new Date(task.created_at), 'dd MMM yyyy', { locale: ar })}
            </div>
          </div>
        </div>

        {/* عدد صور التصميم فقط - الصور تظهر في الجانب */}
        {designImages.length > 1 && (
          <div className="pt-2">
            <Badge variant="outline" className="text-xs">
              {designImages.length} تصميم
            </Badge>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* تنبيه بعدم مطابقة التكاليف في حال وجود تغييرات متأخرة */}
        {needsRecalculation && (
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-4 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-800 dark:text-amber-300 transition-all duration-200">
            <div className="flex gap-3">
              <div className="p-2 rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400 mt-0.5 md:mt-0">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <h5 className="font-bold text-sm">تنبيه: التكاليف المسجلة غير مطابقة للواقع</h5>
                <p className="text-xs leading-relaxed text-amber-700/90 dark:text-amber-400/90">
                  تم الكشف عن تحديثات متأخرة في المهام المكونة (التركيب أو الطباعة أو القص) مما يجعل التكاليف المخزنة غير متطابقة.
                </p>
                {recalculationReasons.length > 0 && (
                  <ul className="text-[11px] list-disc list-inside space-y-0.5 text-amber-600 dark:text-amber-400 mt-1.5 font-mono">
                    {recalculationReasons.map((reason, idx) => (
                      <li key={idx}>{reason}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRecalculateCostsDirectly}
              disabled={isRecalculating}
              className="w-full md:w-auto bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-300 border-amber-500/30 text-xs font-semibold shrink-0 cursor-pointer flex items-center gap-1.5"
            >
              {isRecalculating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="h-3.5 w-3.5" />
              )}
              إعادة حساب وتحديث التكاليف
            </Button>
          </div>
        )}

        {/* المهام المرتبطة - تكلفة الزبون */}
        <div className="space-y-3">
          <h4 className="text-sm font-semibold flex items-center gap-2 text-foreground">
            <TrendingUp className="h-4 w-4 text-primary" />
            التكاليف المحسوبة على الزبون
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* مهمة التركيب */}
            <div className="flex items-center gap-2 p-3 bg-primary/5 border border-primary/20 rounded-lg">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Wrench className="h-4 w-4 text-primary" />
              </div>
              <div className="flex-1">
                <div className="text-sm font-medium text-muted-foreground">التركيب</div>
                <div className="text-lg font-bold text-primary">
                  {displayInstallCost.toLocaleString('en-US')} د.ل
                </div>
                {task.task_type === 'reinstallation' && displayInstallCost > 0 && (
                  <div className="text-[10px] text-orange-500 mt-0.5">
                    ↺ إعادة تركيب
                  </div>
                )}
                {task.task_type === 'new_installation' && displayInstallCost === 0 && (
                  <div className="text-xs text-muted-foreground">شامل مع العقد</div>
                )}
              </div>
            </div>

            {/* مهمة الطباعة */}
            {task.print_task_id && (
              <div className="flex items-center gap-2 p-3 bg-accent/5 border border-accent/20 rounded-lg">
                <div className="p-1.5 rounded-lg bg-accent/10">
                  <Printer className="h-4 w-4 text-accent" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground">الطباعة</div>
                  <div className="text-lg font-bold text-accent">
                    {task.customer_print_cost.toLocaleString('en-US')} د.ل
                  </div>
                </div>
              </div>
            )}

            {/* مهمة القص */}
            {hasCutouts && (
              <div className="flex items-center gap-2 p-3 bg-purple-500/5 border border-purple-500/20 rounded-lg">
                <div className="p-1.5 rounded-lg bg-purple-500/10">
                  <Scissors className="h-4 w-4 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-muted-foreground">القص</div>
                  <div className="text-lg font-bold text-purple-600 dark:text-purple-400">
                    {task.customer_cutout_cost.toLocaleString('en-US')} د.ل
                  </div>
                </div>
              </div>
            )}
          </div>
          
          {/* إجمالي تكلفة الزبون */}
          <div className="p-4 bg-primary/10 rounded-lg border border-primary/30">
            <div className="flex justify-between items-center">
              <span className="text-base font-semibold text-foreground">
                إجمالي المستحق على الزبون
              </span>
              <span className="text-2xl font-bold text-primary">
                {displayCustomerTotal.toLocaleString('en-US')} د.ل
              </span>
            </div>
          </div>
        </div>

        {/* الخصم */}
        {(task.discount_amount || 0) > 0 && (
          <div className="p-3 bg-red-50 dark:bg-red-950/20 rounded-lg border border-red-200 dark:border-red-800">
            <div className="flex justify-between items-center">
              <span className="text-sm text-red-700 dark:text-red-400">
                خصم {task.discount_reason && <span className="text-xs">({task.discount_reason})</span>}
              </span>
              <span className="font-bold text-red-600">- {(task.discount_amount || 0).toLocaleString('en-US')} د.ل</span>
            </div>
          </div>
        )}

        {/* تحليل الربحية - استخدام القيم المخزنة من قاعدة البيانات */}
        <CompositeProfitCard
          customerTotal={task.customer_total || 0}
          companyTotal={task.company_total || 0}
          netProfit={task.net_profit || 0}
          profitPercentage={task.profit_percentage || 0}
          taskType={task.task_type}
          companyInstallationCost={task.company_installation_cost || 0}
        />

        {/* ملاحظات */}
        {task.notes && (
          <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
            {task.notes}
          </div>
        )}

        {/* الإجراءات */}
        <div className="space-y-3 pt-4 border-t border-border/50">
          {/* أزرار الطباعة - بارزة وواضحة */}
          <div className="bg-muted/30 p-4 rounded-lg space-y-3 border border-border/30">
            <h4 className="text-sm font-semibold flex items-center gap-2 mb-3 text-foreground">
              <FileOutput className="h-4 w-4 text-primary" />
              طباعة الفواتير
            </h4>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
              {/* فاتورة الزبون */}
              <Button
                variant="default"
                size="sm"
                onClick={() => openInvoice('customer')}
                className="bg-primary hover:bg-primary/90"
              >
                <FileText className="h-4 w-4 mr-2" />
                فاتورة الزبون
              </Button>
              
              {/* فاتورة المطبعة */}
              {task.print_task_id && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => openInvoice('print_vendor')}
                  className="bg-blue-600 hover:bg-blue-700"
                >
                  <Printer className="h-4 w-4 mr-2" />
                  فاتورة المطبعة
                </Button>
              )}

              {/* فاتورة القص */}
              {hasCutouts && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => openInvoice('cutout_vendor')}
                  className="bg-purple-600 hover:bg-purple-700"
                >
                  <Scissors className="h-4 w-4 mr-2" />
                  فاتورة القص
                </Button>
              )}

              {/* فاتورة التركيب */}
              {task.installation_task_id && (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => openInvoice('installation_team')}
                  className="bg-green-600 hover:bg-green-700"
                >
                  <Users className="h-4 w-4 mr-2" />
                  فاتورة الفرقة
                </Button>
              )}
            </div>
          </div>

          {/* أزرار الإدارة */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            {onEditCosts && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEditCosts(task)}
              >
                <Edit className="h-4 w-4 mr-2" />
                تعديل التكاليف
              </Button>
            )}

            {task.combined_invoice_id && onViewInvoice && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onViewInvoice(task)}
              >
                <Eye className="h-4 w-4 mr-2" />
                عرض الفاتورة
              </Button>
            )}

            <Button
              variant="destructive"
              size="sm"
              onClick={() => setShowDeleteDialog(true)}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              حذف
            </Button>
          </div>
        </div>

        {/* Unified Invoice Dialog */}
        <UnifiedTaskInvoice
          open={invoiceDialogOpen}
          onOpenChange={setInvoiceDialogOpen}
          task={task}
          invoiceType={currentInvoiceType}
        />

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
              <AlertDialogDescription>
                هل أنت متأكد من حذف هذه المهمة المجمعة؟ هذا الإجراء لا يمكن التراجع عنه.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel disabled={deleting}>إلغاء</AlertDialogCancel>
              <AlertDialogAction
                onClick={handleDelete}
                disabled={deleting}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    جاري الحذف...
                  </>
                ) : (
                  'حذف'
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardContent>
      </Card>
    </div>
  );
};
