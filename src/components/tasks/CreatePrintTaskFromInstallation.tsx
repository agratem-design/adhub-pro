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
import {
  resolveItemDesign,
  resolveAndValidatePrintItems,
  calculatePrintTaskTotals,
  BillboardLookup,
  TaskDesignLookup,
  ContractDesignItem,
  ContractLookup
} from '@/services/printTaskResolutionService';
import { executeCreatePrintTask } from '@/services/printTaskCreationService';

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
  const isSubmittingRef = useRef(false);
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
      isSubmittingRef.current = false;
      setSelectedBillboardIds([]);
      setActiveStep(1);
    }
  }, [open, installationTaskId]);

  useEffect(() => {
    const fetchData = async () => {
      console.log('Fetching data for print task with exact design mapping...');
      
      const billboardIds = taskItems.map(item => item.billboard_id);
      const designIds = taskItems
        .map(item => item.selected_design_id)
        .filter((id): id is string => Boolean(id));

      const [pricingResult, billboardsResult, designsResult, printersResult, sizesResult, facesResult, installTaskResult] = await Promise.all([
        supabase.from('installation_print_pricing').select('print_price').limit(1).single(),
        billboardIds.length > 0 ? supabase.from('billboards').select('ID, Size, has_cutout, Faces_Count, Contract_Number, design_face_a, design_face_b, Image_URL').in('ID', billboardIds) : null,
        designIds.length > 0 ? supabase.from('task_designs').select('id, design_face_a_url, design_face_b_url, cutout_image_url').in('id', designIds) : null,
        supabase.from('printers').select('id, name').eq('is_active', true),
        supabase.from('sizes').select('id, name, width, height'),
        billboardIds.length > 0 ? supabase.from('installation_task_items').select('billboard_id, faces_to_install').eq('task_id', installationTaskId) : null,
        supabase.from('installation_tasks').select('contract_id, contract_ids').eq('id', installationTaskId).maybeSingle()
      ]);

      // تخزين بيانات الأحجام
      const parsedSizesMap: Record<string, { width: number; height: number }> = {};
      if (sizesResult.data && !sizesResult.error) {
        sizesResult.data.forEach((s: any) => {
          if (s.width && s.height) {
            parsedSizesMap[s.name] = { width: s.width, height: s.height };
            parsedSizesMap[s.name.toLowerCase()] = { width: s.width, height: s.height };
          }
        });
        setSizesMap(parsedSizesMap);
      }

      // خريطة faces_to_install من بنود التركيب
      const facesToInstallMap: Record<number, number> = {};
      if (facesResult && !facesResult.error && facesResult.data) {
        facesResult.data.forEach((item: any) => {
          facesToInstallMap[item.billboard_id] = item.faces_to_install || 1;
        });
      }

      // خريطة اللوحات
      const bMap: Record<number, BillboardInfo> = {};
      const billboardsLookupMap: Record<number, BillboardLookup> = {};
      const contractIdsSet = new Set<number>();

      if (installTaskResult.data?.contract_id) {
        const c = Number(installTaskResult.data.contract_id);
        if (Number.isFinite(c) && c > 0) contractIdsSet.add(c);
      }
      if (Array.isArray(installTaskResult.data?.contract_ids)) {
        installTaskResult.data.contract_ids.forEach((c: any) => {
          const n = Number(c);
          if (Number.isFinite(n) && n > 0) contractIdsSet.add(n);
        });
      }

      if (billboardsResult && !billboardsResult.error && billboardsResult.data) {
        billboardsResult.data.forEach((b: any) => {
          const facesFromItem = facesToInstallMap[b.ID];
          const cNo = b.Contract_Number ? Number(b.Contract_Number) : null;
          if (cNo && Number.isFinite(cNo) && cNo > 0) {
            contractIdsSet.add(cNo);
          }

          bMap[b.ID] = {
            ID: b.ID,
            Size: b.Size || '3x4',
            has_cutout: b.has_cutout || false,
            Faces_Count: facesFromItem || b.Faces_Count || 1
          };

          billboardsLookupMap[b.ID] = {
            id: b.ID,
            size: b.Size || '3x4',
            contractNumber: cNo,
            facesCount: facesFromItem || b.Faces_Count || 1,
            hasCutout: Boolean(b.has_cutout),
            designFaceA: b.design_face_a,
            designFaceB: b.design_face_b,
            imageUrl: b.Image_URL
          };
        });
        setBillboardsMap(bMap);
      }

      // خريطة تصاميم المهام
      const taskDesignsMap: Record<string, TaskDesignLookup> = {};
      if (designsResult && !designsResult.error && designsResult.data) {
        designsResult.data.forEach((d: any) => {
          taskDesignsMap[d.id] = {
            id: d.id,
            designFaceAUrl: d.design_face_a_url,
            designFaceBUrl: d.design_face_b_url,
            cutoutImageUrl: d.cutout_image_url
          };
        });
      }

      // جلب بيانات العقود والتصاميم الدقيقة لكل لوحة من جدول Contract
      const contractDesignDataMap: Record<number, ContractDesignItem[]> = {};
      if (contractIdsSet.size > 0) {
        const { data: contractsData } = await supabase
          .from('Contract')
          .select('Contract_Number, customer_id, "Customer Name", design_data')
          .in('Contract_Number', Array.from(contractIdsSet));

        contractsData?.forEach((c: any) => {
          if (c.design_data) {
            try {
              const parsed = typeof c.design_data === 'string' ? JSON.parse(c.design_data) : c.design_data;
              if (Array.isArray(parsed)) {
                contractDesignDataMap[Number(c.Contract_Number)] = parsed;
              }
            } catch (e) {
              // ignore parse errors
            }
          }
        });
      }

      // تعيين التصاميم الدقيقة لكل بند دون أي Cross-Contamination
      const updatedItems = taskItems.map(item => {
        const billboard = billboardsLookupMap[item.billboard_id];
        const resolved = resolveItemDesign(item, billboard, taskDesignsMap, contractDesignDataMap);

        if (resolved.cutoutImageUrl && item.has_cutout) {
          const key = `${resolved.faceA || resolved.faceB || 'item'}-${item.billboard_id}`;
          setCutoutImageUrls(prev => ({ ...prev, [key]: resolved.cutoutImageUrl || '' }));
        }

        return {
          ...item,
          design_face_a: resolved.faceA,
          design_face_b: resolved.faceB
        };
      });

      setEnrichedTaskItems(updatedItems);
      setSelectedBillboardIds(taskItems.map(item => item.billboard_id));

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

    enrichedTaskItems.forEach(item => {
      if (!selectedBillboardIds.includes(item.billboard_id)) return;
      
      const billboard = billboardsMap[item.billboard_id];
      if (!billboard) return;
      
      const size = billboard.Size || '3x4';
      const hasCutout = item.has_cutout || billboard.has_cutout || false;
      const facesCount = item.faces_to_install || billboard.Faces_Count || 1;
      
      // Face A
      const designA = item.design_face_a || '';
      const key = `${size}_${designA || 'default'}_a`;
      if (!groups[key]) {
        const { width, height } = parseSizeDimensions(size);
        groups[key] = {
          design: designA,
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
      groups[key].quantity += 1;
      groups[key].billboards.push(item.billboard_id);
      if (facesCount > groups[key].facesCount) {
        groups[key].facesCount = facesCount;
      }
      
      if (hasCutout) {
        groups[key].hasCutout = true;
        groups[key].cutoutCount = (groups[key].cutoutCount || 0) + 1;
        groups[key].cutoutBillboards = [...(groups[key].cutoutBillboards || []), item.billboard_id];
        const cutoutKey = `${designA}-${item.billboard_id}`;
        groups[key].cutoutImageUrl = cutoutImageUrls[cutoutKey] || '';
      }

      // Face B إذا كان عدد الأوجه >= 2
      if (facesCount >= 2) {
        const designB = item.design_face_b || designA || '';
        const keyB = `${size}_${designB || 'default'}_b`;
        if (!groups[keyB]) {
          const { width, height } = parseSizeDimensions(size);
          groups[keyB] = {
            design: designB,
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
        groups[keyB].quantity += 1;
        groups[keyB].billboards.push(item.billboard_id);
        if (facesCount > groups[keyB].facesCount) {
          groups[keyB].facesCount = facesCount;
        }
        
        if (hasCutout) {
          groups[keyB].hasCutout = true;
          groups[keyB].cutoutCount = (groups[keyB].cutoutCount || 0) + 1;
          groups[keyB].cutoutBillboards = [...(groups[keyB].cutoutBillboards || []), item.billboard_id];
          const cutoutKey = `${designB}-${item.billboard_id}`;
          groups[keyB].cutoutImageUrl = cutoutImageUrls[cutoutKey] || '';
        }
      }
    });

    setDesignGroups(Object.values(groups));
  }, [enrichedTaskItems, billboardsMap, cutoutImageUrls, sizesMap, selectedBillboardIds]);

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
    if (isSubmittingRef.current) return;

    try {
      isSubmittingRef.current = true;
      setLoading(true);

      if (!printerId) {
        toast.error('يرجى اختيار المطبعة');
        return;
      }

      if (selectedBillboardIds.length === 0) {
        toast.error('يرجى تحديد لوحة واحدة على الأقل');
        return;
      }

      // Fetch Source Installation Task & Composite Task
      const [installTaskRes, compositeTaskRes] = await Promise.all([
        supabase
          .from('installation_tasks')
          .select('id, contract_id, contract_ids, task_type')
          .eq('id', installationTaskId)
          .single(),
        supabase
          .from('composite_tasks')
          .select('id, customer_id, customer_name, combined_invoice_id, discount_amount')
          .eq('installation_task_id', installationTaskId)
          .maybeSingle()
      ]);

      if (installTaskRes.error) throw installTaskRes.error;
      const installationTask = installTaskRes.data;
      const existingComposite = compositeTaskRes.data;
      const isReinstallation = installationTask.task_type === 'reinstallation';

      // Batch Fetch Billboard & Contract Data for Resolution
      const billboardIds = taskItems.map(item => item.billboard_id);
      const designIds = taskItems
        .map(item => item.selected_design_id)
        .filter((id): id is string => Boolean(id));

      const [billboardsRes, designsRes, taskItemsRes] = await Promise.all([
        billboardIds.length > 0
          ? supabase.from('billboards').select('ID, Size, has_cutout, Faces_Count, Contract_Number, design_face_a, design_face_b, Image_URL').in('ID', billboardIds)
          : { data: [] },
        designIds.length > 0
          ? supabase.from('task_designs').select('id, design_face_a_url, design_face_b_url, cutout_image_url').in('id', designIds)
          : { data: [] },
        supabase.from('installation_task_items').select('id, billboard_id, faces_to_install, customer_installation_cost').eq('task_id', installationTaskId)
      ]);

      const facesToInstallMap: Record<number, number> = {};
      const itemCostMap: Record<number, number> = {};
      taskItemsRes.data?.forEach((it: any) => {
        facesToInstallMap[it.billboard_id] = it.faces_to_install || 1;
        itemCostMap[it.billboard_id] = it.customer_installation_cost || 0;
      });

      const billboardsLookupMap: Record<number, BillboardLookup> = {};
      const contractIdsSet = new Set<number>();

      if (installationTask.contract_id) {
        const c = Number(installationTask.contract_id);
        if (Number.isFinite(c) && c > 0) contractIdsSet.add(c);
      }
      if (Array.isArray(installationTask.contract_ids)) {
        installationTask.contract_ids.forEach((c: any) => {
          const n = Number(c);
          if (Number.isFinite(n) && n > 0) contractIdsSet.add(n);
        });
      }

      billboardsRes.data?.forEach((b: any) => {
        const cNo = b.Contract_Number ? Number(b.Contract_Number) : null;
        if (cNo && Number.isFinite(cNo) && cNo > 0) contractIdsSet.add(cNo);

        billboardsLookupMap[b.ID] = {
          id: b.ID,
          size: b.Size || '3x4',
          contractNumber: cNo,
          facesCount: facesToInstallMap[b.ID] || b.Faces_Count || 1,
          hasCutout: Boolean(b.has_cutout),
          designFaceA: b.design_face_a,
          designFaceB: b.design_face_b,
          imageUrl: b.Image_URL
        };
      });

      const taskDesignsMap: Record<string, TaskDesignLookup> = {};
      designsRes.data?.forEach((d: any) => {
        taskDesignsMap[d.id] = {
          id: d.id,
          designFaceAUrl: d.design_face_a_url,
          designFaceBUrl: d.design_face_b_url,
          cutoutImageUrl: d.cutout_image_url
        };
      });

      const contractLookupMap: Record<number, ContractLookup> = {};
      const contractDesignDataMap: Record<number, ContractDesignItem[]> = {};

      if (contractIdsSet.size > 0) {
        const { data: contractsData } = await supabase
          .from('Contract')
          .select('Contract_Number, customer_id, "Customer Name", "Ad Type", design_data')
          .in('Contract_Number', Array.from(contractIdsSet));

        contractsData?.forEach((c: any) => {
          const cNum = Number(c.Contract_Number);
          contractLookupMap[cNum] = {
            contractNumber: cNum,
            customerId: c.customer_id,
            customerName: c['Customer Name'],
            adType: c['Ad Type'],
            designData: c.design_data
          };

          if (c.design_data) {
            try {
              const parsed = typeof c.design_data === 'string' ? JSON.parse(c.design_data) : c.design_data;
              if (Array.isArray(parsed)) {
                contractDesignDataMap[cNum] = parsed;
              }
            } catch (e) {
              // ignore
            }
          }
        });
      }

      const primaryGroup = printGroups[0];
      const printerPricePerM = primaryGroup?.printerCostPerMeter ?? 10;
      const customerPricePerM = primaryGroup?.customerCostPerMeter ?? 20;

      // Fetch company installation team accounts cost
      const itemIds = taskItemsRes.data?.map(item => item.id) || [];
      let companyInstallationCost = 0;
      if (itemIds.length > 0) {
        const { data: teamAccountData } = await supabase
          .from('installation_team_accounts')
          .select('amount')
          .in('task_item_id', itemIds);
        companyInstallationCost = teamAccountData?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
      }

      // Execute Creation Orchestration via Production Service
      const result = await executeCreatePrintTask({
        installationTaskId,
        selectedBillboardIds,
        taskItems,
        billboardsMap: billboardsLookupMap,
        taskDesignsMap,
        contractDesignDataMap,
        contractLookupMap,
        defaultContractId: Number(installationTask.contract_id),
        compositeCustomer: existingComposite ? { customerId: existingComposite.customer_id, customerName: existingComposite.customer_name } : undefined,
        sizesMap,
        printerId,
        printerName: printers.find(p => p.id === printerId)?.name || 'غير محدد',
        cutoutPrinterId,
        cutoutPrinterName: printers.find(p => p.id === (cutoutPrinterId || printerId))?.name || 'غير محدد',
        printerPricePerMeter: printerPricePerM,
        customerPricePerMeter: customerPricePerM,
        cutoutGroups,
        isReinstallation,
        itemCostMap,
        companyInstallationCost,
        existingComposite,
        allowDraftWithoutDesign: false
      }, supabase as any);

      if (!result.success) {
        toast.error(result.error || 'فشل في إنشاء مهمة الطباعة');
        return;
      }

      const successMessage = cutoutGroups.length > 0 
        ? `تم إنشاء مهمة الطباعة والقص والمهمة المجمعة بنجاح`
        : `تم إنشاء مهمة الطباعة والمهمة المجمعة بنجاح`;

      toast.success(successMessage);
      queryClient.invalidateQueries({ queryKey: ['print-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['cutout-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['installation-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['composite-tasks'] });
      onOpenChange(false);
      onSuccess?.();
    } catch (error: any) {
      console.error('Error in handleCreatePrintTask:', error);
      toast.error(error.message || 'فشل في إنشاء المهام');
    } finally {
      isSubmittingRef.current = false;
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