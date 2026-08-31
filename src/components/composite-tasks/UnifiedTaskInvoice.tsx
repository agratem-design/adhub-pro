import { useState, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { VisuallyHidden } from '@radix-ui/react-visually-hidden';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Printer, Loader2, X, FileText, Wrench, Scissors, EyeOff, Eye, RefreshCw, AlertTriangle, Diamond, Download, Percent, MessageCircle } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Input } from '@/components/ui/input';
import { saveHtmlDocAsPdf, htmlToPdfBlob } from '@/utils/pdfHelpers';
import { uploadPdfBlobAndSendWhatsApp } from '@/utils/pdfDriveWhatsApp';
import { preparePrintWindow, writePrintWindow } from '@/utils/printWindowHelper';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { CompositeTaskWithDetails } from '@/types/composite-task';
import {
  SharedInvoiceSettings,
  IndividualInvoiceSettings,
  AllInvoiceSettings,
  DEFAULT_SHARED_SETTINGS,
  DEFAULT_INDIVIDUAL_SETTINGS,
} from '@/types/invoice-templates';
import { getMergedInvoiceStylesAsync } from '@/hooks/useInvoiceSettingsSync';
import { unifiedHeaderHtml, unifiedHeaderFooterCss, unifiedFooterHtml, formatDateForPrint, type UnifiedPrintStyles } from '@/lib/unifiedInvoiceBase';
import { getCurrentOperationInstallationCost } from '@/lib/compositeTaskOperation';
import { calculateInstallationArea, resolveInstallationFacesCount } from '@/lib/installationFaces';

export type InvoiceType = 'customer' | 'print_vendor' | 'cutout_vendor' | 'installation_team';

// The comprehensive hub invoices every installation operation separately.
// Keep historical rows out of the original operation so reinstallations never overlap it.
const INCLUDE_LEGACY_CUMULATIVE_REINSTALL_ROWS = false;

interface InvoiceItem {
  designImage?: string;
  designImageB?: string; // تصميم الوجه الخلفي للتجميع
  face: 'a' | 'b' | 'both'; // إضافة 'both' للتجميع
  sizeName: string;
  width: number;
  height: number;
  quantity: number;
  area: number;
  // تكاليف منفصلة لكل خدمة
  printCost: number;
  installationCost: number;
  cutoutCost: number;
  totalCost: number;
  billboardName?: string;
  isReprintDeduction?: boolean;
  reprintCostType?: string;
  // بيانات جديدة
  billboardImage?: string; // صورة اللوحة
  nearestLandmark?: string; // أقرب نقطة دالة
  district?: string; // المنطقة
  city?: string; // المدينة
  facesCount?: number; // عدد الأوجه للتجميع
  // بيانات تفصيلية للسعر
  installationPricePerPiece?: number; // سعر التركيب للقطعة
  installationPricePerMeter?: number; // سعر التركيب للمتر
  installationCalculationType?: 'piece' | 'meter'; // طريقة حساب التركيب
  billboardId?: number; // معرف اللوحة للتجميع
  billboardType?: string; // نوع اللوحة (برجية عادية، تيبول، إلخ)
  teamId?: string;
  teamName?: string;
  // بيانات إعادة التركيب والاستبدال
  reinstallCount?: number; // عدد مرات إعادة التركيب
  replacementStatus?: string; // حالة الاستبدال (replaced, replacement, etc.)
  isReinstallation?: boolean; // هل هي إعادة تركيب
  isReplacement?: boolean; // هل هي لوحة بديلة
  isOriginalInstallation?: boolean; // هل هي صف التركيب الأصلي (قبل إعادة التركيب)
  originalInstalledImageA?: string; // صورة التركيب الأصلي - وجه أمامي
  originalInstalledImageB?: string; // صورة التركيب الأصلي - وجه خلفي
  reinstallInstalledImageA?: string; // صورة إعادة التركيب - وجه أمامي
  reinstallInstalledImageB?: string; // صورة إعادة التركيب - وجه خلفي
}

interface UnifiedTaskInvoiceProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: CompositeTaskWithDetails;
  tasks?: CompositeTaskWithDetails[]; // Multiple tasks for group invoice
  invoiceType: InvoiceType;
  invoiceData?: {
    items: InvoiceItem[];
    vendorName?: string;
    teamName?: string;
    pricePerMeter?: number;
    cutoutPricePerUnit?: number;
    totalArea?: number;
    totalCutouts?: number;
    totalCost?: number;
  };
}

export function UnifiedTaskInvoice({
  open,
  onOpenChange,
  task,
  tasks,
  invoiceType,
  invoiceData,
}: UnifiedTaskInvoiceProps) {
  // If multiple tasks provided, compute combined totals
  const allTasks = tasks && tasks.length > 1 ? tasks : [task];
  const isGroupInvoice = allTasks.length > 1;
  const printRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();
  const [reloadCounter, setReloadCounter] = useState(0);
  const [isRecalculating, setIsRecalculating] = useState(false);

  const handleRecalculateCosts = async () => {
    setIsRecalculating(true);
    const tId = toast.loading('جاري إعادة حساب تكاليف المهمة...');
    try {
      for (const t of allTasks) {
        // 1. Fetch current items of installation_task
        let newCustomerInstall = 0;
        let newCompanyInstall = 0;
        if (t.installation_task_id) {
          const { data: installItems } = await supabase
            .from('installation_task_items')
            .select('customer_installation_cost, company_installation_cost, additional_cost, reinstall_count, customer_original_install_cost, customer_reinstall_cost')
            .eq('task_id', t.installation_task_id);
          if (installItems) {
            installItems.forEach(i => {
              const itemCost = getCurrentOperationInstallationCost(i, t.task_type);
              newCustomerInstall += itemCost;
              newCompanyInstall += (Number(i.company_installation_cost) || 0) + (Number(i.additional_cost) || 0);
            });
          }
        }

        // 2. Fetch current total of print_task
        let newCustomerPrint = 0;
        let newCompanyPrint = 0;
        if (t.print_task_id) {
          const { data: printTask } = await supabase
            .from('print_tasks')
            .select('customer_total_amount, total_cost')
            .eq('id', t.print_task_id)
            .single();
          if (printTask) {
            newCustomerPrint = Number(printTask.customer_total_amount) || 0;
            newCompanyPrint = Number(printTask.total_cost) || 0;
          }
        }

        // 3. Fetch current total of cutout_task
        let newCustomerCutout = 0;
        let newCompanyCutout = 0;
        if (t.cutout_task_id) {
          const { data: cutoutTask } = await supabase
            .from('cutout_tasks')
            .select('customer_total_amount, total_cost')
            .eq('id', t.cutout_task_id)
            .single();
          if (cutoutTask) {
            newCustomerCutout = Number(cutoutTask.customer_total_amount) || 0;
            newCompanyCutout = Number(cutoutTask.total_cost) || 0;
          }
        }

        // Calculate totals
        const discountAmount = t.discount_amount || 0;
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
          .eq('id', t.id);

        if (error) throw error;

        // Also update the combined invoice if it exists
        if (t.combined_invoice_id) {
          await supabase.from('printed_invoices').update({
            print_cost: newCompanyPrint + newCompanyCutout,
            total_amount: customerTotal,
            notes: `فاتورة موحدة للمهمة المجمعة (معاد حسابها)\n` +
                   `تركيب: ${newCustomerInstall.toLocaleString()} د.ل\n` +
                   (newCustomerPrint > 0 ? `طباعة: ${newCustomerPrint.toLocaleString()} د.ل\n` : '') +
                   (newCustomerCutout > 0 ? `قص: ${newCustomerCutout.toLocaleString()} د.ل\n` : '') +
                   (discountAmount > 0 ? `خصم: ${discountAmount.toLocaleString()} د.ل\n` : '') +
                   (t.notes ? `\nملاحظات: ${t.notes}` : ''),
            updated_at: new Date().toISOString()
          } as any).eq('id', t.combined_invoice_id);

          // Sync customer payment entry
          await supabase.from('customer_payments')
            .update({
              amount: -customerTotal,
              notes: `مهمة مجمعة - عقد #${t.contract_id} (معاد حسابها)`
            })
            .eq('printed_invoice_id', t.combined_invoice_id)
            .eq('entry_type', 'invoice');
        }
      }

      toast.dismiss(tId);
      toast.success('تم إعادة حساب وتحديث التكاليف بنجاح');
      queryClient.invalidateQueries({ queryKey: ['composite-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['print-tasks'] });
      setReloadCounter(c => c + 1);
    } catch (e: any) {
      toast.dismiss(tId);
      console.error(e);
      toast.error(e.message || 'حدث خطأ أثناء إعادة حساب التكاليف');
    } finally {
      setIsRecalculating(false);
    }
  };

  const [isLoading, setIsLoading] = useState(true);
  const [shared, setShared] = useState<SharedInvoiceSettings>(DEFAULT_SHARED_SETTINGS);
  const [individual, setIndividual] = useState<IndividualInvoiceSettings>(DEFAULT_INDIVIDUAL_SETTINGS);
  const [mergedStyles, setMergedStyles] = useState<any>(null);
  const [showCosts, setShowCosts] = useState(true);
  const [showPriceDetails, setShowPriceDetails] = useState(true);
  const [data, setData] = useState<typeof invoiceData>(invoiceData);
  const [displayMode, setDisplayMode] = useState<'detailed' | 'summary'>('detailed');
  const [separateFaces, setSeparateFaces] = useState(true);
  const [contractIds, setContractIds] = useState<number[]>([task.contract_id].filter(Boolean));
  const [showSignatureSection, setShowSignatureSection] = useState(false);
  const [showInstalledImages, setShowInstalledImages] = useState(false);
  const [showBackFaceImages, setShowBackFaceImages] = useState(false);
  const [showTasksBreakdown, setShowTasksBreakdown] = useState(false);
  const [hideReprintLabels, setHideReprintLabels] = useState(true);
  const [showDimensions, setShowDimensions] = useState(true);
  const [showServiceBreakdown, setShowServiceBreakdown] = useState(false);
  const [whatsAppSending, setWhatsAppSending] = useState(false);
  const [pdfExporting, setPdfExporting] = useState(false);
  const [showWhatsAppPhoneInput, setShowWhatsAppPhoneInput] = useState(false);
  const [whatsAppManualPhone, setWhatsAppManualPhone] = useState('');

  const cleanReprintLabel = (text: string) => {
    if (!hideReprintLabels) return text;
    return text
      .replace(/إعادة طباعة\s*\([^)]*\)\s*-?\s*/g, '')
      .replace(/\(إعادة طباعة\)/g, '')
      .replace(/إعادة طباعة\s*-?\s*/g, '')
      .trim() || text;
  };
  const [installedImagesMap, setInstalledImagesMap] = useState<Record<number, { face_a?: string; face_b?: string }>>({});
  const [installationTeamBuckets, setInstallationTeamBuckets] = useState<Record<string, { teamName: string; items: InvoiceItem[]; totalCost: number }>>({});
  const [selectedInstallationTeam, setSelectedInstallationTeam] = useState<string>('');
  const [discountOpen, setDiscountOpen] = useState(false);
  const [discountAmount, setDiscountAmount] = useState<number>(0);
  const [discountTarget, setDiscountTarget] = useState<string>('all');
  const [discountReason, setDiscountReason] = useState<string>('');
  const [savingDiscount, setSavingDiscount] = useState(false);
  const [adType, setAdType] = useState<string>('');

  // Load settings, contracts, and data
  useEffect(() => {
    const loadData = async () => {
      try {
        setIsLoading(true);
        // ✅ استخدم contract_id من المهام المجمعة والمهام الفرعية
        const taskContractIds: number[] = [...new Set(
          allTasks.flatMap(t => {
            const ids = t._contractIds || t.contractIds || (t.contract_id ? [t.contract_id] : []);
            return Array.isArray(ids) ? ids : [ids];
          })
        )].filter(Boolean) as number[];

        // جلب نوع الإعلان من العقود الصحيحة للعميل فقط
        if (taskContractIds.length > 0) {
          const { data: contractsData } = await supabase
            .from('Contract')
            .select('Contract_Number, "Ad Type", "Customer Name", customer_id')
            .in('Contract_Number', taskContractIds);
          if (contractsData && contractsData.length > 0) {
            const filteredContracts = contractsData.filter(c => {
              if (c.customer_id && task.customer_id) {
                return c.customer_id === task.customer_id;
              }
              return c['Customer Name'] === task.customer_name;
            });
            const finalContractIds = filteredContracts.map(c => Number(c.Contract_Number));
            setContractIds(finalContractIds.sort((a, b) => a - b));

            const uniqueAdTypes = [...new Set(filteredContracts.map(c => c['Ad Type']).filter(Boolean))];
            if (uniqueAdTypes.length > 0) setAdType(uniqueAdTypes.join(' / '));
          }
        }

        // جلب صور التركيب من جميع المهام
        const allInstallTaskIdsForContracts = allTasks.map(t => t.installation_task_id).filter(Boolean) as string[];
        if (allInstallTaskIdsForContracts.length > 0) {
          const { data: installItems } = await supabase
            .from('installation_task_items')
            .select('billboard_id, installed_image_face_a_url, installed_image_face_b_url')
            .in('task_id', allInstallTaskIdsForContracts);

          const installedImages: Record<number, { face_a?: string; face_b?: string }> = {};

          (installItems || []).forEach((row: any) => {
            if (row.billboard_id) {
              installedImages[row.billboard_id] = {
                face_a: row.installed_image_face_a_url || undefined,
                face_b: row.installed_image_face_b_url || undefined,
              };
            }
          });

          setInstalledImagesMap(installedImages);
        }

        // Load unified settings from print_settings (single source of truth)
        const ms: any = await getMergedInvoiceStylesAsync('composite_task');
        if (ms) {
          setMergedStyles(ms);
          setShared(prev => ({
            ...prev,
            companyName: ms.companyName || prev.companyName,
            companySubtitle: ms.companySubtitle || prev.companySubtitle,
            companyAddress: ms.companyAddress || prev.companyAddress,
            companyPhone: ms.companyPhone || prev.companyPhone,
            logoPath: ms.logoPath || prev.logoPath,
            logoSize: ms.logoSize || prev.logoSize,
            showLogo: ms.showLogo ?? prev.showLogo,
            fontFamily: ms.fontFamily || prev.fontFamily,
            footerText: ms.footerText || prev.footerText,
            showFooter: ms.showFooter ?? prev.showFooter,
            showCompanyName: ms.showCompanyName ?? prev.showCompanyName,
            showCompanySubtitle: ms.showCompanySubtitle ?? prev.showCompanySubtitle,
            showCompanyAddress: ms.showCompanyAddress ?? prev.showCompanyAddress,
            showCompanyPhone: ms.showCompanyPhone ?? prev.showCompanyPhone,
          }));
          setIndividual(prev => ({
            ...prev,
            primaryColor: ms.primaryColor || prev.primaryColor,
            secondaryColor: ms.secondaryColor || prev.secondaryColor,
            tableHeaderBgColor: ms.tableHeaderBgColor || prev.tableHeaderBgColor,
            tableHeaderTextColor: ms.tableHeaderTextColor || prev.tableHeaderTextColor,
            tableBorderColor: ms.tableBorderColor || prev.tableBorderColor,
            tableRowEvenColor: ms.tableRowEvenColor || prev.tableRowEvenColor,
            tableRowOddColor: ms.tableRowOddColor || prev.tableRowOddColor,
            headerFontSize: ms.headerFontSize || prev.headerFontSize,
            bodyFontSize: ms.bodyFontSize || prev.bodyFontSize,
          }));
        }

        // If no data provided, load based on invoice type
        if (!invoiceData) {
          await loadInvoiceData();
        } else {
          setData(invoiceData);
          setInstallationTeamBuckets({});
          setSelectedInstallationTeam('');
        }
      } catch (e) {
        console.error('Error loading settings:', e);
      } finally {
        setIsLoading(false);
      }
    };

    if (open) {
      loadData();
    }
  }, [open, invoiceType, task.id, task.installation_task_id, task.contract_id, reloadCounter]);

  const loadInvoiceData = async () => {
    const items: InvoiceItem[] = [];
    let vendorName = '';
    let teamName = '';
    let installationTaskTeamId: string | null = null;
    let installationTaskTeamName = 'غير محدد';
    let pricePerMeter = 0;
    let cutoutPricePerUnit = 0;
    let totalArea = 0;
    let totalCutouts = 0;
    let totalCost = 0;

    try {
      // ✅ متغيرات مساعدة لدعم الفاتورة المجمعة
      const allInstallIds = allTasks.map(t => t.installation_task_id).filter(Boolean) as string[];
      const allPrintIds = allTasks.map(t => t.print_task_id).filter(Boolean) as string[];
      const allCutoutIds = allTasks.map(t => t.cutout_task_id).filter(Boolean) as string[];
      const aggCustomerPrint = allTasks.reduce((s, t) => s + (t.customer_print_cost || 0), 0);
      const aggCustomerInstall = allTasks.reduce((s, t) => s + (t.customer_installation_cost || 0), 0);
      const aggCustomerCutout = allTasks.reduce((s, t) => s + (t.customer_cutout_cost || 0), 0);
      const aggCompanyPrint = allTasks.reduce((s, t) => s + (t.company_print_cost || 0), 0);
      const aggCompanyInstall = allTasks.reduce((s, t) => s + (t.company_installation_cost || 0), 0);
      const aggCompanyCutout = allTasks.reduce((s, t) => s + (t.company_cutout_cost || 0), 0);
      const aggCustomerTotal = allTasks.reduce((s, t) => s + (t.customer_total || 0), 0);

      // Get printed billboard ids across all subtasks
      const printedBillboardIds = new Set<number>();
      if (allPrintIds.length > 0) {
        const { data: printItems } = await supabase
          .from('print_task_items')
          .select('billboard_id')
          .in('task_id', allPrintIds);
        if (printItems) {
          printItems.forEach((r: any) => {
            if (r.billboard_id) printedBillboardIds.add(Number(r.billboard_id));
          });
        }
      }

      // Load sizes map
      const { data: sizesData } = await supabase.from('sizes').select('name, width, height, installation_price, sort_order');
      const sizesMap: Record<string, { width: number; height: number; installationPrice: number; sortOrder: number }> = {};
      sizesData?.forEach((s: any) => {
        sizesMap[s.name] = { width: s.width || 0, height: s.height || 0, installationPrice: s.installation_price || 0, sortOrder: s.sort_order ?? 999 };
      });

      // جلب صور التصميم من مصادر مختلفة
      let designImages: Record<number, { face_a?: string; face_b?: string }> = {};

      // ✅ PRIMARY: من task_designs (المصدر الرئيسي - خاصة لإعادة التركيب)
      if (allInstallIds.length > 0) {
        const { data: taskDesigns } = await supabase
          .from('task_designs')
          .select('id, task_id, design_face_a_url, design_face_b_url')
          .in('task_id', allInstallIds);

        // نحتاج ربط task_designs بـ billboard_id عبر installation_task_items
        if (taskDesigns && taskDesigns.length > 0) {
          const { data: installItemsForMapping } = await supabase
            .from('installation_task_items')
            .select('billboard_id, selected_design_id, task_id, design_face_a, design_face_b')
            .in('task_id', allInstallIds);

          // إذا كان هناك تصميم واحد فقط، يُطبّق على جميع اللوحات
          if (taskDesigns.length === 1 && installItemsForMapping) {
            const td = taskDesigns[0];
            installItemsForMapping.forEach((item: any) => {
              if (item.billboard_id) {
                designImages[item.billboard_id] = {
                  face_a: td.design_face_a_url || undefined,
                  face_b: td.design_face_b_url || undefined,
                };
              }
            });
          } else if (installItemsForMapping) {
            // ✅ ربط التصاميم عبر selected_design_id مع فولباك لأول تصميم حسب المهمة
            const designById = new Map(taskDesigns.map((td: any) => [td.id, td]));
            // تجميع التصاميم حسب task_id للفولباك
            const firstDesignByTaskId = new Map<string, any>();
            taskDesigns.forEach((td: any) => {
              if (!firstDesignByTaskId.has(td.task_id)) firstDesignByTaskId.set(td.task_id, td);
            });
            const globalFirstDesign = taskDesigns[0];

            installItemsForMapping.forEach((item: any) => {
              if (item.billboard_id) {
                // محاولة ربط التصميم عبر selected_design_id
                const matchedDesign = item.selected_design_id ? designById.get(item.selected_design_id) : null;
                if (matchedDesign) {
                  designImages[item.billboard_id] = {
                    face_a: matchedDesign.design_face_a_url || undefined,
                    face_b: matchedDesign.design_face_b_url || undefined,
                    isMatched: true // تم المطابقة بنجاح
                  };
                } else {
                  // لا تقم بالكتابة فوق تصميم تم مطابقته بنجاح سابقاً بـ fallback
                  if ((designImages[item.billboard_id] as any)?.isMatched) {
                    return;
                  }

                  if (item.design_face_a || item.design_face_b) {
                    // استخدام التصاميم المحددة للعنصر مباشرة من قاعدة البيانات
                    designImages[item.billboard_id] = {
                      face_a: item.design_face_a || undefined,
                      face_b: item.design_face_b || undefined,
                    };
                  } else {
                    // فولباك: أول تصميم لنفس المهمة، ثم أول تصميم عام
                    const fallback = firstDesignByTaskId.get(item.task_id) || globalFirstDesign;
                    designImages[item.billboard_id] = {
                      face_a: fallback.design_face_a_url || undefined,
                      face_b: fallback.design_face_b_url || undefined,
                    };
                  }
                }
              }
            });
          }
        }
      }

      // FALLBACK 1: من print_task_items (جميع المهام)
      if (allPrintIds.length > 0) {
        const { data: printItems } = await supabase
          .from('print_task_items')
          .select('billboard_id, design_face_a, design_face_b')
          .in('task_id', allPrintIds);
        printItems?.forEach((item: any) => {
          if (item.billboard_id && !designImages[item.billboard_id]) {
            designImages[item.billboard_id] = { face_a: item.design_face_a, face_b: item.design_face_b };
          }
        });
      }

      // FALLBACK 2: من installation_task_items (جميع المهام)
      if (allInstallIds.length > 0) {
        const { data: installItems } = await supabase
          .from('installation_task_items')
          .select('billboard_id, design_face_a, design_face_b')
          .in('task_id', allInstallIds);
        installItems?.forEach((item: any) => {
          if (item.billboard_id && !designImages[item.billboard_id]) {
            designImages[item.billboard_id] = { face_a: item.design_face_a, face_b: item.design_face_b };
          }
        });
      }

      // ===============================================
      // فواتير المطبعة والقص والتركيب - تستخدم نفس منطق فاتورة الزبون
      // لكن مع التكاليف الأساسية (company costs)
      // ===============================================
      if (invoiceType === 'print_vendor' || invoiceType === 'cutout_vendor' || invoiceType === 'installation_team') {
        // تحديد التكلفة الإجمالية حسب نوع الفاتورة
        if (invoiceType === 'print_vendor') {
          totalCost = aggCompanyPrint;
        } else if (invoiceType === 'cutout_vendor') {
          totalCost = aggCompanyCutout;
        }
        // ملاحظة: فاتورة التركيب ستحسب الإجمالي من جدول المقاسات لاحقاً

        // جلب اسم المورد/الفرقة - من أول مهمة تحتوي على المعرف المطلوب
        const taskWithPrint = allTasks.find(t => t.print_task_id);
        const taskWithCutout = allTasks.find(t => t.cutout_task_id);
        const taskWithInstall = allTasks.find(t => t.installation_task_id);

        if (invoiceType === 'print_vendor' && taskWithPrint?.print_task_id) {
          const { data: printTask } = await supabase
            .from('print_tasks')
            .select('*, printer:printers!print_tasks_printer_id_fkey(name)')
            .eq('id', taskWithPrint.print_task_id)
            .single();
          vendorName = (printTask as any)?.printer?.name || 'غير محدد';
          if ((printTask as any)?.price_per_meter) {
            pricePerMeter = (printTask as any).price_per_meter;
          }
        } else if (invoiceType === 'cutout_vendor' && taskWithCutout?.cutout_task_id) {
          const { data: cutoutTask } = await supabase
            .from('cutout_tasks')
            .select('*, printer:printers!cutout_tasks_printer_id_fkey(name)')
            .eq('id', taskWithCutout.cutout_task_id)
            .single();
          vendorName = (cutoutTask as any)?.printer?.name || 'غير محدد';
        } else if (invoiceType === 'installation_team' && taskWithInstall?.installation_task_id) {
          const { data: installTask } = await supabase
            .from('installation_tasks')
            .select('team_id')
            .eq('id', taskWithInstall.installation_task_id)
            .maybeSingle();

          installationTaskTeamId = (installTask as any)?.team_id || null;

          if (installationTaskTeamId) {
            const { data: teamData } = await supabase
              .from('installation_teams')
              .select('team_name')
              .eq('id', installationTaskTeamId)
              .maybeSingle();

            installationTaskTeamName = (teamData as any)?.team_name || 'غير محدد';
          }

          teamName = installationTaskTeamName;
        }

        // جلب بيانات من installation_task_items (جميع المهام)
        if (allInstallIds.length > 0) {
          const { data: installItems } = await supabase
            .from('installation_task_items')
            .select('*, billboard:billboards!installation_task_items_billboard_id_fkey(ID, Billboard_Name, Size, Faces_Count, design_face_a, design_face_b, has_cutout, Image_URL, Nearest_Landmark, District, City, billboard_type)')
            .in('task_id', allInstallIds)
            .neq('status', 'replaced'); // استبعاد اللوحات المستبدلة

          const teamByTaskItemId = new Map<string, { teamId?: string; teamName: string }>();

          if (invoiceType === 'installation_team' && installItems && installItems.length > 0) {
            const taskItemIds = installItems.map((item: any) => item.id).filter(Boolean);

            if (taskItemIds.length > 0) {
              const { data: teamAccounts } = await supabase
                .from('installation_team_accounts')
                .select('task_item_id, team_id')
                .in('task_item_id', taskItemIds);

              const uniqueTeamIds = Array.from(new Set((teamAccounts || []).map((acc: any) => acc.team_id).filter(Boolean)));
              const teamNamesMap = new Map<string, string>();

              if (uniqueTeamIds.length > 0) {
                const { data: teamsData } = await supabase
                  .from('installation_teams')
                  .select('id, team_name')
                  .in('id', uniqueTeamIds);

                (teamsData || []).forEach((team: any) => {
                  teamNamesMap.set(team.id, team.team_name || 'غير محدد');
                });
              }

              (teamAccounts || []).forEach((account: any) => {
                if (!account.task_item_id) return;
                if (teamByTaskItemId.has(account.task_item_id)) return;

                teamByTaskItemId.set(account.task_item_id, {
                  teamId: account.team_id || installationTaskTeamId || undefined,
                  teamName: (account.team_id ? teamNamesMap.get(account.team_id) : undefined) || installationTaskTeamName || 'غير محدد',
                });
              });
            }
          }

          if (installItems && installItems.length > 0) {
            // حساب المساحة الكلية
            totalArea = 0;
            installItems.forEach((item: any) => {
              const billboardId = item.billboard?.ID || item.billboard_id;
              const isPrinted = allPrintIds.length === 0 || printedBillboardIds.has(Number(billboardId));
              if (invoiceType === 'print_vendor' && !isPrinted) return;

              const billboardSize = item.billboard?.Size;
              let sizeInfo = sizesMap[billboardSize] || { width: 0, height: 0 };

              if (sizeInfo.width === 0 && sizeInfo.height === 0 && billboardSize) {
                const match = billboardSize.match(/(\d+(?:\.\d+)?)[x×](\d+(?:\.\d+)?)/i);
                if (match) {
                  sizeInfo = { width: parseFloat(match[1]), height: parseFloat(match[2]), installationPrice: 0 };
                }
              }

              const linkedTask = allTasks.find(t => t.installation_task_id === item.task_id);
              totalArea += calculateInstallationArea(sizeInfo.width, sizeInfo.height, item, item.billboard, linkedTask?.task_type);
            });

            // حساب سعر المتر للطباعة - استخدام القيمة من مهمة الطباعة إن وجدت
            if (!pricePerMeter || pricePerMeter <= 0) {
              pricePerMeter = totalArea > 0 ? aggCompanyPrint / totalArea : 0;
            }

            // حساب إجمالي أسعار التركيب من sizesMap
            let totalSizesInstallationPrice = 0;
            installItems.forEach((item: any) => {
              const billboardSize = item.billboard?.Size;
              const sizeInfo = sizesMap[billboardSize] || { width: 0, height: 0, installationPrice: 0 };
              totalSizesInstallationPrice += sizeInfo.installationPrice || 0;
            });

            const installCostRatio = totalSizesInstallationPrice > 0
              ? aggCompanyInstall / totalSizesInstallationPrice
              : 0;

            // حساب تكلفة القص
            const totalCutoutCost = aggCompanyCutout;
            let cutoutBillboardIds = new Set<number>();

            if (allCutoutIds.length > 0 && totalCutoutCost > 0) {
              const { data: cutoutItems } = await supabase
                .from('cutout_task_items')
                .select('billboard_id')
                .in('task_id', allCutoutIds);

              (cutoutItems || []).forEach((ci: any) => {
                if (ci?.billboard_id != null) cutoutBillboardIds.add(Number(ci.billboard_id));
              });
            }

            // Exclude items where has_cutout is explicitly false
            installItems.forEach((it: any) => {
              if (it.has_cutout === false) {
                const id = Number(it.billboard?.ID ?? it.billboard_id);
                cutoutBillboardIds.delete(id);
              }
            });

            if (cutoutBillboardIds.size === 0) {
              installItems
                .filter((it: any) => it.has_cutout === true || (it.has_cutout !== false && it.billboard?.has_cutout === true))
                .forEach((it: any) => {
                  const id = it.billboard?.ID ?? it.billboard_id;
                  if (id != null) cutoutBillboardIds.add(Number(id));
                });
            }

            const taskCutoutCostPerBillboard = cutoutBillboardIds.size > 0 ? totalCutoutCost / cutoutBillboardIds.size : 0;
            totalCutouts = cutoutBillboardIds.size;

            // إضافة كل عنصر
            installItems.forEach((item: any) => {
              const billboardId = item.billboard?.ID || item.billboard_id;

              // Skip if print vendor invoice and not printed
              if (invoiceType === 'print_vendor') {
                const isPrinted = allPrintIds.length === 0 || printedBillboardIds.has(Number(billboardId));
                if (!isPrinted) return;
              }

              const billboardSize = item.billboard?.Size;
              let sizeInfo = sizesMap[billboardSize] || { width: 0, height: 0, installationPrice: 0 };

              if (sizeInfo.width === 0 && sizeInfo.height === 0 && billboardSize) {
                const match = billboardSize.match(/(\d+(?:\.\d+)?)[x×](\d+(?:\.\d+)?)/i);
                if (match) {
                  sizeInfo = { width: parseFloat(match[1]), height: parseFloat(match[2]), installationPrice: 0 };
                }
              }

              const designs = designImages[billboardId] || {};

              // ✅ أولوية التصاميم: task_designs (التصميم الحالي للمهمة) > design_face_a على عنصر التركيب
              const faceAImage = designs.face_a || item.design_face_a;
              const faceBImageRaw = designs.face_b || item.design_face_b;

              const linkedTask = allTasks.find(t => t.installation_task_id === item.task_id);
              const actualFacesCount = resolveInstallationFacesCount(item, item.billboard, linkedTask?.task_type);
              const hasBackFace = actualFacesCount >= 2;
              const faceBImage = hasBackFace ? faceBImageRaw : undefined;

              const itemTeam = teamByTaskItemId.get(item.id);
              const itemTeamId = itemTeam?.teamId || installationTaskTeamId || undefined;
              const itemTeamName = itemTeam?.teamName || installationTaskTeamName || 'غير محدد';

              const areaPerFace = sizeInfo.width * sizeInfo.height;
              const isCutoutDisabled = item.has_cutout === false || (item.has_cutout === undefined && item.billboard?.has_cutout === false);
              const hasCutout = !isCutoutDisabled && (
                item.has_cutout === true ||
                cutoutBillboardIds.has(Number(billboardId)) ||
                (item.has_cutout !== false && item.billboard?.has_cutout === true)
              );
              const facesCountForBillboard = hasBackFace ? 2 : 1;

              // حساب التكاليف حسب نوع الفاتورة
              let printCostPerFace = 0;
              let installCostPerFace = 0;
              let cutoutCostPerFace = 0;

              if (invoiceType === 'print_vendor') {
                const isBillboardPrinted = allPrintIds.length === 0 || printedBillboardIds.has(Number(billboardId));
                printCostPerFace = isBillboardPrinted ? (areaPerFace * pricePerMeter) : 0;
              } else if (invoiceType === 'installation_team') {
                // ✅ استخدام company_installation_cost المخزن في عنصر المهمة
                let itemCompanyCost = item.company_installation_cost || 0;
                const additionalCostForItem = item.additional_cost || 0;
                const facesCount = actualFacesCount;

                // ✅ كشف التكلفة القديمة لإعادة التركيب
                const itemReinstallCount = item.reinstall_count || 0;
                if (itemReinstallCount > 0 && itemCompanyCost > 0) {
                  const baseInstallPrice = sizeInfo.installationPrice || 0;
                  const halfBase = baseInstallPrice / 2;
                  if (itemCompanyCost === baseInstallPrice || (facesCount === 1 && itemCompanyCost === halfBase)) {
                    itemCompanyCost = itemCompanyCost * (itemReinstallCount + 1);
                  }
                }

                let adjustedInstallPrice: number;
                if (itemCompanyCost > 0) {
                  adjustedInstallPrice = itemCompanyCost;
                } else {
                  // ✅ فولباك: استخدام سعر التركيب من جدول المقاسات مباشرة
                  const baseInstallPrice = sizeInfo.installationPrice || 0;
                  adjustedInstallPrice = baseInstallPrice;
                  if (facesCount === 1) {
                    adjustedInstallPrice = adjustedInstallPrice / 2;
                  }
                }

                // إضافة التكاليف الإضافية للوحة (موزعة على الأوجه)
                installCostPerFace = (adjustedInstallPrice + additionalCostForItem) / facesCountForBillboard;
              } else if (invoiceType === 'cutout_vendor') {
                cutoutCostPerFace = hasCutout ? (taskCutoutCostPerBillboard / facesCountForBillboard) : 0;
              }

              const displaySizeName = hasCutout
                ? `${billboardSize || 'غير محدد'} (مجسم)`
                : (billboardSize || 'غير محدد');

              // ✅ جلب بيانات الموقع ونوع اللوحة (مثل فاتورة الزبون)
              // ✅ صورة التركيب الحالية من المهمة (وليس الصورة القديمة على اللوحة)
              const billboardImage = item.installed_image_face_a_url || item.billboard?.Image_URL || '';
              const nearestLandmark = item.billboard?.Nearest_Landmark || '';
              const district = item.billboard?.District || '';
              const city = item.billboard?.City || '';
              const billboardType = item.billboard?.billboard_type || '';

              // حساب السعر الإجمالي للعرض في التفاصيل
              const totalInstallForItem = installCostPerFace * facesCountForBillboard;

              // الوجه الأمامي
              items.push({
                designImage: faceAImage,
                face: 'a',
                sizeName: displaySizeName,
                width: sizeInfo.width || 0,
                height: sizeInfo.height || 0,
                quantity: 1,
                area: areaPerFace,
                printCost: printCostPerFace,
                installationCost: installCostPerFace,
                cutoutCost: cutoutCostPerFace,
                totalCost: printCostPerFace + installCostPerFace + cutoutCostPerFace,
                billboardName: item.billboard?.Billboard_Name || `لوحة #${billboardId}`,
                billboardImage,
                nearestLandmark,
                district,
                city,
                facesCount: actualFacesCount,
                billboardId,
                billboardType,
                teamId: itemTeamId,
                teamName: itemTeamName,
                installationPricePerPiece: totalInstallForItem,
                installationCalculationType: 'piece' as const,
                reinstallCount: item.reinstall_count || 0,
                replacementStatus: item.replacement_status || undefined,
                isReinstallation: (item.reinstall_count || 0) > 0,
                isReplacement: item.replaces_item_id ? true : false,
              });

              // ✅ الوجه الخلفي: يتم إنشاؤه إذا كانت اللوحة ذات وجهين (Faces_Count >= 2)
              if (hasBackFace) {
                items.push({
                  designImage: faceBImage || undefined,
                  face: 'b',
                  sizeName: displaySizeName,
                  width: sizeInfo.width || 0,
                  height: sizeInfo.height || 0,
                  quantity: 1,
                  area: areaPerFace,
                  printCost: printCostPerFace,
                  installationCost: installCostPerFace,
                  cutoutCost: cutoutCostPerFace,
                  totalCost: printCostPerFace + installCostPerFace + cutoutCostPerFace,
                  billboardName: item.billboard?.Billboard_Name || `لوحة #${billboardId}`,
                  billboardImage,
                  nearestLandmark,
                  district,
                  city,
                  facesCount: actualFacesCount,
                  billboardId,
                  billboardType,
                  teamId: itemTeamId,
                  teamName: itemTeamName,
                  installationPricePerPiece: totalInstallForItem,
                  installationCalculationType: 'piece' as const,
                  reinstallCount: item.reinstall_count || 0,
                  replacementStatus: item.replacement_status || undefined,
                  isReinstallation: (item.reinstall_count || 0) > 0,
                  isReplacement: item.replaces_item_id ? true : false,
                });
              }
            });

            // ترتيب حسب sort_order مع الحفاظ على تجميع أوجه نفس اللوحة معاً
            items.sort((a, b) => {
              const sortA = sizesMap[a.sizeName.replace(' (مجسم)', '')]?.sortOrder ?? 999;
              const sortB = sizesMap[b.sizeName.replace(' (مجسم)', '')]?.sortOrder ?? 999;
              if (sortA !== sortB) return sortA - sortB;
              // نفس المقاس: تجميع نفس اللوحة معاً
              if (a.billboardId && b.billboardId && a.billboardId !== b.billboardId) {
                return a.billboardId - b.billboardId;
              }
              // نفس اللوحة: الوجه الأمامي أولاً
              if (a.billboardId === b.billboardId) {
                return a.face === 'a' ? -1 : 1;
              }
              return a.face === 'a' ? -1 : 1;
            });

            // فلترة العناصر بدون تكلفة (للقص مثلاً)
            if (invoiceType === 'cutout_vendor') {
              const filtered = items.filter(item => item.cutoutCost > 0);
              items.length = 0;
              items.push(...filtered);
            }

            // فلترة العناصر بدون تكلفة للطباعة
            if (invoiceType === 'print_vendor') {
              const filtered = items.filter(item => item.printCost > 0);
              items.length = 0;
              items.push(...filtered);
            }

            // ✅ لفاتورة التركيب: حساب الإجمالي من مجموع العناصر
            if (invoiceType === 'installation_team') {
              totalCost = items.reduce((sum, item) => sum + item.totalCost, 0);
            }
          }
        }

        // Fallback: إذا لم توجد عناصر ولكن توجد تكلفة (للطباعة والقص فقط)
        if (items.length === 0 && totalCost > 0 && invoiceType !== 'installation_team') {
          const serviceName = invoiceType === 'print_vendor' ? 'خدمة الطباعة (مجمّعة)'
            : 'خدمة القص (مجمّعة)';

          items.push({
            designImage: undefined,
            face: 'a',
            sizeName: serviceName,
            width: 0,
            height: 0,
            quantity: 1,
            area: invoiceType === 'print_vendor' ? 1 : 0,
            printCost: invoiceType === 'print_vendor' ? totalCost : 0,
            installationCost: 0,
            cutoutCost: invoiceType === 'cutout_vendor' ? totalCost : 0,
            totalCost: totalCost,
            billboardName: invoiceType === 'print_vendor' ? 'طباعة' : 'قص مجسمات',
          });
        }

        // ✅ جلب إعادات الطباعة المحملة على المطبعة وإضافتها لفاتورة المطبعة
        if (invoiceType === 'print_vendor' && allPrintIds.length > 0) {
          const { data: printerReprints } = await supabase
            .from('print_reprints')
            .select('*, print_task_items!print_reprints_print_task_item_id_fkey(billboard_id, design_face_a, design_face_b, billboards:billboards!print_task_items_billboard_id_fkey(Billboard_Name, Size))')
            .in('task_id', allPrintIds)
            .neq('status', 'cancelled');

          if (printerReprints && printerReprints.length > 0) {
            printerReprints.forEach((reprint: any, reprintIdx: number) => {
              const bbName = reprint.print_task_items?.billboards?.Billboard_Name || `لوحة ${reprint.billboard_id || ''}`;

              // جلب تصميم الوجه المناسب
              const bbId = reprint.print_task_items?.billboard_id;
              const reprintDesignA = reprint.print_task_items?.design_face_a || (bbId ? designImages[bbId]?.face_a : undefined);
              const reprintDesignB = reprint.print_task_items?.design_face_b || (bbId ? designImages[bbId]?.face_b : undefined);

              // ✅ معرف فريد سالب لإعادات الطباعة حتى لا تتداخل مع صفوف اللوحات الأصلية
              const reprintGroupId = -(10000 + reprintIdx);

              const halfArea = (reprint.area || 0) / 2;
              const halfCost = (reprint.printer_cost || 0) / 2;
              const bbSize = reprint.print_task_items?.billboards?.Size || '';

              // ✅ بنود إعادة الطباعة على المطبعة تظهر بقيم سالبة (خصم)
              const costMultiplier = reprint.cost_type === 'printer' ? -1 : 1;
              const isReprintDeduction = reprint.cost_type === 'printer';

              // تسمية واضحة حسب نوع التحميل
              const costLabel = reprint.cost_type === 'printer' ? '(على المطبعة)'
                : reprint.cost_type === 'customer' ? '(على الزبون)'
                  : reprint.cost_type === 'company' ? '(على الشركة)'
                    : reprint.cost_type === 'split' ? '(مقسّم)' : '';

              if (reprint.face_type === 'both') {
                items.push({
                  designImage: reprintDesignA,
                  face: 'a' as const,
                  sizeName: `إعادة طباعة ${costLabel} - ${bbSize}`,
                  width: 0, height: 0, quantity: 1,
                  area: halfArea,
                  printCost: halfCost * costMultiplier,
                  installationCost: 0, cutoutCost: 0,
                  totalCost: halfCost * costMultiplier,
                  billboardName: `${bbName} (إعادة طباعة)`,
                  billboardId: reprintGroupId,
                  facesCount: 2,
                  isReprintDeduction,
                  reprintCostType: reprint.cost_type,
                });
                items.push({
                  designImage: reprintDesignB,
                  face: 'b' as const,
                  sizeName: `إعادة طباعة ${costLabel} - ${bbSize}`,
                  width: 0, height: 0, quantity: 1,
                  area: halfArea,
                  printCost: halfCost * costMultiplier,
                  installationCost: 0, cutoutCost: 0,
                  totalCost: halfCost * costMultiplier,
                  billboardName: `${bbName} (إعادة طباعة)`,
                  billboardId: reprintGroupId,
                  facesCount: 2,
                  isReprintDeduction,
                  reprintCostType: reprint.cost_type,
                });
              } else {
                const reprintDesign = reprint.face_type === 'B' ? reprintDesignB : reprintDesignA;
                const reprintCost = reprint.printer_cost || 0;
                items.push({
                  designImage: reprintDesign,
                  face: reprint.face_type === 'B' ? 'b' as const : 'a' as const,
                  sizeName: `إعادة طباعة ${costLabel} - ${bbSize}`,
                  width: 0, height: 0, quantity: 1,
                  area: reprint.area || 0,
                  printCost: reprintCost * costMultiplier,
                  installationCost: 0, cutoutCost: 0,
                  totalCost: reprintCost * costMultiplier,
                  billboardName: `${bbName} (إعادة طباعة)`,
                  billboardId: reprintGroupId,
                  facesCount: reprint.face_type === 'both' ? 2 : 1,
                  isReprintDeduction,
                  reprintCostType: reprint.cost_type,
                });
              }
            });
          }
        }

      } else if (invoiceType === 'customer') {
        // ===============================================
        // DEBUG: تتبع بيانات المهمة
        // ===============================================


        // Customer invoice - جلب بيانات من installation_task_items للحصول على اللوحات
        if (allInstallIds.length > 0) {
          // استخدام العلاقة الصريحة لتجنب خطأ PGRST201 - مع جلب has_cutout وبيانات اللوحة + بيانات التسعير
          const { data: installItems, error: installError } = await supabase
            .from('installation_task_items')
            .select('*, billboard:billboards!installation_task_items_billboard_id_fkey(ID, Billboard_Name, Size, Faces_Count, design_face_a, design_face_b, has_cutout, Image_URL, Nearest_Landmark, District, City, billboard_type)')
            .in('task_id', allInstallIds)
            .neq('status', 'replaced'); // استبعاد اللوحات المستبدلة



          // ✅ جلب صور التركيب الأصلية وإعادات التركيب من الأرشيف للوحات المُعاد تركيبها
          const reinstalledItemIds = (installItems || []).filter((item: any) => (item.reinstall_count || 0) > 0).map((item: any) => item.id);
          let photoHistoryMap: Record<string, { face_a?: string; face_b?: string; installation_date?: string }> = {};
          let photoHistoryByItemMap: Record<string, Record<number, { face_a?: string; face_b?: string; installation_date?: string }>> = {};
          if (reinstalledItemIds.length > 0) {
            const { data: photoHistory } = await supabase
              .from('installation_photo_history')
              .select('task_item_id, installed_image_face_a_url, installed_image_face_b_url, installation_date, reinstall_number')
              .in('task_item_id', reinstalledItemIds)
              .order('reinstall_number', { ascending: true });

            (photoHistory || []).forEach((ph: any) => {
              if (!photoHistoryByItemMap[ph.task_item_id]) {
                photoHistoryByItemMap[ph.task_item_id] = {};
              }
              const rNum = ph.reinstall_number || 1;
              photoHistoryByItemMap[ph.task_item_id][rNum] = {
                face_a: ph.installed_image_face_a_url || undefined,
                face_b: ph.installed_image_face_b_url || undefined,
                installation_date: ph.installation_date || undefined,
              };

              // أول أرشيف برقم 1 هو التركيب الأصلي
              if (rNum === 1 || !photoHistoryMap[ph.task_item_id]) {
                photoHistoryMap[ph.task_item_id] = {
                  face_a: ph.installed_image_face_a_url || undefined,
                  face_b: ph.installed_image_face_b_url || undefined,
                  installation_date: ph.installation_date || undefined,
                };
              }
            });

          }

          if (installItems && installItems.length > 0) {
            // ✅ بناء فهرس مهمة لكل عنصر مبكراً لاستخدامه في تصفية حساب سعر المتر
            const _taskByInstallIdEarly = new Map<string, any>();
            allTasks.forEach((t: any) => {
              if (t.installation_task_id) _taskByInstallIdEarly.set(t.installation_task_id, t);
            });

            // حساب المساحة الكلية أولاً مع استخراج الأبعاد من نص المقاس
            totalArea = 0;
            // مساحة مخصصة لحساب سعر المتر — تستبعد العناصر التي تكلفتها صفر للزبون والمستثناة من الطباعة
            let totalAreaForPriceRate = 0;
            installItems.forEach((item: any) => {
              const billboardSize = item.billboard?.Size;
              let sizeInfo = sizesMap[billboardSize] || { width: 0, height: 0 };

              // إذا لم يكن المقاس موجوداً في sizesMap، استخرج الأبعاد من نص المقاس
              if (sizeInfo.width === 0 && sizeInfo.height === 0 && billboardSize) {
                const match = billboardSize.match(/(\d+(?:\.\d+)?)[x×](\d+(?:\.\d+)?)/i);
                if (match) {
                  sizeInfo = { width: parseFloat(match[1]), height: parseFloat(match[2]), installationPrice: 0 };
                }
              }

              const linkedTask = _taskByInstallIdEarly.get(item.task_id);
              const itemTotalArea = calculateInstallationArea(sizeInfo.width, sizeInfo.height, item, item.billboard, linkedTask?.task_type);
              totalArea += itemTotalArea;

              // تحقق من كون اللوحة مشمولة بالطباعة
              const billboardId = item.billboard?.ID || item.billboard_id;
              const isPrinted = allPrintIds.length === 0 || printedBillboardIds.has(Number(billboardId));

              const itemCustomerInstall = getCurrentOperationInstallationCost(item, linkedTask?.task_type);
              const taskCustomerPrint = Number(linkedTask?.customer_print_cost) || 0;
              const isFreeItem = itemCustomerInstall === 0 && taskCustomerPrint === 0;
              if (!isFreeItem && isPrinted) {
                totalAreaForPriceRate += itemTotalArea;
              }
            });

            pricePerMeter = totalAreaForPriceRate > 0 ? aggCustomerPrint / totalAreaForPriceRate : 0;

            // ✅ بناء فهرس المهام المجمعة حسب installation_task_id لربط كل عنصر بمهمته الأصلية
            const taskByInstallId = new Map<string, any>();
            allTasks.forEach((t: any) => {
              if (t.installation_task_id) taskByInstallId.set(t.installation_task_id, t);
            });
            // فولباك: لو فيه عنصر بدون مهمة مطابقة، نستخدم المهمة الرئيسية
            const fallbackTask = task;

            // ✅ تجميع عناصر التركيب لكل مهمة + حساب الإجماليات الخاصة بكل مهمة
            type PerTaskAgg = {
              compositeTask: any;
              totalArea: number;
              printedArea?: number;
              totalSizesInstallationPrice: number;
              cutoutBillboardIds: Set<number>;
              pricePerMeter: number;
              installCostRatio: number;
              taskCutoutCostPerBillboard: number;
            };
            const perTaskAggMap = new Map<string, PerTaskAgg>();
            const itemsGroupedByTask = new Map<string, any[]>();

            installItems.forEach((item: any) => {
              const tid = item.task_id || '';
              if (!itemsGroupedByTask.has(tid)) itemsGroupedByTask.set(tid, []);
              itemsGroupedByTask.get(tid)!.push(item);
            });

            // ✅ جلب عناصر القص لكل المهام مرة واحدة، ثم تصنيفها حسب task_id
            const cutoutItemsByTaskId = new Map<string, Set<number>>();
            if (allCutoutIds.length > 0) {
              const { data: cutoutItems } = await supabase
                .from('cutout_task_items')
                .select('task_id, billboard_id')
                .in('task_id', allCutoutIds);
              (cutoutItems || []).forEach((ci: any) => {
                if (!ci?.task_id || ci?.billboard_id == null) return;
                if (!cutoutItemsByTaskId.has(ci.task_id)) cutoutItemsByTaskId.set(ci.task_id, new Set<number>());
                cutoutItemsByTaskId.get(ci.task_id)!.add(Number(ci.billboard_id));
              });
            }

            itemsGroupedByTask.forEach((taskItems, taskInstallId) => {
              const compTask = taskByInstallId.get(taskInstallId) || fallbackTask;

              let taskTotalArea = 0;
              let taskPrintedArea = 0;
              let taskTotalSizesInstallationPrice = 0;
              const taskCutoutBillboardIds = new Set<number>();

              taskItems.forEach((item: any) => {
                const billboardSize = item.billboard?.Size;
                let sizeInfo = sizesMap[billboardSize] || { width: 0, height: 0, installationPrice: 0 };
                if (sizeInfo.width === 0 && sizeInfo.height === 0 && billboardSize) {
                  const match = billboardSize.match(/(\d+(?:\.\d+)?)[x×](\d+(?:\.\d+)?)/i);
                  if (match) {
                    sizeInfo = { width: parseFloat(match[1]), height: parseFloat(match[2]), installationPrice: 0 };
                  }
                }
                const itemTotalArea = calculateInstallationArea(sizeInfo.width, sizeInfo.height, item, item.billboard, compTask?.task_type);
                taskTotalArea += itemTotalArea;

                const billboardId = item.billboard?.ID || item.billboard_id;
                const isPrinted = allPrintIds.length === 0 || printedBillboardIds.has(Number(billboardId));
                if (isPrinted) {
                  taskPrintedArea += itemTotalArea;
                }

                taskTotalSizesInstallationPrice += sizeInfo.installationPrice || 0;
              });

              // اللوحات التي لها قص لهذه المهمة (من cutout_task_items عبر cutout_task_id الخاص بها)
              const taskCutoutId = compTask?.cutout_task_id;
              if (taskCutoutId && cutoutItemsByTaskId.has(taskCutoutId)) {
                cutoutItemsByTaskId.get(taskCutoutId)!.forEach(id => taskCutoutBillboardIds.add(id));
              }

              // إزالة أي لوحات خيار المجسم فيها غير مفعل بصراحة
              taskItems.forEach((it: any) => {
                if (it.has_cutout === false) {
                  const id = Number(it.billboard?.ID ?? it.billboard_id);
                  taskCutoutBillboardIds.delete(id);
                }
              });

              // فولباك 1: استخدام has_cutout من لوحات هذه المهمة فقط
              if (taskCutoutBillboardIds.size === 0) {
                taskItems
                  .filter((it: any) => it.has_cutout === true || (it.has_cutout !== false && it.billboard?.has_cutout === true))
                  .forEach((it: any) => {
                    const id = it.billboard?.ID ?? it.billboard_id;
                    if (id != null) taskCutoutBillboardIds.add(Number(id));
                  });
              }

              const taskCustomerPrint = compTask?.customer_print_cost || 0;
              const taskCustomerInstall = compTask?.customer_installation_cost || 0;
              const taskCustomerCutout = compTask?.customer_cutout_cost || 0;

              // ✅ فولباك 2: إذا كانت هناك تكلفة قص للزبون لكن لم نستطع تحديد اللوحات،
              // عاملْ اللوحات المفعل عليها مجسم كأنها تحمل مجسماً
              if (taskCutoutBillboardIds.size === 0 && taskCustomerCutout > 0) {
                taskItems
                  .filter((it: any) => it.has_cutout !== false && it.billboard?.has_cutout !== false)
                  .forEach((it: any) => {
                    const id = it.billboard?.ID ?? it.billboard_id;
                    if (id != null) taskCutoutBillboardIds.add(Number(id));
                  });
              }

              perTaskAggMap.set(taskInstallId, {
                compositeTask: compTask,
                totalArea: taskTotalArea,
                printedArea: taskPrintedArea,
                totalSizesInstallationPrice: taskTotalSizesInstallationPrice,
                cutoutBillboardIds: taskCutoutBillboardIds,
                pricePerMeter: taskCustomerPrint > 0 && taskPrintedArea > 0 ? taskCustomerPrint / taskPrintedArea : 0,
                installCostRatio: taskCustomerInstall > 0 && taskTotalSizesInstallationPrice > 0
                  ? taskCustomerInstall / taskTotalSizesInstallationPrice
                  : 0,
                taskCutoutCostPerBillboard: taskCustomerCutout > 0 && taskCutoutBillboardIds.size > 0
                  ? taskCustomerCutout / taskCutoutBillboardIds.size
                  : 0,
              });
            });



            // إضافة كل عنصر كصف في الفاتورة
            installItems.forEach((item: any) => {
              const billboardSize = item.billboard?.Size;
              let sizeInfo = sizesMap[billboardSize] || { width: 0, height: 0, installationPrice: 0 };

              if (sizeInfo.width === 0 && sizeInfo.height === 0 && billboardSize) {
                const match = billboardSize.match(/(\d+(?:\.\d+)?)[x×](\d+(?:\.\d+)?)/i);
                if (match) {
                  sizeInfo = { width: parseFloat(match[1]), height: parseFloat(match[2]), installationPrice: 0 };
                }
              }

              const billboardId = item.billboard?.ID || item.billboard_id;
              const designs = designImages[billboardId] || {};

              // ✅ أولوية التصاميم: task_designs (التصميم الحالي للمهمة) > design_face_a على عنصر التركيب
              const faceAImage = designs.face_a || item.design_face_a;
              const faceBImageRaw = designs.face_b || item.design_face_b;

              const perTaskAgg = perTaskAggMap.get(item.task_id || '') || null;
              const operationTask = perTaskAgg?.compositeTask || taskByInstallId.get(item.task_id || '') || fallbackTask;
              const isIndependentReinstallation = operationTask?.task_type === 'reinstallation';
              const requestedReinstalledFaces = item.reinstalled_faces as 'both' | 'face_a' | 'face_b' | undefined;
              const actualFacesCount = resolveInstallationFacesCount(item, item.billboard, operationTask?.task_type);
              const hasBackFace = actualFacesCount >= 2 && (
                isIndependentReinstallation
                  ? (requestedReinstalledFaces === 'both' || !requestedReinstalledFaces)
                  : true
              );
              const faceBImage = hasBackFace ? faceBImageRaw : undefined;

              const areaPerFace = sizeInfo.width * sizeInfo.height;

              const taskPricePerMeter = perTaskAgg ? perTaskAgg.pricePerMeter : 0;
              const taskCutoutBillboardIds = perTaskAgg ? perTaskAgg.cutoutBillboardIds : new Set<number>();
              const taskCutoutCostPerBillboard = perTaskAgg ? perTaskAgg.taskCutoutCostPerBillboard : 0;
              const taskInstallRatio = perTaskAgg ? perTaskAgg.installCostRatio : 0;
              const taskCustomerInstallTotal = perTaskAgg?.compositeTask?.customer_installation_cost || 0;

              const isCutoutDisabled = item.has_cutout === false || (item.has_cutout === undefined && item.billboard?.has_cutout === false);
              const hasCutout = !isCutoutDisabled && (
                item.has_cutout === true ||
                taskCutoutBillboardIds.has(Number(billboardId)) ||
                (item.has_cutout !== false && item.billboard?.has_cutout === true)
              );
              const facesCountForBillboard = hasBackFace ? 2 : 1;
              const cutoutCostPerFaceForBillboard = hasCutout ? (taskCutoutCostPerBillboard / facesCountForBillboard) : 0;
              const isPrinted = allPrintIds.length === 0 || printedBillboardIds.has(Number(billboardId));
              const printCostPerFace = isPrinted ? (areaPerFace * taskPricePerMeter) : 0;

              // ✅ صورة التركيب الحالية من المهمة (وليس الصورة القديمة على اللوحة)
              const billboardImage = item.installed_image_face_a_url || item.billboard?.Image_URL || '';
              const nearestLandmark = item.billboard?.Nearest_Landmark || '';
              const district = item.billboard?.District || '';
              const city = item.billboard?.City || '';
              const billboardType = item.billboard?.billboard_type || '';

              const itemPricingType = item.pricing_type || 'piece';
              const itemPricePerMeter = item.price_per_meter || 0;

              const hasStoredCustomerCost = isIndependentReinstallation
                ? item.customer_reinstall_cost !== null && item.customer_reinstall_cost !== undefined
                  || item.customer_installation_cost !== null && item.customer_installation_cost !== undefined
                : item.customer_installation_cost !== null && item.customer_installation_cost !== undefined;
              let itemCustomerInstallationCost = item.customer_installation_cost ?? null;

              const itemReinstallCount = item.reinstall_count || 0;
              if (isIndependentReinstallation) {
                itemCustomerInstallationCost = getCurrentOperationInstallationCost(item, 'reinstallation');
              } else if (INCLUDE_LEGACY_CUMULATIVE_REINSTALL_ROWS && itemReinstallCount > 0) {
                itemCustomerInstallationCost = (item.customer_original_install_cost || 0) + (item.customer_reinstall_cost || item.customer_installation_cost || 0);
              }

              const isInstallByMeter = itemPricingType === 'meter' && itemPricePerMeter > 0;
              const totalBillboardArea = areaPerFace * facesCountForBillboard;

              let actualItemInstallCost: number;
              if (taskCustomerInstallTotal === 0) {
                // ✅ المهمة المجمعة تكلفة تركيبها للزبون = 0 → جميع لوحاتها بدون تكلفة تركيب
                actualItemInstallCost = 0;
              } else if (isInstallByMeter) {
                actualItemInstallCost = itemPricePerMeter * totalBillboardArea;
              } else if (hasStoredCustomerCost) {
                actualItemInstallCost = itemCustomerInstallationCost ?? 0;
              } else {
                // توزيع نسبي بسعر المقاس بحيث يطابق المجموع تكلفة المهمة
                const baseInstallPrice = sizeInfo.installationPrice || 0;
                actualItemInstallCost = taskInstallRatio > 0
                  ? baseInstallPrice * taskInstallRatio
                  : baseInstallPrice;
              }

              const displaySizeName = hasCutout
                ? `${billboardSize || 'غير حدد'} (مجسم)`
                : (billboardSize || 'غير محدد');

              const installPricePerPieceValue = !isInstallByMeter ? actualItemInstallCost : undefined;
              const installPricePerMeterValue = isInstallByMeter ? itemPricePerMeter : undefined;
              const installCalculationType = isInstallByMeter ? 'meter' : 'piece';

              // عملية إعادة تركيب مستقلة: تعرض وتحاسب العملية الحالية فقط.
              if (isIndependentReinstallation) {
                const operationFaces: Array<'a' | 'b'> = actualFacesCount < 2
                  ? (requestedReinstalledFaces === 'face_b' ? ['b'] : ['a'])
                  : (requestedReinstalledFaces === 'face_b'
                      ? ['b']
                      : requestedReinstalledFaces === 'face_a'
                        ? ['a']
                        : ['a', 'b']);
                const installCostPerFace = actualItemInstallCost / Math.max(operationFaces.length, 1);
                const cutoutCostPerFace = hasCutout ? taskCutoutCostPerBillboard / Math.max(operationFaces.length, 1) : 0;
                const operationNumber = Number(operationTask?.reinstallationNumber) || itemReinstallCount || 1;

                operationFaces.forEach(face => {
                  const isBackFace = face === 'b';
                  const operationDesign = isBackFace ? (faceBImageRaw || faceAImage) : faceAImage;
                  const operationPrintCost = printCostPerFace;
                  items.push({
                    designImage: operationDesign,
                    face,
                    sizeName: displaySizeName,
                    width: sizeInfo.width || 0,
                    height: sizeInfo.height || 0,
                    quantity: 1,
                    area: areaPerFace,
                    printCost: operationPrintCost,
                    installationCost: installCostPerFace,
                    cutoutCost: cutoutCostPerFace,
                    totalCost: operationPrintCost + installCostPerFace + cutoutCostPerFace,
                    billboardName: item.billboard?.Billboard_Name || `لوحة #${billboardId}`,
                    billboardImage,
                    nearestLandmark,
                    district,
                    city,
                    facesCount: actualFacesCount,
                    billboardId,
                    installationPricePerPiece: actualItemInstallCost,
                    installationCalculationType: installCalculationType,
                    billboardType,
                    reinstallCount: operationNumber,
                    isReinstallation: true,
                    isOriginalInstallation: false,
                    isReplacement: item.replaces_item_id ? true : false,
                    reinstallInstalledImageA: item.installed_image_face_a_url || undefined,
                    reinstallInstalledImageB: item.installed_image_face_b_url || undefined,
                  });
                });
              // السجل التراكمي القديم يبقى للمهام الأصلية فقط، ولا يدخل في عملية مستقلة جديدة.
              } else if (itemReinstallCount > 0) {
                const origCost = Number(item.customer_original_install_cost) || (hasStoredCustomerCost ? (item.customer_installation_cost ?? 0) : actualItemInstallCost);
                const origCostPerFace = origCost / facesCountForBillboard;
                const origBillboardId = billboardId + 100000;

                // صور التركيب الأصلي من الأرشيف رقم 1
                const origPhotoA = photoHistoryByItemMap[item.id]?.[1]?.face_a || photoHistoryMap[item.id]?.face_a || item.billboardImage;
                const origPhotoB = photoHistoryByItemMap[item.id]?.[1]?.face_b || photoHistoryMap[item.id]?.face_b || faceBImageRaw;

                // 1. ========== صفوف التركيب الأصلي (تركيب 1) ==========
                items.push({
                  designImage: faceAImage,
                  face: 'a',
                  sizeName: displaySizeName,
                  width: sizeInfo.width || 0,
                  height: sizeInfo.height || 0,
                  quantity: 1,
                  area: areaPerFace,
                  printCost: printCostPerFace,
                  installationCost: origCostPerFace,
                  cutoutCost: hasCutout ? taskCutoutCostPerBillboard / facesCountForBillboard : 0,
                  totalCost: printCostPerFace + origCostPerFace + (hasCutout ? taskCutoutCostPerBillboard / facesCountForBillboard : 0),
                  billboardName: item.billboard?.Billboard_Name || `لوحة #${billboardId}`,
                  billboardImage,
                  nearestLandmark,
                  district,
                  city,
                  facesCount: actualFacesCount,
                  billboardId: origBillboardId,
                  installationPricePerPiece: origCost,
                  installationCalculationType: installCalculationType,
                  billboardType,
                  reinstallCount: 0,
                  isOriginalInstallation: true,
                  isReinstallation: false,
                  isReplacement: item.replaces_item_id ? true : false,
                  originalInstalledImageA: origPhotoA,
                  originalInstalledImageB: origPhotoB,
                });

                if (hasBackFace) {
                  items.push({
                    designImage: faceBImage || undefined,
                    designImageB: undefined,
                    face: 'b',
                    sizeName: displaySizeName,
                    width: sizeInfo.width || 0,
                    height: sizeInfo.height || 0,
                    quantity: 1,
                    area: areaPerFace,
                    printCost: printCostPerFace,
                    installationCost: origCostPerFace,
                    cutoutCost: hasCutout ? taskCutoutCostPerBillboard / facesCountForBillboard : 0,
                    totalCost: printCostPerFace + origCostPerFace + (hasCutout ? taskCutoutCostPerBillboard / facesCountForBillboard : 0),
                    billboardName: item.billboard?.Billboard_Name || `لوحة #${billboardId}`,
                    billboardImage,
                    nearestLandmark,
                    district,
                    city,
                    facesCount: actualFacesCount,
                    billboardId: origBillboardId,
                    installationPricePerPiece: origCost,
                    installationCalculationType: installCalculationType,
                    billboardType,
                    reinstallCount: 0,
                    isOriginalInstallation: true,
                    isReinstallation: false,
                    isReplacement: item.replaces_item_id ? true : false,
                    originalInstalledImageA: origPhotoA,
                    originalInstalledImageB: origPhotoB,
                  });
                }

                // 2. ========== صفوف إعادات التركيب (إعادة تركيب 1، إعادة تركيب 2...) ==========
                const reinstallCost = Number(item.customer_reinstall_cost) || Number(item.customer_installation_cost) || 0;
                const reinstallFacesCount = (actualFacesCount >= 2 && item.reinstalled_faces === 'both') ? 2 : (actualFacesCount >= 2 && !item.reinstalled_faces ? 2 : 1);
                const reinstallCostPerFace = reinstallCost / reinstallFacesCount;
                const reinstalledFaces = actualFacesCount < 2
                  ? (item.reinstalled_faces === 'face_b' ? 'face_b' : 'face_a')
                  : (item.reinstalled_faces || 'both');

                for (let r = 1; r <= itemReinstallCount; r++) {
                  const reinstallBillboardId = billboardId + 200000 + (r - 1) * 10000;

                  // تحديد صورة إعادة التركيب الخاصة بالمرة r
                  const rHist = photoHistoryByItemMap[item.id]?.[r + 1];
                  const rPhotoA = rHist?.face_a || (r === itemReinstallCount ? (item.installed_image_face_a_url || item.billboardImage) : undefined);
                  const rPhotoB = rHist?.face_b || (r === itemReinstallCount ? (item.installed_image_face_b_url || faceBImageRaw) : undefined);

                  if (reinstalledFaces === 'both' || reinstalledFaces === 'face_a') {
                    items.push({
                      designImage: faceAImage,
                      face: 'a',
                      sizeName: displaySizeName,
                      width: sizeInfo.width || 0,
                      height: sizeInfo.height || 0,
                      quantity: 1,
                      area: areaPerFace,
                      printCost: 0,
                      installationCost: reinstallCostPerFace,
                      cutoutCost: 0,
                      totalCost: reinstallCostPerFace,
                      billboardName: item.billboard?.Billboard_Name || `لوحة #${billboardId}`,
                      billboardImage,
                      nearestLandmark,
                      district,
                      city,
                      facesCount: reinstallFacesCount,
                      billboardId: reinstallBillboardId,
                      installationPricePerPiece: reinstallCost,
                      installationCalculationType: 'piece' as const,
                      billboardType,
                      reinstallCount: r,
                      isReinstallation: true,
                      isOriginalInstallation: false,
                      isReplacement: false,
                      reinstallInstalledImageA: rPhotoA,
                      reinstallInstalledImageB: rPhotoB,
                    });
                  }

                  if (reinstalledFaces === 'both' || reinstalledFaces === 'face_b') {
                    items.push({
                      designImage: faceBImageRaw || faceAImage,
                      face: 'b',
                      sizeName: displaySizeName,
                      width: sizeInfo.width || 0,
                      height: sizeInfo.height || 0,
                      quantity: 1,
                      area: areaPerFace,
                      printCost: 0,
                      installationCost: reinstallCostPerFace,
                      cutoutCost: 0,
                      totalCost: reinstallCostPerFace,
                      billboardName: item.billboard?.Billboard_Name || `لوحة #${billboardId}`,
                      billboardImage,
                      nearestLandmark,
                      district,
                      city,
                      facesCount: reinstallFacesCount,
                      billboardId: reinstallBillboardId,
                      installationPricePerPiece: reinstallCost,
                      installationCalculationType: 'piece' as const,
                      billboardType,
                      reinstallCount: r,
                      isReinstallation: true,
                      isOriginalInstallation: false,
                      isReplacement: false,
                      reinstallInstalledImageA: rPhotoA,
                      reinstallInstalledImageB: rPhotoB,
                    });
                  }
                }
              } else {
                // ✅ لوحة عادية (بدون إعادة تركيب) - المنطق الأصلي
                const installCostPerFace = actualItemInstallCost / facesCountForBillboard;

                items.push({
                  designImage: faceAImage,
                  face: 'a',
                  sizeName: displaySizeName,
                  width: sizeInfo.width || 0,
                  height: sizeInfo.height || 0,
                  quantity: 1,
                  area: areaPerFace,
                  printCost: printCostPerFace,
                  installationCost: installCostPerFace,
                  cutoutCost: hasCutout ? taskCutoutCostPerBillboard / facesCountForBillboard : 0,
                  totalCost: printCostPerFace + installCostPerFace + (hasCutout ? taskCutoutCostPerBillboard / facesCountForBillboard : 0),
                  billboardName: item.billboard?.Billboard_Name || `لوحة #${billboardId}`,
                  billboardImage,
                  nearestLandmark,
                  district,
                  city,
                  facesCount: actualFacesCount,
                  billboardId,
                  installationPricePerPiece: installPricePerPieceValue,
                  installationPricePerMeter: installPricePerMeterValue,
                  installationCalculationType: installCalculationType,
                  billboardType,
                  reinstallCount: 0,
                  isReinstallation: false,
                  isReplacement: item.replaces_item_id ? true : false,
                });

                if (hasBackFace) {
                  items.push({
                    designImage: faceBImage || undefined,
                    designImageB: undefined,
                    face: 'b',
                    sizeName: displaySizeName,
                    width: sizeInfo.width || 0,
                    height: sizeInfo.height || 0,
                    quantity: 1,
                    area: areaPerFace,
                    printCost: printCostPerFace,
                    installationCost: installCostPerFace,
                    cutoutCost: hasCutout ? taskCutoutCostPerBillboard / facesCountForBillboard : 0,
                    totalCost: printCostPerFace + installCostPerFace + (hasCutout ? taskCutoutCostPerBillboard / facesCountForBillboard : 0),
                    billboardName: item.billboard?.Billboard_Name || `لوحة #${billboardId}`,
                    billboardImage,
                    nearestLandmark,
                    district,
                    city,
                    facesCount: actualFacesCount,
                    billboardId,
                    installationPricePerPiece: installPricePerPieceValue,
                    installationPricePerMeter: installPricePerMeterValue,
                    installationCalculationType: installCalculationType,
                    billboardType,
                    reinstallCount: 0,
                    isReinstallation: false,
                    isReplacement: item.replaces_item_id ? true : false,
                  });
                }
              }
            });

            // ✅ ترتيب العناصر حسب sort_order من إعدادات المقاسات ثم حسب معرف اللوحة
            items.sort((a, b) => {
              const sortA = sizesMap[a.sizeName.replace(' (مجسم)', '')]?.sortOrder ?? 999;
              const sortB = sizesMap[b.sizeName.replace(' (مجسم)', '')]?.sortOrder ?? 999;
              if (sortA !== sortB) return sortA - sortB;
              // ترتيب اللوحات ذات نفس المقاس حسب معرف اللوحة
              if (a.billboardId && b.billboardId && a.billboardId !== b.billboardId) {
                return a.billboardId - b.billboardId;
              }
              // الوجه الأمامي قبل الخلفي
              return a.face === 'a' ? -1 : 1;
            });


          }
        } else if (allPrintIds.length > 0) {
          // فولباك: من print_task_items (جميع المهام)
          const { data: rawPrintItems } = await supabase
            .from('print_task_items')
            .select('*, billboard:billboards!print_task_items_billboard_id_fkey(Faces_Count)')
            .in('task_id', allPrintIds);

          // قد تحتوي مهام طباعة قديمة على صف وجه خلفي أُنشئ قبل تصحيح عدد الأوجه.
          // العدد الفعلي للوحة هو المرجع النهائي، لذلك نستبعد الوجه الخلفي للوحة ذات الوجه الواحد.
          const printItems = (rawPrintItems || []).filter((item: any) => {
            const physicalFacesCount = resolveInstallationFacesCount(
              { faces_to_install: item.faces_count },
              item.billboard,
            );
            const isBackFaceOnly = Boolean(item.design_face_b) && !item.design_face_a;
            return !(physicalFacesCount === 1 && isBackFaceOnly);
          });

          totalArea = printItems.reduce((sum: number, item: any) => sum + (item.area * item.quantity), 0);
          pricePerMeter = totalArea > 0 ? aggCustomerPrint / totalArea : 0;

          printItems.forEach((item: any) => {
            const itemPrintCost = item.area * item.quantity * pricePerMeter;
            const physicalFacesCount = resolveInstallationFacesCount(
              { faces_to_install: item.faces_count },
              item.billboard,
            );
            if (item.design_face_a) {
              items.push({
                designImage: item.design_face_a,
                face: 'a',
                sizeName: item.size_name || `${item.width}×${item.height}`,
                width: item.width,
                height: item.height,
                quantity: item.quantity,
                area: item.area * item.quantity,
                printCost: itemPrintCost,
                installationCost: 0,
                cutoutCost: 0,
                totalCost: itemPrintCost,
              });
            }
            if (physicalFacesCount > 1 && item.design_face_b) {
              items.push({
                designImage: item.design_face_b,
                face: 'b',
                sizeName: item.size_name || `${item.width}×${item.height}`,
                width: item.width,
                height: item.height,
                quantity: item.quantity,
                area: item.area * item.quantity,
                printCost: itemPrintCost,
                installationCost: 0,
                cutoutCost: 0,
                totalCost: itemPrintCost,
              });
            }
          });
        }

        // Load cutout data (جميع المهام)
        if (allCutoutIds.length > 0) {
          const { data: cutoutTasks } = await supabase
            .from('cutout_tasks')
            .select('total_quantity')
            .in('id', allCutoutIds);
          totalCutouts = (cutoutTasks || []).reduce((sum: number, ct: any) => sum + (ct.total_quantity || 0), 0);
          cutoutPricePerUnit = totalCutouts > 0 ? aggCustomerCutout / totalCutouts : 0;
        }

        // ✅ جلب إعادات الطباعة المحملة على الزبون وإضافتها للفاتورة (جميع المهام)
        if (allPrintIds.length > 0) {
          const { data: customerReprints } = await supabase
            .from('print_reprints')
            .select('*, print_task_items!print_reprints_print_task_item_id_fkey(billboard_id, design_face_a, design_face_b, billboards:billboards!print_task_items_billboard_id_fkey(Billboard_Name, Size, Image_URL))')
            .in('task_id', allPrintIds)
            .eq('cost_type', 'customer')
            .neq('status', 'cancelled');

          if (customerReprints && customerReprints.length > 0) {
            customerReprints.forEach((reprint: any, reprintIdx: number) => {
              const bbName = reprint.print_task_items?.billboards?.Billboard_Name || `لوحة ${reprint.billboard_id || ''}`;
              const bbSize = reprint.print_task_items?.billboards?.Size || '';

              // جلب تصميم الوجه المناسب
              const bbId = reprint.print_task_items?.billboard_id;
              const reprintDesignA = reprint.print_task_items?.design_face_a || (bbId ? designImages[bbId]?.face_a : undefined);
              const reprintDesignB = reprint.print_task_items?.design_face_b || (bbId ? designImages[bbId]?.face_b : undefined);

              // ✅ معرف فريد سالب لإعادات الطباعة حتى لا تتداخل مع صفوف اللوحات الأصلية
              const reprintGroupId = -(20000 + reprintIdx);

              const halfArea = (reprint.area || 0) / 2;
              const halfCost = (reprint.customer_charge || 0) / 2;

              if (reprint.face_type === 'both') {
                // فصل الوجهين إلى صفين منفصلين بتصميم مختلف لكل وجه
                items.push({
                  designImage: reprintDesignA,
                  face: 'a' as const,
                  sizeName: `إعادة طباعة - ${bbSize}`,
                  width: 0, height: 0, quantity: 1,
                  area: halfArea,
                  printCost: halfCost,
                  installationCost: 0, cutoutCost: 0,
                  totalCost: halfCost,
                  billboardName: `${bbName} (إعادة طباعة)`,
                  billboardId: reprintGroupId,
                  billboardImage: reprint.print_task_items?.billboards?.Image_URL,
                  facesCount: 2,
                });
                items.push({
                  designImage: reprintDesignB,
                  face: 'b' as const,
                  sizeName: `إعادة طباعة - ${bbSize}`,
                  width: 0, height: 0, quantity: 1,
                  area: halfArea,
                  printCost: halfCost,
                  installationCost: 0, cutoutCost: 0,
                  totalCost: halfCost,
                  billboardName: `${bbName} (إعادة طباعة)`,
                  billboardId: reprintGroupId,
                  billboardImage: reprint.print_task_items?.billboards?.Image_URL,
                  facesCount: 2,
                });
              } else {
                const reprintDesign = reprint.face_type === 'B' ? reprintDesignB : reprintDesignA;
                items.push({
                  designImage: reprintDesign,
                  face: reprint.face_type === 'B' ? 'b' as const : 'a' as const,
                  sizeName: `إعادة طباعة - ${bbSize} - ${reprint.face_type === 'B' ? 'خلفي' : 'أمامي'}`,
                  width: 0, height: 0, quantity: 1,
                  area: reprint.area || 0,
                  printCost: reprint.customer_charge || 0,
                  installationCost: 0, cutoutCost: 0,
                  totalCost: reprint.customer_charge || 0,
                  billboardName: `${bbName} (إعادة طباعة)`,
                  billboardId: reprintGroupId,
                  billboardImage: reprint.print_task_items?.billboards?.Image_URL,
                  facesCount: 1,
                });
              }
            });
          }
        }

        // ✅ حساب الإجمالي الفعلي من مجموع تكاليف العناصر (بدلاً من القيمة المخزنة)
        // هذا يضمن دقة الإجمالي حتى لو كانت طريقة الحساب مختلفة (بالمتر/بالقطعة)
        if (items.length > 0) {
          totalCost = items.reduce((sum, item) => sum + item.totalCost, 0);

        } else {
          // فولباك: استخدام القيم المخزنة من جميع المهام
          totalCost = aggCustomerTotal;
        }

        // ===============================================
        // CRITICAL: Virtual Items Fallback للفواتير الفارغة
        // إذا لم توجد عناصر حقيقية ولكن توجد تكاليف، ننشئ عناصر افتراضية
        // ===============================================
        if (items.length === 0 && invoiceType === 'customer') {
          const hasPrintCost = aggCustomerPrint > 0;
          const hasInstallCost = aggCustomerInstall > 0;
          const hasCutoutCost = aggCustomerCutout > 0;

          if (hasPrintCost) {
            items.push({
              designImage: undefined,
              face: 'a',
              sizeName: 'خدمة الطباعة (مجمّعة)',
              width: 0,
              height: 0,
              quantity: 1,
              area: totalArea || 1,
              printCost: aggCustomerPrint,
              installationCost: 0,
              cutoutCost: 0,
              totalCost: aggCustomerPrint,
              billboardName: 'طباعة',
            });
          }

          if (hasInstallCost) {
            items.push({
              designImage: undefined,
              face: 'a',
              sizeName: 'خدمة التركيب (مجمّعة)',
              width: 0,
              height: 0,
              quantity: 1,
              area: 0,
              printCost: 0,
              installationCost: aggCustomerInstall,
              cutoutCost: 0,
              totalCost: aggCustomerInstall,
              billboardName: 'تركيب',
            });
          }

          if (hasCutoutCost) {
            items.push({
              designImage: undefined,
              face: 'a',
              sizeName: 'خدمة القص (مجمّعة)',
              width: 0,
              height: 0,
              quantity: totalCutouts || 1,
              area: 0,
              printCost: 0,
              installationCost: 0,
              cutoutCost: aggCustomerCutout,
              totalCost: aggCustomerCutout,
              billboardName: 'قص مجسمات',
            });
          }
        }
      }

      let finalItems = items;
      let finalTeamName = teamName;
      let finalTotalCost = totalCost;

      if (invoiceType === 'installation_team') {
        const buckets: Record<string, { teamName: string; items: InvoiceItem[]; totalCost: number }> = {};

        items.forEach((item) => {
          const key = item.teamId || '__unknown_team__';
          const name = item.teamName || finalTeamName || 'غير محدد';

          if (!buckets[key]) {
            buckets[key] = {
              teamName: name,
              items: [],
              totalCost: 0,
            };
          }

          buckets[key].items.push(item);
          buckets[key].totalCost += item.totalCost || 0;
        });

        setInstallationTeamBuckets(buckets);

        const bucketKeys = Object.keys(buckets);
        if (bucketKeys.length > 0) {
          const defaultTeamKey = (installationTaskTeamId && buckets[installationTaskTeamId])
            ? installationTaskTeamId
            : bucketKeys[0];

          setSelectedInstallationTeam(defaultTeamKey);

          const selectedBucket = buckets[defaultTeamKey];
          finalItems = selectedBucket.items;
          finalTeamName = selectedBucket.teamName;
          finalTotalCost = selectedBucket.totalCost;
        } else {
          setSelectedInstallationTeam('');
        }
      } else {
        setInstallationTeamBuckets({});
        setSelectedInstallationTeam('');
      }

      const finalTotalArea = finalItems.reduce((sum, item) => sum + (Number(item.area) || 0), 0);

      setData({
        items: finalItems,
        vendorName,
        teamName: finalTeamName,
        pricePerMeter,
        cutoutPricePerUnit,
        totalArea: finalTotalArea,
        totalCutouts,
        totalCost: finalTotalCost,
      });
    } catch (error) {
      console.error('Error loading invoice data:', error);
      toast.error('فشل في تحميل بيانات الفاتورة');
    }
  };

  const handleInstallationTeamChange = (teamKey: string) => {
    setSelectedInstallationTeam(teamKey);

    const selectedBucket = installationTeamBuckets[teamKey];
    if (!selectedBucket) return;

    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        items: selectedBucket.items,
        teamName: selectedBucket.teamName,
        totalArea: selectedBucket.items.reduce((sum, item) => sum + (Number(item.area) || 0), 0),
        totalCost: selectedBucket.totalCost,
      };
    });
  };

  const handleSaveDiscount = async () => {
    if (discountAmount <= 0) {
      toast.error('يرجى إدخال مبلغ خصم صحيح');
      return;
    }
    try {
      setSavingDiscount(true);
      if (discountTarget === 'all') {
        const totalCustomer = allTasks.reduce((s, t) => s + (t.customer_total || 0), 0);
        for (const t of allTasks) {
          const ratio = totalCustomer > 0 ? (t.customer_total || 0) / totalCustomer : 1 / allTasks.length;
          const taskDiscount = Math.round(discountAmount * ratio * 100) / 100;
          await supabase
            .from('composite_tasks')
            .update({ discount_amount: taskDiscount, discount_reason: discountReason || null })
            .eq('id', t.id);
        }
      } else {
        await supabase
          .from('composite_tasks')
          .update({ discount_amount: discountAmount, discount_reason: discountReason || null })
          .eq('id', discountTarget);
        for (const t of allTasks) {
          if (t.id !== discountTarget) {
            await supabase
              .from('composite_tasks')
              .update({ discount_amount: 0, discount_reason: null })
              .eq('id', t.id);
          }
        }
      }
      toast.success('تم حفظ الخصم بنجاح');
      setDiscountOpen(false);
    } catch (error) {
      console.error('Error saving discount:', error);
      toast.error('فشل في حفظ الخصم');
    } finally {
      setSavingDiscount(false);
    }
  };

  const buildInvoiceLayoutCss = () => `
    [data-invoice-print] {
      --invoice-gold: ${primaryColor};
      --invoice-gold-soft: #f6edda;
      --invoice-ink: #1d1b17;
      --invoice-muted: #6f685c;
      --invoice-line: #ddd5c5;
    }
    [data-invoice-print] .invoice-recipient-card {
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) auto !important;
      align-items: center !important;
      gap: 14px !important;
      padding: 10px 12px !important;
      margin-bottom: 8px !important;
      border: 1px solid #e4dac4 !important;
      border-right: 4px solid var(--invoice-gold) !important;
      border-radius: 10px !important;
      background: #fffdf8 !important;
      box-shadow: none !important;
    }
    [data-invoice-print] .invoice-recipient-label {
      color: #847a67 !important;
      font-size: 8.5px !important;
      font-weight: 700 !important;
      margin-bottom: 2px !important;
    }
    [data-invoice-print] .invoice-recipient-name {
      color: var(--invoice-ink) !important;
      font-size: 17px !important;
      font-weight: 700 !important;
      line-height: 1.25 !important;
    }
    [data-invoice-print] .invoice-recipient-subtitle {
      color: var(--invoice-muted) !important;
      font-size: 9px !important;
      font-weight: 600 !important;
      margin-top: 3px !important;
    }
    [data-invoice-print] .invoice-overview-stats {
      display: grid !important;
      grid-template-columns: repeat(3, minmax(58px, auto)) !important;
      gap: 5px !important;
    }
    [data-invoice-print] .invoice-overview-stat {
      min-width: 58px !important;
      padding: 6px 8px !important;
      border: 1px solid #e9e0ce !important;
      border-radius: 8px !important;
      background: #ffffff !important;
      text-align: center !important;
    }
    [data-invoice-print] .invoice-overview-stat strong {
      display: block !important;
      color: var(--invoice-ink) !important;
      font-family: Manrope, sans-serif !important;
      font-size: 13px !important;
      line-height: 1.1 !important;
    }
    [data-invoice-print] .invoice-overview-stat span {
      display: block !important;
      color: var(--invoice-muted) !important;
      font-size: 7.5px !important;
      font-weight: 700 !important;
      margin-top: 2px !important;
    }
    [data-invoice-print] .invoice-size-summary {
      margin: 0 0 7px !important;
      padding: 6px 8px !important;
      border: 1px solid #e8dfcf !important;
      border-radius: 9px !important;
      background: #fbfaf7 !important;
    }
    [data-invoice-print] .invoice-size-summary-title {
      color: var(--invoice-ink) !important;
      font-size: 9px !important;
      font-weight: 700 !important;
    }
    [data-invoice-print] .invoice-size-chip {
      padding: 3px 7px !important;
      border: 1px solid #dfd3bb !important;
      border-radius: 999px !important;
      background: #ffffff !important;
      color: #463f33 !important;
      font-size: 8.5px !important;
      font-weight: 700 !important;
    }
    [data-invoice-print] .invoice-items-table {
      border: 1px solid var(--invoice-line) !important;
      border-top: 3px solid var(--invoice-gold) !important;
      margin-bottom: 8px !important;
    }
    [data-invoice-print] .invoice-items-table thead th {
      padding: 6px 3px !important;
      border-color: #5c5549 !important;
      font-size: 9px !important;
      line-height: 1.35 !important;
      font-weight: 700 !important;
    }
    [data-invoice-print] .invoice-items-table tbody td {
      border-color: var(--invoice-line) !important;
      line-height: 1.35 !important;
    }
    [data-invoice-print] .invoice-items-table tbody tr:nth-child(even) td {
      background-color: #fbfaf7 !important;
    }
    [data-invoice-print] .invoice-items-table tbody tr:nth-child(odd) td {
      background-color: #ffffff !important;
    }
    [data-invoice-print] .invoice-items-table td img {
      border-radius: 5px !important;
    }
    [data-invoice-print] .invoice-items-table tfoot td {
      padding: 8px 5px !important;
      border-color: ${tableBorder} !important;
      font-weight: 700 !important;
    }
    [data-invoice-print] .invoice-items-table tfoot tr:last-child td:last-child {
      color: #f4c25a !important;
      font-size: 12px !important;
    }
    [data-invoice-print] .invoice-total-section {
      border: 1px solid #29261f !important;
      border-top: 3px solid var(--invoice-gold) !important;
      border-radius: 9px !important;
      box-shadow: none !important;
    }
    @media print {
      [data-invoice-print] .invoice-recipient-card,
      [data-invoice-print] .invoice-size-summary,
      [data-invoice-print] .invoice-items-table,
      [data-invoice-print] .invoice-total-section {
        break-inside: avoid !important;
      }
    }
  `;

  const buildPrintableHtml = () => {
    if (!printRef.current) return '';

    const fontFamily = shared.fontFamily || 'Doran';
    const printContent = printRef.current.innerHTML;

    return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
<meta charset="UTF-8">
<title>${getInvoiceTitle()}</title>
<style>
  @font-face { font-family: 'Doran'; src: url('/Doran-Regular.otf') format('opentype'); font-weight: 400; }
  @font-face { font-family: 'Doran'; src: url('/Doran-Bold.otf') format('opentype'); font-weight: 700; }
  @font-face { font-family: 'Manrope'; src: url('/Manrope-Regular.otf') format('opentype'); font-weight: 400; }
  @font-face { font-family: 'Manrope'; src: url('/Manrope-Bold.otf') format('opentype'); font-weight: 700; }
  * { margin: 0; padding: 0; box-sizing: border-box !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
  html, body { font-family: '${fontFamily}', 'Noto Sans Arabic', Arial, sans-serif; direction: rtl; background: #fff; width: 100%; box-sizing: border-box !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  .print-container { width: 100% !important; max-width: 100% !important; min-height: auto; padding: 0 !important; margin: 0 !important; background: #fff; display: block; box-sizing: border-box !important; }
  ${unifiedHeaderFooterCss(unifiedStyles)}
  [data-invoice-print] td { border-color: ${tableBorder} !important; }
  ${buildInvoiceLayoutCss()}
  table { page-break-inside: auto !important; width: 100% !important; max-width: 100% !important; border-collapse: collapse !important; margin-bottom: 8px !important; box-sizing: border-box !important; }
  tr { page-break-inside: avoid !important; break-inside: avoid !important; }
  thead { display: table-header-group; }
  tfoot { display: table-row-group !important; page-break-inside: avoid !important; break-inside: avoid !important; page-break-before: avoid !important; break-before: avoid !important; }
  tfoot tr { display: table-row !important; }
  img { page-break-inside: avoid !important; break-inside: avoid !important; }
  td img { position: relative; z-index: 1; max-width: 100% !important; height: auto !important; object-fit: contain !important; }
  td:has(img) { background-color: #fff !important; }

  /* Prevent total/summary from breaking alone */
  .total-section, .cost-section, .summary-section, .cost-summary, [data-no-break] {
    page-break-inside: avoid !important;
    break-inside: avoid !important;
    page-break-before: avoid !important;
    break-before: avoid !important;
  }
  tbody tr:last-child {
    page-break-after: avoid !important;
    break-after: avoid !important;
  }
  tbody tr:nth-last-child(2) {
    page-break-after: avoid !important;
    break-after: avoid !important;
  }
  tbody tr:nth-last-child(3) {
    page-break-after: avoid !important;
    break-after: avoid !important;
  }

  .u-footer { margin-top: auto; page-break-inside: avoid !important; break-inside: avoid !important; }
  @media print {
    @page { size: A4 portrait; margin: 8mm 10mm; }
    * { box-sizing: border-box !important; }
    .print-container, .page, [data-print-page] { width: 100% !important; max-width: 100% !important; min-height: auto; padding: 0 !important; margin: 0 !important; display: block; box-sizing: border-box !important; }
    .page { width: 100% !important; height: auto !important; min-height: auto !important; max-height: 297mm !important; }
    .page:last-child { page-break-after: avoid !important; break-after: avoid !important; }
    .u-header { width: 100% !important; max-width: 100% !important; padding-top: 2px; }
    .u-logo { max-height: 86px; width: auto; object-fit: contain; overflow: visible; }
    .u-footer { width: 100% !important; margin-top: 14px; page-break-inside: avoid !important; break-inside: avoid !important; }
    .total-section, .cost-section, .summary-section, .cost-summary, [data-no-break] {
      page-break-before: avoid !important;
      break-before: avoid !important;
    }
    * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  }
</style>
</head>
<body>
<div class="page print-container" data-print-page data-page-title="${getInvoiceTitle() || 'فاتورة المهمة'}" data-invoice-print>
  ${printContent}
</div>
</body>
</html>`;
  };

  const handlePrint = () => {
    if (!printRef.current) return;

    const docTitle = getInvoiceTitle() || 'فاتورة_مهمة';
    const printWindow = preparePrintWindow(docTitle);
    const html = buildPrintableHtml();

    writePrintWindow(printWindow, html, {
      title: docTitle,
      landscape: false,
      showDownloadPdf: true,
      showShare: true,
      autoPrint: true,
    });
  };

  const getInvoiceTitle = () => {
    const contractLabel = contractIds.length > 1
      ? `عقود #${contractIds.join(', #')}`
      : `عقد #${contractIds[0] ?? ''}`;

    const customerName = task.customer_name || '';
    const invoiceDate = format(new Date(), 'yyyy-MM-dd');
    const facesCount = data?.items?.length || 0;
    const totalCost = isGroupInvoice
      ? allTasks.reduce((s, t) => s + (t.customer_total || 0), 0)
      : (data?.totalCost || task.customer_total || 0);

    // بناء عنوان الفاتورة بناءً على الخدمات المتوفرة فعلياً
    const services: string[] = [];
    if (task.print_task_id || (task.customer_print_cost && task.customer_print_cost > 0)) services.push('طباعة');
    if (task.cutout_task_id || (task.customer_cutout_cost && task.customer_cutout_cost > 0)) services.push('قص');
    if (task.installation_task_id || (task.customer_installation_cost && task.customer_installation_cost > 0)) services.push('تركيب');

    const servicesText = services.length > 0 ? services.join(' و') : 'خدمات';

    let recipientName = customerName;
    if (invoiceType === 'print_vendor' || invoiceType === 'cutout_vendor') {
      recipientName = data?.vendorName || 'المطبعة';
    } else if (invoiceType === 'installation_team') {
      recipientName = data?.teamName || 'الفرقة';
    }

    const groupLabel = isGroupInvoice ? ` | ${allTasks.length} مهام` : '';
    return `فاتورة ${servicesText} | ${recipientName} | ${contractLabel} | ${invoiceDate} | ${facesCount} وجه | ${totalCost.toLocaleString()} د.ل${groupLabel}`;
  };

  const getInvoiceIcon = () => {
    switch (invoiceType) {
      case 'customer': return <FileText className="h-5 w-5 text-primary" />;
      case 'print_vendor': return <Printer className="h-5 w-5 text-blue-600" />;
      case 'cutout_vendor': return <Scissors className="h-5 w-5 text-purple-600" />;
      case 'installation_team': return <Wrench className="h-5 w-5 text-green-600" />;
      default: return <FileText className="h-5 w-5" />;
    }
  };

  const getRecipientInfo = () => {
    // الحصول على اسم الشركة من بيانات العميل المحملة
    const companyName = task.customer?.company;
    const customerName = task.customer?.name || task.customer_name;

    // Debug log


    switch (invoiceType) {
      case 'customer':
        // إظهار اسم الشركة أولاً، ثم اسم الزبون كـ fallback
        return { label: 'الشركة', name: companyName || customerName || 'غير محدد' };
      case 'print_vendor':
        return { label: 'المطبعة', name: data?.vendorName || 'غير محدد' };
      case 'cutout_vendor':
        return { label: 'ورشة القص', name: data?.vendorName || 'غير محدد' };
      case 'installation_team':
        return { label: 'فرقة التركيب', name: data?.teamName || 'غير محدد' };
      default:
        return { label: 'المستلم', name: 'غير محدد' };
    }
  };

  const primaryColor = mergedStyles?.primaryColor || individual.primaryColor || '#D4AF37';
  const secondaryColor = mergedStyles?.secondaryColor || individual.secondaryColor || '#1a1a2e';
  const headerBgColor = (() => {
    const raw = mergedStyles?.headerBgColor;
    if (!raw || raw === 'transparent' || raw === primaryColor) return 'transparent';
    return raw;
  })();
  const headerTextColor = (() => {
    const raw = mergedStyles?.headerTextColor;
    // If header bg is transparent and text is white/near-white, use primaryColor to avoid invisible text
    if (headerBgColor === 'transparent' && raw && /^#f[0-9a-f]{5}$/i.test(raw)) return primaryColor;
    return raw || primaryColor;
  })();
  const headerSwap = mergedStyles?.headerSwap === true;
  const logoSize = Math.min(140, Math.max(88, mergedStyles?.logoSize || shared.logoSize || 112));
  const tableHeaderBg = mergedStyles?.tableHeaderBgColor || individual.tableHeaderBgColor || '#D4AF37';
  const tableHeaderText = mergedStyles?.tableHeaderTextColor || individual.tableHeaderTextColor || '#ffffff';
  const tableBorder = mergedStyles?.tableBorderColor || individual.tableBorderColor || '#D4AF37';
  const tableRowEven = mergedStyles?.tableRowEvenColor || individual.tableRowEvenColor || '#f8f9fa';
  const tableRowOdd = mergedStyles?.tableRowOddColor || individual.tableRowOddColor || '#ffffff';
  const tableText = mergedStyles?.tableTextColor || individual.tableTextColor || '#333333';
  const totalBg = mergedStyles?.totalBgColor || individual.totalBgColor || '#D4AF37';
  const totalText = mergedStyles?.totalTextColor || individual.totalTextColor || '#ffffff';
  const footerTextColor = mergedStyles?.footerTextColor || '#666';
  const customerSectionBorderColor = mergedStyles?.customerSectionBorderColor || primaryColor;
  const customerBg = mergedStyles?.customerSectionBgColor || '#f8f9fa';
  const customerText = mergedStyles?.customerSectionTextColor || '#333333';

  // Build UnifiedPrintStyles for the unified engine
  const unifiedStyles: UnifiedPrintStyles & { invoiceTitle?: string } = {
    companyName: shared.companyName,
    companySubtitle: shared.companySubtitle,
    companyAddress: shared.companyAddress,
    companyPhone: shared.companyPhone,
    companyTaxId: mergedStyles?.companyTaxId,
    companyEmail: mergedStyles?.companyEmail,
    companyWebsite: mergedStyles?.companyWebsite,
    logoPath: shared.logoPath,
    logoSize,
    showLogo: shared.showLogo,
    showCompanyInfo: mergedStyles?.showCompanyInfo,
    showCompanyName: shared.showCompanyName,
    showCompanySubtitle: shared.showCompanySubtitle,
    showCompanyAddress: shared.showCompanyAddress,
    showCompanyPhone: shared.showCompanyPhone,
    showContactInfo: mergedStyles?.showContactInfo,
    showTaxId: mergedStyles?.showTaxId,
    showEmail: mergedStyles?.showEmail,
    showWebsite: mergedStyles?.showWebsite,
    headerMarginBottom: Math.min(16, Math.max(8, mergedStyles?.headerMarginBottom || 12)),
    headerBgColor,
    headerTextColor,
    headerStyle: mergedStyles?.headerStyle || 'classic',
    headerSwap,
    primaryColor,
    secondaryColor,
    headerFontSize: mergedStyles?.headerFontSize || 14,
    invoiceTitleArFontSize: Math.min(22, mergedStyles?.invoiceTitleArFontSize || 20),
    invoiceTitleEnFontSize: mergedStyles?.invoiceTitleEnFontSize || 12,
    logoContainerWidth: mergedStyles?.logoContainerWidth,
    titleContainerWidth: mergedStyles?.titleContainerWidth,
    contactInfoFontSize: mergedStyles?.contactInfoFontSize || 10,
    footerText: mergedStyles?.footerText || shared.footerText || 'شكراً لتعاملكم معنا',
    footerAlignment: mergedStyles?.footerAlignment || 'center',
    footerTextColor,
    footerBgColor: mergedStyles?.footerBgColor || 'transparent',
    footerPosition: mergedStyles?.footerPosition || 15,
    showFooter: mergedStyles?.showFooter !== false,
    showPageNumber: mergedStyles?.showPageNumber !== false,
  };

  const fullLogoUrl = shared.logoPath?.startsWith('http') ? shared.logoPath : `${window.location.origin}${shared.logoPath || '/logofaresgold.svg'}`;

  // Build dynamic invoice title
  const getInvoiceTitleAr = () => {
    let base = 'فاتورة';
    if (invoiceType === 'customer') {
      const hasPrint = Boolean(task.print_task_id) || (task.customer_print_cost || 0) > 0;
      const hasInstall = Boolean(task.installation_task_id) || (task.customer_installation_cost || 0) > 0;
      const hasCutout = Boolean(task.cutout_task_id) || (task.customer_cutout_cost || 0) > 0;
      const parts: string[] = [];
      if (hasPrint) parts.push('طباعة');
      if (hasInstall) parts.push('تركيب');
      if (hasCutout) parts.push('قص');
      base = parts.length > 0 ? `فاتورة ${parts.join(' و ')}` : 'فاتورة';
    } else if (invoiceType === 'print_vendor') {
      base = 'فاتورة طباعة';
    } else if (invoiceType === 'cutout_vendor') {
      base = 'فاتورة قص مجسمات';
    } else {
      base = 'فاتورة تركيب';
    }
    return base;
  };

  // Force dynamic title into unified styles
  unifiedStyles.invoiceTitle = getInvoiceTitleAr();

  // تحديد نوع المهمة: تركيب جديد أو إعادة تركيب - من task_type مباشرة
  const hasReinstallation = allTasks.some(t => t.task_type === 'reinstallation');
  const hasNewInstallation = allTasks.some(t => t.task_type !== 'reinstallation');

  // أيقونة إعادة التركيب SVG inline
  const reinstallIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin:0 2px;"><path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/></svg>`;
  // أيقونة تركيب جديد SVG inline
  const newInstallIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:inline-block;vertical-align:middle;margin:0 2px;"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>`;

  const taskTypeLabel = hasReinstallation && hasNewInstallation
    ? `تركيب جديد + إعادة تركيب ${reinstallIcon}`
    : hasReinstallation
      ? `إعادة تركيب ${reinstallIcon}`
      : `تركيب جديد ${newInstallIcon}`;

  // بناء رمز المهمة مثل re1-1114 أو t1-1114
  const buildTaskSymbol = (t: CompositeTaskWithDetails) => {
    const prefix = t.task_type === 'reinstallation' ? 're' : 't';
    const num = t.task_number || 0;
    const contractId = t.contract_id || '';
    return `${prefix}${num}-${contractId}`;
  };
  const taskSymbols = allTasks.map(buildTaskSymbol);
  const taskSymbolDisplay = taskSymbols.join(' , ');

  const metaLinesHtml = `
    <div><span>التاريخ</span><strong>${formatDateForPrint(task.created_at, mergedStyles?.showHijriDate ?? false)}</strong></div>
    <div><span>${contractIds.length > 1 ? 'أرقام العقود' : 'رقم العقد'}</span><strong>${contractIds.length > 1
      ? contractIds.map(id => `#${id}`).join(', ')
      : `#${contractIds[0] ?? task.contract_id ?? ''}`
    }</strong></div>
    <div><span>رمز المهمة</span><strong>${taskSymbolDisplay}</strong></div>
    ${adType ? `<div><span>نوع الإعلان</span><strong>${adType}</strong></div>` : ''}
    <div><span>نوع المهمة</span><strong>${taskTypeLabel}</strong></div>
  `;

  if (isLoading) {
    return (
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const recipient = getRecipientInfo();
  const companyName = task.customer?.company;
  const customerName = task.customer?.name || task.customer_name;
  const overviewItems = (data?.items || []).filter(item => !item.isReprintDeduction);
  const overviewBillboardIds = new Set(
    overviewItems.map(item => item.billboardId).filter((id): id is number => Boolean(id)),
  );
  const overviewItemsWithoutBillboard = overviewItems.filter(item => !item.billboardId).length;
  const overviewBillboardCount = overviewBillboardIds.size + overviewItemsWithoutBillboard;
  const overviewFaceCount = overviewItems.reduce((sum, item) => sum + (item.face === 'both' ? 2 : 1), 0);
  const overviewStats = invoiceType === 'cutout_vendor'
    ? [
        { label: 'لوحة', value: overviewBillboardCount.toLocaleString('ar-LY') },
        { label: 'مجسم', value: (data?.totalCutouts || 0).toLocaleString('ar-LY') },
      ]
    : [
        { label: 'لوحة', value: overviewBillboardCount.toLocaleString('ar-LY') },
        { label: 'وجه', value: overviewFaceCount.toLocaleString('ar-LY') },
        { label: 'م² إجمالي', value: (data?.totalArea || 0).toFixed(2) },
      ];

  // ✅ تعريف متغيرات حساب الأعمدة على مستوى المكون - تجميع من جميع المهام
  const aggPrintCost = allTasks.reduce((s, t) => s + (t.customer_print_cost || 0), 0);
  const aggInstallCost = allTasks.reduce((s, t) => s + (t.customer_installation_cost || 0), 0);
  const aggCutoutCost = allTasks.reduce((s, t) => s + (t.customer_cutout_cost || 0), 0);
  const hasPrintCost = aggPrintCost > 0;
  const hasInstallCost = aggInstallCost > 0;
  const hasCutoutCost = aggCutoutCost > 0;

  // ✅ حساب الإجمالي الديناميكي بناءً على الأعمدة المرئية فقط
  const calculateDynamicTotal = () => {
    return data?.items?.reduce((sum, item) => sum +
      (hasPrintCost ? (item.printCost || 0) : 0) +
      (hasInstallCost ? (item.installationCost || 0) : 0) +
      (hasCutoutCost ? (item.cutoutCost || 0) : 0), 0) || 0;
  };
  const dynamicTotal = calculateDynamicTotal();
  const payableTotal = invoiceType === 'customer'
    ? dynamicTotal
    : (data?.items?.reduce((sum, item) => sum + (item.totalCost || 0), 0) || 0);
  const hasZeroPayableTotal = showCosts && payableTotal <= 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[94dvh] w-[calc(100vw-1rem)] max-w-[96vw] flex-col overflow-hidden p-0 xl:max-w-7xl">
        <DialogHeader className="shrink-0 border-b border-primary/15 bg-card/95 p-3 backdrop-blur-xl sm:p-4">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10">
                {getInvoiceIcon()}
              </div>
              <div className="min-w-0 text-right">
                <DialogTitle className="truncate text-base font-black sm:text-lg">{getInvoiceTitleAr()}</DialogTitle>
                <VisuallyHidden>
                  <DialogDescription>
                    {contractIds.length > 1 ? `فاتورة عقود رقم ${contractIds.join(', ')}` : `فاتورة عقد رقم ${contractIds[0] ?? ''}`}
                  </DialogDescription>
                </VisuallyHidden>
                <p className="mt-1 truncate text-xs font-bold text-muted-foreground">
                  {recipient.name} · {contractIds.length > 1 ? `عقود #${contractIds.join(', #')}` : `عقد #${contractIds[0] ?? ''}`} · {data?.items?.length || 0} وجه
                </p>
              </div>
            </div>
            <div className="flex w-full items-center gap-2 overflow-x-auto pb-1 xl:w-auto xl:flex-wrap xl:justify-end xl:overflow-visible xl:pb-0">
              {/* زر التبديل بين العرض التفصيلي والمجمّع - لفاتورة الزبون فقط */}
              {invoiceType === 'customer' && (
                <>
                  <div className="flex h-10 shrink-0 items-center gap-1 rounded-xl border border-border/35 bg-muted/50 p-1">
                    <Button
                      variant={displayMode === 'detailed' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setDisplayMode('detailed')}
                      className="h-8 cursor-pointer gap-1 text-xs transition-all duration-200"
                    >
                      <Eye className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">تفصيلي</span>
                    </Button>
                    <Button
                      variant={displayMode === 'summary' ? 'default' : 'ghost'}
                      size="sm"
                      onClick={() => setDisplayMode('summary')}
                      className="h-8 cursor-pointer gap-1 text-xs transition-all duration-200"
                    >
                      <EyeOff className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">مجمّع</span>
                    </Button>
                  </div>
                  <div className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-border/35 bg-background/60 px-2.5">
                    <Switch
                      id="showServiceBreakdown"
                      checked={showServiceBreakdown}
                      onCheckedChange={setShowServiceBreakdown}
                    />
                    <Label htmlFor="showServiceBreakdown" className="text-xs sm:text-sm cursor-pointer">
                      <span className="hidden sm:inline">تفصيل الطباعة والتركيب</span>
                      <span className="sm:hidden">تفصيل</span>
                    </Label>
                  </div>
                  {showServiceBreakdown && (
                    <div className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-border/35 bg-background/60 px-2.5">
                      <Switch
                        id="showPriceDetails"
                        checked={showPriceDetails}
                        onCheckedChange={setShowPriceDetails}
                      />
                      <Label htmlFor="showPriceDetails" className="text-xs sm:text-sm cursor-pointer">
                        <span className="hidden sm:inline">تفاصيل السعر</span>
                        <span className="sm:hidden">السعر</span>
                      </Label>
                    </div>
                  )}
                  {/* زر إظهار صور التركيب */}
                  <div className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-border/35 bg-background/60 px-2.5">
                    <Switch
                      id="showInstalledImages"
                      checked={showInstalledImages}
                      onCheckedChange={setShowInstalledImages}
                    />
                    <Label htmlFor="showInstalledImages" className="text-xs sm:text-sm cursor-pointer">
                      <span className="hidden sm:inline">صور التركيب</span>
                      <span className="sm:hidden">التركيب</span>
                    </Label>
                  </div>
                  {/* زر إظهار صور الوجه الخلفي */}
                  {showInstalledImages && (
                    <div className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-border/35 bg-background/60 px-2.5">
                      <Switch
                        id="showBackFaceImages"
                        checked={showBackFaceImages}
                        onCheckedChange={setShowBackFaceImages}
                      />
                      <Label htmlFor="showBackFaceImages" className="text-xs sm:text-sm cursor-pointer">
                        <span className="hidden sm:inline">الوجه الخلفي</span>
                        <span className="sm:hidden">خلفي</span>
                      </Label>
                    </div>
                  )}
                </>
              )}
              {invoiceType === 'installation_team' && Object.keys(installationTeamBuckets).length > 1 && (
                <div className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-border/35 bg-background/60 px-2.5">
                  <Label className="text-xs sm:text-sm">الفرقة</Label>
                  <Select value={selectedInstallationTeam} onValueChange={handleInstallationTeamChange}>
                    <SelectTrigger className="h-8 w-[140px] cursor-pointer text-xs sm:w-[220px]">
                      <SelectValue placeholder="اختر الفرقة" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(installationTeamBuckets).map(([teamKey, bucket]) => (
                        <SelectItem key={teamKey} value={teamKey}>
                          {bucket.teamName}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              {invoiceType !== 'customer' && (
                <div className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-border/35 bg-background/60 px-2.5">
                  <Switch
                    id="showCosts"
                    checked={showCosts}
                    onCheckedChange={setShowCosts}
                  />
                  <Label htmlFor="showCosts" className="text-xs sm:text-sm cursor-pointer flex items-center gap-1">
                    {showCosts ? <Eye className="h-3 w-3 sm:h-4 sm:w-4" /> : <EyeOff className="h-3 w-3 sm:h-4 sm:w-4" />}
                    <span className="hidden sm:inline">{showCosts ? 'إظهار التكلفة' : 'إخفاء التكلفة'}</span>
                    <span className="sm:hidden">التكلفة</span>
                  </Label>
                </div>
              )}
              {/* زر إعادة حساب التكاليف */}
              <Button
                variant="outline"
                size="sm"
                className="h-10 shrink-0 cursor-pointer gap-1 rounded-xl border-amber-500/25 bg-amber-500/5 text-xs text-amber-500 transition-all duration-200 hover:bg-amber-500/10 hover:text-amber-400"
                onClick={handleRecalculateCosts}
                disabled={isRecalculating}
              >
                {isRecalculating ? (
                  <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                ) : (
                  <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4" />
                )}
                <span className="hidden sm:inline">إعادة حساب التكاليف</span>
                <span className="sm:hidden">إعادة الحساب</span>
              </Button>
              {/* زر الخصم السريع */}
              {invoiceType === 'customer' && (
                <Popover open={discountOpen} onOpenChange={setDiscountOpen}>
                  <PopoverTrigger asChild>
                    <Button variant="outline" size="sm" className="h-10 shrink-0 cursor-pointer gap-1 rounded-xl text-xs transition-all duration-200">
                      <Percent className="h-3 w-3 sm:h-4 sm:w-4" />
                      <span className="hidden sm:inline">خصم</span>
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80" align="end">
                    <div className="space-y-3" dir="rtl">
                      <h4 className="font-semibold text-sm">خصم سريع</h4>
                      {/* إجمالي كل مهمة */}
                      <div className="space-y-1 text-xs">
                        {allTasks.map((t, i) => (
                          <div key={t.id} className="flex justify-between items-center p-1.5 rounded bg-muted">
                            <span>مهمة #{t.task_number || i + 1} (عقد #{t.contract_id})</span>
                            <span className="font-bold">{(t.customer_total || 0).toLocaleString()} د.ل</span>
                          </div>
                        ))}
                        <div className="flex justify-between items-center p-1.5 rounded bg-primary/10 font-bold text-sm">
                          <span>الإجمالي الكلي</span>
                          <span>{allTasks.reduce((s, t) => s + (t.customer_total || 0), 0).toLocaleString()} د.ل</span>
                        </div>
                      </div>
                      {/* مبلغ الخصم */}
                      <div className="space-y-1">
                        <Label className="text-xs">مبلغ الخصم</Label>
                        <Input
                          type="number"
                          min={0}
                          value={discountAmount || ''}
                          onChange={e => setDiscountAmount(Number(e.target.value))}
                          placeholder="0"
                          className="h-8"
                        />
                      </div>
                      {/* تطبيق على */}
                      <div className="space-y-1">
                        <Label className="text-xs">تطبيق على</Label>
                        <Select value={discountTarget} onValueChange={setDiscountTarget}>
                          <SelectTrigger className="h-8">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="all">تقسيم على جميع المهام</SelectItem>
                            {allTasks.map((t, i) => (
                              <SelectItem key={t.id} value={t.id}>
                                مهمة #{t.task_number || i + 1} (عقد #{t.contract_id})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      {/* سبب الخصم */}
                      <div className="space-y-1">
                        <Label className="text-xs">السبب (اختياري)</Label>
                        <Input
                          value={discountReason}
                          onChange={e => setDiscountReason(e.target.value)}
                          placeholder="سبب الخصم..."
                          className="h-8"
                        />
                      </div>
                      <Button
                        onClick={handleSaveDiscount}
                        disabled={savingDiscount || discountAmount <= 0}
                        className="w-full h-8 text-sm"
                        size="sm"
                      >
                        {savingDiscount ? <Loader2 className="h-3 w-3 animate-spin ml-1" /> : null}
                        حفظ الخصم
                      </Button>
                    </div>
                  </PopoverContent>
                </Popover>
              )}
              {/* زر إظهار/إخفاء تفصيل المهام المجمعة */}
              {isGroupInvoice && invoiceType === 'customer' && (
                <div className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-border/35 bg-background/60 px-2.5">
                  <Switch
                    id="showTasksBreakdown"
                    checked={showTasksBreakdown}
                    onCheckedChange={setShowTasksBreakdown}
                  />
                  <Label htmlFor="showTasksBreakdown" className="text-xs sm:text-sm cursor-pointer">
                    <span className="hidden sm:inline">تفصيل المهام</span>
                    <span className="sm:hidden">التفصيل</span>
                  </Label>
                </div>
              )}
              {/* زر إظهار/إخفاء الختم والتوقيع - لجميع أنواع الفواتير */}
              <div className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-border/35 bg-background/60 px-2.5">
                <Switch
                  id="showSignatureSection"
                  checked={showSignatureSection}
                  onCheckedChange={setShowSignatureSection}
                />
                <Label htmlFor="showSignatureSection" className="text-xs sm:text-sm cursor-pointer">
                  <span className="hidden sm:inline">الختم والتوقيع</span>
                  <span className="sm:hidden">التوقيع</span>
                </Label>
              </div>
              {/* زر إخفاء عبارات إعادة الطباعة */}
              <div className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-border/35 bg-background/60 px-2.5">
                <Switch
                  id="hideReprintLabels"
                  checked={hideReprintLabels}
                  onCheckedChange={setHideReprintLabels}
                />
                <Label htmlFor="hideReprintLabels" className="text-xs sm:text-sm cursor-pointer">
                  <span className="hidden sm:inline">إخفاء عبارات إعادة الطباعة</span>
                  <span className="sm:hidden">إخفاء إعادة</span>
                </Label>
              </div>
              {/* زر إظهار/إخفاء أعمدة الأبعاد */}
              <div className="flex h-10 shrink-0 items-center gap-1.5 rounded-xl border border-border/35 bg-background/60 px-2.5">
                <Switch
                  id="showDimensions"
                  checked={showDimensions}
                  onCheckedChange={setShowDimensions}
                />
                <Label htmlFor="showDimensions" className="text-xs sm:text-sm cursor-pointer">
                  <span className="hidden sm:inline">الأبعاد</span>
                  <span className="sm:hidden">أبعاد</span>
                </Label>
              </div>
              <Button onClick={handlePrint} className="h-10 shrink-0 cursor-pointer gap-2 rounded-xl px-4 font-black transition-all duration-200 active:scale-95" size="sm">
                <Printer className="h-3 w-3 sm:h-4 sm:w-4" />
                <span>طباعة</span>
              </Button>
              <Button
                variant="outline"
                className="h-10 shrink-0 cursor-pointer gap-2 rounded-xl px-4 font-black transition-all duration-200 active:scale-95"
                size="sm"
                disabled={pdfExporting}
                onClick={async () => {
                  if (!printRef.current) return;
                  setPdfExporting(true);
                  try {
                    const fullHtml = buildPrintableHtml();
                    const contractPart = contractIds.length > 1 ? `عقود ${contractIds.join('-')}` : `عقد ${contractIds[0] ?? task.contract_id}`;
                    const _pdfFileName = `${getInvoiceTitleAr()} - ${recipient.name} - ${contractPart} - ${format(new Date(), 'yyyy-MM-dd')}.pdf`;
                    await saveHtmlDocAsPdf(fullHtml, _pdfFileName, {
                      marginMm: [5, 5, 5, 5],
                      waitMs: 1500,
                    });
                    toast.success('تم تحميل PDF بنجاح');
                  } catch (e) {
                    console.error(e);
                    toast.error('فشل تحميل PDF');
                  } finally {
                    setPdfExporting(false);
                  }
                }}
              >
                {pdfExporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                <span>{pdfExporting ? 'جارٍ تجهيز PDF' : 'تحميل PDF'}</span>
              </Button>
              {/* زر واتساب */}
              {showWhatsAppPhoneInput ? (
                <div className="flex h-10 shrink-0 items-center gap-1 rounded-xl border border-border/35 bg-background/60 p-1">
                  <Input
                    className="h-8 w-32 text-xs"
                    placeholder="رقم الهاتف"
                    value={whatsAppManualPhone}
                    onChange={(e) => setWhatsAppManualPhone(e.target.value)}
                    dir="ltr"
                  />
                  <Button
                    size="sm"
                    className="h-8 cursor-pointer gap-1 transition-all duration-200"
                    disabled={whatsAppSending || !whatsAppManualPhone.trim()}
                    onClick={async () => {
                      if (!printRef.current) return;
                      setWhatsAppSending(true);
                      try {
                        const fullHtml = buildPrintableHtml();
                        const _waFileName1 = getInvoiceTitle().split('|').map(s => s.trim()).join(' _ ') + '.pdf';
                        const pdfBlob = await htmlToPdfBlob(fullHtml, _waFileName1);
                        const fileName = _waFileName1;
                        await uploadPdfBlobAndSendWhatsApp({
                          pdfBlob,
                          fileName,
                          driveFolder: 'فواتير',
                          phone: whatsAppManualPhone.trim(),
 message: ` ${getInvoiceTitle().split('|')[0].trim()} - ${task.customer_name || ''}`,
                        });
                        toast.success('تم الإرسال عبر واتساب');
                        setShowWhatsAppPhoneInput(false);
                      } catch (e) { console.error(e); toast.error('فشل الإرسال'); }
                      setWhatsAppSending(false);
                    }}
                  >
                    {whatsAppSending ? <Loader2 className="h-3 w-3 animate-spin" /> : <MessageCircle className="h-3 w-3" />}
                    إرسال
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 cursor-pointer transition-all duration-200" onClick={() => setShowWhatsAppPhoneInput(false)}>
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  className="h-10 shrink-0 cursor-pointer gap-2 rounded-xl px-3 font-black transition-all duration-200 active:scale-95"
                  size="sm"
                  disabled={whatsAppSending}
                  onClick={async () => {
                    const customerPhone = task.customer?.phone || task.customer?.Phone || '';
                    if (!customerPhone) {
                      setShowWhatsAppPhoneInput(true);
                      return;
                    }
                    if (!printRef.current) return;
                    setWhatsAppSending(true);
                    try {
                      const fullHtml = buildPrintableHtml();
                      const _waFileName2 = getInvoiceTitle().split('|').map(s => s.trim()).join(' _ ') + '.pdf';
                      const pdfBlob = await htmlToPdfBlob(fullHtml, _waFileName2);
                      const fileName = _waFileName2;
                      await uploadPdfBlobAndSendWhatsApp({
                        pdfBlob,
                        fileName,
                        driveFolder: 'فواتير',
                        phone: customerPhone,
 message: ` ${getInvoiceTitle().split('|')[0].trim()} - ${task.customer_name || ''}`,
                      });
                      toast.success('تم الإرسال عبر واتساب');
                    } catch (e) { console.error(e); toast.error('فشل الإرسال'); }
                    setWhatsAppSending(false);
                  }}
                >
                  <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4" />
                  <span>واتساب</span>
                </Button>
              )}
              <Button variant="ghost" size="icon" onClick={() => onOpenChange(false)} className="h-10 w-10 shrink-0 cursor-pointer rounded-xl transition-all duration-200" aria-label="إغلاق نافذة الفاتورة">
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogHeader>

        {hasZeroPayableTotal && (
          <div className="mx-3 mt-3 flex shrink-0 items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 px-3 py-2.5 text-right text-xs font-bold text-amber-300 sm:mx-4">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>قيمة الفاتورة صفر. راجع تكاليف التركيب أو الطباعة قبل اعتمادها وإرسالها.</span>
          </div>
        )}

        <ScrollArea className="min-h-0 flex-1">
          <div className="flex justify-center bg-muted/30 p-2 sm:p-6">
            <div
              ref={printRef}
              data-invoice-print
              className="bg-white shadow-2xl"
              style={{
                width: '210mm',
                maxWidth: '100%',
                minHeight: '297mm',
                backgroundColor: '#fff',
                fontFamily: `${shared.fontFamily || 'Doran'}, 'Noto Sans Arabic', Arial, sans-serif`,
                padding: '8mm 10mm',
                boxSizing: 'border-box',
                direction: 'rtl',
                color: tableText,
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {/* Unified CSS from print engine */}
              <style dangerouslySetInnerHTML={{
                __html: `
                 ${unifiedHeaderFooterCss(unifiedStyles)}
                 [data-invoice-print] td { border-color: ${tableBorder} !important; }
                 ${buildInvoiceLayoutCss()}
                 [data-invoice-print] .u-footer { margin-top: auto; }
              `}} />
              {/* Header - Unified Engine */}
              <div dangerouslySetInnerHTML={{
                __html: unifiedHeaderHtml({
                  styles: unifiedStyles,
                  fullLogoUrl,
                  metaLinesHtml,
                  titleAr: getInvoiceTitleAr(),
                  titleEn: '',
                })
              }} />

              {/* Recipient Info */}
              <div
                className="invoice-recipient-card"
                style={{
                  background: customerBg,
                  borderRightColor: customerSectionBorderColor,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div className="invoice-recipient-label" style={{ color: customerText }}>{recipient.label}</div>
                  <div className="invoice-recipient-name">{recipient.name}</div>
                  {invoiceType === 'customer' && customerName && companyName && customerName !== companyName && (
                    <div className="invoice-recipient-subtitle">الزبون: {customerName}</div>
                  )}
                </div>
                <div className="invoice-overview-stats">
                  {overviewStats.map(stat => (
                    <div key={stat.label} className="invoice-overview-stat">
                      <strong>{stat.value}</strong>
                      <span>{stat.label}</span>
                    </div>
                  ))}
                </div>
              </div>

              {hasZeroPayableTotal && (
                <div data-no-break style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '8px',
                  marginBottom: '12px',
                  padding: '9px 12px',
                  border: '1px solid #d6ac40',
                  borderRadius: '8px',
                  backgroundColor: '#fffbeb',
                  color: '#78350f',
                  fontSize: '11px',
                  lineHeight: 1.6,
                }}>
                  <AlertTriangle style={{ width: '15px', height: '15px', flexShrink: 0, marginTop: '1px' }} />
                  <div>
                    <strong style={{ display: 'block' }}>قيمة الفاتورة صفر</strong>
                    <span>لم تُسجّل قيمة مالية لهذه العملية. راجع التكاليف قبل اعتماد الفاتورة.</span>
                  </div>
                </div>
              )}

 {/* ملخص المقاسات والمجسمات - لجميع أنواع الفواتير */}
              {data?.items && data.items.length > 0 && (() => {
                // حساب عدد اللوحات لكل مقاس (مع احتساب الأوجه)
                // لأن كل وجه الآن في صف منفصل، نجمع حسب billboardId
                const billboardsSeen = new Set<number>();
                const sizeCounts: Record<string, { billboards: number; faces: number }> = {};
                let totalCutouts = 0;
                const cutoutBillboardsSeen = new Set<number>();

                data.items.forEach(item => {
                  const baseSizeName = item.sizeName.replace(' (مجسم)', '');

                  // تخطي إعادات الطباعة من ملخص المقاسات (تظهر كصفوف فقط)
                  if (baseSizeName.includes('إعادة طباعة')) return;

                  if (!sizeCounts[baseSizeName]) {
                    sizeCounts[baseSizeName] = { billboards: 0, faces: 0 };
                  }

                  // عدد الأوجه
                  sizeCounts[baseSizeName].faces += 1;

                  // عدد اللوحات (لا نحسب نفس اللوحة مرتين)
                  if (item.billboardId && !billboardsSeen.has(item.billboardId)) {
                    sizeCounts[baseSizeName].billboards += 1;
                    billboardsSeen.add(item.billboardId);
                  } else if (!item.billboardId) {
                    sizeCounts[baseSizeName].billboards += 1;
                  }

                  // حساب المجسمات (لا نحسب نفس اللوحة مرتين)
                  if (item.sizeName.includes('(مجسم)') && item.billboardId && !cutoutBillboardsSeen.has(item.billboardId)) {
                    totalCutouts++;
                    cutoutBillboardsSeen.add(item.billboardId);
                  } else if (item.sizeName.includes('(مجسم)') && !item.billboardId) {
                    totalCutouts++;
                  }
                });

                return (
                  <div className="invoice-size-summary" style={{
                    background: '#f8f9fa',
                    padding: '4px 10px',
                    marginBottom: '4px',
                    marginTop: '0',
                    borderRadius: '6px',
                    border: '1px solid #e9ecef',
                    lineHeight: '1.3',
                    overflow: 'visible',
                  }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'flex-start' }}>
                      <span className="invoice-size-summary-title" style={{ fontSize: '11px', fontWeight: 'bold', color: '#495057', lineHeight: '1.3' }}>تفصيل سريع</span>
                      {Object.entries(sizeCounts).map(([size, counts]) => (
                        <span key={size} className="invoice-size-chip" style={{
                          background: '#fff',
                          padding: '2px 6px',
                          borderRadius: '6px',
                          fontSize: '10px',
                          color: '#333',
                          border: '1px solid #dee2e6',
                          lineHeight: '1.3',
                          display: 'inline-block',
                        }}>
                          {counts.billboards} لوحة ({counts.faces} وجه) - {size}
                        </span>
                      ))}
                      {totalCutouts > 0 && (
                        <span style={{
                          background: '#fff3cd',
                          padding: '4px 8px',
                          borderRadius: '6px',
                          fontSize: '11px',
                          color: '#856404',
                          border: '1px solid #ffc107',
                          fontWeight: 'bold',
                        }}>
                          {totalCutouts} مجسم
                        </span>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* Items Table - يظهر فقط في العرض التفصيلي أو لغير فواتير الزبون */}
              {(displayMode === 'detailed' || invoiceType !== 'customer') && (() => {
                // ✅ فاتورة الفرقة تستخدم نفس تصميم فاتورة الزبون
                const isCustomerLike = invoiceType === 'customer' || invoiceType === 'installation_team';
                // حساب الأعمدة المتوفرة - فاتورة الفرقة تظهر فقط عمود التركيب
                // ✅ FIX: اعتمد على البنود الفعلية الظاهرة في الجدول وليس فقط على إجمالي المهمة
                // هذا يضمن ظهور أعمدة التركيب/الطباعة حتى لو كانت التكلفة على الشركة أو إعادة تركيب
                const itemsPrintSum = (data?.items || []).reduce((s, it) => s + (it.printCost || 0), 0);
                const itemsInstallSum = (data?.items || []).reduce((s, it) => s + (it.installationCost || 0), 0);
                const itemsCutoutSum = (data?.items || []).reduce((s, it) => s + (it.cutoutCost || 0), 0);
                const hasPrintCost = invoiceType === 'installation_team' ? false : (itemsPrintSum > 0 || (task.customer_print_cost || 0) > 0);
                const hasInstallCost = invoiceType === 'installation_team' ? true : (itemsInstallSum > 0 || (task.customer_installation_cost || 0) > 0);
                const hasCutoutCost = invoiceType === 'installation_team' ? false : (itemsCutoutSum > 0 || (task.customer_cutout_cost || 0) > 0);
                const totalArea = data?.items?.reduce((sum, item) => sum + (item.area || 0), 0) || 0;
                const pricePerMeter = data?.pricePerMeter || (() => {
                  const printItems = data?.items?.filter(item => (item.printCost || 0) > 0) || [];
                  const printedArea = printItems.reduce((sum, item) => sum + (item.area || 0), 0) || 0;
                  return printedArea > 0 ? (isCustomerLike ? (task.customer_print_cost || 0) : (task.company_print_cost || 0)) / printedArea : 0;
                })();
                // ✅ سعر وحدة التركيب (لكل وجه/قطعة) عند تفعيل تفاصيل السعر
                const installUnitPrice = (() => {
                  const installItems = (data?.items || []).filter(it => (it.installationCost || 0) > 0);
                  if (!installItems.length) return 0;
                  const total = installItems.reduce((s, it) => s + (it.installationCost || 0), 0);
                  return total / installItems.length;
                })();

                // ✅ تجميع العناصر حسب اللوحة للدمج في الجدول
                // نحتاج لتحديد اللوحات ذات الوجهين ودمج الخلايا المشتركة
                const billboardGroups: Map<number, InvoiceItem[]> = new Map();
                data?.items?.forEach(item => {
                  if (item.billboardId) {
                    const group = billboardGroups.get(item.billboardId) || [];
                    group.push(item);
                    billboardGroups.set(item.billboardId, group);
                  }
                });

                // تحديد أي صف هو أول صف في مجموعة اللوحة
                const isFirstInGroup = (item: InvoiceItem, idx: number): boolean => {
                  if (!item.billboardId) return true;
                  const items = data?.items || [];
                  for (let i = 0; i < idx; i++) {
                    if (items[i].billboardId === item.billboardId) return false;
                  }
                  return true;
                };

                // الحصول على عدد الصفوف الفعلية لكل لوحة (عدد العناصر في الجدول، وليس عدد الأوجه النظري)
                const getFaceCount = (billboardId: number | undefined, items: InvoiceItem[]): number => {
                  if (!billboardId) return 1;
                  // عدد الصفوف الفعلية لهذه اللوحة في البيانات
                  return items.filter(i => i.billboardId === billboardId).length || 1;
                };

                return (
                  <table className="invoice-items-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginBottom: '14px' }}>
                    <thead>
                      <tr style={{ backgroundColor: tableHeaderBg }}>
                        <th style={{ padding: '7px 4px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '3.5%', fontSize: '10px', fontWeight: 'bold' }}>#</th>
                        {isCustomerLike && (
                          <th style={{ padding: '7px 4px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '14%', fontSize: '10px', fontWeight: 'bold' }}>صورة اللوحة</th>
                        )}
                        <th style={{ padding: '7px 4px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '11%', fontSize: '10px', fontWeight: 'bold' }}>اللوحة</th>
                        {isCustomerLike && (
                          <th style={{ padding: '7px 4px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '20%', fontSize: '10px', fontWeight: 'bold' }}>الموقع</th>
                        )}
                        <th style={{ padding: '7px 4px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '10%', fontSize: '10px', fontWeight: 'bold' }}>المقاس</th>
                        {showDimensions && (
                          <>
                            <th style={{ padding: '7px 4px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '5%', fontSize: '10px', fontWeight: 'bold' }}>العرض</th>
                            <th style={{ padding: '7px 4px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '5%', fontSize: '10px', fontWeight: 'bold' }}>الارتفاع</th>
                          </>
                        )}
                        <th style={{ padding: '7px 4px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '8%', fontSize: '10px', fontWeight: 'bold' }}>الوجه</th>
                        <th style={{ padding: '7px 4px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '11%', fontSize: '10px', fontWeight: 'bold' }}>التصميم</th>
                        <th style={{ padding: '7px 4px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '8.5%', fontSize: '10px', fontWeight: 'bold' }}>المساحة</th>
                        {/* أعمدة التكاليف المنفصلة لفاتورة الزبون/الفرقة */}
                        {isCustomerLike && showCosts && (invoiceType !== 'customer' || showServiceBreakdown) && (
                          <>
                            {hasPrintCost && (
                              <th style={{ padding: '7px 4px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', backgroundColor: tableHeaderBg, fontSize: '10px', fontWeight: 'bold' }}>
                                الطباعة
                                {showPriceDetails && <div style={{ fontSize: '7.5px', opacity: 0.85 }}>({pricePerMeter.toFixed(2)} د.ل/م²)</div>}
                              </th>
                            )}
                            {hasInstallCost && (
                              <th style={{ padding: '7px 4px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', backgroundColor: tableHeaderBg, fontSize: '10px', fontWeight: 'bold' }}>
                                التركيب
                                {showPriceDetails && installUnitPrice > 0 && <div style={{ fontSize: '7.5px', opacity: 0.85 }}>({installUnitPrice.toFixed(2)} د.ل/وجه)</div>}
                              </th>
                            )}
                            {hasCutoutCost && (
                              <th style={{ padding: '7px 4px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', backgroundColor: tableHeaderBg, fontSize: '10px', fontWeight: 'bold' }}>القص</th>
                            )}
                            <th style={{ padding: '7px 4px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', backgroundColor: tableHeaderBg, fontSize: '10px', fontWeight: 'bold' }}>الإجمالي</th>
                          </>
                        )}
                        {invoiceType === 'customer' && showCosts && !showServiceBreakdown && (
                          <th style={{ padding: '7px 4px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', backgroundColor: tableHeaderBg, fontSize: '10px', fontWeight: 'bold' }}>الإجمالي</th>
                        )}
                        {/* عمود السعر لغير فواتير الزبون */}
                        {!isCustomerLike && showCosts && (
                          <th style={{ padding: '7px 4px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', fontSize: '10px', fontWeight: 'bold' }}>
                            الإجمالي
                            {pricePerMeter > 0 && <div style={{ fontSize: '7.5px', opacity: 0.85 }}>({pricePerMeter.toFixed(2)} د.ل/م²)</div>}
                          </th>
                        )}
                      </tr>
                    </thead>
                    {(() => {
                      // تجميع العناصر حسب اللوحة لضمان عدم انقسام أوجه اللوحة الواحدة بين الصفحات
                      const groupedBillboards: InvoiceItem[][] = [];
                      const billboardMap = new Map<any, InvoiceItem[]>();

                      (data?.items || []).forEach(item => {
                        const key = item.billboardId ? `b_${item.billboardId}` : `item_${Math.random()}`;
                        if (!billboardMap.has(key)) {
                          const arr: InvoiceItem[] = [];
                          billboardMap.set(key, arr);
                          groupedBillboards.push(arr);
                        }
                        billboardMap.get(key)!.push(item);
                      });

                      return groupedBillboards.map((bItems, bIdx) => {
                        const billboardCounter = bIdx + 1;
                        const faceCount = bItems.length;

                        return (
                          <tbody key={bIdx} data-no-break style={{ pageBreakInside: 'avoid', breakInside: 'avoid', backgroundColor: '#ffffff' }}>
                            {bItems.map((item, fIdx) => {
                              const isFirst = fIdx === 0;

                              return (
                                <tr key={fIdx} style={{ backgroundColor: '#ffffff' }}>
                                  {/* رقم اللوحة - يُدمج للوحات ذات الوجهين */}
                                  {isFirst && (
                                    <td rowSpan={faceCount} data-no-break style={{ padding: '4px 3px', border: `1px solid ${tableBorder}`, textAlign: 'center', verticalAlign: 'middle', fontSize: '10px', fontWeight: 'bold' }}>
                                      {billboardCounter}
                                    </td>
                                  )}
                                  {/* صورة اللوحة - لفاتورة الزبون فقط */}
                                  {isCustomerLike && (() => {
                                    // ✅ للتركيب الأصلي: استخدام الصور المؤرشفة
                                    const isOriginal = item.isOriginalInstallation;
                                    const actualBillboardId = isOriginal
                                      ? (item.billboardId ? item.billboardId - 100000 : undefined)
                                      : (item.isReinstallation ? (item.billboardId ? item.billboardId - 200000 : undefined) : item.billboardId);

                                    const installedImageA = actualBillboardId ? installedImagesMap[actualBillboardId]?.face_a : undefined;
                                    const installedImageB = actualBillboardId ? installedImagesMap[actualBillboardId]?.face_b : undefined;

                                    // ✅ للتركيب الأصلي: صور من الأرشيف
                                    const originalPhotoA = isOriginal ? item.originalInstalledImageA : undefined;
                                    const originalPhotoB = isOriginal ? item.originalInstalledImageB : undefined;

                                    if (showBackFaceImages) {
                                      let displayImage: string | undefined;
                                      if (isOriginal && showInstalledImages) {
                                        displayImage = item.face === 'a' ? (originalPhotoA || item.billboardImage) : (originalPhotoB || item.designImage);
                                      } else if (item.isReinstallation && showInstalledImages) {
                                        displayImage = item.face === 'a' ? (installedImageA || item.billboardImage) : (installedImageB || item.designImage);
                                      } else {
                                        displayImage = item.face === 'a'
                                          ? (showInstalledImages && installedImageA ? installedImageA : item.billboardImage)
                                          : (showInstalledImages && installedImageB ? installedImageB : item.designImage);
                                      }

                                      return (
                                        <td style={{ padding: '2px', border: `1px solid ${tableBorder}`, textAlign: 'center', verticalAlign: 'middle', width: '14%' }}>
                                          {displayImage ? (
                                            <img
                                              src={displayImage}
                                              alt={item.face === 'a' ? "صورة الوجه الأمامي" : "صورة الوجه الخلفي"}
                                              style={{
                                                width: '100%', height: '42px', maxHeight: '46px',
                                                objectFit: 'cover', borderRadius: '4px',
                                                border: '1px solid #cbd5e1', boxShadow: '0 1px 2px rgba(0,0,0,0.06)',
                                                display: 'block', margin: '0 auto',
                                              }}
                                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                            />
                                          ) : (
                                            <span style={{ color: '#999', fontSize: '8px' }}>-</span>
                                          )}
                                        </td>
                                      );
                                    } else if (isFirst) {
                                      let displayImage: string | undefined;
                                      if (isOriginal && showInstalledImages) {
                                        displayImage = originalPhotoA || originalPhotoB || item.billboardImage;
                                      } else {
                                        displayImage = showInstalledImages && installedImageA ? installedImageA : item.billboardImage;
                                      }

                                      const cellH = faceCount > 1 ? '68px' : '44px';
                                      const maxCellH = faceCount > 1 ? '72px' : '48px';

                                      return (
                                        <td rowSpan={faceCount} data-no-break style={{ padding: '2px', border: `1px solid ${tableBorder}`, textAlign: 'center', verticalAlign: 'middle', width: '14%' }}>
                                          {displayImage ? (
                                            <img
                                              src={displayImage}
                                              alt={isOriginal ? "صورة التركيب الأصلي" : "صورة اللوحة"}
                                              style={{
                                                width: '100%', height: cellH, maxHeight: maxCellH,
                                                objectFit: 'cover', borderRadius: '4px',
                                                border: '1px solid #cbd5e1', boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
                                                display: 'block', margin: '0 auto',
                                              }}
                                              onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                            />
                                          ) : (
                                            <span style={{ color: '#999', fontSize: '8px' }}>-</span>
                                          )}
                                        </td>
                                      );
                                    }
                                    return null;
                                  })()}
                                  {/* اسم اللوحة - يُدمج للوحات ذات الوجهين */}
                                  {isFirst && (
                                    <td rowSpan={faceCount} data-no-break style={{ padding: '4px 3px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontWeight: 'bold', fontSize: '10px', verticalAlign: 'middle', overflow: 'visible', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                      <div>{cleanReprintLabel(item.billboardName || '-')}</div>
                                      {/* علامة التركيب الأصلي */}
                                      {item.isOriginalInstallation && (
                                        <div style={{ marginTop: '3px' }}>
                                          <span style={{
                                            background: '#f0fdf4',
                                            color: '#15803d',
                                            padding: '2px 5px',
                                            borderRadius: '3px',
                                            fontSize: '8px',
                                            fontWeight: 'bold',
                                            border: '1px solid #bbf7d0',
                                            display: 'inline-block',
                                          }}>
                                            تركيب أصلي
                                          </span>
                                        </div>
                                      )}
                                      {/* شارة إعادة التركيب تحت اسم اللوحة */}
                                      {item.isReinstallation && (
                                        <div style={{ marginTop: '3px' }}>
                                          <span style={{
                                            background: '#fff7ed',
                                            color: '#c2410c',
                                            padding: '2px 5px',
                                            borderRadius: '3px',
                                            fontSize: '8px',
                                            fontWeight: 'bold',
                                            border: '1px solid #fed7aa',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '2px',
                                          }}>
                                            إعادة تركيب {item.reinstallSeq ? `(${item.reinstallSeq})` : ''}
                                          </span>
                                        </div>
                                      )}
                                      {item.isReplacement && (
                                        <div style={{ marginTop: '3px' }}>
                                          <span style={{
                                            background: '#e8f5e9',
                                            color: '#2e7d32',
                                            padding: '2px 5px',
                                            borderRadius: '3px',
                                            fontSize: '8px',
                                            fontWeight: 'bold',
                                            border: '1px solid #a5d6a7',
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            gap: '2px',
                                          }}>
                                            لوحة بديلة
                                          </span>
                                        </div>
                                      )}
                                    </td>
                                  )}
                                  {/* الموقع (أقرب نقطة دالة + المنطقة + المدينة) - لفاتورة الزبون فقط - يُدمج للوحات ذات الوجهين */}
                                  {isCustomerLike && isFirst && (
                                    <td rowSpan={faceCount} data-no-break style={{ padding: '4px 4px', border: `1px solid ${tableBorder}`, textAlign: 'right', fontSize: '9.5px', color: '#1e293b', verticalAlign: 'middle', lineHeight: '1.35', overflow: 'visible', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                      {item.nearestLandmark && (
                                        <div style={{ fontWeight: '600', marginBottom: '2px' }}>{item.nearestLandmark}</div>
                                      )}
                                      {(item.district || item.city) && (
                                        <div style={{ fontSize: '8.5px', color: '#64748b' }}>
                                          {[item.district, item.city].filter(Boolean).join(' - ')}
                                        </div>
                                      )}
                                      {!item.nearestLandmark && !item.district && !item.city && '-'}
                                    </td>
                                  )}
                                  {/* المقاس - يُدمج للوحات ذات الوجهين */}
                                  {isFirst && (
                                    <td rowSpan={faceCount} style={{ padding: '4px 3px', border: `1px solid ${tableBorder}`, textAlign: 'center', verticalAlign: 'middle', overflow: 'visible', whiteSpace: 'normal', wordBreak: 'break-word' }}>
                                      <div style={{ fontWeight: 'bold', fontSize: '10px', marginBottom: '3px', lineHeight: '1.2', display: 'block' }}>{cleanReprintLabel(item.sizeName).replace(' (مجسم)', '')}</div>
                                      {/* شارة مجسم تحت المقاس عند وجود قص */}
                                      {item.sizeName.includes('(مجسم)') && (
                                        <div style={{ marginBottom: '3px' }}>
                                          <span style={{
                                            background: '#fff3cd',
                                            color: '#856404',
                                            padding: '2px 5px',
                                            borderRadius: '3px',
                                            fontSize: '8px',
                                            fontWeight: 'bold',
                                            border: '1px solid #ffc107',
                                            display: 'inline-block',
                                          }}>مجسم</span>
                                        </div>
                                      )}
                                      {/* إظهار نوع اللوحة تحت المقاس */}
                                      {item.billboardType && (
                                        <div style={{ fontSize: '8px', color: '#555', marginBottom: '3px', lineHeight: '1.2', display: 'block' }}>
                                          <span style={{
                                            background: item.billboardType === 'تيبول' ? '#fff8e1' : '#f3e5f5',
                                            padding: '2px 5px',
                                            borderRadius: '3px',
                                            border: '1px solid rgba(0,0,0,0.06)',
                                          }}>
                                            {item.billboardType}
                                          </span>
                                        </div>
                                      )}
                                      {/* إظهار عدد الأوجه تحت المقاس */}
                                      {item.billboardFaces && (
                                        <div style={{ fontSize: '8px', color: '#666', lineHeight: '1.2', display: 'block' }}>
                                          <span style={{
                                            background: '#e0f2fe',
                                            color: '#0369a1',
                                            padding: '2px 5px',
                                            borderRadius: '3px',
                                            border: '1px solid #bae6fd',
                                          }}>
                                            {item.billboardFaces === 1 ? 'وجه واحد' : item.billboardFaces === 2 ? 'وجهين' : `${item.billboardFaces} أوجه`}
                                          </span>
                                        </div>
                                      )}
                                    </td>
                                  )}
                                  {/* العرض والارتفاع - يُدمج للوحات ذات الوجهين */}
                                  {showDimensions && isFirst && (() => {
                                    let w = item.width || 0;
                                    let h = item.height || 0;
                                    if (w === 0 && h === 0 && item.sizeName) {
                                      const match = item.sizeName.replace(' (مجسم)', '').match(/(\d+(?:\.\d+)?)[x×X](\d+(?:\.\d+)?)/i);
                                      if (match) { w = parseFloat(match[1]); h = parseFloat(match[2]); }
                                    }
                                    return (
                                      <>
                                        <td rowSpan={faceCount} style={{ padding: '4px 3px', border: `1px solid ${tableBorder}`, textAlign: 'center', verticalAlign: 'middle', fontFamily: 'Manrope', fontSize: '9.5px', fontWeight: 'bold', overflow: 'visible', whiteSpace: 'normal' }}>
                                          {w > 0 ? `${w} م` : '-'}
                                        </td>
                                        <td rowSpan={faceCount} style={{ padding: '4px 3px', border: `1px solid ${tableBorder}`, textAlign: 'center', verticalAlign: 'middle', fontFamily: 'Manrope', fontSize: '9.5px', fontWeight: 'bold', overflow: 'visible', whiteSpace: 'normal' }}>
                                          {h > 0 ? `${h} م` : '-'}
                                        </td>
                                      </>
                                    );
                                  })()}
                                  {/* الوجه - منفصل لكل صف */}
                                  <td style={{ padding: '4px 3px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontSize: '9px', overflow: 'visible', whiteSpace: 'normal' }}>
                                    {item.face === 'both' ? (
                                      <span style={{ background: '#e3f2fd', padding: '2px 6px', borderRadius: '3px', color: '#1565c0', fontWeight: 'bold' }}>أمامي + خلفي</span>
                                    ) : item.face === 'a' ? (
                                      <span style={{ background: '#e8f5e9', padding: '2px 6px', borderRadius: '3px', color: '#2e7d32', fontWeight: 'bold' }}>أمامي</span>
                                    ) : (
                                      <span style={{ background: '#fff3e0', padding: '2px 6px', borderRadius: '3px', color: '#ef6c00', fontWeight: 'bold' }}>خلفي</span>
                                    )}
                                  </td>
                                  {/* التصميم - منفصل لكل صف */}
                                  <td style={{ padding: '2px', border: `1px solid ${tableBorder}`, textAlign: 'center', verticalAlign: 'middle', width: '11%' }}>
                                    {item.designImage ? (
                                      <img
                                        src={item.designImage}
                                        alt="تصميم"
                                        style={{ width: '100%', height: '36px', maxHeight: '40px', objectFit: 'contain', borderRadius: '3px', border: '1px solid #cbd5e1', background: '#fafafa', display: 'block', margin: '0 auto' }}
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                      />
                                    ) : (
                                      <span style={{ color: '#999', fontSize: '8px' }}>-</span>
                                    )}
                                  </td>
                                  {/* المساحة - منفصل لكل صف */}
                                  <td style={{ padding: '4px 3px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', fontSize: '10px', fontWeight: 'bold' }}>
                                    {item.area.toFixed(2)} م²
                                  </td>
                                  {/* أعمدة التكاليف المنفصلة لفاتورة الزبون/الفرقة */}
                                  {isCustomerLike && showCosts && (invoiceType !== 'customer' || showServiceBreakdown) && (
                                    <>
                                      {hasPrintCost && (
                                        <td style={{ padding: '4px 3px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', color: tableText, fontSize: '9.5px', fontWeight: 'bold' }}>
                                          <div>{item.printCost > 0 ? `${item.printCost.toFixed(0)} د.ل` : '-'}</div>
                                          {showPriceDetails && item.printCost > 0 && pricePerMeter > 0 && (
                                            <div style={{ fontSize: '7.5px', color: '#666', marginTop: '1px' }}>
                                              {item.area?.toFixed(2)} × {pricePerMeter.toFixed(2)}
                                            </div>
                                          )}
                                        </td>
                                      )}
                                      {hasInstallCost && (
                                        <td style={{ padding: '4px 3px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', color: tableText, fontSize: '9.5px', fontWeight: 'bold' }}>
                                          <div>{item.installationCost > 0 ? `${item.installationCost.toFixed(0)} د.ل` : '-'}</div>
                                          {showPriceDetails && item.installationCost > 0 && installUnitPrice > 0 && (
                                            <div style={{ fontSize: '7.5px', color: '#666', marginTop: '1px' }}>
                                              {installUnitPrice.toFixed(2)} د.ل
                                            </div>
                                          )}
                                        </td>
                                      )}
                                      {hasCutoutCost && (
                                        <td style={{ padding: '4px 3px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', color: tableText, fontSize: '9.5px', fontWeight: 'bold' }}>
                                          {item.cutoutCost > 0 ? `${item.cutoutCost.toFixed(0)} د.ل` : '-'}
                                        </td>
                                      )}
                                      <td style={{ padding: '4px 3px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: tableText, backgroundColor: tableRowEven, fontSize: '10px' }}>
                                        {((hasPrintCost ? (item.printCost || 0) : 0) +
                                          (hasInstallCost ? (item.installationCost || 0) : 0) +
                                          (hasCutoutCost ? (item.cutoutCost || 0) : 0)).toFixed(0)} د.ل
                                      </td>
                                    </>
                                  )}
                                  {invoiceType === 'customer' && showCosts && !showServiceBreakdown && (
                                    <td style={{ padding: '4px 3px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: tableText, backgroundColor: tableRowEven, fontSize: '10px' }}>
                                      {item.totalCost.toFixed(0)} د.ل
                                    </td>
                                  )}
                                  {/* عمود الإجمالي لغير فواتير الزبون */}
                                  {!isCustomerLike && showCosts && (
                                    <td style={{ padding: '4px 3px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: tableText, fontSize: '10px' }}>
                                      {item.totalCost.toFixed(2)} د.ل
                                    </td>
                                  )}
                                </tr>
                              );
                            })}
                          </tbody>
                        );
                      });
                    })()}
                    {/* صف الإجمالي - لفاتورة الزبون/الفرقة مع التفصيل */}
                    {isCustomerLike && showCosts && (invoiceType !== 'customer' || showServiceBreakdown) && (
                      <tfoot data-no-break style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                        <tr style={{ backgroundColor: tableHeaderBg, fontWeight: 'bold' }}>
                          <td colSpan={7 + (showDimensions ? 2 : 0)} style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableHeaderText, fontSize: '11px' }}>
                            الإجمالي
                          </td>
                          <td style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', color: tableHeaderText, fontSize: '10.5px' }}>
                            {totalArea.toFixed(2)} م²
                          </td>
                          {hasPrintCost && (
                            <td style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', color: tableHeaderText, fontSize: '10.5px' }}>
                              {(data?.items?.reduce((sum, item) => sum + (item.printCost || 0), 0) || 0).toFixed(0)} د.ل
                            </td>
                          )}
                          {hasInstallCost && (
                            <td style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', color: tableHeaderText, fontSize: '10.5px' }}>
                              {(data?.items?.reduce((sum, item) => sum + (item.installationCost || 0), 0) || 0).toFixed(0)} د.ل
                            </td>
                          )}
                          {hasCutoutCost && (
                            <td style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', color: tableHeaderText, fontSize: '10.5px' }}>
                              {(data?.items?.reduce((sum, item) => sum + (item.cutoutCost || 0), 0) || 0).toFixed(0)} د.ل
                            </td>
                          )}
                          <td style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: totalText, backgroundColor: totalBg, fontSize: '11.5px' }}>
                            {dynamicTotal.toLocaleString('ar-LY')} د.ل
                          </td>
                        </tr>
                      </tfoot>
                    )}
                    {invoiceType === 'customer' && showCosts && !showServiceBreakdown && (
                      <tfoot data-no-break style={{ pageBreakInside: 'avoid', breakInside: 'avoid' }}>
                        <tr style={{ backgroundColor: tableHeaderBg, fontWeight: 'bold' }}>
                          <td colSpan={7 + (showDimensions ? 2 : 0)} style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableHeaderText, fontSize: '11px' }}>
                            الإجمالي
                          </td>
                          <td style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', color: tableHeaderText, fontSize: '10.5px' }}>
                            {totalArea.toFixed(2)} م²
                          </td>
                          <td style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: totalText, backgroundColor: totalBg, fontSize: '11.5px' }}>
                            {dynamicTotal.toLocaleString('ar-LY')} د.ل
                          </td>
                        </tr>
                      </tfoot>
                    )}
                    {/* صف الإجمالي - لفواتير المطبعة والقص والفرقة */}
                    {!isCustomerLike && (() => {
                      const grossTotal = data?.items?.filter(i => !i.isReprintDeduction).reduce((sum, item) => sum + (item.totalCost || 0), 0) || 0;
                      const reprintDeduction = Math.abs(data?.items?.filter(i => i.isReprintDeduction).reduce((sum, item) => sum + (item.totalCost || 0), 0) || 0);
                      const netTotal = grossTotal;
                      const hasDeductions = reprintDeduction > 0;
                      const totalArea = data?.items?.reduce((sum, item) => sum + (item.area || 0), 0) || 0;

                      return (
                        <tfoot>
                          {showCosts ? (
                            hasDeductions && !hideReprintLabels ? (
                              <>
                                <tr style={{ backgroundColor: tableHeaderBg }}>
                                  <td colSpan={5 + (showDimensions ? 2 : 0)} style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableHeaderText, fontSize: '10px' }}>
                                    إجمالي الأعمال
                                  </td>
                                  <td style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', color: tableHeaderText, fontSize: '10px' }}>
                                    {totalArea.toFixed(2)} م²
                                  </td>
                                  <td style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: tableHeaderText, fontSize: '10px' }}>
                                    {grossTotal.toFixed(0)} د.ل
                                  </td>
                                </tr>
                                <tr style={{ backgroundColor: '#fff3f3' }}>
                                  <td colSpan={6 + (showDimensions ? 2 : 0)} style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: '#c00', fontSize: '10px' }}>
                                    خصم إعادة الطباعة (على المطبعة)
                                  </td>
                                  <td style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: '#c00', fontSize: '10px' }}>
                                    -{reprintDeduction.toFixed(0)} د.ل
                                  </td>
                                </tr>
                                <tr style={{ backgroundColor: tableHeaderBg, fontWeight: 'bold' }}>
                                  <td colSpan={5 + (showDimensions ? 2 : 0)} style={{ padding: '10px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableHeaderText, fontSize: '11px' }}>
                                    الإجمالي المستحق
                                  </td>
                                  <td style={{ padding: '10px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', color: tableHeaderText, fontSize: '10px' }}>
                                    {totalArea.toFixed(2)} م²
                                  </td>
                                  <td style={{ padding: '10px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: totalText, backgroundColor: totalBg, fontSize: '11px' }}>
                                    {netTotal.toFixed(0)} د.ل
                                  </td>
                                </tr>
                              </>
                            ) : (
                              <tr style={{ backgroundColor: tableHeaderBg, fontWeight: 'bold' }}>
                                <td colSpan={5 + (showDimensions ? 2 : 0)} style={{ padding: '10px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableHeaderText, fontSize: '11px' }}>
                                  الإجمالي
                                </td>
                                <td style={{ padding: '10px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', color: tableHeaderText, fontSize: '10px' }}>
                                  {totalArea.toFixed(2)} م²
                                </td>
                                <td style={{ padding: '10px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: totalText, backgroundColor: totalBg, fontSize: '11px' }}>
                                  {netTotal.toFixed(0)} د.ل
                                </td>
                              </tr>
                            )
                          ) : (
                            <tr style={{ backgroundColor: tableHeaderBg, fontWeight: 'bold' }}>
                              <td colSpan={5 + (showDimensions ? 2 : 0)} style={{ padding: '10px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: tableHeaderText, fontSize: '11px' }}>
                                إجمالي المساحة
                              </td>
                              <td style={{ padding: '10px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: totalText, backgroundColor: totalBg, fontSize: '11px' }}>
                                {totalArea.toFixed(2)} م²
                              </td>
                            </tr>
                          )}
                        </tfoot>
                      );
                    })()}
                  </table>
                );
              })()}

              {/* Summary View - العرض المجمّع لفاتورة الزبون - مع دمج الصفوف للوحات ذات الوجهين */}
              {displayMode === 'summary' && invoiceType === 'customer' && (() => {
                // تجميع العناصر حسب اللوحة للدمج في الجدول
                const billboardGroups: Map<number, InvoiceItem[]> = new Map();
                data?.items?.forEach(item => {
                  if (item.billboardId) {
                    const group = billboardGroups.get(item.billboardId) || [];
                    group.push(item);
                    billboardGroups.set(item.billboardId, group);
                  }
                });

                // تحديد أي صف هو أول صف في مجموعة اللوحة
                const isFirstInGroup = (item: InvoiceItem, idx: number): boolean => {
                  if (!item.billboardId) return true;
                  const items = data?.items || [];
                  for (let i = 0; i < idx; i++) {
                    if (items[i].billboardId === item.billboardId) return false;
                  }
                  return true;
                };

                // الحصول على عدد الصفوف الفعلية لكل لوحة (عدد العناصر في الجدول، وليس عدد الأوجه النظري)
                const getFaceCount = (billboardId: number | undefined, items: InvoiceItem[]): number => {
                  if (!billboardId) return 1;
                  return items.filter(i => i.billboardId === billboardId).length || 1;
                };

                return (
                  <table className="invoice-items-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px', marginBottom: '24px' }}>
                    <thead>
                      <tr style={{ backgroundColor: tableHeaderBg }}>
                        <th style={{ padding: '8px 4px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', width: '4%' }}>#</th>
                        <th colSpan={3} style={{ padding: '8px 4px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', backgroundColor: tableHeaderBg }}>بيانات اللوحة</th>
                        <th colSpan={2} style={{ padding: '8px 4px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', backgroundColor: tableHeaderBg }}>التصميم والمقاس</th>
                        <th colSpan={2} style={{ padding: '8px 4px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', backgroundColor: tableHeaderBg }}>التكلفة</th>
                      </tr>
                      <tr style={{ backgroundColor: tableHeaderBg, opacity: 0.85 }}>
                        <th style={{ padding: '6px 4px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', fontSize: '9px' }}></th>
                        <th style={{ padding: '6px 4px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', fontSize: '9px', width: '12%' }}>الصورة</th>
                        <th style={{ padding: '6px 4px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', fontSize: '9px' }}>اسم اللوحة</th>
                        <th style={{ padding: '6px 4px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', fontSize: '9px', width: '15%' }}>أقرب نقطة دالة</th>
                        <th style={{ padding: '6px 4px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', fontSize: '9px', width: '14%' }}>التصميم</th>
                        <th style={{ padding: '6px 4px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', fontSize: '9px' }}>المقاس</th>
                        <th style={{ padding: '6px 4px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', fontSize: '9px' }}>المساحة</th>
                        <th style={{ padding: '6px 4px', color: tableHeaderText, border: `1px solid ${tableBorder}`, textAlign: 'center', fontSize: '9px', width: '12%' }}>الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(() => {
                        let billboardCounter = 0;
                        const seenBillboards = new Set<number>();

                        return data?.items?.map((item, idx) => {
                          const isFirst = isFirstInGroup(item, idx);
                          const faceCount = getFaceCount(item.billboardId, data?.items || []);

                          // تحديث عداد اللوحات
                          if (item.billboardId && !seenBillboards.has(item.billboardId)) {
                            billboardCounter++;
                            seenBillboards.add(item.billboardId);
                          } else if (!item.billboardId) {
                            billboardCounter++;
                          }

                          return (
                            <tr key={idx} style={{ backgroundColor: '#ffffff' }}>
                              {/* رقم اللوحة - يُدمج للوحات ذات الوجهين */}
                              {isFirst && (
                                <td rowSpan={faceCount} data-no-break style={{ padding: '6px 4px', border: `1px solid ${tableBorder}`, textAlign: 'center', verticalAlign: 'middle' }}>
                                  {billboardCounter}
                                </td>
                              )}
                              {/* صورة اللوحة - يُدمج للوحات ذات الوجهين */}
                              {isFirst && (
                                <td rowSpan={faceCount} data-no-break style={{ padding: '0', border: `1px solid ${tableBorder}`, textAlign: 'center', verticalAlign: 'middle', backgroundColor: '#fafafa' }}>
                                  {(() => {
                                    const installedImageA = item.billboardId ? installedImagesMap[item.billboardId]?.face_a : undefined;
                                    const displayImage = showInstalledImages && installedImageA ? installedImageA : item.billboardImage;

                                    return displayImage ? (
                                      <img
                                        src={displayImage}
                                        alt={showInstalledImages && installedImageA ? "صورة التركيب" : "صورة اللوحة"}
                                        style={{
                                          width: '100%',
                                          maxHeight: '80px',
                                          height: 'auto',
                                          objectFit: 'contain',
                                          borderRadius: '0',
                                          border: 'none',
                                          outline: 'none',
                                          boxShadow: 'none',
                                          display: 'block',
                                        }}
                                        onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                      />
                                    ) : (
                                      <span style={{ color: '#999', fontSize: '8px' }}>-</span>
                                    );
                                  })()}
                                </td>
                              )}
                              {/* اسم اللوحة - يُدمج للوحات ذات الوجهين */}
                              {isFirst && (
                                <td rowSpan={faceCount} style={{ padding: '6px 4px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontWeight: 'bold', fontSize: '9px', backgroundColor: '#fafafa', verticalAlign: 'middle' }}>
                                  <div>{cleanReprintLabel(item.billboardName || '-')}</div>
                                  {item.isReinstallation && (
                                    <div style={{ marginTop: '2px' }}>
                                      <span style={{ background: '#fff3e0', color: '#e65100', padding: '1px 4px', borderRadius: '3px', fontSize: '7px', fontWeight: 'bold', border: '1px solid #ffcc80' }}>
                                        إعادة تركيب ({item.reinstallCount})
                                      </span>
                                    </div>
                                  )}
                                  {item.isReplacement && (
                                    <div style={{ marginTop: '2px' }}>
                                      <span style={{ background: '#e8f5e9', color: '#2e7d32', padding: '1px 4px', borderRadius: '3px', fontSize: '7px', fontWeight: 'bold', border: '1px solid #a5d6a7' }}>
                                        لوحة بديلة
                                      </span>
                                    </div>
                                  )}
                                </td>
                              )}
                              {/* أقرب نقطة دالة - يُدمج للوحات ذات الوجهين */}
                              {isFirst && (
                                <td rowSpan={faceCount} style={{ padding: '6px 4px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontSize: '8px', color: '#555', backgroundColor: '#fafafa', lineHeight: '1.3', verticalAlign: 'middle' }}>
                                  {item.nearestLandmark || '-'}
                                </td>
                              )}
                              {/* التصميم - منفصل لكل وجه */}
                              <td style={{ padding: '2px', border: `1px solid ${tableBorder}`, textAlign: 'center', backgroundColor: idx % 2 === 0 ? '#f8f8f8' : '#fefefe' }}>
                                {item.designImage ? (
                                  <img
                                    src={item.designImage}
                                    alt="تصميم"
                                    style={{ width: '100%', height: '45px', objectFit: 'contain', border: 'none', outline: 'none', boxShadow: 'none' }}
                                    onError={(e) => { e.currentTarget.style.display = 'none'; }}
                                  />
                                ) : (
                                  <span style={{ color: '#999', fontSize: '8px' }}>-</span>
                                )}
                              </td>
                              {/* المقاس والوجه - منفصل لكل وجه */}
                              <td style={{ padding: '6px 4px', border: `1px solid ${tableBorder}`, textAlign: 'center', backgroundColor: idx % 2 === 0 ? '#f8f8f8' : '#fefefe' }}>
                                <div style={{ fontWeight: 'bold', fontSize: '9px' }}>{cleanReprintLabel(item.sizeName)}</div>
                                <div style={{ fontSize: '8px', color: '#666', marginTop: '2px' }}>
                                  {item.face === 'a' ? (
                                    <span style={{ background: '#e8f5e9', padding: '2px 6px', borderRadius: '3px', color: '#2e7d32' }}>أمامي</span>
                                  ) : item.face === 'b' ? (
                                    <span style={{ background: '#fff3e0', padding: '2px 6px', borderRadius: '3px', color: '#ef6c00' }}>خلفي</span>
                                  ) : (
                                    <span style={{ background: '#e3f2fd', padding: '1px 4px', borderRadius: '3px', color: '#1565c0', fontWeight: 'bold' }}>وجهين</span>
                                  )}
                                </div>
                                {item.cutoutCost > 0 && (
                                  <div style={{
                                    fontSize: '8px',
                                    color: '#9333ea',
                                    fontWeight: 'bold',
                                    marginTop: '2px',
                                    padding: '1px 4px',
                                    backgroundColor: '#f3e8ff',
                                    borderRadius: '3px',
                                    display: 'inline-block'
                                  }}>
                                    مجسم
                                  </div>
                                )}
                              </td>
                              {/* المساحة - منفصل لكل وجه */}
                              <td style={{ padding: '6px 4px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', fontSize: '9px' }}>
                                {item.area.toFixed(2)} م²
                              </td>
                              {/* الإجمالي - منفصل لكل وجه */}
                              <td style={{ padding: '6px 4px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: '#1a1a1a', backgroundColor: '#e5e5e5', fontSize: '10px' }}>
                                {item.totalCost.toFixed(0)} د.ل
                              </td>
                            </tr>
                          )
                        })
                      })()}
                    </tbody>
                    <tfoot>
                      {/* صف المجموع الفرعي (إذا يوجد خصم) */}
                      {invoiceType === 'customer' && (task.discount_amount || 0) > 0 && (
                        <>
                          <tr style={{ backgroundColor: totalBg, fontWeight: 'bold', opacity: 0.85 }}>
                            <td colSpan={7} style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: totalText, fontSize: '10px' }}>
                              المجموع الفرعي
                            </td>
                            <td style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: totalText, backgroundColor: totalBg, fontSize: '10px' }}>
                              {((task.customer_total || 0) + (task.discount_amount || 0)).toFixed(0)} د.ل
                            </td>
                          </tr>
                          <tr style={{ backgroundColor: '#1a3d1a', fontWeight: 'bold' }}>
                            <td colSpan={7} style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: '#4ade80', fontSize: '10px' }}>
                              الخصم {task.discount_reason ? `(${task.discount_reason})` : ''}
                            </td>
                            <td style={{ padding: '8px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: '#4ade80', backgroundColor: '#1a3d1a', fontSize: '10px' }}>
                              - {(task.discount_amount || 0).toFixed(0)} د.ل
                            </td>
                          </tr>
                        </>
                      )}
                      <tr style={{ backgroundColor: totalBg, fontWeight: 'bold' }}>
                        <td colSpan={7} style={{ padding: '10px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: totalText, fontSize: '11px' }}>
                          الإجمالي المطلوب
                        </td>
                        <td style={{ padding: '10px 6px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: totalText, backgroundColor: totalBg, fontSize: '11px' }}>
                          {(isGroupInvoice
                            ? allTasks.reduce((s, t) => s + (t.customer_total || 0), 0)
                            : (task.customer_total || 0)
                          ).toFixed(0)} د.ل
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                );
              })()}

              {/* Group Tasks Breakdown - for group invoices */}
              {isGroupInvoice && invoiceType === 'customer' && showCosts && showTasksBreakdown && (
                <div style={{
                  margin: '15px 0',
                  border: `1px solid ${tableBorder}`,
                  borderRadius: '8px',
                  overflow: 'hidden',
                }}>
                  <div style={{ background: tableHeaderBg, padding: '8px 12px', textAlign: 'center', color: tableHeaderText, fontSize: '12px', fontWeight: 'bold' }}>
                    تفصيل المهام المجمعة ({allTasks.length} مهام)
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px' }}>
                    <thead>
                      <tr style={{ background: tableHeaderBg }}>
                        <th style={{ padding: '6px', border: `1px solid ${tableBorder}`, color: tableHeaderText }}>م</th>
                        <th style={{ padding: '6px', border: `1px solid ${tableBorder}`, color: tableHeaderText }}>النوع</th>
                        <th style={{ padding: '6px', border: `1px solid ${tableBorder}`, color: tableHeaderText }}>تركيب</th>
                        <th style={{ padding: '6px', border: `1px solid ${tableBorder}`, color: tableHeaderText }}>طباعة</th>
                        <th style={{ padding: '6px', border: `1px solid ${tableBorder}`, color: tableHeaderText }}>مجسمات</th>
                        <th style={{ padding: '6px', border: `1px solid ${tableBorder}`, color: tableHeaderText }}>خصم</th>
                        <th style={{ padding: '6px', border: `1px solid ${tableBorder}`, color: tableHeaderText, fontWeight: 'bold' }}>الإجمالي</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allTasks.map((t, i) => (
                        <tr key={t.id} style={{ backgroundColor: i % 2 === 0 ? tableRowEven : tableRowOdd }}>
                          <td style={{ padding: '5px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope' }}>{i + 1}</td>
                          <td style={{ padding: '5px', border: `1px solid ${tableBorder}`, textAlign: 'center' }}>
                            {t.task_type === 'new_installation' ? 'تركيب جديد' : 'إعادة تركيب'}
                          </td>
                          <td style={{ padding: '5px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope' }}>{(t.customer_installation_cost || 0).toLocaleString('ar-LY')}</td>
                          <td style={{ padding: '5px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope' }}>{(t.customer_print_cost || 0).toLocaleString('ar-LY')}</td>
                          <td style={{ padding: '5px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope' }}>{(t.customer_cutout_cost || 0).toLocaleString('ar-LY')}</td>
                          <td style={{ padding: '5px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', color: '#ef4444' }}>{(t.discount_amount || 0) > 0 ? `-${(t.discount_amount || 0).toLocaleString('ar-LY')}` : '-'}</td>
                          <td style={{ padding: '5px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold' }}>{(t.customer_total || 0).toLocaleString('ar-LY')}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot data-no-break>
                      <tr style={{ backgroundColor: totalBg, fontWeight: 'bold' }}>
                        <td colSpan={6} style={{ padding: '8px', border: `1px solid ${tableBorder}`, textAlign: 'center', color: totalText, fontSize: '12px' }}>الإجمالي الكلي</td>
                        <td style={{ padding: '8px', border: `1px solid ${tableBorder}`, textAlign: 'center', fontFamily: 'Manrope', fontWeight: 'bold', color: totalText, fontSize: '13px' }}>
                          {allTasks.reduce((s, t) => s + (t.customer_total || 0), 0).toLocaleString('ar-LY')} د.ل
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}

              {/* Total Section - يظهر فقط عند وجود تفاصيل خصم أو توزيع تكاليف أو مهام مجمعة لمنع التكرار */}
              {showCosts && displayMode === 'detailed' && (
                (invoiceType === 'customer' && (task.discount_amount || 0) > 0) ||
                (invoiceType === 'customer' && (task as any).cost_allocation) ||
                isGroupInvoice
              ) && (
                <div data-no-break className="total-section invoice-total-section" style={{
                  background: `linear-gradient(135deg, ${totalBg}, ${totalBg})`,
                  padding: '8px 12px',
                  textAlign: 'center',
                  borderRadius: '6px',
                  pageBreakInside: 'avoid',
                  breakInside: 'avoid' as any,
                  pageBreakBefore: 'avoid',
                  breakBefore: 'avoid' as any,
                  marginTop: '8px',
                  marginBottom: '8px',
                }}>
                  {/* عرض المجموع الفرعي والخصم لفاتورة الزبون */}
                  {invoiceType === 'customer' && (task.discount_amount || 0) > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '20px',
                        fontSize: '14px',
                        color: totalText,
                        opacity: 0.85,
                        marginBottom: '8px'
                      }}>
                        <span>المجموع الفرعي:</span>
                        <span style={{ fontFamily: 'Manrope', fontWeight: 'bold' }}>
                          {(isGroupInvoice
                            ? allTasks.reduce((s, t) => s + (t.customer_total || 0) + (t.discount_amount || 0), 0)
                            : (task.customer_total || 0) + (task.discount_amount || 0)
                          ).toLocaleString('ar-LY')} د.ل
                        </span>
                      </div>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '20px',
                        fontSize: '14px',
                        color: '#4ade80',
                        marginBottom: '8px'
                      }}>
                        <span>الخصم{!isGroupInvoice && task.discount_reason ? ` (${task.discount_reason})` : ''}:</span>
                        <span style={{ fontFamily: 'Manrope', fontWeight: 'bold' }}>
                          - {(isGroupInvoice
                            ? allTasks.reduce((s, t) => s + (t.discount_amount || 0), 0)
                            : (task.discount_amount || 0)
                          ).toLocaleString('ar-LY')} د.ل
                        </span>
                      </div>
                      <div style={{ borderTop: '1px solid rgba(255,255,255,0.2)', marginTop: '8px', paddingTop: '12px' }}>
                        <div style={{ fontSize: '14px', color: totalText, opacity: 0.9, marginBottom: '6px' }}>
                          {hasZeroPayableTotal ? 'الإجمالي صفر - غير معتمد' : `الإجمالي المستحق${isGroupInvoice ? ` (${allTasks.length} مهام)` : ''}`}
                        </div>
                        <div style={{
                          fontSize: '24px',
                          fontWeight: 'bold',
                          color: totalText,
                          fontFamily: 'Manrope',
                        }}>
                          {(isGroupInvoice
                            ? allTasks.reduce((s, t) => s + (t.customer_total || 0), 0)
                            : (task.customer_total || 0)
                          ).toLocaleString('ar-LY')}
                          <span style={{ fontSize: '16px', marginRight: '8px' }}>دينار ليبي</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* (تم إزالة قسم المجسمات المنفصل — أصبحت مدمجة لكل لوحة عبر has_cutout) */}


                  {/* عرض توزيع التكاليف إذا كان مفعلاً */}
                  {invoiceType === 'customer' && (task as any).cost_allocation && (() => {
                    const alloc = (task as any).cost_allocation;
                    const services = [
                      { key: 'print', label: 'الطباعة', data: alloc?.print },
                      { key: 'cutout', label: 'المجسمات', data: alloc?.cutout },
                      { key: 'installation', label: 'التركيب', data: alloc?.installation },
                    ].filter(s => s.data?.enabled);

                    if (services.length === 0) return null;

                    return (
                      <div style={{
                        margin: '15px 0',
                        padding: '12px',
                        border: '1px dashed #666',
                        borderRadius: '6px',
                        backgroundColor: '#f8f8f8'
                      }}>
                        <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#333', marginBottom: '8px', textAlign: 'center' }}>
                          توزيع التكاليف
                        </div>
                        <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ borderBottom: '1px solid #ddd' }}>
                              <th style={{ padding: '4px 8px', textAlign: 'right' }}>الخدمة</th>
                              <th style={{ padding: '4px 8px', textAlign: 'center' }}>الزبون</th>
                              <th style={{ padding: '4px 8px', textAlign: 'center' }}>الشركة</th>
                              {services.some(s => s.data?.printer_pct > 0 || s.data?.printer_amount > 0) && (
                                <th style={{ padding: '4px 8px', textAlign: 'center' }}>المطبعة</th>
                              )}
                              <th style={{ padding: '4px 8px', textAlign: 'center' }}>السبب</th>
                            </tr>
                          </thead>
                          <tbody>
                            {services.map(s => (
                              <tr key={s.key} style={{ borderBottom: '1px solid #eee' }}>
                                <td style={{ padding: '4px 8px', fontWeight: 'bold' }}>{s.label}</td>
                                <td style={{ padding: '4px 8px', textAlign: 'center', fontFamily: 'Manrope' }}>
                                  {s.data.mode === 'percentage' ? `${s.data.customer_pct}%` : `${s.data.customer_amount.toLocaleString()} د.ل`}
                                </td>
                                <td style={{ padding: '4px 8px', textAlign: 'center', fontFamily: 'Manrope' }}>
                                  {s.data.mode === 'percentage' ? `${s.data.company_pct}%` : `${s.data.company_amount.toLocaleString()} د.ل`}
                                </td>
                                {services.some(sv => sv.data?.printer_pct > 0 || sv.data?.printer_amount > 0) && (
                                  <td style={{ padding: '4px 8px', textAlign: 'center', fontFamily: 'Manrope' }}>
                                    {s.data.mode === 'percentage' ? `${s.data.printer_pct}%` : `${s.data.printer_amount.toLocaleString()} د.ل`}
                                  </td>
                                )}
                                <td style={{ padding: '4px 8px', textAlign: 'center', color: '#666', fontSize: '10px' }}>
                                  {s.data.reason || '-'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                        {/* تخفيضات الخدمات */}
                        {services.some(s => s.data.discount > 0) && (
                          <div style={{ marginTop: '8px', fontSize: '11px', color: '#16a34a' }}>
                            {services.filter(s => s.data.discount > 0).map(s => (
                              <div key={s.key} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 8px' }}>
                                <span>تخفيض {s.label}{s.data.discount_reason ? ` (${s.data.discount_reason})` : ''}:</span>
                                <span style={{ fontFamily: 'Manrope', fontWeight: 'bold' }}>- {s.data.discount.toLocaleString()} د.ل</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* عرض الإجمالي مباشرة إذا لا يوجد خصم */}
                  {(invoiceType !== 'customer' || !(task.discount_amount || 0)) && (
                    <>
                      <div style={{ fontSize: '14px', color: totalText, opacity: 0.9, marginBottom: '6px' }}>
                        {hasZeroPayableTotal ? 'الإجمالي صفر - غير معتمد' : 'الإجمالي المستحق'}
                      </div>
                      <div style={{
                        fontSize: '24px',
                        fontWeight: 'bold',
                        color: totalText,
                        fontFamily: 'Manrope',
                      }}>
                        {invoiceType === 'customer'
                          ? dynamicTotal.toLocaleString('ar-LY')
                          : (data?.items?.reduce((sum, item) => sum + (item.totalCost || 0), 0) || 0).toLocaleString('ar-LY')
                        }
                        <span style={{ fontSize: '16px', marginRight: '8px' }}>دينار ليبي</span>
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* Signature and Stamp Section - قسم الختم والتوقيع */}
              {showSignatureSection && (
                <div style={{
                  marginTop: '40px',
                  paddingTop: '20px',
                  borderTop: '2px dashed #ccc',
                }}>
                  <div style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                  }}>
                    {/* الختم */}
                    <div style={{
                      flex: 1,
                      textAlign: 'center',
                      paddingLeft: '20px',
                    }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: '#333',
                        marginBottom: '60px',
                      }}>
                        الختم
                      </div>
                      <div style={{
                        borderTop: '2px solid #333',
                        width: '120px',
                        margin: '0 auto',
                      }}></div>
                    </div>

                    {/* التوقيع */}
                    <div style={{
                      flex: 1,
                      textAlign: 'center',
                      paddingRight: '20px',
                    }}>
                      <div style={{
                        fontSize: '14px',
                        fontWeight: 'bold',
                        color: '#333',
                        marginBottom: '60px',
                      }}>
                        التوقيع
                      </div>
                      <div style={{
                        borderTop: '2px solid #333',
                        width: '120px',
                        margin: '0 auto',
                      }}></div>
                    </div>
                  </div>
                </div>
              )}

              {/* Footer - Unified Engine */}
              <div dangerouslySetInnerHTML={{ __html: unifiedFooterHtml(unifiedStyles) }} />
            </div>
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
}
