import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { 
  DollarSign, Calculator, Ruler, ChevronDown, ChevronUp, 
  Box, Building2, Landmark, LayoutGrid, Check, Pencil, X, Save, Gift, Square, Zap, CheckCircle2, MapPin, Image as ImageIcon
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { Switch } from '@/components/ui/switch';

interface SizeData {
  id: number;
  name: string;
  width: number | null;
  height: number | null;
}

interface TaskItem {
  id: string;
  billboard_id: number;
  customer_installation_cost: number;
  company_installation_cost?: number | null;
  company_additional_cost?: number | null;
  company_additional_cost_notes?: string | null;
  has_cutout?: boolean;
  additional_cost?: number;
  additional_cost_notes?: string | null;
  pricing_type?: 'piece' | 'meter';
  price_per_meter?: number;
  faces_to_install?: number;
  reinstall_count?: number | null;
  customer_original_install_cost?: number | null;
  customer_reinstall_cost?: number | null;
  replacement_status?: string | null;
}

interface Billboard {
  ID: number;
  Size: string;
  Faces_Count?: number;
  Billboard_Name?: string;
  billboard_type?: string;
  Nearest_Landmark?: string;
  Image_URL?: string | null;
}

// ════════════ Reusable Inline Price Input with Controls ════════════
const InlinePriceInput = ({ value, onChange, label, step = 1, showLabel = true, className, disabled }: {
  value: number;
  onChange: (val: number) => void;
  label: string;
  step?: number;
  showLabel?: boolean;
  className?: string;
  disabled?: boolean;
}) => (
  <div dir="rtl" className={cn("flex items-center justify-start gap-3 bg-background border border-border/15 rounded-xl p-1.5 shadow-sm shrink-0 min-w-0 transition-all focus-within:border-primary/30 text-right", disabled && "opacity-60 bg-muted/30 pointer-events-none", className)}>
    {showLabel && <span className="text-sm font-semibold text-muted-foreground/80 px-2 shrink-0 text-right whitespace-nowrap">{label}</span>}
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-9 w-9 hover:bg-muted text-lg font-bold shrink-0 p-0 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
      onClick={() => onChange(value + step)}
      aria-label="زيادة"
      disabled={disabled}
    >
      +
    </Button>
    <div dir="ltr" className="flex-1 flex items-center gap-1.5 bg-muted/30 rounded-lg px-2.5 h-10 min-w-[9.5rem] border border-border/10">
      <Input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={e => onChange(Number(e.target.value) || 0)}
        className="h-9 flex-1 min-w-0 text-center border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 font-bold font-mono text-base text-foreground px-1"
        disabled={disabled}
        readOnly={disabled}
      />
      <span className="text-xs font-semibold text-muted-foreground/70 pointer-events-none shrink-0 px-1 whitespace-nowrap">د.ل</span>
    </div>
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-9 w-9 hover:bg-muted text-lg font-bold shrink-0 p-0 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
      onClick={() => onChange(Math.max(0, value - step))}
      aria-label="نقصان"
      disabled={disabled}
    >
      -
    </Button>
  </div>
);

interface TaskTotalCostSummaryProps {
  taskId: string;
  taskItems: TaskItem[];
  installationPrices: Record<number, number>;
  billboards?: Record<number, Billboard>;
  onRefresh: () => void;
  taskType?: 'installation' | 'reinstallation';
  disabled?: boolean;
}

const BILLBOARD_TYPE_ICONS: Record<string, any> = {
  'تيبول': Landmark,
  'برجية': Building2,
  'عادية': LayoutGrid,
};

function calculateTaskSummaryAreaFromSize(sizeName: string, sizesMap: Record<string, SizeData>): number {
  if (!sizeName) return 0;
  
  const sizeData = sizesMap[sizeName] || sizesMap[sizeName.toLowerCase()];
  if (sizeData && sizeData.width && sizeData.height) {
    return sizeData.width * sizeData.height;
  }
  
  const parts = sizeName.toLowerCase().split(/[x×*]/);
  if (parts.length === 2) {
    const width = parseFloat(parts[0]) || 0;
    const height = parseFloat(parts[1]) || 0;
    return width * height;
  }
  return 0;
}

export function TaskTotalCostSummary({ 
  taskId, 
  taskItems, 
  installationPrices,
  billboards = {},
  onRefresh,
  taskType,
  disabled = false
}: TaskTotalCostSummaryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [sizesMap, setSizesMap] = useState<Record<string, SizeData>>({});
  const [distributing, setDistributing] = useState(false);
  
  // أسعار التسعير السريع - بالقطعة
  const [quickPrices, setQuickPrices] = useState<Record<string, { normal: number; cutout: number }>>({});
  // أسعار التسعير بالمتر - لكل مقاس
  const [meterPrices, setMeterPrices] = useState<Record<string, { normal: number; cutout: number }>>({});
  // أسعار التسعير بالمتر لكل نوع لوحة
  const [typeMeterPrices, setTypeMeterPrices] = useState<Record<string, { normal: number; cutout: number }>>({});
  const [pricingType, setPricingType] = useState<'piece' | 'meter'>('piece');
  const [pricingTypeInitialized, setPricingTypeInitialized] = useState(false);

  // حالة تعديل العناصر الفردية
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    companyCost: number;
    customerCost: number;
    customerOriginalInstallCost: number;
    customerReinstallCost: number;
    additionalCost: number;
    additionalNotes: string;
    companyAdditionalCost: number;
    companyAdditionalNotes: string;
    hasCutout: boolean;
  }>({
    companyCost: 0,
    customerCost: 0,
    customerOriginalInstallCost: 0,
    customerReinstallCost: 0,
    additionalCost: 0,
    additionalNotes: '',
    companyAdditionalCost: 0,
    companyAdditionalNotes: '',
    hasCutout: false
  });
  
  // تخزين تكاليف الشركة المعدلة محلياً
  const [customCompanyCosts, setCustomCompanyCosts] = useState<Record<string, number>>({});

  // حالة طي المقاسات - مطوية دائماً افتراضياً
  const [collapsedSizes, setCollapsedSizes] = useState<Set<string>>(new Set());
  // حالة طي الأنواع
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(new Set());
  // تتبع ما إذا تم تهيئة الحالات
  const [initialized, setInitialized] = useState(false);

  // حالة الطباعة والقص المباشرة
  const [isPrintActive, setIsPrintActive] = useState(false);
  const [printPricePerMeter, setPrintPricePerMeter] = useState<number>(0);
  const [isCutoutActive, setIsCutoutActive] = useState(false);
  const [cutoutCost, setCutoutCost] = useState<number>(0);
  const [savingTaskSettings, setSavingTaskSettings] = useState(false);

  useEffect(() => {
    const fetchTaskSettings = async () => {
      if (!taskId) return;
      const cleanId = taskId.split('-')[0];
      const { data: installTask } = await supabase
        .from('installation_tasks')
        .select('default_price_per_meter, print_task_id, cutout_task_id')
        .eq('id', cleanId)
        .maybeSingle();

      if (installTask?.default_price_per_meter) {
        setPrintPricePerMeter(Number(installTask.default_price_per_meter));
        setIsPrintActive(true);
      }

      const { data: compTask } = await supabase
        .from('composite_tasks')
        .select('customer_print_cost, customer_cutout_cost, print_task_id, cutout_task_id')
        .eq('installation_task_id', cleanId)
        .maybeSingle();

      if (compTask) {
        if (compTask.customer_print_cost && Number(compTask.customer_print_cost) > 0) {
          setIsPrintActive(true);
        }
        if (compTask.customer_cutout_cost && Number(compTask.customer_cutout_cost) > 0) {
          setIsCutoutActive(true);
          setCutoutCost(Number(compTask.customer_cutout_cost));
        }
      }
    };
    fetchTaskSettings();
  }, [taskId]);

  const handleSavePrintAndCutoutSettings = async (newPrintActive: boolean, newPrintPrice: number, newCutoutActive: boolean, newCutoutCost: number) => {
    try {
      setSavingTaskSettings(true);
      const cleanId = taskId.split('-')[0];
      
      await supabase
        .from('installation_tasks')
        .update({
          default_price_per_meter: newPrintActive ? newPrintPrice : 0
        })
        .eq('id', cleanId);

      let totalArea = 0;
      taskItems.forEach(item => {
        const billboard = billboards[item.billboard_id];
        const sizeName = billboard?.Size || '';
        const area = calculateTaskSummaryAreaFromSize(sizeName, sizesMap);
        const faces = item.faces_to_install ?? billboard?.Faces_Count ?? 1;
        totalArea += area * faces;
      });

      const totalCustomerPrint = newPrintActive ? (totalArea * newPrintPrice) : 0;
      const totalCustomerCutout = newCutoutActive ? newCutoutCost : 0;

      const { data: compTask } = await supabase
        .from('composite_tasks')
        .select('id, customer_installation_cost, discount_amount')
        .eq('installation_task_id', cleanId)
        .maybeSingle();

      if (compTask) {
        const newCustomerTotal = (Number(compTask.customer_installation_cost) || 0) + totalCustomerPrint + totalCustomerCutout - (Number(compTask.discount_amount) || 0);
        await supabase
          .from('composite_tasks')
          .update({
            customer_print_cost: totalCustomerPrint,
            customer_cutout_cost: totalCustomerCutout,
            customer_total: newCustomerTotal,
            updated_at: new Date().toISOString()
          })
          .eq('id', compTask.id);
      }

      toast.success('تم تحديث إعدادات الطباعة والقص بنجاح');
      onRefresh();
    } catch (err: any) {
      console.error(err);
      toast.error('حدث خطأ أثناء حفظ الإعدادات');
    } finally {
      setSavingTaskSettings(false);
    }
  };

  useEffect(() => {
    const fetchSizes = async () => {
      const { data, error } = await supabase
        .from('sizes')
        .select('id, name, width, height');
      
      if (data && !error) {
        const map: Record<string, SizeData> = {};
        data.forEach((s: any) => {
          map[s.name] = s;
          map[s.name.toLowerCase()] = s;
        });
        setSizesMap(map);
      }
    };
    fetchSizes();
  }, []);

  // جعل جميع المقاسات مطوية افتراضياً عند تحميل البيانات
  useEffect(() => {
    if (!initialized && Object.keys(billboards).length > 0 && taskItems.length > 0) {
      const allSizeKeys = new Set<string>();
      taskItems.forEach(item => {
        const billboard = billboards[item.billboard_id];
        const billboardType = billboard?.billboard_type || 'عادية';
        const sizeName = billboard?.Size || 'غير محدد';
        allSizeKeys.add(`${billboardType}-${sizeName}`);
      });
      setCollapsedSizes(allSizeKeys);
      setInitialized(true);
    }
  }, [billboards, taskItems, initialized]);

  // تهيئة نوع التسعير من البيانات المحفوظة
  useEffect(() => {
    if (!pricingTypeInitialized && taskItems.length > 0) {
      // إذا كان أي عنصر محفوظ بنوع 'meter'، نستخدم meter
      const hasMeterPricing = taskItems.some(item => item.pricing_type === 'meter');
      if (hasMeterPricing) {
        setPricingType('meter');
      }
      setPricingTypeInitialized(true);
    }
  }, [taskItems, pricingTypeInitialized]);

  // حساب الإجماليات
  const { totals, groupedData } = useMemo(() => {
    let companyCost = 0;
    let customerCost = 0;
    let additionalCost = 0;
    let totalArea = 0;

    const grouped: Record<string, {
      type: string;
      sizes: Record<string, {
        size: string;
        items: Array<TaskItem & { billboard: Billboard; area: number }>;
        normalCount: number;
        cutoutCount: number;
        totalArea: number;
        companyCost: number;
        customerCost: number;
        avgAreaPerItem: number;
      }>;
      totalItems: number;
      totalArea: number;
      companyCost: number;
      customerCost: number;
      cutoutCount: number;
      normalCount: number;
    }> = {};

    taskItems.forEach(item => {
      const billboard = billboards[item.billboard_id];
      const billboardType = billboard?.billboard_type || 'عادية';
      const sizeName = billboard?.Size || 'غير محدد';
      const area = calculateTaskSummaryAreaFromSize(sizeName, sizesMap);
      const totalFaces = billboard?.Faces_Count || 1;
      const facesToInstall = item.faces_to_install ?? totalFaces;
      // المساحة الفعلية = مساحة الوجه الواحد × عدد الأوجه المراد تركيبها
      const singleFaceArea = area; // المساحة لوجه واحد
      const itemArea = singleFaceArea * facesToInstall;
      // تكلفة الشركة: نصف السعر إذا وجه واحد من لوحة بوجهين، أو التكلفة المخصصة إن وجدت
      const hasCompanyCost = item.company_installation_cost !== null && item.company_installation_cost !== undefined;
      const itemCompanyCost = hasCompanyCost
        ? item.company_installation_cost!
        : (() => {
            const fullCompanyCost = installationPrices[item.billboard_id] || 0;
            return (totalFaces > 1 && facesToInstall === 1)
              ? fullCompanyCost / 2
              : fullCompanyCost;
          })();
      const isReinstalled = (item.reinstall_count || 0) > 0;
      const itemCustomerCost = isReinstalled
        ? (item.customer_original_install_cost || 0) + (item.customer_reinstall_cost || item.customer_installation_cost || 0)
        : (item.customer_installation_cost || 0);

      companyCost += itemCompanyCost;
      customerCost += itemCustomerCost;
      additionalCost += item.additional_cost || 0;
      totalArea += itemArea;

      if (!grouped[billboardType]) {
        grouped[billboardType] = {
          type: billboardType,
          sizes: {},
          totalItems: 0,
          totalArea: 0,
          companyCost: 0,
          customerCost: 0,
          cutoutCount: 0,
          normalCount: 0
        };
      }

      if (!grouped[billboardType].sizes[sizeName]) {
        grouped[billboardType].sizes[sizeName] = {
          size: sizeName,
          items: [],
          normalCount: 0,
          cutoutCount: 0,
          totalArea: 0,
          companyCost: 0,
          customerCost: 0,
          avgAreaPerItem: 0
        };
      }

      grouped[billboardType].sizes[sizeName].items.push({
        ...item,
        billboard: billboard || { ID: item.billboard_id, Size: sizeName },
        area: itemArea
      });
      
      grouped[billboardType].sizes[sizeName].totalArea += itemArea;
      grouped[billboardType].sizes[sizeName].companyCost += itemCompanyCost;
      grouped[billboardType].sizes[sizeName].customerCost += itemCustomerCost;
      
      if (item.has_cutout) {
        grouped[billboardType].sizes[sizeName].cutoutCount++;
        grouped[billboardType].cutoutCount++;
      } else {
        grouped[billboardType].sizes[sizeName].normalCount++;
        grouped[billboardType].normalCount++;
      }

      grouped[billboardType].totalItems++;
      grouped[billboardType].totalArea += itemArea;
      grouped[billboardType].companyCost += itemCompanyCost;
      grouped[billboardType].customerCost += itemCustomerCost;
    });

    // حساب متوسط المساحة لكل عنصر
    Object.values(grouped).forEach(typeData => {
      Object.values(typeData.sizes).forEach(sizeData => {
        sizeData.avgAreaPerItem = sizeData.items.length > 0 
          ? sizeData.totalArea / sizeData.items.length 
          : 0;
      });
    });

    return {
      totals: { companyCost, customerCost, additionalCost, totalArea, profit: customerCost - companyCost },
      groupedData: grouped
    };
  }, [taskItems, installationPrices, billboards, sizesMap]);

  // حساب السعر المتوقع بناءً على سعر المتر (للعرض الفوري)
  const calculateExpectedPrice = useCallback((sizeName: string, hasCutout: boolean, pricePerMeter: number) => {
    const area = calculateTaskSummaryAreaFromSize(sizeName, sizesMap);
    const billboard = Object.values(billboards).find(b => b.Size === sizeName);
    const faces = billboard?.Faces_Count || 2;
    return Math.round(pricePerMeter * area * faces * 100) / 100;
  }, [sizesMap, billboards]);

  // بدء تعديل عنصر
  const startEditingItem = (item: TaskItem & { billboard: Billboard; area: number }) => {
    setEditingItemId(item.id);
    const existingCompanyCost = item.company_installation_cost ?? customCompanyCosts[item.id] ?? (() => {
      const fullCompanyCost = installationPrices[item.billboard_id] || 0;
      const totalFaces = item.billboard?.Faces_Count || 1;
      const facesToInstall = item.faces_to_install ?? totalFaces;
      return (totalFaces > 1 && facesToInstall === 1) ? fullCompanyCost / 2 : fullCompanyCost;
    })();
    setEditValues({
      companyCost: existingCompanyCost,
      customerCost: item.customer_installation_cost || 0,
      customerOriginalInstallCost: item.customer_original_install_cost || 0,
      customerReinstallCost: item.customer_reinstall_cost || 0,
      additionalCost: item.additional_cost || 0,
      additionalNotes: item.additional_cost_notes || '',
      companyAdditionalCost: item.company_additional_cost || 0,
      companyAdditionalNotes: item.company_additional_cost_notes || '',
      hasCutout: item.has_cutout || false
    });
  };

  // حفظ تعديل عنصر
  const handleSaveItemEdit = async () => {
    if (!editingItemId) return;
    
    setDistributing(true);
    try {
      // حفظ تكلفة الشركة محلياً
      setCustomCompanyCosts(prev => ({
        ...prev,
        [editingItemId]: editValues.companyCost
      }));
      
      const editingItem = taskItems.find(i => i.id === editingItemId);
      const isReinstalled = editingItem && (editingItem.reinstall_count || 0) > 0;

      const updateData: any = {
        company_installation_cost: editValues.companyCost,
        customer_installation_cost: isReinstalled ? editValues.customerReinstallCost : editValues.customerCost,
        customer_original_install_cost: editValues.customerOriginalInstallCost,
        customer_reinstall_cost: editValues.customerReinstallCost,
        additional_cost: editValues.additionalCost || null,
        additional_cost_notes: editValues.additionalNotes || null,
        company_additional_cost: editValues.companyAdditionalCost || null,
        company_additional_cost_notes: editValues.companyAdditionalNotes || null,
        has_cutout: editValues.hasCutout
      };
      
      const { error } = await supabase
        .from('installation_task_items')
        .update(updateData)
        .eq('id', editingItemId);

      if (error) throw error;
      toast.success('تم الحفظ');
      setEditingItemId(null);
      onRefresh();
    } catch (error) {
      toast.error('فشل الحفظ');
    } finally {
      setDistributing(false);
    }
  };

  // تحويل لمجاني
  const handleSetFree = async (itemId: string) => {
    setDistributing(true);
    try {
      const { error } = await supabase
        .from('installation_task_items')
        .update({ customer_installation_cost: 0 })
        .eq('id', itemId);

      if (error) throw error;
      toast.success('تم التحويل لمجاني');
      onRefresh();
    } catch (error) {
      toast.error('فشل التحويل');
    } finally {
      setDistributing(false);
    }
  };

  // تحويل جميع اللوحات لمجانية
  const handleSetAllFree = async () => {
    if (taskItems.length === 0) return;
    
    setDistributing(true);
    try {
      const updates = taskItems.map(item => 
        supabase
          .from('installation_task_items')
          .update({ customer_installation_cost: 0 })
          .eq('id', item.id)
      );

      await Promise.all(updates);
      toast.success(`تم تحويل ${taskItems.length} لوحة لمجانية`);
      onRefresh();
    } catch (error) {
      toast.error('فشل التحويل');
    } finally {
      setDistributing(false);
    }
  };

  // تطبيق التسعير السريع بالقطعة
  const handleApplyQuickPricing = async () => {
    const hasAnyPrice = Object.values(quickPrices).some(p => p.normal > 0 || p.cutout > 0);
    if (!hasAnyPrice) {
      toast.error('أدخل سعر واحد على الأقل');
      return;
    }

    setDistributing(true);
    try {
      const updates = taskItems.map(item => {
        const billboard = billboards[item.billboard_id];
        const sizeName = billboard?.Size || '';
        const hasCutout = item.has_cutout || false;
        const pricing = quickPrices[sizeName];
        const totalFaces = billboard?.Faces_Count || 1;
        const facesToInstall = item.faces_to_install ?? totalFaces;
        
        let cost = item.customer_installation_cost || 0;
        if (pricing) {
          const fullCost = hasCutout ? pricing.cutout : pricing.normal;
          if (fullCost > 0) {
            // نصف السعر إذا وجه واحد من لوحة بوجهين
            cost = (totalFaces > 1 && facesToInstall === 1) ? fullCost / 2 : fullCost;
          }
        }
        
        return supabase
          .from('installation_task_items')
          .update({ 
            customer_installation_cost: cost,
            pricing_type: 'piece',
            price_per_meter: 0
          })
          .eq('id', item.id);
      });

      await Promise.all(updates);
      toast.success('تم تطبيق الأسعار');
      setQuickPrices({});
      onRefresh();
    } catch (error) {
      toast.error('فشل في التطبيق');
    } finally {
      setDistributing(false);
    }
  };

  // تطبيق سعر المتر على مقاس معين فوراً
  const handleApplyMeterToSize = async (sizeName: string) => {
    const meterPrice = meterPrices[sizeName];
    if (!meterPrice || (meterPrice.normal <= 0 && meterPrice.cutout <= 0)) {
      toast.error('أدخل سعر المتر أولاً');
      return;
    }

    setDistributing(true);
    try {
      const itemsToUpdate = taskItems.filter(item => {
        const billboard = billboards[item.billboard_id];
        return billboard?.Size === sizeName;
      });

      const updates = itemsToUpdate.map(item => {
        const billboard = billboards[item.billboard_id];
        const hasCutout = item.has_cutout || false;
        const area = calculateTaskSummaryAreaFromSize(sizeName, sizesMap);
        const totalFaces = billboard?.Faces_Count || 1;
        const facesToInstall = item.faces_to_install ?? totalFaces;
        
        const pricePerMeter = hasCutout ? meterPrice.cutout : meterPrice.normal;
        if (!pricePerMeter || pricePerMeter <= 0) return null;
        
        // السعر = سعر المتر × المساحة × عدد الأوجه المراد تركيبها
        const cost = Math.round(pricePerMeter * area * facesToInstall * 100) / 100;
        
        return supabase
          .from('installation_task_items')
          .update({ 
            customer_installation_cost: cost,
            pricing_type: 'meter',
            price_per_meter: pricePerMeter
          })
          .eq('id', item.id);
      }).filter(Boolean);

      await Promise.all(updates);
      toast.success(`تم تطبيق السعر على ${itemsToUpdate.length} لوحة بمقاس ${sizeName}`);
      onRefresh();
    } catch (error) {
      toast.error('فشل في التطبيق');
    } finally {
      setDistributing(false);
    }
  };

  // تطبيق سعر المتر على نوع كامل (مثل: برجية عادية)
  const handleApplyMeterToType = async (billboardType: string) => {
    const meterPrice = typeMeterPrices[billboardType];
    if (!meterPrice || (meterPrice.normal <= 0 && meterPrice.cutout <= 0)) {
      toast.error('أدخل سعر المتر للنوع أولاً');
      return;
    }

    setDistributing(true);
    try {
      const itemsToUpdate = taskItems.filter(item => {
        const billboard = billboards[item.billboard_id];
        return (billboard?.billboard_type || 'عادية') === billboardType;
      });

      const updates = itemsToUpdate.map(item => {
        const billboard = billboards[item.billboard_id];
        const hasCutout = item.has_cutout || false;
        const sizeName = billboard?.Size || '';
        const area = calculateTaskSummaryAreaFromSize(sizeName, sizesMap);
        const totalFaces = billboard?.Faces_Count || 1;
        const facesToInstall = item.faces_to_install ?? totalFaces;
        
        const pricePerMeter = hasCutout ? meterPrice.cutout : meterPrice.normal;
        if (!pricePerMeter || pricePerMeter <= 0) return null;
        
        // السعر = سعر المتر × المساحة × عدد الأوجه المراد تركيبها
        const cost = Math.round(pricePerMeter * area * facesToInstall * 100) / 100;
        
        return supabase
          .from('installation_task_items')
          .update({ 
            customer_installation_cost: cost,
            pricing_type: 'meter',
            price_per_meter: pricePerMeter
          })
          .eq('id', item.id);
      }).filter(Boolean);

      await Promise.all(updates);
      toast.success(`تم تطبيق السعر على ${itemsToUpdate.length} لوحة من نوع ${billboardType}`);
      setTypeMeterPrices(prev => {
        const updated = { ...prev };
        delete updated[billboardType];
        return updated;
      });
      onRefresh();
    } catch (error) {
      toast.error('فشل في التطبيق');
    } finally {
      setDistributing(false);
    }
  };

  // تبديل طي المقاس
  const toggleSizeCollapse = (sizeKey: string) => {
    setCollapsedSizes(prev => {
      const updated = new Set(prev);
      if (updated.has(sizeKey)) {
        updated.delete(sizeKey);
      } else {
        updated.add(sizeKey);
      }
      return updated;
    });
  };

  // تبديل طي النوع
  const toggleTypeCollapse = (typeKey: string) => {
    setCollapsedTypes(prev => {
      const updated = new Set(prev);
      if (updated.has(typeKey)) {
        updated.delete(typeKey);
      } else {
        updated.add(typeKey);
      }
      return updated;
    });
  };

  if (taskItems.length === 0) return null;

  const billboardTypes = Object.keys(groupedData);

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <Card className="overflow-hidden border-border">
        {/* العنوان والملخص */}
        <CollapsibleTrigger asChild>
          <CardHeader className="py-3 px-4 cursor-pointer hover:bg-accent/50 transition-colors bg-card">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <DollarSign className="h-5 w-5 text-primary" />
                <CardTitle className="text-base">تكاليف التركيب</CardTitle>
                <Badge variant="secondary" className="text-xs">
                  {taskItems.length} لوحة
                </Badge>
              </div>
              
              <div className="flex items-center gap-3">
                <div className="hidden sm:flex items-center gap-2 text-sm">
                  <div className="flex items-center gap-1 px-2 py-1 rounded bg-muted">
                    <span className="text-muted-foreground">الشركة:</span>
                    <span className="font-bold">{totals.companyCost.toLocaleString('ar-LY')}</span>
                  </div>
                  <div className="flex items-center gap-1 px-2 py-1 rounded bg-primary/10">
                    <span className="text-muted-foreground">الزبون:</span>
                    <span className="font-bold text-primary">{totals.customerCost.toLocaleString('ar-LY')}</span>
                  </div>
                  {totals.additionalCost > 0 && (
                    <div className="flex items-center gap-1 px-2 py-1 rounded bg-amber-500/10">
                      <span className="text-muted-foreground">إضافية:</span>
                      <span className="font-bold text-amber-600">+{totals.additionalCost.toLocaleString('ar-LY')}</span>
                    </div>
                  )}
                </div>
                {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 pb-4 px-4 space-y-5 bg-card">
            {/* اختيار نوع التسعير */}
            <div className="p-4 rounded-xl border-2 border-primary/30 bg-primary/5 mt-2">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-bold text-base flex items-center gap-2 text-primary">
                  <Calculator className="h-5 w-5" />
                  طريقة حساب التكلفة
                </h3>
              </div>
              
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => !disabled && setPricingType('piece')}
                  disabled={disabled}
                  className={`p-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                    pricingType === 'piece' 
                      ? 'border-primary bg-primary text-primary-foreground' 
                      : 'border-border bg-card hover:border-primary/50 text-foreground'
                  } ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
                >
                  <Square className="h-4 w-4" />
                  <span className="font-medium text-sm">بالقطعة</span>
                </button>
                <button
                  onClick={() => !disabled && setPricingType('meter')}
                  disabled={disabled}
                  className={`p-3 rounded-lg border-2 transition-all flex items-center justify-center gap-2 ${
                    pricingType === 'meter' 
                      ? 'border-primary bg-primary text-primary-foreground' 
                      : 'border-border bg-card hover:border-primary/50 text-foreground'
                  } ${disabled ? 'opacity-50 cursor-not-allowed pointer-events-none' : ''}`}
                >
                  <Ruler className="h-4 w-4" />
                  <span className="font-medium text-sm">بالمتر المربع</span>
                </button>
              </div>
            </div>

 {/* ️ & ️ التحكم في إعدادات الطباعة والقص */}
            <div className="p-4 rounded-xl border border-border/80 bg-muted/20 space-y-3 text-right" dir="rtl">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Pencil className="h-3.5 w-3.5 text-primary" />
                  إعدادات وتكاليف الطباعة والقص / المجسمات للمهمة
                </span>
                {(isPrintActive || isCutoutActive) && (
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 font-bold">
 {isPrintActive && `️ طباعة (${printPricePerMeter} د.ل/م²)`}
                    {isPrintActive && isCutoutActive && ' • '}
 {isCutoutActive && `️ قص ومجسمات (${cutoutCost} د.ل)`}
                  </Badge>
                )}
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {/* إعداد سعر متر الطباعة */}
                <div className="p-3 rounded-lg bg-background border border-border/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5 cursor-pointer">
                      <Switch 
                        checked={isPrintActive}
                        onCheckedChange={val => {
                          setIsPrintActive(val);
                          handleSavePrintAndCutoutSettings(val, printPricePerMeter, isCutoutActive, cutoutCost);
                        }}
                        disabled={disabled || savingTaskSettings}
                      />
                      <span>تفعيل احتساب تكلفة الطباعة</span>
                    </Label>
                    {isPrintActive && (
                      <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-none text-[9px] font-bold">
                        مفعلة
                      </Badge>
                    )}
                  </div>
                  {isPrintActive && (
                    <div className="pt-1 flex items-center gap-2">
                      <InlinePriceInput 
                        label="سعر متر الطباعة"
                        value={printPricePerMeter}
                        onChange={val => {
                          setPrintPricePerMeter(val);
                          handleSavePrintAndCutoutSettings(isPrintActive, val, isCutoutActive, cutoutCost);
                        }}
                        disabled={disabled || savingTaskSettings}
                        step={5}
                      />
                    </div>
                  )}
                </div>

                {/* إعداد تكلفة القص والمجسمات */}
                <div className="p-3 rounded-lg bg-background border border-border/40 space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5 cursor-pointer">
                      <Switch 
                        checked={isCutoutActive}
                        onCheckedChange={val => {
                          setIsCutoutActive(val);
                          handleSavePrintAndCutoutSettings(isPrintActive, printPricePerMeter, val, cutoutCost);
                        }}
                        disabled={disabled || savingTaskSettings}
                      />
                      <span>تفعيل تكلفة القص والمجسمات</span>
                    </Label>
                    {isCutoutActive && (
                      <Badge className="bg-amber-500/10 text-amber-600 border-none text-[9px] font-bold">
                        مفعلة
                      </Badge>
                    )}
                  </div>
                  {isCutoutActive && (
                    <div className="pt-1 flex items-center gap-2">
                      <InlinePriceInput 
                        label="تكلفة القص / المجسم"
                        value={cutoutCost}
                        onChange={val => {
                          setCutoutCost(val);
                          handleSavePrintAndCutoutSettings(isPrintActive, printPricePerMeter, isCutoutActive, val);
                        }}
                        disabled={disabled || savingTaskSettings}
                        step={10}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* الإحصائيات الرئيسية */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
              <div className="p-3 rounded-lg bg-muted text-center">
                <div className="text-2xl font-bold">{totals.totalArea.toFixed(0)}</div>
                <div className="text-xs text-muted-foreground">م² إجمالي</div>
              </div>
              <div className="p-3 rounded-lg bg-muted text-center">
                <div className="text-2xl font-bold">{totals.companyCost.toLocaleString('ar-LY')}</div>
                <div className="text-xs text-muted-foreground">تكلفة الشركة</div>
              </div>
              <div className="p-3 rounded-lg bg-primary/10 text-center">
                <div className="text-2xl font-bold text-primary">{totals.customerCost.toLocaleString('ar-LY')}</div>
                <div className="text-xs text-muted-foreground">تكلفة الزبون</div>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10 text-center">
                <div className="text-2xl font-bold text-amber-600">{totals.additionalCost > 0 ? `+${totals.additionalCost.toLocaleString('ar-LY')}` : '0'}</div>
                <div className="text-xs text-muted-foreground">تكاليف إضافية</div>
              </div>
              <div className={`p-3 rounded-lg text-center ${totals.profit >= 0 ? 'bg-green-500/10' : 'bg-destructive/10'}`}>
                <div className={`text-2xl font-bold ${totals.profit >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                  {totals.profit >= 0 ? '+' : ''}{totals.profit.toLocaleString('ar-LY')}
                </div>
                <div className="text-xs text-muted-foreground">الربح</div>
              </div>
            </div>

            <Separator />

            {/* فاتورة المقاسات حسب النوع */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <Ruler className="h-4 w-4" />
                  تفاصيل اللوحات
                </h3>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleSetAllFree}
                  disabled={disabled || distributing || totals.customerCost === 0}
                  className="gap-2 text-purple-600 border-purple-300 hover:bg-purple-50"
                >
                  <Gift className="h-4 w-4" />
                  تحويل الكل لمجاني
                </Button>
              </div>

              {billboardTypes.map(type => {
                const typeData = groupedData[type];
                const Icon = BILLBOARD_TYPE_ICONS[type] || LayoutGrid;
                const isTypeCollapsed = collapsedTypes.has(type);
                
                return (
                  <div key={type} className="border rounded-lg overflow-hidden bg-card">
                    {/* رأس النوع - قابل للنقر */}
                    <div 
                      className="flex items-center justify-between p-3 bg-muted/50 cursor-pointer hover:bg-muted/70 transition-colors"
                      onClick={() => toggleTypeCollapse(type)}
                    >
                      <div className="flex items-center gap-2">
                        {isTypeCollapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
                        <Icon className="h-4 w-4" />
                        <span className="font-bold">{type}</span>
                        <Badge variant="outline" className="text-xs">
                          {typeData.totalItems} لوحة
                        </Badge>
                        {/* عرض سعر المتر إذا كان التسعير بالمتر */}
                        {pricingType === 'meter' && (() => {
                          const allItems = Object.values(typeData.sizes).flatMap(s => s.items);
                          const meterItem = allItems.find(item => item.pricing_type === 'meter' && item.price_per_meter);
                          return meterItem ? (
                            <Badge variant="secondary" className="text-xs bg-primary/10 text-primary">
                              {meterItem.price_per_meter?.toFixed(1)} د.ل/م²
                            </Badge>
                          ) : null;
                        })()}
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <span>{typeData.totalArea.toFixed(0)} م²</span>
                        <span className="text-muted-foreground">|</span>
                        <span>الشركة: {typeData.companyCost.toLocaleString('ar-LY')}</span>
                        <span className="text-muted-foreground">|</span>
                        <span className="text-primary font-bold">الزبون: {typeData.customerCost.toLocaleString('ar-LY')}</span>
                      </div>
                    </div>

                    {/* تسعير النوع بالكامل (بالمتر) */}
                    {!isTypeCollapsed && pricingType === 'meter' && (
                      <div className="p-3 border-b bg-gradient-to-r from-primary/5 to-transparent">
                        <div className="flex flex-wrap items-center gap-3">
                          <span className="text-sm font-medium text-primary flex items-center gap-1">
                            <Zap className="h-4 w-4" />
                            تسعير {type} بالكامل:
                          </span>
                          {typeData.normalCount > 0 && (
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-muted-foreground whitespace-nowrap">عادي/م²:</Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.1"
                                placeholder="0"
                                className="h-8 w-24 text-sm"
                                value={typeMeterPrices[type]?.normal || ''}
                                onChange={e => setTypeMeterPrices(prev => ({
                                  ...prev,
                                  [type]: {
                                    ...prev[type],
                                    normal: Number(e.target.value) || 0,
                                    cutout: prev[type]?.cutout || 0
                                  }
                                }))}
                                disabled={disabled}
                              />
                            </div>
                          )}
                          {typeData.cutoutCount > 0 && (
                            <div className="flex items-center gap-2">
                              <Label className="text-xs text-amber-600 whitespace-nowrap flex items-center gap-1">
                                <Box className="h-3 w-3" />
                                مجسم/م²:
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                step="0.1"
                                placeholder="0"
                                className="h-8 w-24 text-sm border-amber-300"
                                value={typeMeterPrices[type]?.cutout || ''}
                                onChange={e => setTypeMeterPrices(prev => ({
                                  ...prev,
                                  [type]: {
                                    ...prev[type],
                                    normal: prev[type]?.normal || 0,
                                    cutout: Number(e.target.value) || 0
                                  }
                                }))}
                                disabled={disabled}
                              />
                            </div>
                          )}
                          <Button
                            size="sm"
                            onClick={() => handleApplyMeterToType(type)}
                            disabled={disabled || distributing || (!typeMeterPrices[type]?.normal && !typeMeterPrices[type]?.cutout)}
                            className="gap-1"
                          >
                            <Check className="h-3 w-3" />
                            تطبيق على {type}
                          </Button>
                          {(typeMeterPrices[type]?.normal || typeMeterPrices[type]?.cutout) && (
                            <span className="text-xs text-green-600 font-medium">
                              ≈ {Math.round((typeMeterPrices[type]?.normal || typeMeterPrices[type]?.cutout || 0) * typeData.totalArea).toLocaleString('ar-LY')} د.ل
                            </span>
                          )}
                        </div>
                      </div>
                    )}

                    {/* المقاسات واللوحات */}
                    {!isTypeCollapsed && (
                      <div className="divide-y">
                        {Object.values(typeData.sizes).map(sizeData => {
                          const sizeKey = `${type}-${sizeData.size}`;
                          const isSizeCollapsed = collapsedSizes.has(sizeKey);
                          
                          return (
                            <div key={sizeData.size} className="bg-card">
                              {/* رأس المقاس - قابل للطي */}
                              <div 
                                className="flex flex-wrap items-center justify-between gap-3 p-3 cursor-pointer hover:bg-muted/30 transition-colors border-b border-border/50"
                                onClick={() => toggleSizeCollapse(sizeKey)}
                              >
                                <div className="flex items-center gap-3">
                                  {isSizeCollapsed ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronUp className="h-4 w-4 text-muted-foreground" />}
                                  <Badge className="text-sm font-mono bg-primary/10 text-primary border-0">{sizeData.size}</Badge>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span>{sizeData.items.length} لوحة</span>
                                    <span>•</span>
                                    <span>{sizeData.totalArea.toFixed(1)} م²</span>
                                    {sizeData.cutoutCount > 0 && (
                                      <>
                                        <span>•</span>
                                        <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-300">
                                          <Box className="h-3 w-3 ml-1" />
                                          {sizeData.cutoutCount} مجسم
                                        </Badge>
                                      </>
                                    )}
                                  </div>
                                </div>

                                {/* ملخص الأسعار */}
                                <div className="flex items-center gap-2 text-sm">
                                  <Badge variant="outline" className="bg-muted">
                                    الشركة: {sizeData.companyCost.toLocaleString('ar-LY')}
                                  </Badge>
                                  <Badge className="bg-primary/10 text-primary border-0">
                                    الزبون: {sizeData.customerCost.toLocaleString('ar-LY')}
                                  </Badge>
                                </div>
                              </div>

                              {/* حقول التسعير */}
                              {!isSizeCollapsed && (
                                <div className="p-3 bg-muted/20 border-b">
                                  {pricingType === 'piece' ? (
                                    // التسعير بالقطعة
                                    <div className="flex flex-wrap items-center gap-3">
                                      {sizeData.normalCount > 0 && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                                            سعر القطعة العادية:
                                          </span>
                                          <Input
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            className="h-8 w-24 text-sm"
                                            value={quickPrices[sizeData.size]?.normal || ''}
                                            onChange={e => setQuickPrices(prev => ({
                                              ...prev,
                                              [sizeData.size]: {
                                                ...prev[sizeData.size],
                                                normal: Number(e.target.value) || 0,
                                                cutout: prev[sizeData.size]?.cutout || 0
                                              }
                                            }))}
                                            disabled={disabled}
                                          />
                                          <span className="text-xs text-muted-foreground">د.ل</span>
                                          <span className="text-xs text-muted-foreground">× {sizeData.normalCount}</span>
                                          {quickPrices[sizeData.size]?.normal > 0 && (
                                            <span className="text-xs text-green-600 font-medium">
                                              = {(quickPrices[sizeData.size].normal * sizeData.normalCount).toLocaleString('ar-LY')} د.ل
                                            </span>
                                          )}
                                        </div>
                                      )}
                                      {sizeData.cutoutCount > 0 && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-amber-600 whitespace-nowrap flex items-center gap-1">
                                            <Box className="h-3 w-3" />
                                            سعر القطعة المجسمة:
                                          </span>
                                          <Input
                                            type="number"
                                            min="0"
                                            placeholder="0"
                                            className="h-8 w-24 text-sm border-amber-400"
                                            value={quickPrices[sizeData.size]?.cutout || ''}
                                            onChange={e => setQuickPrices(prev => ({
                                              ...prev,
                                              [sizeData.size]: {
                                                ...prev[sizeData.size],
                                                normal: prev[sizeData.size]?.normal || 0,
                                                cutout: Number(e.target.value) || 0
                                              }
                                            }))}
                                            disabled={disabled}
                                          />
                                          <span className="text-xs text-muted-foreground">د.ل</span>
                                          <span className="text-xs text-muted-foreground">× {sizeData.cutoutCount}</span>
                                          {quickPrices[sizeData.size]?.cutout > 0 && (
                                            <span className="text-xs text-amber-600 font-medium">
                                              = {(quickPrices[sizeData.size].cutout * sizeData.cutoutCount).toLocaleString('ar-LY')} د.ل
                                            </span>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    // التسعير بالمتر المربع
                                    <div className="flex flex-wrap items-center gap-3">
                                      {sizeData.normalCount > 0 && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-muted-foreground whitespace-nowrap flex items-center gap-1">
                                            <Ruler className="h-3 w-3" />
                                            عادي/م²:
                                          </span>
                                          <Input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            placeholder="0"
                                            className="h-8 w-24 text-sm border-primary/30"
                                            value={meterPrices[sizeData.size]?.normal || ''}
                                            onChange={e => setMeterPrices(prev => ({
                                              ...prev,
                                              [sizeData.size]: {
                                                ...prev[sizeData.size],
                                                normal: Number(e.target.value) || 0,
                                                cutout: prev[sizeData.size]?.cutout || 0
                                              }
                                            }))}
                                            disabled={disabled}
                                          />
                                          <span className="text-xs text-primary font-medium">
                                            = {meterPrices[sizeData.size]?.normal 
                                              ? Math.round(meterPrices[sizeData.size].normal * sizeData.avgAreaPerItem * sizeData.normalCount).toLocaleString('ar-LY')
                                              : '0'} د.ل
                                          </span>
                                        </div>
                                      )}
                                      {sizeData.cutoutCount > 0 && (
                                        <div className="flex items-center gap-2">
                                          <span className="text-xs text-amber-600 whitespace-nowrap flex items-center gap-1">
                                            <Box className="h-3 w-3" />
                                            مجسم/م²:
                                          </span>
                                          <Input
                                            type="number"
                                            min="0"
                                            step="0.1"
                                            placeholder="0"
                                            className="h-8 w-24 text-sm border-amber-400"
                                            value={meterPrices[sizeData.size]?.cutout || ''}
                                            onChange={e => setMeterPrices(prev => ({
                                              ...prev,
                                              [sizeData.size]: {
                                                ...prev[sizeData.size],
                                                normal: prev[sizeData.size]?.normal || 0,
                                                cutout: Number(e.target.value) || 0
                                              }
                                            }))}
                                            disabled={disabled}
                                          />
                                          <span className="text-xs text-amber-600 font-medium">
                                            = {meterPrices[sizeData.size]?.cutout 
                                              ? Math.round(meterPrices[sizeData.size].cutout * sizeData.avgAreaPerItem * sizeData.cutoutCount).toLocaleString('ar-LY')
                                              : '0'} د.ل
                                          </span>
                                        </div>
                                      )}
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleApplyMeterToSize(sizeData.size);
                                        }}
                                        disabled={disabled || distributing || (!meterPrices[sizeData.size]?.normal && !meterPrices[sizeData.size]?.cutout)}
                                        className="gap-1 h-8"
                                      >
                                        <Check className="h-3 w-3" />
                                        تطبيق
                                      </Button>
                                    </div>
                                  )}
                                </div>
                              )}

                               {/* قائمة اللوحات */}
                               {!isSizeCollapsed && (
                                 <div className="divide-y divide-border/30">
                                  {sizeData.items.map(item => {
                                    const faces = item.faces_to_install ?? (item.billboard.Faces_Count || 2);
                                    const basicCompanyCost = item.company_installation_cost !== null && item.company_installation_cost !== undefined
                                      ? item.company_installation_cost
                                      : (customCompanyCosts[item.id] ?? (() => {
                                          const fullCompanyCost = installationPrices[item.billboard_id] || 0;
                                          const totalFaces = item.billboard?.Faces_Count || 1;
                                          return (totalFaces > 1 && faces === 1) ? fullCompanyCost / 2 : fullCompanyCost;
                                        })());
                                    const itemCompanyCost = basicCompanyCost + (item.company_additional_cost || 0);

                                    return (
                                      <div 
                                        key={item.id} 
                                        className={`p-3 ${
                                          editingItemId === item.id ? 'bg-card' : 'bg-muted/10'
                                        }`}
                                      >
                                        {editingItemId === item.id ? (
                                          // وضع التعديل
                                          <div className="rounded-2xl border border-primary/20 bg-primary/[0.01] p-5 space-y-4 shadow-sm animate-in fade-in duration-200">
                                            <div className="flex items-center justify-between pb-3 border-b border-border/10 gap-4 text-right">
                                              <div className="flex items-center gap-3">
                                                {item.billboard.Image_URL ? (
                                                  <img src={item.billboard.Image_URL} alt="" className="w-14 h-14 rounded-xl object-cover border border-primary/20 shadow-sm" />
                                                ) : (
                                                  <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center border border-border/15">
                                                    <LayoutGrid className="h-6 w-6 text-muted-foreground/45" />
                                                  </div>
                                                )}
                                                <div>
                                                  <span className="font-semibold text-sm block text-foreground">{item.billboard.Billboard_Name || `لوحة رمز #${String(item.billboard_id).padStart(4, '0')}`}</span>
                                                  <span className="text-xs text-muted-foreground block mt-0.5">{faces} أوجه • {item.area.toFixed(1)} م²</span>
                                                </div>
                                              </div>
                                              <div className="flex gap-2">
                                                <Button size="sm" className="h-9 text-xs font-semibold gap-1.5 rounded-lg" onClick={handleSaveItemEdit} disabled={distributing}>
                                                  <Save className="h-3.5 w-3.5" /> 
                                                  <span>حفظ</span>
                                                </Button>
                                                <Button size="sm" variant="outline" className="h-9 w-9 p-0 rounded-lg" onClick={() => setEditingItemId(null)}>
                                                  <X className="h-4 w-4" />
                                                </Button>
                                              </div>
                                            </div>
                                            
                                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 text-right">
                                              {/* isFirstInstall calculation defined here */}
                                              {(() => {
                                                const isFirstInstall = taskType !== 'reinstallation';
                                                const isReinstalled = (item.reinstall_count || 0) > 0;
                                                return (
                                                  <>
                                                    <div className="space-y-2">
                                                      <Label className="text-sm font-semibold text-amber-600 block leading-relaxed text-right">تكلفة الشركة (التركيب الأساسي)</Label>
                                                      <InlinePriceInput 
                                                        value={editValues.companyCost}
                                                        onChange={val => setEditValues(prev => ({...prev, companyCost: val}))}
                                                        label=""
                                                        showLabel={false}
                                                        className="w-full"
                                                        disabled={isFirstInstall && !isReinstalled}
                                                      />
                                                    </div>

                                                    {!isReinstalled ? (
                                                      <div className="space-y-2">
                                                        <Label className="text-sm font-semibold text-primary block leading-relaxed text-right">سعر الزبون (التركيب الأساسي)</Label>
                                                        <div className="flex gap-2 items-center">
                                                          <InlinePriceInput 
                                                            value={editValues.customerCost}
                                                            onChange={val => setEditValues(prev => ({...prev, customerCost: val}))}
                                                            label=""
                                                            showLabel={false}
                                                            className="flex-1"
                                                            disabled={isFirstInstall}
                                                          />
                                                          <Button 
                                                            type="button"
                                                            size="sm" 
                                                            variant="outline" 
                                                            className="h-11 w-11 p-0 shrink-0 rounded-xl text-purple-650 border-purple-250 hover:bg-purple-50/50 transition-colors" 
                                                            onClick={() => setEditValues(prev => ({ ...prev, customerCost: 0 }))} 
                                                            title="مجاني"
                                                            disabled={isFirstInstall}
                                                          >
                                                            <Gift className="h-5 w-5" />
                                                          </Button>
                                                        </div>
                                                      </div>
                                                    ) : (
                                                      <>
                                                        <div className="space-y-2">
                                                          <Label className="text-sm font-semibold text-primary block leading-relaxed text-right">سعر الزبون (التركيب الأصلي)</Label>
                                                          <InlinePriceInput 
                                                            value={editValues.customerOriginalInstallCost}
                                                            onChange={val => setEditValues(prev => ({...prev, customerOriginalInstallCost: val}))}
                                                            label=""
                                                            showLabel={false}
                                                            className="w-full"
                                                          />
                                                        </div>
                                                        <div className="space-y-2">
                                                          <Label className="text-sm font-semibold text-amber-600 block leading-relaxed text-right">سعر الزبون (إعادة التركيب)</Label>
                                                          <InlinePriceInput 
                                                            value={editValues.customerReinstallCost}
                                                            onChange={val => setEditValues(prev => ({...prev, customerReinstallCost: val}))}
                                                            label=""
                                                            showLabel={false}
                                                            className="w-full"
                                                          />
                                                        </div>
                                                      </>
                                                    )}
                                                    
                                                    {isFirstInstall && !isReinstalled && (
                                                      <div className="col-span-1 sm:col-span-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs font-bold text-right flex items-center gap-2">
                                                        <AlertCircle className="h-4 w-4 text-amber-500 shrink-0" />
                                                        <span>تكلفة التركيبة الأولى تأتي تلقائياً من العقد ولا يمكن تعديلها من هنا.</span>
                                                      </div>
                                                    )}

                                                    <div className="space-y-2">
                                                      <Label className="text-sm font-semibold text-muted-foreground block leading-relaxed text-right">مصاريف إضافية على الشركة</Label>
                                                      <InlinePriceInput 
                                                        value={editValues.companyAdditionalCost}
                                                        onChange={val => setEditValues(prev => ({...prev, companyAdditionalCost: val}))}
                                                        label=""
                                                        showLabel={false}
                                                        className="w-full"
                                                      />
                                                    </div>
                                                    <div className="space-y-2">
                                                      <Label className="text-sm font-semibold text-muted-foreground block leading-relaxed text-right">مصاريف إضافية على العميل</Label>
                                                      <InlinePriceInput 
                                                        value={editValues.additionalCost}
                                                        onChange={val => setEditValues(prev => ({...prev, additionalCost: val}))}
                                                        label=""
                                                        showLabel={false}
                                                        className="w-full"
                                                      />
                                                    </div>
                                                    <div className="space-y-2">
                                                      <Label className="text-sm font-semibold text-muted-foreground block leading-relaxed text-right">ملاحظات وسبب إضافية العميل</Label>
                                                      <Input dir="rtl" value={editValues.additionalNotes} onChange={e => setEditValues(prev => ({...prev, additionalNotes: e.target.value}))} placeholder="تجهيزات معينة للموقع، عمل ليلي..." className="h-11 text-xs rounded-xl text-right" />
                                                    </div>
                                                    <div className="space-y-2">
                                                      <Label className="text-sm font-semibold text-muted-foreground block leading-relaxed text-right">ملاحظات وسبب إضافية الشركة</Label>
                                                      <Input dir="rtl" value={editValues.companyAdditionalNotes} onChange={e => setEditValues(prev => ({...prev, companyAdditionalNotes: e.target.value}))} placeholder="تراخيص، رافعة تلسكوبية..." className="h-11 text-xs rounded-xl text-right" />
                                                    </div>

                                                    {/* تصفير / سداد التكاليف */}
                                                    <div className="col-span-1 sm:col-span-2 flex items-center justify-between gap-3 bg-amber-500/[0.03] border border-amber-500/10 p-3 rounded-xl shadow-sm mt-1 text-right">
                                                      <div className="flex flex-col text-right">
                                                        <span className="text-xs font-bold text-amber-700 dark:text-amber-400">حالة سداد التكاليف للزبون</span>
                                                        <span className="text-[10px] text-muted-foreground mt-0.5">تصفير التكاليف للشركة وللزبون (بدون تكاليف)</span>
                                                      </div>
                                                      <Button
                                                        size="sm"
                                                        variant={editValues.customerCost === 0 && editValues.companyCost === 0 ? "default" : "outline"}
                                                        className={cn(
                                                          "h-9 px-4 text-xs font-bold gap-2 rounded-xl transition-all cursor-pointer",
                                                          editValues.customerCost === 0 && editValues.companyCost === 0
                                                            ? "bg-amber-500 hover:bg-amber-600 text-black border-0 shadow-sm"
                                                            : "border-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                                                        )}
                                                        onClick={() => setEditValues(prev => ({ ...prev, customerCost: 0, companyCost: 0 }))}
                                                        type="button"
                                                        disabled={isFirstInstall}
                                                      >
                                                        <CheckCircle2 className="h-4 w-4" />
                                                        <span>{editValues.customerCost === 0 && editValues.companyCost === 0 ? "تم السداد والتصفير" : "سدد التكاليف / بدون تكاليف"}</span>
                                                      </Button>
                                                    </div>
                                                  </>
                                                );
                                              })()}

                                              <div className="space-y-2 col-span-2 border-t border-border/10 pt-4 mt-2">
                                                <Label className="text-sm font-semibold text-purple-650 block leading-relaxed">هل تحتوي هذه اللوحة على مجسم؟</Label>
                                                <div className="flex items-center gap-3.5 h-11 px-4 bg-background border border-border/15 rounded-xl">
                                                  <Switch 
                                                    checked={editValues.hasCutout} 
                                                    onCheckedChange={val => setEditValues(prev => ({...prev, hasCutout: val}))} 
                                                  />
                                                  <span className="text-xs sm:text-sm text-muted-foreground font-semibold leading-relaxed">نعم، تفعيل خيارات ومواصفات المجسمات لهذه اللوحة</span>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ) : (
                                          // وضع العرض
                                          <div className="flex items-center justify-between gap-2 flex-wrap">
                                            <div className="flex flex-col gap-0.5">
                                              <div className="flex items-center gap-2">
                                                <span className="text-sm font-medium text-right text-foreground">
                                                  {item.billboard.Billboard_Name || `لوحة ${item.billboard_id}`}
                                                </span>
                                                {item.has_cutout && (
                                                  <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-600 border-amber-300">
                                                    <Box className="h-3 w-3 ml-1" />
                                                    مجسم
                                                  </Badge>
                                                )}
                                                <span className="text-xs text-muted-foreground">
                                                  {item.area.toFixed(1)} م²
                                                </span>
                                              </div>
                                              {item.billboard.Nearest_Landmark && (
                                                <span className="text-xs text-muted-foreground pr-1 flex items-center gap-1 text-right">
                                                  <MapPin className="h-3 w-3 text-muted-foreground/75" />
                                                  <span>{item.billboard.Nearest_Landmark}</span>
                                                </span>
                                              )}
                                            </div>
                                            
                                            <div className="flex items-center gap-3">
                                              {/* التكاليف */}
                                              <div className="flex items-center gap-2 text-sm flex-wrap">
                                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-700">
                                                   الشركة: {basicCompanyCost.toLocaleString('ar-LY')}
                                                </Badge>
                                                {item.company_additional_cost && item.company_additional_cost > 0 ? (
                                                  <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-700">
                                                     إضافي شركة: +{item.company_additional_cost.toLocaleString('ar-LY')}
                                                     {item.company_additional_cost_notes && (
                                                       <span className="mr-1 text-[10px]">({item.company_additional_cost_notes})</span>
                                                     )}
                                                  </Badge>
                                                ) : null}
                                                {((item.reinstall_count || 0) > 0) ? (
                                                  <>
                                                    <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/30 dark:text-blue-300 dark:border-blue-700">
                                                      الزبون (أصلي): {(item.customer_original_install_cost || 0).toLocaleString('ar-LY')}
                                                    </Badge>
                                                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-700">
                                                      الزبون (إعادة): {(item.customer_reinstall_cost || item.customer_installation_cost || 0).toLocaleString('ar-LY')}
                                                    </Badge>
                                                  </>
                                                ) : item.customer_installation_cost === 0 ? (
                                                  <Badge className="bg-purple-100 text-purple-755 border-none dark:bg-purple-950/50 dark:text-purple-300">
                                                    <Gift className="h-3 w-3 ml-1" />
                                                    مجاني
                                                  </Badge>
                                                ) : (
                                                  <Badge className="bg-primary/10 text-primary border-none">
                                                    الزبون: {item.customer_installation_cost.toLocaleString('ar-LY')}
                                                  </Badge>
                                                )}
                                                {item.additional_cost && item.additional_cost > 0 ? (
                                                  <Badge className="bg-orange-100 text-orange-700 border-none dark:bg-orange-950/50 dark:text-orange-300">
                                                    +{item.additional_cost.toLocaleString('ar-LY')}
                                                    {item.additional_cost_notes && (
                                                      <span className="mr-1 text-[10px]">({item.additional_cost_notes})</span>
                                                    )}
                                                  </Badge>
                                                ) : null}
                                              </div>

                                              {/* أزرار التحكم */}
                                              {!disabled && (
                                                <div className="flex items-center gap-1">
                                                  <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    className="h-7 w-7"
                                                    onClick={() => startEditingItem(item)}
                                                    title="تعديل"
                                                  >
                                                    <Pencil className="h-3 w-3" />
                                                  </Button>
                                                  {item.customer_installation_cost > 0 && (
                                                    <Button
                                                      size="icon"
                                                      variant="ghost"
                                                      className="h-7 w-7"
                                                      onClick={() => handleSetFree(item.id)}
                                                      disabled={distributing}
                                                      title="تحويل لمجاني"
                                                    >
                                                      <Gift className="h-3 w-3 text-purple-600" />
                                                    </Button>
                                                  )}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* زر تطبيق التسعير */}
              {pricingType === 'piece' && Object.values(quickPrices).some(p => p.normal > 0 || p.cutout > 0) && (
                <Button
                  onClick={handleApplyQuickPricing}
                  disabled={disabled || distributing}
                  className="w-full gap-2"
                >
                  <Check className="h-4 w-4" />
                  {distributing ? 'جاري التطبيق...' : 'تطبيق جميع الأسعار بالقطعة'}
                </Button>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Card>
    </Collapsible>
  );
}
