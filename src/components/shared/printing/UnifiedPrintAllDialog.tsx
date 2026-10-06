/**
 * UnifiedPrintAllDialog - مكون طباعة موحد لجميع الصفحات
 * يستخدم في: العقود، العروض، مهام التركيب، مهام الإزالة
 */

import { useState, useMemo, useEffect, useRef } from 'react';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Switch } from '@/components/ui/switch';
import {
  Printer,
  FileDown,
  Users,
  Check,
  CheckCircle2,
  FileText,
  Settings2,
  Table2,
  MessageCircle,
  Wrench,
  RefreshCw,
  Hash,
  Tag,
  Type,
  Image as ImageIcon,
  SlidersHorizontal,
  Eye,
  EyeOff,
  LayoutTemplate,
  User,
  Calendar,
  History,
  MapPin,
  Activity,
  Ruler,
  Camera,
  Sparkles
} from 'lucide-react';
import QRCode from 'qrcode';
import browserPdf from '@/lib/browserPdf';
import { supabase } from '@/integrations/supabase/client';
import { BackgroundSelector } from '@/components/billboard-print/BackgroundSelector';
import { PrintCustomizationDialog } from '@/components/print-customization';
import { usePrintCustomization } from '@/hooks/usePrintCustomization';
import { useTablePrintSettings } from '@/hooks/useTablePrintSettings';
import { TablePrintSettingsDialog } from '@/components/tasks/TablePrintSettingsDialog';
import { createPinSvgUrl, getBillboardStatus } from '@/hooks/useMapMarkers';
import { formatFacesCountArabic } from '@/lib/utils';
import { preparePrintWindow, writePrintWindow } from '@/utils/printWindowHelper';
import { resolveInstallationFacesCount } from '@/lib/installationFaces';
import { resolvePrintCardLayout, fitPrintCardText } from '@/lib/printCardLayout';

export type PrintContextType = 'installation' | 'removal' | 'contract' | 'offer';

export interface BillboardPrintItem {
  id: string | number;
  billboard_id: number;
  design_face_a?: string | null;
  design_face_b?: string | null;
  installed_image_face_a_url?: string | null;
  installed_image_face_b_url?: string | null;
  installation_date?: string | null;
  team_id?: string;
  has_cutout?: boolean;
  contract_number?: number | string | null;
  ad_type?: string | null;
  overlay_config?: any;
  previous_ad?: string | null;
  previous_ad_type?: string | null;
  faces_to_install?: number | null;
}

const resolveFacesCount = (item: BillboardPrintItem, billboard: any): number =>
  resolveInstallationFacesCount(item, billboard);

export interface UnifiedPrintAllDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  contextType: PrintContextType;
  contextNumber: number | string;
  customerName: string;
  companyName?: string;
  adType?: string;
  items: BillboardPrintItem[];
  billboards: Record<number, any>;
  teams?: Record<string, any>;
  showTeamFilter?: boolean;
  title?: string;
  customerPhone?: string;
  taskId?: string | number | null;
  taskIds?: string[];
  taskType?: 'installation' | 'reinstallation' | string | null;
  reinstallationNumber?: number | null;
  taskName?: string | null;
}

// دالة مساعدة لجلب الإعلانات السابقة لجميع اللوحات بدقة
export const resolveBillboardPreviousAds = async (
  items: BillboardPrintItem[],
  currentContextNumber?: number | string,
  billboardsMap: Record<number, any> = {}
): Promise<Record<string, string>> => {
  const result: Record<string, string> = {};
  if (!items || items.length === 0) return result;

  const billboardIds = [...new Set(items.map(i => Number(i.billboard_id)).filter(id => !isNaN(id) && id > 0))];
  if (billboardIds.length === 0) return result;

  const currentContractStr = String(currentContextNumber || '').trim();

  // 1. فحص الحقول المباشرة
  items.forEach(item => {
    const idKey = String(item.billboard_id);
    const b = billboardsMap[item.billboard_id] || billboardsMap[Number(item.billboard_id)];
    const direct = (item as any).previous_ad || (item as any).previous_ad_type || b?.previous_ad || b?.previous_ad_type;
    if (direct) {
      result[idKey] = String(direct).trim();
      result[String(Number(idKey))] = result[idKey];
    }
  });

  try {
    // 2. استعلام من جدول billboard_history
    const { data: historyRows } = await supabase
      .from('billboard_history')
      .select('billboard_id, ad_type, customer_name, contract_number, created_at')
      .in('billboard_id', billboardIds)
      .order('created_at', { ascending: false });

    if (historyRows && historyRows.length > 0) {
      billboardIds.forEach(bId => {
        const idKey = String(bId);
        if (result[idKey]) return;

        const itemObj = items.find(i => String(i.billboard_id) === idKey);
        const itemContract = String(itemObj?.contract_number || currentContractStr).trim();

        const bbHist = historyRows.filter((h: any) => String(h.billboard_id) === idKey);
        // البحث عن أول سجل لعقد مختلف يحتوي على نوع إعلان أو اسم زبون
        const otherHist = bbHist.find((h: any) => {
          const hContract = String(h.contract_number || '').trim();
          const hasContent = !!(h.ad_type && String(h.ad_type).trim() && String(h.ad_type).trim() !== 'null') ||
                             !!(h.customer_name && String(h.customer_name).trim() && String(h.customer_name).trim() !== 'null');
          return hasContent && (!itemContract || hContract !== itemContract);
        });

        if (otherHist) {
          const adVal = (otherHist.ad_type && String(otherHist.ad_type).trim() !== 'null' ? otherHist.ad_type : otherHist.customer_name) || '';
          if (adVal) {
            result[idKey] = String(adVal).trim();
            result[String(Number(idKey))] = result[idKey];
          }
        }
      });
    }

    // 3. استعلام من جدول Contract للوحات التي لم نجد لها إعلاناً سابقاً
    const missingIds = billboardIds.filter(bId => !result[String(bId)]);
    if (missingIds.length > 0) {
      const { data: contracts } = await supabase
        .from('Contract')
        .select('"Contract_Number", id, "Customer Name", customer_name, "Ad Type", ad_type, billboard_ids, previous_contract_number')
        .order('Contract_Number', { ascending: false });

      if (contracts && contracts.length > 0) {
        missingIds.forEach(bId => {
          const idKey = String(bId);
          const itemObj = items.find(i => String(i.billboard_id) === idKey);
          const itemContract = String(itemObj?.contract_number || currentContractStr).trim();

          // إذا كان للعقد الحالي رقم عقد سابق، نبحث في العقد السابق أولاً
          const currentContractObj = contracts.find((c: any) => String(c.Contract_Number ?? c.id) === itemContract);
          if (currentContractObj?.previous_contract_number) {
            const prevContractNum = String(currentContractObj.previous_contract_number).trim();
            const prevC = contracts.find((c: any) => String(c.Contract_Number ?? c.id) === prevContractNum);
            if (prevC) {
              const prevAd = (prevC['Ad Type'] || prevC.ad_type || prevC['Customer Name'] || prevC.customer_name || '').trim();
              if (prevAd && prevAd !== 'null') {
                result[idKey] = prevAd;
                result[String(Number(idKey))] = prevAd;
                return;
              }
            }
          }

          // البحث عن آخر عقد كان يحتوي على هذه اللوحة ومختلف عن العقد الحالي
          const matchingContract = contracts.find((c: any) => {
            const cNum = String(c.Contract_Number ?? c.id ?? '').trim();
            if (itemContract && cNum === itemContract) return false;

            const bIdsStr = String(c.billboard_ids || '');
            if (!bIdsStr) return false;
            const idsList = bIdsStr.split(',').map(s => s.trim());
            if (!idsList.includes(idKey)) return false;

            const adVal = (c['Ad Type'] || c.ad_type || c['Customer Name'] || c.customer_name || '').trim();
            return !!adVal && adVal !== 'null';
          });

          if (matchingContract) {
            const adVal = (matchingContract['Ad Type'] || matchingContract.ad_type || matchingContract['Customer Name'] || matchingContract.customer_name || '').trim();
            if (adVal) {
              result[idKey] = adVal;
              result[String(Number(idKey))] = adVal;
            }
          }
        });
      }
    }
  } catch (err) {
    console.error('Error resolving billboard previous ads:', err);
  }

  return result;
};

// دالة مساعدة لجلب تصاميم اللوحات المتوفرة
export const resolveBillboardDesigns = async (
  items: BillboardPrintItem[],
  billboardsMap: Record<number, any> = {}
): Promise<Record<string, { design_face_a?: string; design_face_b?: string; design_name?: string }>> => {
  const result: Record<string, { design_face_a?: string; design_face_b?: string; design_name?: string }> = {};
  if (!items || items.length === 0) return result;

  const billboardIds = [...new Set(items.map(i => Number(i.billboard_id)).filter(id => !isNaN(id) && id > 0))];
  if (billboardIds.length === 0) return result;

  // 1. فحص الحقول المباشرة
  items.forEach(item => {
    const idKey = String(item.billboard_id);
    const b = billboardsMap[item.billboard_id] || billboardsMap[Number(item.billboard_id)];
    const faceA = item.design_face_a || b?.design_face_a || b?.installed_design_face_a || undefined;
    const faceB = item.design_face_b || b?.design_face_b || b?.installed_design_face_b || undefined;
    const dName = item.ad_type || b?.ad_type || b?.design_name || b?.ad_name || b?.current_ad || undefined;
    if (faceA || faceB || dName) {
      result[idKey] = { design_face_a: faceA, design_face_b: faceB, design_name: dName };
      result[String(Number(idKey))] = result[idKey];
    }
  });

  try {
    // 2. استعلام من installation_task_items و task_designs
    const { data: taskDesigns } = await supabase
      .from('installation_task_items')
      .select(`
        billboard_id,
        design_face_a,
        design_face_b,
        selected_design_id,
        task_designs:selected_design_id(
          design_name,
          design_face_a_url,
          design_face_b_url
        ),
        created_at
      `)
      .in('billboard_id', billboardIds)
      .or('design_face_a.not.is.null,design_face_b.not.is.null,selected_design_id.not.is.null')
      .order('created_at', { ascending: false });

    if (taskDesigns && taskDesigns.length > 0) {
      taskDesigns.forEach((row: any) => {
        const idKey = String(row.billboard_id);
        const prev = result[idKey] || {};
        const faceA = row.design_face_a || row.task_designs?.design_face_a_url || prev.design_face_a || undefined;
        const faceB = row.design_face_b || row.task_designs?.design_face_b_url || prev.design_face_b || undefined;
        const dName = row.task_designs?.design_name || prev.design_name || undefined;
        if (faceA || faceB || dName) {
          result[idKey] = { design_face_a: faceA, design_face_b: faceB, design_name: dName };
          result[String(Number(idKey))] = result[idKey];
        }
      });
    }
  } catch (err) {
    console.error('Error resolving billboard designs:', err);
  }

  return result;
};

export function UnifiedPrintAllDialog({
  open,
  onOpenChange,
  contextType,
  contextNumber,
  customerName,
  companyName = '',
  adType = '',
  items,
  billboards,
  teams = {},
  showTeamFilter = false,
  title,
  customerPhone = '',
  taskId,
  taskIds,
  taskType,
  reinstallationNumber,
  taskName,
}: UnifiedPrintAllDialogProps) {
  const PDF_PORTRAIT_WIDTH_PX = 2480;
  const PDF_PORTRAIT_HEIGHT_PX = 3508;
  const PDF_LANDSCAPE_WIDTH_PX = 3508;
  const PDF_LANDSCAPE_HEIGHT_PX = 2480;

  const [includeDesigns, setIncludeDesigns] = useState(true);
  const [showDesignName, setShowDesignName] = useState(false);
  const [showTeamInContent, setShowTeamInContent] = useState(false);
  const [showTeamInHeader, setShowTeamInHeader] = useState(false);
  const [hideCustomerName, setHideCustomerName] = useState(true);
  const [hideInstallDate, setHideInstallDate] = useState(true);
  const [hideAdType, setHideAdType] = useState(false);
  const [hideInstalledImages, setHideInstalledImages] = useState(false);
  const [printType, setPrintType] = useState<'client' | 'installation'>(
    contextType === 'installation' || contextType === 'removal' ? 'installation' : 'client'
  );
  const [printMode, setPrintMode] = useState<'cards' | 'table'>('cards');
  const [loading, setLoading] = useState(false);
  const [selectedTeamIds, setSelectedTeamIds] = useState<Set<string>>(new Set());
  const [respectCityLimits, setRespectCityLimits] = useState(false);
  const [showWhatsAppInput, setShowWhatsAppInput] = useState(false);
  const [manualPhone, setManualPhone] = useState('');
  const [sizeCutoutMap, setSizeCutoutMap] = useState<Record<string, string>>({});
  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.from('sizes').select('name, image_url');
        if (data) {
          const map: Record<string, string> = {};
          data.forEach((s: any) => {
            if (s.name && s.image_url) {
              map[s.name.trim()] = s.image_url;
            }
          });
          setSizeCutoutMap(map);
        }
      } catch (e) { /* ignore */ }
    })();
  }, []);
  const [installedImagesData, setInstalledImagesData] = useState<Record<number, { face_a?: string; face_b?: string }>>({});
  const [showInstalledImages, setShowInstalledImages] = useState(false);
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState('/ipg.svg');
  const [customizationDialogOpen, setCustomizationDialogOpen] = useState(false);
  const [tableSettingsDialogOpen, setTableSettingsDialogOpen] = useState(false);
  const [maintenanceStatusesMap, setMaintenanceStatusesMap] = useState<Record<string, { label: string; color: string }>>({});
  const [showBillboardStatusOpt, setShowBillboardStatusOpt] = useState(false);
  const [printCityInsteadOfMunicipality, setPrintCityInsteadOfMunicipality] = useState(false);
  const [showBackgroundOptions, setShowBackgroundOptions] = useState(false);
  const [showSizeDimensionLabels, setShowSizeDimensionLabels] = useState(false);
  const [showPreviousAd, setShowPreviousAd] = useState(false);
  const [dynamicDesignsMap, setDynamicDesignsMap] = useState<Record<number, { design_face_a?: string; design_face_b?: string }>>({});
  const [previousAdsData, setPreviousAdsData] = useState<Record<number, string>>({});
  const [resolvedTaskAdType, setResolvedTaskAdType] = useState<string>('');
  const [resolvedReinstallationNumber, setResolvedReinstallationNumber] = useState<number | null>(
    (reinstallationNumber !== null && reinstallationNumber !== undefined && Number(reinstallationNumber) > 0)
      ? Number(reinstallationNumber)
      : (taskType === 'reinstallation' ? 1 : null)
  );

  useEffect(() => {
    if (!open) return;
    if (reinstallationNumber && Number(reinstallationNumber) > 0) {
      setResolvedReinstallationNumber(Number(reinstallationNumber));
    } else if (taskType === 'reinstallation') {
      setResolvedReinstallationNumber(prev => (prev && prev > 0 ? prev : 1));
    }
    const initialAd = (adType || '').trim();
    if (initialAd) {
      setResolvedTaskAdType(initialAd);
    }

    if (contextType === 'installation') {
      (async () => {
        try {
          const tIds = [taskId, ...(taskIds || [])].filter(Boolean).map(String);
          if (tIds.length > 0) {
            // التحقق من رقم إعادة التركيب إذا كانت المهمة إعادة تركيب ولم يُمرر الرقم
            if (taskType === 'reinstallation' && (!reinstallationNumber || Number(reinstallationNumber) <= 0)) {
              const { data: taskData } = await supabase
                .from('installation_tasks')
                .select('id, contract_id, reinstallation_number, created_at')
                .eq('id', tIds[0])
                .maybeSingle();

              if (taskData) {
                if (taskData.reinstallation_number && Number(taskData.reinstallation_number) > 0) {
                  setResolvedReinstallationNumber(Number(taskData.reinstallation_number));
                } else if (taskData.contract_id) {
                  const { data: allReinstalls } = await supabase
                    .from('installation_tasks')
                    .select('id, created_at')
                    .eq('contract_id', taskData.contract_id)
                    .eq('task_type', 'reinstallation')
                    .order('created_at', { ascending: true });

                  if (allReinstalls && allReinstalls.length > 0) {
                    const idx = allReinstalls.findIndex(t => t.id === taskData.id);
                    setResolvedReinstallationNumber(idx >= 0 ? idx + 1 : 1);
                  } else {
                    setResolvedReinstallationNumber(1);
                  }
                } else {
                  setResolvedReinstallationNumber(1);
                }
              } else {
                setResolvedReinstallationNumber(1);
              }
            }

            if (!initialAd) {
              const { data: dData } = await supabase
                .from('task_designs')
                .select('design_name')
                .in('task_id', tIds)
                .not('design_name', 'is', null)
                .limit(1);
              if (dData && dData[0]?.design_name) {
                setResolvedTaskAdType(dData[0].design_name);
                return;
              }

              const { data: tData } = await supabase
                .from('installation_tasks')
                .select('task_name')
                .in('id', tIds)
                .not('task_name', 'is', null)
                .limit(1);
              if (tData && (tData[0] as any)?.task_name) {
                setResolvedTaskAdType((tData[0] as any).task_name);
                return;
              }
            }
          }

          if (!initialAd && contextNumber) {
            const { data: cData } = await supabase
              .from('Contract')
              .select('"Ad Type", ad_type')
              .eq('Contract_Number', Number(contextNumber))
              .limit(1);
            const cAd = cData && (cData[0]?.['Ad Type'] || (cData[0] as any)?.ad_type);
            if (cAd) {
              setResolvedTaskAdType(cAd);
              return;
            }
          }
        } catch {
          // ignore
        }
      })();
    }
  }, [open, contextType, taskType, adType, taskId, taskIds, contextNumber, reinstallationNumber]);

  const parseDimensions = (sizeStr: string) => {
    if (!sizeStr) return { length: '', width: '', height: '' };
    const cleaned = sizeStr.replace(/متر/g, '').replace(/م/g, '').trim();
    const parts = cleaned.split(/[×xX*]/).map(p => p.trim()).filter(Boolean);
    return {
      length: parts[0] || '',
      width: parts[1] || '',
      height: parts[2] || '',
    };
  };

  const generatePrintedSizeHtml = (sizeStr: string, showHeight: boolean, showLabels: boolean = false) => {
    if (!sizeStr) return '';
    const dims = parseDimensions(sizeStr);
    if (!dims.length && !dims.width && !dims.height) return sizeStr;

    const showH = showHeight && !!dims.height;

    return `
      <div class="print-size-container">
        <div class="print-dim-col">
          ${showLabels ? `<div class="print-dim-label">طول</div>` : ''}
          <div class="print-dim-value">${dims.length || '-'}</div>
        </div>
        <div class="print-dim-separator">×</div>
        <div class="print-dim-col">
          ${showLabels ? `<div class="print-dim-label">عرض</div>` : ''}
          <div class="print-dim-value">${dims.width || '-'}</div>
        </div>
        ${showH ? `
          <div class="print-dim-separator">×</div>
          <div class="print-dim-col">
            ${showLabels ? `<div class="print-dim-label">ارتفاع</div>` : ''}
            <div class="print-dim-value">${dims.height}</div>
          </div>
        ` : ''}
      </div>
    `;
  };

  const { settings: customSettings, loading: settingsLoading } = usePrintCustomization();
  const { 
    settings: tableSettings, 
    loading: tableSettingsLoading,
    updateSetting: updateTableSetting,
    saveSettings: saveTableSettings,
    resetToDefaults: resetTableSettings,
    saving: savingTableSettings
  } = useTablePrintSettings();

  // دالة مساعدة لتحديد معرف الفرقة للبند مع مطابقة احتياطية بمدينة اللوحة
  const resolveItemTeamId = (item: BillboardPrintItem): string => {
    if (item.team_id) return item.team_id;
    if (teams && billboards) {
      const bb = billboards[item.billboard_id];
      if (bb?.City) {
        const matchedTeam = Object.values(teams).find(
          (t: any) => Array.isArray(t?.cities) && t.cities.includes(bb.City)
        );
        if (matchedTeam) return (matchedTeam as any).id;
      }
    }
    return 'unknown';
  };

  // تجميع العناصر حسب الفريق
  const itemsByTeam = useMemo(() => {
    if (!showTeamFilter) return { 'all': items };
    const groups: Record<string, BillboardPrintItem[]> = {};
    items.forEach(item => {
      const teamId = resolveItemTeamId(item);
      if (!groups[teamId]) groups[teamId] = [];
      groups[teamId].push(item);
    });
    return groups;
  }, [items, showTeamFilter, teams, billboards]);

  useEffect(() => {
    if (open) {
      setSelectedTeamIds(new Set(Object.keys(itemsByTeam)));
    }
  }, [open, itemsByTeam]);

  // جلب حالات الصيانة (لعرضها أسفل اسم اللوحة)
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from('maintenance_statuses')
        .select('name, color, label');
      if (data) {
        const map: Record<string, { label: string; color: string }> = {};
        data.forEach((st: any) => {
          map[st.name] = {
            label: st.label || st.name,
            color: st.color || '#b91c1c'
          };
        });
        setMaintenanceStatusesMap(map);
      }
    })();
  }, [open]);

  // جلب الصور المركبة والبيانات عند فتح النافذة
  useEffect(() => {
    if (!open) return;
    (async () => {
      const bbIds = [...new Set(items.map(i => i.billboard_id))];
      if (!bbIds.length) return;

      try {
        const { data: itemsWithImages } = await supabase
          .from('installation_task_items')
          .select('billboard_id, installed_image_face_a_url, installed_image_face_b_url, installed_image_url, design_face_a, design_face_b')
          .in('billboard_id', bbIds)
          .not('installed_image_face_a_url', 'is', null);

        if (itemsWithImages && itemsWithImages.length > 0) {
          const imgMap: Record<number, { face_a?: string; face_b?: string }> = {};
          itemsWithImages.forEach((row: any) => {
            if (!imgMap[row.billboard_id]) {
              imgMap[row.billboard_id] = {
                face_a: row.installed_image_face_a_url || row.installed_image_url || undefined,
                face_b: row.installed_image_face_b_url || undefined,
              };
            }
          });
          setInstalledImagesData(imgMap);
        }
      } catch (e) {
        console.error('Error fetching installed images:', e);
      }
    })();
  }, [open, items]);

  // ترتيب اللوحات هرمياً: المقاس أولاً، ثم المدينة / البلدية، ثم المستوى
  const sortBillboardsBySize = async (itemsToSort: BillboardPrintItem[]) => {
    try {
      const [sizesRes, municipalitiesRes, levelsRes] = await Promise.all([
        supabase
          .from('sizes')
          .select('name, sort_order')
          .order('sort_order', { ascending: true }),
        supabase
          .from('municipalities')
          .select('name, code, sort_order')
          .order('sort_order', { ascending: true }),
        supabase
          .from('billboard_levels')
          .select('level_code, level_name, sort_order')
          .order('sort_order', { ascending: true }),
      ]);

      const sizesData = sizesRes.data || [];
      const municipalitiesData = municipalitiesRes.data || [];
      const levelsData = levelsRes.data || [];

      // 1. خريطة المقاسات مع تطبيع النصوص
      const sizeOrderMap = new Map<string, number>();
      const normalizeSizeStr = (str?: string | null) =>
        String(str || '')
          .toLowerCase()
          .replace(/[×*]/g, 'x')
          .replace(/\s+/g, '')
          .trim();

      sizesData.forEach((s: any, idx: number) => {
        const rawName = String(s?.name || '').trim();
        if (!rawName) return;
        const rank = typeof s?.sort_order === 'number' && s.sort_order > 0 ? s.sort_order : idx + 1;
        sizeOrderMap.set(rawName, rank);
        sizeOrderMap.set(normalizeSizeStr(rawName), rank);
      });

      // 2. خريطة البلديات والمدن مع تطبيع الحروف العربية والأسماء الشائعة
      const normalizeArabicStr = (str?: string | null) =>
        String(str || '')
          .trim()
          .replace(/[أإآ]/g, 'ا')
          .replace(/ة/g, 'ه')
          .replace(/[ىي]/g, 'ي')
          .replace(/[\s\-_]/g, '');

      const muniAliases: Record<string, string> = {
        'قصر خيار': 'قصر الاخيار',
        'قصرخيار': 'قصر الاخيار',
        'طرابلس': 'طرابلس المركز',
        'القره بولى': 'القره بوللي',
        'القرهبولي': 'القره بوللي',
        'القرهبوللي': 'القره بوللي',
        'قره بوللي': 'القره بوللي',
        'قرهبولي': 'القره بوللي',
        'مسلاتة': 'امسلاتة',
        'مسلاته': 'امسلاتة',
        'إمسلاتة': 'امسلاتة',
        'امسلاته': 'امسلاتة',
      };

      const muniOrderMap = new Map<string, number>();
      municipalitiesData.forEach((m: any, idx: number) => {
        const rawName = String(m?.name || '').trim();
        if (!rawName) return;
        const rank = typeof m?.sort_order === 'number' && m.sort_order > 0 ? m.sort_order : idx + 1;
        muniOrderMap.set(rawName, rank);
        muniOrderMap.set(normalizeArabicStr(rawName), rank);
        if (m.code) {
          muniOrderMap.set(String(m.code).trim().toUpperCase(), rank);
        }
      });

      // تسجيل الأسماء المرادفة
      Object.entries(muniAliases).forEach(([alias, targetName]) => {
        const targetRank = muniOrderMap.get(targetName) ?? muniOrderMap.get(normalizeArabicStr(targetName));
        if (targetRank !== undefined) {
          muniOrderMap.set(alias, targetRank);
          muniOrderMap.set(normalizeArabicStr(alias), targetRank);
        }
      });

      // 3. خريطة المستويات
      const levelOrderMap = new Map<string, number>();
      levelsData.forEach((l: any, idx: number) => {
        const code = String(l?.level_code || '').trim().toUpperCase();
        const name = String(l?.level_name || '').trim();
        const rank = typeof l?.sort_order === 'number' && l.sort_order > 0 ? l.sort_order : idx + 1;
        if (code) levelOrderMap.set(code, rank);
        if (name) {
          levelOrderMap.set(name, rank);
          levelOrderMap.set(normalizeArabicStr(name), rank);
        }
      });

      const getSizeRank = (rawSize: string): number => {
        const trimmed = String(rawSize || '').trim();
        if (!trimmed) return 9999;
        if (sizeOrderMap.has(trimmed)) return sizeOrderMap.get(trimmed)!;
        const norm = normalizeSizeStr(trimmed);
        if (sizeOrderMap.has(norm)) return sizeOrderMap.get(norm)!;
        const match = norm.match(/(\d+(?:\.\d+)?)\s*x\s*(\d+(?:\.\d+)?)/);
        if (match) {
          const w = parseFloat(match[1]);
          const h = parseFloat(match[2]);
          if (!isNaN(w) && !isNaN(h)) {
            return 9000 - Math.round(w * h * 10);
          }
        }
        return 9999;
      };

      const getMuniRank = (primaryVal: string, fallbackVal: string): number => {
        const v1 = String(primaryVal || '').trim();
        if (v1) {
          if (muniOrderMap.has(v1)) return muniOrderMap.get(v1)!;
          const norm1 = normalizeArabicStr(v1);
          if (muniOrderMap.has(norm1)) return muniOrderMap.get(norm1)!;
        }
        const v2 = String(fallbackVal || '').trim();
        if (v2) {
          if (muniOrderMap.has(v2)) return muniOrderMap.get(v2)!;
          const norm2 = normalizeArabicStr(v2);
          if (muniOrderMap.has(norm2)) return muniOrderMap.get(norm2)!;
        }
        return 9999;
      };

      const getLevelRank = (rawLevel: string): number => {
        const l = String(rawLevel || '').trim();
        if (!l) return 9999;
        const code = l.toUpperCase();
        if (levelOrderMap.has(code)) return levelOrderMap.get(code)!;
        if (levelOrderMap.has(l)) return levelOrderMap.get(l)!;
        const norm = normalizeArabicStr(l);
        if (levelOrderMap.has(norm)) return levelOrderMap.get(norm)!;

        if (code.includes('S') || code.includes('VIP') || norm.includes('مميز')) return 1;
        if (code.includes('A') || norm.includes('اول') || code === '1') return 2;
        if (code.includes('B') || norm.includes('ثاني') || code === '2') return 4;
        if (code.includes('C') || norm.includes('عادي') || norm.includes('ثالث') || code === '3') return 5;
        if (code.includes('D') || norm.includes('رابع') || code === '4') return 6;
        return 9999;
      };

      return [...itemsToSort].sort((a, b) => {
        const billboardA = billboards[a.billboard_id];
        const billboardB = billboards[b.billboard_id];

        // 1. الترتيب الأول: المقاس
        const sizeA = billboardA?.Size || (billboardA as any)?.size || '';
        const sizeB = billboardB?.Size || (billboardB as any)?.size || '';
        const sizeRankA = getSizeRank(sizeA);
        const sizeRankB = getSizeRank(sizeB);
        if (sizeRankA !== sizeRankB) return sizeRankA - sizeRankB;

        // 2. الترتيب الثاني: المدينة / البلدية
        const primaryA = printCityInsteadOfMunicipality ? (billboardA?.City || '') : (billboardA?.Municipality || '');
        const fallbackA = printCityInsteadOfMunicipality ? (billboardA?.Municipality || '') : (billboardA?.City || '');
        const primaryB = printCityInsteadOfMunicipality ? (billboardB?.City || '') : (billboardB?.Municipality || '');
        const fallbackB = printCityInsteadOfMunicipality ? (billboardB?.Municipality || '') : (billboardB?.City || '');

        const muniRankA = getMuniRank(primaryA, fallbackA);
        const muniRankB = getMuniRank(primaryB, fallbackB);
        if (muniRankA !== muniRankB) return muniRankA - muniRankB;

        // 3. الترتيب الثالث: المستوى
        const levelA = billboardA?.Level || (billboardA as any)?.level || billboardA?.Category_Level || '';
        const levelB = billboardB?.Level || (billboardB as any)?.level || billboardB?.Category_Level || '';
        const levelRankA = getLevelRank(levelA);
        const levelRankB = getLevelRank(levelB);
        if (levelRankA !== levelRankB) return levelRankA - levelRankB;

        // 4. ترتيب ثانوي لضمان الثبات: رقم اللوحة ثم الاسم
        const idA = Number(billboardA?.ID || a.billboard_id || 0);
        const idB = Number(billboardB?.ID || b.billboard_id || 0);
        if (idA !== idB && idA > 0 && idB > 0) return idA - idB;

        return String(billboardA?.Billboard_Name || '').localeCompare(String(billboardB?.Billboard_Name || ''), 'ar');
      });
    } catch (err) {
      console.error('Error in sortBillboardsBySize:', err);
      return itemsToSort;
    }
  };

  const getContextLabel = () => {
    switch (contextType) {
      case 'installation': return 'تركيب';
      case 'removal': return 'إزالة';
      case 'contract': return 'عقد';
      case 'offer': return 'عرض';
      default: return 'عنصر';
    }
  };

  const imageToDataUrl = async (url: string): Promise<string> => {
    try {
      const response = await fetch(url, { mode: 'cors' });
      const blob = await response.blob();
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result as string);
        reader.readAsDataURL(blob);
      });
    } catch {
      return url;
    }
  };

  const svgToPngDataUrl = (svgDataUrl: string): Promise<string> =>
    new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth || 80;
        canvas.height = img.naturalHeight || 80;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => resolve(svgDataUrl);
      img.src = svgDataUrl;
    });

  const blobToDataUrl = (blob: Blob): Promise<string> =>
    new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.readAsDataURL(blob);
    });

  const filteredItems = useMemo(() => {
    if (!showTeamFilter) return items;

    let result = items;

    // فلتر حسب الفرق المختارة
    if (selectedTeamIds.size > 0) {
      result = result.filter(item => {
        const teamId = resolveItemTeamId(item);
        return selectedTeamIds.has(teamId);
      });
    } else {
      result = [];
    }

    // فلتر حسب حدود مدن الفرق
    if (respectCityLimits && selectedTeamIds.size > 0) {
      result = result.filter(item => {
        const teamId = resolveItemTeamId(item);
        const team = teams[teamId];
        const billboard = billboards[item.billboard_id];
        if (!team || !billboard) return true;
        const teamCities: string[] = team.cities || [];
        if (!teamCities.length) return true;
        return teamCities.includes(billboard.City);
      });
    }

    return result;
  }, [items, selectedTeamIds, showTeamFilter, respectCityLimits, teams, billboards]);

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

  const selectAllTeams = () => setSelectedTeamIds(new Set(Object.keys(itemsByTeam)));
  const clearTeamSelection = () => setSelectedTeamIds(new Set());

  const getInstallationTitle = () => {
    const primaryTaskId = taskId ? String(taskId) : (taskIds && taskIds.length > 0 ? String(taskIds[0]) : '');
    const taskShortId = primaryTaskId ? (primaryTaskId.length > 8 ? primaryTaskId.slice(0, 8) : primaryTaskId) : '';
    const isReinstall = taskType === 'reinstallation';
    const rawNum = reinstallationNumber ?? resolvedReinstallationNumber;
    const reinstallNum = (rawNum !== null && rawNum !== undefined && Number(rawNum) > 0)
      ? Number(rawNum)
      : (isReinstall ? 1 : null);
    const taskTypeLabel = isReinstall
      ? `إعادة تركيب رقم ${reinstallNum || 1}`
      : 'تركيب جديد';

    const parts: string[] = [];
    if (!hideAdType && contextNumber) {
      parts.push(`تركيب رقم: ${contextNumber}`);
    }
    if (taskShortId) {
      parts.push(`مهمة #${taskShortId}`);
    }
    parts.push(taskTypeLabel);
    const rawAd = (adType || resolvedTaskAdType || taskName || '').trim();
    const cleanAd = rawAd.replace(/^نوع\s*الإعلان\s*:\s*/, '').trim();
    if (!hideAdType && cleanAd) {
      parts.push(`نوع الإعلان: ${cleanAd}`);
    }
    return parts.join(' - ');
  };

  const getCleanDocumentTitle = () => {
    if (contextType === 'installation') {
      return getInstallationTitle();
    }

    const label = getContextLabel();
    let rawCust = (customerName || '').trim();
    let rawCompany = (companyName || '').trim();
    const allTeamNames = Object.values(teams || {}).map(t => t?.team_name).filter(Boolean);

    // حساب اسم الفريق المختار (يظهر في ترويسة نافذة الطباعة فقط عند تفعيل الخيار)
    let selectedTeamStr = '';
    if (showTeamInHeader) {
      if (selectedTeamIds.size > 0) {
        selectedTeamStr = Array.from(selectedTeamIds).map(id => teams[id]?.team_name).filter(Boolean).join(' - ');
      } else {
        const isTeam = allTeamNames.some(tn => tn === rawCust);
        if (isTeam) {
          selectedTeamStr = rawCust;
        } else {
          const firstTeamId = items.find(i => i.team_id)?.team_id;
          if (firstTeamId && teams[firstTeamId]?.team_name) {
            selectedTeamStr = teams[firstTeamId].team_name;
          }
        }
      }
    }

    // تجهيز اسم الزبون والشركة (إذا لم يكن الإخفاء مفعلاً)
    let customerDisplay = '';
    if (!hideCustomerName) {
      const isTeam = allTeamNames.some(tn => tn === rawCust);
      if (!isTeam) {
        customerDisplay = [rawCust, rawCompany].filter(Boolean).join(' - ');
      }
    }

    const isTeamContext = allTeamNames.some(tn => tn === rawCust);
    const displayNum = (contextNumber && !isTeamContext) ? `#${contextNumber}` : '';

    const parts = [
      printMode === 'table' ? `جدول ${label}` : `مهام ${label}`,
      displayNum,
      customerDisplay,
      selectedTeamStr ? `[فريق ${selectedTeamStr}]` : '',
      `${filteredItems.length} لوحة`
    ].filter(Boolean);

    return parts.join(' - ');
  };

  const generatePrintHTML = async () => {
    const sortedItems = await sortBillboardsBySize(filteredItems);
    const [freshPrevAds, freshDesigns] = await Promise.all([
      resolveBillboardPreviousAds(sortedItems, contextNumber, billboards),
      resolveBillboardDesigns(sortedItems, billboards)
    ]);
    const pages: string[] = [];
    const s = customSettings || {} as Record<string, string>;
    const toCssLength = (value?: string) => {
      const raw = String(value ?? '').trim();
      if (!raw) return '0mm';
      if (/^-?\d+(\.\d+)?$/.test(raw)) return `${raw}mm`;
      return raw;
    };

    for (let pageIndex = 0; pageIndex < sortedItems.length; pageIndex++) {
      const item = sortedItems[pageIndex];
      const sequentialNumber = pageIndex + 1;
      const billboard = billboards[item.billboard_id];
      if (!billboard) continue;

      const bIdKey = String(item.billboard_id);
      const facesCount = resolveFacesCount(item, billboard);
      const supportsBackFace = facesCount > 1;
      const dynDesign = freshDesigns[bIdKey] || dynamicDesignsMap[item.billboard_id] || dynamicDesignsMap[Number(item.billboard_id)];
      const designFaceA = item.design_face_a || billboard.design_face_a || billboard.installed_design_face_a || dynDesign?.design_face_a || null;
      const designFaceB = supportsBackFace
        ? item.design_face_b || billboard.design_face_b || billboard.installed_design_face_b || dynDesign?.design_face_b || null
        : null;
      const itemPreviousAd = (item as any).previous_ad || (item as any).previous_ad_type || 
                             freshPrevAds[bIdKey] || 
                             previousAdsData[item.billboard_id] || previousAdsData[bIdKey] || previousAdsData[Number(item.billboard_id)] || 
                             billboards[item.billboard_id]?.previous_ad || billboards[item.billboard_id]?.previous_ad_type || '';

      // صور التركيب: يتم جلبها أو استخدامها فقط إذا لم يتم تفعيل خيار إخفاء صور التركيب
      const allowInstalledImages = !hideInstalledImages;
      const fetchedInstalled = (allowInstalledImages && showInstalledImages) ? installedImagesData[item.billboard_id] : null;
      const installedImageFaceA = allowInstalledImages
        ? (item.installed_image_face_a_url || fetchedInstalled?.face_a || null)
        : null;
      const installedImageFaceB = (allowInstalledImages && supportsBackFace)
        ? (item.installed_image_face_b_url || fetchedInstalled?.face_b || null)
        : null;

      const mainImage = (installedImageFaceA || installedImageFaceB) && !(installedImageFaceA && installedImageFaceB)
        ? (installedImageFaceA || installedImageFaceB)
        : (billboard.Image_URL || '');

      const coords = billboard.GPS_Coordinates || '';
      const mapLink = coords 
        ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` 
        : 'https://www.google.com/maps?q=';

      let qrCodeDataUrl = '';
      try {
        if (coords) qrCodeDataUrl = await QRCode.toDataURL(mapLink, { width: 400, margin: 1 });
      } catch (error) {
        console.error('Error generating QR code:', error);
      }

      // توليد صورة الدبوس - استخدام إعدادات التخصيص إن وجدت
      const billboardSize = billboard.Size || '';
      const pinColor = customSettings?.pin_color || '';
      const pinTextColor = customSettings?.pin_text_color || '';
      const customPinUrl = customSettings?.custom_pin_url || '';

      let pinSvgDataUrl: string;
      if (customPinUrl) {
        pinSvgDataUrl = customPinUrl;
      } else {
        const billboardStatus = getBillboardStatus(billboard);
        const pinData = createPinSvgUrl(billboardSize, billboardStatus.label, false, undefined, undefined, pinColor || undefined, pinTextColor || undefined);
        pinSvgDataUrl = pinData.url;
      }

      const hasDesigns = designFaceA || designFaceB;
      const name = billboard.Billboard_Name || `لوحة ${item.billboard_id}`;
      const municipality = printCityInsteadOfMunicipality ? (billboard.City || '') : (billboard.Municipality || '');
      const district = billboard.District || '';
      const landmark = billboard.Nearest_Landmark || '';
      const size = billboard.Size || '';
      const municipalityDistrict = [municipality, district].filter(Boolean).join(' - ') || '—';

      const installationDate = (!hideInstallDate && item.installation_date)
        ? new Date(item.installation_date).toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' })
        : '';

      // نص حالة اللوحة (يظهر أسفل الاسم)
      const mStatusKey = (billboard.maintenance_status || '').toString().trim();
      const showBillboardStatus = showBillboardStatusOpt && mStatusKey;
      const mStatusInfo = mStatusKey ? maintenanceStatusesMap[mStatusKey] : undefined;
      const billboardStatusLabel = mStatusInfo?.label || mStatusKey;
      const billboardStatusColor = mStatusInfo?.color || '#b91c1c';
      const billboardStatusFontSize = (s as any).billboard_status_font_size || '14px';
      const billboardStatusOffsetY = (s as any).billboard_status_offset_y || '6mm';

      const resolvedTId = resolveItemTeamId(item);
      const itemTeamName = resolvedTId && teams[resolvedTId]?.team_name ? teams[resolvedTId].team_name : '';
      const displayTeamNames = itemTeamName || (showTeamFilter 
        ? Array.from(selectedTeamIds).map(id => teams[id]?.team_name).filter(Boolean).join(' - ')
        : '');

      const itemContractNumber = item.contract_number || contextNumber;
      const b = billboard || {};
      const rawItemAdType = (
        item.ad_type ||
        dynDesign?.design_name ||
        adType ||
        resolvedTaskAdType ||
        b.ad_type ||
        b.design_name ||
        b.ad_name ||
        b.current_ad ||
        taskName ||
        ''
      ).trim();
      const cleanAdType = !hideAdType ? rawItemAdType.replace(/^نوع\s*الإعلان\s*:\s*/, '').trim() : '';
      const customerCompanyText = !hideCustomerName ? [customerName, companyName].filter(Boolean).join(' - ') : '';

      let contractInfoText = '';
      if (contextType === 'installation') {
        if (!hideAdType) {
          if (cleanAdType) {
            contractInfoText = `نوع الإعلان: ${cleanAdType}`;
          } else if (itemContractNumber) {
            contractInfoText = `تركيب رقم: ${itemContractNumber}`;
          }
        }
      } else {
        const parts = [
          itemContractNumber ? `${getContextLabel()} رقم: ${itemContractNumber}` : '',
          customerCompanyText ? `الزبون: ${customerCompanyText}` : '',
          cleanAdType ? `نوع الإعلان: ${cleanAdType}` : ''
        ].filter(Boolean);
        contractInfoText = parts.join(' - ');
      }

      // تحديد الصورة الرئيسية والتراكب المفرغ إن وجد
      const hasMainImage = !!mainImage;
      const showPinFallback = contextType !== 'contract' && contextType !== 'offer' && contextType !== 'installation' && contextType !== 'removal';

      const ov = item.overlay_config || billboard?.overlay_config;
      const isImageActive = ov ? ov.show_image !== false : true;
      const isOverlayActive = ov ? ov.enabled !== false : true;
      const isCutoutEnabled = item.has_cutout === true || (item.has_cutout !== false && Boolean(billboard?.has_cutout));
      const sizeKey = size?.trim() || '';
      const sizeCutoutUrl = sizeCutoutMap[sizeKey] || sizeCutoutMap[sizeKey.replace(/×/g, 'x').replace(/X/g, 'x')] || null;
      const activeCutout = isCutoutEnabled ? (ov?.cutout_image_url || sizeCutoutUrl || null) : null;

      const isDesignsIncluded = Boolean(includeDesigns && hasDesigns);
      const layoutMode = !isDesignsIncluded ? 'no-design' : isCutoutEnabled ? 'with-cutout'
        : !supportsBackFace ? 'one-face' : !designFaceA || !designFaceB ? 'one-design' : 'normal';
      const effectiveS = { ...s, ...s.status_overrides?.[layoutMode] };

      const layout = resolvePrintCardLayout(effectiveS, {
        hasDesigns: isDesignsIncluded,
        pairedImages: Boolean(installedImageFaceA && installedImageFaceB),
        dimensionLabels: showSizeDimensionLabels,
        size,
      });
      const allowedImageHeight = `${layout.imageHeight}mm`;
      const maxAllowedWidth = `${layout.imageWidth}mm`;

      let imageSection = '';
      if (hasMainImage && isImageActive) {
        if (isOverlayActive) {
          const x = ov?.x_pct ?? 50;
          const y = ov?.y_pct ?? 50;
          const scale = (ov?.scale_pct ?? 100) / 100;
          const rot = ov?.rotation_deg ?? 0;
          const cropBottom = ov?.crop_bottom_pct || 0;
          const isV2 = ov?.anchor_version === 'v2';
          const translateY = isV2 ? '-100%' : '-50%';
          const transformOrigin = isV2 ? 'bottom center' : 'center center';

          imageSection = `
            <div class="overlay-container" style="position: relative; width: 100%; max-width: ${maxAllowedWidth}; height: ${allowedImageHeight}; max-height: ${allowedImageHeight}; display: inline-flex; align-items: center; justify-content: center; overflow: visible;">
              <img src="${mainImage}" alt="صورة اللوحة" class="billboard-image" style="max-height: ${allowedImageHeight}; max-width: ${maxAllowedWidth}; width: auto; height: auto; object-fit: contain; display: block;" />
              ${activeCutout ? `
                <img src="${activeCutout}" class="overlay-cutout" data-x="${x}" data-y="${y}" data-scale="${scale}" data-rot="${rot}" data-anchor="${isV2 ? 'v2' : 'v1'}" style="
                  position: absolute;
                  left: ${x}%;
                  top: ${y}%;
                  width: 27.15%;
                  height: auto;
                  display: block;
                  transform: translate(-50%, ${translateY}) scale(${scale}) rotate(${rot}deg);
                  transform-origin: ${transformOrigin};
                  clip-path: inset(0 0 ${cropBottom}% 0);
                  -webkit-clip-path: inset(0 0 ${cropBottom}% 0);
                  z-index: 10;
                " />
              ` : ''}
            </div>
          `;
        } else {
          imageSection = `<img src="${mainImage}" alt="صورة اللوحة" class="billboard-image" style="max-height: ${allowedImageHeight}; max-width: ${maxAllowedWidth}; width: auto; height: auto; object-fit: contain; display: block;" />`;
        }
      } else if (hasMainImage) {
        imageSection = `<img src="${mainImage}" alt="صورة اللوحة" class="billboard-image" style="max-height: ${allowedImageHeight}; max-width: ${maxAllowedWidth}; width: auto; height: auto; object-fit: contain; display: block;" />`;
      } else if (showPinFallback) {
        imageSection = `<div class="pin-fallback" style="width: ${effectiveS.main_image_width || '120mm'}; height: ${allowedImageHeight};">
            <img src="${pinSvgDataUrl}" alt="دبوس اللوحة" style="width: 80px; height: auto; margin-bottom: 8px;" />
            <div style="font-size: 11px; color: #666; direction: ltr;">${coords || 'لا توجد إحداثيات'}</div>
          </div>`;
      } else {
        imageSection = `<div class="pin-fallback" style="width: ${effectiveS.main_image_width || '120mm'}; height: ${allowedImageHeight};">
            <div style="font-size: 13px; color: #999; direction: rtl;">لا توجد صورة</div>
            <div style="font-size: 11px; color: #666; direction: ltr; margin-top: 4px;">${coords || 'لا توجد إحداثيات'}</div>
          </div>`;
      }

      pages.push(`
        <div class="page" data-print-page>
          <div class="background"><img src="${customBackgroundUrl}" alt="" /></div>

          ${contextType !== 'contract' && contextType !== 'offer' && contextType !== 'installation' && contextType !== 'removal' ? `
          <div class="absolute-field pin-badge">
            <img src="${pinSvgDataUrl}" alt="دبوس" style="width: 60px; height: auto;" />
          </div>
          ` : ''}

          ${contractInfoText ? `
          <div class="absolute-field contract-number" style="top: ${s.contract_number_top}; right: ${s.contract_number_right}; left: auto; width: 85mm; max-width: 85mm; font-size: ${s.contract_number_font_size}; font-weight: ${s.contract_number_font_weight}; color: ${s.contract_number_color}; text-align: right; overflow-wrap: anywhere; ${s.contract_number_offset_x && s.contract_number_offset_x !== '0mm' ? `margin-right: ${s.contract_number_offset_x};` : ''}">
            ${contractInfoText ? `<div>${contractInfoText}</div>` : ''}
          </div>
          ` : ''}
          ${(showPreviousAd && itemPreviousAd) || (contextType === 'installation' && customerCompanyText) ? `
          <div class="absolute-field print-details" style="top: 74mm; left: 12mm; width: 138mm; font-size: 12px; line-height: 1.3; text-align: right;">
            ${showPreviousAd && itemPreviousAd ? `<div class="previous-ad-row">الإعلان السابق: ${itemPreviousAd}</div>` : ''}
            ${contextType === 'installation' && customerCompanyText ? `<div>الزبون: ${customerCompanyText}</div>` : ''}
          </div>
          ` : ''}

          ${installationDate ? `
          <div class="absolute-field installation-date" style="top: ${s.installation_date_top}; right: ${s.installation_date_right}; font-family: '${s.primary_font}', Arial, sans-serif; font-size: ${s.installation_date_font_size}; font-weight: ${s.installation_date_font_weight || '400'}; color: ${s.installation_date_color}; text-align: ${s.installation_date_alignment}; ${s.installation_date_offset_x && s.installation_date_offset_x !== '0mm' ? `margin-right: ${s.installation_date_offset_x};` : ''}">
            ${contextType === 'removal' ? 'تاريخ الإزالة' : 'تاريخ التركيب'}: ${installationDate}
          </div>
          ` : ''}

          <div class="absolute-field billboard-name" style="top: ${toCssLength(s.billboard_name_top)}; left: ${layout.nameCenter - layout.nameWidth / 2}mm; width: ${layout.nameWidth}mm; text-align: ${s.billboard_name_alignment || 'center'}; font-size: ${s.billboard_name_font_size}; font-weight: ${s.billboard_name_font_weight}; color: ${s.billboard_name_color};">
            ${name}
          </div>

          ${showBillboardStatus ? `
          <div class="absolute-field billboard-status" style="top: calc(${toCssLength(s.billboard_name_top)} + ${s.billboard_name_font_size} + ${toCssLength(billboardStatusOffsetY)}); left: ${layout.nameCenter - layout.nameWidth / 2}mm; width: ${layout.nameWidth}mm; text-align: ${s.billboard_name_alignment || 'center'}; font-size: ${billboardStatusFontSize}; font-weight: 600; color: ${billboardStatusColor};">
            ${billboardStatusLabel}
          </div>
          ` : ''}

          <div class="absolute-field size" style="top: ${layout.sizeTop}mm; left: ${layout.sizeCenter - 21}mm; width: 42mm; text-align: center; font-size: ${s.size_font_size}; font-weight: ${s.size_font_weight}; color: ${s.size_color};">
            ${generatePrintedSizeHtml(size, false, showSizeDimensionLabels)}
          </div>

          <div class="absolute-field faces-count" style="top: ${layout.facesTop}mm; left: ${layout.sizeCenter - 21}mm; width: 42mm; text-align: center; font-size: ${s.faces_count_font_size}; color: ${s.faces_count_color}; font-weight: 600;">
            ${isCutoutEnabled ? 'مجسم - ' : ''}${formatFacesCountArabic(facesCount)}
          </div>

          ${printType === 'installation' && showTeamInContent && displayTeamNames ? `
            <div class="absolute-field print-type" style="top: ${s.team_name_top}; right: ${s.team_name_right}; font-size: ${s.team_name_font_size}; color: ${s.team_name_color || '#000'}; font-weight: ${s.team_name_font_weight}; text-align: ${s.team_name_alignment}; ${s.team_name_offset_x && s.team_name_offset_x !== '0mm' ? `margin-right: ${s.team_name_offset_x};` : ''}">
               ${contextType === 'removal' ? 'فريق الإزالة' : 'فريق التركيب'}: ${displayTeamNames}
            </div>
          ` : ''}

          ${installedImageFaceA && installedImageFaceB ? `
            <div class="absolute-field installed-images-container" style="top: ${layout.imageTop}mm; left: ${layout.imageCenter}mm; transform: translateX(-50%); width: ${maxAllowedWidth}; --installed-image-height: ${allowedImageHeight}; height: ${allowedImageHeight}; max-height: ${allowedImageHeight}; display: flex; gap: ${effectiveS.installed_images_gap || '5mm'}; justify-content: center; align-items: center;">
              <div class="installed-image-column" style="flex: 1; max-width: calc(50% - (${effectiveS.installed_images_gap || '5mm'} / 2)); height: 100%; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <div style="font-size: 12px; font-weight: 600; color: #000; margin-bottom: 2mm;">الوجه الأمامي</div>
                <div class="installed-image-box" style="height: 100%; max-height: ${allowedImageHeight}; width: 100%; display: flex; align-items: center; justify-content: center; background: transparent; border: none; overflow: visible;">
                  <img src="${installedImageFaceA}" alt="الوجه الأمامي" class="billboard-image installed-image" style="max-height: ${allowedImageHeight}; max-width: 100%; width: auto; height: auto; object-fit: contain; display: block; margin: 0 auto; border: 2px solid #000; border-radius: 8px; box-sizing: border-box;" />
                </div>
              </div>
              <div class="installed-image-column" style="flex: 1; max-width: calc(50% - (${effectiveS.installed_images_gap || '5mm'} / 2)); height: 100%; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <div style="font-size: 12px; font-weight: 600; color: #000; margin-bottom: 2mm;">الوجه الخلفي</div>
                <div class="installed-image-box" style="height: 100%; max-height: ${allowedImageHeight}; width: 100%; display: flex; align-items: center; justify-content: center; background: transparent; border: none; overflow: visible;">
                  <img src="${installedImageFaceB}" alt="الوجه الخلفي" class="billboard-image installed-image" style="max-height: ${allowedImageHeight}; max-width: 100%; width: auto; height: auto; object-fit: contain; display: block; margin: 0 auto; border: 2px solid #000; border-radius: 8px; box-sizing: border-box;" />
                </div>
              </div>
            </div>
          ` : `
            <div class="absolute-field image-container" style="top: ${layout.imageTop}mm; left: ${layout.imageCenter}mm; transform: translateX(-50%); width: ${maxAllowedWidth}; height: ${allowedImageHeight}; max-height: ${allowedImageHeight}; display: flex; align-items: center; justify-content: center;">
              ${imageSection}
            </div>
          `}

          <div class="absolute-field location-info" style="top: ${layout.locationTop}mm; left: ${layout.location.left}mm; width: ${layout.location.width}mm; font-size: ${s.location_info_font_size}; color: ${s.location_info_color}; text-align: ${s.location_info_alignment};">
            ${municipalityDistrict}
          </div>

          <div class="absolute-field landmark-info" style="top: ${s.landmark_info_top}; left: ${layout.landmark.left}mm; width: ${layout.landmark.width}mm; font-size: ${s.landmark_info_font_size}; color: ${s.landmark_info_color}; text-align: ${s.landmark_info_alignment};">
            ${landmark || '—'}
          </div>

          ${qrCodeDataUrl ? `
            <div class="absolute-field qr-container" style="top: ${s.qr_top}; left: ${s.qr_left}; width: ${s.qr_size}; height: ${s.qr_size};">
              <a href="${mapLink}" target="_blank" style="display:block;width:100%;height:100%;" title="اضغط لفتح الموقع على الخريطة">
                <img src="${qrCodeDataUrl}" alt="QR" class="qr-code" style="cursor:pointer;" />
              </a>
            </div>
          ` : ''}

          ${isDesignsIncluded ? `
            <div class="absolute-field designs-section" style="top: ${layout.designsTop}mm; left: ${layout.designsLeft}mm; width: ${layout.designsWidth}mm; --design-height: ${layout.designHeight}mm; display: flex; gap: ${effectiveS.designs_gap}; align-items: flex-start;">
              ${designFaceA ? `
                <div class="design-item">
                  <div class="design-label">${showDesignName && cleanAdType ? cleanAdType : 'تصميم الوجه الأمامي'}</div>
                  <img src="${designFaceA}" alt="تصميم الوجه الأمامي" class="design-image" style="max-height: var(--design-height);" />
                </div>
              ` : ''}
              ${designFaceB ? `
                <div class="design-item">
                  <div class="design-label">${showDesignName && cleanAdType ? cleanAdType : 'تصميم الوجه الخلفي'}</div>
                  <img src="${designFaceB}" alt="تصميم الوجه الخلفي" class="design-image" style="max-height: var(--design-height);" />
                </div>
              ` : ''}
            </div>
          ` : ''}
        </div>
      `);
    }

    const baseUrl = window.location.origin;

    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8" />
        <title>${getCleanDocumentTitle()}</title>
        <style>
          @font-face {
            font-family: 'Manrope';
            src: url('${baseUrl}/Manrope-Medium.otf') format('opentype');
            font-weight: 500;
            font-style: normal;
            font-display: block;
          }
          @font-face {
            font-family: 'Manrope';
            src: url('${baseUrl}/Manrope-Bold.otf') format('opentype');
            font-weight: 700;
            font-style: normal;
            font-display: block;
          }
          @font-face {
            font-family: 'Doran';
            src: url('${baseUrl}/Doran-Medium.otf') format('opentype');
            font-weight: 500;
            font-style: normal;
            font-display: block;
          }
          @font-face {
            font-family: 'Doran';
            src: url('${baseUrl}/Doran-Bold.otf') format('opentype');
            font-weight: 700;
            font-style: normal;
            font-display: block;
          }

          * { margin: 0; padding: 0; box-sizing: border-box; }

          body {
            font-family: 'Doran', Arial, sans-serif;
            direction: rtl;
            background: white;
            color: #000;
            margin: 0;
            padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          .page {
            position: relative;
            width: 210mm;
            height: 297mm;
            margin: 0 auto;
            page-break-after: always;
            page-break-inside: avoid;
            overflow: hidden;
          }

          .page:last-child { page-break-after: avoid; }

          .background {
            position: absolute;
            top: 0; left: 0;
            width: 100%; height: 100%;
            z-index: 0;
          }
          .background img {
            width: 100%; height: 100%;
            object-fit: fill;
            display: block;
            transform: translateZ(0);
            backface-visibility: hidden;
            image-rendering: -webkit-optimize-contrast;
          }

          .absolute-field {
            position: absolute;
            z-index: 5;
            color: #000;
            font-family: 'Doran', Arial, sans-serif;
            text-rendering: geometricPrecision;
            -webkit-font-smoothing: antialiased;
            font-smooth: always;
            line-height: 1.2;
          }

          .billboard-name { font-family: 'Doran', Arial, sans-serif; font-size: 20px; font-weight: 500; color: #333; line-height: 1.2; }
          .size { font-family: 'Manrope', Arial, sans-serif; font-size: 41px; font-weight: 700; line-height: 1.1; display: flex; justify-content: center; align-items: center; }
          .faces-count { line-height: 1.3; }
          .print-size-container { display: inline-flex; align-items: center; justify-content: center; gap: 0.12em; direction: rtl; color: inherit; white-space: nowrap; }
          .print-dim-col { display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; color: inherit; }
          .print-dim-label { font-family: 'Doran', sans-serif; font-size: 9px; margin-bottom: 1mm; }
          .print-dim-value { font-weight: inherit; }
          .print-dim-separator { margin: 0 0.1em; opacity: 0.7; }
          .contract-number { font-family: 'Doran', Arial, sans-serif; font-size: 16px; font-weight: 500; line-height: 1.2; }
          .location-info, .landmark-info { font-family: 'Doran', Arial, sans-serif; font-size: 16px; line-height: 1.2; }

          .image-container {
            overflow: visible;
            background: transparent;
            border: none;
            display: flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
          }

          .installed-images-container {
            overflow: visible;
            background: transparent;
            border: none;
            box-sizing: border-box;
          }
          .installed-images-container .installed-image-column {
            min-width: 0;
            height: auto !important;
            max-height: 100%;
            justify-content: flex-start;
          }
          .installed-images-container .installed-image-box {
            height: auto !important;
            max-height: calc(100% - 6mm) !important;
            flex: 0 1 auto;
            min-height: 0;
          }
          .installed-images-container .installed-image {
            max-height: calc(var(--installed-image-height, 85mm) - 6mm) !important;
          }

          .billboard-image, .installed-image {
            max-width: 100%;
            max-height: 100%;
            width: auto;
            height: auto;
            object-fit: contain;
            display: block;
            border: 2px solid #000;
            border-radius: 8px;
            box-sizing: border-box;
          }
          .qr-code { width: 100%; height: 100%; object-fit: contain; }

          .sequential-number {
            top: 8mm; left: 8mm;
            font-family: 'Manrope', Arial, sans-serif;
            font-size: 32px; font-weight: 800;
            color: #1a1a2e;
            background: rgba(255,255,255,0.85);
            border: 2px solid #1a1a2e;
            border-radius: 50%;
            width: 48px; height: 48px;
            display: flex; align-items: center; justify-content: center;
            line-height: 1;
          }

          .pin-badge { top: 8mm; left: 60mm; }

          .pin-fallback {
            width: 100%; height: 100%;
            display: flex; flex-direction: column;
            align-items: center; justify-content: center;
            background: #f8f9fa; border: 2px dashed #ccc; border-radius: 8px;
          }

          .designs-section { flex-wrap: nowrap; justify-content: center; }
          .design-item { flex: 1 1 0; min-width: 0; text-align: center; display: flex; flex-direction: column; align-items: center; }
          .design-label { font-family: 'Doran', Arial, sans-serif; font-size: 12px; font-weight: 500; margin-bottom: 2mm; color: #333; line-height: 1.3; white-space: normal; overflow-wrap: anywhere; max-width: 100%; min-height: 4mm; }
          .design-image {
            max-width: 100%;
            max-height: 42mm;
            width: auto;
            height: auto;
            object-fit: contain;
            border: 2px solid #000;
            border-radius: 8px;
            box-sizing: border-box;
            display: block;
            margin: 0 auto;
          }
          .designs-section { overflow: hidden; }

          @page { size: A4 portrait; margin: 0; }

          @media print {
            body { 
              -webkit-print-color-adjust: exact !important; 
              print-color-adjust: exact !important;
              margin: 0;
              padding: 0;
            }
            .page { 
              page-break-after: always; 
              box-shadow: none; 
              width: 210mm !important;
              height: 297mm !important;
              min-height: 297mm !important;
              position: relative !important;
              overflow: hidden !important;
              margin: 0 !important;
            }
            .page:last-child { page-break-after: auto; }
          }
        </style>
      </head>
      <body class="print-portrait" data-orientation="portrait">
        ${pages.join('\n')}
        <script>
          var fitPrintCardText = ${fitPrintCardText.toString()};
          function adjustOverlayPositions() {
            fitPrintCardText(document);
            var containers = document.querySelectorAll('.overlay-container');
            containers.forEach(function(container) {
              var bgImg = container.querySelector('.billboard-image');
              var cutoutImg = container.querySelector('.overlay-cutout');
              if (!bgImg || !cutoutImg) return;

              var cw = container.clientWidth;
              var ch = container.clientHeight;
              var nw = bgImg.naturalWidth;
              var nh = bgImg.naturalHeight;
              if (!cw || !ch || !nw || !nh) return;

              var imgRatio = nw / nh;
              var boxRatio = cw / ch;

              var renderW = cw;
              var renderH = ch;
              var renderLeft = 0;
              var renderTop = 0;

              if (imgRatio > boxRatio) {
                renderH = cw / imgRatio;
                renderTop = (ch - renderH) / 2;
              } else {
                renderW = ch * imgRatio;
                renderLeft = (cw - renderW) / 2;
              }

              var xPct = parseFloat(cutoutImg.getAttribute('data-x') || '50');
              var yPct = parseFloat(cutoutImg.getAttribute('data-y') || '50');
              var scale = parseFloat(cutoutImg.getAttribute('data-scale') || '1');
              var rot = parseFloat(cutoutImg.getAttribute('data-rot') || '0');
              var isV2 = cutoutImg.getAttribute('data-anchor') === 'v2';

              var overlayLeftPx = renderLeft + (xPct / 100) * renderW;
              var overlayTopPx = renderTop + (yPct / 100) * renderH;
              var overlayWidthPx = (27.15 / 100) * renderW;

              var translateY = isV2 ? '-100%' : '-50%';
              var transformOrigin = isV2 ? 'bottom center' : 'center center';

              cutoutImg.style.left = overlayLeftPx + 'px';
              cutoutImg.style.top = overlayTopPx + 'px';
              cutoutImg.style.width = overlayWidthPx + 'px';
              cutoutImg.style.transform = 'translate(-50%, ' + translateY + ') scale(' + scale + ') rotate(' + rot + 'deg)';
              cutoutImg.style.transformOrigin = transformOrigin;
            });
          }

          document.fonts.ready.then(function() {
            var images = document.querySelectorAll('img');
            var loadedCount = 0;
            var totalImages = images.length;
            function checkAllLoaded() {
              loadedCount++;
              if (loadedCount >= totalImages) {
                adjustOverlayPositions();
              }
            }
            if (totalImages === 0) {
              adjustOverlayPositions();
            } else {
              images.forEach(function(img) {
                if (img.complete) checkAllLoaded();
                else { img.onload = checkAllLoaded; img.onerror = checkAllLoaded; }
              });
            }
          });
        </script>
      </body>
      </html>
    `;
  };

  // دالة إنشاء HTML للجدول
  const generateTablePrintHTML = async () => {
    const sortedItems = await sortBillboardsBySize(filteredItems);
    const [freshPrevAds, freshDesigns] = await Promise.all([
      resolveBillboardPreviousAds(sortedItems, contextNumber, billboards),
      resolveBillboardDesigns(sortedItems, billboards)
    ]);
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

    const selectedTeamNames = showTeamFilter
      ? Array.from(selectedTeamIds).map(id => teams[id]?.team_name).filter(Boolean).join(' - ')
      : '';

    const enabledColumns = [...s.columns_order]
      .filter(c => c.enabled && (!hideInstalledImages || c.id !== 'installed_images') && (!hideInstallDate || c.id !== 'installation_date') && (s.show_qr_code || c.id !== 'qr_code'))
      .sort((a, b) => a.order - b.order);

    const columnHasData: Record<string, boolean> = {};
    enabledColumns.forEach(col => { columnHasData[col.id] = false; });

    sortedItems.forEach(item => {
      const billboard = billboards[item.billboard_id];
      if (!billboard) return;
      const facesCount = resolveFacesCount(item, billboard);
      const supportsBackFace = facesCount > 1;
      enabledColumns.forEach(col => {
        switch (col.id) {
          case 'row_number': columnHasData[col.id] = true; break;
          case 'billboard_image': if (billboard.Image_URL) columnHasData[col.id] = true; break;
          case 'billboard_name': if (billboard.Billboard_Name) columnHasData[col.id] = true; break;
          case 'size': if (billboard.Size) columnHasData[col.id] = true; break;
          case 'faces_count': columnHasData[col.id] = true; break;
          case 'location': if ((printCityInsteadOfMunicipality ? billboard.City : billboard.Municipality) || billboard.District) columnHasData[col.id] = true; break;
          case 'landmark': if (billboard.Nearest_Landmark) columnHasData[col.id] = true; break;
          case 'contract_number': if (item.contract_number || contextNumber) columnHasData[col.id] = true; break;
          case 'installation_date': if (!hideInstallDate && item.installation_date) columnHasData[col.id] = true; break;
          case 'design_images': {
            const design = freshDesigns[String(item.billboard_id)] || dynamicDesignsMap[item.billboard_id];
            if (item.design_face_a || billboard.design_face_a || billboard.installed_design_face_a || design?.design_face_a ||
              (supportsBackFace && (item.design_face_b || billboard.design_face_b || billboard.installed_design_face_b || design?.design_face_b))) columnHasData[col.id] = true;
            break;
          }
          case 'installed_images': {
            const installed = showInstalledImages ? installedImagesData[item.billboard_id] : null;
            if (!hideInstalledImages && (item.installed_image_face_a_url || installed?.face_a ||
              (supportsBackFace && (item.installed_image_face_b_url || installed?.face_b)))) columnHasData[col.id] = true;
            break;
          }
          case 'qr_code': if (billboard.GPS_Coordinates) columnHasData[col.id] = true; break;
        }
      });
    });

    const finalColumns = s.auto_hide_empty_columns 
      ? enabledColumns.filter(col => columnHasData[col.id])
      : enabledColumns;

    const rawAdType = (adType || resolvedTaskAdType || taskName || '').trim();
    const cleanAdType = !hideAdType ? rawAdType.replace(/^نوع\s*الإعلان\s*:\s*/, '').trim() : '';

    const pages: string[] = [];
    const rowHeightMm = Math.max(10, parseFloat(s.row_height || '60px') * ((s.row_height || '').endsWith('mm') ? 1 : 25.4 / 96));
    const pageHeightMm = s.page_orientation === 'landscape' ? 210 : 297;
    const availableTableHeight = pageHeightMm - 2 * parseFloat(s.page_margin || '8mm') - parseFloat(s.table_top_margin || '10mm') - 22;
    const rowsPerPage = Math.max(1, Math.min(s.rows_per_page || 11, Math.floor(availableTableHeight / rowHeightMm)));

    for (let pageIndex = 0; pageIndex < Math.ceil(sortedItems.length / rowsPerPage); pageIndex++) {
      const pageItems = sortedItems.slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage);

      const tableRows = await Promise.all(pageItems.map(async (item, index) => {
        const billboard = billboards[item.billboard_id];
        if (!billboard) return '';

        const globalIndex = pageIndex * rowsPerPage + index + 1;
        const name = billboard.Billboard_Name || `لوحة ${item.billboard_id}`;
        const size = billboard.Size || '';
        const facesCount = resolveFacesCount(item, billboard);
        const supportsBackFace = facesCount > 1;
        const municipality = printCityInsteadOfMunicipality ? (billboard.City || '') : (billboard.Municipality || '');
        const itemContractNumber = item.contract_number || contextNumber;
        const itemAdType = item.ad_type || adType || '';

        const installationDate = (!hideInstallDate && item.installation_date)
          ? new Date(item.installation_date).toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' })
          : '-';

        let qrCodeDataUrl = '';
        let mapLink = '';
        if (finalColumns.some(c => c.id === 'qr_code')) {
          const coords = billboard.GPS_Coordinates || '';
          mapLink = coords ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` : '';
          if (coords) {
            try { qrCodeDataUrl = await QRCode.toDataURL(mapLink, { width: 200, margin: 1 }); } catch (e) {}
          }
        }

        const bIdKey = String(item.billboard_id);
        const dynDesign = freshDesigns[bIdKey] || dynamicDesignsMap[item.billboard_id] || dynamicDesignsMap[Number(item.billboard_id)];
        const tblDesignFaceA = item.design_face_a || billboard.design_face_a || billboard.installed_design_face_a || dynDesign?.design_face_a || null;
        const tblDesignFaceB = supportsBackFace
          ? item.design_face_b || billboard.design_face_b || billboard.installed_design_face_b || dynDesign?.design_face_b || null
          : null;
        const tblPreviousAd = (item as any).previous_ad || (item as any).previous_ad_type || 
                              freshPrevAds[bIdKey] || 
                              previousAdsData[item.billboard_id] || previousAdsData[bIdKey] || previousAdsData[Number(item.billboard_id)] || 
                              billboards[item.billboard_id]?.previous_ad || billboards[item.billboard_id]?.previous_ad_type || '';

        const cells = finalColumns.map((col) => {
          switch (col.id) {
            case 'row_number':
              return `<td class="number-cell"><div class="billboard-number">${globalIndex}</div></td>`;
            case 'billboard_image':
              const fetchedInstImg = (!hideInstalledImages && showInstalledImages) ? installedImagesData[item.billboard_id] : null;
              const instImgA = !hideInstalledImages ? (item.installed_image_face_a_url || fetchedInstImg?.face_a || null) : null;
              const instImgB = !hideInstalledImages && supportsBackFace ? (item.installed_image_face_b_url || fetchedInstImg?.face_b || null) : null;
              const tblImage = instImgA || instImgB || billboard.Image_URL || '';
              return `<td class="image-cell">${tblImage 
                ? `<img src="${tblImage}" alt="${name}" class="billboard-image" onerror="this.style.display='none'">`
                : `<div class="image-placeholder"><span>صورة</span></div>`}</td>`;
            case 'billboard_name':
              return `<td style="font-weight: 600; text-align: right; padding: 4px; font-size: ${s.row_font_size};">${name}</td>`;
            case 'size':
              return `<td style="font-weight: 600; font-size: ${s.row_font_size};">${generatePrintedSizeHtml(size, false, showSizeDimensionLabels)}</td>`;
            case 'faces_count':
              return `<td style="font-size: 9px; font-weight: 700;">${facesCount}</td>`;
            case 'location':
              return `<td style="text-align: right; padding: 4px; font-size: ${s.row_font_size};">${[municipality, billboard.District].filter(Boolean).join(' - ') || '-'}</td>`;
            case 'landmark':
              return `<td style="text-align: right; padding: 4px; font-size: ${s.row_font_size};">${billboard.Nearest_Landmark || '-'}</td>`;
            case 'contract_number':
              const rawRowAd = !hideAdType ? (item.ad_type || dynDesign?.design_name || cleanAdType || itemAdType || '').trim() : '';
              const cleanRowAd = rawRowAd.replace(/^نوع\s*الإعلان\s*:\s*/, '').trim();
              const installCell = hideAdType
                ? '-'
                : (cleanRowAd ? `نوع الإعلان: ${cleanRowAd}` : (itemContractNumber ? `تركيب رقم: ${itemContractNumber}` : '-'));
              return `<td style="font-size: ${s.row_font_size};">${showPreviousAd && tblPreviousAd ? `<span style="font-size:7px;color:#444;font-weight:700;">السابق: ${tblPreviousAd}</span><br/>` : ''}${contextType === 'installation' ? installCell : `${itemContractNumber || '-'}${cleanRowAd ? '<br/><span style="font-size:7px;color:#666;">' + cleanRowAd + '</span>' : ''}`}</td>`;
            case 'installation_date':
              return `<td style="font-size: ${s.row_font_size};">${installationDate}</td>`;
            case 'design_images':
              return `<td class="image-cell"><div class="img-group">
                ${tblDesignFaceA ? `<img src="${tblDesignFaceA}" class="design-img" />` : ''}
                ${tblDesignFaceB ? `<img src="${tblDesignFaceB}" class="design-img" />` : ''}
                ${!tblDesignFaceA && !tblDesignFaceB ? '-' : ''}
              </div></td>`;
            case 'installed_images':
              if (hideInstalledImages) return `<td class="image-cell">-</td>`;
              const fetchedInst = showInstalledImages ? installedImagesData[item.billboard_id] : null;
              const instA = item.installed_image_face_a_url || fetchedInst?.face_a || null;
              const instB = supportsBackFace
                ? item.installed_image_face_b_url || fetchedInst?.face_b || null
                : null;
              return `<td class="image-cell"><div class="img-group">
                ${instA ? `<img src="${instA}" class="installed-img" />` : ''}
                ${instB ? `<img src="${instB}" class="installed-img" />` : ''}
                ${!instA && !instB ? '-' : ''}
              </div></td>`;
            case 'qr_code':
              return `<td class="qr-cell">${qrCodeDataUrl && mapLink 
                ? `<a href="${mapLink}" target="_blank"><img src="${qrCodeDataUrl}" class="qr-code" style="width: 50px; height: 50px;" alt="QR" /></a>`
                : '-'}</td>`;
            default: return '';
          }
        });

        return `<tr style="height: ${s.row_height || '60px'}; background: #fff;">${cells.join('')}</tr>`;
      }));

      const headerCells = finalColumns.map((col, colIndex) => {
        const isFirstColumn = colIndex === 0;
        const headerStyle = isFirstColumn 
          ? `background: ${s.first_column_bg_color}; color: ${s.first_column_text_color}; width: ${col.width || '8%'};`
          : `width: ${col.width || '8%'};`;
        return `<th class="header-cell" style="${headerStyle}">${col.label}</th>`;
      });

      const customerCompanyText = !hideCustomerName ? [customerName, companyName].filter(Boolean).join(' - ') : '';
      const primaryTaskId = taskId ? String(taskId) : (taskIds && taskIds.length > 0 ? String(taskIds[0]) : '');

      let installInfoBar = '';
      if (!hideAdType) {
        if (cleanAdType) {
          installInfoBar = `نوع الإعلان: ${cleanAdType}`;
        } else if (contextNumber) {
          installInfoBar = `تركيب رقم: ${contextNumber}`;
        }
      }

      const infoBarText = contextType === 'installation'
        ? [installInfoBar, customerCompanyText].filter(Boolean).join(' | ')
        : `${getContextLabel()} رقم: ${contextNumber}${customerCompanyText ? ' | ' + customerCompanyText : ''}${cleanAdType ? ' | نوع الإعلان: ' + cleanAdType : ''}`;

      pages.push(`
        <div class="info-bar">
          <span>${infoBarText ? `${infoBarText} | ` : ''}${printType === 'installation' && showTeamInContent && selectedTeamNames ? 'الفريق: ' + selectedTeamNames + ' | ' : ''}صفحة ${pageIndex + 1} من ${Math.ceil(sortedItems.length / rowsPerPage)}</span>
        </div>
        <table>
          <thead><tr>${headerCells.join('')}</tr></thead>
          <tbody>${tableRows.join('')}</tbody>
        </table>
      `);
    }

    const isLandscape = s.page_orientation === 'landscape';
    const pageMargin = s.page_margin || '8mm';
    const tableTopMargin = s.table_top_margin || '10mm';
    const rowHeight = s.row_height || '60px';
    const baseUrl = window.location.origin;

    return `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8" />
        <title>${getCleanDocumentTitle()}</title>
        <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700&display=swap" rel="stylesheet">
        <style>
          @font-face { font-family: 'Doran'; src: url('${baseUrl}/Doran-Medium.otf') format('opentype'); font-weight: 500; }
          @page { size: ${isLandscape ? 'A4 landscape' : 'A4 portrait'}; margin: 0; }
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: '${s.primary_font}', 'Tajawal', 'Arial', sans-serif;
            direction: rtl; background: #ffffff; color: #000;
            line-height: 1.3; font-size: ${s.row_font_size};
            margin: 0; padding: 0;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
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
          .page:last-child { page-break-after: auto; }
          .page-background {
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            background-image: ${s.table_background_enabled && s.table_background_url ? `url('${s.table_background_url}')` : 'none'};
            background-size: 100% 100%; background-repeat: no-repeat; z-index: 0;
          }
          .page-content { position: relative; z-index: 1; padding-top: ${tableTopMargin}; }
          .info-bar { margin-bottom: 8px; padding: 6px 10px; background: ${s.header_bg_color}; display: inline-block; }
          .info-bar span { font-size: 10px; color: ${s.header_text_color}; font-weight: 700; }
          table { width: 100%; table-layout: fixed; border-collapse: collapse; margin-bottom: 10px; font-size: ${s.row_font_size}; background: #fff; }
          th { background: ${s.header_bg_color}; color: ${s.header_text_color}; font-weight: 700; font-size: ${s.header_font_size}; height: 30px; border: 1px solid ${s.border_color}; padding: 4px 2px; text-align: center; }
          td { border: 1px solid ${s.border_color}; padding: 2px; text-align: center; vertical-align: middle; background: #fff; color: #000; overflow-wrap: anywhere; }
          td.number-cell { background: ${s.first_column_bg_color}; font-weight: 700; font-size: 9px; color: ${s.first_column_text_color}; width: 60px; }
          td.image-cell { background: #fff; padding: 0; width: 70px; }
          .billboard-image { width: 100%; height: auto; max-height: min(${rowHeight}, ${s.billboard_image_size}); object-fit: contain; display: block; margin: 0 auto; }
          .billboard-number { color: ${s.first_column_text_color}; font-weight: 700; font-size: 9px; }
          td.qr-cell { width: 60px; padding: 2px; }
          .qr-code { width: 100%; height: auto; max-height: min(${rowHeight}, ${s.qr_code_size}); display: block; margin: 0 auto; cursor: pointer; }
          .img-group { display: flex; gap: 2px; justify-content: center; align-items: center; min-width: 0; }
          .design-img, .installed-img { min-width: 0; max-width: 48%; max-height: calc(${rowHeight} - 4px); object-fit: contain; }
          .design-img { max-height: min(calc(${rowHeight} - 4px), ${s.design_image_size}); }
          .installed-img { max-height: min(calc(${rowHeight} - 4px), ${s.installed_image_size}); }
          .image-placeholder { width: 100%; height: ${rowHeight}; background: #f0f0f0; display: flex; align-items: center; justify-content: center; font-size: 7px; color: #666; }
          .print-size-container { display: inline-flex; align-items: center; justify-content: center; gap: 0.12em; direction: rtl; color: inherit; white-space: nowrap; }
          .print-dim-col { display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; color: inherit; }
          .print-dim-label { font-family: 'Doran', sans-serif; font-size: 7px; margin-bottom: 1px; }
          .print-dim-value { font-weight: inherit; }
          .print-dim-separator { margin: 0 0.1em; opacity: 0.7; }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; background: #fff !important; margin: 0; padding: 0; }
            .page { page-break-after: always; margin: 0; box-shadow: none; height: ${isLandscape ? '210mm' : '297mm'}; overflow: hidden; }
            .page:last-child { page-break-after: auto; }
          }
        </style>
      </head>
      <body class="${isLandscape ? 'print-landscape' : 'print-portrait'}" data-orientation="${isLandscape ? 'landscape' : 'portrait'}">
        ${pages.map((pageContent) => `
          <div class="page" data-print-page>
            <div class="page-background"></div>
            <div class="page-content">${pageContent}</div>
          </div>
        `).join('\n')}
        <script>
          document.fonts.ready.then(function() {
            var images = document.querySelectorAll('img');
            var loadedCount = 0;
            var totalImages = images.length;
            function checkAllLoaded() {
              loadedCount++;
            }
            if (totalImages > 0) {
              images.forEach(function(img) {
                if (img.complete) checkAllLoaded();
                else { img.onload = checkAllLoaded; img.onerror = checkAllLoaded; }
              });
            }
          });
        </script>
      </body>
      </html>
    `;
  };

  const handlePrint = async () => {
    if (filteredItems.length === 0) {
      toast.error('لا توجد لوحات للطباعة');
      return;
    }

    if (loading) return;
    const docTitle = getCleanDocumentTitle();
    // 1. فتح النافذة فوراً بشكل متزامن قبل أي عمليات async لمنع حظر المتصفح للنوافذ
    const printWindow = preparePrintWindow(docTitle);
    setLoading(true);

    try {
      const isLandscapeTable = printMode === 'table' && tableSettings.page_orientation === 'landscape';
      const html = printMode === 'table' ? await generateTablePrintHTML() : await generatePrintHTML();

      // 2. كتابة المحتوى مع حقن شريط الأدوات العائم واستخدام Blob URL
      writePrintWindow(printWindow, html, {
        title: docTitle,
        landscape: isLandscapeTable,
        showDownloadPdf: true,
        showShare: true,
        autoPrint: false,
      });

      toast.success(`تم تحضير ${filteredItems.length} ${printMode === 'table' ? 'صف' : 'صفحة'} للطباعة`);
    } catch (error) {
      console.error('Error printing:', error);
      toast.error('فشل في تحضير الطباعة');
    } finally {
      setLoading(false);
    }
  };

  const stripScriptsForPdf = (html: string) => html.replace(/<script[\s\S]*?<\/script>/gi, '');

  const rasterizeSvgForPdf = async (url: string, w = PDF_PORTRAIT_WIDTH_PX, h = PDF_PORTRAIT_HEIGHT_PX): Promise<string> => {
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

  const prepareHtmlForPdf = async (html: string, isLandscape = false) => {
    let preparedHtml = stripScriptsForPdf(html);
    const svgUrls = new Set<string>();
    const bgRegex = /(?:background-image:\s*url\(['"]?)([^'")\s]+\.svg)['"]?\)|<img[^>]+src=["']([^"']+\.svg)["']/gi;
    let match: RegExpExecArray | null;
    while ((match = bgRegex.exec(preparedHtml)) !== null) {
      svgUrls.add(match[1] || match[2]);
    }
    const rasterW = isLandscape ? PDF_LANDSCAPE_WIDTH_PX : PDF_PORTRAIT_WIDTH_PX;
    const rasterH = isLandscape ? PDF_LANDSCAPE_HEIGHT_PX : PDF_PORTRAIT_HEIGHT_PX;
    const rasterized = new Map<string, string>();
    await Promise.all(
      Array.from(svgUrls).map(async (svgUrl) => {
        const dataUrl = await rasterizeSvgForPdf(svgUrl, rasterW, rasterH);
        if (dataUrl !== svgUrl) rasterized.set(svgUrl, dataUrl);
      })
    );
    for (const [svgUrl, dataUrl] of rasterized) {
      preparedHtml = preparedHtml.split(svgUrl).join(dataUrl);
    }
    return preparedHtml;
  };

  const buildPdfBlobFromHtml = async (html: string, isLandscape = false): Promise<Blob> => {
    const preparedHtml = await prepareHtmlForPdf(html, isLandscape);
    const PAGE_W_MM = isLandscape ? 297 : 210;
    const PAGE_H_MM = isLandscape ? 210 : 297;

    const iframe = document.createElement('iframe');
    // Position iframe in viewport with 0 opacity so layout and Canvas 2D engine have exact font metrics & dimensions
    iframe.style.cssText = `position:fixed;left:0;top:0;width:${PAGE_W_MM}mm;height:${PAGE_H_MM}mm;border:none;opacity:0;pointer-events:none;z-index:-99999;`;
    document.body.appendChild(iframe);

    try {
      const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
      if (!iframeDoc) throw new Error('تعذر إنشاء مستند PDF');

      iframeDoc.open();
      iframeDoc.write(preparedHtml);
      iframeDoc.close();

      const overrideStyle = iframeDoc.createElement('style');
      overrideStyle.textContent = `
        html, body {
          margin: 0 !important;
          padding: 0 !important;
          width: ${PAGE_W_MM}mm !important;
          background: #ffffff !important;
          overflow: visible !important;
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
          box-sizing: border-box;
        }
        .page {
          width: ${PAGE_W_MM}mm !important;
          height: ${PAGE_H_MM}mm !important;
          margin: 0 !important;
          overflow: hidden !important;
          page-break-after: always !important;
          background: #ffffff !important;
          box-shadow: none !important;
        }
        .page:last-child {
          page-break-after: auto !important;
        }
        .background, .background img {
          width: 100% !important;
          height: 100% !important;
        }
        .page-background {
          width: ${PAGE_W_MM}mm !important;
          height: ${PAGE_H_MM}mm !important;
          background-size: ${PAGE_W_MM}mm ${PAGE_H_MM}mm !important;
        }
        .background img {
          image-rendering: -webkit-optimize-contrast !important;
          image-rendering: crisp-edges !important;
        }
      `;
      iframeDoc.head.appendChild(overrideStyle);

      // Wait for document ready
      if (iframeDoc.readyState !== 'complete') {
        await new Promise<void>((resolve) => {
          iframe.contentWindow?.addEventListener('load', () => resolve(), { once: true });
          setTimeout(resolve, 2000);
        });
      }

      // Wait for fonts to load in iframe with status tracking
      try {
        if (iframeDoc.fonts) {
          let fontTimeoutId: any;
          const fontTimeoutPromise = new Promise<void>((resolve) => {
            fontTimeoutId = setTimeout(() => {
              if (iframeDoc.fonts.status !== 'loaded') {
                console.warn('[Print PDF Iframe] Fonts not fully loaded. Status:', iframeDoc.fonts.status);
              }
              resolve();
            }, 3000);
          });
          await Promise.race([
            iframeDoc.fonts.ready.then(() => clearTimeout(fontTimeoutId)),
            fontTimeoutPromise,
          ]);
          await new Promise(r => setTimeout(r, 100));
        }
      } catch {}

      // Wait for all images with decode and naturalWidth verification
      const images = Array.from(iframeDoc.getElementsByTagName('img'));
      await Promise.all(images.map((img) => {
        if (img.complete && img.naturalWidth > 0) {
          if (typeof img.decode === 'function') {
            return img.decode().catch(() => Promise.resolve());
          }
          return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', () => {
            console.warn('[Print PDF Iframe] Image failed to load:', img.src);
            resolve();
          }, { once: true });
        });
      }));

      // Pre-rasterize SVG backgrounds at 300 DPI (2480x3508) for ultra-sharp Canvas 2D PDF print
      const printW = isLandscape ? 3508 : 2480;
      const printH = isLandscape ? 2480 : 3508;
      await Promise.all(images.map((img) => {
        if (!img.src || (img.src.indexOf('.svg') === -1 && img.src.indexOf('image/svg+xml') === -1 && !img.src.startsWith('data:image/svg+xml'))) {
          return Promise.resolve();
        }
        return new Promise<void>((resolve) => {
          const tempImg = new Image();
          tempImg.crossOrigin = 'anonymous';
          tempImg.onload = () => {
            try {
              const c = document.createElement('canvas');
              const isBg = (img.closest && img.closest('.background')) || img.classList.contains('background') || img.parentElement?.classList.contains('background');
              const targetW = isBg ? printW : Math.max((tempImg.naturalWidth || 800) * 3, 1600);
              const targetH = isBg ? printH : Math.max((tempImg.naturalHeight || 1100) * 3, 1600);
              c.width = targetW;
              c.height = targetH;
              const ctx = c.getContext('2d');
              if (ctx) {
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                ctx.drawImage(tempImg, 0, 0, targetW, targetH);
                img.src = c.toDataURL('image/png');
              }
            } catch (e) {
              console.warn('SVG high-res rasterization notice:', e);
            }
            resolve();
          };
          tempImg.onerror = () => resolve();
          tempImg.src = img.src;
        });
      }));

      // Trigger overlay calculations if any overlay containers exist
      fitPrintCardText(iframeDoc);
      try {
        const containers = iframeDoc.querySelectorAll('.overlay-container');
        containers.forEach(function(container: any) {
          const bgImg = container.querySelector('.billboard-image');
          const cutoutImg = container.querySelector('.overlay-cutout');
          if (!bgImg || !cutoutImg) return;

          const cw = container.clientWidth;
          const ch = container.clientHeight;
          const nw = bgImg.naturalWidth;
          const nh = bgImg.naturalHeight;
          if (!cw || !ch || !nw || !nh) return;

          const imgRatio = nw / nh;
          const boxRatio = cw / ch;

          let renderW = cw;
          let renderH = ch;
          let renderLeft = 0;
          let renderTop = 0;

          if (imgRatio > boxRatio) {
            renderH = cw / imgRatio;
            renderTop = (ch - renderH) / 2;
          } else {
            renderW = ch * imgRatio;
            renderLeft = (cw - renderW) / 2;
          }

          const xPct = parseFloat(cutoutImg.getAttribute('data-x') || '50');
          const yPct = parseFloat(cutoutImg.getAttribute('data-y') || '50');
          const scale = parseFloat(cutoutImg.getAttribute('data-scale') || '1');
          const rot = parseFloat(cutoutImg.getAttribute('data-rot') || '0');
          const isV2 = cutoutImg.getAttribute('data-anchor') === 'v2';

          const overlayLeftPx = renderLeft + (xPct / 100) * renderW;
          const overlayTopPx = renderTop + (yPct / 100) * renderH;
          const overlayWidthPx = (27.15 / 100) * renderW;

          const translateY = isV2 ? '-100%' : '-50%';
          const transformOrigin = isV2 ? 'bottom center' : 'center center';

          cutoutImg.style.left = overlayLeftPx + 'px';
          cutoutImg.style.top = overlayTopPx + 'px';
          cutoutImg.style.width = overlayWidthPx + 'px';
          cutoutImg.style.transform = `translate(-50%, ${translateY}) scale(${scale}) rotate(${rot}deg)`;
          cutoutImg.style.transformOrigin = transformOrigin;
        });
      } catch (e) {
        console.warn('Overlay adjustment failed:', e);
      }

      const rawPages = Array.from(iframeDoc.querySelectorAll('[data-print-page], .page')) as HTMLElement[];
      const pages = rawPages.filter((el) => {
        let parent = el.parentElement;
        while (parent && parent !== iframeDoc.body) {
          if (parent.hasAttribute('data-print-page') || parent.classList.contains('page')) {
            return false;
          }
          parent = parent.parentElement;
        }
        return true;
      });
      if (pages.length === 0) throw new Error('لا توجد صفحات للتصدير');

      const { jsPDF } = await import('jspdf');
      const browserCanvas = (await import('@/lib/browserCanvas')).default;

      const orientation = isLandscape ? 'landscape' : 'portrait';
      const a4W = isLandscape ? 297 : 210;
      const a4H = isLandscape ? 210 : 297;
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation, compress: true });

      for (let i = 0; i < pages.length; i++) {
        const pageEl = pages[i];

        // Canvas 2D rendering with high DPI scale (3.0 for 300 DPI print quality)
        const canvas = await browserCanvas(pageEl, {
          scale: 3.0,
          useCORS: true,
          allowTaint: false,
          logging: false,
          backgroundColor: '#ffffff',
          foreignObjectRendering: false, // Pure Canvas 2D engine
          imageTimeout: 25000,
          scrollX: 0,
          scrollY: 0,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        if (i > 0) pdf.addPage('a4', orientation);
        pdf.addImage(imgData, 'JPEG', 0, 0, a4W, a4H, undefined, 'SLOW');

        // Free memory immediately
        canvas.width = 1;
        canvas.height = 1;
      }

      return pdf.output('blob');
    } finally {
      iframe.remove();
    }
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
    if (filteredItems.length === 0) {
      toast.error('لا توجد لوحات للتحميل');
      return;
    }

    if (loading) return;
    setLoading(true);
    toast.info('جاري تحضير ملف PDF...');

    try {
      const isTableLandscape = printMode === 'table' && tableSettings.page_orientation === 'landscape';
      const html = printMode === 'table' ? await generateTablePrintHTML() : await generatePrintHTML();
      const pdfBlob = await buildPdfBlobFromHtml(html, isTableLandscape);
      const pdfFileName = `${getCleanDocumentTitle()
        .replace(/[:]/g, '')
        .replace(/[\\/*?"<>|#]/g, '-')
        .replace(/\s+/g, ' ')
        .replace(/-+/g, '-')
        .trim()}.pdf`;
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

      const isTableLandscape = printMode === 'table' && tableSettings.page_orientation === 'landscape';
      const html = printMode === 'table' ? await generateTablePrintHTML() : await generatePrintHTML();
      const pdfBlob = await buildPdfBlobFromHtml(html, isTableLandscape);
      const base64Data = await blobToBase64(pdfBlob);
      const { uploadFileToGoogleDrive } = await import('@/services/imageUploadService');

      const pdfFileName = `${getCleanDocumentTitle()
        .replace(/[:]/g, '')
        .replace(/[\\/*?"<>|#]/g, '-')
        .replace(/\s+/g, ' ')
        .replace(/-+/g, '-')
        .trim()}.pdf`;
      const pdfUrl = await uploadFileToGoogleDrive(base64Data, pdfFileName, 'application/pdf', driveFolder, false, progress);

      const cleanPhone = phone.replace(/[^0-9+]/g, '').replace(/^\+/, '');
      const message = [
        `مرحباً،`,
        '',
        `نرسل لك ملف ${printMode === 'table' ? 'جدول' : 'لوحات'} ${getContextLabel()} رقم ${contextNumber}.`,
        '',
        `رابط الملف:`,
        pdfUrl,
      ].join('\n');

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

  const isInstallation = contextType === 'installation';
  const isReinstall = taskType === 'reinstallation';
  const rawNum = reinstallationNumber ?? resolvedReinstallationNumber;
  const reinstallNum = (rawNum !== null && rawNum !== undefined && Number(rawNum) > 0)
    ? Number(rawNum)
    : (isReinstall ? 1 : null);
  const primaryTaskId = taskId ? String(taskId) : (taskIds && taskIds.length > 0 ? String(taskIds[0]) : '');
  const taskShortId = primaryTaskId ? (primaryTaskId.length > 8 ? primaryTaskId.slice(0, 8) : primaryTaskId) : '';

  const dialogTitle = isInstallation
    ? (title && !title.startsWith('طباعة مهمة') && !title.startsWith('طباعة إعادة') ? title : getInstallationTitle())
    : (title || `${getContextLabel()} لوحات`);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="print-all-dialog print-controls-dialog flex w-[calc(100vw-24px)] max-w-5xl max-h-[calc(100dvh-2rem)] flex-col gap-0 overflow-hidden p-0 sm:p-0 [&_button]:cursor-pointer [&_button]:transition-all [&_button]:duration-200" aria-describedby={undefined}>
        <DialogHeader className="shrink-0 border-b border-border bg-muted/20 px-4 py-4 pl-12 sm:px-5 sm:pl-14">
          <DialogTitle className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-lg font-semibold">
              <div className="shrink-0 rounded-xl border border-primary/20 bg-primary/10 p-1.5">
                {isInstallation ? (
                  isReinstall ? <RefreshCw className="h-5 w-5 text-amber-500" /> : <Wrench className="h-5 w-5 text-primary" />
                ) : (
                  <FileText className="h-5 w-5 text-primary" />
                )}
              </div>
              <span className="min-w-0 break-words">طباعة الكل</span>
            </div>
            <p className="text-sm font-normal leading-relaxed text-muted-foreground break-words sm:mr-12">{dialogTitle}</p>
            <div className="flex flex-wrap items-center gap-2 text-sm font-normal sm:mr-12">
              {/* رقم مهمة التركيب */}
              {isInstallation && taskShortId && (
                <Badge variant="outline" className="font-mono text-xs font-bold bg-muted/60 border-primary/30 text-foreground flex items-center gap-1">
                  <Hash className="h-3 w-3 text-primary" />
                  <span>مهمة #{taskShortId}</span>
                  {taskIds && taskIds.length > 1 && (
                    <span className="text-[12px] text-muted-foreground font-normal">(+{taskIds.length - 1})</span>
                  )}
                </Badge>
              )}

              {/* نوع التركيب ورقم إعادة التركيب */}
              {isInstallation && (
                isReinstall ? (
                  <Badge className="bg-amber-500/15 text-amber-500 border border-amber-500/30 font-bold text-xs flex items-center gap-1">
                    <RefreshCw className="h-3 w-3" />
                    <span>إعادة تركيب رقم {reinstallNum || 1}</span>
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-500/15 text-emerald-500 border border-emerald-500/30 font-bold text-xs flex items-center gap-1">
                    <Wrench className="h-3 w-3" />
                    <span>تركيب جديد</span>
                  </Badge>
                )
              )}

              {/* نوع الإعلان */}
              {!hideAdType && (adType || resolvedTaskAdType) && (
                <Badge variant="secondary" className="bg-primary/10 text-primary border border-primary/25 font-bold text-xs flex items-center gap-1">
                  <Tag className="h-3 w-3" />
                  <span>نوع الإعلان: {(adType || resolvedTaskAdType).replace(/^نوع\s*الإعلان\s*:\s*/, '').trim()}</span>
                </Badge>
              )}

              {!isInstallation && (
                <>
                  <span className="text-muted-foreground text-xs font-medium">
                    {getContextLabel()} #{contextNumber}
                  </span>

                  {customerName && (
                    <>
                      <span className="text-muted-foreground">•</span>
                      <span className="text-foreground text-xs font-medium truncate max-w-[200px]">{customerName}</span>
                    </>
                  )}

                  <span className="text-muted-foreground">•</span>
                </>
              )}

              <Badge className="bg-primary/20 text-primary border-0 font-bold text-xs">{filteredItems.length} لوحة</Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="print-controls-options min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          <div className="flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 px-4 py-3">
            <div className="min-w-0"><p className="text-sm font-semibold">جهّز مستند الطباعة</p><p className="mt-1 text-xs text-muted-foreground">اختر النسخة وطريقة العرض، ثم اضبط البيانات والصور.</p></div>
            <div className="shrink-0 text-center"><span className="text-[22px] font-semibold text-primary">{filteredItems.length}</span><p className="text-xs text-muted-foreground">لوحة محددة</p></div>
          </div>
          {/* 1. التحديد الأساسي: نوع النسخة ونمط الإخراج */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* اختيار الجهة الموجه إليها المستند */}
            <div className="print-control-card rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <span>نسخة المستند</span>
                </Label>
                <Badge variant="outline" className="text-[11px] h-5 px-1.5 border-primary/30 text-primary bg-primary/5">
                  {printType === 'client' ? 'للزبون' : 'لفريق العمل'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={printType === 'client'} onClick={() => setPrintType('client')}
                  className={`p-2.5 rounded-lg border text-right transition-all cursor-pointer flex flex-col gap-1 relative ${
                    printType === 'client'
                      ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30'
                      : 'border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                      <User className={`h-3.5 w-3.5 ${printType === 'client' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span>نسخة العميل</span>
                    </div>
                    {printType === 'client' && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    )}
                  </div>

                </button>

                <button
                  type="button"
                  aria-pressed={printType === 'installation'} onClick={() => setPrintType('installation')}
                  className={`p-2.5 rounded-lg border text-right transition-all cursor-pointer flex flex-col gap-1 relative ${
                    printType === 'installation'
                      ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30'
                      : 'border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                      <Wrench className={`h-3.5 w-3.5 ${printType === 'installation' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span>نسخة {contextType === 'removal' ? 'الإزالة' : 'التركيب'}</span>
                    </div>
                    {printType === 'installation' && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    )}
                  </div>

                </button>
              </div>
            </div>

            {/* نمط العرض والصفحات */}
            <div className="print-control-card rounded-xl border border-border bg-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <FileText className="h-3.5 w-3.5 text-primary" />
                  <span>طريقة العرض</span>
                </Label>
                <Badge variant="outline" className="text-[11px] h-5 px-1.5 border-primary/30 text-primary bg-primary/5">
                  {printMode === 'cards' ? 'صفحة لكل لوحة' : 'جدول مدمج'}
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  aria-pressed={printMode === 'cards'} onClick={() => setPrintMode('cards')}
                  className={`p-2.5 rounded-lg border text-right transition-all cursor-pointer flex flex-col gap-1 relative ${
                    printMode === 'cards'
                      ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30'
                      : 'border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                      <FileText className={`h-3.5 w-3.5 ${printMode === 'cards' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span>بطاقات منفصلة</span>
                    </div>
                    {printMode === 'cards' && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    )}
                  </div>

                </button>

                <button
                  type="button"
                  aria-pressed={printMode === 'table'} onClick={() => setPrintMode('table')}
                  className={`p-2.5 rounded-lg border text-right transition-all cursor-pointer flex flex-col gap-1 relative ${
                    printMode === 'table'
                      ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30'
                      : 'border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                      <Table2 className={`h-3.5 w-3.5 ${printMode === 'table' ? 'text-primary' : 'text-muted-foreground'}`} />
                      <span>جدول مجمع</span>
                    </div>
                    {printMode === 'table' && (
                      <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                    )}
                  </div>

                </button>
              </div>
            </div>
          </div>

          {/* 2. شريط ملخص التكوين الحي */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl bg-card border border-border/80 text-xs shadow-xs">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-bold text-muted-foreground flex items-center gap-1 pl-1">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span>ملخص الطباعة:</span>
              </span>
              <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-semibold border border-primary/20 bg-primary/10 text-primary">
                {printType === 'client' ? 'نسخة الزبون' : (contextType === 'removal' ? 'فريق الإزالة' : 'فريق التركيب')}
              </Badge>
              <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-semibold border border-border bg-muted/60 text-foreground">
                {printMode === 'cards' ? 'بطاقات' : 'جدول مجمع'}
              </Badge>
              <Badge variant="secondary" className="h-5 px-1.5 text-[11px] font-semibold border border-border bg-muted/60 text-foreground">
                {!hideInstalledImages ? 'صور التركيب' : 'صورة اللوحة'}
              </Badge>
              <Badge variant="outline" className={`h-5 px-1.5 text-[11px] font-semibold ${!hideAdType ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/5' : 'border-border text-muted-foreground'}`}>
                {!hideAdType ? 'نوع الإعلان: ظاهر' : 'نوع الإعلان: مخفي'}
              </Badge>
              <Badge variant="outline" className={`h-5 px-1.5 text-[11px] font-semibold ${!hideCustomerName ? 'border-emerald-500/30 text-emerald-600 bg-emerald-500/5' : 'border-border text-muted-foreground'}`}>
                {!hideCustomerName ? 'العميل: ظاهر' : 'العميل: مخفي'}
              </Badge>
            </div>
            <div className="flex items-center gap-1 font-bold text-xs text-foreground">
              <Badge className="bg-primary/20 text-primary border-0 font-bold h-5 px-2">
                {filteredItems.length} لوحة جاهزة
              </Badge>
            </div>
          </div>

          {/* 3. اختيار الفرق (إن وجدت) */}
          {showTeamFilter && Object.keys(itemsByTeam).length > 0 && (
            <div className="p-3 bg-muted/40 rounded-xl border border-border/80 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Label className="text-xs font-bold flex items-center gap-2">
                  <Users className="h-3.5 w-3.5 text-primary" />
                  <span>تصفية اللوحات حسب الفرق ({Object.keys(itemsByTeam).length} فرقة)</span>
                </Label>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={selectAllTeams}>الكل</Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs px-2" onClick={clearTeamSelection}>مسح</Button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5">
                {Object.entries(itemsByTeam).map(([teamId, teamItems]) => {
                  const isSelected = selectedTeamIds.has(teamId);
                  const team = teams[teamId];
                  const teamCities: string[] = team?.cities || [];
                  const cityFilteredCount = respectCityLimits && teamCities.length > 0
                    ? teamItems.filter(item => {
                        const billboard = billboards[item.billboard_id];
                        return billboard && teamCities.includes(billboard.City);
                      }).length
                    : teamItems.length;

                  return (
                    <button
                      key={teamId}
                      type="button"
                      onClick={() => toggleTeam(teamId)}
                      aria-pressed={isSelected}
                      className={`flex h-8 items-center gap-1.5 px-2.5 rounded-lg border text-xs transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-primary/10 font-bold shadow-xs'
                          : 'border-border bg-card hover:border-primary/50'
                      }`}
                    >
                      <div className={`h-3.5 w-3.5 rounded border flex items-center justify-center ${
                        isSelected ? 'border-primary bg-primary' : 'border-muted-foreground'
                      }`}>
                        {isSelected && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                      </div>
                      <span>{teams[teamId]?.team_name || (teamId === 'unknown' ? 'بدون فرقة' : 'غير محدد')}</span>
                      <Badge variant="secondary" className="text-[11px] h-4 px-1">
                        {respectCityLimits && cityFilteredCount !== teamItems.length
                          ? `${cityFilteredCount}/${teamItems.length}`
                          : teamItems.length}
                      </Badge>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t border-border/50 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Switch
                    id="respectCityLimits"
                    checked={respectCityLimits}
                    onCheckedChange={(c) => setRespectCityLimits(!!c)}
                  />
                  <Label htmlFor="respectCityLimits" className="cursor-pointer text-xs font-medium">
                    الالتزام بحدود مدن الفرق
                  </Label>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                  <span>اللوحات المحددة:</span>
                  <Badge variant="outline" className="text-xs font-bold">{filteredItems.length} لوحة</Badge>
                </div>
              </div>

              <div className="pt-2 border-t border-border/40 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="flex items-center justify-between p-2 rounded-lg border border-border/60 bg-card/60">
                  <Label htmlFor="showTeamInContent_teamSec" className="cursor-pointer text-xs">
                    إظهار اسم {contextType === 'removal' ? 'فريق الإزالة' : 'فريق التركيب'} داخل الطباعة
                  </Label>
                  <Switch
                    id="showTeamInContent_teamSec"
                    checked={showTeamInContent}
                    onCheckedChange={(c) => setShowTeamInContent(!!c)}
                  />
                </div>

                <div className="flex items-center justify-between p-2 rounded-lg border border-border/60 bg-card/60">
                  <Label htmlFor="showTeamInHeader_teamSec" className="cursor-pointer text-xs">
                    إظهار اسم الفريق في ترويسة النافذة
                  </Label>
                  <Switch
                    id="showTeamInHeader_teamSec"
                    checked={showTeamInHeader}
                    onCheckedChange={(c) => setShowTeamInHeader(!!c)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* جميع الخيارات في صفحة واحدة */}
          <div className="grid grid-cols-1 items-start gap-3 md:grid-cols-2">

            {/* تبويب 1: النصوص والبيانات */}
            <section aria-labelledby="print-content-heading" className="print-control-card md:row-span-2 space-y-2 rounded-xl border border-border bg-card p-4"><h3 id="print-content-heading" className="flex items-center gap-2 border-b border-border pb-3 text-sm font-semibold"><Type className="h-4 w-4 text-primary" />النصوص والبيانات</h3>
              <div className="grid grid-cols-1 gap-0">
                {/* نوع الإعلان ورقم التركيب */}
                <div className="flex min-h-[40px] items-center justify-between gap-3 border-b border-border/50 px-2 py-1.5 last:border-b-0 hover:bg-muted/30 transition-colors"><Label htmlFor="hideAdType" className="flex min-h-[32px] flex-1 items-center gap-2 cursor-pointer text-xs font-medium text-foreground"><Tag className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />نوع الإعلان ورقم التركيب</Label><Switch
                      id="hideAdType"
                      checked={!hideAdType}
                      onCheckedChange={(checked) => setHideAdType(!checked)}
                    /></div>

                {/* اسم الزبون والشركة */}
                <div className="flex min-h-[40px] items-center justify-between gap-3 border-b border-border/50 px-2 py-1.5 last:border-b-0 hover:bg-muted/30 transition-colors"><Label htmlFor="hideCustomerName" className="flex min-h-[32px] flex-1 items-center gap-2 cursor-pointer text-xs font-medium text-foreground"><User className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />اسم العميل والشركة</Label><Switch
                      id="hideCustomerName"
                      checked={!hideCustomerName}
                      onCheckedChange={(checked) => setHideCustomerName(!checked)}
                    /></div>

                {/* تاريخ العملية */}
                <div className="flex min-h-[40px] items-center justify-between gap-3 border-b border-border/50 px-2 py-1.5 last:border-b-0 hover:bg-muted/30 transition-colors"><Label htmlFor="hideInstallDate" className="flex min-h-[32px] flex-1 items-center gap-2 cursor-pointer text-xs font-medium text-foreground"><Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />تاريخ {contextType === 'removal' ? 'الإزالة' : 'التركيب'}</Label><Switch
                      id="hideInstallDate"
                      checked={!hideInstallDate}
                      onCheckedChange={(checked) => setHideInstallDate(!checked)}
                    /></div>

                {/* الإعلان السابق */}
                <div className="flex min-h-[40px] items-center justify-between gap-3 border-b border-border/50 px-2 py-1.5 last:border-b-0 hover:bg-muted/30 transition-colors"><Label htmlFor="showPreviousAd" className="flex min-h-[32px] flex-1 items-center gap-2 cursor-pointer text-xs font-medium text-foreground"><History className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />الإعلان السابق</Label><Switch
                      id="showPreviousAd"
                      checked={showPreviousAd}
                      onCheckedChange={(checked) => setShowPreviousAd(checked)}
                    /></div>

                {/* مسمى المدينة بدل البلدية */}
                <div className="flex min-h-[40px] items-center justify-between gap-3 border-b border-border/50 px-2 py-1.5 last:border-b-0 hover:bg-muted/30 transition-colors"><Label htmlFor="printCityInsteadOfMunicipality" className="flex min-h-[32px] flex-1 items-center gap-2 cursor-pointer text-xs font-medium text-foreground"><MapPin className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />مسمى المدينة بدل البلدية</Label><Switch
                      id="printCityInsteadOfMunicipality"
                      checked={printCityInsteadOfMunicipality}
                      onCheckedChange={(checked) => setPrintCityInsteadOfMunicipality(checked)}
                    /></div>

                {/* خيارات الفريق إذا لم تكن التصفية ظاهرة */}
                {(!showTeamFilter || Object.keys(itemsByTeam).length === 0) && (
                  <>
                    <div className="flex min-h-[40px] items-center justify-between gap-3 border-b border-border/50 px-2 py-1.5 last:border-b-0 hover:bg-muted/30 transition-colors"><Label htmlFor="showTeamInContent" className="flex min-h-[32px] flex-1 items-center gap-2 cursor-pointer text-xs font-medium text-foreground"><Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />اسم الفريق في المحتوى</Label><Switch
                          id="showTeamInContent"
                          checked={showTeamInContent}
                          onCheckedChange={(checked) => setShowTeamInContent(checked)}
                        /></div>

                    <div className="flex min-h-[40px] items-center justify-between gap-3 border-b border-border/50 px-2 py-1.5 last:border-b-0 hover:bg-muted/30 transition-colors"><Label htmlFor="showTeamInHeader" className="flex min-h-[32px] flex-1 items-center gap-2 cursor-pointer text-xs font-medium text-foreground"><Users className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />اسم الفريق في الترويسة</Label><Switch
                          id="showTeamInHeader"
                          checked={showTeamInHeader}
                          onCheckedChange={(checked) => setShowTeamInHeader(checked)}
                        /></div>
                  </>
                )}
              </div>
            </section>

            {/* تبويب 2: الصور والتصاميم */}
            <section aria-labelledby="print-images-heading" className="print-control-card space-y-2 rounded-xl border border-border bg-card p-4"><h3 id="print-images-heading" className="flex items-center gap-2 border-b border-border pb-3 text-sm font-semibold"><ImageIcon className="h-4 w-4 text-primary" />الصور والتصاميم</h3>
              <div className="space-y-2">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5 text-primary" />
                  <span>مصدر صور اللوحات في الطباعة:</span>
                </Label>
                <div className="grid grid-cols-1 gap-0.5">
                  <button
                    type="button"
                    onClick={() => {
                      setHideInstalledImages(false);
                      setShowInstalledImages(true);
                    }}
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex items-center gap-3 relative ${
                      !hideInstalledImages
                        ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30'
                        : 'border-border/70 bg-card hover:border-primary/40'
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${!hideInstalledImages ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      <Camera className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <span>صور التركيب الفعلية</span>
                        {!hideInstalledImages && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                        عرض صور الواجهات الحقيقية بعد التركيب في الموقع
                      </div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setHideInstalledImages(true);
                      setShowInstalledImages(false);
                    }}
                    className={`p-3 rounded-xl border text-right transition-all cursor-pointer flex items-center gap-3 relative ${
                      hideInstalledImages
                        ? 'border-primary bg-primary/10 shadow-xs ring-1 ring-primary/30'
                        : 'border-border/70 bg-card hover:border-primary/40'
                    }`}
                  >
                    <div className={`p-2 rounded-lg shrink-0 ${hideInstalledImages ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                      <EyeOff className="h-4 w-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-bold flex items-center gap-1.5">
                        <span>صورة اللوحة الأصلية</span>
                        {hideInstalledImages && <CheckCircle2 className="h-3.5 w-3.5 text-primary" />}
                      </div>
                      <div className="text-[11px] text-muted-foreground mt-0.5 leading-tight">
                        إخفاء صور التركيب وعرض صورة اللوحة النظيفة فقط
                      </div>
                    </div>
                  </button>
                </div>
              </div>

              {printMode === 'cards' && (
                <div className="p-3.5 rounded-xl border border-border/70 bg-card/70 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-start gap-2.5 min-w-0 pr-1">
                      <div className="p-1.5 rounded-lg bg-primary/10 text-primary mt-0.5 shrink-0">
                        <Sparkles className="h-3.5 w-3.5" />
                      </div>
                      <div className="space-y-0.5 min-w-0">
                        <Label htmlFor="includeDesigns" className="text-xs font-bold cursor-pointer text-foreground block">
                          تضمين صور التصاميم الإعلانية
                        </Label>
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          إدراج صورة التصميم المعتمد أسفل صورة اللوحة في البطاقة
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {includeDesigns ? (
                        <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] h-5 px-1.5 font-semibold">
                          مضمن
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-muted-foreground text-[10px] h-5 px-1.5 font-semibold">
                          مستبعد
                        </Badge>
                      )}
                      <Switch
                        id="includeDesigns"
                        checked={includeDesigns}
                        onCheckedChange={(c) => setIncludeDesigns(!!c)}
                      />
                    </div>
                  </div>

                  {includeDesigns && (
                    <div className="pt-2.5 border-t border-border/40 flex items-center justify-between mr-6">
                      <div className="space-y-0.5 min-w-0">
                        <Label htmlFor="showDesignName" className="text-xs font-medium cursor-pointer text-foreground block">
                          عرض اسم التصميم الفعلي
                        </Label>
                        <p className="text-[11px] text-muted-foreground leading-tight">
                          استبدال عبارة "تصميم الوجه" باسم الحملة أو الملف الفعلي
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {showDesignName ? (
                          <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] h-5 px-1.5 font-semibold">
                            الاسم الفعلي
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-muted-foreground text-[10px] h-5 px-1.5 font-semibold">
                            افتراضي
                          </Badge>
                        )}
                        <Switch
                          id="showDesignName"
                          checked={showDesignName}
                          onCheckedChange={(c) => setShowDesignName(!!c)}
                        />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </section>

            {/* تبويب 3: المظهر والتنسيق */}
            <section aria-labelledby="print-settings-heading" className="print-control-card space-y-2 rounded-xl border border-border bg-card p-4"><h3 id="print-settings-heading" className="flex items-center gap-2 border-b border-border pb-3 text-sm font-semibold"><SlidersHorizontal className="h-4 w-4 text-primary" />المظهر والتنسيق</h3>
              <div className="grid grid-cols-1 gap-0">
                {printMode === 'cards' && (
                  <div className="flex min-h-[40px] items-center justify-between gap-3 border-b border-border/50 px-2 py-1.5 last:border-b-0 hover:bg-muted/30 transition-colors"><Label htmlFor="showBillboardStatusOpt" className="flex min-h-[32px] flex-1 items-center gap-2 cursor-pointer text-xs font-medium text-foreground"><Activity className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />إظهار حالة اللوحة</Label><Switch
                        id="showBillboardStatusOpt"
                        checked={showBillboardStatusOpt}
                        onCheckedChange={(c) => setShowBillboardStatusOpt(!!c)}
                      /></div>
                )}

                <div className="flex min-h-[40px] items-center justify-between gap-3 border-b border-border/50 px-2 py-1.5 last:border-b-0 hover:bg-muted/30 transition-colors"><Label htmlFor="showSizeDimensionLabels" className="flex min-h-[32px] flex-1 items-center gap-2 cursor-pointer text-xs font-medium text-foreground"><Ruler className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />مسميات المقاس والأبعاد</Label><Switch
                      id="showSizeDimensionLabels"
                      checked={showSizeDimensionLabels}
                      onCheckedChange={(c) => setShowSizeDimensionLabels(!!c)}
                    /></div>
              </div>

              {/* إعدادات القالب والغلاف المتقدمة */}
              <div className="p-3.5 rounded-xl border border-border/80 bg-muted/20 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 rounded-lg bg-primary/10 text-primary mt-0.5 shrink-0">
                      <LayoutTemplate className="h-4 w-4" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="text-xs font-bold text-foreground">
                        {printMode === 'cards' ? 'قالب الخلفية ومواضع الحقول' : 'مظهر وتنسيق جدول الطباعة'}
                      </div>
                      <div className="text-[11px] text-muted-foreground leading-tight">
                        {printMode === 'cards' ? 'تخصيص صورة الغلاف الخلفية وتنسيقات الحقول' : 'التحكم في أعمدة الجدول، الألوان، وارتفاع الصفوف'}
                      </div>
                    </div>
                  </div>
                  {printMode === 'cards' ? (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setCustomizationDialogOpen(true)}
                      className="h-8 gap-1.5 text-xs font-bold border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      إعدادات الغلاف
                    </Button>
                  ) : (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTableSettingsDialogOpen(true)}
                      className="h-8 gap-1.5 text-xs font-bold border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer"
                    >
                      <Settings2 className="h-3.5 w-3.5" />
                      إعدادات الجدول
                    </Button>
                  )}
                </div>
                {printMode === 'cards' && (
                  <div className="pt-2 border-t border-border/40">
                    <BackgroundSelector
                      value={customBackgroundUrl}
                      onChange={setCustomBackgroundUrl}
                    />
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
          {/* تبقى إجراءات الطباعة ظاهرة أثناء تمرير الخيارات */}
          <div className="shrink-0 border-t border-border bg-muted/30 px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 flex flex-col-reverse sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2 flex-wrap [&_button]:min-h-10 [&_input]:min-h-10">
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="cursor-pointer text-muted-foreground hover:text-foreground text-xs h-9 px-3"
              >
                إلغاء
              </Button>

              {/* أزرار الواتساب */}
              {selectedTeamIds.size > 0 && (() => {
                const teamsWithPhone = Array.from(selectedTeamIds)
                  .map(id => teams[id])
                  .filter(t => t?.phone_number || t?.phone);
                const firstTeam = teamsWithPhone[0];
                const savedPhone = firstTeam?.phone_number || firstTeam?.phone;

                return (
                  <div className="inline-flex">
                    {showWhatsAppInput && !savedPhone ? (
                      <div className="flex items-center gap-1.5">
                        <Input
                          placeholder="رقم الواتساب"
                          value={manualPhone}
                          onChange={(e) => setManualPhone(e.target.value)}
                          className="h-8 w-32 text-xs text-left"
                          dir="ltr"
                        />
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => {
                            if (manualPhone.trim()) {
                              handleSendWhatsAppUpload(manualPhone.trim());
                              setShowWhatsAppInput(false);
                              setManualPhone('');
                            } else {
                              toast.error('أدخل رقم الهاتف أولاً');
                            }
                          }}
                          variant="outline"
                          className="h-8 text-xs border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                          disabled={loading || filteredItems.length === 0}
                        >
                          إرسال
                        </Button>
                      </div>
                    ) : (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                          if (savedPhone) {
                            handleSendWhatsAppUpload(savedPhone);
                          } else {
                            setShowWhatsAppInput(true);
                          }
                        }}
                        variant="outline"
                        className="h-8 text-xs gap-1.5 border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"
                        disabled={loading || filteredItems.length === 0}
                      >
                        <MessageCircle className="h-3.5 w-3.5" />
                        واتساب الفريق
                      </Button>
                    )}
                  </div>
                );
              })()}

              {customerPhone && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleSendWhatsAppUpload(customerPhone)}
                  variant="outline"
                  className="h-8 text-xs gap-1.5 border-sky-500/40 text-sky-600 hover:bg-sky-500/10 cursor-pointer"
                  disabled={loading || filteredItems.length === 0}
                >
                  <MessageCircle className="h-3.5 w-3.5" />
                  واتساب العميل
                </Button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <Button
                type="button"
                onClick={handleDownloadPDF}
                disabled={loading || settingsLoading || filteredItems.length === 0}
                variant="outline"
                className="cursor-pointer gap-2 text-xs font-bold border-primary/30 text-primary hover:bg-primary/10 h-10 px-4"
              >
                <FileDown className="h-4 w-4" />
                <span>تصدير PDF</span>
              </Button>
              <Button
                type="button"
                onClick={handlePrint}
                disabled={loading || settingsLoading || (printMode === 'table' && tableSettingsLoading) || filteredItems.length === 0}
                className="cursor-pointer gap-2 text-xs font-bold h-10 px-5 shadow-sm motion-safe:active:scale-95 bg-primary hover:bg-primary/90 text-primary-foreground"
              >
                <Printer className="h-4 w-4" />
                <span>طباعة {printMode === 'table' ? 'الجدول' : 'البطاقات'} ({filteredItems.length} لوحة)</span>
              </Button>
            </div>
          </div>
      </DialogContent>

      <PrintCustomizationDialog
        open={customizationDialogOpen}
        onOpenChange={setCustomizationDialogOpen}
        backgroundUrl={customBackgroundUrl}
      />

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
