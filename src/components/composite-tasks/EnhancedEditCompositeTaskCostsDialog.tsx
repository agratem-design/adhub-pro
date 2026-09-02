import React, { useState, useEffect, useMemo } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CompositeTaskWithDetails, UpdateCompositeTaskCostsInput } from '@/types/composite-task';
import {
  Wrench, Printer, Scissors, DollarSign,
  Calculator, Ruler, ChevronDown, ChevronUp,
  Building2, Landmark, LayoutGrid, Check, Square, Zap, Gift, Pencil, X, Save,
  Loader2, AlertCircle, AlertTriangle, CheckCircle2, Search, CheckSquare, Plus, Minus,
  Sparkles, Layers, FileText, MapPin, Box
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { CostAllocationSection, CostAllocationData, createDefaultCostAllocation } from './CostAllocationSection';
import { CutoutPerBillboardEditor } from './CutoutPerBillboardEditor';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { getSharedOperationCostsForTask } from '@/lib/compositeTaskOperation';
import { resolveInstallationFacesCount } from '@/lib/installationFaces';

interface EnhancedEditCompositeTaskCostsDialogProps {
  task: CompositeTaskWithDetails | null;
  tasks?: CompositeTaskWithDetails[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (input: UpdateCompositeTaskCostsInput) => void | Promise<void>;
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
  task_id?: string;
  teamName?: string;
  teamId?: string;
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
  reinstall_count?: number;
  customer_original_install_cost?: number;
  customer_reinstall_cost?: number;
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
  District?: string;
  City?: string;
  Municipality?: string;
}

const isEnabledContractFlag = (value: unknown): boolean =>
  value === true || value === 1 || value === '1' || String(value).toLowerCase() === 'true';

function calculateEnhancedCompositeAreaFromSize(sizeName: string, sizesMap: Record<string, SizeData>): number {
  if (!sizeName) return 0;
  const sizeData = sizesMap[sizeName] || sizesMap[sizeName.toLowerCase()];
  if (sizeData && sizeData.width && sizeData.height) {
    return sizeData.width * sizeData.height;
  }
  const parts = sizeName.toLowerCase().split(/[x×*]/);
  if (parts.length === 2) {
    const w = parseFloat(parts[0]);
    const h = parseFloat(parts[1]);
    if (!isNaN(w) && !isNaN(h)) {
      return w * h;
    }
  }
  return 0;
}




// Modern Stepper Input
const QuickNumberStepper = ({
  value,
  onChange,
  label,
  step = 10,
  unit = 'د.ل',
  disabled = false,
  colorClass = 'text-foreground',
  className
}: {
  value: number;
  onChange: (val: number) => void;
  label?: string;
  step?: number;
  unit?: string;
  disabled?: boolean;
  colorClass?: string;
  className?: string;
}) => (
  <div dir="rtl" className={cn("space-y-2 text-right", className)}>
    {label && <span className="text-sm font-extrabold text-foreground/90 block leading-tight">{label}</span>}
    <div className={cn(
      "flex items-center bg-background/80 border border-border/35 rounded-xl overflow-hidden shadow-sm transition-all duration-200 focus-within:border-primary/60 focus-within:ring-2 focus-within:ring-primary/15",
      disabled && "opacity-50 pointer-events-none"
    )}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(value + step)}
        className="h-10 w-10 flex items-center justify-center bg-muted/40 hover:bg-primary/15 text-muted-foreground hover:text-primary font-bold shrink-0 transition-colors border-l border-border/20 cursor-pointer"
        aria-label="زيادة"
      >
        <Plus className="h-3.5 w-3.5" />
      </button>
      <div dir="ltr" className="flex-1 flex items-center justify-center gap-1 px-1.5 bg-transparent min-w-0">
        <input
          type="number"
          inputMode="numeric"
          disabled={disabled}
          value={value === 0 ? '' : value}
          placeholder="0"
          onChange={e => onChange(Number(e.target.value) || 0)}
          className={cn(
            "h-10 w-full min-w-0 text-center border-0 bg-transparent focus:outline-none font-black font-mono text-base px-1 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none",
            colorClass
          )}
        />
        <span className="text-[10px] font-bold text-muted-foreground/60 pointer-events-none shrink-0">{unit}</span>
      </div>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onChange(Math.max(0, value - step))}
        className="h-10 w-10 flex items-center justify-center bg-muted/40 hover:bg-primary/15 text-muted-foreground hover:text-primary font-bold shrink-0 transition-colors border-r border-border/20 cursor-pointer"
        aria-label="نقصان"
      >
        <Minus className="h-3.5 w-3.5" />
      </button>
    </div>
  </div>
);

export const EnhancedEditCompositeTaskCostsDialog: React.FC<EnhancedEditCompositeTaskCostsDialogProps> = ({
  task,
  tasks,
  open,
  onOpenChange,
  onSave,
  isSaving = false
}) => {
  const allTasks = useMemo(() => {
    if (tasks && tasks.length > 0) return tasks;
    return task ? [task] : [];
  }, [tasks, task]);
  const primaryTask = allTasks[0] || task;
  const isMultiTask = allTasks.length > 1;

  // DB Data
  const [taskItems, setTaskItems] = useState<TaskItem[]>([]);
  const [billboards, setBillboards] = useState<Record<number, Billboard>>({});
  const [sizesMap, setSizesMap] = useState<Record<string, SizeData>>({});
  const [installationPrices, setInstallationPrices] = useState<Record<number, number>>({});
  const [printers, setPrinters] = useState<PrinterOption[]>([]);
  const [designImagesByBillboard, setDesignImagesByBillboard] = useState<Record<number, string>>({});

  // Active Service Controls
  const [isInstallationActive, setIsInstallationActive] = useState<boolean>(true);
  const [isPrintActive, setIsPrintActive] = useState<boolean>(false);
  const [isCutoutActive, setIsCutoutActive] = useState<boolean>(false);

  // Printing Configuration
  const [selectedPrinterId, setSelectedPrinterId] = useState<string | null>(null);
  const [customerPrintPerMeter, setCustomerPrintPerMeter] = useState<number>(20);
  const [companyPrintPerMeter, setCompanyPrintPerMeter] = useState<number>(10);
  const [printBillboardIds, setPrintBillboardIds] = useState<number[]>([]);

  // Manual fallback costs
  const [manualCustomerInstallationCost, setManualCustomerInstallationCost] = useState<number>(0);
  const [manualCompanyInstallationCost, setManualCompanyInstallationCost] = useState<number>(0);
  const [manualCustomerPrintCost, setManualCustomerPrintCost] = useState<number>(0);
  const [manualCompanyPrintCost, setManualCompanyPrintCost] = useState<number>(0);
  const [manualCustomerCutoutCost, setManualCustomerCutoutCost] = useState<number>(0);
  const [manualCompanyCutoutCost, setManualCompanyCutoutCost] = useState<number>(0);

  // General discounts & notes
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountReason, setDiscountReason] = useState('');
  const [notes, setNotes] = useState('');
  const [costAllocation, setCostAllocation] = useState<CostAllocationData>(createDefaultCostAllocation());

  // Cutout Items
  const [cutoutItems, setCutoutItems] = useState<CutoutItem[]>([]);

  // Filtering & UI States
  const [activeTab, setActiveTab] = useState<'installation' | 'print' | 'cutout' | 'summary'>('installation');
  const [selectedTeamFilter, setSelectedTeamFilter] = useState<string>('all');
  const [searchBillboardQuery, setSearchBillboardQuery] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [distributing, setDistributing] = useState(false);
  const [expandedItemDetails, setExpandedItemDetails] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards');
  const [contractInclusion, setContractInclusion] = useState<{
    includeInstallation: boolean;
    includePrint: boolean;
    loaded: boolean;
  }>({
    includeInstallation: true,
    includePrint: false,
    loaded: false,
  });

  // Batch pricing helpers
  const [batchPriceValue, setBatchPriceValue] = useState<number>(0);
  const [batchPricingMode, setBatchPricingMode] = useState<'piece' | 'meter'>('piece');
  const [groupPriceInputs, setGroupPriceInputs] = useState<Record<string, number>>({});
  const [groupBySizeAndType, setGroupBySizeAndType] = useState<boolean>(false);

  // Load all Data on Open
  useEffect(() => {
    if (allTasks.length > 0 && open) {
      const anyInstall = allTasks.some(t => !!t.installation_task_id || (t.customer_installation_cost || 0) > 0 || (t.company_installation_cost || 0) > 0);
      const anyPrint = allTasks.some(t => !!t.print_task_id || (t.customer_print_cost || 0) > 0 || (t.company_print_cost || 0) > 0);
      const anyCutout = allTasks.some(t => !!t.cutout_task_id || (t.customer_cutout_cost || 0) > 0);

      setIsInstallationActive(anyInstall || true);
      setIsPrintActive(anyPrint);
      setIsCutoutActive(anyCutout);

      setManualCustomerInstallationCost(allTasks.reduce((s, t) => s + (t.customer_installation_cost || 0), 0));
      setManualCompanyInstallationCost(allTasks.reduce((s, t) => s + (t.company_installation_cost || 0), 0));
      setManualCustomerPrintCost(allTasks.reduce((s, t) => s + (t.customer_print_cost || 0), 0));
      setManualCompanyPrintCost(allTasks.reduce((s, t) => s + (t.company_print_cost || 0), 0));
      setManualCustomerCutoutCost(allTasks.reduce((s, t) => s + (t.customer_cutout_cost || 0), 0));
      setManualCompanyCutoutCost(allTasks.reduce((s, t) => s + (t.company_cutout_cost || 0), 0));

      loadAllData();
    }
  }, [task, tasks, open]);

  const loadAllData = async () => {
    if (allTasks.length === 0) return;
    setLoading(true);
    try {
      // 0. Fetch Contract inclusion settings (شامل تركيب / طباعة)
      if (primaryTask?.contract_id) {
        const { data: contractData } = await supabase
          .from('Contract')
          .select('"Contract_Number", include_installation_in_price, include_print_in_billboard_price')
          .eq('Contract_Number', primaryTask.contract_id)
          .maybeSingle();

        if (contractData) {
          const incInstall = isEnabledContractFlag(contractData.include_installation_in_price);
          const incPrint = isEnabledContractFlag(contractData.include_print_in_billboard_price);
          setContractInclusion({
            includeInstallation: incInstall,
            includePrint: incPrint,
            loaded: true,
          });

          // If print is included in contract and it is first installation, set customer print per meter to 0
          if (incPrint && primaryTask.task_type === 'new_installation') {
            setIsPrintActive(true);
            if ((primaryTask.customer_print_cost || 0) === 0) {
              setCustomerPrintPerMeter(0);
            }
          }
        }
      }

      // 1. Fetch Sizes
      const { data: sizesData } = await supabase.from('sizes').select('id, name, width, height, installation_price');
      const sizeMap: Record<string, SizeData> = {};
      if (sizesData) {
        sizesData.forEach((s: any) => { sizeMap[s.name] = s; sizeMap[s.name.toLowerCase()] = s; });
        setSizesMap(sizeMap);
      }

      // 2. Fetch Active Printers
      const { data: printersList } = await supabase.from('printers').select('id, name').eq('is_active', true).order('name');
      if (printersList) setPrinters(printersList as any);

      const allInstallIds = allTasks.map(t => t.installation_task_id).filter(Boolean) as string[];
      const allPrintIds = allTasks.map(t => t.print_task_id).filter(Boolean) as string[];
      const allCutoutIds = allTasks.map(t => t.cutout_task_id).filter(Boolean) as string[];

      const teamNameByTaskId = new Map<string, string>();
      allTasks.forEach(t => {
        if (t.installation_task_id) teamNameByTaskId.set(t.installation_task_id, t.teamName || 'غير محدد');
      });

      // 3. Fetch Installation Items
      let loadedBillboardIds: number[] = [];
      if (allInstallIds.length > 0) {
        const { data: installItems } = await supabase
          .from('installation_task_items')
          .select('id, task_id, billboard_id, customer_installation_cost, company_installation_cost, has_cutout, additional_cost, additional_cost_notes, company_additional_cost, company_additional_cost_notes, pricing_type, price_per_meter, faces_to_install, reinstall_count, customer_original_install_cost, customer_reinstall_cost, cutout_workshop_id, cutout_company_cost, cutout_customer_cost, cutout_count, cutout_image_url, cutout_notes, design_face_a, design_face_b, installed_image_face_a_url, installed_image_face_b_url')
          .in('task_id', allInstallIds)
          .neq('status', 'replaced');

        if (installItems?.length) {
          const itemIds = installItems.map(i => i.id);
          const { data: photoHistory } = await supabase
            .from('installation_photo_history')
            .select('task_item_id, reinstall_number')
            .in('task_item_id', itemIds);

          const maxHistoryByItem: Record<string, number> = {};
          (photoHistory || []).forEach((ph: any) => {
            const num = (ph.reinstall_number || 1) + 1;
            maxHistoryByItem[ph.task_item_id] = Math.max(maxHistoryByItem[ph.task_item_id] || 1, num);
          });

          const itemsWithTeams: TaskItem[] = (installItems as any[]).map(item => {
            const autoIterations = Math.max(
              item.reinstall_count || 0,
              maxHistoryByItem[item.id] || (item.replacement_status === 'reinstalled' ? 2 : 1)
            );
            return {
              ...item,
              reinstall_count: autoIterations,
              teamName: teamNameByTaskId.get(item.task_id) || 'غير محدد',
            };
          });
          setTaskItems(itemsWithTeams);
          loadedBillboardIds = Array.from(new Set(installItems.map(i => i.billboard_id)));
          const installationVisuals: Record<number, string> = {};
          (installItems as any[]).forEach(item => {
            const image = item.installed_image_face_a_url
              || item.installed_image_face_b_url
              || item.design_face_a
              || item.design_face_b;
            if (image && !installationVisuals[item.billboard_id]) {
              installationVisuals[item.billboard_id] = image;
            }
          });
          setDesignImagesByBillboard(installationVisuals);

          // Fetch Billboards info
          const { data: billboardsData } = await supabase
            .from('billboards')
            .select('"ID", "Size", "Faces_Count", "Billboard_Name", "billboard_type", "Nearest_Landmark", "Image_URL", "District", "City", "Municipality"')
            .in('ID', loadedBillboardIds);

          if (billboardsData) {
            const bMap: Record<number, Billboard> = {};
            const pMap: Record<number, number> = {};
            billboardsData.forEach((b: any) => {
              bMap[b.ID] = b;
              const sizeInfo = sizeMap[b.Size];
              const basePrice = sizeInfo?.installation_price || 0;
              const itemForBillboard = installItems?.find(i => i.billboard_id === b.ID);
              const faces = resolveInstallationFacesCount({
                faces_to_install: itemForBillboard?.faces_to_install,
                billboard: b,
              });
              pMap[b.ID] = faces === 1 ? basePrice * 0.5 : basePrice;
            });
            setBillboards(bMap);
            setInstallationPrices(pMap);
          }
        }
      }

      // 4. Fetch Print Tasks & Items
      if (allPrintIds.length > 0) {
        const { data: printTasksData } = await supabase
          .from('print_tasks')
          .select('id, printer_id, total_area, total_cost, price_per_meter, customer_price_per_meter, customer_total_amount')
          .in('id', allPrintIds);

        if (printTasksData && printTasksData.length > 0) {
          const firstPt = printTasksData[0];
          if (firstPt.printer_id) setSelectedPrinterId(firstPt.printer_id);
          if (firstPt.customer_price_per_meter && firstPt.customer_price_per_meter > 0) {
            setCustomerPrintPerMeter(firstPt.customer_price_per_meter);
          }
          if (firstPt.price_per_meter && firstPt.price_per_meter > 0) {
            setCompanyPrintPerMeter(firstPt.price_per_meter);
          }
        }

        const { data: ptItems } = await supabase
          .from('print_task_items')
          .select('billboard_id, design_face_a, design_face_b')
          .in('task_id', allPrintIds);

        if (ptItems && ptItems.length > 0) {
          const pbIds = Array.from(new Set((ptItems as any[]).map(r => r.billboard_id).filter(Boolean)));
          setPrintBillboardIds(pbIds);
          const m: Record<number, string> = {};
          (ptItems as any[]).forEach(r => {
            const img = r.design_face_a || r.design_face_b;
            if (img && !m[r.billboard_id]) m[r.billboard_id] = img;
          });
          setDesignImagesByBillboard(previous => ({ ...m, ...previous }));
        }
      } else if (loadedBillboardIds.length > 0) {
        // Default print selection to all billboards if printing is enabled from scratch
        setPrintBillboardIds(loadedBillboardIds);
      }

      // 5. Fetch Cutouts
      if (allCutoutIds.length > 0) {
        const { data: cutoutItemsData } = await supabase
          .from('cutout_task_items')
          .select('id, billboard_id, quantity, unit_cost, total_cost, description, notes')
          .in('task_id', allCutoutIds);
        if (cutoutItemsData?.length) {
          setCutoutItems(cutoutItemsData as unknown as CutoutItem[]);
        }
      }

      // 6. Discounts and allocation
      setDiscountAmount(allTasks.reduce((s, t) => s + (t.discount_amount || 0), 0));
      setDiscountReason(primaryTask?.discount_reason || '');
      setNotes(primaryTask?.notes || '');
      if ((primaryTask as any)?.cost_allocation) {
        setCostAllocation({ ...createDefaultCostAllocation(), ...(primaryTask as any).cost_allocation });
      }

    } catch (error) {
      console.error('Error loading task costs data:', error);
      toast.error('حدث خطأ أثناء تحميل بيانات التكاليف');
    } finally {
      setLoading(false);
    }
  };

  // Teams list
  const teamsList = useMemo(() => {
    const teams = new Map<string, { id: string; name: string; count: number }>();
    taskItems.forEach(item => {
      const tId = item.task_id || 'default';
      const tName = item.teamName || 'غير محدد';
      if (!teams.has(tId)) teams.set(tId, { id: tId, name: tName, count: 0 });
      teams.get(tId)!.count++;
    });
    return Array.from(teams.values());
  }, [taskItems]);

  // Derived Installation calculations
  const { totalInstallationCustomer, totalInstallationCompany, totalBillboardArea, enrichedItems } = useMemo(() => {
    let custSum = 0;
    let compSum = 0;
    let areaSum = 0;

    const enriched = taskItems.map(item => {
      const bb = billboards[item.billboard_id] || { ID: item.billboard_id, Size: 'غير محدد' };
      const sizeName = bb.Size || 'غير محدد';
      const singleFaceArea = calculateEnhancedCompositeAreaFromSize(sizeName, sizesMap);
      const faces = resolveInstallationFacesCount({
        faces_to_install: item.faces_to_install,
        billboard: bb,
      });

      const isTaskRe = (primaryTask as any)?.task_type === 'reinstallation' || (editingTask as any)?.task_type === 'reinstallation';
      const isReinstalled = isTaskRe && (item.reinstall_count || 0) > 0;
      const iterationsCount = isReinstalled ? Math.max(1, item.reinstall_count || 1) : 1;
      const itemTotalArea = singleFaceArea * faces * iterationsCount;

      const itemCustPrice = isReinstalled
        ? (Number(item.customer_reinstall_cost) || Number(item.customer_installation_cost) || 0)
        : (Number(item.customer_installation_cost) || 0);

      const baseCompCost = item.company_installation_cost !== null && item.company_installation_cost !== undefined
        ? Number(item.company_installation_cost)
        : (installationPrices[item.billboard_id] || 0);
      const itemCompCost = baseCompCost + (Number(item.company_additional_cost) || 0);

      custSum += itemCustPrice + (Number(item.additional_cost) || 0);
      compSum += itemCompCost;
      areaSum += itemTotalArea;

      return {
        ...item,
        billboard: bb,
        singleFaceArea,
        itemTotalArea,
        itemCustPrice,
        itemCompCost,
        faces,
        iterationsCount,
      };
    });

    return {
      totalInstallationCustomer: custSum,
      totalInstallationCompany: compSum,
      totalBillboardArea: areaSum,
      enrichedItems: enriched
    };
  }, [taskItems, billboards, sizesMap, installationPrices]);

  // Filtered Billboard Items
  const filteredBillboardItems = useMemo(() => {
    return enrichedItems.filter(item => {
      if (selectedTeamFilter !== 'all' && item.task_id !== selectedTeamFilter && item.teamName !== selectedTeamFilter) {
        return false;
      }
      if (searchBillboardQuery.trim()) {
        const q = searchBillboardQuery.toLowerCase();
        const name = (item.billboard.Billboard_Name || '').toLowerCase();
        const code = String(item.billboard_id);
        const size = (item.billboard.Size || '').toLowerCase();
        const landmark = (item.billboard.Nearest_Landmark || '').toLowerCase();
        return name.includes(q) || code.includes(q) || size.includes(q) || landmark.includes(q);
      }
      return true;
    });
  }, [enrichedItems, selectedTeamFilter, searchBillboardQuery]);

  // Print Area & Amounts
  const { calculatedPrintArea, calculatedCustomerPrint, calculatedCompanyPrint } = useMemo(() => {
    if (!isPrintActive) {
      return { calculatedPrintArea: 0, calculatedCustomerPrint: 0, calculatedCompanyPrint: 0 };
    }
    let pArea = 0;
    printBillboardIds.forEach(bbId => {
      const item = enrichedItems.find(i => i.billboard_id === bbId);
      if (item) pArea += item.itemTotalArea;
    });

    const custPrint = (allTasks.some(t => !!t.print_task_id) || printBillboardIds.length > 0) && pArea > 0
      ? pArea * customerPrintPerMeter
      : manualCustomerPrintCost;
    const compPrint = (allTasks.some(t => !!t.print_task_id) || printBillboardIds.length > 0) && pArea > 0
      ? pArea * companyPrintPerMeter
      : manualCompanyPrintCost;

    return {
      calculatedPrintArea: pArea,
      calculatedCustomerPrint: custPrint,
      calculatedCompanyPrint: compPrint
    };
  }, [isPrintActive, printBillboardIds, enrichedItems, customerPrintPerMeter, companyPrintPerMeter, manualCustomerPrintCost, manualCompanyPrintCost, allTasks]);

  // Cutout Totals
  const { calculatedCustomerCutout, calculatedCompanyCutout, totalCutoutsCount } = useMemo(() => {
    if (!isCutoutActive) {
      return { calculatedCustomerCutout: 0, calculatedCompanyCutout: 0, totalCutoutsCount: 0 };
    }
    let cust = 0;
    let comp = 0;
    let count = 0;
    taskItems.forEach(i => {
      if (i.has_cutout) {
        const c = Number(i.cutout_count) || 1;
        count += c;
        comp += (Number(i.cutout_company_cost) || 0) * c;
        cust += (Number(i.cutout_customer_cost) || 0) * c;
      }
    });
    if (cust === 0 && comp === 0 && cutoutItems.length > 0) {
      cutoutItems.forEach(ci => {
        const itemComp = (ci.unit_cost * ci.quantity) || 0;
        const itemCust = ci.total_cost ?? itemComp;
        cust += itemCust;
        comp += itemComp;
        count += ci.quantity;
      });
    }
    return {
      calculatedCustomerCutout: cust > 0 ? cust : manualCustomerCutoutCost,
      calculatedCompanyCutout: comp > 0 ? comp : manualCompanyCutoutCost,
      totalCutoutsCount: count
    };
  }, [isCutoutActive, taskItems, cutoutItems, manualCustomerCutoutCost, manualCompanyCutoutCost]);

  // Grand Totals & Net Profit
  const finalCustomerInstall = isInstallationActive ? (allTasks.some(t => !!t.installation_task_id) ? totalInstallationCustomer : manualCustomerInstallationCost) : 0;
  const finalCompanyInstall = isInstallationActive ? (allTasks.some(t => !!t.installation_task_id) ? totalInstallationCompany : manualCompanyInstallationCost) : 0;

  const customerSubtotal = finalCustomerInstall + calculatedCustomerPrint + calculatedCustomerCutout;
  const customerTotal = Math.max(0, customerSubtotal - discountAmount);
  const companyTotal = finalCompanyInstall + calculatedCompanyPrint + calculatedCompanyCutout;
  const netProfit = customerTotal - companyTotal;
  const profitPercentage = customerTotal > 0 ? (netProfit / customerTotal) * 100 : 0;

  // Single Item Updates
  const handleUpdateItemPrice = (itemId: string, field: 'customerCost' | 'companyCost', value: number) => {
    setTaskItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const isRe = (item.reinstall_count || 0) > 0;
      if (field === 'customerCost') {
        return isRe
          ? { ...item, customer_reinstall_cost: value }
          : { ...item, customer_installation_cost: value };
      } else {
        return { ...item, company_installation_cost: value };
      }
    }));
  };

  const handleToggleItemFree = (itemId: string) => {
    setTaskItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        customer_installation_cost: 0,
        customer_reinstall_cost: 0,
        additional_cost: 0
      };
    }));
    toast.success('تم تحويل سعر اللوحة إلى مجاني');
  };

  const handleToggleItemFaces = (itemId: string, newFaces: number) => {
    setTaskItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      return {
        ...item,
        faces_to_install: newFaces,
      };
    }));
  };

  const handleToggleItemIterations = (itemId: string, iterations: number) => {
    setTaskItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      const prevCount = Math.max(1, item.reinstall_count || 1);
      const ratio = iterations / prevCount;
      const currentCost = item.customer_installation_cost || item.customer_reinstall_cost || 0;
      const newCustCost = Math.round(currentCost * ratio);
      const newCompCost = Math.round((item.company_installation_cost || 0) * ratio);
      return {
        ...item,
        reinstall_count: iterations,
        customer_installation_cost: newCustCost,
        customer_reinstall_cost: newCustCost,
        company_installation_cost: newCompCost,
      };
    }));
  };

  const handleSetAllFaces = (faces: number) => {
    setTaskItems(prev => prev.map(item => ({
      ...item,
      faces_to_install: faces,
    })));
    toast.success(`تم تعيين جميع اللوحات على ${faces === 1 ? 'وجه واحد' : 'وجهين'}`);
  };

  const handleToggleItemCutout = (itemId: string, checked: boolean) => {
    setTaskItems(prev => prev.map(item => {
      if (item.id !== itemId) return item;
      return { ...item, has_cutout: checked };
    }));
    if (checked && !isCutoutActive) setIsCutoutActive(true);
  };

  const handleToggleItemPrint = (billboardId: number, checked: boolean) => {
    setPrintBillboardIds(prev => {
      const next = checked ? Array.from(new Set([...prev, billboardId])) : prev.filter(id => id !== billboardId);
      return next;
    });
    if (checked && !isPrintActive) setIsPrintActive(true);
  };

  // Grouping by Size and Billboard Type for targeted batch pricing
  const sizeAndTypeGroups = useMemo(() => {
    const map = new Map<string, {
      key: string;
      sizeName: string;
      billboardType: string;
      itemIds: string[];
      billboardCount: number;
      totalFaces: number;
      totalArea: number;
      singleFaceArea: number;
    }>();

    filteredBillboardItems.forEach(item => {
      const bb = item.billboard;
      const size = bb.Size || 'غير محدد';
      const type = bb.billboard_type || bb.Billboard_Type || bb.type || 'برجية';
      const key = `${size}__${type}`;

      const existing = map.get(key) || {
        key,
        sizeName: size,
        billboardType: type,
        itemIds: [],
        billboardCount: 0,
        totalFaces: 0,
        totalArea: 0,
        singleFaceArea: item.singleFaceArea || 0,
      };

      existing.itemIds.push(item.id);
      existing.billboardCount += 1;
      existing.totalFaces += (item.faces || 1) * (item.iterationsCount || 1);
      existing.totalArea += item.itemTotalArea || 0;
      map.set(key, existing);
    });

    return Array.from(map.values()).sort((a, b) => {
      const sortA = sizesMap[a.sizeName]?.sortOrder ?? 999;
      const sortB = sizesMap[b.sizeName]?.sortOrder ?? 999;
      return sortA - sortB;
    });
  }, [filteredBillboardItems, sizesMap]);

  // Unique Types List for Meter Mode
  const billboardTypeGroups = useMemo(() => {
    const map = new Map<string, {
      type: string;
      billboardCount: number;
      totalArea: number;
      totalFaces: number;
      itemIds: string[];
    }>();

    filteredBillboardItems.forEach(item => {
      const bb = item.billboard;
      const type = bb.billboard_type || bb.Billboard_Type || bb.type || 'برجية';
      const existing = map.get(type) || {
        type,
        billboardCount: 0,
        totalArea: 0,
        totalFaces: 0,
        itemIds: [],
      };
      existing.itemIds.push(item.id);
      existing.billboardCount += 1;
      existing.totalArea += item.itemTotalArea || 0;
      existing.totalFaces += (item.faces || 1) * (item.iterationsCount || 1);
      map.set(type, existing);
    });

    return Array.from(map.values());
  }, [filteredBillboardItems]);

  const handleApplyPriceToGroup = (targetItemIds: string[], priceVal: number, mode: 'piece' | 'meter', groupLabel: string) => {
    if (priceVal <= 0) {
      toast.error('الرجاء إدخال سعر صحيح');
      return;
    }
    const idSet = new Set(targetItemIds);

    setTaskItems(prev => prev.map(item => {
      if (!idSet.has(item.id)) return item;
      const isTaskRe = (primaryTask as any)?.task_type === 'reinstallation';
      const isRe = isTaskRe && (item.reinstall_count || 0) > 0;
      const iterationsCount = isRe ? Math.max(1, item.reinstall_count || 1) : 1;

      let newPrice = priceVal;
      if (mode === 'meter') {
        const bb = billboards[item.billboard_id];
        const sizeName = bb?.Size || 'غير محدد';
        const area = calculateEnhancedCompositeAreaFromSize(sizeName, sizesMap);
        const faces = resolveInstallationFacesCount({
          faces_to_install: item.faces_to_install,
          billboard: bb,
        });
        newPrice = Math.round(priceVal * area * faces * iterationsCount);
      } else {
        // بالقطعة: السعر المدخل يُعامل كسعر اللوحة كاملة (وجهين). إذا كانت اللوحة وجه واحد تأخذ النصف
        const bb = billboards[item.billboard_id];
        const totalFaces = bb?.Faces_Count || 2;
        const facesToInstall = item.faces_to_install || totalFaces;
        const faceMultiplier = totalFaces > 0 ? (facesToInstall / totalFaces) : 1;
        newPrice = Math.round(priceVal * faceMultiplier * iterationsCount);
      }

      return isRe
        ? { ...item, customer_reinstall_cost: newPrice }
        : { ...item, customer_installation_cost: newPrice };
    }));

    toast.success(`تم تطبيق السعر (${priceVal} ${mode === 'meter' ? 'د.ل/م²' : 'د.ل'}) على ${groupLabel}`);
  };

  // Batch Pricing Handlers
  const handleApplyBatchPricing = () => {
    if (batchPriceValue <= 0) {
      toast.error('الرجاء إدخال قيمة سعر صالحة');
      return;
    }
    setTaskItems(prev => prev.map(item => {
      const isTaskRe = (primaryTask as any)?.task_type === 'reinstallation';
      const isRe = isTaskRe && (item.reinstall_count || 0) > 0;
      const iterationsCount = isRe ? Math.max(1, item.reinstall_count || 1) : 1;
      let newPrice = batchPriceValue;
      if (batchPricingMode === 'meter') {
        const bb = billboards[item.billboard_id];
        const sizeName = bb?.Size || 'غير محدد';
        const area = calculateEnhancedCompositeAreaFromSize(sizeName, sizesMap);
        const faces = resolveInstallationFacesCount({
          faces_to_install: item.faces_to_install,
          billboard: bb,
        });
        newPrice = Math.round(batchPriceValue * area * faces * iterationsCount);
      }
      return isRe
        ? { ...item, customer_reinstall_cost: newPrice }
        : { ...item, customer_installation_cost: newPrice };
    }));
    toast.success(`تم تطبيق السعر (${batchPriceValue} ${batchPricingMode === 'meter' ? 'د.ل/م²' : 'د.ل'}) على جميع اللوحات`);
  };

  const handleSetAllBillboardsFree = () => {
    setTaskItems(prev => prev.map(item => ({
      ...item,
      customer_installation_cost: 0,
      customer_reinstall_cost: 0,
      additional_cost: 0
    })));
    toast.success('تم تحويل جميع اللوحات لمجانية بالكامل');
  };

  const handleSelectAllPrintBillboards = () => {
    setPrintBillboardIds(enrichedItems.map(i => i.billboard_id));
    toast.success('تم تحديد جميع اللوحات للطباعة');
  };

  const handleDeselectAllPrintBillboards = () => {
    setPrintBillboardIds([]);
    toast.info('تم إلغاء تحديد جميع اللوحات من الطباعة');
  };

  // Main Save Handler (Atomic & Complete)
  const handleSaveAll = async () => {
    if (!primaryTask) return;
    setDistributing(true);
    const saveToastId = toast.loading('جاري حفظ التكاليف والبيانات...');

    try {
      // 1. Update installation_task_items in database
      if (taskItems.length > 0) {
        for (const item of taskItems) {
          const isRe = (item.reinstall_count || 0) > 0;
          await supabase.from('installation_task_items').update({
            customer_installation_cost: isRe ? (item.customer_reinstall_cost || item.customer_installation_cost) : item.customer_installation_cost,
            customer_original_install_cost: item.customer_original_install_cost || 0,
            customer_reinstall_cost: item.customer_reinstall_cost || item.customer_installation_cost || 0,
            reinstall_count: item.reinstall_count ?? null,
            company_installation_cost: item.company_installation_cost,
            additional_cost: item.additional_cost || null,
            additional_cost_notes: item.additional_cost_notes || null,
            company_additional_cost: item.company_additional_cost || null,
            company_additional_cost_notes: item.company_additional_cost_notes || null,
            has_cutout: Boolean(item.has_cutout),
            faces_to_install: resolveInstallationFacesCount({
              faces_to_install: item.faces_to_install,
              billboard: billboards[item.billboard_id],
            }),
            cutout_count: item.cutout_count || null,
            cutout_company_cost: item.cutout_company_cost || null,
            cutout_customer_cost: item.cutout_customer_cost || null,
            cutout_workshop_id: item.cutout_workshop_id || null,
            cutout_notes: item.cutout_notes || null
          }).eq('id', item.id);
        }
      }

      // 2. Handle Print Task Creation / Updating
      let effectivePrintTaskId: string | null = primaryTask.print_task_id || null;

      if (isPrintActive) {
        if (!effectivePrintTaskId) {
          // Create NEW print task
          const { data: newPt, error: ptCreateError } = await supabase.from('print_tasks').insert({
            contract_id: primaryTask.contract_id,
            customer_id: primaryTask.customer_id,
            customer_name: primaryTask.customer_name,
            installation_task_id: primaryTask.installation_task_id || null,
            composite_task_id: primaryTask.id,
            printer_id: selectedPrinterId || null,
            price_per_meter: companyPrintPerMeter,
            customer_price_per_meter: customerPrintPerMeter,
            total_area: calculatedPrintArea,
            total_cost: calculatedCompanyPrint,
            customer_total_amount: calculatedCustomerPrint,
            printer_total_cost: calculatedCompanyPrint,
            status: 'pending'
          } as any).select('id').single();

          if (ptCreateError) throw ptCreateError;
          if (newPt) {
            effectivePrintTaskId = newPt.id;
            // Link to composite task & installation task
            await supabase.from('composite_tasks').update({ print_task_id: newPt.id }).eq('id', primaryTask.id);
            if (primaryTask.installation_task_id) {
              await supabase.from('installation_tasks').update({ print_task_id: newPt.id }).eq('id', primaryTask.installation_task_id);
            }
          }
        } else {
          // Update EXISTING print task
          await supabase.from('print_tasks').update({
            printer_id: selectedPrinterId || null,
            price_per_meter: companyPrintPerMeter,
            customer_price_per_meter: customerPrintPerMeter,
            total_area: calculatedPrintArea,
            total_cost: calculatedCompanyPrint,
            customer_total_amount: calculatedCustomerPrint,
            printer_total_cost: calculatedCompanyPrint,
            updated_at: new Date().toISOString()
          } as any).eq('id', effectivePrintTaskId);
        }

        // Synchronize print_task_items
        if (effectivePrintTaskId) {
          // Delete old items and insert selected
          await supabase.from('print_task_items').delete().eq('task_id', effectivePrintTaskId);

          if (printBillboardIds.length > 0) {
            const printItemsToInsert = printBillboardIds.map(bbId => {
              const item = enrichedItems.find(i => i.billboard_id === bbId);
              const bb = billboards[bbId];
              const sizeName = bb?.Size || 'غير محدد';
              const area = item?.itemTotalArea || 0;
              const faces = item?.faces || 1;
              return {
                task_id: effectivePrintTaskId!,
                billboard_id: bbId,
                description: `${sizeName} - ${faces === 1 ? 'وجه واحد' : 'وجهين'}`,
                width: sizesMap[sizeName]?.width || null,
                height: sizesMap[sizeName]?.height || null,
                area: area,
                quantity: 1,
                faces_count: faces,
                unit_cost: companyPrintPerMeter * area,
                printer_unit_cost: companyPrintPerMeter * area,
                customer_unit_cost: customerPrintPerMeter * area,
                total_cost: companyPrintPerMeter * area,
                status: 'pending'
              };
            });
            await supabase.from('print_task_items').insert(printItemsToInsert as any);
          }
        }
      }

      // 3. Multi-task Synchronization
      // Installation remains owned by its team task. Shared operation costs are
      // stored once on the primary task so the operation total is not duplicated.
      let primaryCustomerInstall = finalCustomerInstall;
      let primaryCompanyInstall = finalCompanyInstall;
      if (allTasks.length > 1) {
        for (const t of allTasks) {
          const tItems = taskItems.filter(i => i.task_id === t.installation_task_id);
          let tCustInstall = 0;
          let tCompInstall = 0;
          tItems.forEach(i => {
            const isRe = (i.reinstall_count || 0) > 0;
            tCustInstall += isRe ? ((i.customer_original_install_cost || 0) + (i.customer_reinstall_cost || i.customer_installation_cost || 0)) : (i.customer_installation_cost || 0);
            tCompInstall += (i.company_installation_cost ?? installationPrices[i.billboard_id] ?? 0) + (i.company_additional_cost || 0);
          });
          const isPrimaryOperationTask = t.id === primaryTask.id;
          const sharedCosts = getSharedOperationCostsForTask(t.id, primaryTask.id, {
            customerPrint: calculatedCustomerPrint,
            companyPrint: calculatedCompanyPrint,
            customerCutout: calculatedCustomerCutout,
            companyCutout: calculatedCompanyCutout,
            discount: discountAmount,
          });
          const tCustPrint = sharedCosts.customerPrint;
          const tCompPrint = sharedCosts.companyPrint;
          const tCustCutout = sharedCosts.customerCutout;
          const tCompCutout = sharedCosts.companyCutout;
          const tDiscount = sharedCosts.discount;

          if (isPrimaryOperationTask) {
            primaryCustomerInstall = tCustInstall;
            primaryCompanyInstall = tCompInstall;
          }

          const tCustTot = tCustInstall + tCustPrint + tCustCutout - tDiscount;
          const tCompTot = tCompInstall + tCompPrint + tCompCutout;
          const tNet = tCustTot - tCompTot;
          const tProfPct = tCustTot > 0 ? (tNet / tCustTot) * 100 : 0;

          await supabase.from('composite_tasks').update({
            customer_installation_cost: tCustInstall,
            company_installation_cost: tCompInstall,
            customer_print_cost: tCustPrint,
            company_print_cost: tCompPrint,
            customer_cutout_cost: tCustCutout,
            company_cutout_cost: tCompCutout,
            discount_amount: tDiscount,
            discount_reason: isPrimaryOperationTask ? (discountReason.trim() || null) : null,
            customer_total: tCustTot,
            company_total: tCompTot,
            net_profit: tNet,
            profit_percentage: tProfPct,
            updated_at: new Date().toISOString()
          }).eq('id', t.id);

          if (t.combined_invoice_id) {
            await supabase.from('printed_invoices').update({
              total_amount: tCustTot,
              updated_at: new Date().toISOString()
            }).eq('id', t.combined_invoice_id);
            await supabase.from('customer_payments').update({ amount: -tCustTot }).eq('printed_invoice_id', t.combined_invoice_id).eq('entry_type', 'invoice');
          }
        }
      }

      // 4. Update Primary Task Costs
      await onSave({
        id: primaryTask.id,
        customer_installation_cost: primaryCustomerInstall,
        company_installation_cost: primaryCompanyInstall,
        customer_print_cost: calculatedCustomerPrint,
        company_print_cost: calculatedCompanyPrint,
        customer_cutout_cost: calculatedCustomerCutout,
        company_cutout_cost: calculatedCompanyCutout,
        discount_amount: discountAmount,
        discount_reason: discountReason.trim() || undefined,
        notes: notes.trim() || undefined,
        cost_allocation: costAllocation
      });

      toast.dismiss(saveToastId);
      toast.success('تم حفظ وتحديث كافة التكاليف والطباعة بنجاح');
      onOpenChange(false);

    } catch (err: any) {
      toast.dismiss(saveToastId);
      console.error('Save error:', err);
      toast.error(err?.message || 'فشل حفظ التعديلات');
    } finally {
      setDistributing(false);
    }
  };

  if (!primaryTask) return null;
  const isFirstInstallation = primaryTask.task_type === 'new_installation';
  const isInstallFreeByContract = isFirstInstallation && (contractInclusion.loaded ? contractInclusion.includeInstallation : true);
  const isPrintFreeByContract = isFirstInstallation && (contractInclusion.loaded ? contractInclusion.includePrint : false);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        dir="rtl"
        className="w-full p-0 sm:max-w-[96vw] xl:max-w-6xl flex flex-col gap-0 overflow-hidden bg-background border-l border-primary/25 text-right font-tajawal [&_button]:cursor-pointer"
      >
        <div className="shrink-0 border-b border-primary/20 bg-gradient-to-l from-primary/10 via-card/70 to-background px-5 py-4 sm:px-6">
          <SheetHeader className="text-right">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-5">
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-primary/35 bg-primary/15 text-primary shadow-sm">
                  <Calculator className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <SheetTitle className="text-xl font-black tracking-tight text-foreground sm:text-2xl">
                    مركز تكاليف العملية
                  </SheetTitle>
                  <SheetDescription className="mt-1 text-xs font-bold leading-5 text-muted-foreground">
                    تعديل موحّد للتكاليف مع صورة كل لوحة وحالة شمول خدمات العقد
                  </SheetDescription>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <span className="inline-flex min-h-8 items-center rounded-lg border border-primary/30 bg-primary/10 px-3 font-mono text-xs font-black text-primary">
                  عقد #{primaryTask.contract_id}
                </span>
                <span className="inline-flex min-h-8 items-center rounded-lg border border-border/35 bg-card/65 px-3 text-xs font-black text-foreground">
                  {primaryTask.customer_name || 'زبون غير محدد'}
                </span>
                <span className={cn(
                  "inline-flex min-h-8 items-center gap-1.5 rounded-lg border px-3 text-[11px] font-black",
                  isFirstInstallation
                    ? "border-blue-500/30 bg-blue-500/10 text-blue-300"
                    : "border-orange-500/30 bg-orange-500/10 text-orange-300"
                )}>
                  {isFirstInstallation && (isInstallFreeByContract || isPrintFreeByContract) && <Gift className="h-3.5 w-3.5" />}
                  {!isFirstInstallation
                    ? 'إعادة تركيب'
                    : isInstallFreeByContract && isPrintFreeByContract
                      ? 'الطباعة والتركيب مشمولان'
                      : isInstallFreeByContract
                        ? 'التركيب مشمول بالعقد'
                        : isPrintFreeByContract
                          ? 'الطباعة مشمولة بالعقد'
                          : 'تركيب جديد غير شامل'}
                </span>
                {isMultiTask && (
                  <span className="inline-flex min-h-8 items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 text-[11px] font-black text-amber-300">
                    <Layers className="h-3.5 w-3.5" />
                    {allTasks.length} فرق
                  </span>
                )}
              </div>
            </div>
          </SheetHeader>
        </div>

        {/* ════════════ TABS NAVIGATION ════════════ */}
        {loading ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-3 py-24 text-muted-foreground text-sm font-bold">
            <Loader2 className="h-8 w-8 animate-spin text-amber-400" />
            <span>جاري تحميل بيانات التكاليف واللوحات...</span>
          </div>
        ) : (
          <Tabs
            value={activeTab}
            onValueChange={(v: any) => setActiveTab(v)}
            className="flex min-h-0 flex-1 flex-col overflow-hidden lg:grid lg:grid-cols-[18rem_minmax(0,1fr)]"
            dir="rtl"
          >
            <aside className="shrink-0 border-b border-border/25 bg-card/25 lg:h-full lg:overflow-y-auto lg:border-b-0 lg:border-l">
              <div className="p-3 sm:px-5 lg:p-4 space-y-4">
                <div className="hidden lg:block pb-1">
                  <p className="text-sm font-black text-foreground">أقسام التكلفة</p>
                  <p className="mt-1 text-[11px] font-bold leading-5 text-muted-foreground">انتقل بين البنود، ثم راجع الملخص قبل الحفظ.</p>
                </div>
                <TabsList className="!h-auto !flex flex-col h-auto sm:h-auto lg:h-auto w-full gap-2 bg-transparent p-0 shrink-0" dir="rtl">
                  <TabsTrigger
                    value="installation"
                    className="w-full min-h-12 justify-start gap-2.5 rounded-xl border border-transparent px-3 text-xs font-black text-muted-foreground transition-all data-[state=active]:border-primary/40 data-[state=active]:bg-primary/15 data-[state=active]:text-primary shrink-0 cursor-pointer"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-amber-500/25 bg-amber-500/10 text-amber-300">
                      <Wrench className="h-4 w-4" />
                    </span>
                    <span className="flex-1 text-right font-bold">التركيب واللوحات</span>
                    <span className="rounded-md bg-muted/60 px-2 py-0.5 text-[10px] font-mono font-bold text-foreground/80">{taskItems.length}</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="print"
                    className="w-full min-h-12 justify-start gap-2.5 rounded-xl border border-transparent px-3 text-xs font-black text-muted-foreground transition-all data-[state=active]:border-primary/40 data-[state=active]:bg-primary/15 data-[state=active]:text-primary shrink-0 cursor-pointer"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-blue-500/25 bg-blue-500/10 text-blue-300">
                      <Printer className="h-4 w-4" />
                    </span>
                    <span className="flex-1 text-right font-bold">الطباعة والإنتاج</span>
                    <span className="rounded-md bg-muted/60 px-2 py-0.5 text-[10px] font-mono font-bold text-foreground/80">
                      {isPrintActive ? `${calculatedPrintArea.toFixed(1)}م²` : 'متوقفة'}
                    </span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="cutout"
                    className="w-full min-h-12 justify-start gap-2.5 rounded-xl border border-transparent px-3 text-xs font-black text-muted-foreground transition-all data-[state=active]:border-primary/40 data-[state=active]:bg-primary/15 data-[state=active]:text-primary shrink-0 cursor-pointer"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-purple-500/25 bg-purple-500/10 text-purple-300">
                      <Scissors className="h-4 w-4" />
                    </span>
                    <span className="flex-1 text-right font-bold">المجسمات والقص</span>
                    <span className="rounded-md bg-muted/60 px-2 py-0.5 text-[10px] font-mono font-bold text-foreground/80">{totalCutoutsCount}</span>
                  </TabsTrigger>

                  <TabsTrigger
                    value="summary"
                    className="w-full min-h-12 justify-start gap-2.5 rounded-xl border border-transparent px-3 text-xs font-black text-muted-foreground transition-all data-[state=active]:border-primary/40 data-[state=active]:bg-primary/15 data-[state=active]:text-primary shrink-0 cursor-pointer"
                  >
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-300">
                      <Calculator className="h-4 w-4" />
                    </span>
                    <span className="flex-1 text-right font-bold">الخصم والملخص</span>
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
                  </TabsTrigger>
                </TabsList>

                {/* Direct Live Summary Card */}
                <div className="mt-4 rounded-2xl border border-border/30 bg-background/45 p-3.5 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-black text-foreground">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <span>ملخص مباشر</span>
                  </div>
                  <div className="space-y-2.5">
                    <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/8 p-3">
                      <div className="text-[10px] font-bold text-muted-foreground">قيمة العملية للزبون</div>
                      <div className="mt-1 font-mono text-lg font-black text-emerald-300">{customerTotal.toLocaleString('ar-LY')} <span className="text-[10px]">د.ل</span></div>
                    </div>
                    <div className="rounded-xl border border-amber-500/20 bg-amber-500/8 p-3">
                      <div className="text-[10px] font-bold text-muted-foreground">تكلفة الشركة</div>
                      <div className="mt-1 font-mono text-lg font-black text-amber-300">{companyTotal.toLocaleString('ar-LY')} <span className="text-[10px]">د.ل</span></div>
                    </div>
                    <div className={cn(
                      "rounded-xl border p-3",
                      netProfit >= 0 ? "border-emerald-500/20 bg-emerald-500/8" : "border-rose-500/25 bg-rose-500/10"
                    )}>
                      <div className="flex items-center justify-between gap-2 text-[10px] font-bold text-muted-foreground">
                        <span>صافي الربح</span>
                        <span>{profitPercentage.toFixed(1)}%</span>
                      </div>
                      <div className={cn("mt-1 font-mono text-lg font-black", netProfit >= 0 ? "text-emerald-300" : "text-rose-300")}>
                        {netProfit.toLocaleString('ar-LY')} <span className="text-[10px]">د.ل</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            <ScrollArea className="min-h-0 flex-1 bg-background/30 [&_button]:min-h-10">

              {/* ════════════ TAB 1: INSTALLATION & BILLBOARDS ════════════ */}
              <TabsContent value="installation" className="mt-0 p-5 sm:p-6 space-y-5">

                {/* Notice for new installation and contract inclusion */}
                {isFirstInstallation && (
                  isInstallFreeByContract && isPrintFreeByContract ? (
                    <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-right" dir="rtl">
                      <Sparkles className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-0.5">
                        <div className="font-black text-sm">العقد شامل طباعة وتركيب مجاناً للزبون (0 د.ل)</div>
                        <div className="text-muted-foreground/90">تكاليف التركيب والطباعة للزبون مشمولة بالكامل ضمن قيمة العقد. يمكنك تعديل تكلفة الشركة (الفرقة والمطبعة) والتكاليف الإضافية فقط.</div>
                      </div>
                    </div>
                  ) : isInstallFreeByContract ? (
                    <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-right" dir="rtl">
                      <AlertCircle className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-0.5">
                        <div className="font-black text-sm">العقد شامل تركيب فقط مجاناً للزبون (0 د.ل)</div>
                        <div className="text-muted-foreground/90">تكلفة التركيب للزبون مقفلة ومشمولة بالعقد، بينما تكلفة الطباعة غير مشمولة وتُحسب على الزبون من تبويب الطباعة.</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-right" dir="rtl">
                      <AlertCircle className="h-5 w-5 text-amber-400 shrink-0 mt-0.5" />
                      <div className="text-xs space-y-0.5">
                        <div className="font-black text-sm">تركيب جديد غير مشمول بالعقد</div>
                        <div className="text-muted-foreground/90">يتم احتساب تكلفة التركيب والطباعة على الزبون.</div>
                      </div>
                    </div>
                  )
                )}

                {/* Batch Control Toolbar */}
                <div className="p-4 rounded-2xl bg-card/40 border border-border/25 space-y-3 shadow-xs" dir="rtl">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-4 w-4 text-amber-400 shrink-0" />
                      <span className="text-xs font-black text-foreground">التسعير السريع والتطبيق الجماعي</span>
                    </div>

                    {/* Team Filter */}
                    {isMultiTask && teamsList.length > 1 && (
                      <div className="flex items-center gap-1.5">
                        <Select value={selectedTeamFilter} onValueChange={setSelectedTeamFilter}>
                          <SelectTrigger className="h-8.5 text-xs font-bold bg-background min-w-[160px] rounded-xl border-border/30">
                            <SelectValue placeholder="جميع الفرق" />
                          </SelectTrigger>
                          <SelectContent className="font-tajawal" dir="rtl">
                            <SelectItem value="all">جميع الفرق ({taskItems.length} لوحة)</SelectItem>
                            {teamsList.map(team => (
                              <SelectItem key={team.id} value={team.id}>
                                {team.name} ({team.count} لوحة)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  <div className="space-y-2.5" dir="rtl">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      {/* Mode Selector */}
                      <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-muted/30 border border-border/20 shrink-0">
                        <button
                          type="button"
                          onClick={() => setBatchPricingMode('piece')}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
                            batchPricingMode === 'piece' ? "bg-amber-500 text-black shadow-xs font-black" : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Box className="h-3.5 w-3.5" />
                          <span>تسعير بالقطعة (مفصول حسب المقاس)</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setBatchPricingMode('meter')}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap flex items-center gap-1.5",
                            batchPricingMode === 'meter' ? "bg-amber-500 text-black shadow-xs font-black" : "text-muted-foreground hover:text-foreground"
                          )}
                        >
                          <Ruler className="h-3.5 w-3.5" />
                          <span>تسعير بالمتر المربع (مفصول حسب النوع)</span>
                        </button>
                      </div>

                      {/* Global Actions */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className="flex items-center gap-1 bg-card/60 p-1 rounded-xl border border-border/25">
                          <span className="text-[10px] font-bold text-muted-foreground px-1.5">الأوجه للكل:</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            type="button"
                            onClick={() => handleSetAllFaces(1)}
                            className="h-7 px-2.5 text-[11px] font-bold text-amber-300 hover:bg-amber-500/10 rounded-lg gap-1 shrink-0 cursor-pointer whitespace-nowrap"
                          >
                            وجه واحد
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            type="button"
                            onClick={() => handleSetAllFaces(2)}
                            className="h-7 px-2.5 text-[11px] font-bold text-amber-300 hover:bg-amber-500/10 rounded-lg gap-1 shrink-0 cursor-pointer whitespace-nowrap"
                          >
                            وجهين
                          </Button>
                        </div>

                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleSetAllBillboardsFree}
                          disabled={isFirstInstallation}
                          className="h-8 px-3 text-xs font-bold text-rose-400 hover:bg-rose-500/10 hover:text-rose-300 rounded-xl gap-1.5 shrink-0 cursor-pointer whitespace-nowrap"
                        >
                          <Gift className="h-3.5 w-3.5" />
                          جعل الكل مجاني
                        </Button>
                      </div>
                    </div>

                    {/* Section 1: By Piece Mode (Grouped & Separated by Size) */}
                    {batchPricingMode === 'piece' && (
                      <div className="p-3 bg-muted/20 border border-border/30 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                          <span className="flex items-center gap-1.5 text-foreground">
                            <Box className="h-4 w-4 text-amber-400" />
                            <span>تطبيق السعر حسب المقاس والنوع (يُحسب الوجه الفردي بنصف سعر الوجهين تلقائياً):</span>
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {sizeAndTypeGroups.length} مقاسات في هذه المهمة
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2.5">
                          {sizeAndTypeGroups.map(grp => {
                            const currentVal = groupPriceInputs[grp.key] ?? '';
                            return (
                              <div
                                key={grp.key}
                                className="flex items-center justify-between gap-2 p-2 rounded-xl bg-card/60 border border-border/25"
                              >
                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="bg-amber-500/15 text-amber-300 border border-amber-500/30 px-1.5 py-0.5 rounded font-mono text-xs font-black">
                                      {grp.sizeName}
                                    </span>
                                    <span className="text-[10px] font-bold text-muted-foreground">
                                      {grp.billboardType}
                                    </span>
                                  </div>
                                  <div className="text-[10px] text-muted-foreground/80 mt-0.5">
                                    {grp.billboardCount} لوحة • {grp.totalFaces} وجه ({grp.totalArea.toFixed(1)} م²)
                                  </div>
                                </div>

                                <div className="flex items-center gap-1.5 shrink-0">
                                  <Input
                                    type="number"
                                    placeholder="السعر د.ل"
                                    value={currentVal}
                                    onChange={e => setGroupPriceInputs(prev => ({
                                      ...prev,
                                      [grp.key]: Number(e.target.value) || 0
                                    }))}
                                    className="h-8 w-20 text-xs font-bold text-center font-mono bg-background/80 border-border/30 rounded-lg p-1"
                                  />
                                  <Button
                                    size="sm"
                                    type="button"
                                    disabled={!groupPriceInputs[grp.key] || isFirstInstallation}
                                    onClick={() => handleApplyPriceToGroup(grp.itemIds, groupPriceInputs[grp.key] || 0, 'piece', `مقاس ${grp.sizeName}`)}
                                    className="h-8 px-2.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black rounded-lg shrink-0 cursor-pointer shadow-xs"
                                  >
                                    تطبيق
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Section 2: By Meter Mode (Grouped & Separated by Billboard Type) */}
                    {batchPricingMode === 'meter' && (
                      <div className="p-3 bg-muted/20 border border-border/30 rounded-2xl space-y-2">
                        <div className="flex items-center justify-between text-xs font-bold text-muted-foreground">
                          <span className="flex items-center gap-1.5 text-foreground">
                            <Ruler className="h-4 w-4 text-amber-400" />
                            <span>تطبيق سعر المتر المربع (يُضرب سعر المتر في إجمالي أمتار اللوحة حسب الأوجه):</span>
                          </span>
                        </div>

                        {/* Global Meter Price Row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          <div className="flex items-center gap-2 flex-1 min-w-[220px]">
                            <Input
                              type="number"
                              placeholder="سعر المتر الموحد لجميع اللوحات د.ل/م²..."
                              value={batchPriceValue === 0 ? '' : batchPriceValue}
                              onChange={e => setBatchPriceValue(Number(e.target.value) || 0)}
                              className="h-9 text-xs font-bold bg-background/60 border-border/30 rounded-xl text-right font-mono flex-1"
                            />
                            <Button
                              size="sm"
                              onClick={handleApplyBatchPricing}
                              disabled={batchPriceValue <= 0 || isFirstInstallation}
                              className="h-9 px-4 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black rounded-xl gap-1.5 shrink-0 cursor-pointer whitespace-nowrap shadow-sm"
                            >
                              <Check className="h-3.5 w-3.5" />
                              تطبيق سعر المتر على الكل
                            </Button>
                          </div>
                        </div>

                        {/* Types meter pricing row if multiple types */}
                        {billboardTypeGroups.length > 1 && (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 pt-2 border-t border-border/20">
                            {billboardTypeGroups.map(tGrp => {
                              const tKey = `type__${tGrp.type}`;
                              const currentVal = groupPriceInputs[tKey] ?? '';
                              return (
                                <div
                                  key={tKey}
                                  className="flex items-center justify-between gap-2 p-2 rounded-xl bg-card/60 border border-border/25"
                                >
                                  <div className="min-w-0 flex-1">
                                    <div className="font-bold text-xs text-foreground">
                                      لوحات {tGrp.type}
                                    </div>
                                    <div className="text-[10px] text-muted-foreground mt-0.5">
                                      {tGrp.billboardCount} لوحة ({tGrp.totalArea.toFixed(1)} م²)
                                    </div>
                                  </div>

                                  <div className="flex items-center gap-1.5 shrink-0">
                                    <Input
                                      type="number"
                                      placeholder="د.ل/م²"
                                      value={currentVal}
                                      onChange={e => setGroupPriceInputs(prev => ({
                                        ...prev,
                                        [tKey]: Number(e.target.value) || 0
                                      }))}
                                      className="h-8 w-20 text-xs font-bold text-center font-mono bg-background/80 border-border/30 rounded-lg p-1"
                                    />
                                    <Button
                                      size="sm"
                                      type="button"
                                      disabled={!groupPriceInputs[tKey] || isFirstInstallation}
                                      onClick={() => handleApplyPriceToGroup(tGrp.itemIds, groupPriceInputs[tKey] || 0, 'meter', `لوحات ${tGrp.type}`)}
                                      className="h-8 px-2.5 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-black rounded-lg shrink-0 cursor-pointer shadow-xs"
                                    >
                                      تطبيق
                                    </Button>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Billboards Search Bar & View Mode Switcher */}
                <div className="flex items-center justify-between gap-3 flex-wrap" dir="rtl">
                  <div className="relative flex-1 min-w-[220px]">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 pointer-events-none" />
                    <Input
                      placeholder="بحث في اللوحات بالاسم، الكود، المقاس..."
                      value={searchBillboardQuery}
                      onChange={e => setSearchBillboardQuery(e.target.value)}
                      className="pr-9 pl-3 h-9 text-xs font-bold bg-background/50 border-border/25 rounded-xl text-right"
                    />
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {/* Table / Cards View Switcher */}
                    <div className="inline-flex items-center gap-1 p-1 rounded-xl bg-card/60 border border-border/25">
                      <button
                        type="button"
                        onClick={() => setViewMode('table')}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                          viewMode === 'table' ? "bg-amber-500 text-black shadow-xs" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <Layers className="h-3.5 w-3.5" />
                        <span>جدول (RTL)</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('cards')}
                        className={cn(
                          "px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5",
                          viewMode === 'cards' ? "bg-amber-500 text-black shadow-xs" : "text-muted-foreground hover:text-foreground"
                        )}
                      >
                        <LayoutGrid className="h-3.5 w-3.5" />
                        <span>بطاقات</span>
                      </button>
                    </div>

                    <Badge variant="outline" className="text-xs font-mono font-bold bg-card/40 border-border/20 px-3 py-1.5 rounded-xl shrink-0">
                      {filteredBillboardItems.length} من {enrichedItems.length} لوحة
                    </Badge>
                  </div>
                </div>
                {viewMode === 'table' ? (
                  <div className="overflow-x-auto rounded-2xl border border-border/20 bg-card/30 shadow-sm" dir="rtl">
                    <table className="w-full text-right text-xs border-collapse">
                      <thead>
                        <tr className="bg-muted/35 border-b border-border/25 text-muted-foreground text-[11px] font-black">
                          <th className="py-3 px-3 text-right min-w-[200px]">اللوحة والموقع والمعالم</th>
                          <th className="py-3 px-2.5 text-right whitespace-nowrap">المقاس والمساحة</th>
                          <th className="py-3 px-2.5 text-right whitespace-nowrap">الفريق</th>
                          <th className="py-3 px-2 text-center min-w-[130px]">سعر الزبون</th>
                          <th className="py-3 px-2 text-center min-w-[130px]">تكلفة الشركة</th>
                          <th className="py-3 px-2 text-center min-w-[110px]">الخدمات</th>
                          <th className="py-3 px-1.5 text-center w-14">مجاني</th>
                          <th className="py-3 px-1.5 text-center w-12">تفاصيل</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-border/15">
                        {filteredBillboardItems.map((item) => {
                          const bb = item.billboard;
                          const isExpanded = expandedItemDetails.has(item.id);
                          const isItemPrintSelected = printBillboardIds.includes(item.billboard_id);

                          return (
                            <React.Fragment key={item.id}>
                              <tr className={cn(
                                "hover:bg-card/60 transition-colors",
                                isExpanded && "bg-muted/15"
                              )}>
                                {/* Column 1: Image & Code & Name & Landmark & District & Municipality */}
                                <td className="py-2.5 px-3">
                                  <div className="flex items-start gap-2.5">
                                    <div className="w-10 h-10 rounded-xl overflow-hidden bg-muted/40 border border-border/20 shrink-0 flex items-center justify-center relative shadow-xs mt-0.5">
                                      {bb.Image_URL || designImagesByBillboard[item.billboard_id] ? (
                                        <img
                                          src={designImagesByBillboard[item.billboard_id] || bb.Image_URL}
                                          alt=""
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <LayoutGrid className="h-5 w-5 text-muted-foreground/40" />
                                      )}
                                    </div>
                                    <div className="min-w-0 space-y-0.5 text-right flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span className="font-black text-foreground hover:text-amber-300 transition-colors truncate">
                                          {bb.Billboard_Name || `لوحة #${item.billboard_id}`}
                                        </span>
                                        <span className="text-[10px] font-mono text-amber-300 font-bold bg-amber-500/10 border border-amber-500/20 px-1 py-0.2 rounded">
                                          #{item.billboard_id}
                                        </span>
                                      </div>

                                      {/* Nearest Landmark (أقرب نقطة دالة) */}
                                      {bb.Nearest_Landmark && (
                                        <div className="text-[11px] font-bold text-amber-200/90 flex items-center gap-1">
                                          <Landmark className="h-3 w-3 text-amber-400 shrink-0" />
                                          <span className="truncate">{bb.Nearest_Landmark}</span>
                                        </div>
                                      )}

                                      {/* District, Municipality, City (المنطقة والبلدية والمدينة) */}
                                      {(bb.District || bb.Municipality || bb.City) && (
                                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                                          <MapPin className="h-3 w-3 text-blue-400 shrink-0" />
                                          <span className="truncate">
                                            {[bb.City, bb.Municipality ? `بلدية ${bb.Municipality}` : null, bb.District].filter(Boolean).join(' • ')}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>

                                {/* Column 2: Size, Faces & Area */}
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  <div className="font-bold text-foreground flex items-center gap-1.5 flex-wrap">
                                    <span className="bg-amber-500/10 text-amber-300 border border-amber-500/20 px-1.5 py-0.5 rounded font-mono text-[10px]">
                                      {bb.Size}
                                    </span>
                                    {item.iterationsCount > 1 && (
                                      <span className="bg-orange-500/15 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                        تركيب {item.iterationsCount} مرات
                                      </span>
                                    )}
                                    <span className="text-[10px] text-muted-foreground font-mono">
                                      ({item.itemTotalArea.toFixed(1)} م²)
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 mt-1.5">
                                    <button
                                      type="button"
                                      onClick={() => handleToggleItemFaces(item.id, 1)}
                                      className={cn(
                                        "px-2 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer",
                                        item.faces === 1
                                          ? "bg-amber-500 text-black border-amber-500 shadow-xs"
                                          : "bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted/70 hover:text-foreground"
                                      )}
                                    >
                                      وجه واحد
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleToggleItemFaces(item.id, 2)}
                                      className={cn(
                                        "px-2 py-0.5 rounded text-[10px] font-bold border transition-all cursor-pointer",
                                        item.faces === 2
                                          ? "bg-amber-500 text-black border-amber-500 shadow-xs"
                                          : "bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted/70 hover:text-foreground"
                                      )}
                                    >
                                      وجهين
                                    </button>
                                  </div>
                                  {isTaskRe && (
                                    <div className="flex items-center gap-1 mt-1">
                                      <button
                                        type="button"
                                        onClick={() => handleToggleItemIterations(item.id, 1)}
                                        className={cn(
                                          "px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all cursor-pointer",
                                          (item.reinstall_count || 1) <= 1
                                            ? "bg-amber-500 text-black border-amber-500 shadow-xs"
                                            : "bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted/70 hover:text-foreground"
                                        )}
                                      >
                                        مرة 1
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleItemIterations(item.id, 2)}
                                        className={cn(
                                          "px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all cursor-pointer",
                                          item.reinstall_count === 2
                                            ? "bg-amber-500 text-black border-amber-500 shadow-xs"
                                            : "bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted/70 hover:text-foreground"
                                        )}
                                      >
                                        مرتين (2)
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleToggleItemIterations(item.id, 3)}
                                        className={cn(
                                          "px-1.5 py-0.5 rounded text-[9px] font-bold border transition-all cursor-pointer",
                                          item.reinstall_count === 3
                                            ? "bg-amber-500 text-black border-amber-500 shadow-xs"
                                            : "bg-muted/40 text-muted-foreground border-border/50 hover:bg-muted/70 hover:text-foreground"
                                        )}
                                      >
                                        3 مرات
                                      </button>
                                    </div>
                                  )}
                                </td>

                                {/* Column 3: Team */}
                                <td className="py-2.5 px-3 whitespace-nowrap">
                                  {item.teamName && item.teamName !== 'غير محدد' ? (
                                    <span className="text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded">
                                      {item.teamName}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground/60">—</span>
                                  )}
                                </td>

                                {/* Column 4: Customer Price Stepper */}
                                <td className="py-2 px-3">
                                  <QuickNumberStepper
                                    value={item.itemCustPrice}
                                    onChange={v => handleUpdateItemPrice(item.id, 'customerCost', v)}
                                    disabled={isFirstInstallation}
                                    colorClass="text-emerald-400"
                                    step={10}
                                  />
                                </td>

                                {/* Column 5: Company Cost Stepper */}
                                <td className="py-2 px-3">
                                  <QuickNumberStepper
                                    value={item.itemCompCost}
                                    onChange={v => handleUpdateItemPrice(item.id, 'companyCost', v)}
                                    colorClass="text-amber-300"
                                    step={10}
                                  />
                                </td>

                                {/* Column 6: Print & Cutout Services */}
                                <td className="py-2 px-3">
                                  <div className="flex flex-col gap-1 items-start text-[10px]">
                                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                      <Checkbox
                                        checked={isItemPrintSelected}
                                        onCheckedChange={(c: any) => handleToggleItemPrint(item.billboard_id, Boolean(c))}
                                        className="h-3.5 w-3.5"
                                      />
                                      <span className={cn(isItemPrintSelected ? "text-blue-400 font-bold" : "text-muted-foreground")}>
                                        طباعة فلكس
                                      </span>
                                    </label>
                                    <label className="flex items-center gap-1.5 cursor-pointer select-none">
                                      <Checkbox
                                        checked={Boolean(item.has_cutout)}
                                        onCheckedChange={(c: any) => handleToggleItemCutout(item.id, Boolean(c))}
                                        className="h-3.5 w-3.5"
                                      />
                                      <span className={cn(item.has_cutout ? "text-purple-400 font-bold" : "text-muted-foreground")}>
                                        مجسم / قص
                                      </span>
                                    </label>
                                  </div>
                                </td>

                                {/* Column 7: Free Button */}
                                <td className="py-2 px-2 text-center">
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    onClick={() => handleToggleItemFree(item.id)}
                                    disabled={isFirstInstallation || item.itemCustPrice === 0}
                                    className="h-7 px-2 text-[10px] font-bold text-rose-400 hover:bg-rose-500/10 rounded-lg"
                                    title="جعل هذه اللوحة مجانية"
                                  >
                                    مجاني
                                  </Button>
                                </td>

                                {/* Column 8: Toggle Details */}
                                <td className="py-2 px-2 text-center">
                                  <button
                                    type="button"
                                    onClick={() => toggleItemDetails(item.id)}
                                    className={cn(
                                      "h-7 w-7 rounded-lg inline-flex items-center justify-center transition-colors border",
                                      (item.additional_cost || 0) > 0 || (item.company_additional_cost || 0) > 0
                                        ? "bg-amber-500/15 border-amber-500/30 text-amber-300"
                                        : "bg-muted/20 border-border/20 text-muted-foreground hover:text-foreground"
                                    )}
                                    title="تكاليف إضافية وملاحظات"
                                  >
                                    {isExpanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
                                  </button>
                                </td>
                              </tr>

                              {/* Expanded Drawer for Additional Costs */}
                              {isExpanded && (
                                <tr className="bg-muted/20">
                                  <td colSpan={8} className="p-3 border-b border-border/20">
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mr-auto ml-0" dir="rtl">
                                      <div className="p-2.5 rounded-xl bg-background/70 border border-emerald-500/20 space-y-1.5 text-right">
                                        <Label className="text-[10px] font-bold text-emerald-400 block text-right">تكلفة إضافية على الزبون (د.ل):</Label>
                                        <div className="flex gap-1.5">
                                          <Input
                                            type="number"
                                            value={item.additional_cost === 0 ? '' : item.additional_cost}
                                            onChange={e => handleUpdateItemPrice(item.id, 'additional_cost', Math.max(0, parseFloat(e.target.value) || 0))}
                                            placeholder="0"
                                            className="h-8 text-xs font-mono font-bold bg-background text-right"
                                          />
                                          <Input
                                            type="text"
                                            value={item.additional_cost_notes || ''}
                                            onChange={e => handleUpdateItemPrice(item.id, 'additional_cost_notes', e.target.value)}
                                            placeholder="بيان التكلفة..."
                                            className="h-8 text-xs bg-background text-right flex-1"
                                          />
                                        </div>
                                      </div>

                                      <div className="p-2.5 rounded-xl bg-background/70 border border-amber-500/20 space-y-1.5 text-right">
                                        <Label className="text-[10px] font-bold text-amber-300 block text-right">تكلفة إضافية على الشركة (د.ل):</Label>
                                        <div className="flex gap-1.5">
                                          <Input
                                            type="number"
                                            value={item.company_additional_cost === 0 ? '' : item.company_additional_cost}
                                            onChange={e => handleUpdateItemPrice(item.id, 'company_additional_cost', Math.max(0, parseFloat(e.target.value) || 0))}
                                            placeholder="0"
                                            className="h-8 text-xs font-mono font-bold bg-background text-right"
                                          />
                                          <Input
                                            type="text"
                                            value={item.company_additional_cost_notes || ''}
                                            onChange={e => handleUpdateItemPrice(item.id, 'company_additional_cost_notes', e.target.value)}
                                            placeholder="بيان التكلفة..."
                                            className="h-8 text-xs bg-background text-right flex-1"
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  </td>
                                </tr>
                              )}
                            </React.Fragment>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                <div className="space-y-3.5" dir="rtl">
                  {filteredBillboardItems.map((item) => {
                    const bb = item.billboard;
                    const isExpanded = expandedItemDetails.has(item.id);
                    const isItemPrintSelected = printBillboardIds.includes(item.billboard_id);

                    return (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-border/35 bg-card/55 p-4 shadow-sm transition-all duration-200 hover:border-primary/35 hover:bg-card/75"
                      >
                        {/* Billboard Top Row */}
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex min-w-0 flex-1 items-start gap-4">
                            {/* Billboard Image / Thumbnail */}
                            <div className="h-[88px] w-[128px] overflow-hidden rounded-xl border border-primary/25 bg-muted/40 shadow-sm shrink-0 flex items-center justify-center relative">
                              {bb.Image_URL || designImagesByBillboard[item.billboard_id] ? (
                                <img
                                  src={designImagesByBillboard[item.billboard_id] || bb.Image_URL}
                                  alt={`تصميم لوحة ${bb.Billboard_Name || item.billboard_id}`}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <LayoutGrid className="h-7 w-7 text-muted-foreground/40" />
                              )}
                              <span className="absolute right-1 top-1 rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-bold text-primary">
                                {designImagesByBillboard[item.billboard_id] ? 'تصميم آخر مهمة' : 'صورة اللوحة'}
                              </span>
                              <span className="absolute bottom-1 left-1 rounded bg-black/80 px-1.5 py-0.5 text-[9px] font-mono font-black text-amber-300">
                                #{item.billboard_id}
                              </span>
                            </div>

                            {/* Billboard Specs & Code */}
                            <div className="space-y-1 min-w-0 text-right">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-base font-black text-foreground hover:text-primary transition-colors truncate">
                                  {bb.Billboard_Name || `لوحة #${String(item.billboard_id).padStart(4, '0')}`}
                                </span>
                                <span className="text-[10px] font-black bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md font-mono">
                                  {bb.Size}
                                </span>
                                <div className="inline-flex items-center gap-1 p-0.5 rounded-md bg-muted/40 border border-border/30">
                                  <button
                                    type="button"
                                    onClick={() => handleToggleItemFaces(item.id, 1)}
                                    className={cn(
                                      "px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer",
                                      item.faces === 1
                                        ? "bg-amber-500 text-black shadow-xs"
                                        : "text-muted-foreground hover:text-foreground"
                                    )}
                                  >
                                    وجه واحد
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleToggleItemFaces(item.id, 2)}
                                    className={cn(
                                      "px-2 py-0.5 rounded text-[10px] font-bold transition-all cursor-pointer",
                                      item.faces === 2
                                        ? "bg-amber-500 text-black shadow-xs"
                                        : "text-muted-foreground hover:text-foreground"
                                    )}
                                  >
                                    وجهين
                                  </button>
                                </div>
                                {item.iterationsCount > 1 && (
                                  <span className="bg-orange-500/15 text-orange-400 border border-orange-500/30 px-1.5 py-0.5 rounded text-[9px] font-bold">
                                    تركيب {item.iterationsCount} مرات
                                  </span>
                                )}
                                <span className="text-[10px] font-mono text-muted-foreground font-bold">
                                  ({item.itemTotalArea.toFixed(1)} م²)
                                </span>
                                {item.teamName && item.teamName !== 'غير محدد' && (
                                  <span className="text-[10px] font-bold bg-blue-500/10 text-blue-400 border border-blue-500/20 px-2 py-0.5 rounded-md">
                                    {item.teamName}
                                  </span>
                                )}
                              </div>
                              <div className="space-y-1 text-right pt-1">
                                {bb.Nearest_Landmark && (
                                  <div className="text-xs font-bold text-amber-200/90 flex items-center gap-1.5">
                                    <Landmark className="h-3.5 w-3.5 text-amber-400 shrink-0" />
                                    <span>أقرب نقطة دالة: {bb.Nearest_Landmark}</span>
                                  </div>
                                )}
                                {(bb.District || bb.Municipality || bb.City) && (
                                  <div className="text-[11px] text-muted-foreground flex items-center gap-1.5">
                                    <MapPin className="h-3.5 w-3.5 text-blue-400 shrink-0" />
                                    <span>{[bb.City, bb.Municipality ? `بلدية ${bb.Municipality}` : null, bb.District].filter(Boolean).join(' • ')}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Quick Free Button */}
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleToggleItemFree(item.id)}
                            disabled={isFirstInstallation || item.itemCustPrice === 0}
                            className="h-8 text-xs font-bold gap-1 rounded-xl border-border/30 hover:border-rose-500/30 hover:bg-rose-500/10 hover:text-rose-400 text-muted-foreground shrink-0 cursor-pointer"
                          >
                            <Gift className="h-3.5 w-3.5 text-rose-400" />
                            <span>مجاني</span>
                          </Button>
                        </div>

                        {/* Direct Pricing Steppers Row */}
                        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-border/25 pt-4 sm:grid-cols-2">
                          <QuickNumberStepper
                            label={isFirstInstallation ? "سعر الزبون (مقفل - تركيب جديد)" : "سعر الزبون للوحة (د.ل)"}
                            value={item.itemCustPrice}
                            onChange={v => handleUpdateItemPrice(item.id, 'customerCost', v)}
                            disabled={isFirstInstallation}
                            colorClass="text-emerald-400"
                            step={10}
                            className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-3"
                          />
                          <QuickNumberStepper
                            label="تكلفة الشركة للوحة (د.ل)"
                            value={item.itemCompCost}
                            onChange={v => handleUpdateItemPrice(item.id, 'companyCost', v)}
                            colorClass="text-amber-300"
                            step={10}
                            className="rounded-xl border border-primary/25 bg-primary/5 p-3"
                          />
                        </div>

                        {/* Quick Services Switches per Billboard */}
                        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-background/35 px-3 py-2.5 text-xs font-bold text-muted-foreground">
                          <div className="flex items-center gap-4">
                            {/* Print toggle for this billboard */}
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <Checkbox
                                checked={isItemPrintSelected}
                                onCheckedChange={(c: any) => handleToggleItemPrint(item.billboard_id, Boolean(c))}
                              />
                              <span className={cn(isItemPrintSelected ? "text-blue-400 font-black" : "text-muted-foreground")}>
                                طباعة فلكس ({item.itemTotalArea.toFixed(1)} م²)
                              </span>
                            </label>

                            {/* Cutout toggle */}
                            <label className="flex items-center gap-2 cursor-pointer select-none">
                              <Checkbox
                                checked={Boolean(item.has_cutout)}
                                onCheckedChange={(c: any) => handleToggleItemCutout(item.id, Boolean(c))}
                              />
                              <span className={cn(item.has_cutout ? "text-purple-400 font-black" : "text-muted-foreground")}>
                                مجسم / قص
                              </span>
                            </label>
                          </div>

                          {/* Expand details for additional costs */}
                          <button
                            type="button"
                            onClick={() => setExpandedItemDetails(prev => {
                              const next = new Set(prev);
                              next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                              return next;
                            })}
                            className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-extrabold text-muted-foreground transition-colors hover:bg-primary/10 hover:text-primary cursor-pointer"
                          >
                            <span>تكاليف وملاحظات إضافية</span>
                            <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", isExpanded && "rotate-180")} />
                          </button>
                        </div>

                        {/* Expanded additional cost panel */}
                        {isExpanded && (
                          <div className="mt-3 space-y-3 rounded-xl border border-border/30 bg-background/45 p-4 animate-in fade-in duration-200">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                              <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-muted-foreground">تكلفة إضافية على الزبون (د.ل)</Label>
                                <Input
                                  type="number"
                                  value={item.additional_cost || ''}
                                  placeholder="0"
                                  onChange={e => {
                                    const val = Number(e.target.value) || 0;
                                    setTaskItems(prev => prev.map(i => i.id === item.id ? { ...i, additional_cost: val } : i));
                                  }}
                                  className="h-8.5 text-xs font-bold bg-background/80"
                                />
                                <Input
                                  placeholder="ملاحظات التكلفة الإضافية للزبون..."
                                  value={item.additional_cost_notes || ''}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setTaskItems(prev => prev.map(i => i.id === item.id ? { ...i, additional_cost_notes: val } : i));
                                  }}
                                  className="h-8.5 text-xs bg-background/80"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-muted-foreground">تكلفة إضافية على الشركة (د.ل)</Label>
                                <Input
                                  type="number"
                                  value={item.company_additional_cost || ''}
                                  placeholder="0"
                                  onChange={e => {
                                    const val = Number(e.target.value) || 0;
                                    setTaskItems(prev => prev.map(i => i.id === item.id ? { ...i, company_additional_cost: val } : i));
                                  }}
                                  className="h-8.5 text-xs font-bold bg-background/80"
                                />
                                <Input
                                  placeholder="ملاحظات التكلفة الإضافية للشركة..."
                                  value={item.company_additional_cost_notes || ''}
                                  onChange={e => {
                                    const val = e.target.value;
                                    setTaskItems(prev => prev.map(i => i.id === item.id ? { ...i, company_additional_cost_notes: val } : i));
                                  }}
                                  className="h-8.5 text-xs bg-background/80"
                                />
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                )}
              </TabsContent>

              {/* ════════════ TAB 2: FULL PRINTING MANAGEMENT & ACTIVATION ════════════ */}
              <TabsContent value="print" className="mt-0 p-5 sm:p-6 space-y-6">

                {/* Print Master Switch Banner */}
                <div className="p-4.5 rounded-2xl border border-blue-500/30 bg-blue-500/10 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center shrink-0">
                      <Printer className="h-5 w-5 text-blue-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-foreground">تفعيل خدمة الطباعة والإنتاج لهذه العملية</h4>
                      <p className="text-xs text-muted-foreground/80 mt-0.5">
                        عند التفعيل، سيتم احتساب مبيعات وتكلفة المتر وإنشاء أو مزامنة مهمة الطباعة تلقائياً في قاعدة البيانات.
                      </p>
                    </div>
                  </div>
                  <Switch checked={isPrintActive} onCheckedChange={setIsPrintActive} />
                </div>

                {isPrintActive && (
                  <div className="space-y-6 animate-in fade-in duration-200">
                    {/* Contract Print Inclusion Banner */}
                    {isFirstInstallation && isPrintFreeByContract ? (
                      <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-right" dir="rtl">
                        <Sparkles className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
                        <div className="text-xs space-y-0.5">
                          <div className="font-black text-sm">الطباعة مشمولة مع العقد (مجانية للزبون)</div>
                          <div className="text-muted-foreground/90">تكلفة طباعة الفلكس للزبون متضمنة في قيمة إيجار العقد (سعر المتر للزبون = 0 د.ل). يتم احتساب تكلفة المطبعة (الشركة) فقط.</div>
                        </div>
                      </div>
                    ) : isFirstInstallation && !isPrintFreeByContract ? (
                      <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-blue-500/10 border border-blue-500/30 text-blue-300 text-right" dir="rtl">
                        <Printer className="h-5 w-5 text-blue-400 shrink-0 mt-0.5" />
                        <div className="text-xs space-y-0.5">
                          <div className="font-black text-sm">الطباعة غير مشمولة بالعقد (تُحسب على الزبون)</div>
                          <div className="text-muted-foreground/90">العقد يشمل التركيب فقط، وتكلفة الطباعة تُحسب على الزبون بسعر المتر الموضح أدناه.</div>
                        </div>
                      </div>
                    ) : null}

                    {/* Printer Selection Card */}
                    <Card className="border-border/20 bg-card/40 rounded-2xl shadow-sm">
                      <CardContent className="p-4.5 space-y-2">
                        <Label className="text-xs font-black text-blue-400 flex items-center gap-2">
                          <Printer className="h-4 w-4" />
                          المطبعة المسؤولة عن التنفيذ:
                        </Label>
                        <Select
                          value={selectedPrinterId || 'none'}
                          onValueChange={(v) => setSelectedPrinterId(v === 'none' ? null : v)}
                        >
                          <SelectTrigger dir="rtl" className="h-11 rounded-xl bg-background border-border/30 text-xs font-bold px-3 text-right">
                            <SelectValue placeholder="اختر مطبعة من قائمة المطابع النشطة..." />
                          </SelectTrigger>
                          <SelectContent className="font-tajawal text-xs" dir="rtl">
                            <SelectItem value="none">-- غير محددة بعد --</SelectItem>
                            {printers.map(p => (
                              <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </CardContent>
                    </Card>

                    {/* Per-Meter Pricing Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <Card className="border-emerald-500/25 bg-emerald-500/5 rounded-2xl">
                        <CardContent className="p-4.5 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-emerald-400">سعر بيع المتر للزبون</span>
                            <span className="text-[10px] font-bold text-muted-foreground">د.ل / م²</span>
                          </div>
                          <QuickNumberStepper
                            value={customerPrintPerMeter}
                            onChange={setCustomerPrintPerMeter}
                            unit="د.ل/م²"
                            colorClass="text-emerald-300"
                            step={1}
                          />
                          <div className="flex items-center justify-between text-xs font-bold pt-2 border-t border-emerald-500/15">
                            <span className="text-muted-foreground">إجمالي بيع الطباعة:</span>
                            <span className="font-mono text-emerald-300 font-black text-base">{calculatedCustomerPrint.toLocaleString('ar-LY')} د.ل</span>
                          </div>
                        </CardContent>
                      </Card>

                      <Card className="border-blue-500/25 bg-blue-500/5 rounded-2xl">
                        <CardContent className="p-4.5 space-y-3">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-black text-blue-400">تكلفة المتر على الشركة (المطبعة)</span>
                            <span className="text-[10px] font-bold text-muted-foreground">د.ل / م²</span>
                          </div>
                          <QuickNumberStepper
                            value={companyPrintPerMeter}
                            onChange={setCompanyPrintPerMeter}
                            unit="د.ل/م²"
                            colorClass="text-blue-300"
                            step={1}
                          />
                          <div className="flex items-center justify-between text-xs font-bold pt-2 border-t border-blue-500/15">
                            <span className="text-muted-foreground">إجمالي تكلفة الطباعة:</span>
                            <span className="font-mono text-blue-300 font-black text-base">{calculatedCompanyPrint.toLocaleString('ar-LY')} د.ل</span>
                          </div>
                        </CardContent>
                      </Card>
                    </div>

                    {/* Print Billboard Selector */}
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div className="flex items-center gap-2">
                          <CheckSquare className="h-4 w-4 text-blue-400" />
                          <span className="text-xs font-black text-foreground">اللوحات المختارة للطباعة ({printBillboardIds.length} من {enrichedItems.length}):</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={handleSelectAllPrintBillboards}
                            className="h-7.5 text-[11px] font-bold rounded-lg border-border/30 cursor-pointer"
                          >
                            تحديد الكل
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={handleDeselectAllPrintBillboards}
                            className="h-7.5 text-[11px] font-bold text-rose-400 rounded-lg cursor-pointer"
                          >
                            إلغاء التحديد
                          </Button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-[280px] overflow-y-auto p-1">
                        {enrichedItems.map(item => {
                          const isSelected = printBillboardIds.includes(item.billboard_id);
                          return (
                            <div
                              key={item.id}
                              onClick={() => handleToggleItemPrint(item.billboard_id, !isSelected)}
                              className={cn(
                                "flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none",
                                isSelected
                                  ? "border-blue-500/40 bg-blue-500/10 text-blue-300 shadow-sm"
                                  : "border-border/15 bg-card/20 text-muted-foreground hover:bg-card/40"
                              )}
                            >
                              <div className="flex items-center gap-2.5 min-w-0">
                                <Checkbox checked={isSelected} onCheckedChange={() => {}} />
                                <div className="space-y-0.5 min-w-0 text-right">
                                  <div className="text-xs font-black text-foreground truncate">
                                    {item.billboard.Billboard_Name || `لوحة #${item.billboard_id}`}
                                  </div>
                                  <div className="text-[10px] text-muted-foreground/75 font-mono">
                                    {item.billboard.Size} • {item.faces === 1 ? 'وجه' : 'وجهين'} ({item.itemTotalArea.toFixed(1)} م²)
                                  </div>
                                </div>
                              </div>
                              <span className="text-xs font-mono font-bold">
                                {(item.itemTotalArea * customerPrintPerMeter).toLocaleString('ar-LY')} د.ل
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Real-time Print Margin Banner */}
                    <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-500/10 via-card/50 to-emerald-500/10 border border-blue-500/20 flex items-center justify-between gap-4">
                      <div className="space-y-0.5">
                        <div className="text-xs font-bold text-muted-foreground">صافي ربح الطباعة المتوقع:</div>
                        <div className="text-xl font-black font-mono text-emerald-300">
                          {(calculatedCustomerPrint - calculatedCompanyPrint).toLocaleString('ar-LY')} د.ل
                        </div>
                      </div>
                      <div className="text-right text-xs font-bold text-muted-foreground space-y-0.5">
                        <div>إجمالي المساحة: <span className="font-mono text-foreground font-black">{calculatedPrintArea.toFixed(1)} م²</span></div>
                        <div>هامش ربح المتر: <span className="font-mono text-emerald-400 font-black">{(customerPrintPerMeter - companyPrintPerMeter).toFixed(1)} د.ل/م²</span></div>
                      </div>
                    </div>

                  </div>
                )}
              </TabsContent>

              {/* ════════════ TAB 3: CUTOUTS ════════════ */}
              <TabsContent value="cutout" className="mt-0 p-5 sm:p-6 space-y-6">

                {/* Cutouts Master Switch Banner */}
                <div className="p-4.5 rounded-2xl border border-purple-500/30 bg-purple-500/10 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3.5">
                    <div className="h-10 w-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center shrink-0">
                      <Scissors className="h-5 w-5 text-purple-400" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black text-foreground">خدمة صناعة وقص المجسمات (3D Cutouts)</h4>
                      <p className="text-xs text-muted-foreground/80 mt-0.5">
                        تحديد اللوحات التي تحتوي على مجسمات، والورشة المنفذة، وتكاليف القص.
                      </p>
                    </div>
                  </div>
                  <Switch checked={isCutoutActive} onCheckedChange={setIsCutoutActive} />
                </div>

                {isCutoutActive && (
                  <div className="space-y-6 animate-in fade-in duration-200">
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
                  </div>
                )}
              </TabsContent>

              {/* ════════════ TAB 4: DISCOUNTS & SUMMARY ════════════ */}
              <TabsContent value="summary" className="mt-0 p-5 sm:p-6 space-y-6">

                {/* General Discount Card */}
                <Card className="border-border/20 bg-card/40 rounded-2xl shadow-sm">
                  <CardHeader className="p-4.5 border-b border-border/15 pb-3">
                    <CardTitle className="text-xs font-black flex items-center gap-2 text-foreground">
                      <Gift className="h-4 w-4 text-rose-400" />
                      خصم الفاتورة الإجمالي (على الزبون)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4.5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <QuickNumberStepper
                        label="قيمة الخصم (د.ل)"
                        value={discountAmount}
                        onChange={setDiscountAmount}
                        colorClass="text-rose-400"
                        step={50}
                      />
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-muted-foreground">سبب وملاحظات الخصم</Label>
                        <Input
                          placeholder="مثال: خصم خاص بالعميل، عرض ترويجي..."
                          value={discountReason}
                          onChange={e => setDiscountReason(e.target.value)}
                          className="h-10 text-xs font-bold bg-background/60 border-border/30 rounded-xl"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Notes */}
                <Card className="border-border/20 bg-card/40 rounded-2xl shadow-sm">
                  <CardHeader className="p-4.5 border-b border-border/15 pb-3">
                    <CardTitle className="text-xs font-black flex items-center gap-2 text-foreground">
                      <FileText className="h-4 w-4 text-amber-400" />
                      ملاحظات وتفاصيل إضافية على المهمة
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="p-4.5">
                    <Textarea
                      placeholder="أدخل أي ملاحظات مالية أو تنفيذية خاصة بهذه المهمة..."
                      value={notes}
                      onChange={e => setNotes(e.target.value)}
                      className="min-h-[90px] text-xs font-bold bg-background/60 border-border/30 rounded-xl resize-none"
                    />
                  </CardContent>
                </Card>

                {/* Breakdown Allocation Section */}
                <CostAllocationSection
                  allocation={costAllocation}
                  onChange={setCostAllocation}
                  customerInstallCost={finalCustomerInstall}
                  customerPrintCost={calculatedCustomerPrint}
                  customerCutoutCost={calculatedCustomerCutout}
                  totalDiscount={discountAmount}
                />
              </TabsContent>

            </ScrollArea>
          </Tabs>
        )}

        <div className="shrink-0 border-t border-primary/20 bg-card/95 px-4 py-3 sm:px-6" dir="rtl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="grid grid-cols-3 gap-2 sm:flex sm:items-center sm:gap-5">
              <div>
                <div className="text-[9px] font-bold text-muted-foreground">قيمة العملية</div>
                <div className="mt-0.5 font-mono text-sm font-black text-emerald-300">{customerTotal.toLocaleString('ar-LY')} د.ل</div>
              </div>
              <div>
                <div className="text-[9px] font-bold text-muted-foreground">تكلفة الشركة</div>
                <div className="mt-0.5 font-mono text-sm font-black text-amber-300">{companyTotal.toLocaleString('ar-LY')} د.ل</div>
              </div>
              <div>
                <div className="text-[9px] font-bold text-muted-foreground">صافي الربح</div>
                <div className={cn("mt-0.5 font-mono text-sm font-black", netProfit >= 0 ? "text-emerald-300" : "text-rose-300")}>
                  {netProfit.toLocaleString('ar-LY')} د.ل
                </div>
              </div>
            </div>

            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 sm:flex sm:items-center">
              <Button
                onClick={handleSaveAll}
                disabled={distributing || isSaving || loading}
                className="h-11 min-w-0 rounded-xl bg-primary px-5 text-sm font-black text-primary-foreground shadow-sm transition-all duration-200 hover:bg-primary/90 sm:min-w-64"
              >
                {distributing || isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>جاري الحفظ والمزامنة...</span>
                  </>
                ) : (
                  <>
                    <Save className="h-4 w-4" />
                    <span>حفظ العملية وتحديث الفاتورة</span>
                  </>
                )}
              </Button>

              <Button
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={distributing || isSaving}
                className="h-11 rounded-xl border-border/40 px-5 text-xs font-black"
              >
                إلغاء
              </Button>
            </div>
          </div>
        </div>

      </SheetContent>
    </Sheet>
  );
};
