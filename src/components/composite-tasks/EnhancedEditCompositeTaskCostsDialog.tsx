import React, { useState, useEffect, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CompositeTaskWithDetails, UpdateCompositeTaskCostsInput } from '@/types/composite-task';
import { 
  Wrench, Printer, Scissors, DollarSign, Package, 
  TrendingUp, TrendingDown, Calculator, Ruler, ChevronDown, ChevronUp, 
  Building2, Landmark, LayoutGrid, Check, Square, Zap, Gift, Pencil, X, Save,
  Loader2, AlertCircle, AlertTriangle, CheckCircle2
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CostAllocationSection, CostAllocationData, createDefaultCostAllocation } from './CostAllocationSection';
import { CutoutPerBillboardEditor } from './CutoutPerBillboardEditor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';

interface EnhancedEditCompositeTaskCostsDialogProps {
  task: CompositeTaskWithDetails | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: UpdateCompositeTaskCostsInput) => void;
  isSaving?: boolean;
}

interface SizeData {
  id: number;
  name: string;
  width: number | null;
  height: number | null;
  installation_price: number | null;
}

interface TaskItem {
  id: string;
  billboard_id: number;
  customer_installation_cost: number;
  company_installation_cost: number | null;
  has_cutout?: boolean;
  additional_cost?: number;
  additional_cost_notes?: string | null;
  company_additional_cost?: number;
  company_additional_cost_notes?: string | null;
  pricing_type?: 'piece' | 'meter';
  price_per_meter?: number;
  faces_to_install?: number;
  cutout_workshop_id?: string | null;
  cutout_company_cost?: number | null;
  cutout_customer_cost?: number | null;
  cutout_count?: number | null;
  cutout_image_url?: string | null;
  cutout_notes?: string | null;
}

interface PrinterOption { id: string; name: string; }

interface CutoutItem {
  id: string;
  billboard_id: number;
  quantity: number;
  unit_cost: number;
  total_cost: number;
  description?: string | null;
  notes?: string | null;
}

interface Billboard {
  ID: number;
  Size: string;
  Faces_Count?: number;
  Billboard_Name?: string;
  billboard_type?: string;
  Nearest_Landmark?: string;
  Image_URL?: string;
}

const BILLBOARD_TYPE_ICONS: Record<string, any> = {
  'تيبول': Landmark,
  'برجية': Building2,
  'عادية': LayoutGrid,
};

function calculateAreaFromSizeData(sizeName: string, sizesMap: Record<string, SizeData>): number {
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

// ════════════ Reusable Inline Price Input with Controls ════════════
const InlinePriceInput = ({ value, onChange, label, step = 1, showLabel = true, className }: {
  value: number;
  onChange: (val: number) => void;
  label: string;
  step?: number;
  showLabel?: boolean;
  className?: string;
}) => (
  <div dir="rtl" className={cn("flex items-center justify-start gap-3 bg-background border border-border/15 rounded-xl p-1.5 shadow-sm shrink-0 min-w-0 transition-all focus-within:border-primary/30 text-right", className)}>
    {showLabel && <span className="text-sm font-semibold text-muted-foreground/80 px-2 shrink-0 text-right whitespace-nowrap">{label}</span>}
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="h-9 w-9 hover:bg-muted text-lg font-bold shrink-0 p-0 rounded-lg text-muted-foreground hover:text-foreground cursor-pointer"
      onClick={() => onChange(value + step)}
      aria-label="زيادة"
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
    >
      −
    </Button>
  </div>
);

// ════════════ Dashboard Stat Card (legacy — kept for in-tab tiles) ════════════
const StatCard = ({ label, value, icon: Icon, colorClass, borderClass, iconClass, suffix }: {
  label: string; value: string | number; icon: any; colorClass: string; borderClass: string; iconClass: string; suffix?: string;
}) => (
  <div dir="rtl" className={cn("flex items-center justify-between p-5 rounded-2xl border bg-card/85 backdrop-blur-md transition-all duration-300 hover:scale-[1.01] shadow-sm text-right", borderClass)}>
    <div className="space-y-1.5 min-w-0 pl-2 pr-1 text-right">
      <div className="text-[13px] font-semibold text-muted-foreground/90 leading-relaxed truncate">{label}</div>
      <div className={cn("text-lg sm:text-xl font-bold font-mono leading-normal truncate", colorClass)}>
        {typeof value === 'number' ? value.toLocaleString('ar-LY') : value}
        {suffix && <span className="text-[13px] font-semibold text-muted-foreground/60 mr-1">{suffix}</span>}
      </div>
    </div>
    <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0 shadow-inner", iconClass)}>
      <Icon className="h-5 w-5" />
    </div>
  </div>
);

// ════════════ Compact Header KPI ════════════
const HeaderKpi = ({ label, value, suffix, valueClass, divider }: {
  label: string; value: string | number; suffix?: string; valueClass?: string; divider?: boolean;
}) => (
  <div dir="rtl" className={cn("flex-1 min-w-0 px-5 py-2.5 relative text-right", divider && "border-r border-border/15")}>
    <div className="text-[11px] sm:text-xs font-semibold text-muted-foreground/80 uppercase tracking-wide leading-tight truncate text-right">{label}</div>
    <div className={cn("mt-1 text-lg sm:text-2xl font-black font-mono leading-tight truncate", valueClass || "text-foreground")}>
      {typeof value === 'number' ? value.toLocaleString('ar-LY') : value}
      {suffix && <span className="text-[11px] sm:text-xs font-semibold text-muted-foreground/60 mr-1">{suffix}</span>}
    </div>
  </div>
);

// ════════════ Price Input with Controls (Large cards) ════════════
const PriceInputWithControls = ({ value, onChange, label, totalLabel, totalValue, colorClass, step = 1 }: {
  value: number;
  onChange: (val: number) => void;
  label: string;
  totalLabel: string;
  totalValue: number;
  colorClass: string;
  step?: number;
}) => (
  <div dir="rtl" className="space-y-2.5 text-right">
    <Label className="text-sm font-semibold block text-foreground/80 leading-relaxed text-right">{label}</Label>
    <div dir="rtl" className="flex items-center bg-background border border-border/15 rounded-xl overflow-hidden shadow-sm focus-within:ring-2 focus-within:ring-primary/20 transition-all duration-300">
      <Button
        type="button"
        variant="ghost"
        className="h-11 px-4 hover:bg-muted text-lg font-bold shrink-0 rounded-none border-l border-border/15 cursor-pointer"
        onClick={() => onChange(value + step)}
        aria-label="زيادة"
      >
        +
      </Button>
      <div dir="ltr" className="flex-1 flex items-center justify-center gap-3 px-4 bg-muted/20 min-w-0">
        <Input
          type="number"
          inputMode="numeric"
          value={value}
          onChange={e => onChange(Number(e.target.value) || 0)}
          className={cn("h-12 w-full min-w-0 text-center border-0 bg-transparent focus-visible:ring-0 focus-visible:ring-offset-0 font-bold font-mono text-lg px-2", colorClass)}
        />
        <span className="text-xs sm:text-sm font-semibold text-muted-foreground/70 pointer-events-none shrink-0 whitespace-nowrap">د.ل / م²</span>
      </div>
      <Button
        type="button"
        variant="ghost"
        className="h-11 px-4 hover:bg-muted text-lg font-bold shrink-0 rounded-none border-r border-border/15 cursor-pointer"
        onClick={() => onChange(Math.max(0, value - step))}
        aria-label="نقصان"
      >
        −
      </Button>
    </div>
    <div dir="rtl" className={cn("text-sm sm:text-base font-semibold p-5 rounded-xl bg-card border border-border/10 flex justify-between items-center gap-3 font-mono leading-relaxed text-right", colorClass)}>
      <span className="text-muted-foreground font-sans text-sm sm:text-base">{totalLabel}</span>
      <span className="text-base sm:text-lg font-bold">{totalValue.toLocaleString('ar-LY')} د.ل</span>
    </div>
  </div>
);

export const EnhancedEditCompositeTaskCostsDialog: React.FC<EnhancedEditCompositeTaskCostsDialogProps> = ({
  task,
  open,
  onOpenChange,
  onSave,
  isSaving = false
}) => {
  // DB states
  const [taskItems, setTaskItems] = useState<TaskItem[]>([]);
  const hasCutoutBillboards = useMemo(() => taskItems.some(i => i.has_cutout), [taskItems]);
  const [billboards, setBillboards] = useState<Record<number, Billboard>>({});
  const [sizesMap, setSizesMap] = useState<Record<string, SizeData>>({});
  const [installationPrices, setInstallationPrices] = useState<Record<number, number>>({});
  const [pricingType, setPricingType] = useState<'piece' | 'meter'>('piece');
  
  // Quick prices
  const [quickPrices, setQuickPrices] = useState<Record<string, { normal: number; cutout: number }>>({});
  const [meterPrices, setMeterPrices] = useState<Record<string, { normal: number; cutout: number }>>({});
  const [typeMeterPrices, setTypeMeterPrices] = useState<Record<string, { normal: number; cutout: number }>>({});
  
  // Collapsible states
  const [collapsedSizes, setCollapsedSizes] = useState<Set<string>>(new Set());
  const [collapsedTypes, setCollapsedTypes] = useState<Set<string>>(new Set());
  
  // Edit items
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{
    companyCost: number; customerCost: number; additionalCost: number;
    additionalNotes: string; companyAdditionalCost: number; companyAdditionalNotes: string;
    hasCutout: boolean;
    hasPrint: boolean;
    customerOriginalInstallCost: number;
    customerReinstallCost: number;
  }>({ 
    companyCost: 0, 
    customerCost: 0, 
    additionalCost: 0, 
    additionalNotes: '', 
    companyAdditionalCost: 0, 
    companyAdditionalNotes: '', 
    hasCutout: false,
    hasPrint: false,
    customerOriginalInstallCost: 0,
    customerReinstallCost: 0
  });
  
  const [customCompanyCosts, setCustomCompanyCosts] = useState<Record<string, number>>({});
  
  // Print details
  const [printBillboardIds, setPrintBillboardIds] = useState<number[]>([]);
  const [totalPrintArea, setTotalPrintArea] = useState(0);
  const [customerPrintPerMeter, setCustomerPrintPerMeter] = useState(0);
  const [companyPrintPerMeter, setCompanyPrintPerMeter] = useState(0);
  
  // Cutout items
  const [cutoutItems, setCutoutItems] = useState<CutoutItem[]>([]);
  const [cutoutBillboards, setCutoutBillboards] = useState<Record<number, Billboard>>({});
  
  // Discounts and general values
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [notes, setNotes] = useState('');
  
  // Cost allocation
  const [costAllocation, setCostAllocation] = useState<CostAllocationData>(createDefaultCostAllocation());
  const [printers, setPrinters] = useState<PrinterOption[]>([]);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(null);
  const [designImagesByBillboard, setDesignImagesByBillboard] = useState<Record<number, string>>({});
  
  const [loading, setLoading] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [activeTab, setActiveTab] = useState('summary');

  // Service switches (Smart toggles)
  const [isInstallationActive, setIsInstallationActive] = useState<boolean>(true);
  const [isPrintActive, setIsPrintActive] = useState<boolean>(false);
  const [isCutoutActive, setIsCutoutActive] = useState<boolean>(false);

  // Manual inputs
  const [manualCustomerInstallationCost, setManualCustomerInstallationCost] = useState<number>(0);
  const [manualCompanyInstallationCost, setManualCompanyInstallationCost] = useState<number>(0);
  const [manualCustomerPrintCost, setManualCustomerPrintCost] = useState<number>(0);
  const [manualCompanyPrintCost, setManualCompanyPrintCost] = useState<number>(0);
  const [manualCustomerCutoutCost, setManualCustomerCutoutCost] = useState<number>(0);
  const [manualCompanyCutoutCost, setManualCompanyCutoutCost] = useState<number>(0);

  // Initialize values when dialog opens
  useEffect(() => {
    if (task && open) {
      setIsInstallationActive(!!task.installation_task_id || (task.customer_installation_cost || 0) > 0 || (task.company_installation_cost || 0) > 0);
      setIsPrintActive(!!task.print_task_id || (task.customer_print_cost || 0) > 0 || (task.company_print_cost || 0) > 0);
      setIsCutoutActive(!!task.cutout_task_id);

      setManualCustomerInstallationCost(task.customer_installation_cost || 0);
      setManualCompanyInstallationCost(task.company_installation_cost || 0);
      setManualCustomerPrintCost(task.customer_print_cost || 0);
      setManualCompanyPrintCost(task.company_print_cost || 0);
      setManualCustomerCutoutCost(task.customer_cutout_cost || 0);
      setManualCompanyCutoutCost(task.company_cutout_cost || 0);

      loadAllData();
    }
  }, [task, open]);

  // Handle smart defaults for active tabs
  useEffect(() => {
    if (!task || !open || loading) return;
    const hasInstallTab = isInstallationActive;
    const hasPrintTab = isPrintActive;
    const hasCutoutTab = isCutoutActive;

    if (hasInstallTab) setActiveTab('installation');
    else if (hasPrintTab) setActiveTab('print');
    else if (hasCutoutTab) setActiveTab('cutout');
    else setActiveTab('summary');
  }, [loading, task, open, isInstallationActive, isPrintActive, isCutoutActive]);

  // Recalculate print area reactively when printBillboardIds or billboards change
  useEffect(() => {
    if (!task?.print_task_id) return;
    let areaSum = 0;
    const uniquePrintBillboardIds = Array.from(new Set(printBillboardIds));
    uniquePrintBillboardIds.forEach(bbId => {
      const item = taskItems.find(i => i.billboard_id === bbId);
      if (!item) return; // Skip if this billboard is not part of this team's installation task

      const billboard = billboards[bbId];
      if (billboard) {
        const sizeName = billboard.Size || 'غير محدد';
        const area = calculateAreaFromSizeData(sizeName, sizesMap);
        const faces = item.faces_to_install || billboard.Faces_Count || 2;
        areaSum += area * faces;
      }
    });
    setTotalPrintArea(areaSum);
  }, [printBillboardIds, taskItems, billboards, sizesMap, task?.print_task_id]);

  // Load all DB elements
  const loadAllData = async () => {
    if (!task) return;
    setLoading(true);
    let hasAnyCutoutBillboard = false;
    let hasAnyCutoutItem = false;
    try {
      const { data: sizesData } = await supabase.from('sizes').select('id, name, width, height, installation_price');
      if (sizesData) {
        const map: Record<string, SizeData> = {};
        sizesData.forEach((s: any) => { map[s.name] = s; map[s.name.toLowerCase()] = s; });
        setSizesMap(map);
      }

      if (task.installation_task_id) {
        const { data: installItems } = await (supabase
          .from('installation_task_items') as any)
          .select('id, billboard_id, customer_installation_cost, company_installation_cost, has_cutout, additional_cost, additional_cost_notes, company_additional_cost, company_additional_cost_notes, pricing_type, price_per_meter, faces_to_install, reinstall_count, customer_original_install_cost, customer_reinstall_cost, cutout_workshop_id, cutout_company_cost, cutout_customer_cost, cutout_count, cutout_image_url, cutout_notes')
          .eq('task_id', task.installation_task_id);
        
        if (installItems?.length) {
          setTaskItems(installItems as TaskItem[]);
          hasAnyCutoutBillboard = installItems.some(i => i.has_cutout);
          const savedCompanyCosts: Record<string, number> = {};
          const billboardIds = installItems.map(i => i.billboard_id);
          const { data: billboardsDataForCosts } = await supabase
            .from('billboards').select('"ID", "Size", "Faces_Count"').in('ID', billboardIds);
          
          installItems.forEach(item => {
            if (item.company_installation_cost !== null && item.company_installation_cost !== undefined) {
              savedCompanyCosts[item.id] = item.company_installation_cost;
            } else {
              const bb = billboardsDataForCosts?.find((b: any) => b.ID === item.billboard_id);
              if (bb) {
                const sizeInfo = sizesData?.find(s => s.name === bb.Size);
                const basePrice = sizeInfo?.installation_price || 0;
                const totalReinstalledFaces = (item as any).total_reinstalled_faces || 0;
                let calculatedCost = basePrice;
                if (totalReinstalledFaces > 0) {
                  calculatedCost = basePrice * (totalReinstalledFaces * 0.5);
                }
                if (calculatedCost > 0) savedCompanyCosts[item.id] = calculatedCost;
              }
            }
          });
          setCustomCompanyCosts(savedCompanyCosts);
          
          const hasMeterPricing = installItems.some(item => item.pricing_type === 'meter');
          if (hasMeterPricing) setPricingType('meter');
          
          const { data: billboardsData } = await supabase
            .from('billboards')
            .select('"ID", "Size", "Faces_Count", "Billboard_Name", "billboard_type", "Nearest_Landmark", "Image_URL"')
            .in('ID', billboardIds);
          
          if (billboardsData) {
            const billboardMap: Record<number, Billboard> = {};
            const pricesMap: Record<number, number> = {};
            billboardsData.forEach((b: any) => {
              billboardMap[b.ID] = b;
              const sizeInfo = sizesData?.find(s => s.name === b.Size);
              const basePrice = sizeInfo?.installation_price || 0;
              const itemForBillboard = installItems?.find(i => i.billboard_id === b.ID);
              const totalReinstalledFaces = (itemForBillboard as any)?.total_reinstalled_faces || 0;
              let itemPrice = basePrice;
              if (totalReinstalledFaces > 0) {
                itemPrice = basePrice * (totalReinstalledFaces * 0.5);
              }
              pricesMap[b.ID] = itemPrice;
            });
            setBillboards(billboardMap);
            setInstallationPrices(pricesMap);
          }
          
          const allSizeKeys = new Set<string>();
          installItems.forEach(item => {
            const billboard = billboardsData?.find(b => b.ID === item.billboard_id);
            const billboardType = billboard?.billboard_type || 'عادية';
            const sizeName = billboard?.Size || 'غير محدد';
            allSizeKeys.add(`${billboardType}-${sizeName}`);
          });
          setCollapsedSizes(allSizeKeys);
        }
      }

      if (task.print_task_id) {
        const { data: printTaskData } = await supabase
          .from('print_tasks').select('total_area, total_cost, price_per_meter, customer_price_per_meter')
          .eq('id', task.print_task_id).single();
        if (printTaskData) {
          const area = printTaskData.total_area || 0;
          setTotalPrintArea(area);
          if (area > 0) {
            const storedCustomerPerMeter = (printTaskData as any).customer_price_per_meter || 0;
            setCustomerPrintPerMeter(storedCustomerPerMeter > 0 ? storedCustomerPerMeter : (task.customer_print_cost || 0) / area);
            const actualCompanyPerMeter = printTaskData.price_per_meter || (printTaskData.total_cost ? printTaskData.total_cost / area : 0);
            setCompanyPrintPerMeter(actualCompanyPerMeter);
          }
        }
        const { data: ptItems } = await supabase
          .from('print_task_items')
          .select('billboard_id, design_face_a, design_face_b')
          .eq('task_id', task.print_task_id);
        if (ptItems) {
          setPrintBillboardIds(Array.from(new Set((ptItems as any[]).map(r => r.billboard_id).filter(Boolean))));
          const m: Record<number, string> = {};
          (ptItems as any[]).forEach(r => {
            const img = r.design_face_a || r.design_face_b;
            if (img && !m[r.billboard_id]) m[r.billboard_id] = img;
          });
          setDesignImagesByBillboard(m);
        }
      }

      if (task.cutout_task_id) {
        const { data: cutoutItemsData } = await supabase
          .from('cutout_task_items')
          .select('id, billboard_id, quantity, unit_cost, total_cost, description, notes')
          .eq('task_id', task.cutout_task_id);
        if (cutoutItemsData?.length) {
          hasAnyCutoutItem = true;
          setCutoutItems(cutoutItemsData as unknown as CutoutItem[]);
          const cutoutBillboardIds = (cutoutItemsData as any[]).map(i => i.billboard_id).filter(Boolean);
          if (cutoutBillboardIds.length > 0) {
            const { data: cutoutBillboardsDataResult } = await supabase
              .from('billboards')
              .select('"ID", "Size", "Faces_Count", "Billboard_Name", "billboard_type", "Nearest_Landmark", "Image_URL"')
              .in('ID', cutoutBillboardIds);
            if (cutoutBillboardsDataResult) {
              const cutoutBillboardMap: Record<number, Billboard> = {};
              cutoutBillboardsDataResult.forEach((b: any) => { cutoutBillboardMap[b.ID] = b; });
              setCutoutBillboards(cutoutBillboardMap);
            }
          }
        }
      }

      setDiscountAmount(task.discount_amount || 0);
      setDiscountReason(task.discount_reason || '');
      setNotes(task.notes || '');
      const savedAllocation = (task as any).cost_allocation;
      if (savedAllocation) {
        setCostAllocation({ ...createDefaultCostAllocation(), ...savedAllocation });
      } else {
        setCostAllocation(createDefaultCostAllocation());
      }

      const { data: printersList } = await supabase
        .from('printers').select('id, name').eq('is_active', true).order('name');
      if (printersList) setPrinters(printersList as any);
      if (task.print_task_id) {
        const { data: ptRow } = await supabase
          .from('print_tasks').select('printer_id').eq('id', task.print_task_id).single();
        if (ptRow) setSelectedPrinterId((ptRow as any).printer_id || null);
      }

      // Automatically override cutout active state if no cutouts are configured on the billboards or tasks
      setIsCutoutActive(!!task.cutout_task_id || hasAnyCutoutBillboard || hasAnyCutoutItem);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Memoized computations
  const { totals, groupedData } = useMemo(() => {
    let companyCost = 0, customerCost = 0, additionalCost = 0, totalArea = 0;
    const grouped: Record<string, {
      type: string;
      sizes: Record<string, {
        size: string;
        items: Array<TaskItem & { billboard: Billboard; area: number }>;
        normalCount: number; cutoutCount: number; totalArea: number;
        companyCost: number; customerCost: number; avgAreaPerItem: number;
      }>;
      totalItems: number; totalArea: number; companyCost: number; customerCost: number;
    }> = {};

    taskItems.forEach(item => {
      const billboard = billboards[item.billboard_id];
      const billboardType = billboard?.billboard_type || 'عادية';
      const sizeName = billboard?.Size || 'غير محدد';
      const area = calculateAreaFromSizeData(sizeName, sizesMap);
      const faces = item.faces_to_install || billboard?.Faces_Count || 2;
      const itemArea = area * faces;
      const itemCompanyCost = customCompanyCosts[item.id] ?? installationPrices[item.billboard_id] ?? 0;
      const itemCompanyAdditional = item.company_additional_cost || 0;
      const isReinstalled = (item.reinstall_count || 0) > 0;
      const itemCustomerCost = isReinstalled
        ? (item.customer_original_install_cost || 0) + (item.customer_reinstall_cost || item.customer_installation_cost || 0)
        : (item.customer_installation_cost || 0);

      companyCost += itemCompanyCost + itemCompanyAdditional;
      customerCost += itemCustomerCost;
      additionalCost += item.additional_cost || 0;
      totalArea += itemArea;

      if (!grouped[billboardType]) {
        grouped[billboardType] = { type: billboardType, sizes: {}, totalItems: 0, totalArea: 0, companyCost: 0, customerCost: 0 };
      }
      if (!grouped[billboardType].sizes[sizeName]) {
        grouped[billboardType].sizes[sizeName] = { size: sizeName, items: [], normalCount: 0, cutoutCount: 0, totalArea: 0, companyCost: 0, customerCost: 0, avgAreaPerItem: 0 };
      }

      grouped[billboardType].sizes[sizeName].items.push({ ...item, billboard: billboard || { ID: item.billboard_id, Size: sizeName }, area: itemArea });
      grouped[billboardType].sizes[sizeName].totalArea += itemArea;
      grouped[billboardType].sizes[sizeName].companyCost += itemCompanyCost + itemCompanyAdditional;
      grouped[billboardType].sizes[sizeName].customerCost += itemCustomerCost;
      if (item.has_cutout) grouped[billboardType].sizes[sizeName].cutoutCount++;
      else grouped[billboardType].sizes[sizeName].normalCount++;
      grouped[billboardType].totalItems++;
      grouped[billboardType].totalArea += itemArea;
      grouped[billboardType].companyCost += itemCompanyCost + itemCompanyAdditional;
      grouped[billboardType].customerCost += itemCustomerCost;
    });

    Object.values(grouped).forEach(typeData => {
      Object.values(typeData.sizes).forEach(sizeData => {
        sizeData.avgAreaPerItem = sizeData.items.length > 0 ? sizeData.totalArea / sizeData.items.length : 0;
      });
    });

    return { totals: { companyCost, customerCost, additionalCost, totalArea, profit: customerCost - companyCost }, groupedData: grouped };
  }, [taskItems, installationPrices, billboards, sizesMap, customCompanyCosts]);

  // Derived cutout totals
  const { customerCutoutTotal: derivedCustomerCutoutTotal, companyCutoutTotal: derivedCompanyCutoutTotal, totalCutouts } = useMemo(() => {
    let customer = 0, company = 0, count = 0;
    taskItems.forEach((item) => {
      if (!item.has_cutout) return;
      const c = Number(item.cutout_count) || 1;
      count += c;
      company += (Number(item.cutout_company_cost) || 0) * c;
      customer += (Number(item.cutout_customer_cost) || 0) * c;
    });
    if (customer === 0 && company === 0 && count === 0 && cutoutItems.length > 0) {
      cutoutItems.forEach(item => {
        const itemCustomerCost = (item.total_cost ?? (item.unit_cost * item.quantity)) || 0;
        const itemCompanyCost = (item.unit_cost * item.quantity) || 0;
        customer += itemCustomerCost;
        company += itemCompanyCost;
        count += item.quantity;
      });
    }
    return { customerCutoutTotal: customer, companyCutoutTotal: company, totalCutouts: count };
  }, [taskItems, cutoutItems]);

  const customerInstallationTotal = isInstallationActive
    ? (task?.installation_task_id ? totals.customerCost : manualCustomerInstallationCost)
    : 0;
  const companyInstallationTotal = isInstallationActive
    ? (task?.installation_task_id ? totals.companyCost : manualCompanyInstallationCost)
    : 0;

  const customerPrintTotal = isPrintActive
    ? (task?.print_task_id && totalPrintArea > 0 ? (customerPrintPerMeter * totalPrintArea) : manualCustomerPrintCost)
    : 0;
  const companyPrintTotal = isPrintActive
    ? (task?.print_task_id && totalPrintArea > 0 ? (companyPrintPerMeter * totalPrintArea) : manualCompanyPrintCost)
    : 0;

  const customerCutoutTotal = isCutoutActive
    ? (task?.cutout_task_id || taskItems.some(i => i.has_cutout) ? derivedCustomerCutoutTotal : manualCustomerCutoutCost)
    : 0;
  const companyCutoutTotal = isCutoutActive
    ? (task?.cutout_task_id || taskItems.some(i => i.has_cutout) ? derivedCompanyCutoutTotal : manualCompanyCutoutCost)
    : 0;

  const customerSubtotal = customerInstallationTotal + customerPrintTotal + customerCutoutTotal;
  const customerTotal = customerSubtotal - discountAmount;
  const companyTotal = companyInstallationTotal + companyPrintTotal + companyCutoutTotal;
  const netProfit = customerTotal - companyTotal;
  const profitPercentage = customerTotal > 0 ? (netProfit / customerTotal) * 100 : 0;

  // Single Item Handlers
  const startEditingItem = (item: TaskItem & { billboard: Billboard; area: number }) => {
    setEditingItemId(item.id);
    const existingCompanyCost = customCompanyCosts[item.id] ?? installationPrices[item.billboard_id] ?? 0;
    setEditValues({
      companyCost: existingCompanyCost, 
      customerCost: item.customer_installation_cost || 0,
      customerOriginalInstallCost: item.customer_original_install_cost || 0,
      customerReinstallCost: item.customer_reinstall_cost || 0,
      additionalCost: item.additional_cost || 0, additionalNotes: item.additional_cost_notes || '',
      companyAdditionalCost: item.company_additional_cost || 0, companyAdditionalNotes: item.company_additional_cost_notes || '',
      hasCutout: !!item.has_cutout,
      hasPrint: printBillboardIds.includes(item.billboard_id),
      facesToInstall: item.faces_to_install || item.billboard?.Faces_Count || 2
    });
  };

  const updateCompositeTaskInstallationCosts = async (newCustomerTotal: number, newCompanyTotal: number) => {
    if (!task) return;
    try {
      const discountAmt = discountAmount || 0;
      const customerSubtotalCalc = newCustomerTotal + customerPrintTotal + customerCutoutTotal;
      const customerTotalCalc = customerSubtotalCalc - discountAmt;
      const companyTotalCalc = newCompanyTotal + companyPrintTotal + companyCutoutTotal;
      const netProfitCalc = customerTotalCalc - companyTotalCalc;
      const profitPercentageCalc = customerTotalCalc > 0 ? (netProfitCalc / customerTotalCalc) * 100 : 0;

      await supabase.from('composite_tasks').update({
        customer_installation_cost: newCustomerTotal, company_installation_cost: newCompanyTotal,
        customer_total: customerTotalCalc, company_total: companyTotalCalc,
        net_profit: netProfitCalc, profit_percentage: profitPercentageCalc, updated_at: new Date().toISOString()
      }).eq('id', task.id);

      if (task.combined_invoice_id) {
         await supabase.from('printed_invoices').update({ total_amount: customerTotalCalc, updated_at: new Date().toISOString() }).eq('id', task.combined_invoice_id);
         await supabase.from('customer_payments').update({ amount: -customerTotalCalc }).eq('printed_invoice_id', task.combined_invoice_id).eq('entry_type', 'invoice');
      }
    } catch (error) {
      console.error('Error updating composite task costs:', error);
    }
  };

  const handleSaveItemEdit = async () => {
    if (!editingItemId) return;
    setDistributing(true);
    try {
      const editingItem = taskItems.find(item => item.id === editingItemId);
      if (!editingItem) throw new Error('Item not found');

      const isReinstalled = (editingItem.reinstall_count || 0) > 0;
      setCustomCompanyCosts(prev => ({ ...prev, [editingItemId]: editValues.companyCost }));
      const { error } = await supabase.from('installation_task_items').update({
        customer_installation_cost: isReinstalled ? editValues.customerReinstallCost : editValues.customerCost,
        customer_original_install_cost: editValues.customerOriginalInstallCost,
        customer_reinstall_cost: editValues.customerReinstallCost,
        company_installation_cost: editValues.companyCost,
        additional_cost: editValues.additionalCost || null, additional_cost_notes: editValues.additionalNotes || null,
        company_additional_cost: editValues.companyAdditionalCost || null, company_additional_cost_notes: editValues.companyAdditionalNotes || null,
        has_cutout: editValues.hasCutout,
        faces_to_install: editValues.facesToInstall
      }).eq('id', editingItemId);
      if (error) throw error;

      // Handle print status change
      if (task.print_task_id) {
        const wasPrint = printBillboardIds.includes(editingItem.billboard_id);
        const isPrint = editValues.hasPrint;
        if (wasPrint !== isPrint) {
          if (isPrint) {
            const billboard = billboards[editingItem.billboard_id];
            if (billboard) {
              const sizeName = billboard.Size || 'غير محدد';
              const area = calculateAreaFromSizeData(sizeName, sizesMap);
              const faces = editValues.facesToInstall || editingItem.faces_to_install || billboard.Faces_Count || 2;
              const totalItemArea = area * faces;
              
              const { data: existing } = await supabase
                .from('print_task_items')
                .select('id')
                .eq('task_id', task.print_task_id)
                .eq('billboard_id', editingItem.billboard_id)
                .maybeSingle();

              if (!existing) {
                await supabase.from('print_task_items').insert({
                  task_id: task.print_task_id,
                  billboard_id: editingItem.billboard_id,
                  description: `${sizeName} - ${faces === 1 ? 'وجه واحد' : 'وجهين'}`,
                  width: sizesMap[sizeName]?.width || null,
                  height: sizesMap[sizeName]?.height || null,
                  area: totalItemArea,
                  quantity: 1,
                  faces_count: faces,
                  unit_cost: companyPrintPerMeter * totalItemArea,
                  printer_unit_cost: companyPrintPerMeter * totalItemArea,
                  customer_unit_cost: customerPrintPerMeter * totalItemArea,
                  total_cost: companyPrintPerMeter * totalItemArea,
                  status: 'pending'
                });
              }
            }
            setPrintBillboardIds(prev => Array.from(new Set([...prev, editingItem.billboard_id])));
          } else {
            await supabase
              .from('print_task_items')
              .delete()
              .eq('task_id', task.print_task_id)
              .eq('billboard_id', editingItem.billboard_id);
            setPrintBillboardIds(prev => prev.filter(id => id !== editingItem.billboard_id));
          }
        }
      }
      
      const newItems = taskItems.map(item => 
        item.id === editingItemId ? { 
          ...item, 
          customer_installation_cost: isReinstalled ? editValues.customerReinstallCost : editValues.customerCost,
          customer_original_install_cost: editValues.customerOriginalInstallCost,
          customer_reinstall_cost: editValues.customerReinstallCost,
          company_installation_cost: editValues.companyCost,
          additional_cost: editValues.additionalCost, additional_cost_notes: editValues.additionalNotes,
          company_additional_cost: editValues.companyAdditionalCost, company_additional_cost_notes: editValues.companyAdditionalNotes,
          has_cutout: editValues.hasCutout,
          faces_to_install: editValues.facesToInstall
        } : item
      );
      setTaskItems(newItems);
      
      let newCustomerTotal = 0, newCompanyTotal = 0;
      newItems.forEach(item => {
        const companyPrice = item.id === editingItemId ? editValues.companyCost : (customCompanyCosts[item.id] ?? installationPrices[item.billboard_id] ?? 0);
        const companyExtra = item.id === editingItemId ? editValues.companyAdditionalCost : (item.company_additional_cost || 0);
        const isItemReinstalled = (item.reinstall_count || 0) > 0;
        const itemCustCost = isItemReinstalled
          ? (item.customer_original_install_cost || 0) + (item.customer_reinstall_cost || item.customer_installation_cost || 0)
          : (item.customer_installation_cost || 0);
        newCustomerTotal += itemCustCost;
        newCompanyTotal += companyPrice + companyExtra;
      });
      await updateCompositeTaskInstallationCosts(newCustomerTotal, newCompanyTotal);
      toast.success('تم حفظ التغييرات على اللوحة بنجاح');
      setEditingItemId(null);
    } catch (error) { 
      console.error(error);
      toast.error('فشل في حفظ تعديلات اللوحة'); 
    }
    finally { setDistributing(false); }
  };

  const handleTogglePrintStatus = async (billboardId: number, isChecked: boolean) => {
    if (!task?.print_task_id) return;
    setDistributing(true);
    try {
      if (isChecked) {
        const billboard = billboards[billboardId];
        const item = taskItems.find(i => i.billboard_id === billboardId);
        if (billboard) {
          const sizeName = billboard.Size || 'غير محدد';
          const area = calculateAreaFromSizeData(sizeName, sizesMap);
          const faces = item?.faces_to_install || billboard.Faces_Count || 2;
          const totalItemArea = area * faces;

          const { data: existing } = await supabase
            .from('print_task_items')
            .select('id')
            .eq('task_id', task.print_task_id)
            .eq('billboard_id', billboardId)
            .maybeSingle();

          if (!existing) {
            await supabase.from('print_task_items').insert({
              task_id: task.print_task_id,
              billboard_id: billboardId,
              description: `${sizeName} - ${faces === 1 ? 'وجه واحد' : 'وجهين'}`,
              width: sizesMap[sizeName]?.width || null,
              height: sizesMap[sizeName]?.height || null,
              area: totalItemArea,
              quantity: 1,
              faces_count: faces,
              unit_cost: companyPrintPerMeter * totalItemArea,
              printer_unit_cost: companyPrintPerMeter * totalItemArea,
              customer_unit_cost: customerPrintPerMeter * totalItemArea,
              total_cost: companyPrintPerMeter * totalItemArea,
              status: 'pending'
            });
          }
        }
        setPrintBillboardIds(prev => Array.from(new Set([...prev, billboardId])));
      } else {
        await supabase
          .from('print_task_items')
          .delete()
          .eq('task_id', task.print_task_id)
          .eq('billboard_id', billboardId);
        setPrintBillboardIds(prev => prev.filter(id => id !== billboardId));
      }
      toast.success(isChecked ? 'تم إضافة اللوحة للطباعة بنجاح' : 'تم استثناء اللوحة من الطباعة بنجاح');
    } catch (error) {
      console.error('Error toggling print status:', error);
      toast.error('حدث خطأ أثناء تعديل حالة الطباعة');
    } finally {
      setDistributing(false);
    }
  };

  const handleSetFree = async (itemId: string) => {
    setDistributing(true);
    try {
      await supabase.from('installation_task_items').update({ customer_installation_cost: 0, customer_reinstall_cost: 0 }).eq('id', itemId);
      const newItems = taskItems.map(item => item.id === itemId ? { ...item, customer_installation_cost: 0, customer_reinstall_cost: 0 } : item);
      setTaskItems(newItems);
      let newCustomerTotal = 0, newCompanyTotal = 0;
      newItems.forEach(item => {
        const isReinstalled = (item.reinstall_count || 0) > 0;
        const itemCost = isReinstalled
          ? (Number(item.customer_original_install_cost) || 0) + (Number(item.customer_reinstall_cost) || Number(item.customer_installation_cost) || 0)
          : (Number(item.customer_installation_cost) || 0);
        newCustomerTotal += itemCost;
        newCompanyTotal += customCompanyCosts[item.id] ?? installationPrices[item.billboard_id] ?? 0;
      });
      await updateCompositeTaskInstallationCosts(newCustomerTotal, newCompanyTotal);
      toast.success('تم تحويل تكلفة التركيب للوحة إلى مجانية');
    } catch { toast.error('فشل تحويل اللوحة لمجانية'); }
    finally { setDistributing(false); }
  };

  const handleSetAllFree = async () => {
    if (taskItems.length === 0) return;
    setDistributing(true);
    try {
      await Promise.all(taskItems.map(item => supabase.from('installation_task_items').update({ customer_installation_cost: 0 }).eq('id', item.id)));
      setTaskItems(prev => prev.map(item => ({ ...item, customer_installation_cost: 0 })));
      let newCompanyTotal = 0;
      taskItems.forEach(item => { newCompanyTotal += customCompanyCosts[item.id] ?? installationPrices[item.billboard_id] ?? 0; });
      await updateCompositeTaskInstallationCosts(0, newCompanyTotal);
      toast.success(`تم تحويل ${taskItems.length} لوحة لمجانية بالكامل`);
    } catch { toast.error('فشل تحويل اللوحات لمجانية'); }
    finally { setDistributing(false); }
  };

  // Quick batch adjustments
  const handleApplyQuickPricing = async () => {
    const hasAnyPrice = Object.values(quickPrices).some(p => p.normal > 0 || p.cutout > 0);
    if (!hasAnyPrice) { toast.error('الرجاء إدخال سعر واحد على الأقل للتطبيق'); return; }
    setDistributing(true);
    try {
      const newItems = [...taskItems];
      let newCustomerTotal = 0, newCompanyTotal = 0;
      for (let idx = 0; idx < taskItems.length; idx++) {
        const item = taskItems[idx];
        const billboard = billboards[item.billboard_id];
        const sizeName = billboard?.Size || '';
        const pricing = quickPrices[sizeName];
        if (pricing) {
          const newCost = item.has_cutout ? pricing.cutout : pricing.normal;
          if (newCost > 0) {
            newItems[idx] = { ...item, customer_installation_cost: newCost };
            await supabase.from('installation_task_items').update({ customer_installation_cost: newCost, pricing_type: 'piece', price_per_meter: 0 }).eq('id', item.id);
          }
        }
        const isReinstalled = (newItems[idx].reinstall_count || 0) > 0;
        const itemCost = isReinstalled
          ? (Number(newItems[idx].customer_original_install_cost) || 0) + (Number(newItems[idx].customer_reinstall_cost) || Number(newItems[idx].customer_installation_cost) || 0)
          : (Number(newItems[idx].customer_installation_cost) || 0);
        newCustomerTotal += itemCost;
        newCompanyTotal += installationPrices[newItems[idx].billboard_id] || 0;
      }
      setTaskItems(newItems);
      await updateCompositeTaskInstallationCosts(newCustomerTotal, newCompanyTotal);
      toast.success('تم تطبيق الأسعار السريعة بنجاح');
      setQuickPrices({});
    } catch { toast.error('فشل تطبيق الأسعار بالقطعة'); }
    finally { setDistributing(false); }
  };

  const handleApplyMeterToSize = async (sizeName: string) => {
    const meterPrice = meterPrices[sizeName];
    if (!meterPrice || (meterPrice.normal <= 0 && meterPrice.cutout <= 0)) { toast.error('الرجاء إدخال سعر المتر أولاً للتطبيق'); return; }
    setDistributing(true);
    try {
      const newItems = [...taskItems];
      let newCustomerTotal = 0, newCompanyTotal = 0;
      for (let idx = 0; idx < taskItems.length; idx++) {
        const item = taskItems[idx];
        const billboard = billboards[item.billboard_id];
        if (billboard?.Size === sizeName) {
          const area = calculateAreaFromSizeData(sizeName, sizesMap);
          const faces = item.faces_to_install || billboard?.Faces_Count || 2;
          const pricePerMeter = item.has_cutout ? meterPrice.cutout : meterPrice.normal;
          if (pricePerMeter > 0) {
            const cost = Math.round(pricePerMeter * area * faces * 100) / 100;
            newItems[idx] = { ...item, customer_installation_cost: cost, pricing_type: 'meter', price_per_meter: pricePerMeter };
            await supabase.from('installation_task_items').update({ customer_installation_cost: cost, pricing_type: 'meter', price_per_meter: pricePerMeter }).eq('id', item.id);
          }
        }
        const isReinstalled = (newItems[idx].reinstall_count || 0) > 0;
        const itemCost = isReinstalled
          ? (Number(newItems[idx].customer_original_install_cost) || 0) + (Number(newItems[idx].customer_reinstall_cost) || Number(newItems[idx].customer_installation_cost) || 0)
          : (Number(newItems[idx].customer_installation_cost) || 0);
        newCustomerTotal += itemCost;
        newCompanyTotal += installationPrices[newItems[idx].billboard_id] || 0;
      }
      setTaskItems(newItems);
      await updateCompositeTaskInstallationCosts(newCustomerTotal, newCompanyTotal);
      toast.success(`تم تطبيق سعر المتر على مقاس ${sizeName} بنجاح`);
    } catch { toast.error('حدث خطأ أثناء تطبيق سعر المتر'); }
    finally { setDistributing(false); }
  };

  const handleApplyMeterToType = async (billboardType: string) => {
    const meterPrice = typeMeterPrices[billboardType];
    if (!meterPrice || (meterPrice.normal <= 0 && meterPrice.cutout <= 0)) { toast.error('الرجاء إدخال سعر المتر أولاً للتطبيق'); return; }
    setDistributing(true);
    try {
      const newItems = [...taskItems];
      let newCustomerTotal = 0, newCompanyTotal = 0;
      for (let idx = 0; idx < taskItems.length; idx++) {
        const item = taskItems[idx];
        const billboard = billboards[item.billboard_id];
        if (billboard?.billboard_type === billboardType) {
          const sizeName = billboard?.Size || '';
          const area = calculateAreaFromSizeData(sizeName, sizesMap);
          const faces = item.faces_to_install || billboard?.Faces_Count || 2;
          const pricePerMeter = item.has_cutout ? meterPrice.cutout : meterPrice.normal;
          if (pricePerMeter > 0) {
            const cost = Math.round(pricePerMeter * area * faces * 100) / 100;
            newItems[idx] = { ...item, customer_installation_cost: cost, pricing_type: 'meter', price_per_meter: pricePerMeter };
            await supabase.from('installation_task_items').update({ customer_installation_cost: cost, pricing_type: 'meter', price_per_meter: pricePerMeter }).eq('id', item.id);
          }
        }
        const isReinstalled = (newItems[idx].reinstall_count || 0) > 0;
        const itemCost = isReinstalled
          ? (Number(newItems[idx].customer_original_install_cost) || 0) + (Number(newItems[idx].customer_reinstall_cost) || Number(newItems[idx].customer_installation_cost) || 0)
          : (Number(newItems[idx].customer_installation_cost) || 0);
        newCustomerTotal += itemCost;
        newCompanyTotal += installationPrices[newItems[idx].billboard_id] || 0;
      }
      setTaskItems(newItems);
      await updateCompositeTaskInstallationCosts(newCustomerTotal, newCompanyTotal);
      toast.success(`تم تطبيق سعر المتر على نوع اللوحات ${billboardType} بنجاح`);
      setTypeMeterPrices(prev => { const u = { ...prev }; delete u[billboardType]; return u; });
    } catch { toast.error('حدث خطأ أثناء تطبيق السعر'); }
    finally { setDistributing(false); }
  };

  const toggleSizeCollapse = (sizeKey: string) => {
    setCollapsedSizes(prev => { const u = new Set(prev); u.has(sizeKey) ? u.delete(sizeKey) : u.add(sizeKey); return u; });
  };
  const toggleTypeCollapse = (typeKey: string) => {
    setCollapsedTypes(prev => { const u = new Set(prev); u.has(typeKey) ? u.delete(typeKey) : u.add(typeKey); return u; });
  };

  // Main save action
  const handleSave = async () => {
    if (!task) return;
    const totalServiceDiscounts =
      (costAllocation.print.enabled ? costAllocation.print.discount : 0) +
      (costAllocation.cutout.enabled ? costAllocation.cutout.discount : 0) +
      (costAllocation.installation.enabled ? costAllocation.installation.discount : 0);
    const hasAnyAllocation = costAllocation.print.enabled || costAllocation.cutout.enabled || costAllocation.installation.enabled;
    const allocationToSave: any = hasAnyAllocation ? { ...costAllocation } : undefined;

    // Sync printer with database print task
    try {
      if (task.print_task_id) {
        const { data: updatedPrintTask, error: ptUpdateError } = await (supabase.from('print_tasks') as any).update({
          printer_id: selectedPrinterId || null,
          customer_price_per_meter: customerPrintPerMeter || 0,
          price_per_meter: companyPrintPerMeter || 0,
          total_area: totalPrintArea,
          customer_total_amount: customerPrintTotal,
          total_cost: companyPrintTotal,
          printer_total_cost: companyPrintTotal,
        }).eq('id', task.print_task_id).select('invoice_id').maybeSingle();

        if (ptUpdateError) throw ptUpdateError;

        if (updatedPrintTask?.invoice_id) {
          await supabase.from('printed_invoices').update({
            total_amount: customerPrintTotal,
            printer_cost: companyPrintTotal,
            updated_at: new Date().toISOString()
          }).eq('id', updatedPrintTask.invoice_id);
        }

        const { data: currentItems } = await supabase
          .from('print_task_items')
          .select('id, area')
          .eq('task_id', task.print_task_id);

        if (currentItems) {
          await Promise.all(
            currentItems.map(item => {
              const itemArea = item.area || 0;
              return supabase
                .from('print_task_items')
                .update({
                  unit_cost: companyPrintPerMeter * itemArea,
                  printer_unit_cost: companyPrintPerMeter * itemArea,
                  customer_unit_cost: customerPrintPerMeter * itemArea,
                  total_cost: companyPrintPerMeter * itemArea,
                })
                .eq('id', item.id);
            })
          );
        }
      }
    } catch (e) { console.error('printer sync error', e); }

    // Sync cutout indicators
    try {
      const anyCutout = taskItems.some(i => i.has_cutout);
      if (task.print_task_id && anyCutout) {
        await (supabase.from('print_tasks') as any).update({
          has_cutouts: true,
          cutout_quantity: totalCutouts,
        }).eq('id', task.print_task_id);
      }
      if (task.cutout_task_id) {
        const workshopCounts: Record<string, number> = {};
        taskItems.forEach(i => {
          if (i.has_cutout && i.cutout_workshop_id) {
            workshopCounts[i.cutout_workshop_id] = (workshopCounts[i.cutout_workshop_id] || 0) + 1;
          }
        });
        const primaryWorkshop = Object.entries(workshopCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || null;
        await (supabase.from('cutout_tasks') as any).update({
          cutout_printer_id: primaryWorkshop,
          cutout_quantity: totalCutouts,
          cutout_cost: companyCutoutTotal,
          customer_cutout_total: customerCutoutTotal,
        }).eq('id', task.cutout_task_id);
      }
    } catch (e) { console.error('cutout sync error', e); }

    onSave({
      id: task.id,
      customer_installation_cost: customerInstallationTotal, company_installation_cost: companyInstallationTotal,
      customer_print_cost: customerPrintTotal, company_print_cost: companyPrintTotal,
      customer_cutout_cost: customerCutoutTotal, company_cutout_cost: companyCutoutTotal,
      discount_amount: discountAmount + totalServiceDiscounts, discount_reason: discountReason.trim() || undefined,
      notes: notes.trim() || undefined, cost_allocation: allocationToSave,
      print_discount: costAllocation.print.enabled ? costAllocation.print.discount : 0,
      print_discount_reason: costAllocation.print.enabled ? costAllocation.print.discount_reason : undefined,
      cutout_discount: costAllocation.cutout.enabled ? costAllocation.cutout.discount : 0,
      cutout_discount_reason: costAllocation.cutout.enabled ? costAllocation.cutout.discount_reason : undefined,
      installation_discount: costAllocation.installation.enabled ? costAllocation.installation.discount : 0,
      installation_discount_reason: costAllocation.installation.enabled ? costAllocation.installation.discount_reason : undefined,
    });
  };

  if (!task) return null;

  // تحديد ما إذا كانت هذه التركيبة الأولى (لا يمكن تعديل تكلفة التركيب للعميل)
  const isFirstInstallation = task.task_type === 'new_installation';

  const billboardTypes = Object.keys(groupedData);
  const cutoutItemCount = taskItems.filter(i => i.has_cutout).length || cutoutItems.length;

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent 
        side="right" 
        dir="rtl"
        className="w-full sm:max-w-3xl lg:max-w-4xl p-0 flex flex-col gap-0 overflow-hidden bg-background/98 backdrop-blur-md border-l border-border/15 text-right"
      >
        {/* ═══════ HEADER SECTION ═══════ */}
        <div className="shrink-0 border-b border-border/15 bg-card/45 backdrop-blur-md px-5 sm:px-6 py-4">
          <SheetHeader className="pb-4">
            <div className="flex items-center justify-between gap-4 text-right">
              <SheetTitle className="flex items-center gap-3 text-xl font-bold text-foreground leading-relaxed text-right">
                <div className="h-10 w-10 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center shrink-0 shadow-inner">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <span>تعديل تكاليف المهمة</span>
              </SheetTitle>
              <Badge variant={task.task_type === 'new_installation' ? 'default' : 'secondary'} className="text-xs px-3.5 py-1.5 font-semibold rounded-lg shadow-sm border border-border/10 bg-muted/80 text-foreground leading-normal">
                {task.task_type === 'new_installation' ? 'تركيب جديد' : 'إعادة تركيب'}
              </Badge>
            </div>
            <SheetDescription className="flex items-center justify-start gap-2 text-sm mt-3 text-muted-foreground leading-relaxed text-right">
              <span className="font-semibold text-foreground text-sm">{task.customer_name}</span>
              <span className="text-muted-foreground/30">•</span>
              <span className="text-xs font-semibold bg-muted/65 border border-border/15 px-2.5 py-0.5 rounded-lg text-foreground">عقد #{task.contract_id}</span>
            </SheetDescription>
          </SheetHeader>

          {/* Compact KPI Strip */}
          <div dir="rtl" className="rounded-2xl border border-border/15 bg-background/40 backdrop-blur-md shadow-sm overflow-hidden flex divide-x-reverse divide-x divide-border/15 text-right">
            <HeaderKpi label="مستحق العميل" value={customerTotal} suffix="د.ل" valueClass="text-emerald-500" />
            <HeaderKpi label="تكلفة الشركة" value={companyTotal} suffix="د.ل" valueClass="text-orange-500" divider />
            <HeaderKpi label="صافي الربح" value={netProfit} suffix="د.ل" valueClass={netProfit >= 0 ? "text-emerald-500" : "text-rose-500"} divider />
            <HeaderKpi label="نسبة الربح" value={`${profitPercentage.toFixed(0)}%`} valueClass={netProfit >= 0 ? "text-indigo-400" : "text-rose-500"} divider />
          </div>
        </div>

        {/* ═══════ TABS SECTION ═══════ */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground/70 text-sm font-semibold gap-3 py-20 bg-muted/5 leading-relaxed">
            <div className="relative flex items-center justify-center">
              <div className="absolute inset-0 bg-primary/10 rounded-full blur-md animate-pulse h-10 w-10"></div>
              <Loader2 className="h-7 w-7 animate-spin text-primary relative" />
            </div>
            <span>جاري تحميل التكاليف والتفاصيل...</span>
          </div>
        ) : (
          <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl" className="flex-1 flex flex-col overflow-hidden text-right">
            <div className="shrink-0 px-8 pt-3 border-b border-border/15 bg-card/25 backdrop-blur-sm">
              <TabsList dir="rtl" className="w-full justify-start bg-transparent gap-3 h-auto p-0 border-b-0 overflow-x-auto scrollbar-none flex-nowrap">
                {isInstallationActive && (
                  <TabsTrigger 
                    value="installation" 
                    className="data-[state=active]:bg-primary/10 data-[state=active]:text-primary rounded-t-xl rounded-b-none border-b-2 data-[state=active]:border-primary border-transparent px-6 py-4 text-sm font-semibold gap-2 transition-all duration-300 shadow-none hover:text-foreground shrink-0 leading-normal"
                  >
                    <Wrench className="h-4.5 w-4.5 shrink-0" />
                    <span>التركيب</span>
                    {task.installation_task_id && (
                      <Badge variant="secondary" className="text-xs font-semibold bg-muted/65 text-muted-foreground border border-border/20 px-2.5 py-0.5 rounded-full">{taskItems.length}</Badge>
                    )}
                  </TabsTrigger>
                )}

                {isPrintActive && (
                  <TabsTrigger 
                    value="print" 
                    className="data-[state=active]:bg-blue-500/10 data-[state=active]:text-blue-500 rounded-t-xl rounded-b-none border-b-2 data-[state=active]:border-blue-500 border-transparent px-6 py-4 text-sm font-semibold gap-2 transition-all duration-300 shadow-none hover:text-foreground shrink-0 leading-normal"
                  >
                    <Printer className="h-4.5 w-4.5 shrink-0" />
                    <span>الطباعة</span>
                    {totalPrintArea > 0 && (
                      <Badge variant="secondary" className="text-xs font-semibold bg-muted/65 text-muted-foreground border border-border/20 px-2.5 py-0.5 rounded-full">{totalPrintArea.toFixed(1)} م²</Badge>
                    )}
                  </TabsTrigger>
                )}

                {isCutoutActive && (hasCutoutBillboards || !!task.cutout_task_id || cutoutItemCount > 0) && (
                  <TabsTrigger 
                    value="cutout" 
                    className="data-[state=active]:bg-purple-500/10 data-[state=active]:text-purple-650 rounded-t-xl rounded-b-none border-b-2 data-[state=active]:border-purple-500 border-transparent px-6 py-4 text-sm font-semibold gap-2 transition-all duration-300 shadow-none hover:text-foreground shrink-0 leading-normal"
                  >
                    <Scissors className="h-4.5 w-4.5 shrink-0" />
                    <span>المجسمات</span>
                    {cutoutItemCount > 0 && (
                      <Badge variant="secondary" className="text-xs font-semibold bg-muted/65 text-muted-foreground border border-border/20 px-2.5 py-0.5 rounded-full">{cutoutItemCount}</Badge>
                    )}
                  </TabsTrigger>
                )}

                <TabsTrigger 
                  value="summary" 
                  className="data-[state=active]:bg-emerald-500/10 data-[state=active]:text-emerald-600 rounded-t-xl rounded-b-none border-b-2 data-[state=active]:border-emerald-500 border-transparent px-6 py-4 text-sm font-semibold gap-2 transition-all duration-300 shadow-none hover:text-foreground shrink-0 leading-normal"
                >
                  <Calculator className="h-4.5 w-4.5 shrink-0" />
                  <span>الملخص المالي</span>
                </TabsTrigger>
              </TabsList>
            </div>

            <ScrollArea className="flex-1 bg-muted/[0.03]">
              
              {/* ═══════ TAB: التركيب واللوحات ═══════ */}
              {isInstallationActive && (
                <TabsContent value="installation" className="mt-0 p-5 sm:p-6 space-y-6">
                  {task.installation_task_id ? (
                    <>
                      {/* تنبيه: التركيبة الأولى لا يمكن تعديل تكلفتها للعميل */}
                      {isFirstInstallation && (
                        <div className="flex items-start gap-3 p-4 rounded-xl bg-blue-500/8 border border-blue-500/20 text-blue-800 dark:text-blue-300 mb-2">
                          <div className="p-2 rounded-lg bg-blue-500/15 text-blue-600 dark:text-blue-400 shrink-0 mt-0.5">
                            <AlertCircle className="h-5 w-5" />
                          </div>
                          <div className="space-y-1">
                            <h5 className="font-bold text-sm">تركيبة أولى - تكلفة التركيب غير قابلة للتعديل</h5>
                            <p className="text-xs leading-relaxed text-blue-700/85 dark:text-blue-400/85">
                              هذه مهمة تركيب أولى (جديدة). تكلفة التركيب على العميل مقفلة ولا يمكن تعديلها. يمكنك فقط تعديل تكلفة الشركة والتكاليف الإضافية.
                            </p>
                          </div>
                        </div>
                      )}
                      {/* Segmented pricing-mode control + Set free */}
                      <div className="flex items-center justify-between gap-3 flex-wrap text-right">
                        <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted/40 border border-border/15 shadow-inner">
                          <button
                            type="button"
                            onClick={() => setPricingType('piece')}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer",
                              pricingType === 'piece' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            )}
                          >
                            <Square className="h-3.5 w-3.5" />
                            <span>بالقطعة</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setPricingType('meter')}
                            className={cn(
                              "flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold transition-all duration-150 cursor-pointer",
                              pricingType === 'meter' ? 'bg-background text-primary shadow-sm' : 'text-muted-foreground hover:text-foreground'
                            )}
                          >
                            <Ruler className="h-3.5 w-3.5" />
                            <span>بالمتر المربع</span>
                          </button>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleSetAllFree}
                          disabled={distributing || totals.customerCost === 0 || isFirstInstallation}
                          className="gap-1.5 text-xs h-8 text-rose-600 hover:bg-rose-500/10 hover:text-rose-700 rounded-lg px-3"
                          title={isFirstInstallation ? 'غير متاح للتركيبة الأولى' : ''}
                        >
                          <Gift className="h-3.5 w-3.5" />
                          <span>جعل الكل مجاني</span>
                        </Button>
                      </div>

                      {/* Inline summary strip for installation totals */}
                       <div dir="rtl" className="flex items-center divide-x-reverse divide-x divide-border/15 rounded-xl border border-border/15 bg-card/40 overflow-hidden text-right">
                         <div className="flex-1 px-5 py-3 min-w-0">
                           <div className="text-[11px] sm:text-xs font-semibold text-muted-foreground/80 uppercase">المساحة</div>
                           <div className="text-base sm:text-lg font-bold font-mono text-primary mt-1">{totals.totalArea.toFixed(1)} <span className="text-[11px] text-muted-foreground/60">م²</span></div>
                         </div>
                         <div className="flex-1 px-5 py-3 min-w-0 border-r border-border/15">
                           <div className="text-[11px] sm:text-xs font-semibold text-muted-foreground/80 uppercase">تكلفة الشركة</div>
                           <div className="text-base sm:text-lg font-bold font-mono text-amber-600 mt-1">{totals.companyCost.toLocaleString('ar-LY')} <span className="text-[11px] text-muted-foreground/60">د.ل</span></div>
                         </div>
                         <div className="flex-1 px-5 py-3 min-w-0 border-r border-border/15">
                           <div className="text-[11px] sm:text-xs font-semibold text-muted-foreground/80 uppercase">مبيعات العميل</div>
                           <div className="text-base sm:text-lg font-bold font-mono text-emerald-600 mt-1">{totals.customerCost.toLocaleString('ar-LY')} <span className="text-[11px] text-muted-foreground/60">د.ل</span></div>
                         </div>
                       </div>

                      {/* Section header */}
                      <div className="flex items-center justify-between mt-2 text-right">
                        <h3 className="font-bold text-base flex items-center gap-2.5 text-foreground">
                          <LayoutGrid className="h-5 w-5 text-muted-foreground" /> 
                          <span>تفاصيل لوحات التركيب</span>
                        </h3>
                      </div>

                      {/* Grouped billboard items by type and size */}
                      <div className="space-y-6">
                        {billboardTypes.map(type => {
                          const typeData = groupedData[type];
                          const Icon = BILLBOARD_TYPE_ICONS[type] || LayoutGrid;
                          const isTypeCollapsed = collapsedTypes.has(type);
                          
                          // Check if this billboard type has any billboards with cutouts
                          const typeHasCutouts = Object.values(typeData.sizes).some(s => s.cutoutCount > 0);

                          return (
                            <div key={type} className="border border-border/15 rounded-2xl overflow-hidden bg-card/45 backdrop-blur-md shadow-sm transition-all duration-300">
                              <div 
                                dir="rtl"
                                className="flex items-center justify-between p-5 bg-muted/10 cursor-pointer hover:bg-muted/15 transition-all select-none border-b border-border/10 gap-4 text-right"
                                onClick={() => toggleTypeCollapse(type)}
                              >
                                 <div className="flex items-center gap-3.5 min-w-0 text-right">
                                   <div className={cn("transition-transform duration-300 shrink-0", isTypeCollapsed ? "rotate-0" : "-rotate-90")}>
                                    <ChevronDown className="h-4.5 w-4.5 text-muted-foreground" />
                                  </div>
                                  <div className="h-9 w-9 rounded-lg bg-muted flex items-center justify-center shrink-0 border border-border/10">
                                    <Icon className="h-5 w-5 text-muted-foreground" />
                                  </div>
                                   <div className="min-w-0 text-right">
                                    <span className="font-bold text-base block leading-normal text-foreground">{type}</span>
                                    <span className="text-[13px] text-muted-foreground/80 block mt-0.5">{typeData.totalItems} لوحة في هذه المهمة</span>
                                  </div>
                                </div>
                                 <div className="flex items-center gap-5 text-sm font-semibold shrink-0 text-left pl-2">
                                  <span className="text-[13px] text-muted-foreground bg-muted border border-border/10 px-3 py-1 rounded-lg whitespace-nowrap">{typeData.totalArea.toFixed(1)} م²</span>
                                  <div className="hidden sm:flex flex-col text-right">
                                    <span className="text-[12px] text-muted-foreground/60 mb-1">الشركة</span>
                                    <span className="font-semibold text-amber-600 font-mono leading-none text-sm">{typeData.companyCost.toLocaleString('ar-LY')} د.ل</span>
                                  </div>
                                  <div className="flex flex-col text-right">
                                    <span className="text-[12px] text-muted-foreground/60 mb-1">الزبون</span>
                                    <span className="font-bold text-emerald-600 font-mono leading-none text-sm">{typeData.customerCost.toLocaleString('ar-LY')} د.ل</span>
                                  </div>
                                </div>
                              </div>

                              {/* Bulk pricing section per billboard type (Meter pricing only) */}
                              {!isTypeCollapsed && pricingType === 'meter' && (
                                 <div className="p-5 border-b border-border/10 bg-primary/[0.01] flex flex-wrap items-center justify-between gap-4 shadow-inner text-right">
                                  <div className="flex items-center gap-2 text-primary">
                                    <Zap className="h-4 w-4 shrink-0 text-primary/70 animate-pulse" />
                                    <span className="text-xs font-bold">تسعير سريع بالمتر المربع لنوع {type}:</span>
                                  </div>
                                   <div className="flex flex-wrap items-center justify-start gap-4">
                                    <InlinePriceInput 
                                      value={typeMeterPrices[type]?.normal || 0}
                                      onChange={val => setTypeMeterPrices(prev => ({
                                        ...prev,
                                        [type]: {
                                          ...prev[type],
                                          normal: val,
                                          cutout: prev[type]?.cutout || 0
                                        }
                                      }))}
                                      label="عادي / م²:"
                                    />
                                    
                                    {/* Smart: Hide cutout price input if this type has no billboards with cutout */}
                                    {typeHasCutouts && (
                                      <InlinePriceInput 
                                        value={typeMeterPrices[type]?.cutout || 0}
                                        onChange={val => setTypeMeterPrices(prev => ({
                                          ...prev,
                                          [type]: {
                                            ...prev[type],
                                            normal: prev[type]?.normal || 0,
                                            cutout: val
                                          }
                                        }))}
                                        label="مجسم / م²:"
                                        className="border-purple-200"
                                      />
                                    )}

                                    <Button 
                                      size="sm" 
                                      className="h-8.5 text-xs font-semibold gap-1.5 rounded-lg px-4 shadow-sm" 
                                      onClick={() => handleApplyMeterToType(type)}
                                      disabled={distributing || (!typeMeterPrices[type]?.normal && !typeMeterPrices[type]?.cutout)}
                                    >
                                      <Check className="h-3.5 w-3.5" /> 
                                      <span>تطبيق السعر</span>
                                    </Button>
                                  </div>
                                </div>
                              )}

                              {/* Accordion sizes under the billboard type */}
                              {!isTypeCollapsed && (
                                <div className="divide-y divide-border/10">
                                  {Object.values(typeData.sizes).map(sizeData => {
                                    const sizeKey = `${type}-${sizeData.size}`;
                                    const isCollapsed = collapsedSizes.has(sizeKey);

                                    return (
                                      <div key={sizeKey} className="bg-card/20">
                                        {/* Size Accordion Header */}
                                        <div 
                                          dir="rtl"
                                          className="flex items-center justify-between px-6 py-4.5 bg-muted/[0.04] cursor-pointer hover:bg-muted/[0.08] transition-all select-none border-b border-border/5 gap-4 text-right"
                                          onClick={() => toggleSizeCollapse(sizeKey)}
                                        >
                                          <div className="flex items-center gap-3 flex-wrap min-w-0 text-right">
                                            <div className={cn("transition-transform duration-200 shrink-0", isCollapsed ? "rotate-0" : "-rotate-90")}>
                                              <ChevronDown className="h-4 w-4 text-muted-foreground/60" />
                                            </div>
                                            <Badge variant="outline" className="text-[13px] font-semibold bg-background border-border/15 py-1 px-3 rounded-md text-foreground">{sizeData.size}</Badge>
                                            <span className="text-[13px] text-muted-foreground font-medium">{sizeData.items.length} لوحة • {sizeData.totalArea.toFixed(1)} م²</span>
                                            {sizeData.cutoutCount > 0 && (
                                              <Badge variant="outline" className="text-[13px] bg-purple-500/10 text-purple-650 border-purple-200/50 rounded-md py-1 px-3 font-semibold">{sizeData.cutoutCount} مجسم</Badge>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-4 text-[13px] sm:text-sm font-semibold text-foreground/80 shrink-0 text-left pl-2">
                                            <span className="text-muted-foreground/85 whitespace-nowrap">الشركة: {sizeData.companyCost.toLocaleString('ar-LY')}</span>
                                            <span className="text-primary font-semibold whitespace-nowrap">الزبون: {sizeData.customerCost.toLocaleString('ar-LY')} د.ل</span>
                                          </div>
                                        </div>

                                        {/* Piece Batch Inputs */}
                                        {!isCollapsed && pricingType === 'piece' && (
                                          <div className="px-6 py-4 border-b border-border/10 bg-muted/[0.02] flex items-center justify-between flex-wrap gap-4 shadow-inner text-right">
                                            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
                                              <Calculator className="h-4 w-4 text-muted-foreground/75" />
                                              <span>تحديد سعر القطعة مقاس {sizeData.size}:</span>
                                            </div>
                                            <div className="flex items-center justify-start gap-3 flex-wrap">
                                              <InlinePriceInput 
                                                value={quickPrices[sizeData.size]?.normal || 0}
                                                onChange={val => setQuickPrices(prev => ({
                                                  ...prev,
                                                  [sizeData.size]: {
                                                    ...prev[sizeData.size],
                                                    normal: val,
                                                    cutout: prev[sizeData.size]?.cutout || 0
                                                  }
                                                }))}
                                                label="لوحة عادية:"
                                                step={10}
                                              />
                                              
                                              {/* Smart: Hide cutout price input if no cutouts are present for this size */}
                                              {sizeData.cutoutCount > 0 && (
                                                <InlinePriceInput 
                                                  value={quickPrices[sizeData.size]?.cutout || 0}
                                                  onChange={val => setQuickPrices(prev => ({
                                                    ...prev,
                                                    [sizeData.size]: {
                                                      ...prev[sizeData.size],
                                                      normal: prev[sizeData.size]?.normal || 0,
                                                      cutout: val
                                                    }
                                                  }))}
                                                  label="لوحة مجسم:"
                                                  step={10}
                                                  className="border-purple-250 text-purple-650"
                                                />
                                              )}
                                              
                                              <Button 
                                                size="sm" 
                                                className="h-9 text-xs font-semibold gap-1.5 rounded-lg shadow-sm" 
                                                onClick={handleApplyQuickPricing}
                                                disabled={distributing || (!quickPrices[sizeData.size]?.normal && !quickPrices[sizeData.size]?.cutout)}
                                              >
                                                <Check className="h-3.5 w-3.5" /> 
                                                <span>تطبيق</span>
                                              </Button>
                                            </div>
                                          </div>
                                        )}

                                        {/* Meter Batch Inputs */}
                                        {!isCollapsed && pricingType === 'meter' && (
                                          <div className="px-6 py-4 border-b border-border/10 bg-muted/[0.02] flex items-center justify-between flex-wrap gap-4 shadow-inner text-right">
                                            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
                                              <Ruler className="h-4 w-4 text-muted-foreground/75" />
                                              <span>تحديد سعر المتر مقاس {sizeData.size}:</span>
                                            </div>
                                            <div className="flex items-center justify-start gap-3 flex-wrap">
                                              <InlinePriceInput 
                                                value={meterPrices[sizeData.size]?.normal || 0}
                                                onChange={val => setMeterPrices(prev => ({
                                                  ...prev,
                                                  [sizeData.size]: {
                                                    ...prev[sizeData.size],
                                                    normal: val,
                                                    cutout: prev[sizeData.size]?.cutout || 0
                                                  }
                                                }))}
                                                label="متر عادي:"
                                                step={1}
                                              />
                                              
                                              {/* Smart: Hide cutout price input if no cutouts are present for this size */}
                                              {sizeData.cutoutCount > 0 && (
                                                <InlinePriceInput 
                                                  value={meterPrices[sizeData.size]?.cutout || 0}
                                                  onChange={val => setMeterPrices(prev => ({
                                                    ...prev,
                                                    [sizeData.size]: {
                                                      ...prev[sizeData.size],
                                                      normal: prev[sizeData.size]?.normal || 0,
                                                      cutout: val
                                                    }
                                                  }))}
                                                  label="متر مجسم:"
                                                  step={1}
                                                  className="border-purple-250 text-purple-650"
                                                />
                                              )}
                                              <Button 
                                                size="sm" 
                                                className="h-9 text-xs font-semibold gap-1.5 rounded-lg shadow-sm" 
                                                onClick={() => handleApplyMeterToSize(sizeData.size)}
                                                disabled={distributing || (!meterPrices[sizeData.size]?.normal && !meterPrices[sizeData.size]?.cutout)}
                                              >
                                                <Check className="h-3.5 w-3.5" /> 
                                                <span>تطبيق</span>
                                              </Button>
                                            </div>
                                          </div>
                                        )}

                                        {/* Individual Cards Container */}
                                        {!isCollapsed && (
                                          <div className="p-6 space-y-4">
                                            {sizeData.items.map((item, idx) => {
                                              const itemCompanyCost = (customCompanyCosts[item.id] ?? installationPrices[item.billboard_id] ?? 0) + (item.company_additional_cost || 0);
                                              const faces = item.faces_to_install || item.billboard.Faces_Count || 2;
                                              const itemArea = item.area;
                                              const itemPrintCostCustomer = customerPrintPerMeter * itemArea;
                                              const itemPrintCostCompany = companyPrintPerMeter * itemArea;
                                              
                                              const isItemReinstalled = (item.reinstall_count || 0) > 0;
                                              // Inline editing panel inside the list
                                              if (editingItemId === item.id) {
                                                return (
                                                  <div key={item.id} className="rounded-2xl border-2 border-primary/35 bg-primary/[0.01] p-5 space-y-4.5 shadow-sm animate-in fade-in zoom-in-95 duration-200">
                                                    <div className="flex items-center justify-between pb-3 border-b border-border/10 gap-4 text-right">
                                                      <div className="flex items-center gap-3.5">
                                                        {item.billboard.Image_URL ? (
                                                          <img src={item.billboard.Image_URL} alt="" className="w-14 h-14 rounded-xl object-cover border border-primary/20 shadow-sm" />
                                                        ) : (
                                                          <div className="w-14 h-14 rounded-xl bg-muted flex items-center justify-center border border-border/15">
                                                            <LayoutGrid className="h-6 w-6 text-muted-foreground/45" />
                                                          </div>
                                                        )}
                                                        <div>
                                                          <span className="font-semibold text-sm block text-foreground">{item.billboard.Billboard_Name || `لوحة رمز #${String(item.billboard_id).padStart(4, '0')}`}</span>
                                                          <span className="text-xs text-muted-foreground block mt-0.5">{faces} أوجه • {itemArea.toFixed(1)} م²</span>
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
                                                      <div className="space-y-2">
                                                        <Label className="text-sm font-semibold text-amber-600 block leading-relaxed text-right">تكلفة الشركة (التركيب الأساسي)</Label>
                                                        <InlinePriceInput 
                                                          value={editValues.companyCost}
                                                          onChange={val => setEditValues(prev => ({...prev, companyCost: val}))}
                                                          label=""
                                                          showLabel={false}
                                                          className="w-full"
                                                        />
                                                      </div>
                                                      {isItemReinstalled ? (
                                                        <>
                                                          <div className="space-y-2">
                                                            <Label className="text-sm font-semibold text-primary block leading-relaxed text-right">سعر الزبون (التركيب الأصلي)</Label>
                                                            <div className="flex gap-2 items-center">
                                                              <InlinePriceInput 
                                                                value={editValues.customerOriginalInstallCost}
                                                                onChange={val => setEditValues(prev => ({...prev, customerOriginalInstallCost: val}))}
                                                                label=""
                                                                showLabel={false}
                                                                className="flex-1"
                                                              />
                                                              <Button 
                                                                size="sm" 
                                                                variant="outline" 
                                                                className="h-11 w-11 p-0 shrink-0 rounded-xl text-purple-600 border-purple-250 hover:bg-purple-50/50 transition-colors" 
                                                                onClick={() => setEditValues(prev => ({ ...prev, customerOriginalInstallCost: 0 }))} 
                                                                title="مجاني"
                                                              >
                                                                <Gift className="h-5 w-5" />
                                                              </Button>
                                                            </div>
                                                          </div>
                                                          <div className="space-y-2">
                                                            <Label className="text-sm font-semibold text-orange-600 block leading-relaxed text-right">سعر الزبون (إعادة التركيب)</Label>
                                                            <div className="flex gap-2 items-center">
                                                              <InlinePriceInput 
                                                                value={editValues.customerReinstallCost}
                                                                onChange={val => setEditValues(prev => ({...prev, customerReinstallCost: val}))}
                                                                label=""
                                                                showLabel={false}
                                                                className="flex-1"
                                                              />
                                                              <Button 
                                                                size="sm" 
                                                                variant="outline" 
                                                                className="h-11 w-11 p-0 shrink-0 rounded-xl text-purple-600 border-purple-250 hover:bg-purple-50/50 transition-colors" 
                                                                onClick={() => setEditValues(prev => ({ ...prev, customerReinstallCost: 0 }))} 
                                                                title="مجاني"
                                                              >
                                                                <Gift className="h-5 w-5" />
                                                              </Button>
                                                            </div>
                                                          </div>
                                                        </>
                                                      ) : (
                                                        <div className="space-y-2">
                                                          <Label className={cn("text-sm font-semibold block leading-relaxed text-right", isFirstInstallation ? 'text-muted-foreground' : 'text-primary')}>سعر الزبون (التركيب الأساسي){isFirstInstallation && <span className="text-[10px] text-blue-500 mr-1">(مقفل)</span>}</Label>
                                                          <div className="flex gap-2 items-center">
                                                            {isFirstInstallation ? (
                                                              <div className="flex-1 flex items-center gap-1.5 bg-muted/40 rounded-xl px-4 h-11 border border-border/15 opacity-60 cursor-not-allowed">
                                                                <span className="text-base font-bold font-mono text-foreground/60">{editValues.customerCost.toLocaleString('ar-LY')}</span>
                                                                <span className="text-xs text-muted-foreground/50 mr-1">د.ل</span>
                                                              </div>
                                                            ) : (
                                                              <InlinePriceInput 
                                                                value={editValues.customerCost}
                                                                onChange={val => setEditValues(prev => ({...prev, customerCost: val}))}
                                                                label=""
                                                                showLabel={false}
                                                                className="flex-1"
                                                              />
                                                            )}
                                                            <Button 
                                                              size="sm" 
                                                              variant="outline" 
                                                              className="h-11 w-11 p-0 shrink-0 rounded-xl text-purple-600 border-purple-250 hover:bg-purple-50/50 transition-colors" 
                                                              onClick={() => setEditValues(prev => ({ ...prev, customerCost: 0 }))} 
                                                              title="مجاني"
                                                              disabled={isFirstInstallation}
                                                            >
                                                              <Gift className="h-5 w-5" />
                                                            </Button>
                                                          </div>
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
                                                         <Label className="text-sm font-semibold text-muted-foreground block leading-relaxed">ملاحظات وسبب إضافية العميل</Label>
                                                         <Input dir="rtl" value={editValues.additionalNotes} onChange={e => setEditValues(prev => ({...prev, additionalNotes: e.target.value}))} placeholder="تجهيزات معينة للموقع، عمل ليلي..." className="h-11 text-xs rounded-xl text-right" />
                                                       </div>

                                                       {/* الزبون سدد التكاليف */}
                                                       <div className="col-span-1 sm:col-span-2 flex items-center justify-between gap-3 bg-amber-500/[0.03] border border-amber-500/10 p-3 rounded-xl shadow-sm mt-1 text-right">
                                                         <div className="flex flex-col">
                                                           <span className="text-xs font-bold text-amber-700 dark:text-amber-400">حالة سداد التكاليف للزبون</span>
                                                           <span className="text-[10px] text-muted-foreground mt-0.5">تصفير التكاليف للشركة وللزبون (بدون تكاليف)</span>
                                                         </div>
                                                         <Button
                                                           size="sm"
                                                           variant={editValues.customerCost === 0 && editValues.companyCost === 0 ? "default" : "outline"}
                                                           className={cn(
                                                             "h-9 px-4 text-xs font-bold gap-2 rounded-xl transition-all cursor-pointer",
                                                             editValues.customerCost === 0 && editValues.companyCost === 0
                                                               ? "bg-amber-500 hover:bg-amber-600 text-black border-0 shadow-sm animate-pulse"
                                                               : "border-amber-500/20 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10"
                                                           )}
                                                           onClick={() => setEditValues(prev => ({ ...prev, customerCost: 0, companyCost: 0 }))}
                                                           disabled={isFirstInstallation}
                                                           type="button"
                                                         >
                                                           <CheckCircle2 className="h-4 w-4" />
                                                           <span>{editValues.customerCost === 0 && editValues.companyCost === 0 ? "تم السداد والتصفير" : "سدد التكاليف / بدون تكاليف"}</span>
                                                         </Button>
                                                       </div>

                                                       <div className="space-y-2">
                                                         <Label className="text-sm font-semibold text-muted-foreground block leading-relaxed text-right">ملاحظات وسبب إضافية الشركة</Label>
                                                         <Input dir="rtl" value={editValues.companyAdditionalNotes} onChange={e => setEditValues(prev => ({...prev, companyAdditionalNotes: e.target.value}))} placeholder="تراخيص، رافعة تلسكوبية..." className="h-11 text-xs rounded-xl text-right" />
                                                       </div>

                                                      <div className="space-y-2 col-span-2 border-t border-border/10 pt-4 mt-2">
                                                        <Label className="text-sm font-semibold text-purple-600 block leading-relaxed">هل تحتوي هذه اللوحة على مجسم؟</Label>
                                                        <div className="flex items-center gap-3.5 h-11 px-4 bg-background border border-border/15 rounded-xl">
                                                          <Switch 
                                                            checked={editValues.hasCutout} 
                                                            onCheckedChange={val => setEditValues(prev => ({...prev, hasCutout: val}))} 
                                                          />
                                                          <span className="text-xs sm:text-sm text-muted-foreground font-semibold leading-relaxed">نعم، تفعيل خيارات ومواصفات المجسمات لهذه اللوحة</span>
                                                        </div>
                                                      </div>

                                                      {task.print_task_id && (
                                                        <div className="space-y-2 col-span-2 border-t border-border/10 pt-4 mt-2">
                                                          <Label className="text-sm font-semibold text-blue-600 block leading-relaxed">هل تتطلب هذه اللوحة طباعة؟</Label>
                                                          <div className="flex items-center gap-3.5 h-11 px-4 bg-background border border-border/15 rounded-xl">
                                                            <Switch 
                                                              checked={editValues.hasPrint} 
                                                              onCheckedChange={val => setEditValues(prev => ({...prev, hasPrint: val}))} 
                                                            />
                                                            <span className="text-xs sm:text-sm text-muted-foreground font-semibold leading-relaxed">نعم، تتطلب طباعة فلكس لهذه اللوحة ومزامنتها في جدول مهمة الطباعة</span>
                                                          </div>
                                                        </div>
                                                      )}
                                                    </div>
                                                  </div>
                                                );
                                              }
                                              
                                              // Normal Item Card View
                                              return (
                                                <div key={item.id} dir="rtl" className="group rounded-2xl border border-border/15 hover:border-primary/25 bg-card/45 hover:bg-card/90 transition-all duration-300 overflow-hidden shadow-sm hover:shadow-md text-right">
                                                  <div className="flex flex-col sm:flex-row items-stretch">
                                                    
                                                    {/* Image Thumbnail */}
                                                    <div className="w-full sm:w-28 shrink-0 relative bg-muted/30 flex items-center justify-center min-h-[90px] sm:min-h-0 border-b sm:border-b-0 sm:border-l border-border/10 sm:order-first">
                                                      {item.billboard.Image_URL ? (
                                                        <img src={item.billboard.Image_URL} alt="" className="w-full h-full object-cover absolute inset-0" />
                                                      ) : (
                                                        <LayoutGrid className="h-7 w-7 text-muted-foreground/20" />
                                                      )}
                                                      <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md rounded-md px-2.5 py-1 text-[13px] font-semibold text-white font-mono">
                                                        #{idx + 1}
                                                      </div>
                                                      {item.has_cutout && (
                                                        <div className="absolute bottom-2 right-2 bg-purple-600/90 backdrop-blur-sm text-white rounded-md px-3 py-1 text-[13px] font-semibold flex items-center gap-1.5 shadow-sm">
                                                          <Scissors className="h-3 w-3 shrink-0" />
                                                          <span>قص مجسم</span>
                                                        </div>
                                                      )}
                                                    </div>

                                                    {/* Card Content details */}
                                                    <div className="flex-1 p-5 min-w-0">
                                                      <div className="flex items-start justify-between gap-3 text-right">
                                                        <div className="min-w-0">
                                                          <div className="font-bold text-[15px] truncate text-foreground group-hover:text-primary transition-colors">
                                                            {item.billboard.Billboard_Name || `لوحة رمز #${String(item.billboard_id).padStart(4, '0')}`}
                                                          </div>
                                                          {item.billboard.Nearest_Landmark && (
                                                            <div className="text-[13px] text-muted-foreground flex items-center gap-1.5 mt-1.5 truncate text-right">
                                                              <Landmark className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                                                              <span className="truncate">{item.billboard.Nearest_Landmark}</span>
                                                            </div>
                                                          )}
                                                        </div>

                                                        {/* Actions */}
                                                        <div className="flex items-center gap-1 shrink-0 opacity-100 sm:opacity-0 group-hover:opacity-100 transition-all duration-300">
                                                          <Button 
                                                            size="sm" 
                                                            variant="ghost" 
                                                            className="h-8.5 w-8.5 p-0 rounded-lg hover:bg-primary/10 hover:text-primary" 
                                                            onClick={() => startEditingItem(item)}
                                                            title="تعديل تفاصيل وأسعار هذه اللوحة"
                                                          >
                                                            <Pencil className="h-4.5 w-4.5" />
                                                          </Button>
                                                          {item.customer_installation_cost > 0 && (
                                                            <Button 
                                                              size="sm" 
                                                              variant="ghost" 
                                                              className="h-8.5 w-8.5 p-0 rounded-lg text-purple-600 hover:bg-purple-50 hover:text-purple-755" 
                                                              onClick={() => handleSetFree(item.id)} 
                                                              disabled={distributing}
                                                              title="إلغاء التكلفة وجعل التركيب مجانياً"
                                                            >
                                                              <Gift className="h-4.5 w-4.5" />
                                                            </Button>
                                                          )}
                                                        </div>
                                                      </div>

                                                      {/* Badges details */}
                                                      <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                                                        <Badge variant="secondary" className="text-[13px] font-semibold px-3 py-1 rounded-md bg-muted border border-border/10 text-foreground">{itemArea.toFixed(1)} م²</Badge>
                                                        <Badge variant="secondary" className="text-[13px] font-semibold px-3 py-1 rounded-md bg-muted border border-border/10 text-foreground">{faces} أوجه</Badge>
                                                        {pricingType === 'piece' && item.pricing_type === 'meter' && (
                                                          <Badge variant="outline" className="text-[13px] px-3 py-1 rounded-md bg-amber-500/[0.02] text-amber-600 border-amber-200/40 font-medium">مُسعّر بالمتر</Badge>
                                                        )}
                                                        {pricingType === 'meter' && item.pricing_type && item.pricing_type !== 'meter' && (
                                                          <Badge variant="outline" className="text-[13px] px-3 py-1 rounded-md bg-amber-500/[0.02] text-amber-600 border-amber-200/40 font-medium">مُسعّر بالقطعة</Badge>
                                                        )}
                                                      </div>

                                                      {/* Pricing table for this item */}
                                                      <div className="mt-4 pt-3.5 border-t border-border/10 grid grid-cols-1 sm:grid-cols-2 gap-y-2.5 gap-x-4 text-right">
                                                        <div className="flex items-center justify-between gap-3 text-xs font-semibold">
                                                          <span className="text-muted-foreground/80 flex items-center gap-1.5">
                                                            <Wrench className="h-3.5 w-3.5 text-muted-foreground/50" /> 
                                                            <span>التركيب:</span>
                                                          </span>
                                                          <div className="flex items-center gap-2 flex-wrap justify-end text-left">
                                                            <span className="text-amber-600 font-medium font-mono text-xs">{itemCompanyCost.toLocaleString('ar-LY')} د.ل (شركة)</span>
                                                            <span className="text-muted-foreground/30">•</span>
                                                            {isItemReinstalled ? (
                                                              <div className="flex flex-col gap-1 font-mono text-xs">
                                                                <div className="flex items-center gap-1.5">
                                                                  <span className="font-bold text-primary">{(item.customer_original_install_cost || 0).toLocaleString('ar-LY')} د.ل</span>
                                                                  <span className="text-[10px] text-muted-foreground/60">(أصلي)</span>
                                                                </div>
                                                                <div className="flex items-center gap-1.5">
                                                                  <span className="font-bold text-orange-600">{(item.customer_reinstall_cost || item.customer_installation_cost || 0).toLocaleString('ar-LY')} د.ل</span>
                                                                  <span className="text-[10px] text-muted-foreground/60">(إعادة تركيب)</span>
                                                                </div>
                                                                <div className="flex items-center gap-1 border-t border-border/10 pt-1 mt-0.5">
                                                                  <span className="font-bold text-emerald-600">{((item.customer_original_install_cost || 0) + (item.customer_reinstall_cost || item.customer_installation_cost || 0)).toLocaleString('ar-LY')} د.ل</span>
                                                                  <span className="text-[10px] text-muted-foreground/60">(إجمالي زبون)</span>
                                                                </div>
                                                              </div>
                                                            ) : item.customer_installation_cost === 0 ? (
                                                              <Badge className="bg-purple-100 text-purple-750 dark:bg-purple-950/30 dark:text-purple-300 text-xs px-2 py-0.5 font-bold rounded-lg border-none shadow-none">
                                                                <Gift className="h-3 w-3 me-1 inline" />مجاني
                                                              </Badge>
                                                            ) : (
                                                              <div className="flex items-center gap-1 font-mono text-xs">
                                                                <span className="font-bold text-primary">{item.customer_installation_cost.toLocaleString('ar-LY')} د.ل (زبون)</span>
                                                                {pricingType === 'piece' && itemArea > 0 && (
                                                                  <span className="text-xs text-muted-foreground/60 font-semibold">≈{(item.customer_installation_cost / itemArea).toFixed(0)}/م²</span>
                                                                )}
                                                              </div>
                                                            )}
                                                          </div>
                                                        </div>
                                                        
                                                        {task.print_task_id && (
                                                           <div className="flex items-center justify-between gap-3 text-xs font-semibold border-t sm:border-t-0 pt-2.5 sm:pt-0 border-border/10">
                                                            <span className="text-muted-foreground/80 flex items-center gap-1.5">
                                                              <Printer className="h-3.5 w-3.5 text-blue-500/70" /> 
                                                              <span>الطباعة المقابلة:</span>
                                                            </span>
                                                             {printBillboardIds.includes(item.billboard_id) ? (
                                                               <div className="flex items-center gap-2 flex-wrap justify-end font-mono text-xs text-left">
                                                                 <span className="text-blue-600 font-medium">{itemPrintCostCompany.toLocaleString('ar-LY', { maximumFractionDigits: 0 })} د.ل (شركة)</span>
                                                                 <span className="text-muted-foreground/30">•</span>
                                                                 <span className="font-bold text-blue-600">{itemPrintCostCustomer.toLocaleString('ar-LY', { maximumFractionDigits: 0 })} د.ل (زبون)</span>
                                                               </div>
                                                             ) : (
                                                               <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border/10 font-bold px-2 py-0.5 rounded-lg shadow-none">
                                                                 مستثناة من الطباعة
                                                               </Badge>
                                                             )}
                                                          </div>
                                                        )}
                                                      </div>

                                                    </div>
                                                    
                                                    {/* Side Print Toggle Column */}
                                                    {task.print_task_id && (
                                                      <div className={cn(
                                                        "w-full sm:w-44 shrink-0 flex flex-col items-center justify-center gap-2.5 p-5 border-t sm:border-t-0 sm:border-r border-border/10 transition-all duration-300 text-center select-none",
                                                        printBillboardIds.includes(item.billboard_id) 
                                                          ? "bg-blue-500/[0.03] text-blue-600 dark:text-blue-400" 
                                                          : "bg-muted/[0.05] text-muted-foreground/50"
                                                      )}>
                                                        <div className="flex items-center gap-2">
                                                          <Printer className={cn(
                                                            "h-5 w-5 transition-all duration-300",
                                                            printBillboardIds.includes(item.billboard_id) ? "text-blue-500 scale-110 drop-shadow-[0_0_8px_rgba(59,130,246,0.3)] animate-pulse" : "text-muted-foreground/30"
                                                          )} />
                                                          <span className="text-xs font-bold">حالة الطباعة</span>
                                                        </div>
                                                        <div className={cn(
                                                          "flex items-center gap-2.5 bg-background border rounded-xl px-3 py-1.5 shadow-sm transition-all",
                                                          printBillboardIds.includes(item.billboard_id) ? "border-blue-500/30" : "border-border/15"
                                                        )}>
                                                          <span className={cn("text-xs font-bold", printBillboardIds.includes(item.billboard_id) ? "text-blue-600 dark:text-blue-400" : "text-muted-foreground/60")}>
                                                            {printBillboardIds.includes(item.billboard_id) ? "تتطلب طباعة" : "مستثناة"}
                                                          </span>
                                                          <Switch 
                                                            checked={printBillboardIds.includes(item.billboard_id)} 
                                                            onCheckedChange={(checked) => handleTogglePrintStatus(item.billboard_id, checked)}
                                                            disabled={distributing}
                                                            className="scale-90 origin-center data-[state=checked]:bg-blue-500"
                                                          />
                                                        </div>
                                                      </div>
                                                    )}
                                                  </div>
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
                      </div>
                    </>
                  ) : (
                    /* Manual installation input form */
                    <Card dir="rtl" className="border-border/15 bg-card/45 backdrop-blur-md rounded-2xl shadow-sm text-right">
                      <CardHeader className="p-4.5 border-b border-border/10 bg-muted/10">
                        <CardTitle className="text-xs font-bold flex items-center gap-2 text-foreground text-right">
                          <Wrench className="h-4.5 w-4.5 text-muted-foreground" />
                          <span>بيانات تكاليف التركيب اليدوية (لا توجد مهمة تركيب بقاعدة البيانات)</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-5 space-y-4">
                         <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-right">
                          <div className="space-y-2">
                             <Label className="text-xs font-semibold text-emerald-600 block text-right">سعر الخدمة النهائي للزبون</Label>
                            <InlinePriceInput 
                              value={manualCustomerInstallationCost} 
                              onChange={setManualCustomerInstallationCost} 
                              label="" 
                              showLabel={false}
                              className="w-full"
                            />
                          </div>
                          <div className="space-y-2">
                             <Label className="text-xs font-semibold text-amber-600 block text-right">تكلفة الخدمة على الشركة</Label>
                            <InlinePriceInput 
                              value={manualCompanyInstallationCost} 
                              onChange={setManualCompanyInstallationCost} 
                              label="" 
                              showLabel={false}
                              className="w-full"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-amber-500/[0.02] border border-amber-500/10 text-xs text-amber-655 leading-relaxed font-semibold">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                          <span>تنبيه: سيتم حفظ المبالغ المدخلة يدوياً وتطبيقها مباشرة على فاتورة العميل وإجمالي التكاليف العامة.</span>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              )}

              {/* ═══════ TAB: الطباعة ═══════ */}
              {isPrintActive && (
                <TabsContent value="print" className="mt-0 p-5 sm:p-6 space-y-6">
                  {task.print_task_id && totalPrintArea > 0 ? (
                    <>
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <h3 className="font-bold text-base flex items-center gap-2.5 text-foreground">
                          <Printer className="h-5 w-5 text-blue-600" />
                          <span>تسعير الطباعة</span>
                        </h3>
                        <Badge variant="outline" className="text-xs font-semibold bg-blue-500/10 text-blue-600 border-blue-500/20 px-3 py-1 rounded-full">
                          المساحة {totalPrintArea.toFixed(1)} م²
                        </Badge>
                      </div>

                      {/* Printer selection */}
                       <Card className="border-blue-200/40 bg-blue-500/[0.01] rounded-2xl shadow-sm">
                         <CardContent className="p-5 sm:p-6 space-y-3.5" dir="rtl">
                           <Label className="text-sm font-semibold flex items-center gap-2 text-blue-600">
                             <Printer className="h-4 w-4" />
                             <span>المطبعة المسؤولة عن الطباعة</span>
                           </Label>
                           <Select
                             value={selectedPrinterId || 'none'}
                             onValueChange={(v) => setSelectedPrinterId(v === 'none' ? null : v)}
                           >
                             <SelectTrigger dir="rtl" className="h-11 sm:h-12 rounded-xl bg-background border-border/20 text-sm px-3.5 text-right">
                               <SelectValue placeholder="اختر مطبعة من قائمة المطابع النشطة" />
                             </SelectTrigger>
                             <SelectContent className="text-sm">
                               <SelectItem value="none">-- غير محدد --</SelectItem>
                               {printers.map(p => (
                                 <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                               ))}
                             </SelectContent>
                           </Select>
                           <p className="text-[13px] text-muted-foreground/80 block leading-relaxed">ملاحظة: سيتم مزامنة اسم وتكلفة المطبعة تلقائياً مع تفاصيل مهمة الطباعة الحالية.</p>
                         </CardContent>
                       </Card>

                      {/* Controls input fields */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <PriceInputWithControls
                          value={customerPrintPerMeter}
                          onChange={setCustomerPrintPerMeter}
                          label="سعر المتر المربع (فاتورة الزبون)"
                          totalLabel="إجمالي مبيعات الطباعة:"
                          totalValue={customerPrintTotal}
                          colorClass="text-emerald-600"
                        />

                        <PriceInputWithControls
                          value={companyPrintPerMeter}
                          onChange={setCompanyPrintPerMeter}
                          label="سعر المتر المربع (تكلفة الشركة)"
                          totalLabel="إجمالي تكلفة الطباعة:"
                          totalValue={companyPrintTotal}
                          colorClass="text-blue-600"
                        />
                      </div>

                      {/* Estimated total meter price breakdown */}
                      <Card className="border-primary/20 bg-primary/[0.01] rounded-2xl shadow-sm">
                        <CardContent className="p-5 space-y-4">
                          <div className="flex items-center gap-2.5">
                            <div className="h-9 w-9 rounded-xl bg-primary/10 border border-primary/15 flex items-center justify-center text-primary shadow-inner">
                              <Calculator className="h-4.5 w-4.5" />
                            </div>
                            <div>
                              <h4 className="text-sm font-bold text-foreground">سعر المتر المربع الإجمالي التقديري</h4>
                              <p className="text-xs text-muted-foreground mt-0.5 leading-normal">يشمل (الطباعة + التركيب) لتقييم كفاءة التسعير</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            <div className="p-4 rounded-xl bg-card border border-border/10 shadow-sm text-center space-y-1">
                              <div className="text-xs text-muted-foreground font-semibold">متوسط بيع المتر للزبون</div>
                              <div className="text-xl font-bold text-primary font-mono text-base">
                                {(customerPrintPerMeter + (totals.totalArea > 0 ? totals.customerCost / totals.totalArea : 0)).toFixed(1)}
                                <span className="text-xs font-semibold text-muted-foreground/60 mr-1">د.ل/م²</span>
                              </div>
                              <div className="text-xs text-muted-foreground/80 font-medium leading-normal">
                                (طباعة + {(totals.totalArea > 0 ? totals.customerCost / totals.totalArea : 0).toFixed(1)} تركيب {customerPrintPerMeter.toFixed(1)})
                              </div>
                            </div>
                            <div className="p-4 rounded-xl bg-card border border-border/10 shadow-sm text-center space-y-1">
                              <div className="text-xs text-muted-foreground font-semibold">متوسط تكلفة المتر للشركة</div>
                              <div className="text-xl font-bold text-amber-600 font-mono text-base">
                                {(companyPrintPerMeter + (totals.totalArea > 0 ? totals.companyCost / totals.totalArea : 0)).toFixed(1)}
                                <span className="text-xs font-semibold text-muted-foreground/60 mr-1">د.ل/م²</span>
                              </div>
                              <div className="text-xs text-muted-foreground/80 font-medium leading-normal">
                                (طباعة + {(totals.totalArea > 0 ? totals.companyCost / totals.totalArea : 0).toFixed(1)} تركيب {companyPrintPerMeter.toFixed(1)})
                              </div>
                            </div>
                          </div>
                          <div className="text-center p-3.5 rounded-xl bg-muted/15 border border-border/10 text-xs font-bold font-mono">
                            <span className="text-muted-foreground font-sans text-xs">إجمالي (الطباعة + التركيب): </span>
                            <span className="text-primary font-bold text-xs">{(customerPrintTotal + totals.customerCost).toLocaleString('ar-LY')} د.ل (بيع)</span>
                            <span className="text-muted-foreground/35 mx-2 font-light">/</span>
                            <span className="text-amber-600 font-bold text-xs">{(companyPrintTotal + totals.companyCost).toLocaleString('ar-LY')} د.ل (تكلفة)</span>
                          </div>
                        </CardContent>
                      </Card>

                      {/* Profit summary for Print */}
                      <div className={cn("p-4.5 rounded-2xl border text-center shadow-sm backdrop-blur-md", 
                        customerPrintTotal - companyPrintTotal >= 0 
                          ? "border-emerald-500/15 bg-emerald-500/[0.02] text-emerald-650" 
                          : "border-rose-500/15 bg-rose-500/[0.02] text-rose-655")}>
                        <div className="text-xs font-semibold text-muted-foreground/80 mb-1.5 leading-normal">صافي ربح الطباعة المتوقع</div>
                        <div className="text-2xl font-bold font-mono">
                          {(customerPrintTotal - companyPrintTotal).toLocaleString('ar-LY')}
                          <span className="text-xs font-bold mr-1">د.ل</span>
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Manual print cost form */
                    <Card dir="rtl" className="border-border/15 bg-card/40 backdrop-blur-md rounded-2xl shadow-sm text-right">
                      <CardHeader className="p-4.5 border-b border-border/10 bg-muted/10">
                        <CardTitle className="text-xs font-bold flex items-center gap-2 text-foreground text-right">
                          <Printer className="h-4.5 w-4.5 text-muted-foreground" />
                          <span>بيانات تكاليف الطباعة اليدوية (لا توجد مهمة طباعة بقاعدة البيانات)</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-5 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-right">
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-emerald-600 block text-right">سعر مبيعات الطباعة للزبون</Label>
                            <InlinePriceInput 
                              value={manualCustomerPrintCost} 
                              onChange={setManualCustomerPrintCost} 
                              label="" 
                              showLabel={false}
                              className="w-full"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-amber-600 block text-right">تكلفة الطباعة على الشركة</Label>
                            <InlinePriceInput 
                              value={manualCompanyPrintCost} 
                              onChange={setManualCompanyPrintCost} 
                              label="" 
                              showLabel={false}
                              className="w-full"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-amber-500/[0.02] border border-amber-500/10 text-xs text-amber-655 leading-relaxed font-semibold">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                          <span>تنبيه: سيتم حفظ المبالغ المدخلة يدوياً وتطبيقها مباشرة على فاتورة العميل وإجمالي التكاليف العامة.</span>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              )}

              {/* ═══════ TAB: المجسمات والقص ═══════ */}
              {isCutoutActive && (
                <TabsContent value="cutout" className="mt-0 p-5 sm:p-6 space-y-6">
                  {task.cutout_task_id || taskItems.some(i => i.has_cutout) ? (
                    <CutoutPerBillboardEditor
                      items={taskItems.map(it => ({
                        id: it.id,
                        billboard_id: it.billboard_id,
                        has_cutout: it.has_cutout,
                        cutout_workshop_id: it.cutout_workshop_id,
                        cutout_company_cost: it.cutout_company_cost,
                        cutout_customer_cost: it.cutout_customer_cost,
                        cutout_count: it.cutout_count,
                        cutout_image_url: it.cutout_image_url,
                        cutout_notes: it.cutout_notes,
                        design_image_url: designImagesByBillboard[it.billboard_id] || null,
                        billboard: billboards[it.billboard_id] as any,
                      }))}
                      onChange={(next) => {
                        setTaskItems(prev => prev.map(p => {
                          const u = next.find(n => n.id === p.id);
                          return u ? { ...p, ...u } : p;
                        }));
                      }}
                    />
                  ) : (
                    /* Manual cutout cost form */
                    <Card dir="rtl" className="border-border/15 bg-card/40 backdrop-blur-md rounded-2xl shadow-sm text-right">
                      <CardHeader className="p-4.5 border-b border-border/10 bg-muted/10">
                        <CardTitle className="text-xs font-bold flex items-center gap-2 text-foreground text-right">
                          <Scissors className="h-4.5 w-4.5 text-muted-foreground" />
                          <span>بيانات تكاليف المجسمات والقص اليدوية</span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="p-5 space-y-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-right">
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-emerald-600 block text-right">سعر مبيعات المجسمات للزبون</Label>
                            <InlinePriceInput 
                              value={manualCustomerCutoutCost} 
                              onChange={setManualCustomerCutoutCost} 
                              label="" 
                              showLabel={false}
                              className="w-full"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-amber-600 block text-right">تكلفة المجسمات على الشركة</Label>
                            <InlinePriceInput 
                              value={manualCompanyCutoutCost} 
                              onChange={setManualCompanyCutoutCost} 
                              label="" 
                              showLabel={false}
                              className="w-full"
                            />
                          </div>
                        </div>
                        <div className="flex items-center gap-2 p-3.5 rounded-xl bg-amber-500/[0.02] border border-amber-500/10 text-xs text-amber-655 leading-relaxed font-semibold">
                          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-600" />
                          <span>تنبيه: سيتم حفظ المبالغ المدخلة يدوياً وتطبيقها مباشرة على فاتورة العميل وإجمالي التكاليف العامة.</span>
                        </div>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              )}

              {/* ═══════ TAB: الملخص المالي ═══════ */}
              <TabsContent value="summary" className="mt-0 p-5 sm:p-6 space-y-6">
                
                {/* Active Services Controllers */}
                <Card dir="rtl" className="border-border/15 bg-card/50 backdrop-blur-md rounded-2xl shadow-sm text-right">
                  <CardHeader className="p-4.5 border-b border-border/10 bg-muted/10">
                    <CardTitle className="text-xs font-bold flex items-center gap-2 text-foreground text-right">
                      <LayoutGrid className="h-4 w-4 text-muted-foreground" />
                      <span>إدارة تفعيل خدمات المهمة المجمعة</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-5 space-y-5">
                    
                    {/* Installation Switch */}
                    <div className="flex flex-col gap-3.5 p-4 rounded-xl border border-border/10 bg-background/25">
                      <div className="flex items-center justify-between gap-4 text-right">
                        <div className="flex items-center gap-3 min-w-0 text-right">
                          <div className={cn("h-9.5 w-9.5 rounded-lg flex items-center justify-center shrink-0 border border-border/5 shadow-inner", isInstallationActive ? "bg-orange-500/10 text-orange-600" : "bg-muted text-muted-foreground/60")}>
                            <Wrench className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <span className="text-xs font-bold block text-foreground">خدمة التركيب واللوحات</span>
                            <span className="text-xs text-muted-foreground/80 block mt-0.5 leading-normal">
                              {task.installation_task_id ? "مهمة تركيب مفعّلة تلقائياً من قاعدة البيانات" : "إضافة/تعديل تكاليف تركيب يدوية"}
                            </span>
                          </div>
                        </div>
                        <Switch checked={isInstallationActive} onCheckedChange={setIsInstallationActive} disabled={!!task.installation_task_id} />
                      </div>
                      {isInstallationActive && !task.installation_task_id && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border/10 text-right">
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-emerald-650 block text-right">سعر التركيب للزبون</Label>
                            <InlinePriceInput 
                              value={manualCustomerInstallationCost} 
                              onChange={setManualCustomerInstallationCost} 
                              label="" 
                              showLabel={false}
                              className="w-full"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-amber-655 block text-right">تكلفة التركيب للشركة</Label>
                            <InlinePriceInput 
                              value={manualCompanyInstallationCost} 
                              onChange={setManualCompanyInstallationCost} 
                              label="" 
                              showLabel={false}
                              className="w-full"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Print Switch */}
                    <div className="flex flex-col gap-3.5 p-4 rounded-xl border border-border/10 bg-background/25">
                      <div className="flex items-center justify-between gap-4 text-right">
                        <div className="flex items-center gap-3 min-w-0 text-right">
                          <div className={cn("h-9.5 w-9.5 rounded-lg flex items-center justify-center shrink-0 border border-border/5 shadow-inner", isPrintActive ? "bg-blue-500/10 text-blue-600" : "bg-muted text-muted-foreground/60")}>
                            <Printer className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <span className="text-xs font-bold block text-foreground">خدمة الطباعة والفلكس</span>
                            <span className="text-xs text-muted-foreground/80 block mt-0.5 leading-normal">
                              {task.print_task_id ? "مهمة طباعة مفعّلة تلقائياً من قاعدة البيانات" : "تفعيل وإضافة تكلفة طباعة مخصصة"}
                            </span>
                          </div>
                        </div>
                        <Switch checked={isPrintActive} onCheckedChange={setIsPrintActive} disabled={!!task.print_task_id} />
                      </div>
                      {isPrintActive && !task.print_task_id && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border/10 text-right">
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-emerald-650 block text-right">سعر الطباعة للعميل</Label>
                            <InlinePriceInput 
                              value={manualCustomerPrintCost} 
                              onChange={setManualCustomerPrintCost} 
                              label="" 
                              showLabel={false}
                              className="w-full"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-amber-655 block text-right">تكلفة الطباعة للشركة</Label>
                            <InlinePriceInput 
                              value={manualCompanyPrintCost} 
                              onChange={setManualCompanyPrintCost} 
                              label="" 
                              showLabel={false}
                              className="w-full"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Cutout Switch */}
                    <div className="flex flex-col gap-3.5 p-4 rounded-xl border border-border/10 bg-background/25">
                      <div className="flex items-center justify-between gap-4 text-right">
                        <div className="flex items-center gap-3 min-w-0 text-right">
                          <div className={cn("h-9.5 w-9.5 rounded-lg flex items-center justify-center shrink-0 border border-border/5 shadow-inner", isCutoutActive ? "bg-purple-500/10 text-purple-650" : "bg-muted text-muted-foreground/60")}>
                            <Scissors className="h-4.5 w-4.5" />
                          </div>
                          <div>
                            <span className="text-xs font-bold block text-foreground">خدمة صناعة وقص المجسمات</span>
                            <span className="text-xs text-muted-foreground/80 block mt-0.5 leading-normal">
                              {task.cutout_task_id || taskItems.some(i => i.has_cutout) ? "مهمة مجسمات مفعّلة تلقائياً من تفاصيل اللوحات" : "تفعيل وإضافة تكلفة مجسمات يدوية"}
                            </span>
                          </div>
                        </div>
                        <Switch checked={isCutoutActive} onCheckedChange={setIsCutoutActive} disabled={!!task.cutout_task_id || taskItems.some(i => i.has_cutout)} />
                      </div>
                      {isCutoutActive && !task.cutout_task_id && !taskItems.some(i => i.has_cutout) && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-border/10 text-right">
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-emerald-650 block text-right">سعر المجسمات للعميل</Label>
                            <InlinePriceInput 
                              value={manualCustomerCutoutCost} 
                              onChange={setManualCustomerCutoutCost} 
                              label="" 
                              showLabel={false}
                              className="w-full"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-semibold text-amber-655 block text-right">تكلفة المجسمات للشركة</Label>
                            <InlinePriceInput 
                              value={manualCompanyCutoutCost} 
                              onChange={setManualCompanyCutoutCost} 
                              label="" 
                              showLabel={false}
                              className="w-full"
                            />
                          </div>
                        </div>
                      )}
                    </div>

                  </CardContent>
                </Card>

                {/* Review Table */}
                <Card className={cn("border-2 rounded-2xl overflow-hidden shadow-sm backdrop-blur-md", 
                  netProfit >= 0 ? "border-emerald-500/15" : "border-rose-500/15")}>
                  <div className="p-4 bg-muted/15 border-b border-border/10 flex items-center justify-between gap-4 text-right">
                    <CardTitle className="text-xs font-bold flex items-center gap-2 text-right">
                      <Calculator className="h-4 w-4 text-muted-foreground" />
                      <span>جدول مراجعة وتحليل ربحية المهمة</span>
                    </CardTitle>
                    <Badge variant={netProfit >= 0 ? "default" : "destructive"} className="text-xs font-semibold py-0.5 rounded-md px-2 border-none">
                      {netProfit >= 0 ? 'رابحة' : 'خسارة'}
                    </Badge>
                  </div>
                  <CardContent className="p-0">
                    <div className="overflow-x-auto">
                      <table dir="rtl" className="w-full text-xs text-right">
                        <thead>
                          <tr className="bg-muted/20 border-b border-border/10">
                            <th className="text-right p-3.5 font-bold text-muted-foreground">بند الخدمة</th>
                            <th className="text-center p-3.5 font-bold text-emerald-600">فاتورة العميل</th>
                            <th className="text-center p-3.5 font-bold text-amber-600">تكلفة الشركة</th>
                            <th className="text-center p-3.5 font-bold text-foreground">صافي الربح</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/10 font-semibold font-mono">
                          {isInstallationActive && (
                            <tr className="hover:bg-muted/[0.04] transition-colors">
                              <td className="p-3.5 flex items-center gap-2.5 text-foreground font-semibold font-sans">
                                <div className="h-8 w-8 rounded-lg bg-orange-500/10 flex items-center justify-center text-orange-600 border border-orange-500/10"><Wrench className="h-4 w-4" /></div>
                                <span>التركيب واللوحات</span>
                              </td>
                              <td className="p-3.5 text-center text-emerald-600">{customerInstallationTotal.toLocaleString('ar-LY')} د.ل</td>
                              <td className="p-3.5 text-center text-amber-600">{companyInstallationTotal.toLocaleString('ar-LY')} د.ل</td>
                              <td className={cn("p-3.5 text-center font-bold", customerInstallationTotal - companyInstallationTotal >= 0 ? "text-emerald-600" : "text-rose-600")}>
                                {(customerInstallationTotal - companyInstallationTotal).toLocaleString('ar-LY')} د.ل
                              </td>
                            </tr>
                          )}
                          
                          {isPrintActive && (
                            <tr className="hover:bg-muted/[0.04] transition-colors">
                              <td className="p-3.5 flex items-center gap-2.5 text-foreground font-semibold font-sans">
                                <div className="h-8 w-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 border border-blue-500/10"><Printer className="h-4 w-4" /></div>
                                <span>الطباعة والفلكس</span>
                              </td>
                              <td className="p-3.5 text-center text-emerald-600">{customerPrintTotal.toLocaleString('ar-LY')} د.ل</td>
                              <td className="p-3.5 text-center text-amber-600">{companyPrintTotal.toLocaleString('ar-LY')} د.ل</td>
                              <td className={cn("p-3.5 text-center font-bold", customerPrintTotal - companyPrintTotal >= 0 ? "text-emerald-600" : "text-rose-600")}>
                                {(customerPrintTotal - companyPrintTotal).toLocaleString('ar-LY')} د.ل
                              </td>
                            </tr>
                          )}

                          {isCutoutActive && (
                            <tr className="hover:bg-muted/[0.04] transition-colors">
                              <td className="p-3.5 flex items-center gap-2.5 text-foreground font-semibold font-sans">
                                <div className="h-8 w-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600 border border-purple-500/10"><Scissors className="h-4 w-4" /></div>
                                <span>صناعة وقص المجسمات</span>
                              </td>
                              <td className="p-3.5 text-center text-emerald-600">{customerCutoutTotal.toLocaleString('ar-LY')} د.ل</td>
                              <td className="p-3.5 text-center text-amber-600">{companyCutoutTotal.toLocaleString('ar-LY')} د.ل</td>
                              <td className={cn("p-3.5 text-center font-bold", customerCutoutTotal - companyCutoutTotal >= 0 ? "text-emerald-600" : "text-rose-600")}>
                                {(customerCutoutTotal - companyCutoutTotal).toLocaleString('ar-LY')} د.ل
                              </td>
                            </tr>
                          )}

                          {discountAmount > 0 && (
                            <tr className="bg-rose-500/[0.01] border-t border-border/10">
                              <td className="p-3.5 flex items-center gap-2.5 text-rose-650 font-semibold font-sans">
                                <div className="h-8 w-8 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-600 border border-rose-500/10"><DollarSign className="h-4 w-4" /></div>
                                <span>تخفيض إضافي عام للمهمة</span>
                              </td>
                              <td className="p-3.5 text-center text-rose-600 font-bold">-{discountAmount.toLocaleString('ar-LY')} د.ل</td>
                              <td className="p-3.5 text-center text-muted-foreground/40 font-light font-sans">—</td>
                              <td className="p-3.5 text-center text-rose-600 font-bold">-{discountAmount.toLocaleString('ar-LY')} د.ل</td>
                            </tr>
                          )}
                        </tbody>
                        <tfoot className="bg-muted/15 font-bold border-t-2 border-border/15">
                          <tr>
                            <td className="p-4 text-sm font-bold text-foreground font-sans">المجموع الكلي للمهمة</td>
                            <td className="p-4 text-center text-emerald-600 text-sm font-bold font-mono">{customerTotal.toLocaleString('ar-LY')} د.ل</td>
                            <td className="p-4 text-center text-amber-600 text-sm font-bold font-mono">{companyTotal.toLocaleString('ar-LY')} د.ل</td>
                            <td className={cn("p-4 text-center text-sm font-bold flex items-center justify-center gap-1 font-mono",
                              netProfit >= 0 ? "text-emerald-600" : "text-rose-650")}>
                              {netProfit >= 0 ? <TrendingUp className="h-4 w-4 shrink-0" /> : <TrendingDown className="h-4 w-4 shrink-0" />}
                              <span>{netProfit.toLocaleString('ar-LY')} د.ل</span>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                    <div className="text-center py-3.5 border-t border-border/10 bg-muted/5 font-semibold text-xs text-muted-foreground">
                      <span>معدل العائد على المبيعات للمهمة (ROS): </span>
                      <span className={cn("text-sm font-bold font-mono mr-1", profitPercentage >= 0 ? "text-emerald-600" : "text-rose-600")}>
                        {profitPercentage.toFixed(1)}%
                      </span>
                    </div>
                  </CardContent>
                </Card>

                {/* Cost allocation section */}
                <CostAllocationSection
                  allocation={costAllocation}
                  onChange={setCostAllocation}
                  hasPrint={isPrintActive && customerPrintTotal > 0}
                  hasCutout={isCutoutActive && customerCutoutTotal > 0}
                  hasInstallation={isInstallationActive && customerInstallationTotal > 0}
                  originalCosts={{
                    customerPrint: customerPrintTotal, companyPrint: companyPrintTotal,
                    customerCutout: customerCutoutTotal, companyCutout: companyCutoutTotal,
                    customerInstallation: customerInstallationTotal, companyInstallation: companyInstallationTotal,
                  }}
                />

                {/* General adjustments form */}
                  <div dir="rtl" className="space-y-4 rounded-2xl border border-border/15 p-4.5 bg-card/50 backdrop-blur-md shadow-sm text-right">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-2 text-right">
                    <DollarSign className="h-4 w-4 text-muted-foreground" />
                    <span>الخصومات الإضافية والملاحظات الإدارية</span>
                  </h4>
                  <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-xs font-semibold text-rose-600 block text-right">قيمة الخصم العام (على الفاتورة)</Label>
                        <InlinePriceInput 
                          value={discountAmount}
                          onChange={setDiscountAmount}
                          label=""
                          showLabel={false}
                          className="w-full border-rose-150 text-rose-600"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label className="text-xs text-muted-foreground block leading-relaxed text-right">ملاحظات وسبب منح الخصم</Label>
                        <Input 
                          dir="rtl"
                          value={discountReason}
                          onChange={(e) => setDiscountReason(e.target.value)}
                          placeholder="مثال: خصم تعاقدي، تسوية مالية..." 
                          className="h-10 text-xs rounded-lg text-right"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs text-muted-foreground block leading-relaxed text-right">ملاحظات الفاتورة والتكاليف العامة</Label>
                      <Textarea 
                        dir="rtl"
                        value={notes} 
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="اكتب أي ملاحظات إدارية تود إظهارها على كشف حساب مراجعة الأرباح أو الفاتورة..." 
                        rows={3} 
                        className="text-xs rounded-lg resize-none leading-relaxed text-right"
                      />
                    </div>
                  </div>
                </div>

              </TabsContent>
            </ScrollArea>
          </Tabs>
        )}

        {/* ═══════ STICKY FOOTER ═══════ */}
        <div dir="rtl" className="shrink-0 border-t border-border/15 bg-card/95 backdrop-blur-md px-5 sm:px-6 py-4 flex items-center justify-between gap-4 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] text-right">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isSaving}
            className="rounded-xl px-5 text-xs sm:text-sm font-semibold border-border/20 h-11 hover:bg-muted/50 transition-colors shrink-0"
          >
            إلغاء
          </Button>

          <div className="hidden sm:flex items-center gap-4 px-4 py-1.5 rounded-xl bg-muted/30 border border-border/15">
            <div className="text-center">
              <div className="text-[10px] font-semibold text-muted-foreground/80 uppercase">العميل</div>
              <div className="text-sm font-bold font-mono text-emerald-600 leading-tight">{customerTotal.toLocaleString('ar-LY')} <span className="text-[10px] text-muted-foreground/60">د.ل</span></div>
            </div>
            <div className="h-8 w-px bg-border/20" />
            <div className="text-center">
              <div className="text-[10px] font-semibold text-muted-foreground/80 uppercase">التكلفة</div>
              <div className="text-sm font-bold font-mono text-amber-600 leading-tight">{companyTotal.toLocaleString('ar-LY')} <span className="text-[10px] text-muted-foreground/60">د.ل</span></div>
            </div>
            <div className="h-8 w-px bg-border/20" />
            <div className="text-center">
              <div className="text-[10px] font-semibold text-muted-foreground/80 uppercase">صافي الربح</div>
              <div className={cn("text-sm font-bold font-mono leading-tight flex items-center gap-1 justify-center", netProfit >= 0 ? "text-emerald-600" : "text-rose-600")}>
                {netProfit >= 0 ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
                <span>{netProfit.toLocaleString('ar-LY')}</span>
                <span className="text-[10px] text-muted-foreground/60">د.ل · {profitPercentage.toFixed(0)}%</span>
              </div>
            </div>
          </div>

          {/* Mobile compact total */}
          <div className="flex sm:hidden flex-col text-center px-2 min-w-0">
            <span className="text-[10px] text-muted-foreground/80 font-semibold uppercase">المستحق</span>
            <span className="text-base font-bold font-mono text-emerald-600 leading-none">{customerTotal.toLocaleString('ar-LY')} <span className="text-[10px] text-muted-foreground/60">د.ل</span></span>
          </div>

          <Button
            onClick={handleSave}
            disabled={isSaving || loading}
            className="rounded-xl px-6 text-sm font-bold h-11 shadow-md shadow-primary/15 transition-transform duration-200 active:scale-[0.98] shrink-0 gap-2"
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin shrink-0" />
                <span>جاري الحفظ...</span>
              </>
            ) : (
              <>
                <Save className="h-4 w-4 shrink-0" />
                <span>حفظ التعديلات</span>
              </>
            )}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
};
