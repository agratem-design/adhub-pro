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
import { Printer, FileDown, Users, Check, FileText, Settings2, Table2, MessageCircle } from 'lucide-react';
import QRCode from 'qrcode';
import html2pdf from 'html2pdf.js';
import { supabase } from '@/integrations/supabase/client';
import { BackgroundSelector } from '@/components/billboard-print/BackgroundSelector';
import { PrintCustomizationDialog } from '@/components/print-customization';
import { usePrintCustomization } from '@/hooks/usePrintCustomization';
import { useTablePrintSettings } from '@/hooks/useTablePrintSettings';
import { TablePrintSettingsDialog } from '@/components/tasks/TablePrintSettingsDialog';
import { createPinSvgUrl, getBillboardStatus } from '@/hooks/useMapMarkers';
import { formatFacesCountArabic } from '@/lib/utils';
import { preparePrintWindow, writePrintWindow } from '@/utils/printWindowHelper';

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
}

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
): Promise<Record<string, { design_face_a?: string; design_face_b?: string }>> => {
  const result: Record<string, { design_face_a?: string; design_face_b?: string }> = {};
  if (!items || items.length === 0) return result;

  const billboardIds = [...new Set(items.map(i => Number(i.billboard_id)).filter(id => !isNaN(id) && id > 0))];
  if (billboardIds.length === 0) return result;

  // 1. فحص الحقول المباشرة
  items.forEach(item => {
    const idKey = String(item.billboard_id);
    const b = billboardsMap[item.billboard_id] || billboardsMap[Number(item.billboard_id)];
    const faceA = item.design_face_a || b?.design_face_a || b?.installed_design_face_a || undefined;
    const faceB = item.design_face_b || b?.design_face_b || b?.installed_design_face_b || undefined;
    if (faceA || faceB) {
      result[idKey] = { design_face_a: faceA, design_face_b: faceB };
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
        if (!result[idKey] || (!result[idKey].design_face_a && !result[idKey].design_face_b)) {
          const faceA = row.design_face_a || row.task_designs?.design_face_a_url || undefined;
          const faceB = row.design_face_b || row.task_designs?.design_face_b_url || undefined;
          if (faceA || faceB) {
            result[idKey] = { design_face_a: faceA, design_face_b: faceB };
            result[String(Number(idKey))] = result[idKey];
          }
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
  customerPhone = ''
}: UnifiedPrintAllDialogProps) {
  const PDF_PORTRAIT_WIDTH_PX = 2480;
  const PDF_PORTRAIT_HEIGHT_PX = 3508;
  const PDF_LANDSCAPE_WIDTH_PX = 3508;
  const PDF_LANDSCAPE_HEIGHT_PX = 2480;

  const [includeDesigns, setIncludeDesigns] = useState(true);
  const [showDesignName, setShowDesignName] = useState(false);
  const [showTeamName, setShowTeamName] = useState(true);
  const [hideCustomerName, setHideCustomerName] = useState(true);
  const [hideInstallDate, setHideInstallDate] = useState(true);
  const [printType, setPrintType] = useState<'client' | 'installation'>('client');
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

  // تجميع العناصر حسب الفريق
  const itemsByTeam = useMemo(() => {
    if (!showTeamFilter) return { 'all': items };
    const groups: Record<string, BillboardPrintItem[]> = {};
    items.forEach(item => {
      const teamId = item.team_id || 'unknown';
      if (!groups[teamId]) groups[teamId] = [];
      groups[teamId].push(item);
    });
    return groups;
  }, [items, showTeamFilter]);

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
        .select('name,label,color');
      const map: Record<string, { label: string; color: string }> = {};
      (data || []).forEach((s: any) => {
        map[s.name] = { label: s.label || s.name, color: s.color || '#6b7280' };
      });
      setMaintenanceStatusesMap(map);
    })();
  }, [open]);

  // جلب صور التركيب من قاعدة البيانات (مرتبة تنازلياً للحصول على الأحدث)
  useEffect(() => {
    if (!showInstalledImages || !open) return;
    const fetchInstalledImages = async () => {
      const billboardIds = [...new Set(items.map(i => i.billboard_id))];
      if (billboardIds.length === 0) return;
      
      const { data } = await supabase
        .from('installation_task_items')
        .select('billboard_id, installed_image_face_a_url, installed_image_face_b_url, created_at')
        .in('billboard_id', billboardIds)
        .or('installed_image_face_a_url.not.is.null,installed_image_face_b_url.not.is.null')
        .order('created_at', { ascending: false });
      
      if (data) {
        const map: Record<number, { face_a?: string; face_b?: string }> = {};
        data.forEach((row: any) => {
          // نأخذ آخر (أحدث) صورة تركيب مسجلة لكل لوحة
          if (!map[row.billboard_id]) {
            map[row.billboard_id] = {
              face_a: row.installed_image_face_a_url || undefined,
              face_b: row.installed_image_face_b_url || undefined,
            };
          }
        });
        setInstalledImagesData(map);
      }
    };
    fetchInstalledImages();
  }, [showInstalledImages, open, items]);

  // جلب التصاميم المتوفرة والإعلانات السابقة للوحات
  useEffect(() => {
    if (!open) return;
    let isMounted = true;

    const fetchExtraData = async () => {
      try {
        const [prevAds, designs] = await Promise.all([
          resolveBillboardPreviousAds(items, contextNumber, billboards),
          resolveBillboardDesigns(items, billboards)
        ]);
        if (isMounted) {
          setPreviousAdsData(prevAds);
          setDynamicDesignsMap(designs);
        }
      } catch (err) {
        console.error('Error fetching extra billboard data:', err);
      }
    };

    fetchExtraData();

    return () => {
      isMounted = false;
    };
  }, [open, items, contextNumber, billboards]);

  const blobToBase64 = (blob: Blob) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });

  const filteredItems = useMemo(() => {
    if (!showTeamFilter) return items;
    
    let result = items;
    
    // فلتر حسب الفرق المختارة
    if (selectedTeamIds.size > 0) {
      result = result.filter(item => {
        const teamId = item.team_id || 'unknown';
        return selectedTeamIds.has(teamId);
      });
    } else {
      result = [];
    }
    
    // فلتر حسب حدود مدن الفرق
    if (respectCityLimits && selectedTeamIds.size > 0) {
      result = result.filter(item => {
        const teamId = item.team_id || 'unknown';
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

  // ترتيب اللوحات
  const sortBillboardsBySize = async (items: BillboardPrintItem[]) => {
    try {
      const [sizesRes, municipalitiesRes, levelsRes] = await Promise.all([
        supabase.from('sizes').select('name, sort_order').order('sort_order', { ascending: true }),
        supabase.from('municipalities').select('name, sort_order').order('sort_order', { ascending: true }),
        supabase.from('billboard_levels').select('level_code, sort_order').order('sort_order', { ascending: true })
      ]);
      
      const sizeOrderMap = new Map((sizesRes.data || []).map((s: any) => [s.name, s.sort_order ?? 999]));
      const municipalityOrderMap = new Map((municipalitiesRes.data || []).map((m: any) => [m.name, m.sort_order ?? 999]));
      const levelOrderMap = new Map((levelsRes.data || []).map((l: any) => [l.level_code, l.sort_order ?? 999]));
      
      return [...items].sort((a, b) => {
        const billboardA = billboards[a.billboard_id];
        const billboardB = billboards[b.billboard_id];
        
        const sizeOrderA = sizeOrderMap.get(billboardA?.Size) ?? 999;
        const sizeOrderB = sizeOrderMap.get(billboardB?.Size) ?? 999;
        if (sizeOrderA !== sizeOrderB) return sizeOrderA - sizeOrderB;
        
        const municipalityOrderA = municipalityOrderMap.get(billboardA?.Municipality) ?? 999;
        const municipalityOrderB = municipalityOrderMap.get(billboardB?.Municipality) ?? 999;
        if (municipalityOrderA !== municipalityOrderB) return municipalityOrderA - municipalityOrderB;
        
        const levelOrderA = levelOrderMap.get(billboardA?.Level) ?? 999;
        const levelOrderB = levelOrderMap.get(billboardB?.Level) ?? 999;
        return levelOrderA - levelOrderB;
      });
    } catch (e) {
      return items;
    }
  };

  const getContextLabel = () => {
    switch (contextType) {
      case 'installation': return 'تركيب';
      case 'removal': return 'إزالة';
      case 'contract': return 'عقد';
      case 'offer': return 'عرض';
      default: return '';
    }
  };

  const getCleanDocumentTitle = () => {
    const label = getContextLabel();
    let rawCust = (customerName || '').trim();
    let rawCompany = (companyName || '').trim();
    const allTeamNames = Object.values(teams || {}).map(t => t?.team_name).filter(Boolean);

    // حساب اسم الفريق المختار
    let selectedTeamStr = '';
    if (showTeamName) {
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

    for (let pageIndex = 0; pageIndex < sortedItems.length; pageIndex++) {
      const item = sortedItems[pageIndex];
      const sequentialNumber = pageIndex + 1;
      const billboard = billboards[item.billboard_id];
      if (!billboard) continue;

      const bIdKey = String(item.billboard_id);
      const dynDesign = freshDesigns[bIdKey] || dynamicDesignsMap[item.billboard_id] || dynamicDesignsMap[Number(item.billboard_id)];
      const designFaceA = item.design_face_a || billboard.design_face_a || billboard.installed_design_face_a || dynDesign?.design_face_a || null;
      const designFaceB = item.design_face_b || billboard.design_face_b || billboard.installed_design_face_b || dynDesign?.design_face_b || null;
      const itemPreviousAd = (item as any).previous_ad || (item as any).previous_ad_type || 
                             freshPrevAds[bIdKey] || 
                             previousAdsData[item.billboard_id] || previousAdsData[bIdKey] || previousAdsData[Number(item.billboard_id)] || 
                             billboards[item.billboard_id]?.previous_ad || billboards[item.billboard_id]?.previous_ad_type || '';
      
      // إذا كان خيار صور التركيب مفعّل، نجلبها من البيانات المحملة
      const fetchedInstalled = showInstalledImages ? installedImagesData[item.billboard_id] : null;
      const installedImageFaceA = item.installed_image_face_a_url || fetchedInstalled?.face_a || null;
      const installedImageFaceB = item.installed_image_face_b_url || fetchedInstalled?.face_b || null;
      
      const mainImage = installedImageFaceA && !installedImageFaceB 
        ? installedImageFaceA 
        : (billboard.Image_URL || '');

      const coords = billboard.GPS_Coordinates || '';
      const mapLink = coords 
        ? `https://www.google.com/maps?q=${encodeURIComponent(coords)}` 
        : 'https://www.google.com/maps?q=';
      
      let qrCodeDataUrl = '';
      try {
        qrCodeDataUrl = await QRCode.toDataURL(mapLink, { width: 100 });
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
      const facesCount = billboard.Faces_Count || 1;
      const municipalityDistrict = [municipality, district].filter(Boolean).join(' - ') || '—';

      const installationDate = (!hideInstallDate && item.installation_date)
        ? new Date(item.installation_date).toLocaleDateString('ar-LY', { year: 'numeric', month: '2-digit', day: '2-digit' })
        : '';

      // نص حالة اللوحة (يظهر أسفل الاسم)
      const mStatusKey = (billboard.maintenance_status || '').toString().trim();
      const showBillboardStatus = showBillboardStatusOpt
        && (s as any).billboard_status_enabled === 'true'
        && mStatusKey;
      const mStatusInfo = mStatusKey ? maintenanceStatusesMap[mStatusKey] : undefined;
      const billboardStatusLabel = mStatusInfo?.label || mStatusKey;
      const billboardStatusColor = mStatusInfo?.color || '#b91c1c';
      const billboardStatusFontSize = (s as any).billboard_status_font_size || '14px';
      const billboardStatusOffsetY = (s as any).billboard_status_offset_y || '6mm';

      const itemTeamName = item.team_id && teams[item.team_id]?.team_name ? teams[item.team_id].team_name : '';
      const displayTeamNames = itemTeamName || (showTeamFilter 
        ? Array.from(selectedTeamIds).map(id => teams[id]?.team_name).filter(Boolean).join(' - ')
        : '');

      const itemContractNumber = item.contract_number || contextNumber;
      const itemAdType = item.ad_type || adType;
      const customerCompanyText = !hideCustomerName ? [customerName, companyName].filter(Boolean).join(' - ') : '';
      const contractInfoText = itemContractNumber 
        ? `${getContextLabel()} رقم: ${itemContractNumber}${customerCompanyText ? ' - الزبون: ' + customerCompanyText : ''}${itemAdType ? ' - نوع الإعلان: ' + itemAdType : ''}`
        : (itemAdType ? `${customerCompanyText ? 'الزبون: ' + customerCompanyText + ' - ' : ''}نوع الإعلان: ${itemAdType}` : customerCompanyText ? `الزبون: ${customerCompanyText}` : '');

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
            <div class="overlay-container" style="position: relative; width: 100%; height: 100%; overflow: hidden; background: #fafafa;">
              <img src="${mainImage}" alt="صورة اللوحة" class="billboard-image" style="width: 100%; height: 100%; object-fit: contain; display: block;" />
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
          imageSection = `<img src="${mainImage}" alt="صورة اللوحة" class="billboard-image" />`;
        }
      } else if (showPinFallback) {
        imageSection = `<img src="${mainImage}" alt="صورة اللوحة" class="billboard-image" />`;
      } else if (showPinFallback) {
        imageSection = `<div class="pin-fallback">
            <img src="${pinSvgDataUrl}" alt="دبوس اللوحة" style="width: 80px; height: auto; margin-bottom: 8px;" />
            <div style="font-size: 11px; color: #666; direction: ltr;">${coords || 'لا توجد إحداثيات'}</div>
          </div>`;
      } else {
        imageSection = `<div class="pin-fallback">
            <div style="font-size: 13px; color: #999; direction: rtl;">لا توجد صورة</div>
            <div style="font-size: 11px; color: #666; direction: ltr; margin-top: 4px;">${coords || 'لا توجد إحداثيات'}</div>
          </div>`;
      }

      pages.push(`
        <div class="page">
          <div class="background"><img src="${customBackgroundUrl}" alt="" /></div>

          ${contextType !== 'contract' && contextType !== 'offer' && contextType !== 'installation' && contextType !== 'removal' ? `
          <div class="absolute-field pin-badge">
            <img src="${pinSvgDataUrl}" alt="دبوس" style="width: 60px; height: auto;" />
          </div>
          ` : ''}

          <div class="absolute-field contract-number" style="top: ${s.contract_number_top}; right: ${s.contract_number_right}; font-size: ${s.contract_number_font_size}; font-weight: ${s.contract_number_font_weight}; color: ${s.contract_number_color}; text-align: ${s.contract_number_alignment}; max-width: 75%; ${s.contract_number_offset_x && s.contract_number_offset_x !== '0mm' ? `margin-right: ${s.contract_number_offset_x};` : ''}">
            ${showPreviousAd && itemPreviousAd ? `
              <div class="previous-ad-row" style="font-size: 0.95em; font-weight: 700; color: #b8860b; margin-bottom: 2px; line-height: 1.2;">
                <span>الإعلان السابق: </span><span style="color: #000; font-weight: 800;">${itemPreviousAd}</span>
              </div>
            ` : ''}
            <div>${contractInfoText}</div>
          </div>

          ${installationDate ? `
          <div class="absolute-field installation-date" style="top: ${s.installation_date_top}; right: ${s.installation_date_right}; font-family: '${s.primary_font}', Arial, sans-serif; font-size: ${s.installation_date_font_size}; font-weight: ${s.installation_date_font_weight || '400'}; color: ${s.installation_date_color}; text-align: ${s.installation_date_alignment}; ${s.installation_date_offset_x && s.installation_date_offset_x !== '0mm' ? `margin-right: ${s.installation_date_offset_x};` : ''}">
            ${contextType === 'removal' ? 'تاريخ الإزالة' : 'تاريخ التركيب'}: ${installationDate}
          </div>
          ` : ''}

          <div class="absolute-field billboard-name" style="top: ${toCssLength(s.billboard_name_top)}; left: calc(${s.billboard_name_left} - 60mm${s.billboard_name_offset_x && s.billboard_name_offset_x !== '0mm' ? ` + ${s.billboard_name_offset_x}` : ''}); width: 120mm; text-align: ${s.billboard_name_alignment || 'center'}; font-size: ${s.billboard_name_font_size}; font-weight: ${s.billboard_name_font_weight}; color: ${s.billboard_name_color};">
            ${name}
          </div>

          ${showBillboardStatus ? `
          <div class="absolute-field billboard-status" style="top: calc(${toCssLength(s.billboard_name_top)} + ${s.billboard_name_font_size} + ${toCssLength(billboardStatusOffsetY)}); left: calc(${s.billboard_name_left} - 60mm${s.billboard_name_offset_x && s.billboard_name_offset_x !== '0mm' ? ` + ${s.billboard_name_offset_x}` : ''}); width: 120mm; text-align: ${s.billboard_name_alignment || 'center'}; font-size: ${billboardStatusFontSize}; font-weight: 600; color: #000;">
            ${billboardStatusLabel}
          </div>
          ` : ''}

          <div class="absolute-field size" style="top: ${toCssLength(s.size_top)}; left: calc(${s.size_left} - 40mm${s.size_offset_x && s.size_offset_x !== '0mm' ? ` + ${s.size_offset_x}` : ''}); width: 80mm; text-align: ${s.size_alignment || 'center'}; font-size: ${s.size_font_size}; font-weight: ${s.size_font_weight}; color: ${s.size_color};">
            ${generatePrintedSizeHtml(size, false, showSizeDimensionLabels)}
          </div>
          
          <div class="absolute-field faces-count" style="top: calc(${toCssLength(s.size_top)} + ${toCssLength(s.faces_count_top)}); left: calc(${s.size_left} - 40mm${s.size_offset_x && s.size_offset_x !== '0mm' ? ` + ${s.size_offset_x}` : ''}); width: 80mm; text-align: ${s.size_alignment || 'center'}; font-size: ${s.faces_count_font_size}; color: ${s.faces_count_color};">
            ${isCutoutEnabled ? 'مجسم - ' : ''}${formatFacesCountArabic(facesCount)}
          </div>

          ${printType === 'installation' && showTeamName && displayTeamNames ? `
            <div class="absolute-field print-type" style="top: ${s.team_name_top}; right: ${s.team_name_right}; font-size: ${s.team_name_font_size}; color: ${s.team_name_color || '#000'}; font-weight: ${s.team_name_font_weight}; text-align: ${s.team_name_alignment}; ${s.team_name_offset_x && s.team_name_offset_x !== '0mm' ? `margin-right: ${s.team_name_offset_x};` : ''}">
               ${contextType === 'removal' ? 'فريق الإزالة' : 'فريق التركيب'}: ${displayTeamNames}
            </div>
          ` : ''}

          ${installedImageFaceA && installedImageFaceB ? `
            <div class="absolute-field" style="top: ${s.installed_images_top}; left: calc(${s.installed_images_left} - ${s.installed_images_width} / 2); width: ${s.installed_images_width}; display: flex; gap: ${s.installed_images_gap};">
              <div style="flex: 1; text-align: center;">
                <div style="font-size: 12px; font-weight: 600; color: #000; margin-bottom: 3mm;">الوجه الأمامي</div>
                <div style="height: ${s.installed_image_height}; overflow: hidden; border: 2px solid #000; border-radius: 8px;">
                  <img src="${installedImageFaceA}" alt="الوجه الأمامي" style="width: 100%; height: 100%; object-fit: contain;" />
                </div>
              </div>
              <div style="flex: 1; text-align: center;">
                <div style="font-size: 12px; font-weight: 600; color: #000; margin-bottom: 3mm;">الوجه الخلفي</div>
                <div style="height: ${s.installed_image_height}; overflow: hidden; border: 2px solid #000; border-radius: 8px;">
                  <img src="${installedImageFaceB}" alt="الوجه الخلفي" style="width: 100%; height: 100%; object-fit: contain;" />
                </div>
              </div>
            </div>
          ` : `
            <div class="absolute-field image-container" style="top: ${s.main_image_top}; left: calc(${s.main_image_left} - ${s.main_image_width} / 2); width: ${s.main_image_width}; height: ${includeDesigns && hasDesigns ? s.installed_image_height : s.main_image_height};">
              ${imageSection}
            </div>
          `}

          <div class="absolute-field location-info" style="top: ${s.location_info_top}; left: calc(${toCssLength(s.location_info_left)} + ${toMmOffset(s.location_info_offset_x)}); width: ${s.location_info_width}; font-size: ${s.location_info_font_size}; color: ${s.location_info_color}; text-align: ${s.location_info_alignment};">
            ${municipalityDistrict}
          </div>

          <div class="absolute-field landmark-info" style="top: ${s.landmark_info_top}; left: calc(${toCssLength(s.landmark_info_left)} + ${toMmOffset(s.landmark_info_offset_x)}); width: ${s.landmark_info_width}; font-size: ${s.landmark_info_font_size}; color: ${s.landmark_info_color}; text-align: ${s.landmark_info_alignment};">
            ${landmark || '—'}
          </div>

          ${qrCodeDataUrl ? `
            <div class="absolute-field qr-container" style="top: ${s.qr_top}; left: ${s.qr_left}; width: ${s.qr_size}; height: ${s.qr_size};">
              <a href="${mapLink}" target="_blank" style="display:block;width:100%;height:100%;" title="اضغط لفتح الموقع على الخريطة">
                <img src="${qrCodeDataUrl}" alt="QR" class="qr-code" style="cursor:pointer;" />
              </a>
            </div>
          ` : ''}

          ${includeDesigns && hasDesigns ? `
            <div class="absolute-field designs-section" style="top: ${toCssLength(s.designs_top)}; left: ${s.designs_left}; width: ${s.designs_width}; display: flex; gap: ${s.designs_gap}; align-items: flex-start;">
              ${designFaceA ? `
                <div class="design-item">
                  <div class="design-label">${showDesignName && itemAdType ? itemAdType : 'تصميم الوجه الأمامي'}</div>
                  <img src="${designFaceA}" alt="تصميم الوجه الأمامي" class="design-image" style="max-height: ${s.design_image_height};" />
                </div>
              ` : ''}
              ${designFaceB ? `
                <div class="design-item">
                  <div class="design-label">${showDesignName && itemAdType ? itemAdType : 'تصميم الوجه الخلفي'}</div>
                  <img src="${designFaceB}" alt="تصميم الوجه الخلفي" class="design-image" style="max-height: ${s.design_image_height};" />
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
            image-rendering: crisp-edges;
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
          .print-dim-label { font-size: 0.6em; opacity: 0.8; margin-bottom: 2px; }
          .print-dim-value { font-weight: inherit; }
          .print-dim-separator { margin: 0 0.1em; opacity: 0.7; }
          .contract-number { font-family: 'Doran', Arial, sans-serif; font-size: 16px; font-weight: 500; line-height: 1.2; }
          .location-info, .landmark-info { font-family: 'Doran', Arial, sans-serif; font-size: 16px; line-height: 1.2; }

          .image-container {
            overflow: hidden;
            background: rgba(255,255,255,0.8);
            border: 3px solid #000;
            border-radius: 0 0 0 8px;
            display: flex;
            align-items: center;
            justify-content: center;
          }

          .billboard-image { max-width: 100%; max-height: 100%; width: auto; height: auto; object-fit: contain; display: block; }
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

          .designs-section { flex-wrap: wrap; }
          .design-item { flex: 1; min-width: 70mm; text-align: center; display: flex; flex-direction: column; align-items: center; }
          .design-label { font-family: 'Doran', Arial, sans-serif; font-size: 13px; font-weight: 500; margin-bottom: 2mm; color: #333; line-height: 1; white-space: nowrap; }
          .design-image { width: 100%; height: auto; max-height: 42mm; object-fit: contain; border: 1px solid #ddd; border-radius: 4px; }
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
              height: 297mm;
              overflow: hidden;
              margin: 0;
            }
            .page:last-child { page-break-after: auto; }
          }
        </style>
      </head>
      <body>
        ${pages.join('\n')}
        <script>
          function adjustOverlayPositions() {
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
      .filter(c => c.enabled)
      .sort((a, b) => a.order - b.order);

    const columnHasData: Record<string, boolean> = {};
    enabledColumns.forEach(col => { columnHasData[col.id] = false; });

    sortedItems.forEach(item => {
      const billboard = billboards[item.billboard_id];
      if (!billboard) return;
      enabledColumns.forEach(col => {
        switch (col.id) {
          case 'row_number': columnHasData[col.id] = true; break;
          case 'billboard_image': if (billboard.Image_URL) columnHasData[col.id] = true; break;
          case 'billboard_name': if (billboard.Billboard_Name) columnHasData[col.id] = true; break;
          case 'size': if (billboard.Size) columnHasData[col.id] = true; break;
          case 'faces_count': if (billboard.Faces_Count) columnHasData[col.id] = true; break;
          case 'location': if ((printCityInsteadOfMunicipality ? billboard.City : billboard.Municipality) || billboard.District) columnHasData[col.id] = true; break;
          case 'landmark': if (billboard.Nearest_Landmark) columnHasData[col.id] = true; break;
          case 'contract_number': if (item.contract_number || contextNumber) columnHasData[col.id] = true; break;
          case 'installation_date': if (!hideInstallDate && item.installation_date) columnHasData[col.id] = true; break;
          case 'design_images': if (item.design_face_a || item.design_face_b) columnHasData[col.id] = true; break;
          case 'installed_images': if (item.installed_image_face_a_url || item.installed_image_face_b_url) columnHasData[col.id] = true; break;
          case 'qr_code': if (billboard.GPS_Coordinates) columnHasData[col.id] = true; break;
        }
      });
    });

    const finalColumns = s.auto_hide_empty_columns 
      ? enabledColumns.filter(col => columnHasData[col.id])
      : enabledColumns;

    const pages: string[] = [];
    const rowsPerPage = Math.min(s.rows_per_page || 11, 11);
    
    for (let pageIndex = 0; pageIndex < Math.ceil(sortedItems.length / rowsPerPage); pageIndex++) {
      const pageItems = sortedItems.slice(pageIndex * rowsPerPage, (pageIndex + 1) * rowsPerPage);
      
      const tableRows = await Promise.all(pageItems.map(async (item, index) => {
        const billboard = billboards[item.billboard_id];
        if (!billboard) return '';
        
        const globalIndex = pageIndex * rowsPerPage + index + 1;
        const name = billboard.Billboard_Name || `لوحة ${item.billboard_id}`;
        const size = billboard.Size || '';
        const facesCount = billboard.Faces_Count || 1;
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
            try { qrCodeDataUrl = await QRCode.toDataURL(mapLink, { width: 50 }); } catch (e) {}
          }
        }
        
        const bIdKey = String(item.billboard_id);
        const dynDesign = freshDesigns[bIdKey] || dynamicDesignsMap[item.billboard_id] || dynamicDesignsMap[Number(item.billboard_id)];
        const tblDesignFaceA = item.design_face_a || billboard.design_face_a || billboard.installed_design_face_a || dynDesign?.design_face_a || null;
        const tblDesignFaceB = item.design_face_b || billboard.design_face_b || billboard.installed_design_face_b || dynDesign?.design_face_b || null;
        const tblPreviousAd = (item as any).previous_ad || (item as any).previous_ad_type || 
                              freshPrevAds[bIdKey] || 
                              previousAdsData[item.billboard_id] || previousAdsData[bIdKey] || previousAdsData[Number(item.billboard_id)] || 
                              billboards[item.billboard_id]?.previous_ad || billboards[item.billboard_id]?.previous_ad_type || '';

        const cells = finalColumns.map((col) => {
          switch (col.id) {
            case 'row_number':
              return `<td class="number-cell"><div class="billboard-number">${globalIndex}</div></td>`;
            case 'billboard_image':
              const fetchedInstImg = showInstalledImages ? installedImagesData[item.billboard_id] : null;
              const instImgA = item.installed_image_face_a_url || fetchedInstImg?.face_a || null;
              const tblImage = instImgA || billboard.Image_URL || '';
              return `<td class="image-cell">${tblImage 
                ? `<img src="${tblImage}" alt="${name}" class="billboard-image" onerror="this.style.display='none'">`
                : `<div class="image-placeholder"><span>صورة</span></div>`}</td>`;
            case 'billboard_name':
              return `<td style="font-weight: 600; text-align: right; padding: 4px; font-size: 8px;">${name}</td>`;
            case 'size':
              return `<td style="font-weight: 600; font-size: 8px;">${size}</td>`;
            case 'faces_count':
              return `<td style="font-size: 9px; font-weight: 700;">${facesCount}</td>`;
            case 'location':
              return `<td style="text-align: right; padding: 4px; font-size: 8px;">${[municipality, billboard.District].filter(Boolean).join(' - ') || '-'}</td>`;
            case 'landmark':
              return `<td style="text-align: right; padding: 4px; font-size: 8px;">${billboard.Nearest_Landmark || '-'}</td>`;
            case 'contract_number':
              return `<td style="font-size: 8px;">${showPreviousAd && tblPreviousAd ? `<span style="font-size:7px;color:#444;font-weight:700;">السابق: ${tblPreviousAd}</span><br/>` : ''}${itemContractNumber}${itemAdType ? '<br/><span style="font-size:7px;color:#666;">' + itemAdType + '</span>' : ''}</td>`;
            case 'installation_date':
              return `<td style="font-size: 8px;">${installationDate}</td>`;
            case 'design_images':
              return `<td class="image-cell"><div class="img-group">
                ${tblDesignFaceA ? `<img src="${tblDesignFaceA}" class="design-img" />` : ''}
                ${tblDesignFaceB ? `<img src="${tblDesignFaceB}" class="design-img" />` : ''}
                ${!tblDesignFaceA && !tblDesignFaceB ? '-' : ''}
              </div></td>`;
            case 'installed_images':
              const fetchedInst = showInstalledImages ? installedImagesData[item.billboard_id] : null;
              const instA = item.installed_image_face_a_url || fetchedInst?.face_a || null;
              const instB = item.installed_image_face_b_url || fetchedInst?.face_b || null;
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
        
        return `<tr style="height: 60px; background: #fff;">${cells.join('')}</tr>`;
      }));

      const headerCells = finalColumns.map((col, colIndex) => {
        const isFirstColumn = colIndex === 0;
        const headerStyle = isFirstColumn 
          ? `background: ${s.first_column_bg_color}; color: ${s.first_column_text_color}; width: ${col.width || '8%'};`
          : `width: ${col.width || '8%'};`;
        return `<th class="header-cell" style="${headerStyle}">${col.label}</th>`;
      });

      const customerCompanyText = !hideCustomerName ? [customerName, companyName].filter(Boolean).join(' - ') : '';
      pages.push(`
        <div class="info-bar">
          <span>${getContextLabel()} رقم: ${contextNumber}${customerCompanyText ? ' | ' + customerCompanyText : ''}${adType ? ' | ' + adType : ''}${printType === 'installation' && showTeamName && selectedTeamNames ? ' | الفريق: ' + selectedTeamNames : ''} | صفحة ${pageIndex + 1} من ${Math.ceil(sortedItems.length / rowsPerPage)}</span>
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
            background-image: url('${baseUrl}/repo.svg');
            background-size: 100% 100%; background-repeat: no-repeat; z-index: 0;
          }
          .page-content { position: relative; z-index: 1; padding-top: ${tableTopMargin}; }
          .info-bar { margin-bottom: 8px; padding: 6px 10px; background: ${s.header_bg_color}; display: inline-block; }
          .info-bar span { font-size: 10px; color: ${s.header_text_color}; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 10px; font-size: ${s.row_font_size}; background: #fff; }
          th { background: ${s.header_bg_color}; color: ${s.header_text_color}; font-weight: 700; font-size: ${s.header_font_size}; height: 30px; border: 1px solid ${s.border_color}; padding: 4px 2px; text-align: center; }
          td { border: 1px solid ${s.border_color}; padding: 2px; text-align: center; vertical-align: middle; background: #fff; color: #000; }
          td.number-cell { background: ${s.first_column_bg_color}; font-weight: 700; font-size: 9px; color: ${s.first_column_text_color}; width: 60px; }
          td.image-cell { background: #fff; padding: 0; width: 70px; }
          .billboard-image { width: 100%; height: auto; max-height: ${rowHeight}; object-fit: contain; display: block; margin: 0 auto; }
          .billboard-number { color: ${s.first_column_text_color}; font-weight: 700; font-size: 9px; }
          td.qr-cell { width: 60px; padding: 2px; }
          .qr-code { width: 100%; height: auto; max-height: ${rowHeight}; display: block; margin: 0 auto; cursor: pointer; }
          .img-group { display: flex; gap: 2px; justify-content: center; align-items: center; }
          .design-img, .installed-img { max-width: 48%; max-height: calc(${rowHeight} - 4px); object-fit: contain; }
          .image-placeholder { width: 100%; height: ${rowHeight}; background: #f0f0f0; display: flex; align-items: center; justify-content: center; font-size: 7px; color: #666; }
          .print-size-container { display: inline-flex; align-items: center; justify-content: center; gap: 0.12em; direction: rtl; color: inherit; white-space: nowrap; }
          .print-dim-col { display: flex; flex-direction: column; align-items: center; justify-content: center; line-height: 1; color: inherit; }
          .print-dim-label { font-size: 0.6em; opacity: 0.8; margin-bottom: 2px; }
          .print-dim-value { font-weight: inherit; }
          .print-dim-separator { margin: 0 0.1em; opacity: 0.7; }
          @media print {
            body { print-color-adjust: exact; -webkit-print-color-adjust: exact; background: #fff !important; margin: 0; padding: 0; }
            .page { page-break-after: always; margin: 0; box-shadow: none; height: ${isLandscape ? '210mm' : '297mm'}; overflow: hidden; }
            .page:last-child { page-break-after: auto; }
          }
        </style>
      </head>
      <body>
        ${pages.map((pageContent) => `
          <div class="page">
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

      // Wait for fonts to load in iframe
      try {
        if (iframeDoc.fonts) {
          await Promise.race([
            iframeDoc.fonts.ready,
            new Promise(r => setTimeout(r, 3000)),
          ]);
          await new Promise(r => setTimeout(r, 200));
        }
      } catch {}

      // Wait for all images inside iframe
      const images = Array.from(iframeDoc.getElementsByTagName('img'));
      await Promise.all(images.map(img => {
        if (img.complete) return Promise.resolve();
        return new Promise<void>((resolve) => {
          img.onload = () => resolve();
          img.onerror = () => resolve();
        });
      }));

      // Trigger overlay calculations if any overlay containers exist
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

      const pages = Array.from(iframeDoc.querySelectorAll('.page')) as HTMLElement[];
      if (pages.length === 0) throw new Error('لا توجد صفحات للتصدير');

      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      const orientation = isLandscape ? 'landscape' : 'portrait';
      const a4W = isLandscape ? 297 : 210;
      const a4H = isLandscape ? 210 : 297;
      const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation, compress: true });

      for (let i = 0; i < pages.length; i++) {
        const pageEl = pages[i];
        
        // 2D Canvas rendering - Canvas 2D engine matching print preview exactly
        const canvas = await html2canvas(pageEl, {
          scale: 2.5,
          useCORS: true,
          allowTaint: true,
          logging: false,
          backgroundColor: '#ffffff',
          foreignObjectRendering: false, // Pure Canvas 2D engine
          imageTimeout: 15000,
          scrollX: 0,
          scrollY: 0,
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.96);
        if (i > 0) pdf.addPage('a4', orientation);
        pdf.addImage(imgData, 'JPEG', 0, 0, a4W, a4H, undefined, 'FAST');
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
      const pdfFileName = `${getCleanDocumentTitle().replace(/[\\/:*?"<>|#]/g, '-').replace(/\s+/g, ' ').replace(/-+/g, '-').trim()}.pdf`;
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

      const driveFolder = contextType === 'installation' ? 'installation-tasks' : contextType === 'removal' ? 'removal-tasks' : 'contracts';
      const pdfFileName = `${getCleanDocumentTitle().replace(/[\\/:*?"<>|#]/g, '-').replace(/\s+/g, ' ').replace(/-+/g, '-').trim()}.pdf`;
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

  const dialogTitle = title || `${getContextLabel()} لوحات`;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle className="flex flex-col gap-1">
            <div className="flex items-center gap-2 text-lg font-bold">
              <div className="p-1.5 bg-primary/20 rounded-lg">
                <FileText className="h-5 w-5 text-primary" />
              </div>
              <span>{dialogTitle}</span>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-sm font-normal text-muted-foreground mr-9">
              {adType && <Badge variant="secondary">{adType}</Badge>}
              <span>{getContextLabel()} #{contextNumber}</span>
              <span>•</span>
              <Badge className="bg-primary/20 text-primary border-0">{filteredItems.length} لوحة</Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* اختيار الفرق */}
          {showTeamFilter && Object.keys(itemsByTeam).length > 0 && (
            <div className="p-4 bg-muted/50 rounded-xl border space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-bold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  اختر الفرق للطباعة
                </Label>
                <div className="flex gap-1">
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={selectAllTeams}>الكل</Button>
                  <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={clearTeamSelection}>مسح</Button>
                </div>
              </div>
              
              <div className="flex flex-wrap gap-2">
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
                      <Badge variant="secondary" className="text-xs">
                        {respectCityLimits && cityFilteredCount !== teamItems.length
                          ? `${cityFilteredCount}/${teamItems.length}`
                          : teamItems.length}
                      </Badge>
                    </button>
                  );
                })}
              </div>

              <div className="pt-2 border-t space-y-2">
                <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <Checkbox
                    id="respectCityLimits"
                    checked={respectCityLimits}
                    onCheckedChange={(c) => setRespectCityLimits(!!c)}
                  />
                  <Label htmlFor="respectCityLimits" className="cursor-pointer flex-1 text-sm">
                    الالتزام بحدود مدن الفرق (تجاهل اللوحات خارج نطاق المدينة)
                  </Label>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">اللوحات المحددة:</span>
                  <Badge className="text-sm font-bold">{filteredItems.length} لوحة</Badge>
                </div>
              </div>
            </div>
          )}

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

          {/* قسم مطوي: اختيار قالب الخلفية والشعار والإعدادات المتقدمة */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/60 overflow-hidden shadow-md">
            <button
              type="button"
              onClick={() => setShowBackgroundOptions(!showBackgroundOptions)}
              className="w-full p-3.5 flex items-center justify-between bg-slate-900/90 text-right hover:bg-slate-850 transition-colors"
            >
              <div className="flex items-center gap-2">
                <Settings2 className="h-4 w-4 text-amber-400" />
                <span className="text-xs font-black text-slate-200">
                  خيارات قالب الخلفية والشعار والإعدادات المتقدمة {showBackgroundOptions ? '' : '(مطوية)'}
                </span>
              </div>
              <Badge variant="outline" className="text-[10px] text-amber-400 border-amber-500/30">
                {showBackgroundOptions ? 'إخفاء الخيارات' : 'إظهار والتعديل'}
              </Badge>
            </button>

            {showBackgroundOptions && (
              <div className="p-4 border-t border-slate-800/80 space-y-3.5 bg-slate-950/60">
                {printMode === 'cards' && (
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <BackgroundSelector
                      value={customBackgroundUrl}
                      onChange={setCustomBackgroundUrl}
                    />
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCustomizationDialogOpen(true)}
                      className="flex items-center gap-2 rounded-xl text-xs font-bold border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                    >
                      <Settings2 className="h-4 w-4 text-amber-400" />
                      إعدادات الغلاف والطباعة
                    </Button>
                  </div>
                )}

                {printMode === 'table' && (
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <div className="text-xs text-slate-400">
                      تعديل ألوان وتصميم وأعمدة جدول طباعة اللوحات
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setTableSettingsDialogOpen(true)}
                      className="flex items-center gap-2 rounded-xl text-xs font-bold border-slate-700 bg-slate-900 text-slate-200 hover:bg-slate-800"
                    >
                      <Settings2 className="h-4 w-4 text-amber-400" />
                      إعدادات مظهر الجدول
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* خيارات الطباعة */}
          <div className="space-y-3">
            {printMode === 'cards' && (
              <>
                <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                  <Checkbox
                    id="includeDesigns"
                    checked={includeDesigns}
                    onCheckedChange={(c) => setIncludeDesigns(!!c)}
                  />
                  <Label htmlFor="includeDesigns" className="cursor-pointer flex-1">تضمين التصاميم</Label>
                </div>
                {includeDesigns && (
                  <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors mr-6">
                    <Checkbox
                      id="showDesignName"
                      checked={showDesignName}
                      onCheckedChange={(c) => setShowDesignName(!!c)}
                    />
                    <Label htmlFor="showDesignName" className="cursor-pointer flex-1 text-xs">إظهار اسم التصميم بدلاً من كلمة "التصميم"</Label>
                  </div>
                )}
              </>
            )}

            <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
              <Checkbox
                id="showPreviousAd"
                checked={showPreviousAd}
                onCheckedChange={(c) => setShowPreviousAd(!!c)}
              />
              <Label htmlFor="showPreviousAd" className="cursor-pointer flex-1">
                إظهار الإعلان السابق فوق نوع الإعلان
              </Label>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
              <Checkbox
                id="showInstalledImages"
                checked={showInstalledImages}
                onCheckedChange={(c) => setShowInstalledImages(!!c)}
              />
              <Label htmlFor="showInstalledImages" className="cursor-pointer flex-1">إظهار صور التركيب الفعلية (إن وجدت)</Label>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
              <Checkbox
                id="hideInstallDate"
                checked={hideInstallDate}
                onCheckedChange={(c) => setHideInstallDate(!!c)}
              />
              <Label htmlFor="hideInstallDate" className="cursor-pointer flex-1">
                إخفاء تاريخ التركيب
              </Label>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
              <Checkbox
                id="hideCustomerName"
                checked={hideCustomerName}
                onCheckedChange={(c) => setHideCustomerName(!!c)}
              />
              <Label htmlFor="hideCustomerName" className="cursor-pointer flex-1">
                إخفاء اسم الزبون (مفعل افتراضياً)
              </Label>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
              <Checkbox
                id="showTeamName"
                checked={showTeamName}
                onCheckedChange={(c) => setShowTeamName(!!c)}
              />
              <Label htmlFor="showTeamName" className="cursor-pointer flex-1">
                إظهار اسم الفريق المختار
              </Label>
            </div>

            <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors bg-amber-500/10 border border-amber-500/20">
              <Checkbox
                id="showSizeDimensionLabels"
                checked={showSizeDimensionLabels}
                onCheckedChange={(c) => setShowSizeDimensionLabels(!!c)}
              />
              <Label htmlFor="showSizeDimensionLabels" className="cursor-pointer flex-1 text-xs font-bold text-amber-200">
                إظهار الكلمات فوق المقاس (طول، عرض، ارتفاع) - معطّل افتراضياً
              </Label>
            </div>

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

            {printMode === 'cards' && (
              <div className="flex items-center gap-2 p-2 rounded-lg hover:bg-muted/50 transition-colors">
                <Checkbox
                  id="showBillboardStatusOpt"
                  checked={showBillboardStatusOpt}
                  onCheckedChange={(c) => setShowBillboardStatusOpt(!!c)}
                />
                <Label htmlFor="showBillboardStatusOpt" className="cursor-pointer flex-1">
                  إظهار حالة اللوحة أسفل الاسم
                </Label>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant={printType === 'client' ? 'default' : 'outline'}
                onClick={() => setPrintType('client')}
                className="flex-1 cursor-pointer"
              >
                نسخة العميل
              </Button>
              <Button
                variant={printType === 'installation' ? 'default' : 'outline'}
                onClick={() => setPrintType('installation')}
                className="flex-1 cursor-pointer"
              >
                نسخة {contextType === 'removal' ? 'فريق الإزالة' : 'فريق التركيب'}
              </Button>
            </div>
          </div>

          {/* أزرار التحكم */}
          <div className="flex gap-2 pt-4 border-t flex-wrap">
            <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1 min-w-[80px] cursor-pointer">
              إلغاء
            </Button>
            <Button 
              onClick={handlePrint} 
              disabled={loading || settingsLoading || (printMode === 'table' && tableSettingsLoading) || filteredItems.length === 0} 
              className="flex-1 min-w-[80px] cursor-pointer"
            >
              <Printer className="h-4 w-4 ml-2" />
              طباعة {printMode === 'table' ? 'جدول' : 'بطاقات'}
            </Button>
            <Button 
              onClick={handleDownloadPDF} 
              disabled={loading || settingsLoading || filteredItems.length === 0} 
              variant="secondary" 
              className="flex-1 min-w-[80px] cursor-pointer"
            >
              <FileDown className="h-4 w-4 ml-2" />
              PDF
            </Button>
            {selectedTeamIds.size > 0 && (() => {
              const teamsWithPhone = Array.from(selectedTeamIds)
                .map(id => teams[id])
                .filter(t => t?.phone_number || t?.phone);
              const firstTeam = teamsWithPhone[0];
              const savedPhone = firstTeam?.phone_number || firstTeam?.phone;
              
              return (
                <div className="flex-1 min-w-[120px] flex flex-col gap-2">
                  {showWhatsAppInput && !savedPhone ? (
                    <div className="flex gap-2">
                      <Input
                        placeholder="أدخل رقم واتساب الفريق"
                        value={manualPhone}
                        onChange={(e) => setManualPhone(e.target.value)}
                        className="flex-1 text-right"
                        dir="ltr"
                      />
                      <Button
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
                        className="gap-2 border-green-500/40 text-green-600 hover:bg-green-500/10 cursor-pointer"
                        disabled={loading || filteredItems.length === 0}
                      >
                        <MessageCircle className="h-4 w-4" />
                        إرسال
                      </Button>
                    </div>
                  ) : (
                    <Button
                      onClick={() => {
                        if (savedPhone) {
                          handleSendWhatsAppUpload(savedPhone);
                        } else {
                          setShowWhatsAppInput(true);
                        }
                      }}
                      variant="outline"
                      className="w-full gap-2 border-green-500/40 text-green-600 hover:bg-green-500/10 cursor-pointer"
                      disabled={loading || filteredItems.length === 0}
                    >
                      <MessageCircle className="h-4 w-4" />
                      واتساب الفريق
                    </Button>
                  )}
                </div>
              );
            })()}
            {customerPhone && (
              <Button
                onClick={() => handleSendWhatsAppUpload(customerPhone)}
                variant="outline"
                className="flex-1 min-w-[120px] gap-2 border-blue-500/40 text-blue-600 hover:bg-blue-500/10 cursor-pointer"
                disabled={loading || filteredItems.length === 0}
              >
                <MessageCircle className="h-4 w-4" />
                واتساب العميل
              </Button>
            )}
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
