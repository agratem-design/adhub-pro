import { Button } from '@/components/ui/button';
import { Printer, Settings2 } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { CompositeTaskWithDetails } from '@/types/composite-task';
import { supabase } from '@/integrations/supabase/client';
import { useState, useEffect } from 'react';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { loadPrintLogo } from '@/lib/printLogo';
import { getMergedInvoiceStylesAsync } from '@/hooks/useInvoiceSettingsSync';
import { unifiedHeaderFooterCss, unifiedHeaderHtml, unifiedFooterHtml, formatDateForPrint } from '@/lib/unifiedInvoiceBase';
import { preparePrintWindow, writePrintWindow } from '@/utils/printWindowHelper';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

// أنماط الطباعة المحملة من الإعدادات
interface PrintStyles {
  primaryColor: string;
  tableHeaderBgColor: string;
  tableHeaderTextColor: string;
  tableBorderColor: string;
  tableRowEvenColor: string;
  fontFamily: string;
  logoPath: string;
  logoSize: number;
  footerText: string;
  bodyFontSize: number;
  headerFontSize: number;
  companyName: string;
  customerSectionBgColor: string;
  customerSectionBorderColor: string;
  totalBgColor: string;
  totalTextColor: string;
}

interface CompositeTaskInvoicePrintProps {
  task: CompositeTaskWithDetails;
}

// عنصر مجاني (تكلفة الزبون = صفر) — يُستبعد من حساب الأمتار وسعر المتر في الفاتورة
function isFreePrintItem(it: any): boolean {
  const hasCutout = (Number(it?.cutout_quantity) || 0) > 0 || (Number(it?._cutout_customer_unit) || 0) > 0;
  if (hasCutout) return false;

  const unit = Number(it?.customer_unit_price) || 0;
  const total = Number(it?.customer_total_price) || 0;
  return unit === 0 && total === 0;
}

function getItemCutoutQuantity(item: any, details?: any): number {
  const directQty = Number(item?.cutout_quantity) || 0;
  if (directQty > 0) return directQty;

  const mappedQty = item?.billboard_id != null
    ? Number(details?.cutoutItemsByBillboard?.[item.billboard_id]?.count) || 0
    : 0;
  if (mappedQty > 0) return mappedQty;

  if (item?.has_cutout) return Number(item?.cutout_count) || 1;
  return 0;
}

function getItemCutoutUnitPrice(item: any, fallbackUnitPrice: number): number {
  return Number(item?._cutout_customer_unit) || Number(item?.cutout_customer_cost) || fallbackUnitPrice || 0;
}

function calculateCutoutCostForItems(items: any[], fallbackUnitPrice: number, details?: any): number {
  return items.reduce((sum: number, item: any) => {
    return sum + (getItemCutoutUnitPrice(item, fallbackUnitPrice) * getItemCutoutQuantity(item, details));
  }, 0);
}

function getEffectiveCustomerTotal(task: CompositeTaskWithDetails, details?: any): number {
  const storedTotal = Number(task.customer_total) || 0;
  if (storedTotal > 0) return storedTotal;

  const subtotal = (Number(task.customer_print_cost) || 0)
    + (Number(task.customer_installation_cost) || 0)
    + (Number(task.customer_cutout_cost) || Number(details?.customerCutoutTotal) || 0);
  return Math.max(0, subtotal - (Number(task.discount_amount) || 0));
}


// دالة لتوليد عنوان الفاتورة ديناميكياً بناءً على المكونات
function generateDynamicInvoiceTitle(task: CompositeTaskWithDetails, details: any): { ar: string; en: string } {
  const hasPrint = (task.customer_print_cost || 0) > 0 || (details?.print?.print_task_items?.length > 0);
  const hasInstallation = (task.customer_installation_cost || 0) > 0 || (details?.installationItems?.length > 0);
  const hasCutout = (task.customer_cutout_cost || 0) > 0 || (details?.totalCutouts > 0);
  
  const components: string[] = [];
  const componentsEn: string[] = [];
  
  if (hasPrint) {
    components.push('طباعة');
    componentsEn.push('Print');
  }
  if (hasInstallation) {
    components.push('تركيب');
    componentsEn.push('Installation');
  }
  if (hasCutout) {
    components.push('قص');
    componentsEn.push('Cutout');
  }
  
  if (components.length === 0) {
    return { ar: 'فاتورة', en: 'Invoice' };
  }
  
  const arTitle = `فاتورة ${components.join(' و')}`;
  const enTitle = `${componentsEn.join(' & ')} Invoice`;
  
  return { ar: arTitle, en: enTitle };
}

export function CompositeTaskInvoicePrint({ task }: CompositeTaskInvoicePrintProps) {
  const { confirm: systemConfirm } = useSystemDialog();
  const [taskDetails, setTaskDetails] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [showDetails, setShowDetails] = useState(true);
  const [displayMode, setDisplayMode] = useState<'detailed' | 'summary'>('detailed');
  const [logoDataUri, setLogoDataUri] = useState<string>('');
  const [printStyles, setPrintStyles] = useState<PrintStyles | null>(null);
  const [fullMergedStyles, setFullMergedStyles] = useState<any>(null);

  useEffect(() => {
    loadTaskDetails();
    loadPrintLogo().then(setLogoDataUri);
    // تحميل إعدادات الطباعة من النظام الموحد
    getMergedInvoiceStylesAsync('composite_task').then((styles: any) => {
      setFullMergedStyles(styles);
      setPrintStyles({
        primaryColor: styles.primaryColor || '#D4AF37',
        tableHeaderBgColor: styles.tableHeaderBgColor || styles.primaryColor || '#D4AF37',
        tableHeaderTextColor: styles.tableHeaderTextColor || '#ffffff',
        tableBorderColor: styles.tableBorderColor || '#e5e5e5',
        tableRowEvenColor: styles.tableRowEvenColor || '#f8f9fa',
        fontFamily: styles.fontFamily || "'Doran', 'Noto Sans Arabic', Arial, sans-serif",
        logoPath: styles.logoPath || '',
        logoSize: styles.logoSize || 200,
        footerText: styles.footerText || 'شكراً لتعاملكم معنا',
        bodyFontSize: styles.bodyFontSize || 10,
        headerFontSize: styles.headerFontSize || 14,
        companyName: styles.companyName || '',
        customerSectionBgColor: styles.customerSectionBgColor || '#f8f9fa',
        customerSectionBorderColor: styles.customerSectionBorderColor || styles.primaryColor || '#D4AF37',
        totalBgColor: styles.totalBgColor || styles.primaryColor || '#D4AF37',
        totalTextColor: styles.totalTextColor || '#ffffff',
      });
    });
  }, [task.id]);

  const loadTaskDetails = async () => {
    setLoading(true);
    try {
      const details: any = {
        installation: null,
        print: null,
        cutout: null,
        cutoutTask: null,
        cutoutItemsByBillboard: {},
        sizesMap: {},
        installationItems: [],
        contractsInfo: [] // معلومات جميع العقود
      };

      // تحميل جميع البيانات بشكل متوازي
      const [installResult, installItemsResult, printResult, cutoutItemsResult, cutoutTaskResult, sizesResult] = await Promise.all([
        task.installation_task_id 
          ? supabase
              .from('installation_tasks')
              .select('*, contract_ids')
              .eq('id', task.installation_task_id)
              .single()
          : Promise.resolve({ data: null }),
        // جلب عناصر التركيب بشكل منفصل
        task.installation_task_id 
          ? supabase
              .from('installation_task_items')
              .select('*')
              .eq('task_id', task.installation_task_id)
          : Promise.resolve({ data: null }),
        task.print_task_id 
          ? supabase
              .from('print_tasks')
              .select('*, print_task_items(*)')
              .eq('id', task.print_task_id)
              .single()
          : Promise.resolve({ data: null }),
        task.cutout_task_id
          ? supabase
              .from('cutout_task_items')
              .select('*')
              .eq('task_id', task.cutout_task_id)
          : Promise.resolve({ data: null }),
        task.cutout_task_id
          ? supabase
              .from('cutout_tasks')
              .select('customer_total_amount, total_quantity, unit_cost, total_cost')
              .eq('id', task.cutout_task_id)
              .single()
          : Promise.resolve({ data: null }),
        // جلب المقاسات الفعلية من جدول sizes
        supabase
          .from('sizes')
          .select('id, name, width, height')
      ]);

      // إنشاء خريطة المقاسات بالاسم
      if (sizesResult.data) {
        sizesResult.data.forEach((size: any) => {
          details.sizesMap[size.name] = { width: size.width, height: size.height };
        });
      }

      details.installation = installResult.data;
      // إضافة عناصر التركيب للمهمة
      if (details.installation && installItemsResult.data) {
        details.installation.installation_task_items = installItemsResult.data;
      }
      details.print = printResult.data;
      details.cutoutTask = cutoutTaskResult.data;

      // ✅ بناء خريطة المجسمات من installation_task_items (مصدر الحقيقة الجديد)
      // count + customer_unit_cost لكل billboard_id لاستخدامها في فاتورة الطباعة
      const installCutoutMap: Record<number, { count: number; customerUnit: number; companyUnit: number }> = {};
      (installItemsResult.data || []).forEach((row: any) => {
        if (row.has_cutout && row.billboard_id) {
          installCutoutMap[row.billboard_id] = {
            count: Number(row.cutout_count) || 1,
            customerUnit: Number(row.cutout_customer_cost) || 0,
            companyUnit: Number(row.cutout_company_cost) || 0,
          };
        }
      });
      details.installCutoutByBillboard = installCutoutMap;

      const totalInstallCutoutCost = Object.values(installCutoutMap).reduce((sum: number, v: any) => {
        return sum + ((Number(v.customerUnit) || 0) * (Number(v.count) || 0));
      }, 0);
      
      // جلب معلومات جميع العقود (أرقام العقود وأنواع الإعلان)
      // ✅ الاعتماد على عقود اللوحات الفعلية من installation_task_items (بدلاً من contract_ids الفارغة)
      let uniqueContractIds: number[] = [];

      if (task.installation_task_id) {
        const { data: installContracts } = await supabase
          .from('installation_task_items')
          .select('billboard:billboards!installation_task_items_billboard_id_fkey(Contract_Number)')
          .eq('task_id', task.installation_task_id);

        const set = new Set<number>();
        (installContracts || []).forEach((row: any) => {
          const n = row.billboard?.Contract_Number;
          if (n) set.add(Number(n));
        });
        uniqueContractIds = Array.from(set);
      }

      if (uniqueContractIds.length === 0) {
        const rawContractIds = installResult.data?.contract_ids && (installResult.data.contract_ids as number[]).length > 0
          ? (installResult.data.contract_ids as number[])
          : [installResult.data?.contract_id || task.contract_id];

        uniqueContractIds = [...new Set(rawContractIds.filter((id): id is number => id != null && typeof id === 'number'))];
      }
      
      if (uniqueContractIds.length > 0) {
        const { data: contractsData } = await supabase
          .from('Contract')
          .select('"Contract_Number", "Ad Type", design_data')
          .in('Contract_Number', uniqueContractIds);
        
        details.contractsInfo = contractsData?.map((c: any) => ({
          contractId: c.Contract_Number,
          adType: c['Ad Type'] || 'غير محدد'
        })) || [];
      }
      
      // جلب بيانات العقد للحصول على design_data من جميع العقود
      let contractDesignMap: Record<string, any> = {};
      for (const contractId of uniqueContractIds) {
        const { data: contractData } = await supabase
          .from('Contract')
          .select('design_data')
          .eq('Contract_Number', contractId)
          .single();
        
        if (contractData?.design_data) {
          const designData = typeof contractData.design_data === 'string' 
            ? JSON.parse(contractData.design_data) 
            : contractData.design_data;
          
          if (Array.isArray(designData)) {
            designData.forEach((d: any) => {
              contractDesignMap[d.billboardId] = {
                designFaceA: d.designFaceA,
                designFaceB: d.designFaceB,
                billboardImage: d.billboardImage,
                billboardLocation: d.billboardLocation
              };
            });
          }
        }
      }
      
      // ✅ PRIMARY: جلب التصاميم من task_designs (المصدر الرئيسي - خاصة لإعادة التركيب)
      let taskDesignsMap: Record<number, { face_a?: string; face_b?: string }> = {};
      if (task.installation_task_id) {
        const { data: taskDesigns } = await supabase
          .from('task_designs')
          .select('id, design_face_a_url, design_face_b_url')
          .eq('task_id', task.installation_task_id);
        
        if (taskDesigns && taskDesigns.length > 0) {
          const installItemsList = details.installation?.installation_task_items || installItemsResult.data || [];
          // إذا تصميم واحد يُطبّق على الكل
          if (taskDesigns.length === 1) {
            const td = taskDesigns[0];
            installItemsList.forEach((item: any) => {
              if (item.billboard_id) {
                taskDesignsMap[item.billboard_id] = {
                  face_a: td.design_face_a_url || undefined,
                  face_b: td.design_face_b_url || undefined,
                };
              }
            });
          } else {
            // ✅ تصاميم متعددة - ربط كل لوحة بتصميمها عبر selected_design_id
            const designById = new Map(taskDesigns.map((td: any) => [td.id, td]));
            const firstDesign = taskDesigns[0]; // فولباك
            installItemsList.forEach((item: any) => {
              if (item.billboard_id) {
                // محاولة ربط التصميم عبر selected_design_id
                const matchedDesign = item.selected_design_id ? designById.get(item.selected_design_id) : null;
                if (matchedDesign) {
                  taskDesignsMap[item.billboard_id] = {
                    face_a: matchedDesign.design_face_a_url || undefined,
                    face_b: matchedDesign.design_face_b_url || undefined,
                    isMatched: true // تم المطابقة بنجاح
                  };
                } else {
                  // لا تقم بالكتابة فوق تصميم تم مطابقته بنجاح سابقاً بـ fallback
                  if ((taskDesignsMap[item.billboard_id] as any)?.isMatched) {
                    return;
                  }

                  if (item.design_face_a || item.design_face_b) {
                    // استخدام التصاميم المحددة للعنصر مباشرة من قاعدة البيانات
                    taskDesignsMap[item.billboard_id] = {
                      face_a: item.design_face_a || undefined,
                      face_b: item.design_face_b || undefined,
                    };
                  } else {
                    // فولباك: استخدم أول تصميم
                    taskDesignsMap[item.billboard_id] = {
                      face_a: firstDesign.design_face_a_url || undefined,
                      face_b: firstDesign.design_face_b_url || undefined,
                    };
                  }
                }
              }
            });
          }
        }
      }

      // جلب بيانات اللوحات لعناصر التركيب (عند عدم وجود طباعة)
      const installItems = details.installation?.installation_task_items || installItemsResult.data || [];
      if (installItems.length > 0) {
        const billboardIds = installItems
          .map((item: any) => item.billboard_id)
          .filter((id: any) => id != null);
        
        if (billboardIds.length > 0) {
          const { data: billboardsData } = await supabase
            .from('billboards')
            .select('ID, Size, Billboard_Name, design_face_a, design_face_b, Image_URL, Nearest_Landmark, GPS_Coordinates')
            .in('ID', billboardIds);
          
          if (billboardsData) {
            details.installationBillboards = {};
            billboardsData.forEach((b: any) => {
              const sizeInfo = details.sizesMap[b.Size];
              const contractDesign = contractDesignMap[String(b.ID)] || {};
              
              // استخراج المقاس من النص إذا لم يوجد في sizesMap
              let width = sizeInfo?.width;
              let height = sizeInfo?.height;
              if (!width || !height) {
                const sizeMatch = b.Size?.match(/(\d+)x(\d+)/);
                if (sizeMatch) {
                  width = parseInt(sizeMatch[1]);
                  height = parseInt(sizeMatch[2]);
                }
              }
              
              // ✅ أولوية: task_designs > العقد > اللوحة
              const tdDesign = taskDesignsMap[b.ID];
              const designA = tdDesign?.face_a || contractDesign.designFaceA || b.design_face_a;
              const designB = tdDesign?.face_b || contractDesign.designFaceB || b.design_face_b;
              
              details.installationBillboards[b.ID] = {
                name: b.Billboard_Name,
                size: b.Size,
                width: width,
                height: height,
                design_face_a: designA,
                design_face_b: designB,
                location: contractDesign.billboardLocation,
                // ✅ إضافة البيانات الجديدة
                billboard_image: b.Image_URL,
                nearest_landmark: b.Nearest_Landmark,
                gps_coordinates: b.GPS_Coordinates
              };
            });
          }
        }
        
        // بناء قائمة عناصر التركيب مع بيانات اللوحات
        details.installationItems = installItems.map((item: any) => {
          const billboard = details.installationBillboards?.[item.billboard_id] || {};
          
          // استخراج المقاس من billboard.Size إذا لم يكن موجوداً
          let width = billboard.width;
          let height = billboard.height;
          if (!width || !height) {
            const sizeStr = item.billboard?.Size || billboard.size;
            const sizeMatch = sizeStr?.match(/(\d+)x(\d+)/);
            if (sizeMatch) {
              width = parseInt(sizeMatch[1]);
              height = parseInt(sizeMatch[2]);
            }
          }
          
          return {
            ...item,
            billboard_name: billboard.name || item.billboard?.Billboard_Name,
            billboard_size: billboard.size || item.billboard?.Size,
            width: width,
            height: height,
            cutout_quantity: getItemCutoutQuantity(item, details),
            _cutout_customer_unit: Number(item.cutout_customer_cost) || details.customerCutoutUnitPrice || 0,
            design_face_a: taskDesignsMap[item.billboard_id]?.face_a || item.design_face_a || billboard.design_face_a,
            design_face_b: taskDesignsMap[item.billboard_id]?.face_b || item.design_face_b || billboard.design_face_b,
            location: billboard.location,
            // ✅ إضافة البيانات الجديدة
            billboard_image: billboard.billboard_image,
            nearest_landmark: billboard.nearest_landmark,
            gps_coordinates: billboard.gps_coordinates
          };
        });
      }
      
      // إذا وجدت عناصر الطباعة، نجلب بيانات اللوحات للحصول على المقاسات الفعلية والبيانات الإضافية
      if (printResult.data?.print_task_items?.length > 0) {
        const billboardIds = printResult.data.print_task_items
          .map((item: any) => item.billboard_id)
          .filter((id: any) => id != null);
        
        if (billboardIds.length > 0) {
          const { data: billboardsData } = await supabase
            .from('billboards')
            .select('ID, Size, Image_URL, Nearest_Landmark, GPS_Coordinates')
            .in('ID', billboardIds);
          
          if (billboardsData) {
            details.billboardSizes = {};
 details.billboardExtras = {}; // بيانات إضافية للوحات
            billboardsData.forEach((b: any) => {
              const sizeInfo = details.sizesMap[b.Size];
              details.billboardSizes[b.ID] = sizeInfo || { width: null, height: null };
              details.billboardExtras[b.ID] = {
                billboard_image: b.Image_URL,
                nearest_landmark: b.Nearest_Landmark,
                gps_coordinates: b.GPS_Coordinates
              };
            });
          }
        }
        
        // ✅ إضافة البيانات الإضافية لعناصر الطباعة + دمج بيانات المجسمات من التركيب
        printResult.data.print_task_items = printResult.data.print_task_items.map((item: any) => {
          const extras = details.billboardExtras?.[item.billboard_id] || {};
          const instCut = details.installCutoutByBillboard?.[item.billboard_id];
          const mergedCutoutQty = (item.cutout_quantity || 0) > 0
            ? item.cutout_quantity
            : (instCut?.count || 0);
          return {
            ...item,
            billboard_image: extras.billboard_image,
            nearest_landmark: extras.nearest_landmark,
            gps_coordinates: extras.gps_coordinates,
            cutout_quantity: mergedCutoutQty,
            // store per-billboard customer unit price for cutout (fallback)
            _cutout_customer_unit: instCut?.customerUnit || 0,
          };
        });
      }
      
      // حساب سعر المجسم للزبون من cutout_tasks
      if (cutoutTaskResult.data) {
        const ct = cutoutTaskResult.data;
        details.totalCutouts = ct.total_quantity || 0;
        // سعر المجسم للزبون = إجمالي الزبون / عدد المجسمات
        details.customerCutoutUnitPrice = details.totalCutouts > 0 
          ? (ct.customer_total_amount || 0) / details.totalCutouts 
          : 0;
        // سعر المجسم للشركة
        details.companyCutoutUnitPrice = ct.unit_cost || 0;
      }

      const taskCutoutTotal = Number(task.customer_cutout_cost) || 0;
      if ((!details.customerCutoutUnitPrice || details.customerCutoutUnitPrice === 0) && taskCutoutTotal > 0) {
        const countFromInstall = Object.values(installCutoutMap).reduce((sum: number, v: any) => sum + (Number((v as any).count) || 0), 0);
        const countFromTask = Number(details.totalCutouts) || countFromInstall || 1;
        details.totalCutouts = Number(details.totalCutouts) || countFromTask;
        details.customerCutoutUnitPrice = taskCutoutTotal / countFromTask;
      }

      // ✅ مصدر بديل: احسب من installation_task_items عند غياب cutout_tasks
      if ((!details.totalCutouts || details.totalCutouts === 0) && Object.keys(details.installCutoutByBillboard || {}).length > 0) {
        let cnt = 0, customer = 0;
        Object.values(details.installCutoutByBillboard as Record<string, any>).forEach((v: any) => {
          cnt += v.count || 0;
          customer += (v.customerUnit || 0) * (v.count || 0);
        });
        details.totalCutouts = cnt;
        details.customerCutoutUnitPrice = cnt > 0 ? ((customer || taskCutoutTotal) / cnt) : 0;
      }

      details.customerCutoutTotal = taskCutoutTotal || totalInstallCutoutCost || ((Number(details.customerCutoutUnitPrice) || 0) * (Number(details.totalCutouts) || 0));

      // تجميع بيانات المجسمات حسب billboard_id من cutout_task_items
      if (cutoutItemsResult.data) {
        const cutoutItems = cutoutItemsResult.data as any[];
        cutoutItems.forEach((item: any) => {
          if (!details.cutoutItemsByBillboard[item.billboard_id]) {
            details.cutoutItemsByBillboard[item.billboard_id] = { count: 0, unitCost: item.unit_cost || 0 };
          }
          details.cutoutItemsByBillboard[item.billboard_id].count += item.quantity;
        });

        if ((!details.totalCutouts || details.totalCutouts === 0) && cutoutItems.length > 0) {
          details.totalCutouts = cutoutItems.reduce((sum: number, item: any) => sum + (Number(item.quantity) || 0), 0);
        }

        if (printResult.data?.print_task_items?.length > 0) {
          printResult.data.print_task_items = printResult.data.print_task_items.map((item: any) => {
            const mappedCutout = details.cutoutItemsByBillboard?.[item.billboard_id];
            const mappedQty = Number(mappedCutout?.count) || 0;
            return mappedQty > 0
              ? { ...item, cutout_quantity: Number(item.cutout_quantity) || mappedQty }
              : item;
          });
        }
      }

      if (taskCutoutTotal > 0 && (Number(details.totalCutouts) || 0) > 0) {
        details.customerCutoutUnitPrice = taskCutoutTotal / Number(details.totalCutouts);
      }
      details.customerCutoutTotal = taskCutoutTotal || totalInstallCutoutCost || ((Number(details.customerCutoutUnitPrice) || 0) * (Number(details.totalCutouts) || 0));
      
      setTaskDetails(details);
    } catch (error) {
      console.error('Error loading task details:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = async () => {
    if (!taskDetails) return;

    // ✅ تحذير عند محاولة طباعة فاتورة بقيمة صفر
    const customerTotal = getEffectiveCustomerTotal(task, taskDetails);
    if (customerTotal === 0) {
      const confirmZero = await systemConfirm({
 title: '️ تنبيه',
        message: 'قيمة هذه الفاتورة صفر!\n\nهذه المهمة لا تحتوي على تكاليف محددة للعميل.\nقد يكون ذلك بسبب عدم اكتمال ربط البيانات.\n\nهل تريد المتابعة بالطباعة؟',
        confirmText: 'متابعة',
      });
      if (!confirmZero) return;
    }

    const docTitle = `فاتورة_مهمة_مجمعة_${task.task_number || task.id}`;
    const printWindow = preparePrintWindow(docTitle);

    // تحميل الشعار قبل الطباعة
    const logo = logoDataUri || await loadPrintLogo();

    const styles = printStyles || {
      primaryColor: '#D4AF37', tableHeaderBgColor: '#D4AF37', tableHeaderTextColor: '#ffffff',
      tableBorderColor: '#e5e5e5', tableRowEvenColor: '#f8f9fa', fontFamily: "'Doran', 'Noto Sans Arabic', Arial, sans-serif",
      logoPath: '', logoSize: 200, footerText: 'شكراً لتعاملكم معنا', bodyFontSize: 10,
      headerFontSize: 14, companyName: '', customerSectionBgColor: '#f8f9fa',
      customerSectionBorderColor: '#D4AF37', totalBgColor: '#D4AF37', totalTextColor: '#ffffff',
    };
    const invoiceHTML = generateInvoiceHTML(task, taskDetails, showDetails, logo, displayMode, styles, fullMergedStyles);

    writePrintWindow(printWindow, invoiceHTML, {
      title: docTitle,
      landscape: false,
      showDownloadPdf: true,
      showShare: true,
      autoPrint: true,
    });
  };

  // ✅ التحقق من وجود بنود فعلية أو تكاليف (للسماح بإنشاء عناصر افتراضية)
  const hasItems = taskDetails && (
    (taskDetails.print?.print_task_items?.length > 0) ||
    (taskDetails.installationItems?.length > 0) ||
    (taskDetails.totalCutouts > 0) ||
    // ✅ السماح بالطباعة إذا كانت هناك تكاليف (ستُنشأ عناصر افتراضية)
    (task.customer_print_cost || 0) > 0 ||
    (task.customer_installation_cost || 0) > 0 ||
    (task.customer_cutout_cost || 0) > 0
  );

  // توليد عنوان الفاتورة
  const invoiceTitle = taskDetails ? generateDynamicInvoiceTitle(task, taskDetails) : { ar: 'فاتورة', en: 'Invoice' };

  return (
    <div className="flex items-center gap-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <Settings2 className="h-4 w-4" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="end">
          <div className="space-y-4">
            <h4 className="font-medium text-sm border-b pb-2">خيارات الطباعة</h4>
            
            {/* نوع العرض */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-muted-foreground">نوع العرض:</Label>
              <div className="flex gap-2">
                <Button
                  variant={displayMode === 'detailed' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setDisplayMode('detailed')}
                >
                  تفصيلي
                </Button>
                <Button
                  variant={displayMode === 'summary' ? 'default' : 'outline'}
                  size="sm"
                  className="flex-1 text-xs"
                  onClick={() => setDisplayMode('summary')}
                >
                  مجمّع
                </Button>
              </div>
            </div>
            
            {/* إظهار أعمدة التفاصيل */}
            {displayMode === 'detailed' && (
              <div className="flex items-center space-x-2 space-x-reverse">
                <Checkbox 
                  id="showDetails" 
                  checked={showDetails}
                  onCheckedChange={(checked) => setShowDetails(checked as boolean)}
                />
                <Label htmlFor="showDetails" className="text-sm cursor-pointer">
                  إظهار أعمدة التكاليف التفصيلية
                </Label>
              </div>
            )}

            {/* معاينة العنوان */}
            <div className="pt-2 border-t">
              <Label className="text-xs font-medium text-muted-foreground">عنوان الفاتورة:</Label>
              <p className="text-sm font-semibold mt-1">{invoiceTitle.ar}</p>
            </div>
          </div>
        </PopoverContent>
      </Popover>
      
      <Button 
        onClick={handlePrint} 
        variant="outline" 
        size="sm"
        disabled={loading || !taskDetails || !hasItems}
 title={!hasItems ? 'لا توجد بنود في هذه الفاتورة' : getEffectiveCustomerTotal(task, taskDetails) === 0 ? '️ قيمة الفاتورة صفر' : ''}
        className={getEffectiveCustomerTotal(task, taskDetails) === 0 && hasItems ? 'border-amber-400 text-amber-600' : ''}
      >
        <Printer className="h-4 w-4 mr-2" />
 {loading ? 'جاري التحميل...' : !hasItems ? 'لا توجد بنود' : getEffectiveCustomerTotal(task, taskDetails) === 0 ? '️ فاتورة فارغة' : 'طباعة فاتورة الزبون'}
      </Button>
    </div>
  );
}

// دالة إنشاء صفحة فاتورة فارغة مع رسالة توضيحية
function generateEmptyInvoiceHTML(task: CompositeTaskWithDetails, invoiceTitle: { ar: string; en: string }, invoiceDate: string, logoDataUri: string, styles?: PrintStyles): string {
  const pc = styles?.primaryColor || '#D4AF37';
  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${invoiceTitle.ar} - ${task.customer_name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { font-family: 'Noto Sans Arabic', Arial, sans-serif; direction: rtl; text-align: right; background: white; }
    .page { width: 190mm; min-height: 277mm; padding: 20mm; margin: 0 auto; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #000; padding-bottom: 15px; margin-bottom: 30px; }
    .logo { max-width: 150px; height: auto; }
    .title { font-size: 24px; font-weight: bold; }
    .empty-message { text-align: center; padding: 60px 20px; background: #f8f9fa; border: 2px dashed #ccc; border-radius: 10px; margin-top: 50px; }
    .empty-icon { font-size: 48px; margin-bottom: 20px; color: #999; }
    .empty-text { font-size: 18px; color: #666; line-height: 1.8; }
    .customer-info { background: #f8f9fa; padding: 15px; border-radius: 8px; margin-bottom: 20px; }
    .info-row { display: flex; justify-content: space-between; margin-bottom: 8px; }
    .info-label { color: #666; }
    .info-value { font-weight: bold; }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div>
        <div class="title">${invoiceTitle.ar}</div>
        <div style="font-size: 12px; color: #666;">${invoiceTitle.en}</div>
      </div>
      ${logoDataUri ? `<img src="${logoDataUri}" class="logo" alt="شعار الشركة">` : ''}
    </div>
    
    <div class="customer-info">
      <div class="info-row">
        <span class="info-label">العميل:</span>
        <span class="info-value">${task.customer_name || 'غير محدد'}</span>
      </div>
      <div class="info-row">
        <span class="info-label">رقم العقد:</span>
        <span class="info-value">#${task.contract_id}</span>
      </div>
      <div class="info-row">
        <span class="info-label">التاريخ:</span>
        <span class="info-value">${invoiceDate}</span>
      </div>
    </div>
    
    <div class="empty-message">
 <div class="empty-icon"></div>
      <div class="empty-text">
        <strong>لا توجد بنود في هذه الفاتورة</strong><br><br>
        هذه المهمة لا تحتوي على عناصر طباعة أو تركيب أو قص.<br>
        يرجى التأكد من إضافة البنود المطلوبة قبل إنشاء الفاتورة.
      </div>
    </div>
  </div>
</body>
</html>
  `;
}

// دالة توليد جدول العرض المجمّع (عمود تكلفة واحد لكل عنصر)
function generateSummarySection(task: CompositeTaskWithDetails, details: any, invoiceTitle: { ar: string; en: string }, pricePerMeter: number = 0, styles?: PrintStyles): string {
  const thBg = styles?.tableHeaderBgColor || styles?.primaryColor || '#D4AF37';
  const thColor = styles?.tableHeaderTextColor || '#ffffff';
  const totalBg = styles?.totalBgColor || styles?.primaryColor || '#D4AF37';
  const totalColor = styles?.totalTextColor || '#ffffff';
  const totalAmount = getEffectiveCustomerTotal(task, details);
  
  const printItemsRaw = details.print?.print_task_items || [];
  const installationItems = details.installationItems || [];
  const printItems = printItemsRaw.filter((it: any) => !isFreePrintItem(it));
  const cutoutTotalForVirtual = Number(task.customer_cutout_cost) || Number(details.customerCutoutTotal) || 0;
  const isInstallationOnly = printItems.length === 0 && installationItems.length > 0;
  const items = isInstallationOnly ? installationItems : printItems;
  const invoiceItems = items.length > 0 ? items : (cutoutTotalForVirtual > 0 ? [{
    type: 'virtual_cutout',
    billboard_id: 'virtual_cutout',
    width: 0,
    height: 0,
    quantity: details.totalCutouts || 1,
    cutout_quantity: details.totalCutouts || 1,
    _cutout_customer_unit: (details.totalCutouts || 0) > 0 ? cutoutTotalForVirtual / details.totalCutouts : cutoutTotalForVirtual,
  }] : []);
  
  // سعر المتر للزبون (يستبعد العناصر المجانية)
  
  // سعر المتر للزبون (يستبعد العناصر المجانية)
  const totalArea = printItems.reduce((sum: number, item: any) => sum + (item.area * item.quantity), 0);
  const storedCustomerPerMeter = Number(details.print?.customer_price_per_meter) || 0;
  const customerPricePerMeter = storedCustomerPerMeter > 0
    ? storedCustomerPerMeter
    : (totalArea > 0 ? (task.customer_print_cost || 0) / totalArea : 0);
  
  // سعر المجسم للزبون
  const cutoutPricePerUnit = details.customerCutoutUnitPrice || 0;
  
  // سعر التركيب لكل لوحة
  const installationCostPerItem = installationItems.length > 0 
    ? (task.customer_installation_cost || 0) / installationItems.length 
    : 0;
  
  // تجميع العناصر المتشابهة مع تجميع الوجهين
  const groupSimilarItems = (items: any[]) => {
    const grouped: Record<string, any> = {};
    
    items.forEach((item: any) => {
      const billboardSize = details.billboardSizes?.[item.billboard_id];
      const displayWidth = billboardSize?.width || item.width;
      const displayHeight = billboardSize?.height || item.height;
      const sizeKey = item.type === 'virtual_cutout' ? 'مجسم' : `${displayWidth}×${displayHeight}`;
      
      const hasCutout = getItemCutoutQuantity(item, details) > 0;
      
      // ✅ تجميع بناءً على صورة اللوحة والإحداثيات
      const billboardImage = item.billboard_image || '';
      const gpsCoords = item.gps_coordinates || '';
      const nearestLandmark = item.nearest_landmark || '';
      
      const groupKey = `${billboardImage || 'no-image'}_${gpsCoords || 'no-gps'}_${sizeKey}_${hasCutout}`;
      
      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          billboardImage,
          nearestLandmark,
          displayWidth,
          displayHeight,
          sizeKey,
          items: [],
          designs: [],
          totalQuantity: 0,
          totalArea: 0,
          totalCutouts: 0
        };
      }
      
      // جمع التصاميم المختلفة
      if (item.design_face_a && !grouped[groupKey].designs.some((d: any) => d.image === item.design_face_a)) {
        grouped[groupKey].designs.push({ image: item.design_face_a, face: 'أمامي' });
      }
      if (item.design_face_b && !grouped[groupKey].designs.some((d: any) => d.image === item.design_face_b)) {
        grouped[groupKey].designs.push({ image: item.design_face_b, face: 'خلفي' });
      }
      
      const itemArea = (item.area || ((displayWidth || 0) * (displayHeight || 0))) * (item.quantity || 1);
      grouped[groupKey].items.push(item);
      grouped[groupKey].totalQuantity += (item.quantity || 1);
      grouped[groupKey].totalArea += itemArea;
      grouped[groupKey].totalCutouts += getItemCutoutQuantity(item, details);
    });
    
    return Object.values(grouped);
  };
  
  const groupedItems = groupSimilarItems(invoiceItems);
  
  // بناء صفوف الجدول
  let rows = '';
  let rowIndex = 1;
  
  groupedItems.forEach((group: any) => {
    // حساب التكلفة الإجمالية للعنصر - التكلفة الفعلية
    const printCost = group.totalArea * customerPricePerMeter;
    // ✅ احتساب تكلفة القص لكل عنصر باستخدام السعر الفردي عند توفره
    const cutoutCost = calculateCutoutCostForItems(group.items, cutoutPricePerUnit, details);
    const isTaskReinstall = (task as any)?.task_type === 'reinstallation';
    const installCost = isInstallationOnly ? group.items.reduce((sum: number, item: any) => {
      const isReinstalled = isTaskReinstall && (item.reinstall_count || 0) > 0;
      const itemCost = isReinstalled
        ? (Number(item.customer_reinstall_cost) || Number(item.customer_installation_cost) || 0)
        : (item.customer_installation_cost || installationCostPerItem);
      return sum + itemCost;
    }, 0) : 0;
    const totalItemCost = printCost + cutoutCost + installCost;

    
    // عرض التصاميم المختلفة
    const designsHTML = group.designs.length > 0 
      ? group.designs.map((d: any) => `
          <div style="margin-bottom: 2px; position: relative; display: inline-block; width: 45%;">
            <img src="${d.image}" style="width: 100%; height: 35px; object-fit: contain; display: block; border: 1px solid #ddd; border-radius: 3px;" onerror="this.style.display='none'" />
          </div>
        `).join('')
      : '<div style="text-align: center; color: #999; font-size: 8px;">-</div>';
    
    rows += `
      <tr>
        <td style="text-align: center; font-weight: bold; vertical-align: middle;">${rowIndex}</td>
        <td style="padding: 3px; vertical-align: middle;">
          ${group.billboardImage 
            ? `<img src="${group.billboardImage}" style="width: 100%; height: 45px; object-fit: cover; display: block; border-radius: 4px;" onerror="this.style.display='none'" />`
            : '<div style="text-align: center; color: #999; font-size: 8px;">-</div>'}
        </td>
        <td style="padding: 2px; vertical-align: top;">${designsHTML}</td>
        <td style="vertical-align: middle; font-size: 7px; line-height: 1.2;">
          ${group.nearestLandmark 
            ? `<div style="color: #374151;">${group.nearestLandmark.substring(0, 35)}${group.nearestLandmark.length > 35 ? '...' : ''}</div>`
            : '<span style="color: #999;">-</span>'}
        </td>
        <td style="vertical-align: middle;">
          <div style="font-weight: bold; font-size: 9px;">${group.sizeKey === 'مجسم' ? 'مجسم' : `${group.displayWidth}×${group.displayHeight}`}</div>
          <div style="font-size: 7px; color: #666;">${group.totalCutouts > 0 ? 'مجسم' : 'متر'}</div>
        </td>

        <td style="vertical-align: middle;"><strong style="font-size: 10px;">×${group.totalQuantity}</strong></td>
        <td style="vertical-align: middle; font-size: 9px;">${group.totalArea.toFixed(1)} م²</td>
        <td style="vertical-align: middle; background: ${styles?.tableRowEvenColor || '#f0f9ff'};">
          <strong style="font-size: 10px; color: ${thBg};">${totalItemCost.toFixed(0)}</strong>
          <div style="font-size: 7px; color: #666;">د.ل</div>
        </td>
      </tr>
    `;
    rowIndex++;
  });
  
  return `
    <div class="items-section">
      <div class="section-title" style="background: ${thBg};">بنود الفاتورة</div>
      <table class="items-table" style="border-color: ${thBg};">
        <thead>
          <tr>
            <th style="width: 25px;">#</th>
            <th style="width: 50px;">صورة اللوحة</th>
            <th style="width: 60px;">التصاميم</th>
            <th style="width: 80px;">أقرب نقطة دالة</th>
            <th style="width: 50px;">المقاس</th>
            <th style="width: 35px;">الكمية</th>
            <th style="width: 45px;">المساحة</th>
            <th style="width: 70px;">التكلفة</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
        </tbody>
      </table>
    </div>
    
    ${(task.discount_amount || 0) > 0 ? `
    <div style="margin-top: 10px; padding: 8px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 4px; display: flex; justify-content: space-between;">
      <span style="color: #dc2626;">خصم ${task.discount_reason ? `(${task.discount_reason})` : ''}</span>
      <span style="color: #dc2626; font-weight: bold;">- ${(task.discount_amount || 0).toLocaleString('ar-LY')} د.ل</span>
    </div>
    ` : ''}
    
    <div style="margin-top: 15px; background: ${totalBg}; color: ${totalColor}; padding: 12px; text-align: center; border-radius: 6px; font-size: 16px; font-weight: bold;">
      الإجمالي المطلوب: ${totalAmount.toLocaleString('ar-LY')} دينار ليبي
    </div>
  `;
}

function generateInvoiceHTML(task: CompositeTaskWithDetails, details: any, showDetails: boolean = true, logoDataUri: string = '', displayMode: 'detailed' | 'summary' = 'detailed', styles?: PrintStyles, mergedStyles?: any): string {
  const pc = styles?.primaryColor || '#D4AF37';
  const thBg = styles?.tableHeaderBgColor || styles?.primaryColor || '#D4AF37';
  const thColor = styles?.tableHeaderTextColor || '#ffffff';
  const tBorder = styles?.tableBorderColor || '#e5e5e5';
  const rowEven = styles?.tableRowEvenColor || '#f8f9fa';
  const fontFamily = styles?.fontFamily || "'Doran', 'Noto Sans Arabic', Arial, sans-serif";
  const custBg = styles?.customerSectionBgColor || '#f8f9fa';
  const custBorder = styles?.customerSectionBorderColor || pc;
  const totalBg = styles?.totalBgColor || pc;
  const totalColor = styles?.totalTextColor || '#ffffff';
  const footerText = styles?.footerText || 'شكراً لتعاملكم معنا';
  // توليد عنوان الفاتورة ديناميكياً
  const invoiceTitle = generateDynamicInvoiceTitle(task, details);
  
  const dateStr = task.invoice_date || new Date().toISOString();
  const invoiceDate = formatDateForPrint(dateStr, mergedStyles?.show_hijri_date ?? mergedStyles?.showHijriDate ?? false);

  const printItemsRaw = details.print?.print_task_items || [];
  const printItems = printItemsRaw.filter((it: any) => !isFreePrintItem(it));
  const installationItems = details.installationItems || [];
  
  // التحقق من وجود بنود فعلية
  const hasRealItems = printItems.length > 0 || installationItems.length > 0 || (details.totalCutouts || 0) > 0;
  
  // التحقق من وجود تكاليف (حتى لو لم تكن هناك عناصر فعلية)
  const hasCosts = (task.customer_print_cost || 0) > 0 || 
                   (task.customer_installation_cost || 0) > 0 || 
                   (task.customer_cutout_cost || 0) > 0 ||
                   (details.customerCutoutTotal || 0) > 0;
  
  // ⚠️ قاعدة حرجة: يُمنع إنشاء فاتورة فارغة تماماً
  // إذا لم توجد عناصر فعلية ولا تكاليف، أعد صفحة رسالة
  if (!hasRealItems && !hasCosts) {
    return generateEmptyInvoiceHTML(task, invoiceTitle, invoiceDate, logoDataUri, styles);
  }
  
  // ✅ إنشاء عناصر افتراضية (Virtual Items) إذا لم تكن هناك عناصر فعلية لكن توجد تكاليف
  // هذا يضمن أن الفاتورة لن تكون فارغة أبداً
  const virtualItems: any[] = [];
  if ((!hasRealItems || (printItems.length === 0 && installationItems.length === 0 && (details.totalCutouts || 0) > 0)) && hasCosts) {
    if ((task.customer_print_cost || 0) > 0) {
      virtualItems.push({
        type: 'virtual',
        category: 'print',
        description: 'الطباعة (مهمة مجمّعة)',
        description_en: 'Printing (Composite Task)',
        quantity: 1,
        unit_price: task.customer_print_cost,
        total: task.customer_print_cost
      });
    }
    if ((task.customer_installation_cost || 0) > 0) {
      virtualItems.push({
        type: 'virtual',
        category: 'installation',
        description: 'التركيب (مهمة مجمّعة)',
        description_en: 'Installation (Composite Task)',
        quantity: 1,
        unit_price: task.customer_installation_cost,
        total: task.customer_installation_cost
      });
    }
    const cutoutTotalForVirtual = Number(task.customer_cutout_cost) || Number(details.customerCutoutTotal) || 0;
    if (cutoutTotalForVirtual > 0) {
      virtualItems.push({
        type: 'virtual',
        category: 'cutout',
        description: 'القص (مهمة مجمّعة)',
        description_en: 'Cutout (Composite Task)',
        quantity: details.totalCutouts || 1,
        unit_price: (details.totalCutouts || 0) > 0 ? cutoutTotalForVirtual / details.totalCutouts : cutoutTotalForVirtual,
        total: cutoutTotalForVirtual
      });
    }
  }
  
  // استخدام العناصر الافتراضية إذا لم تكن هناك عناصر حقيقية
  const useVirtualItems = virtualItems.length > 0;
  
  // تحديد إذا كانت فاتورة تركيب فقط (بدون طباعة)
  const hasBillboardCutoutOnly = printItems.length === 0
    && installationItems.length > 0
    && (Number(task.customer_installation_cost) || 0) === 0
    && ((Number(task.customer_cutout_cost) || Number(details.customerCutoutTotal) || 0) > 0);
  const isCutoutOnly = printItems.length === 0 && (installationItems.length === 0 || hasBillboardCutoutOnly) && (details.totalCutouts || 0) > 0;
  const isInstallationOnly = printItems.length === 0 && installationItems.length > 0 && !isCutoutOnly;
  
  // العناصر المستخدمة في الفاتورة
  const invoiceItems = useVirtualItems ? virtualItems : (printItems.length > 0 ? printItems : installationItems);
  
  // حساب إجمالي المساحة من print_task_items
  const totalArea = printItems.reduce((sum: number, item: any) => sum + (item.area * item.quantity), 0);
  
  // حساب إجمالي عدد المجسمات من cutout_tasks
  const totalCutouts = details.totalCutouts || 0;
  
  // حساب سعر المتر للزبون — يفضّل القيمة المخزنة (المُدخلة في النافذة)
  const storedPerMeterCustomer = Number(details.print?.customer_price_per_meter) || 0;
  const pricePerMeter = storedPerMeterCustomer > 0
    ? storedPerMeterCustomer
    : (totalArea > 0 ? (task.customer_print_cost || 0) / totalArea : 0);
  
  // سعر المجسم الواحد للزبون (من cutout_tasks.customer_total_amount / total_quantity)
  const cutoutPricePerUnit = details.customerCutoutUnitPrice || 0;
  const effectiveCustomerTotal = getEffectiveCustomerTotal(task, details);
  
  // حساب تكلفة التركيب لكل لوحة
  const installationCostPerItem = installationItems.length > 0 
    ? (task.customer_installation_cost || 0) / installationItems.length 
    : 0;

  // دالة تجميع العناصر المتشابهة مع تجميع الوجهين ذات نفس الصورة والإحداثيات
  const groupSimilarItems = (items: any[], isInstallOnly: boolean) => {
    const grouped: Record<string, any> = {};
    
    items.forEach((item: any) => {
      const billboardSize = details.billboardSizes?.[item.billboard_id];
      const displayWidth = billboardSize?.width || item.width;
      const displayHeight = billboardSize?.height || item.height;
      const sizeKey = (displayWidth && displayHeight) ? `${displayWidth}×${displayHeight}` : 'مجسم';
      
      const hasCutout = getItemCutoutQuantity(item, details) > 0;
      
      // ✅ تجميع الوجهين إذا كان لهما نفس صورة اللوحة ونفس الإحداثيات
      const billboardImage = item.billboard_image || item.billboard?.Image_URL || '';
      const gpsCoords = item.gps_coordinates || item.billboard?.GPS_Coordinates || '';
      const nearestLandmark = item.nearest_landmark || item.billboard?.Nearest_Landmark || '';
      
      // مفتاح التجميع الجديد: صورة اللوحة + الإحداثيات + المقاس + وجود مجسمات
      const groupKey = `${billboardImage || 'no-image'}_${gpsCoords || 'no-gps'}_${sizeKey}_${hasCutout}`;
      
      if (!grouped[groupKey]) {
        grouped[groupKey] = {
          billboardImage,
          gpsCoords,
          nearestLandmark,
          displayWidth,
          displayHeight,
          sizeKey,
          items: [],
          designs: [], // قائمة التصاميم المختلفة
          totalQuantity: 0,
          totalArea: 0,
          totalCutouts: 0,
          totalCost: 0,
          billboardNames: new Set<string>()
        };
      }
      
      // جمع التصاميم المختلفة
      if (item.design_face_a && !grouped[groupKey].designs.some((d: any) => d.image === item.design_face_a)) {
        grouped[groupKey].designs.push({ image: item.design_face_a, face: 'أمامي' });
      }
      if (item.design_face_b && !grouped[groupKey].designs.some((d: any) => d.image === item.design_face_b)) {
        grouped[groupKey].designs.push({ image: item.design_face_b, face: 'خلفي' });
      }
      
      const itemArea = (item.area || ((displayWidth || 0) * (displayHeight || 0))) * (item.quantity || 1);
      grouped[groupKey].items.push(item);
      grouped[groupKey].totalQuantity += (item.quantity || 1);
      grouped[groupKey].totalArea += itemArea;
      grouped[groupKey].totalCutouts += getItemCutoutQuantity(item, details);
      
      // جمع أسماء اللوحات
      const billboardName = item.billboard_name || item.billboard?.Billboard_Name;
      if (billboardName) {
        grouped[groupKey].billboardNames.add(billboardName);
      }
    });
    
    // تحويل Set إلى Array
    return Object.values(grouped).map((g: any) => ({
      ...g,
      billboardNames: Array.from(g.billboardNames)
    }));
  };

  // دالة إنشاء جدول العناصر الافتراضية (Virtual Items)
  const generateVirtualItemsTable = (items: any[]): string => {
    return `
      <div class="items-section">
        <div class="section-title">بنود الفاتورة</div>
        <table class="items-table">
          <thead>
            <tr>
              <th style="width: 50%;">البند</th>
              <th style="width: 20%;">الكمية</th>
              <th style="width: 30%;">المبلغ</th>
            </tr>
          </thead>
          <tbody>
            ${items.map((item: any) => `
              <tr>
                <td style="text-align: right; padding: 12px;">
                  <strong>${item.description}</strong>
                  <br><span style="font-size: 9px; color: #666;">${item.description_en}</span>
                </td>
                <td style="text-align: center;"><strong>${item.quantity}</strong></td>
                <td style="text-align: center;"><strong>${Number(item.total).toLocaleString('ar-LY')} د.ل</strong></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div style="margin-top: 10px; padding: 8px; background: #fff3cd; border: 1px solid #ffc107; border-radius: 4px; font-size: 9px; color: #856404;">
 ️ هذه الفاتورة تم إنشاؤها من بيانات التكاليف الإجمالية. للحصول على تفاصيل اللوحات، يرجى مراجعة المهمة المجمّعة.
        </div>
      </div>
    `;
  };

  // تحديد الأعمدة المتوفرة (لإخفاء الفارغة)
  const hasPrintCost = (task.customer_print_cost || 0) > 0;
  const hasInstallationCost = (task.customer_installation_cost || 0) > 0;
  const derivedCutoutCost = details.customerCutoutTotal || ((details.customerCutoutUnitPrice || 0) * (details.totalCutouts || 0));
  const hasCutoutCost = (task.customer_cutout_cost || 0) > 0 || derivedCutoutCost > 0;
  const hasAnyCutouts = invoiceItems.some((item: any) => getItemCutoutQuantity(item, details) > 0) || (details.totalCutouts || 0) > 0;

  // دالة إنشاء جدول العناصر
  const generateItemsTable = (items: any[], isInstallOnly: boolean, showDetails: boolean = true) => {
    // ✅ التحقق من العناصر الافتراضية أولاً
    if (items.length > 0 && items[0]?.type === 'virtual') {
      return generateVirtualItemsTable(items);
    }
    
    const sectionTitle = isInstallOnly ? 'تفاصيل التركيب' : 'تفاصيل الطباعة والمجسمات';
    
    let headerColumns = '';
    let rowIndex = 1;
    
    if (isInstallOnly) {
      // ✅ تحديث أعمدة التركيب لإضافة صورة اللوحة وأقرب نقطة دالة
      headerColumns = `
        <th style="width: 25px;">#</th>
        <th style="width: 55px;">صورة اللوحة</th>
        <th style="width: 70px;">التصاميم</th>
        <th style="width: 100px;">اللوحة</th>
        <th style="width: 90px;">أقرب نقطة دالة</th>
        <th style="width: 55px;">المقاس</th>
        <th style="width: 70px;">تكلفة التركيب</th>
      `;
    } else if (showDetails) {
      headerColumns = `
        <th style="width: 25px;">#</th>
        <th style="width: 55px;">صورة اللوحة</th>
        <th style="width: 70px;">التصاميم</th>
        <th style="width: 90px;">أقرب نقطة دالة</th>
        <th style="width: 55px;">المقاس</th>
        <th style="width: 35px;">الكمية</th>
        <th style="width: 50px;">المساحة</th>
        ${hasPrintCost ? `<th style="width: 60px;">الطباعة<br><span style="font-size:6px;">(${pricePerMeter.toFixed(2)} د.ل/م²)</span></th>` : ''}
        ${hasAnyCutouts ? `<th style="width: 40px;">المجسمات</th>` : ''}
        ${hasCutoutCost && hasAnyCutouts ? `<th style="width: 55px;">تكلفة القص</th>` : ''}
        <th style="width: 65px;">الإجمالي</th>
      `;
    } else {
      headerColumns = `
        <th style="width: 25px;">#</th>
        <th style="width: 55px;">صورة اللوحة</th>
        <th style="width: 70px;">التصاميم</th>
        <th style="width: 90px;">أقرب نقطة دالة</th>
        <th style="width: 60px;">المقاس</th>
        <th style="width: 40px;">الكمية</th>
        <th style="width: 55px;">المساحة</th>
        <th style="width: 80px;">الإجمالي</th>
      `;
    }
    
    let rows = '';
    
    if (isInstallOnly) {
      // ✅ للتركيب: تجميع اللوحات ذات الوجهين مع نفس الصورة والإحداثيات
      const groupedItems = groupSimilarItems(items, isInstallOnly);
      
      rows = groupedItems.map((group: any, idx: number) => {
        // حساب إجمالي تكلفة التركيب للمجموعة - التكلفة الفعلية لكل عنصر
        const isTaskReinstall = (task as any)?.task_type === 'reinstallation';
        const totalInstallCost = group.items.reduce((sum: number, item: any) => {
          const isReinstalled = isTaskReinstall && (item.reinstall_count || 0) > 0;
          const itemCost = isReinstalled
            ? (Number(item.customer_reinstall_cost) || Number(item.customer_installation_cost) || 0)
            : (item.customer_installation_cost || installationCostPerItem);
          return sum + itemCost;
        }, 0);
        
        // عرض التصاميم المختلفة
        const designsHTML = group.designs.length > 0 
          ? group.designs.map((d: any) => `
              <div style="margin-bottom: 3px; position: relative;">
                <img src="${d.image}" style="width: 100%; height: 45px; object-fit: contain; display: block; border: 1px solid #ddd; border-radius: 3px;" onerror="this.style.display='none'" />
                <span style="position: absolute; bottom: 1px; right: 1px; background: rgba(0,0,0,0.6); color: white; font-size: 6px; padding: 1px 3px; border-radius: 2px;">${d.face}</span>
              </div>
            `).join('')
          : '<div style="text-align: center; color: #999; font-size: 8px;">-</div>';
        
        // أسماء اللوحات
        const billboardNamesStr = group.billboardNames.length > 0 
          ? group.billboardNames.slice(0, 2).join('، ') + (group.billboardNames.length > 2 ? ` +${group.billboardNames.length - 2}` : '')
          : 'لوحة';
        
        return `
          <tr>
            <td style="text-align: center; font-weight: bold; vertical-align: middle;">${idx + 1}</td>
            <td style="padding: 3px; vertical-align: middle;">
              ${group.billboardImage 
                ? `<img src="${group.billboardImage}" style="width: 100%; height: 55px; object-fit: cover; display: block; border-radius: 4px;" onerror="this.style.display='none'" />`
                : '<div style="text-align: center; color: #999; font-size: 8px;">بدون صورة</div>'}
            </td>
            <td style="padding: 3px; vertical-align: top;">${designsHTML}</td>
            <td style="vertical-align: middle;">
              <strong style="font-size: 10px;">${billboardNamesStr}</strong>
            </td>
            <td style="vertical-align: middle; font-size: 8px; line-height: 1.3;">
              ${group.nearestLandmark 
                ? `<div style="color: #374151;">${group.nearestLandmark.substring(0, 50)}${group.nearestLandmark.length > 50 ? '...' : ''}</div>`
                : '<span style="color: #999;">-</span>'}
            </td>
            <td style="vertical-align: middle;">
              <div style="font-weight: bold; font-size: 10px;">${group.sizeKey === 'مجسم' ? 'مجسم' : `${group.displayWidth}×${group.displayHeight}`}</div>
              <div style="font-size: 7px; color: #666;">${group.totalCutouts > 0 ? 'مجسم' : 'متر'}</div>
            </td>
            <td style="vertical-align: middle;" class="cost-value">
              <strong style="font-size: 11px;">${Number(totalInstallCost).toLocaleString('ar-LY')}</strong>
              <div style="font-size: 7px; color: #666;">د.ل</div>
            </td>
          </tr>
        `;
      }).join('');
    } else {
      // ✅ للطباعة: تجميع العناصر مع إضافة الأعمدة الجديدة
      const groupedItems = groupSimilarItems(items, isInstallOnly);
      
      rows = groupedItems.map((group: any, idx: number) => {
        const printCost = group.totalArea * pricePerMeter;
        const cutoutCostForGroup = calculateCutoutCostForItems(group.items, cutoutPricePerUnit, details);
        const itemTotal = printCost + cutoutCostForGroup;
        
        // عرض التصاميم المختلفة
        const designsHTML = group.designs.length > 0 
          ? group.designs.map((d: any) => `
              <div style="margin-bottom: 3px; position: relative;">
                <img src="${d.image}" style="width: 100%; height: 40px; object-fit: contain; display: block; border: 1px solid #ddd; border-radius: 3px;" onerror="this.style.display='none'" />
                <span style="position: absolute; bottom: 1px; right: 1px; background: rgba(0,0,0,0.6); color: white; font-size: 6px; padding: 1px 3px; border-radius: 2px;">${d.face}</span>
              </div>
            `).join('')
          : '<div style="text-align: center; color: #999; font-size: 8px;">-</div>';
        
        if (showDetails) {
          return `
            <tr>
              <td style="text-align: center; font-weight: bold; vertical-align: middle;">${idx + 1}</td>
              <td style="padding: 3px; vertical-align: middle;">
                ${group.billboardImage 
                  ? `<img src="${group.billboardImage}" style="width: 100%; height: 50px; object-fit: cover; display: block; border-radius: 4px;" onerror="this.style.display='none'" />`
                  : '<div style="text-align: center; color: #999; font-size: 8px;">-</div>'}
              </td>
              <td style="padding: 3px; vertical-align: top;">${designsHTML}</td>
              <td style="vertical-align: middle; font-size: 8px; line-height: 1.3;">
                ${group.nearestLandmark 
                  ? `<div style="color: #374151;">${group.nearestLandmark.substring(0, 40)}${group.nearestLandmark.length > 40 ? '...' : ''}</div>`
                  : '<span style="color: #999;">-</span>'}
              </td>
              <td style="vertical-align: middle;">
                <div style="font-weight: bold; font-size: 10px;">${group.sizeKey === 'مجسم' ? 'مجسم' : `${group.displayWidth}×${group.displayHeight}`}</div>
                <div style="font-size: 7px; color: #666;">${group.totalCutouts > 0 ? 'مجسم' : 'متر'}</div>
              </td>
              <td style="vertical-align: middle;"><strong>×${group.totalQuantity}</strong></td>
              <td style="vertical-align: middle; font-size: 9px;">${group.totalArea.toFixed(1)} م²</td>
              ${hasPrintCost ? `<td style="vertical-align: middle;"><strong style="font-size: 9px;">${printCost.toFixed(0)} د.ل</strong></td>` : ''}
              ${hasAnyCutouts ? `
              <td style="vertical-align: middle;">
                ${group.totalCutouts > 0 
                  ? '<div class="cutout-badge">×' + group.totalCutouts + '</div>' 
                  : '<span class="no-cutout">-</span>'}
              </td>
              ` : ''}
              ${hasCutoutCost && hasAnyCutouts ? `
              <td style="vertical-align: middle;">
                ${group.totalCutouts > 0 
                  ? '<strong style="font-size: 9px;">' + cutoutCostForGroup.toFixed(0) + ' د.ل</strong>' 
                  : '<span class="no-cutout">-</span>'}
              </td>
              ` : ''}
              <td style="vertical-align: middle;" class="cost-value">
                <strong style="font-size: 10px;">${itemTotal.toFixed(0)}</strong>
                <div style="font-size: 7px; color: #666;">د.ل</div>
              </td>
            </tr>
          `;
        } else {
          // عرض مبسط مع الأعمدة الجديدة
          return `
            <tr>
              <td style="text-align: center; font-weight: bold; vertical-align: middle;">${idx + 1}</td>
              <td style="padding: 3px; vertical-align: middle;">
                ${group.billboardImage 
                  ? `<img src="${group.billboardImage}" style="width: 100%; height: 50px; object-fit: cover; display: block; border-radius: 4px;" onerror="this.style.display='none'" />`
                  : '<div style="text-align: center; color: #999; font-size: 8px;">-</div>'}
              </td>
              <td style="padding: 3px; vertical-align: top;">${designsHTML}</td>
              <td style="vertical-align: middle; font-size: 8px; line-height: 1.3;">
                ${group.nearestLandmark 
                  ? `<div style="color: #374151;">${group.nearestLandmark.substring(0, 40)}${group.nearestLandmark.length > 40 ? '...' : ''}</div>`
                  : '<span style="color: #999;">-</span>'}
              </td>
              <td style="vertical-align: middle;">
                <div style="font-weight: bold; font-size: 10px;">${group.sizeKey === 'مجسم' ? 'مجسم' : `${group.displayWidth}×${group.displayHeight}`}</div>
                <div style="font-size: 7px; color: #666;">${group.totalCutouts > 0 ? 'مجسم' : 'متر'}</div>
              </td>
              <td style="vertical-align: middle;"><strong>×${group.totalQuantity}</strong></td>
              <td style="vertical-align: middle; font-size: 9px;">${group.totalArea.toFixed(1)} م²</td>
              <td style="vertical-align: middle;" class="cost-value">
                <strong style="font-size: 10px;">${itemTotal.toFixed(0)}</strong>
                <div style="font-size: 7px; color: #666;">د.ل</div>
              </td>
            </tr>
          `;
        }
      }).join('');
    }
    
    return `
      <div class="items-section">
        <div class="section-title">${sectionTitle}</div>
        <table class="items-table">
          <thead>
            <tr>${headerColumns}</tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
    `;
  };

  // تقسيم العناصر إلى صفحات
  // كل صف في الجدول يأخذ حوالي 50px (13mm)
  // ارتفاع المحتوى المتاح في الصفحة: حوالي 200mm (بعد طرح الترويسة والهوامش)
  // قسم التكاليف يأخذ حوالي 120px (32mm)
  // إذاً يمكننا وضع حوالي 12-13 صف في الصفحة الأولى
  // وحوالي 15 صف في الصفحات التالية
  // ولكن الصفحة الأخيرة يجب أن تحتوي على عنصر واحد على الأقل مع قسم التكاليف
  
  const ITEMS_PER_FIRST_PAGE = 18;
  const ITEMS_PER_PAGE = 20;
  const MIN_ITEMS_ON_LAST_PAGE = 3;

  const pages: any[][] = [];
  let currentPage: any[] = [];

  invoiceItems.forEach((item: any, index: number) => {
    // حساب الحد الأقصى للعناصر في الصفحة الحالية
    // الصفحة الأولى لها حد أقصى مختلف
    const isFirstPage = pages.length === 0;
    const maxItems = isFirstPage ? ITEMS_PER_FIRST_PAGE : ITEMS_PER_PAGE;
    
    // عدد العناصر المتبقية
    const remainingItems = invoiceItems.length - index;
    
    // إذا وصلنا للحد الأقصى ولا يزال هناك عناصر كافية
    if (currentPage.length >= maxItems && remainingItems > MIN_ITEMS_ON_LAST_PAGE) {
      pages.push([...currentPage]);
      currentPage = [];
    }
    
    currentPage.push(item);
  });

  // إضافة الصفحة الأخيرة
  if (currentPage.length > 0) {
    pages.push(currentPage);
  }

  // إذا لم تكن هناك عناصر، نضيف صفحة فارغة
  if (pages.length === 0) {
    pages.push([]);
  }

  const totalPages = pages.length;

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>فاتورة مجمعة - ${task.customer_name}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Noto+Sans+Arabic:wght@400;700&display=swap');
    
    * { margin: 0; padding: 0; box-sizing: border-box; }
    
    html, body {
      font-family: '${mergedStyles?.fontFamily || 'Doran'}', 'Noto Sans Arabic', Arial, sans-serif;
      direction: rtl;
      text-align: right;
      background: white;
      color: #000;
      font-size: ${styles?.bodyFontSize || 10}px;
      line-height: 1.3;
    }
    
    @page { size: A4 portrait; margin: 10mm; }
    
    .page { width: 190mm; min-height: 277mm; padding: 0; page-break-after: always; position: relative; }
    .page:last-child { page-break-after: avoid; }
    
    .page-header {
      /* يتم التحكم فيه من خلال unifiedHeaderFooterCss */
    }
    
    ${unifiedHeaderFooterCss({
      primaryColor: pc,
      secondaryColor: mergedStyles?.secondaryColor || '#1a1a2e',
      logoSize: styles?.logoSize || 200,
      headerFontSize: styles?.headerFontSize || 14,
      headerMarginBottom: mergedStyles?.headerMarginBottom || 15,
      footerTextColor: mergedStyles?.footerTextColor || '#666',
      footerText: mergedStyles?.footerText || footerText,
      showFooter: mergedStyles?.showFooter !== false,
      showPageNumber: mergedStyles?.showPageNumber !== false,
      contactInfoFontSize: mergedStyles?.contactInfoFontSize || 10,
      fontFamily: mergedStyles?.fontFamily,
      headerSwap: mergedStyles?.headerSwap ?? false,
      footerAlignment: mergedStyles?.footerAlignment,
      footerBgColor: mergedStyles?.footerBgColor,
      footerPosition: mergedStyles?.footerPosition,
      headerBgColor: mergedStyles?.headerBgColor,
      headerTextColor: mergedStyles?.headerTextColor,
      headerStyle: mergedStyles?.headerStyle,
      invoiceTitleArFontSize: mergedStyles?.invoiceTitleArFontSize,
      invoiceTitleEnFontSize: mergedStyles?.invoiceTitleEnFontSize,
      logoContainerWidth: mergedStyles?.logoContainerWidth,
      titleContainerWidth: mergedStyles?.titleContainerWidth,
    })}

    .customer-section {
      background: ${custBg}; padding: 12px; border-radius: 6px;
      margin-bottom: 15px; border: 2px solid ${custBorder};
    }

    .section-title {
      font-size: 14px; font-weight: bold; color: ${thColor};
      margin-bottom: 10px; text-align: center; background: ${thBg};
      padding: 6px; border-radius: 4px;
    }

    .info-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; }
    .info-box { background: white; padding: 6px; border-radius: 4px; border: 1px solid #ddd; }
    .info-label { font-size: 9px; color: #666; font-weight: bold; margin-bottom: 3px; }
    .info-value { font-size: 11px; color: #000; font-weight: bold; }

    .items-section { margin-bottom: 15px; }
    .items-table { width: 100%; border-collapse: collapse; font-size: 9px; }
    .items-table th {
      background: ${thBg}; color: ${thColor}; font-weight: bold;
      padding: 6px 4px; text-align: center; border: 1px solid ${thBg}; font-size: 9px;
    }
    .items-table td { padding: 5px 3px; border: 1px solid ${tBorder}; text-align: center; vertical-align: middle; }
    .items-table tbody tr:nth-child(even) { background: ${rowEven}; }

    .design-image { max-width: 40px; max-height: 40px; object-fit: contain; margin: 0 auto; display: block; border: 1px solid ${tBorder}; border-radius: 3px; }
    .cutout-badge { display: inline-block; background: ${rowEven}; color: ${pc}; padding: 1px 4px; border-radius: 3px; font-size: 8px; font-weight: bold; margin-top: 2px; }
    .no-cutout { color: #999; font-size: 8px; }

    .cost-section { background: ${rowEven}; padding: 8px; border-radius: 6px; margin-bottom: 10px; border: 2px solid ${tBorder}; }
    .cost-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 6px; margin-bottom: 8px; }
    .cost-item { background: white; padding: 6px; border-radius: 4px; border: 1px solid ${tBorder}; text-align: center; }
    .cost-label { font-size: 8px; color: ${pc}; margin-bottom: 2px; }
    .cost-value { font-size: 12px; font-weight: bold; color: ${pc}; }

    .total-section { background: ${totalBg}; color: ${totalColor}; padding: 8px; text-align: center; border-radius: 6px; font-size: 16px; font-weight: bold; }

    /* page-footer now handled by unifiedFooterHtml */
    .content-wrapper { padding-bottom: 50px; min-height: calc(277mm - 60px); }

    @media print {
      html, body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
      .page { page-break-after: always; page-break-inside: avoid; }
      .items-table { page-break-inside: auto; }
      .items-table tr { page-break-inside: avoid; }
      .cost-section, .total-section { page-break-inside: avoid; }
    }
  </style>
</head>
<body>
  ${pages.map((pageItems: any[], pageIndex: number) => `
  <div class="page">
    <div class="content-wrapper">
      ${unifiedHeaderHtml({
        styles: {
          primaryColor: pc,
          secondaryColor: mergedStyles?.secondaryColor || '#1a1a2e',
          logoSize: styles?.logoSize || 200,
          headerFontSize: styles?.headerFontSize || 14,
          showLogo: mergedStyles?.showLogo !== false,
          showCompanyInfo: mergedStyles?.showCompanyInfo !== false,
          showCompanyName: mergedStyles?.showCompanyName ?? true,
          showCompanySubtitle: mergedStyles?.showCompanySubtitle ?? false,
          showCompanyAddress: mergedStyles?.showCompanyAddress ?? true,
          showCompanyPhone: mergedStyles?.showCompanyPhone ?? true,
          showContactInfo: mergedStyles?.showContactInfo ?? true,
          showTaxId: mergedStyles?.showTaxId ?? false,
          showEmail: mergedStyles?.showEmail ?? false,
          showWebsite: mergedStyles?.showWebsite ?? false,
          headerSwap: mergedStyles?.headerSwap ?? false,
          headerAlignment: mergedStyles?.headerAlignment,
          fontFamily: mergedStyles?.fontFamily,
          companyName: mergedStyles?.companyName || '',
          companySubtitle: mergedStyles?.companySubtitle || '',
          companyAddress: mergedStyles?.companyAddress || '',
          companyPhone: mergedStyles?.companyPhone || '',
          companyTaxId: mergedStyles?.companyTaxId || '',
          companyEmail: mergedStyles?.companyEmail || '',
          companyWebsite: mergedStyles?.companyWebsite || '',
          contactInfoFontSize: mergedStyles?.contactInfoFontSize || 10,
          invoiceTitle: invoiceTitle.ar,
          invoiceTitleEn: invoiceTitle.en,
          headerBgColor: mergedStyles?.headerBgColor,
          headerTextColor: mergedStyles?.headerTextColor,
          headerStyle: mergedStyles?.headerStyle,
          invoiceTitleArFontSize: mergedStyles?.invoiceTitleArFontSize,
          invoiceTitleEnFontSize: mergedStyles?.invoiceTitleEnFontSize,
          logoContainerWidth: mergedStyles?.logoContainerWidth,
          titleContainerWidth: mergedStyles?.titleContainerWidth,
        },
        fullLogoUrl: logoDataUri,
        metaLinesHtml: `
          <div><strong>التاريخ:</strong> ${invoiceDate}</div>
          <div><strong>${details.contractsInfo?.length > 1 ? 'أرقام العقود:' : 'رقم العقد:'}</strong> ${details.contractsInfo?.length > 1 ? details.contractsInfo.map((c: any) => '#' + c.contractId).join(', ') : '#' + task.contract_id}</div>
          <div><strong>نوع المهمة:</strong> ${task.task_type === 'new_installation' ? 'تركيب جديد' : 'إعادة تركيب'}</div>
        `,
        titleAr: invoiceTitle.ar,
        titleEn: invoiceTitle.en,
      })}

      ${pageIndex === 0 ? `
      <div class="customer-section">
        <div class="section-title">معلومات العميل</div>
        <div class="info-grid">
          <div class="info-box">
            <div class="info-label">اسم العميل:</div>
            <div class="info-value">${task.customer_name || 'غير محدد'}</div>
          </div>
          <div class="info-box">
            <div class="info-label">${details.contractsInfo?.length > 1 ? 'أرقام العقود:' : 'رقم العقد:'}</div>
            <div class="info-value">${details.contractsInfo?.length > 1 ? details.contractsInfo.map((c: any) => '#' + c.contractId).join(', ') : '#' + task.contract_id}</div>
          </div>
          <div class="info-box">
            <div class="info-label">تاريخ الفاتورة:</div>
            <div class="info-value">${invoiceDate}</div>
          </div>
        </div>
        ${details.contractsInfo?.length > 0 ? `
        <div style="margin-top: 8px; display: flex; gap: 8px; flex-wrap: wrap;">
          ${details.contractsInfo.map((c: any) => `
            <div style="background: ${rowEven}; padding: 4px 8px; border-radius: 4px; font-size: 10px; border: 1px solid ${tBorder};">
              <strong>#${c.contractId}:</strong> ${c.adType}
            </div>
          `).join('')}
        </div>
        ` : ''}
      </div>
      ` : ''}

      ${pageItems.length > 0 ? (displayMode === 'summary' ? generateSummarySection(task, details, invoiceTitle, pricePerMeter, styles) : generateItemsTable(pageItems, isInstallationOnly, showDetails)) : ''}

      ${pageIndex === totalPages - 1 ? `
      <div class="cost-section">
        ${displayMode === 'detailed' && showDetails ? `
        <div class="section-title">ملخص التكاليف</div>
        <div class="cost-grid">
          ${task.customer_installation_cost > 0 || task.task_type === 'new_installation' ? `
          <div class="cost-item">
            <div class="cost-label">تكلفة التركيب</div>
            <div class="cost-value">
              ${task.customer_installation_cost > 0 ? task.customer_installation_cost.toLocaleString('ar-LY') + ' د.ل' : 'مجاناً'}
            </div>
          </div>
          ` : ''}
          
          ${task.customer_print_cost > 0 ? `
          <div class="cost-item">
            <div class="cost-label">تكلفة الطباعة (${totalArea.toFixed(2)} م² × ${pricePerMeter.toFixed(2)})</div>
            <div class="cost-value">${task.customer_print_cost.toLocaleString('ar-LY')} د.ل</div>
          </div>
          ` : ''}
          
          ${totalCutouts > 0 ? `
          <div class="cost-item">
            <div class="cost-label">تكلفة القص (${totalCutouts} مجسم × ${cutoutPricePerUnit.toFixed(2)} د.ل)</div>
            <div class="cost-value">${(Number(task.customer_cutout_cost) || Number(details.customerCutoutTotal) || 0).toLocaleString('ar-LY')} د.ل</div>
          </div>
          ` : ''}
          
          ${(task.discount_amount || 0) > 0 ? `
          <div class="cost-item" style="border-top: 1px dashed #ccc; padding-top: 8px; margin-top: 8px;">
            <div class="cost-label" style="color: #dc2626;">
              خصم ${task.discount_reason ? '(' + task.discount_reason + ')' : ''}
            </div>
            <div class="cost-value" style="color: #dc2626;">- ${(task.discount_amount || 0).toLocaleString('ar-LY')} د.ل</div>
          </div>
          ` : ''}
        </div>
        ` : displayMode === 'detailed' && totalCutouts > 0 ? `
        <div class="section-title">ملخص التكاليف</div>
        <div class="cost-grid">
          <div class="cost-item">
            <div class="cost-label">تكلفة القص (${totalCutouts} مجسم)</div>
            <div class="cost-value">${(Number(task.customer_cutout_cost) || Number(details.customerCutoutTotal) || 0).toLocaleString('ar-LY')} د.ل</div>
          </div>
        </div>
        ` : ''}
        
        <div class="total-section">
          الإجمالي المطلوب: ${effectiveCustomerTotal.toLocaleString('ar-LY')} دينار ليبي
        </div>
      </div>
      ` : ''}
    </div>

    ${unifiedFooterHtml(
      {
        primaryColor: pc,
        footerText: mergedStyles?.footerText || footerText,
        footerTextColor: mergedStyles?.footerTextColor || '#666',
        footerBgColor: mergedStyles?.footerBgColor,
        footerAlignment: mergedStyles?.footerAlignment,
        footerPosition: mergedStyles?.footerPosition,
        showFooter: mergedStyles?.showFooter !== false,
        showPageNumber: mergedStyles?.showPageNumber !== false,
      },
      ''
    )}
  </div>
  `).join('')}
</body>
</html>
  `;
}
