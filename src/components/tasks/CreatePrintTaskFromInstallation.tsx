import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Printer, Scissors, FileText, Loader2, Coins, LayoutGrid } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { useQueryClient } from '@tanstack/react-query';
import { DesignDisplayCard } from '@/components/print-tasks/DesignDisplayCard';
import { PrintTaskInvoice } from './PrintTaskInvoice';
import { CutoutTaskInvoice } from './CutoutTaskInvoice';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface DesignGroup {
  design: string;
  face: 'a' | 'b';
  size: string;
  quantity: number;
  area: number;
  billboards: number[];
  width: number;
  height: number;
  facesCount: number; // عدد الأوجه المطلوب طباعتها
  hasCutout?: boolean;
  cutoutCount?: number;
  cutoutBillboards?: number[];
  cutoutImageUrl?: string;
  printerCostPerMeter: number;
  printerCutoutCostPerUnit: number;
  customerCostPerMeter: number;
  customerCutoutCostPerUnit: number;
}

interface BillboardInfo {
  ID: number;
  Size: string;
  has_cutout?: boolean;
  Faces_Count?: number;
}

interface TaskItem {
  id: string;
  billboard_id: number;
  design_face_a: string | null;
  design_face_b: string | null;
  has_cutout?: boolean;
  selected_design_id?: string | null;
  faces_to_install?: number; // عدد الأوجه المختارة للتركيب/الطباعة
}

interface CreatePrintTaskFromInstallationProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  installationTaskId: string;
  taskItems: TaskItem[];
  onSuccess?: () => void;
}

export function CreatePrintTaskFromInstallation({
  open,
  onOpenChange,
  installationTaskId,
  taskItems,
  onSuccess
}: CreatePrintTaskFromInstallationProps) {
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [designGroups, setDesignGroups] = useState<DesignGroup[]>([]);
  const [billboardsMap, setBillboardsMap] = useState<Record<number, BillboardInfo>>({});
  const [enrichedTaskItems, setEnrichedTaskItems] = useState<TaskItem[]>([]);
  const [printerId, setPrinterId] = useState<string>('');
  const [cutoutPrinterId, setCutoutPrinterId] = useState<string>('');
  const [printers, setPrinters] = useState<Array<{ id: string; name: string }>>([]);
  const [cutoutImageUrls, setCutoutImageUrls] = useState<Record<string, string>>({});
  const hasFetchedRef = useRef(false);
  const [showPrintInvoice, setShowPrintInvoice] = useState(false);
  const [showCutoutInvoice, setShowCutoutInvoice] = useState(false);
  const [sizesMap, setSizesMap] = useState<Record<string, { width: number; height: number }>>({});
  
  // نظام التوزيع الذكي للمجسمات
  const [totalCutoutPrinterCost, setTotalCutoutPrinterCost] = useState<number>(0);
  const [totalCutoutCustomerCost, setTotalCutoutCustomerCost] = useState<number>(0);
  const [useDistribution, setUseDistribution] = useState(false);
  
  // أسعار التعديل الجماعي
  const [bulkPrinterCostPerMeter, setBulkPrinterCostPerMeter] = useState<number>(10);
  const [bulkCustomerCostPerMeter, setBulkCustomerCostPerMeter] = useState<number>(20);
  const [selectedBillboardIds, setSelectedBillboardIds] = useState<number[]>([]);
  const [activeStep, setActiveStep] = useState<1 | 2 | 3>(1);

  useEffect(() => {
    if (!open) {
      setDesignGroups([]);
      setBillboardsMap({});
      setEnrichedTaskItems([]);
      setPrinterId('');
      setCutoutPrinterId('');
      setCutoutImageUrls({});
      setShowPrintInvoice(false);
      setShowCutoutInvoice(false);
      setTotalCutoutPrinterCost(0);
      setTotalCutoutCustomerCost(0);
      setUseDistribution(false);
      setBulkPrinterCostPerMeter(10);
      setBulkCustomerCostPerMeter(20);
      hasFetchedRef.current = false;
      setSelectedBillboardIds([]);
      setActiveStep(1);
    }
  }, [open, installationTaskId]);

  useEffect(() => {
    const fetchData = async () => {
      console.log('Fetching data for print task...');
      
      const billboardIds = taskItems.map(item => item.billboard_id);
      const designIds = taskItems
        .map(item => item.selected_design_id)
        .filter(id => id != null);

      const [pricingResult, billboardsResult, designsResult, printersResult, sizesResult, facesResult] = await Promise.all([
        supabase.from('installation_print_pricing').select('print_price').limit(1).single(),
        billboardIds.length > 0 ? supabase.from('billboards').select('ID, Size, has_cutout, Faces_Count').in('ID', billboardIds) : null,
        designIds.length > 0 ? supabase.from('task_designs').select('id, design_face_a_url, design_face_b_url, cutout_image_url').in('id', designIds) : null,
        supabase.from('printers').select('id, name').eq('is_active', true),
        supabase.from('sizes').select('id, name, width, height'),
        // جلب faces_to_install من بنود مهمة التركيب
        billboardIds.length > 0 ? supabase.from('installation_task_items').select('billboard_id, faces_to_install').eq('task_id', installationTaskId) : null
      ]);

      // تخزين بيانات الأحجام
      if (sizesResult.data && !sizesResult.error) {
        const map: Record<string, { width: number; height: number }> = {};
        sizesResult.data.forEach((s: any) => {
          if (s.width && s.height) {
            map[s.name] = { width: s.width, height: s.height };
            map[s.name.toLowerCase()] = { width: s.width, height: s.height };
          }
        });
        setSizesMap(map);
      }

      // خريطة faces_to_install من بنود التركيب
      const facesToInstallMap: Record<number, number> = {};
      if (facesResult && !facesResult.error && facesResult.data) {
        facesResult.data.forEach((item: any) => {
          facesToInstallMap[item.billboard_id] = item.faces_to_install || 1;
        });
      }

      if (billboardsResult && !billboardsResult.error) {
        const map: Record<number, BillboardInfo> = {};
        billboardsResult.data?.forEach((b: any) => {
          const facesFromItem = facesToInstallMap[b.ID];
          map[b.ID] = {
            ID: b.ID,
            Size: b.Size || '3x4',
            has_cutout: b.has_cutout || false,
            Faces_Count: facesFromItem || b.Faces_Count || 1
          };
        });
        setBillboardsMap(map);
      }

      if (designsResult && !designsResult.error && designsResult.data) {
        const updatedItems = taskItems.map(item => {
          if (item.selected_design_id) {
            const design = designsResult.data?.find(d => d.id === item.selected_design_id);
            if (design) {
              if (design.cutout_image_url && item.has_cutout) {
                const key = `${design.design_face_a_url || design.design_face_b_url}-${item.billboard_id}`;
                setCutoutImageUrls(prev => ({...prev, [key]: design.cutout_image_url || ''}));
              }
              return {
                ...item,
                design_face_a: design.design_face_a_url,
                design_face_b: design.design_face_b_url
              };
            }
          }
          return item;
        });
        setEnrichedTaskItems(updatedItems);
        const idsWithDesigns = updatedItems
          .filter(item => item.design_face_a || item.design_face_b)
          .map(item => item.billboard_id);
        setSelectedBillboardIds(idsWithDesigns);
      } else {
        setEnrichedTaskItems(taskItems);
        const idsWithDesigns = taskItems
          .filter(item => item.design_face_a || item.design_face_b)
          .map(item => item.billboard_id);
        setSelectedBillboardIds(idsWithDesigns);
      }

      if (printersResult.data && printersResult.data.length > 0) {
        setPrinters(printersResult.data.map(p => ({ id: p.id, name: p.name })));
      } else {
        setPrinters([]);
      }
    };
    
    if (open && taskItems.length > 0 && !hasFetchedRef.current) {
      hasFetchedRef.current = true;
      fetchData();
    }
  }, [open, taskItems, installationTaskId]);

  useEffect(() => {
    if (Object.keys(billboardsMap).length === 0) return;
    if (!enrichedTaskItems || enrichedTaskItems.length === 0) {
      setDesignGroups([]);
      return;
    }

    const groups: Record<string, DesignGroup> = {};
    let hasDesigns = false;

    enrichedTaskItems.forEach(item => {
      if (!selectedBillboardIds.includes(item.billboard_id)) return;
      
      const billboard = billboardsMap[item.billboard_id];
      if (!billboard) return;
      
      const size = billboard.Size || '3x4';
      const hasCutout = item.has_cutout || billboard.has_cutout || false;
      const facesCount = item.faces_to_install || billboard.Faces_Count || 1;
      
      if (item.design_face_a) {
        hasDesigns = true;
        const key = `${size}_${item.design_face_a}_a`;
        if (!groups[key]) {
        const { width, height } = parseSizeDimensions(size);
          groups[key] = {
            design: item.design_face_a,
            face: 'a',
            size,
            quantity: 0,
            area: width * height,
            billboards: [],
            width,
            height,
            facesCount,
            hasCutout,
            cutoutCount: 0,
            cutoutBillboards: [],
            printerCostPerMeter: 10,
            printerCutoutCostPerUnit: 0,
            customerCostPerMeter: 20,
            customerCutoutCostPerUnit: 0
          };
        }
        // كل لوحة = بند واحد لكل وجه (face_a / face_b منفصلين أصلاً)
        groups[key].quantity += 1;
        groups[key].billboards.push(item.billboard_id);
        // تحديث أعلى عدد أوجه في المجموعة
        if (facesCount > groups[key].facesCount) {
          groups[key].facesCount = facesCount;
        }
        
        if (hasCutout) {
          groups[key].hasCutout = true;
          groups[key].cutoutCount = (groups[key].cutoutCount || 0) + 1;
          groups[key].cutoutBillboards = [...(groups[key].cutoutBillboards || []), item.billboard_id];
          const cutoutKey = `${item.design_face_a}-${item.billboard_id}`;
          groups[key].cutoutImageUrl = cutoutImageUrls[cutoutKey] || '';
        }
      }

      // ✅ لا تضف الوجه B إذا كان faces_to_install = 1
      if (item.design_face_b && facesCount >= 2) {
        hasDesigns = true;
        const key = `${size}_${item.design_face_b}_b`;
        if (!groups[key]) {
        const { width, height } = parseSizeDimensions(size);
          groups[key] = {
            design: item.design_face_b,
            face: 'b',
            size,
            quantity: 0,
            area: width * height,
            billboards: [],
            width,
            height,
            facesCount,
            hasCutout,
            cutoutCount: 0,
            cutoutBillboards: [],
            printerCostPerMeter: 10,
            printerCutoutCostPerUnit: 0,
            customerCostPerMeter: 20,
            customerCutoutCostPerUnit: 0
          };
        }
        groups[key].quantity += 1;
        groups[key].billboards.push(item.billboard_id);
        if (facesCount > groups[key].facesCount) {
          groups[key].facesCount = facesCount;
        }
        
        if (hasCutout) {
          groups[key].hasCutout = true;
          groups[key].cutoutCount = (groups[key].cutoutCount || 0) + 1;
          groups[key].cutoutBillboards = [...(groups[key].cutoutBillboards || []), item.billboard_id];
          const cutoutKey = `${item.design_face_b}-${item.billboard_id}`;
          groups[key].cutoutImageUrl = cutoutImageUrls[cutoutKey] || '';
        }
      }
    });

    const itemsWithDesigns = enrichedTaskItems.filter(item => item.design_face_a || item.design_face_b);
    if (itemsWithDesigns.length === 0) {
      toast.error('لم يتم العثور على تصاميم! يرجى تعيين التصاميم للوحات أولاً.');
    }

    setDesignGroups(Object.values(groups));
  }, [enrichedTaskItems, billboardsMap, cutoutImageUrls, sizesMap]);

  // استخدام الأبعاد الفعلية من جدول sizes
  const parseSizeDimensions = (size: string): { width: number; height: number } => {
    // البحث في جدول الأحجام أولاً
    const sizeData = sizesMap[size] || sizesMap[size.toLowerCase()];
    if (sizeData) {
      return { width: sizeData.width, height: sizeData.height };
    }
    
    // إذا لم نجد في الجدول، نحلل الاسم
    const parts = size.split(/[x×*]/);
    if (parts.length === 2) {
      return {
        width: parseFloat(parts[0]),
        height: parseFloat(parts[1])
      };
    }
    return { width: 3, height: 4 };
  };

  const { printGroups, cutoutGroups } = useMemo(() => {
    const print: DesignGroup[] = [];
    const cutout: DesignGroup[] = [];
    
    designGroups.forEach(group => {
      print.push({
        ...group,
        printerCutoutCostPerUnit: 0,
        customerCutoutCostPerUnit: 0
      });
      
      if (group.hasCutout && group.cutoutCount && group.cutoutCount > 0) {
        cutout.push(group);
      }
    });
    
    return { printGroups: print, cutoutGroups: cutout };
  }, [designGroups]);

  const updateGroupPrice = (index: number, field: keyof DesignGroup, value: number) => {
    setDesignGroups(prev => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  };

  // دالة التوزيع الذكي للتكاليف
  const distributeCutoutCosts = () => {
    if (cutoutGroups.length === 0) return;
    
    const totalQuantity = cutoutGroups.reduce((sum, g) => sum + (g.cutoutCount || 0), 0);
    
    if (totalQuantity === 0) {
      toast.error('لا توجد مجسمات للتوزيع');
      return;
    }
    
    const printerCostPerUnit = totalCutoutPrinterCost / totalQuantity;
    const customerCostPerUnit = totalCutoutCustomerCost / totalQuantity;
    
    setDesignGroups(prev => {
      const updated = [...prev];
      cutoutGroups.forEach((group, idx) => {
        const originalIndex = prev.findIndex(g => 
          g.design === group.design && 
          g.face === group.face && 
          g.size === group.size
        );
        
        if (originalIndex !== -1) {
          updated[originalIndex] = {
            ...updated[originalIndex],
            printerCutoutCostPerUnit: printerCostPerUnit,
            customerCutoutCostPerUnit: customerCostPerUnit
          };
        }
      });
      return updated;
    });
    
    toast.success(`تم توزيع التكاليف بنجاح - ${totalQuantity} مجسم`);
  };

  // دالة تطبيق الأسعار الجماعية على جميع اللوحات
  const applyBulkPrices = (applyPrinter: boolean, applyCustomer: boolean) => {
    if (designGroups.length === 0) {
      toast.error('لا توجد لوحات للتعديل');
      return;
    }

    setDesignGroups(prev => {
      return prev.map(group => ({
        ...group,
        ...(applyPrinter && { printerCostPerMeter: bulkPrinterCostPerMeter }),
        ...(applyCustomer && { customerCostPerMeter: bulkCustomerCostPerMeter })
      }));
    });

    const message = applyPrinter && applyCustomer 
      ? `تم تطبيق الأسعار الجماعية (مطبعة: ${bulkPrinterCostPerMeter} - زبون: ${bulkCustomerCostPerMeter}) على ${designGroups.length} مجموعة`
      : applyPrinter 
        ? `تم تطبيق سعر المطبعة ${bulkPrinterCostPerMeter} على ${designGroups.length} مجموعة`
        : `تم تطبيق سعر الزبون ${bulkCustomerCostPerMeter} على ${designGroups.length} مجموعة`;
    
    toast.success(message);
  };

  const calculateTotals = () => {
    let printerPrintCost = 0;
    let printerCutoutCost = 0;
    let customerPrintCost = 0;
    let customerCutoutCost = 0;

    printGroups.forEach(group => {
      const printArea = group.area * group.quantity;
      printerPrintCost += printArea * group.printerCostPerMeter;
      customerPrintCost += printArea * group.customerCostPerMeter;
    });
    
    cutoutGroups.forEach(group => {
      if (group.cutoutCount) {
        printerCutoutCost += group.cutoutCount * group.printerCutoutCostPerUnit;
        customerCutoutCost += group.cutoutCount * group.customerCutoutCostPerUnit;
      }
    });

    return {
      printerPrintTotal: printerPrintCost,
      printerCutoutTotal: printerCutoutCost,
      printerTotal: printerPrintCost + printerCutoutCost,
      customerPrintTotal: customerPrintCost,
      customerCutoutTotal: customerCutoutCost,
      customerTotal: customerPrintCost + customerCutoutCost,
      printProfit: customerPrintCost - printerPrintCost,
      cutoutProfit: customerCutoutCost - printerCutoutCost,
      totalProfit: (customerPrintCost + customerCutoutCost) - (printerPrintCost + printerCutoutCost)
    };
  };

  const handleNextStep = () => {
    if (activeStep === 1) {
      if (!printerId) {
        toast.error('يرجى اختيار مطبعة الطباعة');
        return;
      }
      if (selectedBillboardIds.length === 0) {
        toast.error('يرجى تحديد لوحة واحدة على الأقل');
        return;
      }
      setActiveStep(2);
    } else if (activeStep === 2) {
      setActiveStep(3);
    }
  };

  const handleCreatePrintTask = async () => {
    try {
      setLoading(true);

      if (!printerId) {
        toast.error('يرجى اختيار المطبعة');
        return;
      }

      const { data: installationTask, error: taskError } = await supabase
        .from('installation_tasks')
        .select('contract_id, contract_ids, task_type')
        .eq('id', installationTaskId)
        .single();

      if (taskError) throw taskError;

      // تحديد نوع المهمة
      const isReinstallation = installationTask.task_type === 'reinstallation';

      let contractIds = installationTask.contract_ids && installationTask.contract_ids.length > 0 
        ? installationTask.contract_ids 
        : [installationTask.contract_id];

      if (!contractIds || contractIds.length === 0 || !contractIds[0]) {
        throw new Error('لا يوجد رقم عقد مرتبط بمهمة التركيب');
      }

      const { data: contracts, error: contractError } = await supabase
        .from('Contract')
        .select('Contract_Number, customer_id, "Customer Name"')
        .in('Contract_Number', contractIds);

      if (contractError || !contracts || contracts.length === 0) {
        throw new Error('لم يتم العثور على بيانات العقد');
      }

      const customerData = {
        customer_id: contracts[0].customer_id,
        customer_name: contracts[0]['Customer Name']
      };

      if (!customerData.customer_id || !customerData.customer_name) {
        throw new Error('بيانات العميل غير مكتملة');
      }

      // 1. تنظيف أي مهام طباعة وقص سابقة لهذه المهمة التركيبية لتجنب تكرار الفواتير
      const { data: oldPrintTasks } = await supabase
        .from('print_tasks')
        .select('id, invoice_id')
        .eq('installation_task_id', installationTaskId);

      if (oldPrintTasks && oldPrintTasks.length > 0) {
        const oldPrintTaskIds = oldPrintTasks.map(t => t.id);
        const oldPrintInvoiceIds = oldPrintTasks.map(t => t.invoice_id).filter(Boolean);

        // حذف بنود مهام الطباعة القديمة
        await supabase
          .from('print_task_items')
          .delete()
          .in('task_id', oldPrintTaskIds);

        // حذف مهام الطباعة القديمة
        await supabase
          .from('print_tasks')
          .delete()
          .in('id', oldPrintTaskIds);

        // حذف فواتير الطباعة القديمة
        if (oldPrintInvoiceIds.length > 0) {
          await supabase
            .from('customer_payments')
            .delete()
            .in('printed_invoice_id', oldPrintInvoiceIds);

          await supabase
            .from('printed_invoices')
            .delete()
            .in('id', oldPrintInvoiceIds);
        }
      }

      const { data: oldCutoutTasks } = await supabase
        .from('cutout_tasks')
        .select('id, invoice_id')
        .eq('installation_task_id', installationTaskId);

      if (oldCutoutTasks && oldCutoutTasks.length > 0) {
        const oldCutoutTaskIds = oldCutoutTasks.map(t => t.id);
        const oldCutoutInvoiceIds = oldCutoutTasks.map(t => t.invoice_id).filter(Boolean);

        // حذف بنود مهام القص القديمة
        await supabase
          .from('cutout_task_items')
          .delete()
          .in('task_id', oldCutoutTaskIds);

        // حذف مهام القص القديمة
        await supabase
          .from('cutout_tasks')
          .delete()
          .in('id', oldCutoutTaskIds);

        // حذف فواتير القص القديمة
        if (oldCutoutInvoiceIds.length > 0) {
          await supabase
            .from('customer_payments')
            .delete()
            .in('printed_invoice_id', oldCutoutInvoiceIds);

          await supabase
            .from('printed_invoices')
            .delete()
            .in('id', oldCutoutInvoiceIds);
        }
      }

      const totals = calculateTotals();
      const totalArea = printGroups.reduce((sum, g) => sum + (g.area * g.quantity), 0);

      // إنشاء فاتورة الطباعة
      const printInvoiceNumber = `PT-${Date.now()}`;
      const { data: printInvoice, error: printInvoiceError } = await supabase
        .from('printed_invoices')
        .insert({
          contract_number: installationTask.contract_id,
          invoice_number: printInvoiceNumber,
          customer_id: customerData.customer_id,
          customer_name: customerData.customer_name,
          printer_id: printerId,
          printer_name: printers.find(p => p.id === printerId)?.name || 'غير محدد',
          invoice_date: new Date().toISOString().split('T')[0],
          total_amount: totals.customerPrintTotal,
          printer_cost: totals.printerPrintTotal,
          invoice_type: 'print',
          notes: `مهمة طباعة من التركيب ${installationTaskId}`
        })
        .select()
        .single();

      if (printInvoiceError) throw printInvoiceError;

      // إنشاء مهمة الطباعة
      const { data: printTask, error: printTaskError } = await supabase
        .from('print_tasks')
        .insert({
          invoice_id: printInvoice.id,
          contract_id: installationTask.contract_id,
          customer_id: customerData.customer_id,
          customer_name: customerData.customer_name,
          customer_total_amount: totals.customerPrintTotal,
          printer_id: printerId,
          status: 'pending',
          total_area: totalArea,
          total_cost: totals.printerPrintTotal,
          printer_total_cost: totals.printerPrintTotal,
          price_per_meter: totalArea > 0 ? totals.printerPrintTotal / totalArea : 0,
          priority: 'normal',
          installation_task_id: installationTaskId,
          is_composite: true,
          notes: `مهمة طباعة من التركيب - الربح: ${totals.printProfit.toFixed(2)} د.ل`
        })
        .select()
        .single();

      if (printTaskError) throw printTaskError;

      // تحديث مهمة التركيب لربطها بمهمة الطباعة
      await supabase
        .from('installation_tasks')
        .update({ print_task_id: printTask.id })
        .eq('id', installationTaskId);

      // إنشاء بنود مهمة الطباعة - بند منفصل لكل لوحة مع مراعاة عدد الأوجه
      const printTaskItems = printGroups.flatMap(group => 
        group.billboards.map(billboardId => {
          const billboard = billboardsMap[billboardId];
          const _facesCount = billboard?.Faces_Count || 1;
          return {
            task_id: printTask.id,
            billboard_id: billboardId,
            description: `${group.size} - ${group.face === 'a' ? 'وجه أمامي' : 'وجه خلفي'}`,
            width: group.width,
            height: group.height,
            area: group.area,
            quantity: 1,
            faces_count: 1,
            unit_cost: group.printerCostPerMeter * group.area,
            printer_unit_cost: group.printerCostPerMeter * group.area,
            customer_unit_cost: group.customerCostPerMeter * group.area,
            total_cost: group.printerCostPerMeter * group.area,
            design_face_a: group.face === 'a' ? group.design : null,
            design_face_b: group.face === 'b' ? group.design : null,
            has_cutout: group.cutoutBillboards?.includes(billboardId) || false,
            cutout_quantity: group.cutoutBillboards?.includes(billboardId) ? 1 : 0,
            cutout_image_url: (group.cutoutBillboards?.includes(billboardId) && group.cutoutImageUrl) || null,
            model_link: (group.cutoutBillboards?.includes(billboardId) && group.cutoutImageUrl) || null,
            status: 'pending'
          };
        })
      );

      const { error: printItemsError } = await supabase
        .from('print_task_items')
        .insert(printTaskItems);

      if (printItemsError) throw printItemsError;

      let cutoutInvoiceId: string | null = null;

      // إنشاء مهمة القص إذا كانت هناك مجسمات
      if (cutoutGroups.length > 0 && totals.printerCutoutTotal > 0) {
        const cutoutInvoiceNumber = `CT-${Date.now()}`;
        const { data: cutoutInvoice, error: cutoutInvoiceError } = await supabase
          .from('printed_invoices')
          .insert({
            contract_number: installationTask.contract_id,
            invoice_number: cutoutInvoiceNumber,
            customer_id: customerData.customer_id,
            customer_name: customerData.customer_name,
            printer_id: printerId,
            printer_name: printers.find(p => p.id === printerId)?.name || 'غير محدد',
            invoice_date: new Date().toISOString().split('T')[0],
            total_amount: totals.customerCutoutTotal,
            printer_cost: totals.printerCutoutTotal,
            invoice_type: 'cutout',
            notes: `مهمة قص من التركيب ${installationTaskId}`
          })
          .select()
          .single();

        if (cutoutInvoiceError) throw cutoutInvoiceError;

        if (cutoutInvoice) {
          cutoutInvoiceId = cutoutInvoice.id;
        }

        const totalCutoutQuantity = cutoutGroups.reduce((sum, g) => sum + (g.cutoutCount || 0), 0);

        const { data: createdCutoutTask, error: cutoutTaskError } = await supabase
          .from('cutout_tasks')
          .insert({
            invoice_id: cutoutInvoice.id,
            contract_id: installationTask.contract_id,
            customer_id: customerData.customer_id,
            customer_name: customerData.customer_name,
            customer_total_amount: totals.customerCutoutTotal,
            printer_id: cutoutPrinterId || printerId,
            status: 'pending',
            total_cost: totals.printerCutoutTotal,
            total_quantity: totalCutoutQuantity,
            unit_cost: totalCutoutQuantity > 0 ? totals.printerCutoutTotal / totalCutoutQuantity : 0,
            priority: 'normal',
            installation_task_id: installationTaskId,
            notes: `مهمة قص من التركيب - الربح: ${totals.cutoutProfit.toFixed(2)} د.ل`,
            is_composite: true
          })
          .select()
          .single();

        if (cutoutTaskError) throw cutoutTaskError;

        // تحديث مهمة التركيب لربطها بمهمة القص/المجسمات
        await supabase
          .from('installation_tasks')
          .update({ cutout_task_id: createdCutoutTask.id })
          .eq('id', installationTaskId);

        // إنشاء بنود مهمة القص لكل لوحة بها مجسم مع مراعاة عدد الأوجه
        const cutoutTaskItems = cutoutGroups.flatMap(group => 
          (group.cutoutBillboards || []).map(billboardId => {
            const billboard = billboardsMap[billboardId];
            const facesCount = billboard?.Faces_Count || 1;
            return {
              task_id: createdCutoutTask.id,
              billboard_id: billboardId,
              description: `مجسم ${group.size} - ${group.face === 'a' ? 'وجه أمامي' : 'وجه خلفي'} (${facesCount} ${facesCount === 1 ? 'وجه' : 'أوجه'})`,
              quantity: facesCount,
              faces_count: facesCount,
              unit_cost: group.printerCutoutCostPerUnit,
              total_cost: group.printerCutoutCostPerUnit * facesCount,
              cutout_image_url: group.cutoutImageUrl || null,
              status: 'pending'
            };
          })
        );

        const { error: cutoutItemsError } = await supabase
          .from('cutout_task_items')
          .insert(cutoutTaskItems);

        if (cutoutItemsError) throw cutoutItemsError;

        // ملاحظة: لا نسجل في حساب الزبون هنا لأن الفاتورة الموحدة للمهمة المجمعة ستتكفل بذلك
        // هذا يمنع تكرار الديون في قائمة الفواتير
      }

      // === إنشاء أو تحديث المهمة المجمعة ===
      // Note: cutoutTask variable already exists from line 541-559 if cutout groups exist

      // جلب تكلفة التركيب للزبون من بنود مهمة التركيب
      const { data: taskItemsCostData } = await supabase
        .from('installation_task_items')
        .select('customer_installation_cost')
        .eq('task_id', installationTaskId);
      
      const customerInstallationCostFromItems = taskItemsCostData?.reduce(
        (sum, item) => sum + (item.customer_installation_cost || 0), 
        0
      ) || 0;

      // جلب تكلفة التركيب الفعلية للشركة من حساب فريق التركيب
      const { data: taskItemIds } = await supabase
        .from('installation_task_items')
        .select('id')
        .eq('task_id', installationTaskId);
      
      let companyInstallationCost = 0;
      if (taskItemIds && taskItemIds.length > 0) {
        const itemIds = taskItemIds.map(item => item.id);
        const { data: teamAccountData } = await supabase
          .from('installation_team_accounts')
          .select('amount')
          .in('task_item_id', itemIds);
        
        companyInstallationCost = teamAccountData?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
      }

      // البحث عن مهمة مجمعة موجودة أو إنشاء جديدة
      const { data: existingComposite } = await supabase
        .from('composite_tasks')
        .select('id, combined_invoice_id, discount_amount')
        .eq('installation_task_id', installationTaskId)
        .maybeSingle();

      // استخدام المتغير الصحيح للـ cutout task إذا تم إنشاؤه
      let cutoutTaskId = null;
      if (cutoutGroups.length > 0 && totals.printerCutoutTotal > 0) {
        const { data: foundCutoutTask } = await supabase
          .from('cutout_tasks')
          .select('id')
          .eq('installation_task_id', installationTaskId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        cutoutTaskId = foundCutoutTask?.id || null;
      }

      // تكلفة التركيب للزبون: في حالة إعادة التركيب تحسب، في التركيب الجديد = 0
      const customerInstallationCost = isReinstallation ? customerInstallationCostFromItems : 0;
      
      const compositeData = {
        contract_id: installationTask.contract_id,
        customer_id: customerData.customer_id,
        customer_name: customerData.customer_name,
        task_type: isReinstallation ? 'reinstallation' : 'new_installation',
        installation_task_id: installationTaskId,
        print_task_id: printTask.id,
        cutout_task_id: cutoutTaskId,
        // تكاليف الزبون
        customer_installation_cost: customerInstallationCost, // التركيب شامل من العقد في التركيب الجديد فقط
        customer_print_cost: totals.customerPrintTotal,
        customer_cutout_cost: totals.customerCutoutTotal,
        // تكاليف الشركة
        company_installation_cost: companyInstallationCost,
        company_print_cost: totals.printerPrintTotal,
        company_cutout_cost: totals.printerCutoutTotal,
        // الإجماليات
        customer_total: customerInstallationCost + totals.customerPrintTotal + totals.customerCutoutTotal,
        company_total: companyInstallationCost + totals.printerPrintTotal + totals.printerCutoutTotal,
        net_profit: (customerInstallationCost + totals.customerPrintTotal + totals.customerCutoutTotal) - (companyInstallationCost + totals.printerPrintTotal + totals.printerCutoutTotal),
        profit_percentage: (customerInstallationCost + totals.customerPrintTotal + totals.customerCutoutTotal) > 0 
          ? (((customerInstallationCost + totals.customerPrintTotal + totals.customerCutoutTotal) - (companyInstallationCost + totals.printerPrintTotal + totals.printerCutoutTotal)) / (customerInstallationCost + totals.customerPrintTotal + totals.customerCutoutTotal)) * 100 
          : 0,
        status: 'pending',
        notes: `مهمة ${isReinstallation ? 'إعادة تركيب' : 'تركيب جديد'} - طباعة: ${totals.customerPrintTotal} د.ل${cutoutGroups.length > 0 ? ` - قص: ${totals.customerCutoutTotal} د.ل` : ''}`
      };

      if (existingComposite) {
        await supabase
          .from('composite_tasks')
          .update(compositeData)
          .eq('id', existingComposite.id);

        // إذا كانت هناك فاتورة موحدة منشأة بالفعل للمهمة المجمعة، يجب تحديثها وتنظيف الفواتير الفردية الجديدة
        if (existingComposite.combined_invoice_id) {
          // حذف الفاتورة الفردية التي أنشئت للتو لأن الفاتورة الموحدة موجودة بالفعل وتغني عنها
          await supabase.from('printed_invoices').delete().eq('id', printInvoice.id);
          await supabase.from('print_tasks').update({ invoice_id: null }).eq('id', printTask.id);
          
          if (cutoutTaskId && cutoutInvoiceId) {
            await supabase.from('printed_invoices').delete().eq('id', cutoutInvoiceId);
            await supabase.from('cutout_tasks').update({ invoice_id: null }).eq('id', cutoutTaskId);
          }

          // تحديث الفاتورة الموحدة بالتكاليف الجديدة
          const discountAmount = existingComposite.discount_amount || 0;
          const newCustomerTotal = customerInstallationCost + totals.customerPrintTotal + totals.customerCutoutTotal - discountAmount;
          const newCompanyPrint = totals.printerPrintTotal;
          const newCompanyCutout = totals.printerCutoutTotal;
          
          await supabase.from('printed_invoices').update({
            print_cost: newCompanyPrint + newCompanyCutout,
            total_amount: newCustomerTotal,
            notes: `فاتورة موحدة للمهمة المجمعة (معاد حسابها بعد تحديث مهام الطباعة/القص)\n` +
                   `تركيب: ${customerInstallationCost.toLocaleString()} د.ل\n` +
                   (totals.customerPrintTotal > 0 ? `طباعة: ${totals.customerPrintTotal.toLocaleString()} د.ل\n` : '') +
                   (totals.customerCutoutTotal > 0 ? `قص: ${totals.customerCutoutTotal.toLocaleString()} د.ل\n` : '') +
                   (discountAmount > 0 ? `خصم: ${discountAmount.toLocaleString()} د.ل\n` : ''),
            updated_at: new Date().toISOString()
          } as any).eq('id', existingComposite.combined_invoice_id);

          // تحديث سجل الدين في حساب الزبون المرتبط بالفاتورة الموحدة
          await supabase.from('customer_payments')
            .update({
              amount: -newCustomerTotal,
              notes: `مهمة مجمعة - عقد #${installationTask.contract_id} (معاد حسابها بعد تحديث مهام الطباعة/القص)`
            })
            .eq('printed_invoice_id', existingComposite.combined_invoice_id)
            .eq('entry_type', 'invoice');
        }
      } else {
        await supabase
          .from('composite_tasks')
          .insert([compositeData]);
      }

      const successMessage = cutoutGroups.length > 0 
        ? `تم إنشاء مهمة الطباعة والقص والمهمة المجمعة بنجاح - الربح الإجمالي: ${totals.totalProfit.toFixed(2)} د.ل`
        : `تم إنشاء مهمة الطباعة والمهمة المجمعة بنجاح - الربح: ${totals.printProfit.toFixed(2)} د.ل`;

      toast.success(successMessage);
      queryClient.invalidateQueries({ queryKey: ['print-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['cutout-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['installation-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['composite-tasks'] });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'فشل في إنشاء المهام');
    } finally {
      setLoading(false);
    }
  };

  const totals = calculateTotals();

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl max-h-[92vh] flex flex-col p-0 overflow-hidden border border-border/40 shadow-2xl rounded-2xl bg-card">
        {/* Header with Title and Wizard Steps */}
        <DialogHeader className="px-6 py-5 border-b border-border/40 bg-muted/10 shrink-0">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 text-right" dir="rtl">
            <div>
              <DialogTitle className="text-xl font-black text-foreground flex items-center gap-2">
                <Printer className="h-5.5 w-5.5 text-primary animate-pulse" />
                <span>إنشاء مهمة طباعة وقص</span>
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-1">قم بإعداد وتوزيع تكاليف فواتير الطباعة والقص لمهام التركيب</p>
            </div>

            {/* Step indicators */}
            <div className="flex items-center gap-1.5 self-center">
              {[
                { number: 1, label: 'اللوحات والمطابع' },
                { number: 2, label: 'الأسعار والتوزيع' },
                { number: 3, label: 'المعاينة والإنشاء' }
              ].map((step, idx) => {
                const isActive = activeStep === step.number;
                const isCompleted = activeStep > step.number;
                return (
                  <React.Fragment key={step.number}>
                    {idx > 0 && <div className={cn("h-0.5 w-8 rounded-full", isCompleted ? "bg-primary" : "bg-border/60")} />}
                    <button
                      onClick={() => {
                        // Allow going back to previous steps, but only go forward if validated
                        if (step.number < activeStep) {
                          setActiveStep(step.number as any);
                        } else if (step.number === 2 && activeStep === 1) {
                          if (printerId && selectedBillboardIds.length > 0) setActiveStep(2);
                        } else if (step.number === 3 && activeStep === 2) {
                          if (printerId && selectedBillboardIds.length > 0) setActiveStep(3);
                        }
                      }}
                      disabled={step.number > activeStep && (!printerId || selectedBillboardIds.length === 0)}
                      className={cn(
                        "flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all cursor-pointer",
                        isActive
                          ? "border-primary bg-primary/10 text-primary shadow-sm"
                          : isCompleted
                            ? "border-primary/30 bg-primary/5 text-primary/80"
                            : "border-border/60 bg-background text-muted-foreground hover:bg-muted/50"
                      )}
                    >
                      <span className={cn(
                        "h-5 w-5 rounded-full flex items-center justify-center text-[10px] font-black border",
                        isActive ? "border-primary bg-primary text-primary-foreground" : "border-border"
                      )}>
                        {step.number}
                      </span>
                      <span>{step.label}</span>
                    </button>
                  </React.Fragment>
                );
              })}
            </div>
          </div>
        </DialogHeader>

        {/* Scrollable Content Step Panel */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6 space-y-6" dir="rtl">
          
          {/* STEP 1: BILLBOARDS & PRINTERS */}
          {activeStep === 1 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* اختيار المطابع */}
              <Card className="border-border/40 shadow-sm bg-gradient-to-br from-card to-muted/20">
                <CardContent className="pt-6 space-y-4">
                  <h3 className="font-extrabold text-sm text-foreground flex items-center gap-2 mb-2 pb-2 border-b border-border/25">
                    <Printer className="h-4.5 w-4.5 text-primary" />
                    تحديد الجهات المسؤولة عن الطباعة والقص
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs font-bold text-muted-foreground flex items-center gap-2">
                        <span>مطبعة الطباعة *</span>
                      </Label>
                      <Select value={printerId} onValueChange={setPrinterId}>
                        <SelectTrigger className="h-11 bg-background border-border/60 focus:border-primary focus:ring-1 focus:ring-primary/20 rounded-xl">
                          <SelectValue placeholder="اختر مطبعة الطباعة" />
                        </SelectTrigger>
                        <SelectContent className="rounded-xl">
                          {printers.map(p => (
                            <SelectItem key={p.id} value={p.id} className="cursor-pointer">{p.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {cutoutGroups.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs font-bold text-muted-foreground flex items-center gap-2">
                          <Scissors className="h-3.5 w-3.5 text-destructive" />
                          <span>مصنع قص المجسمات *</span>
                        </Label>
                        <Select value={cutoutPrinterId} onValueChange={setCutoutPrinterId}>
                          <SelectTrigger className="h-11 bg-background border-destructive/30 focus:border-destructive focus:ring-1 focus:ring-destructive/20 rounded-xl">
                            <SelectValue placeholder="اختر مصنع القص" />
                          </SelectTrigger>
                          <SelectContent className="rounded-xl">
                            {printers.map(p => (
                              <SelectItem key={p.id} value={p.id} className="cursor-pointer">{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* اختيار اللوحات */}
              <Card className="border-border/40 shadow-sm bg-gradient-to-br from-card to-muted/20">
                <CardContent className="pt-6 space-y-4">
                  <div className="flex items-center gap-2 mb-2 pb-2 border-b border-border/25">
                    <Printer className="h-4.5 w-4.5 text-primary" />
                    <h3 className="font-extrabold text-sm text-foreground">تحديد اللوحات المطلوب طباعتها</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    يرجى تحديد اللوحات التي ترغب في طباعتها فعلياً ضمن هذه المهمة المجمعة. سيتم استبعاد اللوحات غير المحددة من مهمة الطباعة وفاتورة الطباعة لتجنب أي فروقات مالية.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 pt-2">
                    {enrichedTaskItems.map((item) => {
                      const billboard = billboardsMap[item.billboard_id];
                      if (!billboard) return null;

                      const hasDesign = !!item.design_face_a || !!item.design_face_b;
                      const isSelected = selectedBillboardIds.includes(item.billboard_id);

                      return (
                        <div 
                          key={item.billboard_id} 
                          onClick={() => {
                            if (!hasDesign) return;
                            if (isSelected) {
                              setSelectedBillboardIds(prev => prev.filter(id => id !== item.billboard_id));
                            } else {
                              setSelectedBillboardIds(prev => [...prev, item.billboard_id]);
                            }
                          }}
                          className={cn(
                            "flex items-center justify-between p-4 rounded-xl border transition-all duration-200 cursor-pointer shadow-sm",
                            !hasDesign 
                              ? 'bg-muted/30 border-border/30 text-muted-foreground/50 cursor-not-allowed opacity-60' 
                              : isSelected
                                ? 'bg-primary/[0.04] border-primary text-primary font-medium'
                                : 'bg-background border-border/70 hover:border-primary/30 hover:bg-muted/10'
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <Checkbox 
                              id={`print-bb-${item.billboard_id}`}
                              disabled={!hasDesign}
                              checked={isSelected}
                              onCheckedChange={(checked) => {
                                if (checked === true) {
                                  setSelectedBillboardIds(prev => [...prev, item.billboard_id]);
                                } else {
                                  setSelectedBillboardIds(prev => prev.filter(id => id !== item.billboard_id));
                                }
                              }}
                              className="h-4.5 w-4.5 text-primary border-border rounded focus:ring-primary cursor-pointer disabled:cursor-not-allowed"
                            />
                            <label 
                              htmlFor={`print-bb-${item.billboard_id}`}
                              className="flex flex-col text-xs font-bold cursor-pointer"
                              onClick={e => e.stopPropagation()}
                            >
                              <span>لوحة رقم #{item.billboard_id} ({billboard.Size})</span>
                              <span className="text-[10px] text-muted-foreground font-normal mt-0.5">
                                {!hasDesign 
                                  ? 'بدون تصميم (لا يمكن طباعتها)' 
                                  : `${item.design_face_a ? 'وجه أمامي' : ''}${item.design_face_a && item.design_face_b ? ' + ' : ''}${item.design_face_b ? 'وجه خلفي' : ''}`
                                }
                              </span>
                            </label>
                          </div>
                          {hasDesign && (
                            <Badge variant={isSelected ? "default" : "outline"} className="text-[9px] font-bold shrink-0">
                              {isSelected ? 'مشمولة' : 'مستثناة'}
                            </Badge>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* STEP 2: PRICING & SMART DISTRIBUTION */}
          {activeStep === 2 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              
              {/* تعديل الأسعار الجماعية للطباعة */}
              {printGroups.length > 0 && (
                <Card className="border-border/40 shadow-sm bg-gradient-to-br from-card to-muted/20">
                  <CardContent className="pt-6 space-y-4">
                    <h3 className="font-extrabold text-sm text-foreground flex items-center gap-2 pb-2 border-b border-border/25">
                      <Coins className="h-4.5 w-4.5 text-primary" />
                      تعديل الأسعار الجماعية لجميع اللوحات
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-orange-500 font-bold text-xs">سعر المتر للمطبعة (د.ل)</Label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            value={bulkPrinterCostPerMeter}
                            onChange={(e) => setBulkPrinterCostPerMeter(parseFloat(e.target.value) || 0)}
                            step="0.1"
                            min="0"
                            className="text-sm font-semibold h-10 border-border/60 rounded-xl"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => applyBulkPrices(true, false)}
                            className="h-10 rounded-xl border-orange-500/30 text-orange-600 hover:bg-orange-50/50"
                          >
                            تطبيق
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-2">
                        <Label className="text-primary font-bold text-xs">سعر المتر للزبون (د.ل)</Label>
                        <div className="flex gap-2">
                          <Input
                            type="number"
                            value={bulkCustomerCostPerMeter}
                            onChange={(e) => setBulkCustomerCostPerMeter(parseFloat(e.target.value) || 0)}
                            step="0.1"
                            min="0"
                            className="text-sm font-semibold h-10 border-border/60 rounded-xl"
                          />
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => applyBulkPrices(false, true)}
                            className="h-10 rounded-xl border-primary/30 text-primary hover:bg-primary/5"
                          >
                            تطبيق
                          </Button>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-2">
                      <span className="text-[11px] text-muted-foreground">يمكنك تطبيق التعديلات الجماعية أو ضبط الأسعار الفردية بالأسفل استثنائياً</span>
                      <Button
                        onClick={() => applyBulkPrices(true, true)}
                        size="sm"
                        className="bg-primary hover:bg-primary/95 text-xs font-bold rounded-xl"
                      >
                        تطبيق الأسعار الجماعية معاً
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* نظام التوزيع الذكي للمجسمات */}
              {cutoutGroups.length > 0 && (
                <Card className="border-border/40 shadow-sm bg-gradient-to-br from-card to-amber-500/[0.02]">
                  <CardContent className="pt-6 space-y-4">
                    <div className="flex items-center justify-between pb-2 border-b border-border/25 gap-4">
                      <div className="flex items-center gap-2">
                        <Scissors className="h-4.5 w-4.5 text-amber-500" />
                        <h3 className="font-extrabold text-sm text-foreground">نظام التوزيع الذكي للمجسمات</h3>
                      </div>
                      <Button
                        variant={useDistribution ? "default" : "outline"}
                        size="xs"
                        onClick={() => setUseDistribution(!useDistribution)}
                        className="h-8 rounded-lg text-xs"
                      >
 {useDistribution ? ' مُفعّل' : 'تفعيل التوزيع'}
                      </Button>
                    </div>

                    {useDistribution ? (
                      <div className="space-y-4 animate-in fade-in duration-200">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <Label className="text-orange-500 font-bold text-xs">إجمالي تكلفة القص من الشركة (د.ل)</Label>
                            <Input
                              type="number"
                              value={totalCutoutPrinterCost}
                              onChange={(e) => setTotalCutoutPrinterCost(parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              step="0.01"
                              min="0"
                              className="text-sm font-semibold h-10 border-border/60 rounded-xl"
                            />
                          </div>

                          <div className="space-y-2">
                            <Label className="text-primary font-bold text-xs">إجمالي سعر المجسمات للزبون (د.ل)</Label>
                            <Input
                              type="number"
                              value={totalCutoutCustomerCost}
                              onChange={(e) => setTotalCutoutCustomerCost(parseFloat(e.target.value) || 0)}
                              placeholder="0.00"
                              step="0.01"
                              min="0"
                              className="text-sm font-semibold h-10 border-border/60 rounded-xl"
                            />
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-muted/30 border border-border/25 flex flex-col md:flex-row md:items-center justify-between gap-4">
                          <div className="flex gap-6 text-xs font-semibold">
                            <div>
                              <span className="text-muted-foreground">الكمية الكلية:</span>
                              <p className="font-bold text-sm text-foreground mt-0.5">{cutoutGroups.reduce((sum, g) => sum + (g.cutoutCount || 0), 0)} مجسم</p>
                            </div>
                            <div>
                              <span className="text-orange-500">تكلفة الوحدة المحسوبة:</span>
                              <p className="font-bold text-sm text-orange-600 mt-0.5">
                                {(totalCutoutPrinterCost / cutoutGroups.reduce((sum, g) => sum + (g.cutoutCount || 0), 0) || 0).toFixed(2)} د.ل
                              </p>
                            </div>
                            <div>
                              <span className="text-primary">سعر الوحدة المحسوب:</span>
                              <p className="font-bold text-sm text-primary mt-0.5">
                                {(totalCutoutCustomerCost / cutoutGroups.reduce((sum, g) => sum + (g.cutoutCount || 0), 0) || 0).toFixed(2)} د.ل
                              </p>
                            </div>
                          </div>

                          <Button
                            onClick={distributeCutoutCosts}
                            disabled={totalCutoutPrinterCost === 0 || totalCutoutCustomerCost === 0}
                            className="bg-gradient-to-r from-amber-600 to-primary hover:from-amber-700 hover:to-primary/95 text-xs font-bold rounded-xl h-10 px-4"
                          >
                            توزيع التكاليف
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        نظام التوزيع الذكي يسمح لك بإدخال القيمة الإجمالية لفاتورة القص وتوزيعها بالتساوي على جميع اللوحات المحددة.
                      </p>
                    )}
                  </CardContent>
                </Card>
              )}

              {/* تفاصيل التسعير لكل تصميم */}
              <div className="space-y-3">
                <h3 className="font-extrabold text-sm text-foreground flex items-center gap-2">
                  <LayoutGrid className="h-4.5 w-4.5 text-primary" />
                  <span>تفاصيل التسعير الفردية للمجموعات ({printGroups.length})</span>
                </h3>
                
                <div className="space-y-4">
                  {printGroups.map((group, idx) => (
                    <div key={idx} className="border border-border/80 rounded-2xl overflow-hidden bg-gradient-to-br from-card to-muted/10 p-5 space-y-4 shadow-sm">
                      {/* عرض التصميم */}
                      <DesignDisplayCard group={group} index={idx} />
                      
                      {/* حقول التسعير */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-3 border-t border-border/40">
                        {/* تكاليف المطبعة */}
                        <div className="space-y-3 bg-muted/20 p-4 rounded-xl border border-border/30">
                          <h5 className="font-bold text-xs text-orange-600 flex items-center gap-1.5">
                            <Coins className="h-4 w-4" />
                            <span>تكاليف المطبعة</span>
                          </h5>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-muted-foreground">سعر المتر للمطبعة (د.ل)</Label>
                            <Input
                              type="number"
                              value={designGroups[idx]?.printerCostPerMeter || 0}
                              onChange={(e) => updateGroupPrice(idx, 'printerCostPerMeter', parseFloat(e.target.value) || 0)}
                              step="0.1"
                              min="0"
                              className="h-9 text-xs font-semibold"
                            />
                            <div className="text-[10px] text-muted-foreground flex justify-between font-mono">
                              <span>المساحة: {(group.area * group.quantity).toFixed(2)} م²</span>
                              <span>الإجمالي: {((designGroups[idx]?.printerCostPerMeter || 0) * group.area * group.quantity).toFixed(2)} د.ل</span>
                            </div>
                          </div>
                        </div>

                        {/* أسعار الزبون */}
                        <div className="space-y-3 bg-primary/[0.02] p-4 rounded-xl border border-primary/10">
                          <h5 className="font-bold text-xs text-primary flex items-center gap-1.5">
                            <Coins className="h-4 w-4" />
                            <span>أسعار الزبون</span>
                          </h5>
                          <div className="space-y-2">
                            <Label className="text-[10px] font-bold text-muted-foreground">سعر المتر للزبون (د.ل)</Label>
                            <Input
                              type="number"
                              value={designGroups[idx]?.customerCostPerMeter || 0}
                              onChange={(e) => updateGroupPrice(idx, 'customerCostPerMeter', parseFloat(e.target.value) || 0)}
                              step="0.1"
                              min="0"
                              className="h-9 text-xs font-semibold"
                            />
                            <div className="text-[10px] text-muted-foreground flex justify-between font-mono">
                              <span>المساحة: {(group.area * group.quantity).toFixed(2)} م²</span>
                              <span>الإجمالي: {((designGroups[idx]?.customerCostPerMeter || 0) * group.area * group.quantity).toFixed(2)} د.ل</span>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* حقول المجسمات الخاصة بالمجموعة */}
                      {group.hasCutout && group.cutoutCount && group.cutoutCount > 0 && (
                        <div className="bg-destructive/[0.02] p-4 rounded-xl border border-destructive/20 space-y-4">
                          <div className="flex items-center gap-2 text-destructive font-bold text-xs pb-1 border-b border-destructive/10">
                            <Scissors className="h-4 w-4" />
                            <span>تسعير قص المجسمات لهذه المجموعة (العدد: {group.cutoutCount})</span>
                          </div>

                          {!useDistribution ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold text-muted-foreground">سعر قص الوحدة للمصنع (د.ل)</Label>
                                <Input
                                  type="number"
                                  value={designGroups[idx]?.printerCutoutCostPerUnit || 0}
                                  onChange={(e) => updateGroupPrice(idx, 'printerCutoutCostPerUnit', parseFloat(e.target.value) || 0)}
                                  step="0.1"
                                  min="0"
                                  className="h-9 text-xs"
                                />
                                <span className="text-[10px] text-muted-foreground font-mono">الإجمالي: {((designGroups[idx]?.printerCutoutCostPerUnit || 0) * group.cutoutCount).toFixed(2)} د.ل</span>
                              </div>

                              <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold text-muted-foreground">سعر قص الوحدة للزبون (د.ل)</Label>
                                <Input
                                  type="number"
                                  value={designGroups[idx]?.customerCutoutCostPerUnit || 0}
                                  onChange={(e) => updateGroupPrice(idx, 'customerCutoutCostPerUnit', parseFloat(e.target.value) || 0)}
                                  step="0.1"
                                  min="0"
                                  className="h-9 text-xs"
                                />
                                <span className="text-[10px] text-muted-foreground font-mono">الإجمالي: {((designGroups[idx]?.customerCutoutCostPerUnit || 0) * group.cutoutCount).toFixed(2)} د.ل</span>
                              </div>
                            </div>
                          ) : (
                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-xs font-semibold text-muted-foreground font-mono">
                              <div>شركة القص: {((designGroups[idx]?.printerCutoutCostPerUnit || 0) * group.cutoutCount).toFixed(2)} د.ل</div>
                              <div>الزبون: {((designGroups[idx]?.customerCutoutCostPerUnit || 0) * group.cutoutCount).toFixed(2)} د.ل</div>
                              <div className="text-primary font-bold">الربح: {(((designGroups[idx]?.customerCutoutCostPerUnit || 0) - (designGroups[idx]?.printerCutoutCostPerUnit || 0)) * group.cutoutCount).toFixed(2)} د.ل</div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: FINAL REVIEW & PREVIEW */}
          {activeStep === 3 && (
            <div className="space-y-6 animate-in fade-in duration-200">
              {/* ملخص الأرقام المالية */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-border/40 shadow-sm text-center p-5 bg-gradient-to-br from-card to-muted/20">
                  <div className="text-3xl font-black text-foreground font-mono">
                    {totals.printerTotal.toLocaleString('ar-LY')}
                  </div>
                  <div className="text-xs font-bold text-muted-foreground mt-1">إجمالي تكلفة الموردين (المطبعة + القص)</div>
                </Card>

                <Card className="border-primary/20 shadow-sm text-center p-5 bg-gradient-to-br from-card to-primary/[0.03]">
                  <div className="text-3xl font-black text-primary font-mono">
                    {totals.customerTotal.toLocaleString('ar-LY')}
                  </div>
                  <div className="text-xs font-bold text-primary/80 mt-1">إجمالي الإيرادات من الزبون</div>
                </Card>

                <Card className={cn(
                  "shadow-sm text-center p-5 border",
                  totals.totalProfit >= 0 ? "bg-emerald-500/5 border-emerald-500/20 text-emerald-600" : "bg-destructive/5 border-destructive/20 text-destructive"
                )}>
                  <div className="text-3xl font-black font-mono">
                    {totals.totalProfit >= 0 ? '+' : ''}
                    {totals.totalProfit.toLocaleString('ar-LY')}
                  </div>
                  <div className="text-xs font-bold text-muted-foreground mt-1">صافي الأرباح المتوقعة</div>
                </Card>
              </div>

              {/* تفاصيل الطباعة والقص بشكل منفصل */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card className="border-border/40 shadow-sm bg-card p-5 space-y-3">
                  <h4 className="font-extrabold text-sm text-foreground flex items-center gap-1.5 border-b border-border/25 pb-2">
                    <Printer className="h-4.5 w-4.5 text-primary" />
                    تفصيل الطباعة
                  </h4>
                  <div className="space-y-2 text-xs font-semibold font-mono">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">تكلفة المطبعة:</span>
                      <span className="text-foreground">{totals.printerPrintTotal.toLocaleString('ar-LY')} د.ل</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">سعر الزبون:</span>
                      <span className="text-primary">{totals.customerPrintTotal.toLocaleString('ar-LY')} د.ل</span>
                    </div>
                    <div className="flex justify-between pt-1 border-t border-border/30 text-emerald-600 font-bold">
                      <span>ربح الطباعة:</span>
                      <span>{(totals.customerPrintTotal - totals.printerPrintTotal).toLocaleString('ar-LY')} د.ل</span>
                    </div>
                  </div>
                </Card>

                {cutoutGroups.length > 0 && (
                  <Card className="border-border/40 shadow-sm bg-card p-5 space-y-3">
                    <h4 className="font-extrabold text-sm text-foreground flex items-center gap-1.5 border-b border-border/25 pb-2">
                      <Scissors className="h-4.5 w-4.5 text-amber-500" />
                      تفصيل القص
                    </h4>
                    <div className="space-y-2 text-xs font-semibold font-mono">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">تكلفة القص:</span>
                        <span className="text-foreground">{totals.printerCutoutTotal.toLocaleString('ar-LY')} د.ل</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">سعر الزبون:</span>
                        <span className="text-primary">{totals.customerCutoutTotal.toLocaleString('ar-LY')} د.ل</span>
                      </div>
                      <div className="flex justify-between pt-1 border-t border-border/30 text-emerald-600 font-bold">
                        <span>ربح القص:</span>
                        <span>{(totals.customerCutoutTotal - totals.printerCutoutTotal).toLocaleString('ar-LY')} د.ل</span>
                      </div>
                    </div>
                  </Card>
                )}
              </div>

              {/* أزرار معاينة الفواتير */}
              {printGroups.length > 0 && (
                <Card className="border-border/40 shadow-sm bg-muted/10 p-4">
                  <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                    <div>
                      <h4 className="font-extrabold text-sm text-foreground flex items-center gap-2">
                        <FileText className="h-4.5 w-4.5 text-primary" />
                        معاينة الفواتير ومراجعة المطبوعات قبل الإنشاء
                      </h4>
                      <p className="text-[10px] text-muted-foreground mt-0.5">اضغط لمعاينة شكل وتفاصيل الفواتير المالية الصادرة للموردين</p>
                    </div>
                    <div className="flex gap-2 shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setShowPrintInvoice(!showPrintInvoice)}
                        className="gap-1.5 text-xs rounded-xl"
                        disabled={!printerId}
                      >
                        <Printer className="h-3.5 w-3.5" />
                        {showPrintInvoice ? 'إخفاء' : 'عرض'} فاتورة الطباعة
                      </Button>
                      {cutoutGroups.length > 0 && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setShowCutoutInvoice(!showCutoutInvoice)}
                          className="gap-1.5 text-xs border-destructive/30 text-destructive hover:bg-destructive/10 rounded-xl"
                          disabled={!cutoutPrinterId && !printerId}
                        >
                          <Scissors className="h-3.5 w-3.5" />
                          {showCutoutInvoice ? 'إخفاء' : 'عرض'} فاتورة القص
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              )}

              {/* معاينة فاتورة الطباعة */}
              {showPrintInvoice && printGroups.length > 0 && (
                <div className="border border-border/50 rounded-2xl overflow-hidden shadow-sm animate-in fade-in duration-200">
                  <PrintTaskInvoice
                    designGroups={printGroups}
                    pricePerMeter={printGroups[0]?.printerCostPerMeter || 0}
                    cutoutPricePerUnit={0}
                    printerName={printers.find(p => p.id === printerId)?.name}
                    totalArea={totals.printerPrintTotal / (printGroups[0]?.printerCostPerMeter || 1)}
                    totalCutouts={0}
                    showPrices={true}
                  />
                </div>
              )}

              {/* معاينة فاتورة القص */}
              {showCutoutInvoice && cutoutGroups.length > 0 && (
                <div className="border border-border/50 rounded-2xl overflow-hidden shadow-sm animate-in fade-in duration-200">
                  <CutoutTaskInvoice
                    designGroups={cutoutGroups}
                    cutoutPricePerUnit={cutoutGroups[0]?.printerCutoutCostPerUnit || 0}
                    cutoutPrinterName={printers.find(p => p.id === (cutoutPrinterId || printerId))?.name}
                    totalCutouts={cutoutGroups.reduce((sum, g) => sum + (g.cutoutCount || 0), 0)}
                    showPrices={true}
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions Panel */}
        <div className="px-6 py-4 border-t border-border/40 bg-muted/15 flex justify-between items-center shrink-0" dir="rtl">
          <div>
            {activeStep === 1 ? (
              <span className="text-xs text-muted-foreground">الخطوة 1 من 3: يرجى تحديد اللوحات والمطابع للمتابعة</span>
            ) : activeStep === 2 ? (
              <span className="text-xs text-muted-foreground">الخطوة 2 من 3: ضبط الأسعار ونسبة التكاليف للوحات والمجسمات</span>
            ) : (
              <span className="text-xs text-muted-foreground">الخطوة 3 من 3: قم بمراجعة الأرقام النهائية واضغط لإنشاء الفواتير</span>
            )}
          </div>
          
          <div className="flex gap-2">
            <Button 
              variant="outline" 
              onClick={() => onOpenChange(false)} 
              disabled={loading}
              className="rounded-xl h-10 px-4 text-xs font-semibold border-border/80"
            >
              إلغاء
            </Button>
            
            {activeStep > 1 && (
              <Button
                variant="outline"
                onClick={() => setActiveStep((activeStep - 1) as any)}
                disabled={loading}
                className="rounded-xl h-10 px-4 text-xs font-semibold border-border/80"
              >
                السابق
              </Button>
            )}

            {activeStep < 3 ? (
              <Button
                onClick={handleNextStep}
                disabled={loading || !printerId || selectedBillboardIds.length === 0}
                className="rounded-xl h-10 px-5 text-xs font-bold bg-primary hover:bg-primary/95"
              >
                التالي
              </Button>
            ) : (
              <Button 
                onClick={handleCreatePrintTask} 
                disabled={loading || !printerId || (cutoutGroups.length > 0 && !cutoutPrinterId && !printerId)}
                className="rounded-xl h-10 px-5 text-xs font-bold bg-primary hover:bg-primary/95 gap-2"
              >
                {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                <span>{loading ? 'جاري الإنشاء...' : 'إنشاء مهام الطباعة'}</span>
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}