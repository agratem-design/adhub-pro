import { useState, useMemo, useEffect } from 'react';
import { getDSFallbackScript } from '@/utils/printDSFallbackScript';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Printer, FileDown, Users, Check, FileText, Settings2, Table2, Layers, MessageCircle } from 'lucide-react';
import QRCode from 'qrcode';
import { supabase } from '@/integrations/supabase/client';
import { BackgroundSelector } from '@/components/billboard-print/BackgroundSelector';
import { PrintCustomizationDialog } from '@/components/print-customization';
import { usePrintCustomization, PrintCustomizationSettings } from '@/hooks/usePrintCustomization';
import { useTablePrintSettings } from '@/hooks/useTablePrintSettings';
import { TablePrintSettingsDialog } from './TablePrintSettingsDialog';
import { normalizeGoogleImageUrl } from '@/utils/imageUtils';
import { memoryCache } from '@/utils/imageResolver';
import { htmlToPdfBlob, htmlToPdfBlobOptimized } from '@/utils/pdfHelpers';
import { preparePrintWindow, writePrintWindow } from '@/utils/printWindowHelper';

interface PrintAllContractBillboardsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contractNumber: number;
  customerName: string;
  allTaskItems: any[];
  tasks: any[];
  billboards: Record<number, any>;
  teams: Record<string, any>;
  designsByTask: Record<string, any[]>;
  taskId?: string;
  customerPhone?: string;
}

export function PrintAllContractBillboardsDialog({
  open,
  onOpenChange,
  contractNumber,
  customerName,
  allTaskItems,
  tasks,
  billboards,
  teams,
  designsByTask,
  taskId,
  customerPhone
}: PrintAllContractBillboardsDialogProps) {
  const [printScope, setPrintScope] = useState<'task' | 'contract'>(taskId ? 'task' : 'contract');
  const [includeDesigns, setIncludeDesigns] = useState(true);
  const [showDesignName, setShowDesignName] = useState(false);
  const [showInstallationDate, setShowInstallationDate] = useState(false);
  const [showInstalledImages, setShowInstalledImages] = useState(true);
  const [printType, setPrintType] = useState<'client' | 'installation'>('client');
  const [printMode, setPrintMode] = useState<'cards' | 'table'>('cards');
  const [loading, setLoading] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [adType, setAdType] = useState('');
  const [contractAdTypes, setContractAdTypes] = useState<Record<number, string>>({});
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState('/ipg.svg');
  const [customizationDialogOpen, setCustomizationDialogOpen] = useState(false);
  const [tableSettingsDialogOpen, setTableSettingsDialogOpen] = useState(false);
  const [printCityInsteadOfMunicipality, setPrintCityInsteadOfMunicipality] = useState(false);
  
  // جلب إعدادات التخصيص من قاعدة البيانات
  const { settings: customSettings, loading: settingsLoading } = usePrintCustomization();
  const { 
    settings: tableSettings, 
    loading: tableSettingsLoading,
    updateSetting: updateTableSetting,
    saveSettings: saveTableSettings,
    resetToDefaults: resetTableSettings,
    saving: savingTableSettings
  } = useTablePrintSettings();

  const normalizePrintUrl = (url?: string | null) => {
    if (!url) return '';
    const cached = memoryCache.get(url);
    if (cached) return cached;
    return normalizeGoogleImageUrl(url);
  };

  const stripScriptsForPdf = (html: string) => html.replace(/<script[\s\S]*?<\/script>/gi, '');

  const waitForRenderableAssets = async (doc: Document) => {
    const images = Array.from(doc.getElementsByTagName('img'));

    images.forEach((img) => {
      const rawSrc = img.getAttribute('src');
      if (!rawSrc) return;
      const normalizedSrc = normalizePrintUrl(rawSrc);
      if (normalizedSrc && normalizedSrc !== rawSrc) {
        img.setAttribute('src', normalizedSrc);
      }
    });

    try {
      await (doc as any).fonts?.ready;
    } catch {
      // تجاهل فشل تحميل الخطوط الإضافية
    }

    await Promise.all(
      images.map((img) => {
        if (img.complete && img.naturalWidth > 0) return Promise.resolve();

        return new Promise<void>((resolve) => {
          let settled = false;
          const done = () => {
            if (settled) return;
            settled = true;
            resolve();
          };

          img.onload = done;
          img.onerror = done;
          setTimeout(done, 7000);
        });
      })
    );

    await new Promise((resolve) => setTimeout(resolve, 400));
  };

  const blobToBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve((reader.result as string).split(',')[1] || '');
      reader.onerror = () => reject(new Error('فشل قراءة ملف PDF'));
      reader.readAsDataURL(blob);
    });

  const openPendingWindow = (title: string, message: string) => {
    const pendingWindow = window.open('', '_blank');
    if (!pendingWindow) return null;

    pendingWindow.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8" /><title>${title}</title></head><body style="font-family:Arial,sans-serif;padding:24px;direction:rtl;background:#fff;">${message}</body></html>`);
    pendingWindow.document.close();
    return pendingWindow;
  };

  const writeHtmlToWindow = (targetWindow: Window | null, html: string, title: string) => {
    if (!targetWindow || targetWindow.closed) return;
    targetWindow.document.open();
    targetWindow.document.write(html.replace(/<title>[\s\S]*?<\/title>/i, `<title>${title}</title>`));
    targetWindow.document.close();
  };

  // جمع كل اللوحات من جميع الفرق للعقد المحدد أو جميع المهام الممررة مباشرة
  const contractTasks = useMemo(() => {
    // إذا كان النطاق "هذه المهمة فقط" وتم تمرير taskId
    // نعرض جميع الفرق لنفس العقد ونفس نوع المهمة ونفس رقم إعادة التركيب
    if (printScope === 'task' && taskId) {
      const currentTask = tasks.find(t => t.id === taskId);
      if (currentTask) {
        const currentType = currentTask.task_type || 'installation';
        const currentReinstallNum = currentTask.reinstallation_number ?? null;
        // جلب كل المهام لنفس العقد ونفس النوع ونفس رقم إعادة التركيب (كل الفرق)
        return tasks.filter(t => {
          if (t.contract_id !== currentTask.contract_id) return false;
          if ((t.task_type || 'installation') !== currentType) return false;
          // لإعادة التركيب: تجميع حسب reinstallation_number
          if (currentType === 'reinstallation') {
            return (t.reinstallation_number ?? null) === currentReinstallNum;
          }
          return true;
        });
      }
      return tasks.filter(t => t.id === taskId);
    }
    // إذا كانت المهام ممررة مباشرة (من تحديد متعدد)، استخدمها مباشرة
    if (tasks.length > 0 && allTaskItems.length > 0) {
      const taskIds = new Set(tasks.map(t => t.id));
      const hasMatchingItems = allTaskItems.some(item => taskIds.has(item.task_id));
      if (hasMatchingItems) {
        return tasks;
      }
    }
    // الفلترة التقليدية حسب رقم العقد
    return tasks.filter(t => t.contract_id === contractNumber || (t.contract_ids && t.contract_ids.includes(contractNumber)));
  }, [tasks, contractNumber, allTaskItems, printScope, taskId]);

  const allContractItems = useMemo(() => {
    const taskIds = new Set(contractTasks.map(t => t.id));
    return allTaskItems.filter(item => taskIds.has(item.task_id));
  }, [allTaskItems, contractTasks]);

  // دالة مساعدة: حل بيانات التصميم بشكل ذكي عبر جميع مهام العقد
  const resolveDesignDetails = (item: any) => {
    let designFaceA = undefined;
    let designFaceB = undefined;
    let designName = '';

    // محاولة جلب العنصر الشقيق للوحة إذا كان العنصر الحالي لا يحتوي على تصميم
    let targetItem = item;
    if (!item.selected_design_id && (!item.design_face_a || item.design_face_a === billboards[item.billboard_id]?.design_face_a)) {
      const itemTask = tasks.find(t => t.id === item.task_id);
      if (itemTask) {
        const currentType = itemTask.task_type || 'installation';
        const currentReinstallNum = itemTask.reinstallation_number ?? null;
        
        const siblingItem = allTaskItems.find(i => {
          if (i.billboard_id !== item.billboard_id || i.task_id === item.task_id) return false;
          const t = tasks.find(x => x.id === i.task_id);
          if (!t) return false;
          if (t.contract_id !== itemTask.contract_id) return false;
          if ((t.task_type || 'installation') !== currentType) return false;
          if (currentType === 'reinstallation') {
            return (t.reinstallation_number ?? null) === currentReinstallNum;
          }
          return true;
        });
        
        if (siblingItem && siblingItem.selected_design_id) {
          targetItem = siblingItem;
        }
      }
    }

    // 1. تحديد المهمة الحالية والعثور على المهام الشقيقة لها (نفس العقد، نفس النوع، نفس رقم إعادة التركيب)
    const itemTask = tasks.find(t => t.id === targetItem.task_id);
    const siblingTasks = itemTask ? tasks.filter(t => {
      if (t.contract_id !== itemTask.contract_id) return false;
      const tType = t.task_type || 'installation';
      const itemType = itemTask.task_type || 'installation';
      if (tType !== itemType) return false;
      if (itemType === 'reinstallation') {
        return (t.reinstallation_number ?? null) === (itemTask.reinstallation_number ?? null);
      }
      return true;
    }) : [];

    // تصاميم المهمة الحالية والمهام الشقيقة لها (نفس مرحلة التركيب)
    const localDesigns = siblingTasks.flatMap(t => designsByTask[t.id] || []);
    // إزالة التكرار حسب رابط الصورة
    const uniqueLocalDesigns = localDesigns.filter((d: any, i: number, arr: any[]) => 
      arr.findIndex((x: any) => x.design_face_a_url === d.design_face_a_url) === i
    );

    // جميع تصاميم العقد بشكل عام (للفولباك)
    const allContractDesigns = contractTasks.flatMap(t => designsByTask[t.id] || []);
    const uniqueContractDesigns = allContractDesigns.filter((d: any, i: number, arr: any[]) => 
      arr.findIndex((x: any) => x.design_face_a_url === d.design_face_a_url) === i
    );

    let matched = null;

    // أ) محاولة المطابقة بـ selected_design_id في التصاميم المحلية أولاً
    if (targetItem.selected_design_id) {
      matched = uniqueLocalDesigns.find((d: any) => d.id === targetItem.selected_design_id);
      
      // ب) إذا لم يعثر عليه، ابحث في جميع تصاميم العقد
      if (!matched) {
        matched = uniqueContractDesigns.find((d: any) => d.id === targetItem.selected_design_id);
      }
    }

    // ج) محاولة المطابقة بعنوان URL للصورة في التصاميم المحلية
    if (!matched && (targetItem.design_face_a || targetItem.design_face_b)) {
      matched = uniqueLocalDesigns.find((d: any) =>
        (targetItem.design_face_a && d.design_face_a_url === targetItem.design_face_a) ||
        (targetItem.design_face_b && d.design_face_b_url === targetItem.design_face_b)
      );
      
      // د) إذا لم يعثر عليه، ابحث في جميع تصاميم العقد بعنوان URL
      if (!matched) {
        matched = uniqueContractDesigns.find((d: any) =>
          (targetItem.design_face_a && d.design_face_a_url === targetItem.design_face_a) ||
          (targetItem.design_face_b && d.design_face_b_url === targetItem.design_face_b)
        );
      }
    }

    // هـ) الفولباك الذكي:
    // 1. إذا كان هناك تصميم محلي واحد فقط، استخدمه كـ fallback
    if (!matched && uniqueLocalDesigns.length === 1) {
      matched = uniqueLocalDesigns[0];
    }
    // 2. إذا لم يكن هناك أي تصميم محلي ولكن يوجد تصميم عقد واحد فقط، استخدمه كـ fallback
    if (!matched && uniqueLocalDesigns.length === 0 && uniqueContractDesigns.length === 1) {
      matched = uniqueContractDesigns[0];
    }

    if (matched) {
      designName = matched.design_name || '';
      designFaceA = matched.design_face_a_url;
      designFaceB = matched.design_face_b_url;
    } else {
      designFaceA = targetItem.design_face_a;
      designFaceB = targetItem.design_face_b;
    }

    return { designFaceA, designFaceB, designName };
  };

  // تجميع اللوحات حسب الفريق
  const itemsByTeam = useMemo(() => {
    const groups: Record<string, any[]> = {};
    allContractItems.forEach(item => {
      const task = contractTasks.find(t => t.id === item.task_id);
      const teamId = task?.team_id || 'unknown';
      if (!groups[teamId]) groups[teamId] = [];
      groups[teamId].push(item);
    });
    return groups;
  }, [allContractItems, contractTasks]);

  // متغير لتتبع ما إذا تم تهيئة الفرق المختارة
  const [teamsInitialized, setTeamsInitialized] = useState(false);

  // اختيار كل الفرق عند الفتح فقط (مرة واحدة)
  useEffect(() => {
    if (open && !teamsInitialized && Object.keys(itemsByTeam).length > 0) {
      setSelectedTeamIds(new Set(Object.keys(itemsByTeam)));
      setTeamsInitialized(true);
    }
    if (!open) {
      setTeamsInitialized(false);
      setPrintScope(taskId ? 'task' : 'contract');
    }
  }, [open, teamsInitialized, itemsByTeam]);

  // جلب نوع الإعلان لجميع العقود المرتبطة باللوحات (مهم للمهام المدمجة)
  useEffect(() => {
    if (open) {
      setAdType('');
      setContractAdTypes({});
      setLoading(false);
      
      const fetchContractData = async () => {
        try {
          // جمع كل أرقام العقود الفريدة من اللوحات
          const allContractNumbers = new Set<number>();
          allContractNumbers.add(contractNumber);
          allTaskItems.forEach(item => {
            const billboard = billboards[item.billboard_id];
            if (billboard?.Contract_Number) {
              allContractNumbers.add(billboard.Contract_Number);
            }
          });
          // أيضاً من المهام نفسها
          tasks.forEach(t => {
            if (t.contract_id) allContractNumbers.add(t.contract_id);
            if (t.contract_ids) t.contract_ids.forEach((id: number) => allContractNumbers.add(id));
          });

          const contractNums = Array.from(allContractNumbers);
          const { data: contractsData } = await supabase
            .from('Contract')
            .select('Contract_Number, "Ad Type"')
            .in('Contract_Number', contractNums);
          
          const adTypesMap: Record<number, string> = {};
          (contractsData || []).forEach((c: any) => {
            adTypesMap[c.Contract_Number] = c['Ad Type'] || '';
          });
          
          setContractAdTypes(adTypesMap);
          setAdType(adTypesMap[contractNumber] || 'لوحة إعلانية');
        } catch (error) {
          console.error('Error fetching contract data:', error);
        }
      };
      
      fetchContractData();
    }
  }, [open, contractNumber, allTaskItems, billboards, tasks]);

  // اللوحات المفلترة حسب الفرق المختارة
  const contractItems = useMemo(() => {
    if (selectedTeamIds.size === 0) return [];
    return allContractItems.filter(item => {
      const task = contractTasks.find(t => t.id === item.task_id);
      const teamId = task?.team_id || 'unknown';
      return selectedTeamIds.has(teamId);
    });
  }, [allContractItems, contractTasks, selectedTeamIds]);

  const taskById = useMemo(() => {
    const map: Record<string, any> = {};
    contractTasks.forEach(task => {
      map[task.id] = task;
    });
    return map;
  }, [contractTasks]);

  const resolveItemContractNumber = (item: any) => {
    const billboardContractNumber = Number(billboards[item.billboard_id]?.Contract_Number);
    if (Number.isFinite(billboardContractNumber) && billboardContractNumber > 0) {
      return billboardContractNumber;
    }

    const itemTask = taskById[item.task_id];
    if (itemTask?.contract_id) {
      return itemTask.contract_id;
    }

    return contractNumber;
  };

  const resolveItemAdType = (item: any, itemContractNumber?: number) => {
    const resolvedContractNumber = itemContractNumber || resolveItemContractNumber(item);
    return contractAdTypes[resolvedContractNumber] || adType || '';
  };

  const summaryItems = contractItems.length > 0 ? contractItems : allContractItems;

  const resolvedContractNumbers = useMemo(() => {
    const numbers = new Set<number>();

    summaryItems.forEach(item => {
      const billboardContractNumber = Number(billboards[item.billboard_id]?.Contract_Number);
      if (Number.isFinite(billboardContractNumber) && billboardContractNumber > 0) {
        numbers.add(billboardContractNumber);
        return;
      }

      const itemTask = taskById[item.task_id];
      if (itemTask?.contract_id) {
        numbers.add(itemTask.contract_id);
      }
    });

    if (!numbers.size && contractNumber) {
      numbers.add(contractNumber);
    }

    return Array.from(numbers).sort((a, b) => a - b);
  }, [summaryItems, billboards, taskById, contractNumber]);

  const resolvedAdTypes = useMemo(() => {
    const types = resolvedContractNumbers
      .map(num => contractAdTypes[num])
      .filter(Boolean);

    if (!types.length && adType) {
      return [adType];
    }

    return Array.from(new Set(types));
  }, [resolvedContractNumbers, contractAdTypes, adType]);

  const contractSummaryLabel = resolvedContractNumbers.length > 1
    ? `العقود: ${resolvedContractNumbers.map(num => `#${num}`).join('، ')}`
    : `عقد #${resolvedContractNumbers[0] || contractNumber}`;

  const adTypeSummaryLabel = resolvedAdTypes.length > 1
    ? 'أنواع إعلانات متعددة'
    : (resolvedAdTypes[0] || '');

  const toggleTeam = (teamId: string) => {
    setSelectedTeamIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(teamId)) {
        newSet.delete(teamId);
      } else {
        newSet.add(teamId);
      }
      return newSet;
    });
  };

  const selectAllTeams = () => {
    setSelectedTeamIds(new Set(Object.keys(itemsByTeam)));
  };

  const clearTeamSelection = () => {
    setSelectedTeamIds(new Set());
  };

  // ترتيب اللوحات حسب المقاس ثم البلدية ثم المستوى (متماثل مع ContractPDFDialog)
  const sortBillboardsBySize = async (items: any[]) => {
    try {
      // جلب بيانات الترتيب من جميع الجداول
      const [sizesRes, municipalitiesRes, levelsRes] = await Promise.all([
        supabase.from('sizes').select('name, sort_order').order('sort_order', { ascending: true }),
        supabase.from('municipalities').select('name, sort_order').order('sort_order', { ascending: true }),
        supabase.from('billboard_levels').select('level_code, sort_order').order('sort_order', { ascending: true })
      ]);
      
      const sizesData = sizesRes.data || [];
      const municipalitiesData = municipalitiesRes.data || [];
      const levelsData = levelsRes.data || [];
      
      // ربط كل لوحة ببيانات الترتيب (نفس منطق ContractPDFDialog)
      const itemsWithSortRanks = items.map((item) => {
        const billboard = billboards[item.billboard_id];
        const sizeObj = sizesData.find(sz => sz.name === billboard?.Size);
        const municipalityObj = municipalitiesData.find(m => m.name === billboard?.Municipality);
        const levelObj = levelsData.find(l => l.level_code === billboard?.Level);
        return {
          ...item,
          size_order: sizeObj?.sort_order ?? 999,
          municipality_order: municipalityObj?.sort_order ?? 999,
          level_order: levelObj?.sort_order ?? 999,
        };
      });
      
      // ترتيب اللوحات: المقاس أولاً، ثم البلدية، ثم المستوى
      return itemsWithSortRanks.sort((a, b) => {
        if (a.size_order !== b.size_order) return a.size_order - b.size_order;
        if (a.municipality_order !== b.municipality_order) return a.municipality_order - b.municipality_order;
        return a.level_order - b.level_order;
      });
    } catch (e) {
      console.error('Error sorting billboards:', e);
      return items;
    }
  };

  const generatePrintHTML = async () => {
    const sortedItems = await sortBillboardsBySize(contractItems);
    const pages: string[] = [];
    const normalizedBackgroundUrl = normalizePrintUrl(customBackgroundUrl) || '/ipg.svg';
    const toMmOffset = (value?: string) => {
      const parsed = parseFloat(String(value ?? '0').replace(/[^0-9.-]/g, ''));
      return Number.isFinite(parsed) && parsed !== 0 ? `${parsed}mm` : '0mm';
    };
    const toCssLength = (value?: string) => {
      const raw = String(value ?? '').trim();
      if (!raw) return '0mm';
      if (/^-?\d+(\.\d+)?$/.test(raw)) return `${raw}mm`;
      return raw;
    };

    for (const item of sortedItems) {
      const billboard = billboards[item.billboard_id];
      if (!billboard) continue;

      // الحصول على التصميم - بحث شامل عبر جميع مهام العقد
      const { designFaceA: _dfa, designFaceB: _dfb, designName } = resolveDesignDetails(item);
      let designFaceA = _dfa;
      let designFaceB = _dfb;

      // صور التركيب
      const installedImageFaceA = normalizePrintUrl(item.installed_image_face_a_url);
      const installedImageFaceB = normalizePrintUrl(item.installed_image_face_b_url);

      designFaceA = normalizePrintUrl(designFaceA);
      designFaceB = normalizePrintUrl(designFaceB);

      // منطق اختيار الصورة الرئيسية
      const mainImage = installedImageFaceA && !installedImageFaceB 
        ? installedImageFaceA 
        : normalizePrintUrl(billboard.Image_URL || '');

      // إنشاء QR code - حتى لو لا توجد إحداثيات
      let qrCodeDataUrl = '';
      const coords = billboard.GPS_Coordinates || '';
      const mapLink = coords 
        ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` 
        : 'https://www.google.com/maps?q=';
      try {
        qrCodeDataUrl = await QRCode.toDataURL(mapLink, { width: 240, margin: 0 });
      } catch (error) {
        console.error('Error generating QR code:', error);
      }

      

      const name = billboard.Billboard_Name || `لوحة ${item.billboard_id}`;
      const municipality = printCityInsteadOfMunicipality ? (billboard.City || '') : (billboard.Municipality || '');
      const district = billboard.District || '';
      const landmark = billboard.Nearest_Landmark || '';
      const size = billboard.Size || '';
      const facesCount = billboard.Faces_Count || 1;
      const facesToInstall = item.faces_to_install || facesCount;
      
      // Smart face logic: determine which faces are actually relevant
      const isSingleFaceBillboard = facesCount === 1;
      const isSingleFaceInstall = facesToInstall === 1;
      const hasDesignA = !!designFaceA;
      const hasDesignB = !!designFaceB;
      const hasInstalledA = !!installedImageFaceA;
      const hasInstalledB = !!installedImageFaceB;
      
      // Effective: only show face B if billboard has 2+ faces AND install requires 2 faces AND content exists
      const showFaceB = !isSingleFaceBillboard && !isSingleFaceInstall;
      const effectiveDesignA = hasDesignA ? designFaceA : null;
      const effectiveDesignB = showFaceB && hasDesignB ? designFaceB : null;
      const effectiveInstalledA = hasInstalledA ? installedImageFaceA : null;
      const effectiveInstalledB = showFaceB && hasInstalledB ? installedImageFaceB : null;
      
      const hasDesigns = effectiveDesignA || effectiveDesignB;
      const imageHeight = includeDesigns && hasDesigns ? '80mm' : '140mm';
      
      const municipalityDistrict = [municipality, district].filter(Boolean).join(' - ') || '—';

      // تاريخ التركيب
      const installationDate = item.installation_date 
        ? new Date(item.installation_date).toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' })
        : '';

      // استخدام الإعدادات المخصصة من قاعدة البيانات
      const s = customSettings;
      
      // ✅ لكل لوحة: استخدم رقم العقد الخاص بالمهمة المنبثقة منها (للمهام المجمعة من أكثر من عقد)
      const itemContractNumber = resolveItemContractNumber(item);
      const itemAdType = resolveItemAdType(item, itemContractNumber);
      
      pages.push(`
        <div class="page">
          <div class="background"><img src="${normalizedBackgroundUrl}" alt="" /></div>

          <!-- رقم العقد ونوع الإعلان معاً - خاص بكل لوحة -->
          <div class="absolute-field contract-number" style="top: ${s.contract_number_top}; right: ${s.contract_number_right}; font-size: ${s.contract_number_font_size}; font-weight: ${s.contract_number_font_weight}; color: ${s.contract_number_color}; max-width: 60%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; ${s.contract_number_offset_x && s.contract_number_offset_x !== '0mm' ? `margin-right: ${s.contract_number_offset_x};` : ''}">
            عقد رقم: ${itemContractNumber}${itemAdType ? ' - نوع الإعلان: ' + itemAdType : ''}
          </div>

          <!-- تاريخ التركيب -->
          ${showInstallationDate && installationDate ? `
          <div class="absolute-field installation-date" style="top: ${s.installation_date_top}; right: ${s.installation_date_right}; font-family: '${s.primary_font}', Arial, sans-serif; font-size: ${s.installation_date_font_size}; font-weight: ${s.installation_date_font_weight || '400'}; color: ${s.installation_date_color}; text-align: ${s.installation_date_alignment}; ${s.installation_date_offset_x && s.installation_date_offset_x !== '0mm' ? `margin-right: ${s.installation_date_offset_x};` : ''}">
            تاريخ التركيب: ${installationDate}
          </div>
          ` : ''}

          <!-- اسم اللوحة -->
          <div class="absolute-field billboard-name" style="top: ${s.billboard_name_top}; left: calc(${s.billboard_name_left} - 60mm${s.billboard_name_offset_x && s.billboard_name_offset_x !== '0mm' ? ` + ${s.billboard_name_offset_x}` : ''}); width: 120mm; text-align: ${s.billboard_name_alignment || 'center'}; font-size: ${s.billboard_name_font_size}; font-weight: ${s.billboard_name_font_weight}; color: ${s.billboard_name_color};">
            ${name}
          </div>

          <!-- المقاس -->
          <div class="absolute-field size" style="top: ${s.size_top}; left: calc(${s.size_left} - 40mm${s.size_offset_x && s.size_offset_x !== '0mm' ? ` + ${s.size_offset_x}` : ''}); width: 80mm; text-align: ${s.size_alignment || 'center'}; font-size: ${s.size_font_size}; font-weight: ${s.size_font_weight}; color: ${s.size_color};">
            ${size}
          </div>
          
          <!-- عدد الأوجه - يتبع موضع المقاس أفقياً ويُزاح أسفله بمقدار faces_count_top -->
          <div class="absolute-field faces-count" style="top: calc(${s.size_top} + ${s.faces_count_top}); left: calc(${s.size_left} - 40mm${s.size_offset_x && s.size_offset_x !== '0mm' ? ` + ${s.size_offset_x}` : ''}); width: 80mm; text-align: ${s.size_alignment || 'center'}; font-size: ${s.faces_count_font_size}; color: ${s.faces_count_color};">
            ${item.has_cutout ? 'مجسم - ' : ''}عدد ${facesCount} ${facesCount === 1 ? 'وجه' : 'أوجه'}
          </div>

          <!-- النوع (عميل/فريق تركيب) -->
          ${printType === 'installation' ? `
            <div class="absolute-field print-type" style="top: ${s.team_name_top}; right: ${s.team_name_right}; font-size: ${s.team_name_font_size}; color: ${s.team_name_color || '#000'}; font-weight: ${s.team_name_font_weight}; text-align: ${s.team_name_alignment}; ${s.team_name_offset_x && s.team_name_offset_x !== '0mm' ? `margin-right: ${s.team_name_offset_x};` : ''}">
               فريق التركيب: ${Array.from(selectedTeamIds).map(id => teams[id]?.team_name).filter(Boolean).join(' - ')}
            </div>
          ` : ''}

          <!-- صورة اللوحة أو صور التركيب -->
          ${showInstalledImages && effectiveInstalledA && effectiveInstalledB ? `
            <div class="absolute-field" style="top: ${s.installed_images_top}; left: calc(${s.installed_images_left} - ${s.installed_images_width} / 2); width: ${s.installed_images_width}; display: flex; gap: ${s.installed_images_gap};">
              <div style="flex: 1; text-align: center;">
                <div style="font-size: 12px; font-weight: 600; color: #000; margin-bottom: 3mm;">التركيب - الوجه الأمامي</div>
                <div style="height: ${s.installed_image_height}; overflow: hidden; border: 2px solid #000; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                  <img src="${effectiveInstalledA}" alt="التركيب - الوجه الأمامي" style="max-width: 100%; max-height: 100%; width: auto; height: auto; display: block;" onerror="this.onerror=null;this.src='/placeholder.svg'" />
                </div>
              </div>
              <div style="flex: 1; text-align: center;">
                <div style="font-size: 12px; font-weight: 600; color: #000; margin-bottom: 3mm;">التركيب - الوجه الخلفي</div>
                <div style="height: ${s.installed_image_height}; overflow: hidden; border: 2px solid #000; border-radius: 8px; display: flex; align-items: center; justify-content: center;">
                  <img src="${effectiveInstalledB}" alt="التركيب - الوجه الخلفي" style="max-width: 100%; max-height: 100%; width: auto; height: auto; display: block;" onerror="this.onerror=null;this.src='/placeholder.svg'" />
                </div>
              </div>
            </div>
          ` : showInstalledImages && effectiveInstalledA ? `
            <div class="absolute-field image-container" style="top: ${s.main_image_top}; left: calc(${s.main_image_left} - ${s.main_image_width} / 2); width: ${s.main_image_width}; height: ${includeDesigns && hasDesigns ? s.installed_image_height : s.main_image_height};">
              <img src="${effectiveInstalledA}" alt="صورة التركيب" class="billboard-image" onerror="this.onerror=null;this.src='/placeholder.svg'" />
            </div>
          ` : mainImage ? `
            <div class="absolute-field image-container" style="top: ${s.main_image_top}; left: calc(${s.main_image_left} - ${s.main_image_width} / 2); width: ${s.main_image_width}; height: ${includeDesigns && hasDesigns ? s.installed_image_height : s.main_image_height};">
              <img src="${mainImage}" alt="صورة اللوحة" class="billboard-image" onerror="this.onerror=null;this.src='/placeholder.svg'" />
            </div>
          ` : ''}

          <!-- البلدية - الحي -->
          <div class="absolute-field location-info" style="top: ${s.location_info_top}; left: calc(${toCssLength(s.location_info_left)} + ${toMmOffset(s.location_info_offset_x)}); width: ${s.location_info_width}; font-size: ${s.location_info_font_size}; color: ${s.location_info_color}; text-align: ${s.location_info_alignment};">
            ${municipalityDistrict}
          </div>

          <!-- أقرب معلم -->
          <div class="absolute-field landmark-info" style="top: ${s.landmark_info_top}; left: calc(${toCssLength(s.landmark_info_left)} + ${toMmOffset(s.landmark_info_offset_x)}); width: ${s.landmark_info_width}; font-size: ${s.landmark_info_font_size}; color: ${s.landmark_info_color}; text-align: ${s.landmark_info_alignment};">
            ${landmark || '—'}
          </div>

          <!-- QR Code -->
          ${qrCodeDataUrl ? `
            <div class="absolute-field qr-container" style="top: ${s.qr_top}; left: ${s.qr_left}; width: ${s.qr_size}; height: ${s.qr_size};">
              <a href="${mapLink}" target="_blank" style="display:block;width:100%;height:100%;" title="اضغط لفتح الموقع على الخريطة">
                <img src="${qrCodeDataUrl}" alt="QR" class="qr-code" style="cursor:pointer;" />
              </a>
            </div>
          ` : ''}

          <!-- التصاميم -->
          ${includeDesigns && hasDesigns ? `
            <div class="absolute-field designs-section" style="top: ${s.designs_top}; left: ${s.designs_left}; width: ${s.designs_width}; display: flex; flex-wrap: nowrap; gap: ${s.designs_gap}; ${effectiveDesignA && !effectiveDesignB ? 'justify-content: center;' : ''}">
              ${effectiveDesignA ? `
                <div class="design-item" ${!effectiveDesignB ? 'style="max-width: 60%;"' : ''}>
                  <div class="design-label">${(showDesignName && designName) ? (effectiveDesignB ? `تصميم الوجه الأمامي - ${designName}` : designName) : (effectiveDesignB ? 'تصميم الوجه الأمامي' : 'التصميم')}</div>
                  <img src="${effectiveDesignA}" alt="${designName || 'التصميم'}" class="design-image" style="max-height: ${s.design_image_height}; max-width: 100%; width: auto; height: auto; object-fit: contain;" onerror="this.onerror=null;this.src='/placeholder.svg'" />
                </div>
              ` : ''}
              ${effectiveDesignB ? `
                <div class="design-item" ${!effectiveDesignA ? 'style="max-width: 60%;"' : ''}>
                  <div class="design-label">${(showDesignName && designName) ? (effectiveDesignA ? `تصميم الوجه الخلفي - ${designName}` : designName) : (effectiveDesignA ? 'تصميم الوجه الخلفي' : 'التصميم')}</div>
                  <img src="${effectiveDesignB}" alt="${designName || 'التصميم'}" class="design-image" style="max-height: ${s.design_image_height}; max-width: 100%; width: auto; height: auto; object-fit: contain;" onerror="this.onerror=null;this.src='/placeholder.svg'" />
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      `);
    }

    // أسماء الفرق المختارة
    const selectedTeamNames = Array.from(selectedTeamIds)
      .map(id => teams[id]?.team_name)
      .filter(Boolean)
      .join(' - ');

    const contractNumbersStr = resolvedContractNumbers.length > 1
      ? resolvedContractNumbers.map(num => `#${num}`).join('، ')
      : `#${resolvedContractNumbers[0] || contractNumber}`;
    const adTypesStr = adTypeSummaryLabel;

    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8" />
        <title>تركيب - ${resolvedContractNumbers.length > 1 ? `عقود ${contractNumbersStr}` : `عقد ${contractNumbersStr}`}${adTypesStr ? ` - ${adTypesStr}` : ''} - ${contractItems.length} لوحة${selectedTeamNames ? ` - ${selectedTeamNames}` : ''}</title>
        <style>
          @font-face {
            font-family: 'Doran';
            src: url('/Doran-Medium.otf') format('opentype');
            font-weight: 500;
            font-style: normal;
          }
          @font-face {
            font-family: 'Doran';
            src: url('/Doran-Bold.otf') format('opentype');
            font-weight: 700;
            font-style: normal;
          }
          @font-face {
            font-family: 'Manrope';
            src: url('/Manrope-Medium.otf') format('opentype');
            font-weight: 500;
            font-style: normal;
          }
          @font-face {
            font-family: 'Manrope';
            src: url('/Manrope-Bold.otf') format('opentype');
            font-weight: 700;
            font-style: normal;
          }

          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }

          html, body {
            font-family: 'Doran', Arial, sans-serif;
            direction: rtl;
            background: white;
            color: #000;
            padding: 0;
            margin: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }

          .page {
            position: relative;
            width: 210mm;
            height: 297mm;
            margin: 0;
            padding: 0;
            page-break-after: always;
            page-break-inside: avoid;
            overflow: hidden;
          }

          .page:last-child {
            page-break-after: auto;
          }

          .background {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 0;
          }
          .background img {
            width: 100%;
            height: 100%;
            object-fit: fill;
            display: block;
          }

          .absolute-field {
            position: absolute;
            z-index: 5;
            color: #000;
            font-family: 'Doran', Arial, sans-serif;
            line-height: 1;
          }

          /* --- أحجام الخطوط المخصصة --- */
          .billboard-name {
            font-family: 'Doran', Arial, sans-serif;
            font-size: 20px;
            font-weight: 500;
            color: #333;
          }

          .size {
            font-family: 'Manrope', Arial, sans-serif;
            font-size: 41px;
            font-weight: 700;
            line-height: 1.1;
            display: flex;
            justify-content: center;
            align-items: center;
          }
          .print-size-container { display: inline-flex; align-items: center; justify-content: center; gap: 0.12em; direction: rtl; color: inherit; white-space: nowrap; }
          .print-dim-col { display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; color: inherit; }
          .print-dim-label { font-size: 0.6em; opacity: 0.8; margin-bottom: 2px; }
          .print-dim-value { font-weight: inherit; }
          .print-dim-separator { margin: 0 0.1em; opacity: 0.7; }
          
          .ad-type {
            font-family: 'Doran', Arial, sans-serif;
            font-size: 14px;
            font-weight: 500;
            color: #000;
          }

          .contract-number {
            font-family: 'Doran', Arial, sans-serif;
            font-size: 16px;
            font-weight: 500;
            line-height: 1.2;
            white-space: normal;
          }

          .location-info,
          .landmark-info {
            font-family: 'Doran', Arial, sans-serif;
            font-size: 16px;
          }

          .image-container {
            overflow: visible;
            background: rgba(255,255,255,0.8);
            border: 3px solid #000;
            border-radius: 0 0 0 8px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .billboard-image {
            max-width: 100%;
            max-height: 100%;
            width: auto;
            height: auto;
            object-fit: contain;
            object-position: center center;
            display: block;
          }

          .qr-code {
            width: 100%;
            height: 100%;
            object-fit: contain;
            object-position: center center;
          }

          .designs-section {
            flex-wrap: wrap;
          }

          .design-item {
            flex: 1;
            min-width: 70mm;
            text-align: center;
            display: flex;
            flex-direction: column;
            align-items: center;
          }

          .design-label {
            font-family: 'Doran', Arial, sans-serif;
            font-size: 13px;
            font-weight: 500;
            margin-bottom: 2mm;
            color: #333;
            white-space: nowrap;
          }

          .design-image {
            max-height: 42mm;
            max-width: 100%;
            width: auto;
            height: auto;
            object-fit: contain;
            object-position: center center;
            border: 1px solid #ddd;
            border-radius: 4px;
          }

          @page {
            size: A4 portrait;
            margin: 0;
          }

          @media print {
            body {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
              margin: 0;
              padding: 0;
              background: white;
            }
            .page {
              page-break-after: always;
              page-break-inside: avoid;
              margin: 0;
              box-shadow: none;
              height: 297mm;
              overflow: hidden;
            }
            .page:last-child {
              page-break-after: auto;
            }
            * {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
          }
        </style>
        ${getDSFallbackScript()}
      </head>
      <body>
        ${pages.join('\n')}
        <script>
          // انتظار تحميل الخطوط قبل الطباعة
          document.fonts.ready.then(function() {
            // انتظار تحميل جميع الصور
            var images = document.querySelectorAll('img');
            var loadedCount = 0;
            var totalImages = images.length;
            
            function checkAllLoaded() {
              loadedCount++;
              if (loadedCount >= totalImages) {
                setTimeout(function() {
                  window.print();
                }, 300);
              }
            }
            
            if (totalImages === 0) {
              setTimeout(function() {
                window.print();
              }, 300);
            } else {
              images.forEach(function(img) {
                if (img.complete) {
                  checkAllLoaded();
                } else {
                  img.onload = checkAllLoaded;
                  img.onerror = checkAllLoaded;
                }
              });
            }
          });
        </script>
      </body>
      </html>
    `;
  };

  // دالة إنشاء HTML للجدول - تنسيق fares2 مع أسود وذهبي
  const generateTablePrintHTML = async () => {
    const sortedItems = await sortBillboardsBySize(contractItems);
    // استخدام الألوان الثابتة من fares2 مباشرة
    const GOLD = '#E8CC64';
    const BLACK = '#000000';
    const WHITE = '#ffffff';
    
    const s = {
      ...tableSettings,
      header_bg_color: BLACK,
      header_text_color: GOLD,
      first_column_bg_color: GOLD,
      first_column_text_color: BLACK,
      border_color: BLACK,
      row_bg_color: WHITE,
      row_text_color: BLACK,
    };
    
    const selectedTeamNames = Array.from(selectedTeamIds)
      .map(id => teams[id]?.team_name)
      .filter(Boolean)
      .join(' - ');

    // استخراج الأعمدة المفعلة مرتبة
    const enabledColumns = [...s.columns_order]
      .filter(c => c.enabled)
      .sort((a, b) => a.order - b.order);

    // تحليل بيانات اللوحات لمعرفة الأعمدة الفارغة
    const columnHasData: Record<string, boolean> = {};
    enabledColumns.forEach(col => {
      columnHasData[col.id] = false;
    });

    // فحص كل لوحة لتحديد الأعمدة التي تحتوي على بيانات
    sortedItems.forEach(item => {
      const billboard = billboards[item.billboard_id];
      if (!billboard) return;

      // تجهيز بيانات الصف - بحث شامل عبر جميع مهام العقد
      const { designFaceA: _cdfa, designFaceB: _cdfb } = resolveDesignDetails(item);
      let designFaceA = _cdfa;
      let designFaceB = _cdfb;

      enabledColumns.forEach(col => {
        switch (col.id) {
          case 'row_number':
            columnHasData[col.id] = true;
            break;
          case 'billboard_image':
            if (billboard.Image_URL) columnHasData[col.id] = true;
            break;
          case 'billboard_name':
            if (billboard.Billboard_Name) columnHasData[col.id] = true;
            break;
          case 'size':
            if (billboard.Size) columnHasData[col.id] = true;
            break;
          case 'faces_count':
            if (billboard.Faces_Count) columnHasData[col.id] = true;
            break;
          case 'location':
            if ((printCityInsteadOfMunicipality ? billboard.City : billboard.Municipality) || billboard.District) columnHasData[col.id] = true;
            break;
          case 'landmark':
            if (billboard.Nearest_Landmark) columnHasData[col.id] = true;
            break;
          case 'contract_number':
            if (resolveItemContractNumber(item)) columnHasData[col.id] = true;
            break;
          case 'installation_date':
            if (item.installation_date) columnHasData[col.id] = true;
            break;
          case 'design_images':
            if (designFaceA || designFaceB) columnHasData[col.id] = true;
            break;
          case 'installed_images':
            if (item.installed_image_face_a_url || item.installed_image_face_b_url) columnHasData[col.id] = true;
            break;
          case 'qr_code':
            if (billboard.GPS_Coordinates) columnHasData[col.id] = true;
            break;
        }
      });
    });

    // الأعمدة النهائية (مع إخفاء الفارغة إن كان مفعلاً)
    const finalColumns = s.auto_hide_empty_columns 
      ? enabledColumns.filter(col => columnHasData[col.id])
      : enabledColumns;

    // تقسيم اللوحات إلى صفحات - أقصى 11 صف في الصفحة
    const pages: string[] = [];
    const rowsPerPage = Math.min(s.rows_per_page || 11, 11);
    
    for (let pageIndex = 0; pageIndex < Math.ceil(sortedItems.length / rowsPerPage); pageIndex++) {
      const pageItems = sortedItems.slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage);
      
      const tableRows = await Promise.all(pageItems.map(async (item, index) => {
        const billboard = billboards[item.billboard_id];
        if (!billboard) return '';
        
        const globalIndex = pageIndex * rowsPerPage + index + 1;
        const name = billboard.Billboard_Name || `لوحة ${item.billboard_id}`;
        const municipality = printCityInsteadOfMunicipality ? (billboard.City || '') : (billboard.Municipality || '');
        const district = billboard.District || '';
        const landmark = billboard.Nearest_Landmark || '';
        const size = billboard.Size || '';
        const facesCount = billboard.Faces_Count || 1;
        const itemContractNumber = resolveItemContractNumber(item);
        const itemAdType = resolveItemAdType(item, itemContractNumber);
        
        // التصاميم - بحث شامل عبر جميع مهام العقد
        const { designFaceA: _rdfa, designFaceB: _rdfb } = resolveDesignDetails(item);
        let designFaceA = _rdfa;
        let designFaceB = _rdfb;
        
        // صور التركيب
        const installedImageFaceA = item.installed_image_face_a_url;
        const installedImageFaceB = item.installed_image_face_b_url;
        
        // تاريخ التركيب
        const installationDate = item.installation_date 
          ? new Date(item.installation_date).toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' })
          : '-';

        // QR Code
        let qrCodeDataUrl = '';
        let mapLink = '';
        if (finalColumns.some(c => c.id === 'qr_code')) {
          const coords = billboard.GPS_Coordinates || '';
          mapLink = coords 
            ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` 
            : '';
          if (coords) {
            try {
              qrCodeDataUrl = await QRCode.toDataURL(mapLink, { width: 96, margin: 0 });
            } catch (error) {
              console.error('Error generating QR code:', error);
            }
          }
        }

        const rowBg = '#ffffff'; // خلفية بيضاء دائماً مثل fares2
        
        // إنشاء خلايا الصف حسب ترتيب الأعمدة - مطابق لـ fares2
        const cells = finalColumns.map((col, colIndex) => {
          const isFirstColumn = colIndex === 0;

          switch (col.id) {
            case 'row_number':
              return `<td class="number-cell"><div class="billboard-number">${globalIndex}</div></td>`;
            case 'billboard_image':
              return `<td class="image-cell">
                ${billboard.Image_URL 
                  ? `<img src="${normalizePrintUrl(billboard.Image_URL)}" alt="${name}" class="billboard-image" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';">
                     <div class="image-placeholder" style="display:none;"><span>صورة</span></div>`
                  : `<div class="image-placeholder"><span>صورة</span></div>`
                }
              </td>`;
            case 'billboard_name':
              return `<td style="font-weight: 600; text-align: right; padding: 4px; font-size: 8px;">${name}</td>`;
            case 'size':
              return `<td style="font-weight: 600; font-size: 8px; color: #000000;">${size}</td>`;
            case 'faces_count':
              return `<td style="font-size: 9px; padding: 2px; font-weight: 700;">${facesCount}</td>`;
            case 'location':
              return `<td style="font-weight: 500; text-align: right; padding: 4px; font-size: 8px;">${[municipality, district].filter(Boolean).join(' - ') || '-'}</td>`;
            case 'landmark':
              return `<td style="text-align: right; padding: 4px; font-size: 8px;">${landmark || '-'}</td>`;
            case 'contract_number':
              return `<td style="font-size: 8px; padding: 2px;">${itemContractNumber}${itemAdType ? '<br/><span style="font-size:7px;color:#666;">' + itemAdType + '</span>' : ''}</td>`;
            case 'installation_date':
              return `<td style="font-size: 8px; padding: 2px;">${installationDate}</td>`;
            case 'design_images':
              return `<td class="image-cell">
                <div class="img-group">
                  ${designFaceA ? `<img src="${normalizePrintUrl(designFaceA)}" alt="أمامي" class="design-img" onerror="this.onerror=null;this.src='/placeholder.svg'" />` : ''}
                  ${designFaceB ? `<img src="${normalizePrintUrl(designFaceB)}" alt="خلفي" class="design-img" onerror="this.onerror=null;this.src='/placeholder.svg'" />` : ''}
                  ${!designFaceA && !designFaceB ? '-' : ''}
                </div>
              </td>`;
            case 'installed_images':
              return `<td class="image-cell">
                <div class="img-group">
                  ${installedImageFaceA ? `<img src="${normalizePrintUrl(installedImageFaceA)}" alt="أمامي" class="installed-img" onerror="this.onerror=null;this.src='/placeholder.svg'" />` : ''}
                  ${installedImageFaceB ? `<img src="${normalizePrintUrl(installedImageFaceB)}" alt="خلفي" class="installed-img" onerror="this.onerror=null;this.src='/placeholder.svg'" />` : ''}
                  ${!installedImageFaceA && !installedImageFaceB ? '-' : ''}
                </div>
              </td>`;
            case 'qr_code':
              return `<td class="qr-cell" style="padding: 2px;">
                ${qrCodeDataUrl && mapLink 
                  ? `<a href="${mapLink}" target="_blank" class="qr-link" title="اضغط لفتح الموقع على الخريطة">
                       <img src="${qrCodeDataUrl}" class="qr-code" style="width: 50px; height: 50px; object-fit: contain;" alt="QR" />
                     </a>`
                  : '<span style="color: #999; font-size: 7px;">-</span>'
                }
              </td>`;
            default:
              return '';
          }
        });
        
        return `<tr style="height: 60px; background: ${rowBg};">${cells.join('')}</tr>`;
      }));

      // إنشاء رؤوس الأعمدة مع عرض كل عمود
      const headerCells = finalColumns.map((col, colIndex) => {
        const isFirstColumn = colIndex === 0;
        const headerStyle = isFirstColumn 
          ? `background: ${s.first_column_bg_color}; color: ${s.first_column_text_color}; width: ${col.width || '8%'};`
          : `width: ${col.width || '8%'};`;
        return `<th class="header-cell" style="${headerStyle}">${col.label}</th>`;
      });

      // محتوى الصفحة - مطابق لتنسيق fares2 مع خلفية repo.svg
      pages.push(`
        <div class="info-bar">
          <span>${contractSummaryLabel} | العميل: ${customerName}${adTypeSummaryLabel ? ' | ' + adTypeSummaryLabel : ''}${selectedTeamNames ? ' | الفريق: ' + selectedTeamNames : ''} | صفحة ${pageIndex + 1} من ${Math.ceil(sortedItems.length / rowsPerPage)}</span>
        </div>
        <table>
          <thead>
            <tr>${headerCells.join('')}</tr>
          </thead>
          <tbody>
            ${tableRows.join('')}
          </tbody>
        </table>
      `);
    }

    const isLandscape = s.page_orientation === 'landscape';
    const pageMargin = s.page_margin || '8mm';
    const tableTopMargin = s.table_top_margin || '10mm';
    const rowHeight = s.row_height || '60px';
    const qrSize = s.qr_code_size || '50px';
    
    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8" />
        <title>${resolvedContractNumbers.length > 1 ? `جدول لوحات العقود ${resolvedContractNumbers.map(num => `#${num}`).join('، ')}` : `جدول لوحات العقد #${resolvedContractNumbers[0] || contractNumber}`}</title>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
          @font-face {
            font-family: 'Doran';
            src: url('/fonts/Doran-Medium.otf') format('opentype');
            font-weight: 500;
            font-style: normal;
          }

          @page {
            size: ${isLandscape ? 'A4 landscape' : 'A4 portrait'};
            margin: 0;
          }

          * { margin: 0; padding: 0; box-sizing: border-box; }

          body {
            font-family: '${s.primary_font}', 'Tajawal', 'Arial', sans-serif;
            direction: rtl;
            background: #ffffff;
            color: #000;
            line-height: 1.3;
            font-size: ${s.row_font_size};
          }

          .page {
            position: relative;
            width: ${isLandscape ? '297mm' : '210mm'};
            height: ${isLandscape ? '210mm' : '297mm'};
            padding: ${pageMargin};
            margin: 0 auto;
            page-break-after: always;
            page-break-inside: avoid;
            overflow: hidden;
            background: white;
          }

          .page:last-child {
            page-break-after: auto;
          }

          /* خلفية الصفحة - repo.svg */
          .page-background {
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background-image: url('/repo.svg');
            background-size: 100% 100%;
            background-repeat: no-repeat;
            z-index: 0;
          }

          .page-content {
            position: relative;
            z-index: 1;
            padding-top: ${tableTopMargin};
          }

          .info-bar {
            margin-bottom: 8px;
            padding: 6px 10px;
            background: ${s.header_bg_color};
            display: inline-block;
          }

          .info-bar span {
            font-size: 10px;
            color: ${s.header_text_color};
            font-weight: 700;
          }

          /* Table Styles - مطابق لـ fares2 */
          table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 10px;
            font-size: ${s.row_font_size};
            background: #ffffff;
          }

          th {
            background: ${s.header_bg_color};
            color: ${s.header_text_color};
            font-weight: 700;
            font-size: ${s.header_font_size};
            height: 30px;
            border: 1px solid ${s.border_color};
            padding: 4px 2px;
            text-align: center;
          }

          td {
            border: 1px solid ${s.border_color};
            padding: 2px;
            text-align: center;
            vertical-align: middle;
            background: #ffffff;
            color: #000;
          }

          /* العمود الأول - ذهبي مثل fares2 */
          td.number-cell {
            background: ${s.first_column_bg_color};
            padding: 2px;
            font-weight: 700;
            font-size: 9px;
            color: ${s.first_column_text_color};
            width: 60px;
          }

          td.image-cell {
            background: #ffffff;
            padding: 0;
            width: 70px;
          }

          .billboard-image {
            width: 100%;
            height: auto;
            max-height: ${rowHeight};
            object-fit: contain;
            display: block;
            margin: 0 auto;
          }

          .billboard-number {
            color: ${s.first_column_text_color};
            font-weight: 700;
            font-size: 9px;
          }

          td.qr-cell {
            width: 60px;
            padding: 2px;
            vertical-align: middle;
          }

          .qr-code {
            width: 100%;
            height: auto;
            max-height: ${rowHeight};
            display: block;
            margin: 0 auto;
            cursor: pointer;
          }

          .qr-link {
            display: block;
            text-align: center;
          }

          .img-group {
            display: flex;
            gap: 2px;
            justify-content: center;
            align-items: center;
          }

          .design-img, .installed-img {
            max-width: 48%;
            max-height: calc(${rowHeight} - 4px);
            object-fit: contain;
          }

          .image-placeholder {
            width: 100%;
            height: ${rowHeight};
            background: #f0f0f0;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 7px;
            color: #666;
          }

          @media print {
            body {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
              background: #ffffff !important;
              margin: 0;
              padding: 0;
            }
            .no-print { display: none; }
            table { page-break-inside: auto; }
            tr { page-break-inside: avoid; page-break-after: auto; }
            td, th, .billboard-image, .image-placeholder, td.image-cell, td.number-cell {
              print-color-adjust: exact;
              -webkit-print-color-adjust: exact;
            }
            .page {
              page-break-after: always;
              margin: 0;
              box-shadow: none;
              height: ${isLandscape ? '210mm' : '297mm'};
              overflow: hidden;
            }
            .page:last-child {
              page-break-after: auto;
            }
          }
        </style>
        ${getDSFallbackScript()}
      </head>
      <body>
        ${pages.map((pageContent, idx) => `
          <div class="page">
            <div class="page-background"></div>
            <div class="page-content">
              ${pageContent}
            </div>
          </div>
        `).join('\n')}
        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 500);
          };
        <\/script>
      </body>
      </html>
    `;
  };

  const handlePrint = async () => {
    console.log('🖨️ handlePrint called', { printMode, printType, contractItemsCount: contractItems.length, loading });
    
    if (contractItems.length === 0) {
      console.log('❌ No items to print');
      toast.error('لا توجد لوحات للطباعة');
      return;
    }

    if (loading) {
      console.log('⏳ Already loading, returning');
      return;
    }
    
    const docTitle = `طباعة لوحات عقد ${contractNumber}`;
    // فتح النافذة فوراً بشكل متزامن قبل أي عمليات async لمنع حظر المتصفح
    const printWindow = preparePrintWindow(docTitle);
    setLoading(true);
    console.log('🔄 Starting print generation...');

    try {
      const isLandscapeTable = printMode === 'table' && tableSettings.page_orientation === 'landscape';
      const html = printMode === 'table' ? await generateTablePrintHTML() : await generatePrintHTML();
      console.log('✅ HTML generated, writing to print window...');

      writePrintWindow(printWindow, html, {
        title: docTitle,
        landscape: isLandscapeTable,
        showDownloadPdf: true,
        showShare: true,
        autoPrint: true,
      });

      toast.success(`تم تحضير ${contractItems.length} ${printMode === 'table' ? 'صف' : 'صفحة'} للطباعة ${printType === 'installation' ? '(فريق التركيب)' : '(العميل)'}`);
    } catch (error) {
      console.error('❌ Error printing:', error);
      toast.error('فشل في تحضير الطباعة');
    } finally {
      setLoading(false);
    }
  };

  // Rasterize SVG URL to PNG data URL for html2canvas compatibility
  const rasterizeSvgForPdf = async (url: string, w = 2480, h = 3508): Promise<string> => {
    if (!url || url.startsWith('data:')) return url;
    return new Promise<string>((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = w; c.height = h;
          const ctx = c.getContext('2d');
          if (!ctx) { resolve(url); return; }
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, w, h);
          resolve(c.toDataURL('image/png'));
        } catch { resolve(url); }
      };
      img.onerror = () => resolve(url);
      try { img.src = new URL(url, window.location.origin).toString(); } catch { img.src = url; }
    });
  };

  const prepareHtmlForPdf = async (html: string) => {
    let preparedHtml = stripScriptsForPdf(html);
    const svgUrls = new Set<string>();
    const bgRegex = /(?:background-image:\s*url\(['"]?)([^'")\s]+\.svg)['"]?\)|<img[^>]+src=["']([^"']+\.svg)["']/gi;
    let match: RegExpExecArray | null;

    while ((match = bgRegex.exec(preparedHtml)) !== null) {
      svgUrls.add(match[1] || match[2]);
    }

    const rasterized = new Map<string, string>();
    await Promise.all(
      Array.from(svgUrls).map(async (svgUrl) => {
        const dataUrl = await rasterizeSvgForPdf(svgUrl);
        if (dataUrl !== svgUrl) {
          rasterized.set(svgUrl, dataUrl);
        }
      })
    );

    for (const [svgUrl, dataUrl] of rasterized) {
      preparedHtml = preparedHtml.split(svgUrl).join(dataUrl);
    }

    return preparedHtml;
  };

  const buildPdfBlobFromHtml = async (html: string): Promise<Blob> => {
    const preparedHtml = await prepareHtmlForPdf(html);
    return htmlToPdfBlob(preparedHtml, `لوحات_${resolvedContractNumbers.length > 1 ? 'multiple-contracts' : (resolvedContractNumbers[0] || contractNumber)}.pdf`, {
      marginMm: [0, 0, 0, 0],
      waitMs: 1500,
      landscape: false,
    });
  };

  const downloadPdfBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const handleDownloadPDF = async () => {
    if (contractItems.length === 0) {
      toast.error('لا توجد لوحات للتحميل');
      return;
    }

    if (loading) return;
    setLoading(true);
    toast.info('جاري تحضير ملف PDF...');

    try {
      const html = printMode === 'table' ? await generateTablePrintHTML() : await generatePrintHTML();
      const pdfBlob = await buildPdfBlobFromHtml(html);
      const pdfFileName = `لوحات_${resolvedContractNumbers.length > 1 ? 'multiple-contracts' : (resolvedContractNumbers[0] || contractNumber)}${adTypeSummaryLabel ? '_' + adTypeSummaryLabel : ''}_${contractItems.length}لوحة.pdf`;
      downloadPdfBlob(pdfBlob, pdfFileName);
      toast.success('تم تحميل ملف PDF بنجاح');
      onOpenChange(false);
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('فشل في تحضير ملف PDF');
    } finally {
      setLoading(false);
    }
  };

  const handleSendWhatsAppUpload = async (phone: string, teamName?: string) => {
    if (!phone) {
      toast.error('لا يوجد رقم واتساب لهذا الفريق');
      return;
    }

    setLoading(true);
    try {
      const { createUploadProgressTracker } = await import('@/hooks/useUploadProgress');
      const progress = createUploadProgressTracker();

      const html = printMode === 'table' ? await generateTablePrintHTML() : await generatePrintHTML();
      const preparedHtml = await prepareHtmlForPdf(html);
      const pdfBlob = await htmlToPdfBlobOptimized(preparedHtml, `upload_${resolvedContractNumbers.length > 1 ? 'multiple-contracts' : (resolvedContractNumbers[0] || contractNumber)}.pdf`, { marginMm: [0, 0, 0, 0], waitMs: 1500, landscape: false });
      const base64Data = await blobToBase64(pdfBlob);
      const { uploadFileToGoogleDrive } = await import('@/services/imageUploadService');

      const pdfFileName = `تركيب_${resolvedContractNumbers.length > 1 ? 'multiple-contracts' : (resolvedContractNumbers[0] || contractNumber)}${adTypeSummaryLabel ? '_' + adTypeSummaryLabel : ''}_${contractItems.length}لوحة.pdf`;
      const pdfUrl = await uploadFileToGoogleDrive(base64Data, pdfFileName, 'application/pdf', 'installation-tasks', false, progress);

      const cleanPhone = phone.replace(/[^0-9+]/g, '').replace(/^\+/, '');
      const message = [
        `مرحباً،`,
        '',
        `نرسل لك ملف ${printMode === 'table' ? 'جدول' : 'لوحات'} ${resolvedContractNumbers.length > 1 ? 'لعدة عقود' : `للعقد رقم ${resolvedContractNumbers[0] || contractNumber}`}.`,
        '',
        `رابط الملف:`,
        pdfUrl,
      ].join('\n');

      // فتح واتساب مباشرة في نفس الصفحة بدون نافذة منبثقة (نفس طريقة إرسال العقد)
      const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
      window.open(whatsappUrl, '_blank');
      toast.success('تم رفع الملف وفتح واتساب بنجاح');
      onOpenChange(false);
    } catch (error) {
      console.error('Error uploading PDF to WhatsApp:', error);
      toast.error('فشل في رفع الملف أو فتح واتساب');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-lg font-bold">
              <div className="p-1.5 bg-primary/20 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <span>تركيب لوحات العقد</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm font-normal text-muted-foreground mr-9">
              {printType === 'installation' && (
                <Badge variant="secondary">فريق التركيب</Badge>
              )}
              {adTypeSummaryLabel && (
                <Badge variant="secondary">{adTypeSummaryLabel}</Badge>
              )}
              <span className="font-semibold text-foreground">{customerName}</span>
              <span>•</span>
              <span>{contractSummaryLabel}</span>
              <span>•</span>
              <Badge className="bg-primary/20 text-primary border-0">{contractItems.length} لوحة</Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* نطاق الطباعة */}
          {taskId && (
            <div className="p-3 bg-muted/50 rounded-xl border">
              <Label className="text-sm font-bold flex items-center gap-2 mb-2">
                <Layers className="h-4 w-4 text-primary" />
                نطاق الطباعة
              </Label>
              <div className="flex gap-2">
                <Button
                  variant={printScope === 'task' ? 'default' : 'outline'}
                  onClick={() => setPrintScope('task')}
                  size="sm"
                  className="flex-1 text-xs"
                >
                  هذه المهمة فقط
                </Button>
                <Button
                  variant={printScope === 'contract' ? 'default' : 'outline'}
                  onClick={() => setPrintScope('contract')}
                  size="sm"
                  className="flex-1 text-xs"
                >
                  جميع مهام العقد
                </Button>
              </div>
            </div>
          )}

          {/* اختيار الفرق */}
          <div className="p-4 bg-muted/50 rounded-xl border space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm font-bold flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                اختر الفرق للطباعة
              </Label>
              <div className="flex gap-1">
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAllTeams}>
                  الكل
                </Button>
                <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={clearTeamSelection}>
                  مسح
                </Button>
              </div>
            </div>
            
            <div className="flex flex-wrap gap-2">
              {Object.entries(itemsByTeam).map(([teamId, items]) => {
                const isSelected = selectedTeamIds.has(teamId);
                return (
                  <button
                    key={teamId}
                    type="button"
                    onClick={() => toggleTeam(teamId)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-border bg-card hover:border-primary/50'
                    }`}
                  >
                    <div className={`h-4 w-4 rounded border-2 flex items-center justify-center ${
                      isSelected ? 'border-primary bg-primary' : 'border-muted-foreground'
                    }`}>
                      {isSelected && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium text-sm">{teams[teamId]?.team_name || 'غير محدد'}</span>
                    <Badge variant="secondary" className="text-xs">{items.length}</Badge>
                  </button>
                );
              })}
            </div>
            
            <div className="flex items-center justify-between pt-2 border-t">
              <span className="text-sm text-muted-foreground">اللوحات المحددة:</span>
              <Badge className="text-sm font-bold">{contractItems.length} لوحة</Badge>
            </div>
          </div>

          {/* نوع الطباعة (بطاقات / جدول) */}
          <div className="p-4 bg-muted/50 rounded-xl border space-y-3">
            <Label className="text-sm font-bold flex items-center gap-2">
              <FileText className="h-4 w-4 text-primary" />
              نوع الطباعة
            </Label>
            <div className="flex gap-2">
              <Button
                variant={printMode === 'cards' ? 'default' : 'outline'}
                onClick={() => setPrintMode('cards')}
                className="flex-1 flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                بطاقات (صفحة لكل لوحة)
              </Button>
              <Button
                variant={printMode === 'table' ? 'default' : 'outline'}
                onClick={() => setPrintMode('table')}
                className="flex-1 flex items-center gap-2"
              >
                <Table2 className="h-4 w-4" />
                جدول
              </Button>
            </div>
          </div>

          {/* إعدادات البطاقات (تظهر فقط في وضع البطاقات) */}
          {printMode === 'cards' && (
            <div className="p-4 bg-muted/50 rounded-xl border space-y-3">
              <div className="flex items-center justify-between">
                <BackgroundSelector
                  value={customBackgroundUrl}
                  onChange={setCustomBackgroundUrl}
                />
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCustomizationDialogOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Settings2 className="h-4 w-4" />
                  تخصيص الطباعة
                </Button>
              </div>
            </div>
          )}

          {/* إعدادات الجدول (تظهر فقط في وضع الجدول) */}
          {printMode === 'table' && (
            <div className="p-4 bg-muted/50 rounded-xl border space-y-3">
              <div className="flex items-center justify-between">
                <div className="text-sm text-muted-foreground">
                  جدول يحتوي على جميع اللوحات مع الصور والتفاصيل
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setTableSettingsDialogOpen(true)}
                  className="flex items-center gap-2"
                >
                  <Settings2 className="h-4 w-4" />
                  إعدادات الجدول
                </Button>
              </div>
            </div>
          )}

          {/* خيارات الطباعة */}
          <div className="space-y-3">
            {printMode === 'cards' && (
              <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <Checkbox
                  id="includeDesigns"
                  checked={includeDesigns}
                  onCheckedChange={(c) => setIncludeDesigns(!!c)}
                />
                <Label htmlFor="includeDesigns" className="cursor-pointer flex-1">تضمين التصاميم</Label>
              </div>
            )}
            {printMode === 'cards' && includeDesigns && (
              <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors mr-6">
                <Checkbox
                  id="showDesignName"
                  checked={showDesignName}
                  onCheckedChange={(c) => setShowDesignName(!!c)}
                />
                <Label htmlFor="showDesignName" className="cursor-pointer flex-1 text-xs">إظهار اسم التصميم بدلاً من كلمة "التصميم"</Label>
              </div>
            )}
            {printMode === 'cards' && (
              <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <Checkbox
                  id="showInstallationDate"
                  checked={showInstallationDate}
                  onCheckedChange={(c) => setShowInstallationDate(!!c)}
                />
                <Label htmlFor="showInstallationDate" className="cursor-pointer flex-1">إظهار تاريخ التركيب</Label>
              </div>
            )}
            {printMode === 'cards' && (
              <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <Checkbox
                  id="showInstalledImages"
                  checked={showInstalledImages}
                  onCheckedChange={(c) => setShowInstalledImages(!!c)}
                />
                <Label htmlFor="showInstalledImages" className="cursor-pointer flex-1">إظهار صور التركيب الفعلية</Label>
              </div>
            )}

            <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
              <Checkbox
                id="printCityInsteadOfMunicipality"
                checked={printCityInsteadOfMunicipality}
                onCheckedChange={(c) => setPrintCityInsteadOfMunicipality(!!c)}
              />
              <Label htmlFor="printCityInsteadOfMunicipality" className="cursor-pointer flex-1">
                طباعة اسم المدينة بدل البلدية
              </Label>
            </div>

            <div className="flex gap-2">
              <Button
                variant={printType === 'client' ? 'default' : 'outline'}
                onClick={() => setPrintType('client')}
                className="flex-1"
              >
                نسخة العميل
              </Button>
              <Button
                variant={printType === 'installation' ? 'default' : 'outline'}
                onClick={() => setPrintType('installation')}
                className="flex-1"
              >
                نسخة فريق التركيب
              </Button>
            </div>
          </div>

          {/* أزرار التحكم */}
          <div className="flex gap-2 pt-4 border-t flex-wrap">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 min-w-[80px]">
              إلغاء
            </Button>
            <Button 
              onClick={handlePrint} 
              disabled={loading || settingsLoading || tableSettingsLoading || contractItems.length === 0} 
              className="flex-1 min-w-[80px]"
            >
              <Printer className="h-4 w-4 ml-2" />
              طباعة {printMode === 'table' ? 'جدول' : 'بطاقات'}
            </Button>
            <Button 
              onClick={handleDownloadPDF} 
              disabled={loading || settingsLoading || contractItems.length === 0} 
              variant="secondary" 
              className="flex-1 min-w-[80px]"
            >
              <FileDown className="h-4 w-4 ml-2" />
              PDF
            </Button>
            {selectedTeamIds.size > 0 && (() => {
              const teamsWithPhone = Array.from(selectedTeamIds)
                .map(id => teams[id])
                .filter(t => t?.phone_number);
              if (teamsWithPhone.length === 0) return null;
              const firstTeam = teamsWithPhone[0];
              
              return (
                <Button
                  onClick={() => handleSendWhatsAppUpload(firstTeam.phone_number!)}
                  variant="outline"
                  className="flex-1 min-w-[80px] gap-2 border-green-500/40 text-green-600 hover:bg-green-500/10"
                  disabled={loading || contractItems.length === 0}
                >
                  <MessageCircle className="h-4 w-4" />
                  واتساب الفريق
                </Button>
              );
            })()}
            {customerPhone && (
              <Button
                onClick={() => handleSendWhatsAppUpload(customerPhone)}
                variant="outline"
                className="flex-1 min-w-[80px] gap-2 border-blue-500/40 text-blue-600 hover:bg-blue-500/10"
                disabled={loading || contractItems.length === 0}
              >
                <MessageCircle className="h-4 w-4" />
                واتساب العميل
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
      
      {/* نافذة تخصيص البطاقات */}
      <PrintCustomizationDialog
        open={customizationDialogOpen}
        onOpenChange={setCustomizationDialogOpen}
        backgroundUrl={customBackgroundUrl}
      />

      {/* نافذة إعدادات الجدول */}
      <TablePrintSettingsDialog
        open={tableSettingsDialogOpen}
        onOpenChange={setTableSettingsDialogOpen}
        settings={tableSettings}
        onUpdateSetting={updateTableSetting}
        onSave={async () => {
          const ok = await saveTableSettings(tableSettings);
          if (ok) setTableSettingsDialogOpen(false);
        }}
        onReset={resetTableSettings}
        saving={savingTableSettings}
      />
    </Dialog>
  );
}