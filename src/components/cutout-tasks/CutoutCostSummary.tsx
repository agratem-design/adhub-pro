import { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Separator } from '@/components/ui/separator';
import { Switch } from '@/components/ui/switch';
import { 
  DollarSign, Calculator, ChevronDown, ChevronUp, 
  Check, Pencil, X, Save, Gift, Scissors, TrendingUp, Link2, Layers
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CutoutTaskItem {
  id: string;
  description: string | null;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  cutout_image_url: string | null;
  status: string;
  billboard_name?: string | null;
  billboard_size?: string | null;
  nearest_landmark?: string | null;
  district?: string | null;
  billboard_id?: number | null;
  face_type?: 'A' | 'B' | null;
}

// تجميع المجسمات حسب اللوحة
interface BillboardGroup {
  groupKey: string;
  billboard_id: number | null;
  billboard_name: string;
  billboard_size: string | null;
  nearest_landmark: string | null;
  district: string | null;
  faceA?: CutoutTaskItem;
  faceB?: CutoutTaskItem;
}

// تجميع حسب المقاس
interface SizeGroup {
  size: string;
  billboards: BillboardGroup[];
  totalQuantity: number;
  totalCost: number;
}

// نوع التعديل المعلق
interface PendingItemUpdate {
  id: string;
  quantity: number;
  customerPrice: number; // سعر الزبون للوحدة
  companyPrice: number;  // سعر الشركة للوحدة
}

interface CutoutCostSummaryProps {
  taskId: string;
  items: CutoutTaskItem[];
  customerTotalAmount: number;
  unitCost: number;
  totalCost: number;
  onRefresh: () => void;
}

export function CutoutCostSummary({ 
  taskId, 
  items, 
  customerTotalAmount,
  unitCost,
  totalCost,
  onRefresh 
}: CutoutCostSummaryProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [distributing, setDistributing] = useState(false);
  
  // حالة التسعير السريع
  const [quickCustomerPrice, setQuickCustomerPrice] = useState<number>(0);
  const [quickCompanyPrice, setQuickCompanyPrice] = useState<number>(0);
  
  // حالة المقاسات المفتوحة
  const [openSizes, setOpenSizes] = useState<Record<string, boolean>>({});
  
  // حالة تعديل المجموعة
  const [editingGroupKey, setEditingGroupKey] = useState<string | null>(null);
  const [useSamePrice, setUseSamePrice] = useState<Record<string, boolean>>({});
  const [groupEditValues, setGroupEditValues] = useState<{
    faceA: { quantity: number; customerPrice: number; companyPrice: number };
    faceB: { quantity: number; customerPrice: number; companyPrice: number };
  }>({
    faceA: { quantity: 0, customerPrice: 0, companyPrice: 0 },
    faceB: { quantity: 0, customerPrice: 0, companyPrice: 0 }
  });
  
  // حالة تسعير المقاس الموحد
  const [sizePricing, setSizePricing] = useState<Record<string, { customerPrice: number; companyPrice: number }>>({});
  
  // التعديلات المعلقة - يتم تجميعها ثم حفظها دفعة واحدة
  const [pendingUpdates, setPendingUpdates] = useState<Record<string, PendingItemUpdate>>({});
  
  // المقاسات التي تم تطبيق السعر الموحد عليها
  const [appliedSizes, setAppliedSizes] = useState<Set<string>>(new Set());

  // تجميع العناصر حسب اللوحة ثم حسب المقاس
  const sizeGroups = useMemo(() => {
    // أولاً: تجميع حسب اللوحة
    const billboardMap: Map<string, BillboardGroup> = new Map();
    
    items.forEach(item => {
      const billboardKey = item.billboard_id?.toString() || item.billboard_name || `item_${item.id}`;
      
      if (!billboardMap.has(billboardKey)) {
        billboardMap.set(billboardKey, {
          groupKey: billboardKey,
          billboard_id: item.billboard_id || null,
          billboard_name: item.billboard_name || item.description || 'لوحة',
          billboard_size: item.billboard_size || null,
          nearest_landmark: item.nearest_landmark || null,
          district: item.district || null
        });
      }
      
      const group = billboardMap.get(billboardKey)!;
      
      const faceType = item.face_type || 
        (item.description?.includes('B') || item.description?.includes('خلفي') ? 'B' : 'A');
      
      if (faceType === 'B') {
        group.faceB = item;
      } else {
        if (group.faceA) {
          group.faceB = item;
        } else {
          group.faceA = item;
        }
      }
    });
    
    // ثانياً: تجميع حسب المقاس
    const sizeMap: Map<string, SizeGroup> = new Map();
    
    billboardMap.forEach(billboard => {
      const size = billboard.billboard_size || 'غير محدد';
      
      if (!sizeMap.has(size)) {
        sizeMap.set(size, {
          size,
          billboards: [],
          totalQuantity: 0,
          totalCost: 0
        });
      }
      
      const sizeGroup = sizeMap.get(size)!;
      sizeGroup.billboards.push(billboard);
      
      if (billboard.faceA) {
        sizeGroup.totalQuantity += billboard.faceA.quantity;
        sizeGroup.totalCost += billboard.faceA.total_cost;
      }
      if (billboard.faceB) {
        sizeGroup.totalQuantity += billboard.faceB.quantity;
        sizeGroup.totalCost += billboard.faceB.total_cost;
      }
    });
    
    return Array.from(sizeMap.values());
  }, [items]);

  // حساب الإجماليات
  const totals = useMemo(() => {
    const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);
    const companyCost = items.reduce((sum, item) => sum + item.total_cost, 0);
    const profit = customerTotalAmount - totalCost;
    const profitPercentage = totalCost > 0 ? (profit / totalCost) * 100 : 0;
    
    return { totalQuantity, companyCost, profit, profitPercentage };
  }, [items, customerTotalAmount, totalCost]);

  // حساب إجمالي التعديلات المعلقة
  const pendingTotals = useMemo(() => {
    const pendingCount = Object.keys(pendingUpdates).length;
    if (pendingCount === 0) return null;
    
    let totalCustomer = 0;
    let totalCompany = 0;
    
    Object.values(pendingUpdates).forEach(update => {
      totalCustomer += update.quantity * update.customerPrice;
      totalCompany += update.quantity * update.companyPrice;
    });
    
    return { count: pendingCount, totalCustomer, totalCompany };
  }, [pendingUpdates]);

  // تبديل فتح/إغلاق مقاس
  const toggleSizeOpen = (size: string) => {
    setOpenSizes(prev => ({ ...prev, [size]: !prev[size] }));
  };

  // بدء تعديل مجموعة
  const startEditingGroup = (group: BillboardGroup) => {
    setEditingGroupKey(group.groupKey);
    
    const isSame = useSamePrice[group.groupKey] ?? true;
    
    // استخدام التعديلات المعلقة إن وجدت
    const pendingA = group.faceA ? pendingUpdates[group.faceA.id] : null;
    const pendingB = group.faceB ? pendingUpdates[group.faceB.id] : null;
    
    // حساب سعر الوحدة للزبون من الإجمالي / الكمية
    const faceACustomerUnitPrice = group.faceA && group.faceA.quantity > 0 
      ? group.faceA.total_cost / group.faceA.quantity 
      : group.faceA?.unit_cost ?? 0;
    const faceBCustomerUnitPrice = group.faceB && group.faceB.quantity > 0 
      ? group.faceB.total_cost / group.faceB.quantity 
      : group.faceB?.unit_cost ?? 0;
    
    setGroupEditValues({
      faceA: {
        quantity: pendingA?.quantity ?? group.faceA?.quantity ?? 0,
        customerPrice: pendingA?.customerPrice ?? faceACustomerUnitPrice,
        companyPrice: pendingA?.companyPrice ?? group.faceA?.unit_cost ?? 0
      },
      faceB: {
        quantity: pendingB?.quantity ?? group.faceB?.quantity ?? 0,
        customerPrice: isSame 
          ? (pendingA?.customerPrice ?? faceACustomerUnitPrice) 
          : (pendingB?.customerPrice ?? faceBCustomerUnitPrice),
        companyPrice: isSame 
          ? (pendingA?.companyPrice ?? group.faceA?.unit_cost ?? 0) 
          : (pendingB?.companyPrice ?? group.faceB?.unit_cost ?? 0)
      }
    });
  };

  // تبديل نفس السعر
  const toggleSamePrice = (groupKey: string, enabled: boolean) => {
    setUseSamePrice(prev => ({ ...prev, [groupKey]: enabled }));
    
    if (enabled) {
      setGroupEditValues(prev => ({
        ...prev,
        faceB: {
          ...prev.faceB,
          customerPrice: prev.faceA.customerPrice,
          companyPrice: prev.faceA.companyPrice
        }
      }));
    }
  };

  // حفظ تعديل المجموعة في التعديلات المعلقة
  const handleSaveGroupEdit = () => {
    if (!editingGroupKey) return;
    
    const group = sizeGroups.flatMap(s => s.billboards).find(g => g.groupKey === editingGroupKey);
    if (!group) return;
    
    const isSame = useSamePrice[editingGroupKey] ?? true;
    const newPending = { ...pendingUpdates };
    
    if (group.faceA) {
      newPending[group.faceA.id] = {
        id: group.faceA.id,
        quantity: groupEditValues.faceA.quantity,
        customerPrice: groupEditValues.faceA.customerPrice,
        companyPrice: groupEditValues.faceA.companyPrice
      };
    }
    
    if (group.faceB) {
      const facePrice = isSame ? groupEditValues.faceA : groupEditValues.faceB;
      newPending[group.faceB.id] = {
        id: group.faceB.id,
        quantity: groupEditValues.faceB.quantity,
        customerPrice: facePrice.customerPrice,
        companyPrice: facePrice.companyPrice
      };
    }
    
    setPendingUpdates(newPending);
    setEditingGroupKey(null);
    toast.success('تم حفظ التعديل مؤقتاً - اضغط "حفظ الكل" لتطبيق التغييرات');
  };

  // تطبيق سعر موحد لمقاس معين (حفظ مؤقت)
  const handleApplySizePricing = (size: string) => {
    const pricing = sizePricing[size];
    if (!pricing || (pricing.customerPrice <= 0 && pricing.companyPrice <= 0)) {
      toast.error('أدخل سعر واحد على الأقل');
      return;
    }

    const sizeGroup = sizeGroups.find(s => s.size === size);
    if (!sizeGroup) return;

    const newPending = { ...pendingUpdates };
    
    for (const billboard of sizeGroup.billboards) {
      if (billboard.faceA) {
        // حساب السعر الحالي للزبون من الإجمالي / الكمية
        const currentCustomerPrice = billboard.faceA.quantity > 0 
          ? billboard.faceA.total_cost / billboard.faceA.quantity 
          : billboard.faceA.unit_cost;
        
        newPending[billboard.faceA.id] = {
          id: billboard.faceA.id,
          quantity: billboard.faceA.quantity,
          customerPrice: pricing.customerPrice > 0 ? pricing.customerPrice : (pendingUpdates[billboard.faceA.id]?.customerPrice ?? currentCustomerPrice),
          companyPrice: pricing.companyPrice > 0 ? pricing.companyPrice : (pendingUpdates[billboard.faceA.id]?.companyPrice ?? billboard.faceA.unit_cost)
        };
      }
      
      if (billboard.faceB) {
        // حساب السعر الحالي للزبون من الإجمالي / الكمية
        const currentCustomerPrice = billboard.faceB.quantity > 0 
          ? billboard.faceB.total_cost / billboard.faceB.quantity 
          : billboard.faceB.unit_cost;
        
        newPending[billboard.faceB.id] = {
          id: billboard.faceB.id,
          quantity: billboard.faceB.quantity,
          customerPrice: pricing.customerPrice > 0 ? pricing.customerPrice : (pendingUpdates[billboard.faceB.id]?.customerPrice ?? currentCustomerPrice),
          companyPrice: pricing.companyPrice > 0 ? pricing.companyPrice : (pendingUpdates[billboard.faceB.id]?.companyPrice ?? billboard.faceB.unit_cost)
        };
      }
    }
    
    setPendingUpdates(newPending);
    setAppliedSizes(prev => new Set([...prev, size]));
    toast.success(`تم حفظ سعر مقاس ${size} مؤقتاً - اضغط "حفظ الكل" لتطبيق التغييرات`);
  };

  // حفظ جميع التعديلات المعلقة
  const handleSaveAllChanges = async () => {
    if (Object.keys(pendingUpdates).length === 0) {
      toast.info('لا توجد تعديلات معلقة');
      return;
    }

    setDistributing(true);
    try {
      // تحديث جميع العناصر المعلقة
      // unit_cost = سعر وحدة الشركة
      // total_cost = سعر الزبون الإجمالي (الكمية × سعر وحدة الزبون)
      for (const update of Object.values(pendingUpdates)) {
        const customerTotalCost = update.quantity * update.customerPrice;
        await supabase
          .from('cutout_task_items')
          .update({
            quantity: update.quantity,
            unit_cost: update.companyPrice,
            total_cost: customerTotalCost
          })
          .eq('id', update.id);
      }
      
      // حساب الإجماليات الجديدة
      const { data: allItems } = await supabase
        .from('cutout_task_items')
        .select('*')
        .eq('task_id', taskId);
      
      if (allItems) {
        // حساب إجمالي سعر الزبون وإجمالي تكلفة الشركة
        let newCustomerTotal = 0;
        let newCompanyTotal = 0;
        
        allItems.forEach(item => {
          const pending = pendingUpdates[item.id];
          if (pending) {
            // من التعديلات المعلقة
            newCustomerTotal += pending.quantity * pending.customerPrice;
            newCompanyTotal += pending.quantity * pending.companyPrice;
          } else {
            // للعناصر غير المعدلة:
            // total_cost = سعر الزبون الإجمالي
            // unit_cost * quantity = تكلفة الشركة الإجمالية
            newCustomerTotal += item.total_cost;
            newCompanyTotal += item.unit_cost * item.quantity;
          }
        });
        
        const newTotalQuantity = allItems.reduce((sum, item) => sum + item.quantity, 0);
        
        await supabase
          .from('cutout_tasks')
          .update({
            total_quantity: newTotalQuantity,
            total_cost: newCompanyTotal,
            customer_total_amount: newCustomerTotal
          })
          .eq('id', taskId);
        
        // تحديث composite_tasks إن وجدت
        const { data: compositeTask } = await supabase
          .from('composite_tasks')
          .select('id, customer_installation_cost, customer_print_cost, company_installation_cost, company_print_cost, discount_amount')
          .eq('cutout_task_id', taskId)
          .maybeSingle();

        if (compositeTask?.id) {
          const customerInstall = Number(compositeTask.customer_installation_cost) || 0;
          const customerPrint = Number(compositeTask.customer_print_cost) || 0;
          const companyInstall = Number(compositeTask.company_installation_cost) || 0;
          const companyPrint = Number(compositeTask.company_print_cost) || 0;
          const discountAmount = Number(compositeTask.discount_amount) || 0;

          const customerSubtotal = customerInstall + customerPrint + newCustomerTotal;
          const customerTotal = customerSubtotal - discountAmount;
          const companyTotal = companyInstall + companyPrint + newCompanyTotal;
          const netProfit = customerTotal - companyTotal;
          const profitPercentage = customerTotal > 0 ? (netProfit / customerTotal) * 100 : 0;

          await supabase
            .from('composite_tasks')
            .update({
              customer_cutout_cost: newCustomerTotal,
              company_cutout_cost: newCompanyTotal,
              customer_total: customerTotal,
              company_total: companyTotal,
              net_profit: netProfit,
              profit_percentage: profitPercentage,
              updated_at: new Date().toISOString()
            })
            .eq('id', compositeTask.id);
        }
      }
      
      toast.success('تم حفظ جميع التعديلات بنجاح');
      setPendingUpdates({});
      setAppliedSizes(new Set());
      setSizePricing({});
      onRefresh();
    } catch (error) {
      toast.error('فشل الحفظ');
    } finally {
      setDistributing(false);
    }
  };

  // إلغاء جميع التعديلات المعلقة
  const handleCancelAllChanges = () => {
    setPendingUpdates({});
    setAppliedSizes(new Set());
    setSizePricing({});
    toast.info('تم إلغاء جميع التعديلات');
  };

  // تطبيق التسعير السريع
  const handleApplyQuickPricing = async () => {
    if (quickCustomerPrice <= 0 && quickCompanyPrice <= 0) {
      toast.error('أدخل سعر واحد على الأقل');
      return;
    }

    setDistributing(true);
    try {
      // ملاحظة: في نظامنا
      // - unit_cost في cutout_task_items = سعر/وحدة للشركة
      // - total_cost في cutout_task_items = إجمالي سعر الزبون (quantity * customerUnitPrice)
      const newTotalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

      const resolvedCompanyUnit = quickCompanyPrice > 0 ? quickCompanyPrice : null;
      const resolvedCustomerUnit = quickCustomerPrice > 0 ? quickCustomerPrice : null;

      // تحديث العناصر: نحدث كل مسار (زبون/شركة) بشكل مستقل
      for (const item of items) {
        const currentCustomerUnit = item.quantity > 0 ? item.total_cost / item.quantity : 0;
        const nextCompanyUnit = resolvedCompanyUnit ?? item.unit_cost;
        const nextCustomerUnit = resolvedCustomerUnit ?? currentCustomerUnit;

        await supabase
          .from('cutout_task_items')
          .update({
            unit_cost: nextCompanyUnit,
            total_cost: item.quantity * nextCustomerUnit
          })
          .eq('id', item.id);
      }

      // تحديث ملخص المهمة
      const newCompanyTotal = items.reduce((sum, item) => {
        const companyUnit = resolvedCompanyUnit ?? item.unit_cost;
        return sum + item.quantity * companyUnit;
      }, 0);

      const newCustomerTotal = items.reduce((sum, item) => {
        const currentCustomerUnit = item.quantity > 0 ? item.total_cost / item.quantity : 0;
        const customerUnit = resolvedCustomerUnit ?? currentCustomerUnit;
        return sum + item.quantity * customerUnit;
      }, 0);
      
      await supabase
        .from('cutout_tasks')
        .update({
          unit_cost: resolvedCompanyUnit ?? unitCost,
          total_cost: newCompanyTotal,
          customer_total_amount: newCustomerTotal
        })
        .eq('id', taskId);
      
      const { data: compositeTask } = await supabase
        .from('composite_tasks')
        .select('id, customer_installation_cost, customer_print_cost, company_installation_cost, company_print_cost, discount_amount')
        .eq('cutout_task_id', taskId)
        .maybeSingle();

      if (compositeTask?.id) {
        const customerInstall = Number(compositeTask.customer_installation_cost) || 0;
        const customerPrint = Number(compositeTask.customer_print_cost) || 0;
        const companyInstall = Number(compositeTask.company_installation_cost) || 0;
        const companyPrint = Number(compositeTask.company_print_cost) || 0;
        const discountAmount = Number(compositeTask.discount_amount) || 0;

        const customerSubtotal = customerInstall + customerPrint + newCustomerTotal;
        const customerTotal = customerSubtotal - discountAmount;
        const companyTotal = companyInstall + companyPrint + newCompanyTotal;
        const netProfit = customerTotal - companyTotal;
        const profitPercentage = customerTotal > 0 ? (netProfit / customerTotal) * 100 : 0;

        await supabase
          .from('composite_tasks')
          .update({
            customer_cutout_cost: newCustomerTotal,
            company_cutout_cost: newCompanyTotal,
            customer_total: customerTotal,
            company_total: companyTotal,
            net_profit: netProfit,
            profit_percentage: profitPercentage,
            updated_at: new Date().toISOString()
          })
          .eq('id', compositeTask.id);
      }
      
      toast.success('تم تطبيق الأسعار');
      setQuickCustomerPrice(0);
      setQuickCompanyPrice(0);
      onRefresh();
    } catch (error) {
      toast.error('فشل في التطبيق');
    } finally {
      setDistributing(false);
    }
  };

  // تحويل لمجاني
  const handleSetFree = async () => {
    setDistributing(true);
    try {
      await supabase
        .from('cutout_tasks')
        .update({ customer_total_amount: 0 })
        .eq('id', taskId);
      
      toast.success('تم التحويل لمجاني');
      onRefresh();
    } catch (error) {
      toast.error('فشل التحويل');
    } finally {
      setDistributing(false);
    }
  };

  // الحصول على القيمة المعروضة (من التعديلات المعلقة أو الأصلية)
  const getDisplayValue = (item: CutoutTaskItem | undefined, field: 'quantity' | 'customerPrice' | 'companyPrice' | 'totalCost') => {
    if (!item) return 0;
    const pending = pendingUpdates[item.id];
    if (pending) {
      switch (field) {
        case 'quantity': return pending.quantity;
        case 'customerPrice': return pending.customerPrice;
        case 'companyPrice': return pending.companyPrice;
        case 'totalCost': return pending.quantity * pending.customerPrice;
      }
    }
    switch (field) {
      case 'quantity': return item.quantity;
      // total_cost = إجمالي سعر الزبون، لذا سعر الوحدة للزبون = total_cost / quantity
      case 'customerPrice': return item.quantity > 0 ? (item.total_cost / item.quantity) : 0;
      case 'companyPrice': return item.unit_cost;
      case 'totalCost': return item.total_cost;
    }
  };

  const profit = customerTotalAmount - totalCost;
  const hasPendingChanges = Object.keys(pendingUpdates).length > 0;

  return (
    <Card className="border-2 border-purple-200 dark:border-purple-800 shadow-lg">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <CollapsibleTrigger asChild>
          <CardHeader className="cursor-pointer hover:bg-muted/30 transition-colors pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2 text-purple-700 dark:text-purple-400">
                <Calculator className="h-5 w-5" />
                ملخص تكاليف المجسمات
              </CardTitle>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3 text-sm">
                  {hasPendingChanges && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-400 dark:border-amber-800 animate-pulse">
                      <Save className="h-3 w-3 ml-1" />
                      {Object.keys(pendingUpdates).length} تعديل معلق
                    </Badge>
                  )}
                  <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950 dark:text-blue-400 dark:border-blue-800">
                    <Layers className="h-3 w-3 ml-1" />
                    {sizeGroups.length} مقاس
                  </Badge>
                  <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950 dark:text-purple-400 dark:border-purple-800">
                    <Scissors className="h-3 w-3 ml-1" />
                    {totals.totalQuantity} قطعة
                  </Badge>
                  <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-400 dark:border-green-800">
                    <DollarSign className="h-3 w-3 ml-1" />
                    {customerTotalAmount.toLocaleString()} د.ل
                  </Badge>
                  <Badge variant="outline" className={`${profit >= 0 ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800' : 'bg-red-50 text-red-700 border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800'}`}>
                    <TrendingUp className="h-3 w-3 ml-1" />
                    {profit >= 0 ? '+' : ''}{profit.toLocaleString()} د.ل
                  </Badge>
                </div>
                {isOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
              </div>
            </div>
          </CardHeader>
        </CollapsibleTrigger>
        
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-4">
            {/* شريط التعديلات المعلقة */}
            {hasPendingChanges && (
              <div className="bg-amber-50 dark:bg-amber-950/30 border-2 border-amber-300 dark:border-amber-700 rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Save className="h-5 w-5 text-amber-600" />
                    <div>
                      <p className="font-medium text-amber-800 dark:text-amber-300">
                        يوجد {Object.keys(pendingUpdates).length} عنصر معدل
                      </p>
                      {pendingTotals && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          إجمالي الزبون: {pendingTotals.totalCustomer.toLocaleString()} د.ل | 
                          إجمالي الشركة: {pendingTotals.totalCompany.toLocaleString()} د.ل
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleCancelAllChanges}
                      className="border-amber-300 text-amber-700 hover:bg-amber-100"
                    >
                      <X className="h-4 w-4 ml-1" />
                      إلغاء الكل
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveAllChanges}
                      disabled={distributing}
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      <Save className="h-4 w-4 ml-1" />
                      حفظ الكل
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* إجماليات التكاليف */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-blue-50 dark:bg-blue-950/30 p-3 rounded-lg border border-blue-200 dark:border-blue-800">
                <span className="text-muted-foreground text-xs block mb-1">سعر الزبون</span>
                <span className="font-bold text-lg text-blue-600 dark:text-blue-400">
                  {customerTotalAmount.toLocaleString()} د.ل
                </span>
              </div>
              <div className="bg-orange-50 dark:bg-orange-950/30 p-3 rounded-lg border border-orange-200 dark:border-orange-800">
                <span className="text-muted-foreground text-xs block mb-1">سعر الوحدة</span>
                <span className="font-bold text-lg text-orange-600 dark:text-orange-400">
                  {unitCost.toLocaleString()} د.ل
                </span>
              </div>
              <div className="bg-red-50 dark:bg-red-950/30 p-3 rounded-lg border border-red-200 dark:border-red-800">
                <span className="text-muted-foreground text-xs block mb-1">تكلفة الشركة</span>
                <span className="font-bold text-lg text-red-600 dark:text-red-400">
                  {totalCost.toLocaleString()} د.ل
                </span>
              </div>
              <div className={`p-3 rounded-lg border ${profit >= 0 ? 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800' : 'bg-red-100 dark:bg-red-950/30 border-red-300 dark:border-red-800'}`}>
                <span className="text-muted-foreground text-xs block mb-1">الربح</span>
                <span className={`font-bold text-lg ${profit >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                  {profit >= 0 ? '+' : ''}{profit.toLocaleString()} د.ل
                </span>
              </div>
            </div>
            
            <Separator />
            
            {/* التسعير السريع العام */}
            <div className="space-y-3">
              <h4 className="font-medium text-sm flex items-center gap-2">
                <Calculator className="h-4 w-4 text-purple-600" />
                التسعير السريع (لجميع المجسمات)
              </h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <Label className="text-xs">سعر الزبون الإجمالي</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={quickCustomerPrice || ''}
                    onChange={(e) => setQuickCustomerPrice(Number(e.target.value) || 0)}
                    className="h-9"
                    min="0"
                  />
                </div>
                <div>
                  <Label className="text-xs">سعر الوحدة للشركة</Label>
                  <Input
                    type="number"
                    placeholder="0"
                    value={quickCompanyPrice || ''}
                    onChange={(e) => setQuickCompanyPrice(Number(e.target.value) || 0)}
                    className="h-9"
                    min="0"
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Button
                    size="sm"
                    onClick={handleApplyQuickPricing}
                    disabled={distributing || (quickCustomerPrice <= 0 && quickCompanyPrice <= 0)}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    <Check className="h-4 w-4 ml-1" />
                    تطبيق
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSetFree}
                    disabled={distributing}
                    className="border-pink-300 text-pink-600 hover:bg-pink-50"
                  >
                    <Gift className="h-4 w-4 ml-1" />
                    مجاني
                  </Button>
                </div>
              </div>
            </div>
            
            <Separator />
            
            {/* قائمة المقاسات المجمعة */}
            {sizeGroups.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm flex items-center gap-2">
                  <Layers className="h-4 w-4 text-purple-600" />
                  تفاصيل حسب المقاس ({sizeGroups.length} مقاس)
                </h4>
                
                <div className="space-y-3 max-h-[500px] overflow-y-auto">
                  {sizeGroups.map((sizeGroup) => {
                    const isSizeOpen = openSizes[sizeGroup.size] ?? false;
                    const currentSizePricing = sizePricing[sizeGroup.size] || { customerPrice: 0, companyPrice: 0 };
                    const isSizeApplied = appliedSizes.has(sizeGroup.size);
                    
                    return (
                      <div 
                        key={sizeGroup.size}
                        className={`border-2 rounded-lg overflow-hidden ${
                          isSizeApplied 
                            ? 'border-amber-300 dark:border-amber-700' 
                            : 'border-indigo-200 dark:border-indigo-800'
                        }`}
                      >
                        {/* رأس المقاس */}
                        <div 
                          className={`p-3 cursor-pointer transition-colors ${
                            isSizeApplied 
                              ? 'bg-amber-50 dark:bg-amber-950/30 hover:bg-amber-100 dark:hover:bg-amber-950/50' 
                              : 'bg-indigo-50 dark:bg-indigo-950/30 hover:bg-indigo-100 dark:hover:bg-indigo-950/50'
                          }`}
                          onClick={() => toggleSizeOpen(sizeGroup.size)}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm ${
                                isSizeApplied 
                                  ? 'bg-amber-200 dark:bg-amber-800 text-amber-700 dark:text-amber-300' 
                                  : 'bg-indigo-200 dark:bg-indigo-800 text-indigo-700 dark:text-indigo-300'
                              }`}>
                                <Layers className="h-5 w-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <p className={`font-bold ${
                                    isSizeApplied 
                                      ? 'text-amber-700 dark:text-amber-400' 
                                      : 'text-indigo-700 dark:text-indigo-400'
                                  }`}>
                                    {sizeGroup.size}
                                  </p>
                                  {isSizeApplied && (
                                    <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-300">
                                      تم التعديل
                                    </Badge>
                                  )}
                                </div>
                                <div className="flex gap-3 text-xs text-muted-foreground">
                                  <span>{sizeGroup.billboards.length} لوحة</span>
                                  <span>{sizeGroup.totalQuantity} قطعة</span>
                                  <span className="font-medium">{sizeGroup.totalCost.toLocaleString()} د.ل</span>
                                </div>
                              </div>
                            </div>
                            {isSizeOpen ? <ChevronUp className="h-5 w-5 text-indigo-600" /> : <ChevronDown className="h-5 w-5 text-indigo-600" />}
                          </div>
                        </div>
                        
                        {/* محتوى المقاس */}
                        {isSizeOpen && (
                          <div className="p-3 space-y-3 bg-white dark:bg-background">
                            {/* تسعير موحد للمقاس */}
                            <div className="bg-indigo-50/50 dark:bg-indigo-950/20 p-3 rounded-lg border border-indigo-200 dark:border-indigo-800">
                              <div className="flex flex-wrap items-center gap-3">
                                <span className="text-sm font-medium text-indigo-700 dark:text-indigo-400 flex items-center gap-1">
                                  <Layers className="h-4 w-4" />
                                  سعر موحد لمقاس {sizeGroup.size}:
                                </span>
                                
                                {/* سعر الزبون للوحدة */}
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs text-green-700 whitespace-nowrap">سعر الزبون/وحدة:</Label>
                                  <Input
                                    type="number"
                                    placeholder="0"
                                    value={currentSizePricing.customerPrice || ''}
                                    onChange={(e) => setSizePricing(prev => ({
                                      ...prev,
                                      [sizeGroup.size]: { 
                                        ...prev[sizeGroup.size], 
                                        customerPrice: Number(e.target.value) || 0 
                                      }
                                    }))}
                                    className="h-8 w-24 text-sm border-green-200"
                                    min="0"
                                  />
                                  <span className="text-xs text-muted-foreground">د.ل</span>
                                  <span className="text-xs text-muted-foreground">× {sizeGroup.totalQuantity}</span>
                                  {currentSizePricing.customerPrice > 0 && (
                                    <span className="text-xs text-green-600 font-medium">
                                      = {(currentSizePricing.customerPrice * sizeGroup.totalQuantity).toLocaleString('ar-LY')} د.ل
                                    </span>
                                  )}
                                </div>
                                
                                {/* سعر الشركة للوحدة */}
                                <div className="flex items-center gap-2">
                                  <Label className="text-xs text-blue-700 whitespace-nowrap">سعر الشركة/وحدة:</Label>
                                  <Input
                                    type="number"
                                    placeholder="0"
                                    value={currentSizePricing.companyPrice || ''}
                                    onChange={(e) => setSizePricing(prev => ({
                                      ...prev,
                                      [sizeGroup.size]: { 
                                        ...prev[sizeGroup.size], 
                                        companyPrice: Number(e.target.value) || 0 
                                      }
                                    }))}
                                    className="h-8 w-24 text-sm border-blue-200"
                                    min="0"
                                  />
                                  <span className="text-xs text-muted-foreground">د.ل</span>
                                  <span className="text-xs text-muted-foreground">× {sizeGroup.totalQuantity}</span>
                                  {currentSizePricing.companyPrice > 0 && (
                                    <span className="text-xs text-blue-600 font-medium">
                                      = {(currentSizePricing.companyPrice * sizeGroup.totalQuantity).toLocaleString('ar-LY')} د.ل
                                    </span>
                                  )}
                                </div>
                                
                                {/* زر الحفظ المؤقت */}
                                <Button
                                  size="sm"
                                  onClick={() => handleApplySizePricing(sizeGroup.size)}
                                  disabled={distributing || (currentSizePricing.customerPrice <= 0 && currentSizePricing.companyPrice <= 0)}
                                  className="bg-indigo-600 hover:bg-indigo-700 h-8 gap-1"
                                >
                                  <Check className="h-3 w-3" />
                                  حفظ مقاس {sizeGroup.size}
                                </Button>
                                
                                {/* عرض الربح المتوقع */}
                                {currentSizePricing.customerPrice > 0 && currentSizePricing.companyPrice > 0 && (
                                  <span className={`text-xs font-medium ${
                                    (currentSizePricing.customerPrice - currentSizePricing.companyPrice) >= 0 
                                      ? 'text-emerald-600' 
                                      : 'text-red-600'
                                  }`}>
                                    الربح: {((currentSizePricing.customerPrice - currentSizePricing.companyPrice) * sizeGroup.totalQuantity).toLocaleString('ar-LY')} د.ل
                                  </span>
                                )}
                              </div>
                            </div>
                            
                            {/* قائمة اللوحات في هذا المقاس */}
                            <div className="space-y-2">
                              {sizeGroup.billboards.map((group, index) => {
                                const isEditing = editingGroupKey === group.groupKey;
                                const isSame = useSamePrice[group.groupKey] ?? true;
                                const hasTwoFaces = group.faceA && group.faceB;
                                const hasItemPending = (group.faceA && pendingUpdates[group.faceA.id]) || 
                                                       (group.faceB && pendingUpdates[group.faceB.id]);
                                
                                return (
                                  <div 
                                    key={group.groupKey}
                                    className={`p-3 rounded-lg border transition-colors ${
                                      hasItemPending 
                                        ? 'bg-amber-50/50 dark:bg-amber-950/20 border-amber-300 dark:border-amber-700' 
                                        : 'bg-muted/30 border-border/50 hover:border-purple-300'
                                    }`}
                                  >
                                    {/* رأس اللوحة */}
                                    <div className="flex items-center justify-between mb-2">
                                      <div className="flex items-center gap-2">
                                        <div className={`w-6 h-6 rounded-full flex items-center justify-center font-bold text-xs ${
                                          hasItemPending 
                                            ? 'bg-amber-100 dark:bg-amber-900 text-amber-600 dark:text-amber-400' 
                                            : 'bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-400'
                                        }`}>
                                          {index + 1}
                                        </div>
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <p className="font-medium text-sm">{group.billboard_name}</p>
                                            {hasItemPending && (
                                              <Badge variant="outline" className="text-xs bg-amber-100 text-amber-700 border-amber-300">
                                                معدل
                                              </Badge>
                                            )}
                                          </div>
                                          {group.nearest_landmark && (
 <p className="text-xs text-muted-foreground">️ {group.nearest_landmark}</p>
                                          )}
                                          {(group as any).district && (
 <p className="text-xs text-muted-foreground"> {(group as any).district}</p>
                                          )}
                                        </div>
                                      </div>
                                      
                                      {!isEditing && (
                                        <Button 
                                          size="icon" 
                                          variant="ghost" 
                                          className="h-7 w-7"
                                          onClick={() => startEditingGroup(group)}
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                        </Button>
                                      )}
                                    </div>
                                    
                                    {isEditing ? (
                                      // وضع التعديل
                                      <div className="space-y-3">
                                        {hasTwoFaces && (
                                          <div className="flex items-center gap-3 p-2 bg-purple-50 dark:bg-purple-950/30 rounded-lg">
                                            <Switch
                                              checked={isSame}
                                              onCheckedChange={(checked) => toggleSamePrice(group.groupKey, checked)}
                                            />
                                            <Label className="text-sm flex items-center gap-2">
                                              <Link2 className="h-4 w-4" />
                                              نفس السعر للوجهين
                                            </Label>
                                          </div>
                                        )}
                                        
                                        {group.faceA && (
                                          <div className="space-y-2 p-2 bg-blue-50/50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
                                            <div className="flex items-center gap-2 text-xs font-medium text-blue-700 dark:text-blue-400">
                                              <span className="w-5 h-5 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-xs">A</span>
                                              الوجه الأمامي
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                              <div>
                                                <Label className="text-xs">الكمية</Label>
                                                <Input
                                                  type="number"
                                                  value={groupEditValues.faceA.quantity}
                                                  onChange={(e) => setGroupEditValues(v => ({
                                                    ...v,
                                                    faceA: { ...v.faceA, quantity: Number(e.target.value) || 0 }
                                                  }))}
                                                  className="h-7 text-sm"
                                                  min="0"
                                                />
                                              </div>
                                              <div>
                                                <Label className="text-xs text-green-700">سعر الزبون</Label>
                                                <Input
                                                  type="number"
                                                  value={groupEditValues.faceA.customerPrice}
                                                  onChange={(e) => {
                                                    const val = Number(e.target.value) || 0;
                                                    setGroupEditValues(v => ({
                                                      ...v,
                                                      faceA: { ...v.faceA, customerPrice: val },
                                                      ...(isSame ? { faceB: { ...v.faceB, customerPrice: val } } : {})
                                                    }));
                                                  }}
                                                  className="h-7 text-sm"
                                                  min="0"
                                                />
                                              </div>
                                              <div>
                                                <Label className="text-xs text-blue-700">سعر الشركة</Label>
                                                <Input
                                                  type="number"
                                                  value={groupEditValues.faceA.companyPrice}
                                                  onChange={(e) => {
                                                    const val = Number(e.target.value) || 0;
                                                    setGroupEditValues(v => ({
                                                      ...v,
                                                      faceA: { ...v.faceA, companyPrice: val },
                                                      ...(isSame ? { faceB: { ...v.faceB, companyPrice: val } } : {})
                                                    }));
                                                  }}
                                                  className="h-7 text-sm"
                                                  min="0"
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                        
                                        {group.faceB && (
                                          <div className={`space-y-2 p-2 rounded-lg border ${isSame ? 'bg-gray-50/50 dark:bg-gray-950/20 border-gray-200 dark:border-gray-800' : 'bg-orange-50/50 dark:bg-orange-950/20 border-orange-200 dark:border-orange-800'}`}>
                                            <div className="flex items-center gap-2 text-xs font-medium text-orange-700 dark:text-orange-400">
                                              <span className="w-5 h-5 rounded-full bg-orange-200 dark:bg-orange-800 flex items-center justify-center text-xs">B</span>
                                              الوجه الخلفي
                                              {isSame && <span className="text-xs text-muted-foreground">(نفس السعر)</span>}
                                            </div>
                                            <div className="grid grid-cols-3 gap-2">
                                              <div>
                                                <Label className="text-xs">الكمية</Label>
                                                <Input
                                                  type="number"
                                                  value={groupEditValues.faceB.quantity}
                                                  onChange={(e) => setGroupEditValues(v => ({
                                                    ...v,
                                                    faceB: { ...v.faceB, quantity: Number(e.target.value) || 0 }
                                                  }))}
                                                  className="h-7 text-sm"
                                                  min="0"
                                                />
                                              </div>
                                              <div>
                                                <Label className="text-xs text-green-700">سعر الزبون</Label>
                                                <Input
                                                  type="number"
                                                  value={isSame ? groupEditValues.faceA.customerPrice : groupEditValues.faceB.customerPrice}
                                                  onChange={(e) => setGroupEditValues(v => ({
                                                    ...v,
                                                    faceB: { ...v.faceB, customerPrice: Number(e.target.value) || 0 }
                                                  }))}
                                                  className="h-7 text-sm"
                                                  min="0"
                                                  disabled={isSame}
                                                />
                                              </div>
                                              <div>
                                                <Label className="text-xs text-blue-700">سعر الشركة</Label>
                                                <Input
                                                  type="number"
                                                  value={isSame ? groupEditValues.faceA.companyPrice : groupEditValues.faceB.companyPrice}
                                                  onChange={(e) => setGroupEditValues(v => ({
                                                    ...v,
                                                    faceB: { ...v.faceB, companyPrice: Number(e.target.value) || 0 }
                                                  }))}
                                                  className="h-7 text-sm"
                                                  min="0"
                                                  disabled={isSame}
                                                />
                                              </div>
                                            </div>
                                          </div>
                                        )}
                                        
                                        <div className="flex justify-end gap-2">
                                          <Button size="sm" variant="ghost" onClick={() => setEditingGroupKey(null)}>
                                            <X className="h-4 w-4 ml-1" />
                                            إلغاء
                                          </Button>
                                          <Button size="sm" onClick={handleSaveGroupEdit} disabled={distributing}>
                                            <Save className="h-4 w-4 ml-1" />
                                            حفظ
                                          </Button>
                                        </div>
                                      </div>
                                    ) : (
                                      // وضع العرض
                                      <div className="grid grid-cols-2 gap-2">
                                        {group.faceA && (
                                          <div className="flex items-center gap-2 p-2 bg-blue-50/50 dark:bg-blue-950/20 rounded">
                                            <span className="w-5 h-5 rounded-full bg-blue-200 dark:bg-blue-800 flex items-center justify-center text-xs font-bold text-blue-700 dark:text-blue-300">A</span>
                                            <div className="text-xs">
                                              <span className="text-muted-foreground">الكمية: {getDisplayValue(group.faceA, 'quantity')}</span>
                                              <span className="font-bold mr-2">{getDisplayValue(group.faceA, 'totalCost').toLocaleString()} د.ل</span>
                                            </div>
                                          </div>
                                        )}
                                        
                                        {group.faceB && (
                                          <div className="flex items-center gap-2 p-2 bg-orange-50/50 dark:bg-orange-950/20 rounded">
                                            <span className="w-5 h-5 rounded-full bg-orange-200 dark:bg-orange-800 flex items-center justify-center text-xs font-bold text-orange-700 dark:text-orange-300">B</span>
                                            <div className="text-xs">
                                              <span className="text-muted-foreground">الكمية: {getDisplayValue(group.faceB, 'quantity')}</span>
                                              <span className="font-bold mr-2">{getDisplayValue(group.faceB, 'totalCost').toLocaleString()} د.ل</span>
                                            </div>
                                          </div>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
