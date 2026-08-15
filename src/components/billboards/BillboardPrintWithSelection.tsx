import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { 
  Printer, 
  CheckSquare, 
  Image as ImageIcon, 
  Settings, 
  Loader2,
  Upload,
  ClipboardPaste,
  Plus,
  Trash2,
  Check,
  Search,
  FileImage,
  X,
  ZoomIn,
  ZoomOut,
  ChevronRight,
  ChevronLeft,
  Minus,
  RefreshCw,
  Save
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { renderAllBillboardsTablePagesPreviewLike, BillboardRowData } from '@/lib/contractTableRenderer';
import { 
  useContractTemplateSettings, 
  DEFAULT_SECTION_SETTINGS,
  DEFAULT_TABLE_COLUMNS,
  PageSectionSettings,
  TableColumnSettings,
  TableSettings
} from '@/hooks/useContractTemplateSettings';
import { useContractPrint } from '@/hooks/useContractPrint';
import { uploadImage } from '@/services/imageUploadService';
import { supabase } from '@/integrations/supabase/client';

interface BillboardPrintWithSelectionProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billboards: any[];
  isContractExpired?: (endDate: string | null) => boolean;
  /** Optional: hide price column */
  hidePrice?: boolean;
  /** Optional: partner name to show in header */
  partnerName?: string;
  /** Optional: size summary for header e.g. [["3x4", 12], ["3x6", 8]] */
  sizeSummary?: [string, number][];
}

export const BillboardPrintWithSelection: React.FC<BillboardPrintWithSelectionProps> = ({
  open,
  onOpenChange,
  billboards,
  isContractExpired,
  hidePrice = false,
  partnerName,
  sizeSummary,
}) => {
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Load persisted settings from localStorage
  const loadSaved = <T,>(key: string, fallback: T): T => {
    try {
      const v = localStorage.getItem(`billboard_print_${key}`);
      return v !== null ? JSON.parse(v) : fallback;
    } catch { return fallback; }
  };

  // 1. حالات تحديد وتصفية اللوحات
  const [selectedBillboardIds, setSelectedBillboardIds] = useState<Set<number>>(() => {
    const saved = loadSaved<number[]>('selectedIds', []);
    return new Set(saved);
  });
  const [selectAll, setSelectAll] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // إعادة تعيين التحديد ليشمل كل اللوحات الممررة عند فتح النافذة
  useEffect(() => {
    if (open && billboards.length > 0) {
      setSelectedBillboardIds(new Set(billboards.map(b => b.ID || b.id)));
      setSelectAll(true);
    }
  }, [open, billboards]);

  // 2. حالات التحكم بالخلفية
  const [backgroundType, setBackgroundType] = useState<'preset' | 'custom' | 'none'>(() => loadSaved('backgroundType', 'preset'));
  const [selectedBackground, setSelectedBackground] = useState(() => loadSaved('selectedBackground', 'template'));
  const [customBackgroundUrl, setCustomBackgroundUrl] = useState(() => loadSaved('customBackgroundUrl', ''));
  const [customBackgrounds, setCustomBackgrounds] = useState<{ id: string; name: string; url: string }[]>(() => {
    return loadSaved('customBackgroundsList', []);
  });
  const [dbBackgrounds, setDbBackgrounds] = useState<any[]>([]);
  const [showAddBackgroundForm, setShowAddBackgroundForm] = useState(false);
  const [newBackgroundName, setNewBackgroundName] = useState('');
  const [directUrlInput, setDirectUrlInput] = useState('');
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const [isSavingSettings, setIsSavingSettings] = useState(false);

  // 3. حالات التحكم بالجدول (الألوان، الأعمدة، السطور)
  const [maxRows, setMaxRows] = useState<number>(() => loadSaved('maxRows', 12));
  const [headerBgColor, setHeaderBgColor] = useState<string>(() => loadSaved('headerBgColor', '#000000'));
  const [headerTextColor, setHeaderTextColor] = useState<string>(() => loadSaved('headerTextColor', '#ffffff'));
  const [borderColor, setBorderColor] = useState<string>(() => loadSaved('borderColor', '#000000'));
  const [alternateRowColor, setAlternateRowColor] = useState<string>(() => loadSaved('alternateRowColor', '#f5f5f5'));
  const [columns, setColumns] = useState<TableColumnSettings[]>(() => loadSaved<TableColumnSettings[]>('columns', []));
  const [cellTransparent, setCellTransparent] = useState(() => loadSaved('cellTransparent', false));

  // 4. خيارات عامة
  const [showLogo, setShowLogo] = useState(() => loadSaved('showLogo', true));
  const [showTableTerm, setShowTableTerm] = useState(() => loadSaved('showTableTerm', false));

  // 5. حالات المعاينة الحية والطباعة
  const [previewPageIndex, setPreviewPageIndex] = useState(0);
  const [zoomScale, setZoomScale] = useState(0.25);
  const [isPrinting, setIsPrinting] = useState(false);
  const lastWheelTimeRef = useRef(0);

  // جلب إعدادات القالب الافتراضية للشركة
  const { data: templateData, isLoading: templateLoading } = useContractTemplateSettings();
  const { printMultiplePages } = useContractPrint();

  // جلب الإعدادات والخلفيات المحفوظة من قاعدة البيانات عند فتح النافذة
  useEffect(() => {
    if (!open) return;

    const fetchDbSettingsAndBackgrounds = async () => {
      try {
        // 1. جلب إعدادات الطباعة المخصصة من قاعدة البيانات
        const { data: dbSetting } = await supabase
          .from('contract_template_settings')
          .select('*')
          .eq('setting_key', 'billboard_print_selection')
          .maybeSingle();

        if (dbSetting?.setting_value) {
          const sv = dbSetting.setting_value as any;
          if (sv.backgroundType !== undefined) setBackgroundType(sv.backgroundType);
          if (sv.selectedBackground !== undefined) setSelectedBackground(sv.selectedBackground);
          if (sv.customBackgroundUrl !== undefined) setCustomBackgroundUrl(sv.customBackgroundUrl);
          if (Array.isArray(sv.customBackgroundsList) && sv.customBackgroundsList.length > 0) {
            setCustomBackgrounds(sv.customBackgroundsList);
          }
          if (sv.showLogo !== undefined) setShowLogo(sv.showLogo);
          if (sv.showTableTerm !== undefined) setShowTableTerm(sv.showTableTerm);
          if (sv.maxRows !== undefined && typeof sv.maxRows === 'number') setMaxRows(sv.maxRows);
          if (sv.headerBgColor) setHeaderBgColor(sv.headerBgColor);
          if (sv.headerTextColor) setHeaderTextColor(sv.headerTextColor);
          if (sv.borderColor) setBorderColor(sv.borderColor);
          if (sv.alternateRowColor) setAlternateRowColor(sv.alternateRowColor);
          if (Array.isArray(sv.columns) && sv.columns.length > 0) setColumns(sv.columns);
          if (sv.cellTransparent !== undefined) setCellTransparent(sv.cellTransparent);
        }

        // 2. جلب الخلفيات المخزنة في جدول print_backgrounds
        const { data: bgs } = await supabase
          .from('print_backgrounds')
          .select('*')
          .order('created_at', { ascending: false });

        if (bgs && bgs.length > 0) {
          setDbBackgrounds(bgs);
        }
      } catch (err) {
        console.error('Error fetching billboard print settings from DB:', err);
      }
    };

    fetchDbSettingsAndBackgrounds();
  }, [open]);
  
  // دمج الإعدادات الافتراضية وتحديث الـ states المحلية فور تحميل إعدادات القالب (فقط في حال عدم وجود قيم محفوظة يدوياً)
  useEffect(() => {
    if (templateData?.settings) {
      const tbl = templateData.settings.tableSettings;
      const hasSaved = (key: string) => localStorage.getItem(`billboard_print_${key}`) !== null;
      
      // لقد ألغينا ربط maxRows بإعدادات القالب لكي يتم حفظه محلياً بشكل مستقل ولا يتأثر بالنظام الآخر
      if (!hasSaved('headerBgColor') && tbl?.headerBgColor) setHeaderBgColor(tbl.headerBgColor);
      if (!hasSaved('headerTextColor') && tbl?.headerTextColor) setHeaderTextColor(tbl.headerTextColor);
      if (!hasSaved('borderColor') && tbl?.borderColor) setBorderColor(tbl.borderColor);
      if (!hasSaved('alternateRowColor') && tbl?.alternateRowColor) setAlternateRowColor(tbl.alternateRowColor);
      
      if (!hasSaved('columns')) {
        if (tbl?.columns) {
          setColumns(tbl.columns);
        }
      }
      if (!hasSaved('cellTransparent')) {
        setCellTransparent(tbl?.cellTransparent || false);
      }
    }
  }, [templateData]);

  const templateTableBackgroundUrl = useMemo(() => {
    return templateData?.tableBackgroundUrl || '/bgc2.svg';
  }, [templateData]);

  const getBackgroundUrl = (): string => {
    if (backgroundType === 'none') return '';
    if (backgroundType === 'custom' && customBackgroundUrl) {
      return customBackgroundUrl;
    }
    if (selectedBackground === 'template') {
      return templateTableBackgroundUrl;
    }
    return selectedBackground === 'none' ? '' : selectedBackground;
  };

  // إعداد الإعدادات المخصصة المدمجة لحظياً للمعاينة والطباعة
  const customSettings = useMemo((): PageSectionSettings => {
    const base = templateData?.settings || DEFAULT_SECTION_SETTINGS;
    const rawColumns = columns.length > 0 ? columns : (base.tableSettings?.columns || DEFAULT_TABLE_COLUMNS);
    
    // إخفاء السعر إذا تم تمرير hidePrice كـ true
    const processedColumns = rawColumns.map(col => {
      if (col.key === 'price' && hidePrice) {
        return { ...col, visible: false };
      }
      return col;
    });

    return {
      ...base,
      tableSettings: {
        ...base.tableSettings,
        maxRows: maxRows,
        headerBgColor: headerBgColor,
        headerTextColor: headerTextColor,
        borderColor: borderColor,
        alternateRowColor: alternateRowColor,
        columns: processedColumns,
        cellTransparent: cellTransparent,
      }
    };
  }, [templateData, maxRows, headerBgColor, headerTextColor, borderColor, alternateRowColor, columns, hidePrice, cellTransparent]);

  // تحويل اللوحات للتنسيق المطلوب
  const prepareBillboardsData = (billboardsList: any[]): BillboardRowData[] => {
    return billboardsList.map((b) => ({
      id: String(b.ID || b.id || ''),
      billboardName: b.Billboard_Name || b.billboard_name || '',
      image: b.Image_URL || b.image_url || '',
      municipality: b.Municipality || b.municipality || '',
      district: b.District || b.district || '',
      landmark: b.Nearest_Landmark || b.nearest_landmark || '',
      size: b.Size || b.size || '',
      level: b.Level || b.level || '',
      faces: (() => {
        const val = b.Faces_Count || b.faces_count || b.faces;
        if (!val) return 'وجه واحد';
        const num = Number(val);
        if (isNaN(num)) return String(val);
        if (num === 1) return 'وجه واحد';
        if (num === 2) return 'وجهين';
        if (num === 3) return 'ثلاثة أوجه';
        if (num === 4) return 'أربعة أوجه';
        if (num === 5) return 'خمسة أوجه';
        if (num === 6) return 'ستة أوجه';
        if (num === 7) return 'سبعة أوجه';
        if (num === 8) return 'ثمانية أوجه';
        if (num === 9) return 'تسعة أوجه';
        if (num === 10) return 'عشرة أوجه';
        return `${num} أوجه`;
      })(),
      price: hidePrice ? '' : (b.Price ? `${Number(b.Price).toLocaleString()}` : ''),
      rent_end_date: b.Rent_End_Date || b.rent_end_date || '',
      mapLink: b.GPS_Link || b.GPS_Coordinates 
        ? `https://www.google.com/maps?q=${b.GPS_Coordinates || ''}` 
        : '',
    }));
  };

  // تصفية اللوحات بناءً على البحث
  const filteredBillboards = useMemo(() => {
    if (!searchTerm.trim()) return billboards;
    const term = searchTerm.toLowerCase();
    return billboards.filter(b => {
      const name = (b.Billboard_Name || b.billboard_name || '').toLowerCase();
      const municipality = (b.Municipality || b.municipality || '').toLowerCase();
      const district = (b.District || b.district || '').toLowerCase();
      return name.includes(term) || municipality.includes(term) || district.includes(term);
    });
  }, [billboards, searchTerm]);

  const handleSelectAll = (checked: boolean) => {
    setSelectAll(checked);
    if (checked) {
      setSelectedBillboardIds(new Set(filteredBillboards.map(b => b.ID || b.id)));
    } else {
      setSelectedBillboardIds(new Set());
    }
  };

  const toggleBillboardSelection = (id: number) => {
    const newSet = new Set(selectedBillboardIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedBillboardIds(newSet);
    setSelectAll(newSet.size === filteredBillboards.length && filteredBillboards.length > 0);
  };

  // التحكم باختيار الخلفية
  const handleBackgroundSelect = (bgUrl: string, type: 'preset' | 'custom' | 'none') => {
    setBackgroundType(type);
    setSelectedBackground(bgUrl);
    if (type === 'custom') {
      setCustomBackgroundUrl(bgUrl);
    }
  };

  // إضافة خلفية جديدة
  const addNewCustomBackground = async (url: string) => {
    const bgName = newBackgroundName.trim() || `خلفية مخصصة ${customBackgrounds.length + 1}`;
    const newBg = {
      id: `custom_${Date.now()}`,
      name: bgName,
      url: url
    };
    const updated = [...customBackgrounds, newBg];
    setCustomBackgrounds(updated);
    localStorage.setItem('billboard_print_customBackgroundsList', JSON.stringify(updated));
    setNewBackgroundName('');
    
    // تعيينها كنشطة فوراً
    setBackgroundType('custom');
    setCustomBackgroundUrl(url);
    setSelectedBackground(url);

    // حفظها في جدول print_backgrounds السحابي أيضاً
    try {
      await supabase.from('print_backgrounds').insert({
        name: bgName,
        url: url,
        category: 'billboard_print'
      });
    } catch (err) {
      console.warn('Could not save custom background to print_backgrounds:', err);
    }

    toast.success('تم إضافة الخلفية وتعيينها');
  };

  const deleteCustomBackground = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const targetBg = customBackgrounds.find(bg => bg.id === id);
    const updated = customBackgrounds.filter(bg => bg.id !== id);
    setCustomBackgrounds(updated);
    localStorage.setItem('billboard_print_customBackgroundsList', JSON.stringify(updated));

    // حذفها من قائمة الخلفيات السحابية إذا كانت موجودة
    setDbBackgrounds(prev => prev.filter(bg => bg.id !== id));
    try {
      await supabase.from('print_backgrounds').delete().eq('id', id);
    } catch (err) {
      console.warn('Could not delete background from DB:', err);
    }

    toast.success('تم حذف الخلفية المخصصة');
    
    if (selectedBackground === targetBg?.url || customBackgroundUrl === targetBg?.url) {
      handleBackgroundSelect('template', 'preset');
    }
  };

  // التعامل مع رفع ملف
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة صحيح');
      return;
    }

    setIsUploadingBg(true);
    const toastId = toast.loading('جاري رفع ومعالجة الخلفية...');
    
    try {
      // محاولة الرفع السحابي أولاً
      const uploadedUrl = await uploadImage(file, `print-bg-${Date.now()}`, 'print-backgrounds');
      addNewCustomBackground(uploadedUrl);
 toast.success('تم رفع وحفظ الخلفية بنجاح ', { id: toastId });
      setShowAddBackgroundForm(false);
    } catch (uploadErr) {
      console.warn('Upload failed, falling back to base64:', uploadErr);
      // تحويل محلي إلى Base64 في حال فشل الرفع
      const reader = new FileReader();
      reader.onload = (readerEvent) => {
        const base64 = readerEvent.target?.result as string;
        if (base64) {
          addNewCustomBackground(base64);
 toast.success('تم حفظ الخلفية محلياً بنجاح ', { id: toastId });
          setShowAddBackgroundForm(false);
        } else {
          toast.error('فشل معالجة الصورة محلياً', { id: toastId });
        }
      };
      reader.onerror = () => toast.error('حدث خطأ أثناء قراءة الملف', { id: toastId });
      reader.readAsDataURL(file);
    } finally {
      setIsUploadingBg(false);
      e.target.value = '';
    }
  };

  // التعامل مع لصق صورة من الحافظة
  const pasteFromClipboard = async () => {
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find(type => type.startsWith('image/'));
        if (imageType) {
          setIsUploadingBg(true);
          const toastId = toast.loading('جاري رفع الصورة الملصقة...');
          
          try {
            const blob = await item.getType(imageType);
            const file = new File([blob], `bg-paste-${Date.now()}.png`, { type: imageType });
            const uploadedUrl = await uploadImage(file, `print-bg-pasted-${Date.now()}`, 'print-backgrounds');
            
            addNewCustomBackground(uploadedUrl);
 toast.success('تم رفع وحفظ الخلفية الملصقة بنجاح ', { id: toastId });
            setShowAddBackgroundForm(false);
          } catch (uploadErr) {
            console.warn('Cloud upload failed for pasted image, falling back to base64:', uploadErr);
            const blob = await item.getType(imageType);
            const reader = new FileReader();
            reader.onload = (e) => {
              const base64 = e.target?.result as string;
              if (base64) {
                addNewCustomBackground(base64);
 toast.success('تم حفظ الخلفية محلياً بنجاح ', { id: toastId });
                setShowAddBackgroundForm(false);
              }
            };
            reader.readAsDataURL(blob);
          } finally {
            setIsUploadingBg(false);
          }
          return;
        }
      }
      toast.error('لم يتم العثور على صورة في الحافظة. يرجى نسخ صورة أولاً.');
    } catch (err) {
      console.error('Failed to read clipboard:', err);
      toast.error('فشل الوصول إلى الحافظة. يرجى السماح بصلاحية القراءة في المتصفح.');
    }
  };

  const handleAddDirectUrl = () => {
    if (!directUrlInput.trim()) return;
    addNewCustomBackground(directUrlInput.trim());
    setDirectUrlInput('');
    setShowAddBackgroundForm(false);
  };

  // حفظ إعدادات الجدول في قاعدة البيانات والمحلي
  const handleSaveSettings = async () => {
    setIsSavingSettings(true);
    try {
      // 1. الحفظ في التخزين المحلي للمتصفح
      localStorage.setItem('billboard_print_backgroundType', JSON.stringify(backgroundType));
      localStorage.setItem('billboard_print_selectedBackground', JSON.stringify(selectedBackground));
      localStorage.setItem('billboard_print_customBackgroundUrl', JSON.stringify(customBackgroundUrl));
      localStorage.setItem('billboard_print_customBackgroundsList', JSON.stringify(customBackgrounds));
      localStorage.setItem('billboard_print_showLogo', JSON.stringify(showLogo));
      localStorage.setItem('billboard_print_showTableTerm', JSON.stringify(showTableTerm));
      localStorage.setItem('billboard_print_maxRows', JSON.stringify(maxRows));
      localStorage.setItem('billboard_print_headerBgColor', JSON.stringify(headerBgColor));
      localStorage.setItem('billboard_print_headerTextColor', JSON.stringify(headerTextColor));
      localStorage.setItem('billboard_print_borderColor', JSON.stringify(borderColor));
      localStorage.setItem('billboard_print_alternateRowColor', JSON.stringify(alternateRowColor));
      localStorage.setItem('billboard_print_columns', JSON.stringify(columns));
      localStorage.setItem('billboard_print_cellTransparent', JSON.stringify(cellTransparent));

      // 2. تجهيز البيانات للحفظ السحابي
      const settingsPayload = {
        backgroundType,
        selectedBackground,
        customBackgroundUrl,
        customBackgroundsList: customBackgrounds,
        showLogo,
        showTableTerm,
        maxRows,
        headerBgColor,
        headerTextColor,
        borderColor,
        alternateRowColor,
        columns,
        cellTransparent,
      };

      // 3. الحفظ في جدول contract_template_settings بقاعدة البيانات Supabase
      const { data: existing } = await supabase
        .from('contract_template_settings')
        .select('id')
        .eq('setting_key', 'billboard_print_selection')
        .maybeSingle();

      let dbError: any = null;
      if (existing?.id) {
        const { error } = await supabase
          .from('contract_template_settings')
          .update({
            setting_value: settingsPayload as any,
            background_url: customBackgroundUrl || (selectedBackground !== 'template' && selectedBackground !== 'none' ? selectedBackground : null),
            updated_at: new Date().toISOString(),
          })
          .eq('id', existing.id);
        dbError = error;
      } else {
        const { error } = await supabase
          .from('contract_template_settings')
          .insert({
            setting_key: 'billboard_print_selection',
            setting_value: settingsPayload as any,
            background_url: customBackgroundUrl || (selectedBackground !== 'template' && selectedBackground !== 'none' ? selectedBackground : null),
            updated_at: new Date().toISOString(),
          });
        dbError = error;
      }

      // 4. الحفظ الاحتياطي في جدول billboard_print_settings
      try {
        const { data: existingBps } = await supabase
          .from('billboard_print_settings')
          .select('id')
          .eq('setting_key', 'billboard_print_selection')
          .maybeSingle();

        if (existingBps?.id) {
          await supabase
            .from('billboard_print_settings')
            .update({
              elements: settingsPayload as any,
              background_url: customBackgroundUrl || selectedBackground,
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingBps.id);
        } else {
          await supabase
            .from('billboard_print_settings')
            .insert({
              setting_key: 'billboard_print_selection',
              elements: settingsPayload as any,
              background_url: customBackgroundUrl || selectedBackground,
              updated_at: new Date().toISOString(),
            });
        }
      } catch (bpsErr) {
        console.warn('Fallback billboard_print_settings save error:', bpsErr);
      }

      if (dbError) {
        console.error('Database save error:', dbError);
        toast.warning('تم الحفظ محلياً لكن تعذر الحفظ في السحابة: ' + dbError.message);
      } else {
        toast.success('تم حفظ إعدادات الطباعة في قاعدة البيانات بنجاح');
      }
    } catch (e: any) {
      console.error('Failed to save settings:', e);
      toast.error('فشل حفظ الإعدادات: ' + (e?.message || 'خطأ غير معروف'));
    } finally {
      setIsSavingSettings(false);
    }
  };

  // إعادة ضبط إعدادات الجدول للقيم الافتراضية للشركة
  const handleResetSettings = async () => {
    if (templateData?.settings) {
      const tbl = templateData.settings.tableSettings;
      setMaxRows(12);
      setHeaderBgColor(tbl?.headerBgColor || '#000000');
      setHeaderTextColor(tbl?.headerTextColor || '#ffffff');
      setBorderColor(tbl?.borderColor || '#000000');
      setAlternateRowColor(tbl?.alternateRowColor || '#f5f5f5');
      setCellTransparent(tbl?.cellTransparent || false);
      if (tbl?.columns) {
        setColumns(tbl.columns);
      }
      setBackgroundType('preset');
      setSelectedBackground('template');
      setCustomBackgroundUrl('');
      setShowLogo(true);
      setShowTableTerm(false);

      // مسح الإعدادات من التخزين المحلي
      const keys = [
        'backgroundType', 'selectedBackground', 'customBackgroundUrl',
        'showLogo', 'showTableTerm', 'maxRows', 'headerBgColor',
        'headerTextColor', 'borderColor', 'alternateRowColor',
        'columns', 'cellTransparent'
      ];
      keys.forEach(k => localStorage.removeItem(`billboard_print_${k}`));

      // إزالة الإعداد المخصص من قاعدة البيانات ليعود للافتراضي
      try {
        await supabase
          .from('contract_template_settings')
          .delete()
          .eq('setting_key', 'billboard_print_selection');
      } catch (err) {
        console.warn('Error resetting DB setting:', err);
      }

      toast.success('تم إعادة ضبط الإعدادات للقيم الافتراضية للشركة');
    }
  };

  // تفعيل/إلغاء تفعيل عمود
  const toggleColumnVisibility = (key: string) => {
    const updated = columns.map(col => {
      if (col.key === key) {
        return { ...col, visible: !col.visible };
      }
      return col;
    });
    setColumns(updated);
  };

  // تجميع قائمة الخلفيات الكلية (النظام + قاعدة البيانات + المخصصة)
  const backgroundCards = useMemo(() => {
    const system = [
      { id: 'template', name: 'من إعدادات القالب', url: 'template', type: 'preset' as const },
      { id: 'bgc1', name: 'خلفية 1', url: '/bgc1.svg', type: 'preset' as const },
      { id: 'bgc2', name: 'خلفية 2 (جدول)', url: '/bgc2.svg', type: 'preset' as const },
      { id: 'mt1', name: 'خلفية جدول اللوحات', url: '/mt1.svg', type: 'preset' as const },
      { id: 'ipg', name: 'خلفية قائمة الأسعار', url: '/ipg.svg', type: 'preset' as const },
      { id: 'none', name: 'بدون خلفية', url: 'none', type: 'none' as const },
    ];

    const dbBgs = dbBackgrounds.map(bg => ({
      id: bg.id,
      name: bg.name || 'خلفية سحابية',
      url: bg.url,
      type: 'custom' as const,
    }));
    
    const custom = customBackgrounds
      .filter(bg => !dbBgs.some(d => d.url === bg.url))
      .map(bg => ({
        id: bg.id,
        name: bg.name,
        url: bg.url,
        type: 'custom' as const
      }));
    
    return [...system, ...dbBgs, ...custom];
  }, [customBackgrounds, dbBackgrounds]);

  // استخراج اللوحات المحددة حالياً
  const selectedBillboards = useMemo(() => {
    return billboards.filter(b => selectedBillboardIds.has(b.ID || b.id));
  }, [billboards, selectedBillboardIds]);

  const billboardsData = useMemo(() => {
    return prepareBillboardsData(selectedBillboards);
  }, [selectedBillboards, hidePrice]);

  const bgUrl = getBackgroundUrl();
  const tableBgUrl = bgUrl === '' ? '' : (bgUrl || templateTableBackgroundUrl || '/bgc2.svg');

  // توليد صفحات الـ HTML للطباعة والمعاينة
  const pages = useMemo(() => {
    if (billboardsData.length === 0) return [];
    
    try {
      return renderAllBillboardsTablePagesPreviewLike(
        billboardsData,
        customSettings,
        tableBgUrl,
        maxRows,
        showTableTerm
      ).map((pageHtml) => {
        if (!showLogo) return pageHtml;

        // إضافة شعار كـ overlay بدون تغيير تخطيط الصفحة
        const logoHtml = `
          <div style="position:absolute; top:120px; right:120px; z-index:1000;">
            <img src="/logofaresgold.svg" alt="شعار الفارس" style="height:95px; width:auto;" onerror="this.style.display='none'" />
          </div>
        `;

        return pageHtml.replace(/<div[^>]*class=\"[^\"]*contract-preview-container[^\"]*\"[^>]*>/, (match) => `${match}${logoHtml}`);
      });
    } catch (e) {
      console.error('Failed to render preview pages:', e);
      return [];
    }
  }, [billboardsData, customSettings, tableBgUrl, maxRows, showTableTerm, showLogo]);

  // معالجة الصفحة الحالية للمعاينة الحية
  const currentPageHtml = useMemo(() => {
    if (pages.length === 0) return '';
    const idx = Math.min(previewPageIndex, pages.length - 1);
    return pages[idx] || '';
  }, [pages, previewPageIndex]);

  // تحديث محتوى الـ iframe للمعاينة الحية بشكل آمن وتفاعلي
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (!doc) return;

    const fullHTML = `
      <!DOCTYPE html>
      <html dir="rtl">
      <head>
        <meta charset="utf-8" />
        <style>
          body {
            margin: 0;
            padding: 0;
            background-color: white;
            width: 2480px;
            height: 3508px;
            overflow: hidden;
          }
          /* تحميل خطوط الفارس الذهبي */
          @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;900&family=Manrope:wght@400;600;800&display=swap');
          
          .contract-preview-container {
            width: 2480px !important;
            height: 3508px !important;
            position: relative !important;
            box-shadow: none !important;
          }
        </style>
      </head>
      <body>
        ${currentPageHtml}
      </body>
      </html>
    `;

    doc.open();
    doc.write(fullHTML);
    doc.close();
  }, [currentPageHtml]);

  // تصحيح الصفحة الحالية في حال تقلص عدد الصفحات
  useEffect(() => {
    if (pages.length > 0 && previewPageIndex >= pages.length) {
      setPreviewPageIndex(pages.length - 1);
    }
  }, [pages.length, previewPageIndex]);

  // تنفيذ الطباعة الفعلية
  const handlePrint = async () => {
    if (selectedBillboardIds.size === 0) {
      toast.error('يرجى اختيار لوحة واحدة على الأقل للطباعة');
      return;
    }

    setIsPrinting(true);

    try {
      if (pages.length === 0) {
        toast.error('لا توجد لوحات للطباعة');
        return;
      }

      printMultiplePages(pages, {
        title: `طباعة اللوحات${partnerName ? ` - ${partnerName}` : ''} - ${selectedBillboards.length} لوحة${sizeSummary && sizeSummary.length > 0 ? ` | ${sizeSummary.map(([s, c]) => `${s}(${c})`).join(' - ')}` : ''}`,
        designWidth: 2480,
        designHeight: 3508,
      });

      toast.success(`تم تحضير ${selectedBillboards.length} لوحة للطباعة`);
    } catch (error) {
      console.error('Print error:', error);
      toast.error('حدث خطأ أثناء الطباعة');
    } finally {
      setIsPrinting(false);
      onOpenChange(false);
    }
  };

  // مكون حقل اللون المطور
  const ColorField = ({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) => {
    return (
      <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/50 hover:bg-muted/60 transition-colors">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <div className="flex items-center gap-2">
          <Input 
            type="text" 
            value={value} 
            onChange={(e) => onChange(e.target.value)} 
            className="w-20 h-7 text-[11px] px-1.5 text-center font-mono rounded-md"
            dir="ltr"
          />
          <div className="relative w-7 h-7 rounded-md border border-border overflow-hidden cursor-pointer shadow-sm shrink-0">
            <input 
              type="color" 
              value={value} 
              onChange={(e) => onChange(e.target.value)}
              className="absolute inset-0 w-full h-full p-0 border-0 cursor-pointer scale-[1.4] transform-gpu"
            />
          </div>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-7xl w-[96vw] h-[92vh] max-h-[92vh] overflow-hidden flex flex-col p-4 bg-background border-border/80 rounded-2xl shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* رأس النافذة */}
        <DialogHeader className="pb-2 border-b flex flex-row justify-between items-center space-y-0 shrink-0">
          <DialogTitle className="text-base font-bold leading-relaxed flex items-center gap-2">
            <Printer className="h-5 w-5 text-primary shrink-0" />
            <span className="font-semibold text-lg text-foreground">خيارات طباعة اللوحات المتقدمة</span>
            {partnerName && (
              <Badge variant="default" className="text-xs px-2.5 py-0.5 bg-primary/20 text-primary border border-primary/30 hover:bg-primary/25 rounded-full">{partnerName}</Badge>
            )}
            <span className="text-xs font-normal text-muted-foreground">({billboards.length} لوحة إجمالاً)</span>
          </DialogTitle>
          {sizeSummary && sizeSummary.length > 0 && (
            <p className="text-[11px] font-normal text-muted-foreground hidden md:block">
              {sizeSummary.map(([size, count]) => `${size} (${count})`).join(' • ')}
            </p>
          )}
        </DialogHeader>

        {/* جسم النافذة الرئيسي المقسم */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 overflow-hidden mt-3 min-h-0">
          
          {/* العمود الأول (يمين): تصفية واختيار اللوحات */}
          <div className="lg:col-span-3 h-full overflow-hidden border border-border/60 rounded-xl bg-card flex flex-col shadow-sm">
            <div className="flex flex-col h-full overflow-hidden">
              {/* العنوان والعدد */}
              <div className="p-3 border-b flex justify-between items-center bg-muted/40 shrink-0">
                <div className="flex items-center gap-1.5">
                  <CheckSquare className="h-4 w-4 text-primary" />
                  <span className="font-bold text-xs text-foreground">اللوحات المحددة ({selectedBillboardIds.size})</span>
                </div>
                <Badge variant={selectedBillboardIds.size === billboards.length ? "default" : "outline"} className="text-[10px] py-0.5 px-2 rounded-full">
                  {selectedBillboardIds.size} / {billboards.length}
                </Badge>
              </div>
              
              {/* شريط البحث السريع */}
              <div className="p-2 border-b bg-muted/10 relative shrink-0">
                <Search className="absolute right-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input 
                  placeholder="ابحث بالاسم أو البلدية أو المنطقة..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="h-8 text-xs pr-8 pl-3 bg-background rounded-md border-border/60"
                />
              </div>

              {/* تحديد الكل */}
              <div className="p-2.5 border-b bg-muted/20 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2 cursor-pointer" onClick={() => handleSelectAll(!selectAll)}>
                  <Checkbox 
                    checked={selectAll} 
                    onCheckedChange={handleSelectAll}
                    id="select-all"
                    className="cursor-pointer border-border"
                  />
                  <Label htmlFor="select-all" className="text-xs font-semibold cursor-pointer text-foreground">
                    تحديد الكل في التصفية ({filteredBillboards.length})
                  </Label>
                </div>
              </div>

              {/* قائمة اللوحات */}
              <ScrollArea className="flex-1 min-h-0">
                <div className="p-2 space-y-1.5">
                  {filteredBillboards.map((billboard) => {
                    const id = billboard.ID || billboard.id;
                    const isSelected = selectedBillboardIds.has(id);
                    
                    return (
                      <div 
                        key={id}
                        onClick={() => toggleBillboardSelection(id)}
                        className={cn(
                          "flex items-center gap-2.5 p-2 rounded-lg cursor-pointer border transition-all duration-200 text-xs",
                          isSelected 
                            ? "bg-primary/5 border-primary/20 shadow-[0_1px_5px_rgba(214,172,64,0.08)]" 
                            : "hover:bg-muted/50 border-transparent"
                        )}
                      >
                        <Checkbox checked={isSelected} className="shrink-0 cursor-pointer border-border" />
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold truncate text-foreground">
                            {billboard.Billboard_Name || billboard.billboard_name || `لوحة ${id}`}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 text-muted-foreground text-[10px]">
                            <span className="truncate">{billboard.Municipality || billboard.municipality}</span>
                            {billboard.District && <span>• {billboard.District}</span>}
                          </div>
                        </div>
                        <div className="flex flex-col items-end shrink-0 gap-1">
                          <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 leading-none font-medium text-foreground bg-muted/40">
                            {billboard.Size || billboard.size}
                          </Badge>
                          {billboard.Price && !hidePrice && (
                            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                              {Number(billboard.Price).toLocaleString()} د.ل
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {filteredBillboards.length === 0 && (
                    <div className="py-8 text-center text-muted-foreground text-xs font-medium">
                      لا توجد لوحات تطابق البحث الحالي
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>

          {/* العمود الثاني (الوسط): لوحة تحكم إعدادات الطباعة والجدول */}
          <div className="lg:col-span-4 h-full overflow-hidden border border-border/60 rounded-xl bg-card flex flex-col shadow-sm">
            <div className="p-3 border-b flex justify-between items-center bg-muted/40 shrink-0">
              <div className="flex items-center gap-1.5">
                <Settings className="h-4 w-4 text-primary" />
                <span className="font-bold text-xs text-foreground">تخصيص الخيارات والقالب</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleSaveSettings} 
                  disabled={isSavingSettings}
                  className="h-7 text-[10px] px-2 gap-1 rounded-md border-border/80 hover:bg-muted bg-primary/10 hover:bg-primary/20 text-primary border-primary/20 cursor-pointer"
                >
                  {isSavingSettings ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  {isSavingSettings ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
                </Button>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleResetSettings} 
                  className="h-7 text-[10px] px-2 gap-1 rounded-md border-border/80 hover:bg-muted cursor-pointer"
                  disabled={templateLoading}
                >
                  <RefreshCw className="h-3 w-3 text-primary" />
                  إعادة ضبط
                </Button>
              </div>
            </div>

            <ScrollArea className="flex-1 min-h-0">
              <div className="p-3 space-y-4">
                
                {/* القسم الفرعي 1: قالب خلفية الطباعة */}
                <div className="space-y-2.5">
                  <Label className="text-xs font-bold text-foreground block">قالب خلفية الصفحة</Label>
                  
                  {/* شبكة بطاقات معينات الخلفية */}
                  <div className="grid grid-cols-3 gap-2">
                    {backgroundCards.map((bg) => {
                      let previewSrc = bg.url;
                      if (bg.id === 'template') {
                        previewSrc = templateTableBackgroundUrl || '/bgc2.svg';
                      }
                      
                      const isSelected = (backgroundType === bg.type && (
                        bg.type === 'none' ||
                        (bg.type === 'custom' && customBackgroundUrl === bg.url) ||
                        (bg.type === 'preset' && selectedBackground === bg.url)
                      ));
                      
                      return (
                        <div 
                          key={bg.id}
                          onClick={() => handleBackgroundSelect(bg.url, bg.type)}
                          className={cn(
                            "aspect-[210/297] rounded-lg border-2 overflow-hidden relative cursor-pointer group transition-all duration-200 hover:scale-[1.03]",
                            isSelected 
                              ? "border-primary ring-2 ring-primary/20 shadow-[0_0_12px_rgba(214,172,64,0.3)]" 
                              : "border-border hover:border-primary/45"
                          )}
                        >
                          {bg.type === 'none' ? (
                            <div className="w-full h-full bg-white flex flex-col items-center justify-center p-2 text-center border-dashed border-2 border-border/80">
                              <FileImage className="h-5 w-5 text-muted-foreground/50 mb-1" />
                              <span className="text-[9px] font-bold text-muted-foreground">بدون خلفية</span>
                            </div>
                          ) : (
                            <div className="w-full h-full relative bg-muted/20">
                              <img 
                                src={previewSrc} 
                                alt={bg.name}
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  e.currentTarget.src = '/bgc2.svg';
                                }}
                              />
                              <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 via-black/45 to-transparent p-1.5 pt-3.5 text-center">
                                <span className="text-[9px] font-bold text-white truncate block leading-tight">
                                  {bg.name}
                                </span>
                              </div>
                            </div>
                          )}
                          
                          {/* علامة الصح للتحديد */}
                          {isSelected && (
                            <div className="absolute top-1.5 right-1.5 bg-primary text-primary-foreground rounded-full p-0.5 shadow-md animate-in zoom-in duration-150">
                              <Check className="h-2.5 w-2.5 stroke-[3]" />
                            </div>
                          )}
                          
                          {/* زر الحذف للخلفيات المخصصة */}
                          {bg.type === 'custom' && (
                            <button
                              onClick={(e) => deleteCustomBackground(bg.id, e)}
                              className="absolute top-1.5 left-1.5 bg-destructive/90 text-destructive-foreground hover:bg-destructive rounded p-1 opacity-0 group-hover:opacity-100 transition-opacity duration-150 shadow-md cursor-pointer"
                            >
                              <Trash2 className="h-2.5 w-2.5" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                    
                    {/* بطاقة إضافة خلفية جديدة */}
                    <div 
                      onClick={() => setShowAddBackgroundForm(true)}
                      className={cn(
                        "aspect-[210/297] rounded-lg border-2 border-dashed border-muted-foreground/30 hover:border-primary hover:bg-primary/5 flex flex-col items-center justify-center p-2 text-center cursor-pointer transition-all duration-200 hover:scale-[1.03]",
                        showAddBackgroundForm ? "border-primary bg-primary/5 ring-2 ring-primary/10" : ""
                      )}
                    >
                      <Plus className="h-6 w-6 text-muted-foreground group-hover:text-primary mb-1 shrink-0" />
                      <span className="text-[9px] font-bold text-muted-foreground group-hover:text-primary">إضافة خلفية</span>
                    </div>
                  </div>

                  {/* نموذج إضافة خلفية جديدة المنسق */}
                  {showAddBackgroundForm && (
                    <div className="p-3 bg-muted/40 border border-border/80 rounded-xl space-y-3 animate-in fade-in slide-in-from-top-2 duration-200 shrink-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-foreground">إضافة خلفية مخصصة</span>
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="h-5 w-5 rounded-full hover:bg-muted"
                          onClick={() => setShowAddBackgroundForm(false)}
                          disabled={isUploadingBg}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </div>
                      
                      <div className="space-y-1.5">
                        <Label htmlFor="bg-name-input" className="text-[10px] text-muted-foreground">اسم الخلفية</Label>
                        <Input 
                          id="bg-name-input"
                          type="text"
                          placeholder="مثال: خلفية زرقاء مخصصة..."
                          value={newBackgroundName}
                          onChange={(e) => setNewBackgroundName(e.target.value)}
                          className="h-8 text-xs bg-background"
                          disabled={isUploadingBg}
                        />
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {/* رفع ملف */}
                        <div className="relative">
                          <input 
                            type="file" 
                            accept="image/*" 
                            id="bg-file-upload" 
                            className="hidden" 
                            onChange={handleFileUpload}
                            disabled={isUploadingBg}
                          />
                          <Button 
                            variant="outline" 
                            size="sm"
                            className="w-full text-xs h-8.5 gap-1.5 cursor-pointer rounded-md"
                            asChild
                            disabled={isUploadingBg}
                          >
                            <label htmlFor="bg-file-upload">
                              {isUploadingBg ? <Loader2 className="h-3 w-3 animate-spin text-primary" /> : <Upload className="h-3.5 w-3.5 text-primary" />}
                              <span>رفع ملف</span>
                            </label>
                          </Button>
                        </div>
                        
                        {/* لصق صورة */}
                        <Button 
                          variant="outline" 
                          size="sm"
                          className="text-xs h-8.5 gap-1.5 rounded-md cursor-pointer"
                          onClick={pasteFromClipboard}
                          disabled={isUploadingBg}
                        >
                          {isUploadingBg ? <Loader2 className="h-3 w-3 animate-spin text-primary" /> : <ClipboardPaste className="h-3.5 w-3.5 text-primary" />}
                          <span>لصق صورة</span>
                        </Button>
                      </div>

                      <div className="relative flex items-center justify-center py-1">
                        <div className="absolute inset-0 flex items-center"><span className="w-full border-t border-border/80" /></div>
                        <span className="relative bg-card px-2 text-[9px] text-muted-foreground">أو أدخل رابطاً مباشراً</span>
                      </div>

                      <div className="flex gap-1.5">
                        <Input 
                          type="url"
                          placeholder="https://example.com/bg.svg"
                          value={directUrlInput}
                          onChange={(e) => setDirectUrlInput(e.target.value)}
                          className="h-8 text-xs flex-1 bg-background"
                          dir="ltr"
                          disabled={isUploadingBg}
                        />
                        <Button 
                          size="sm" 
                          className="h-8 text-xs px-3 rounded-md cursor-pointer"
                          onClick={handleAddDirectUrl}
                          disabled={!directUrlInput.trim() || isUploadingBg}
                        >
                          إضافة
                        </Button>
                      </div>
                    </div>
                  )}
                </div>

                {/* القسم الفرعي 2: إعدادات وألوان الجدول */}
                <div className="space-y-2.5">
                  <Label className="text-xs font-bold text-foreground block">تصميم وألوان الجدول</Label>
                  
                  <div className="space-y-2">
                    {/* لون رأس الجدول */}
                    <ColorField 
                      label="لون رأس الجدول (الخلفية)"
                      value={headerBgColor}
                      onChange={setHeaderBgColor}
                    />
                    
                    {/* لون نص رأس الجدول */}
                    <ColorField 
                      label="لون نص رأس الجدول"
                      value={headerTextColor}
                      onChange={setHeaderTextColor}
                    />

                    {/* لون حدود الجدول */}
                    <ColorField 
                      label="لون حدود الجدول والشبكة"
                      value={borderColor}
                      onChange={setBorderColor}
                    />

                    {/* لون الصفوف البديلة */}
                    <ColorField 
                      label="لون الصفوف الفردية البديلة"
                      value={alternateRowColor}
                      onChange={setAlternateRowColor}
                    />

                    {/* الحد الأقصى للأسطر في كل صفحة */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/50">
                      <span className="text-xs font-medium text-muted-foreground">عدد الأسطر الأقصى بالصفحة</span>
                      <div className="flex items-center gap-2">
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-7 w-7 rounded-md cursor-pointer"
                          onClick={() => setMaxRows(prev => Math.max(1, prev - 1))}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="w-8 text-center text-sm font-semibold tabular-nums text-foreground">{maxRows}</span>
                        <Button 
                          variant="outline" 
                          size="icon" 
                          className="h-7 w-7 rounded-md cursor-pointer"
                          onClick={() => setMaxRows(prev => Math.min(30, prev + 1))}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>

                    {/* إخفاء خلفية الخلايا وجعلها شفافة */}
                    <div className="flex items-center justify-between p-2 rounded-lg bg-muted/40 border border-border/50">
                      <span className="text-xs font-medium text-muted-foreground">خلفية الخلايا شفافة (إخفاء الأبيض)</span>
                      <Switch 
                        checked={cellTransparent} 
                        onCheckedChange={setCellTransparent}
                      />
                    </div>
                  </div>
                </div>

                {/* القسم الفرعي 3: التحكم بالأعمدة المعروضة */}
                {columns.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-foreground block">التحكم بالأعمدة (كم عمود)</Label>
                    <div className="grid grid-cols-2 gap-2 p-2.5 bg-muted/30 rounded-xl border border-border/50">
                      {columns.map(col => {
                        // عدم إظهار حقل السعر للتحكم إذا كان hidePrice مفعلاً
                        if (col.key === 'price' && hidePrice) return null;
                        
                        return (
                          <div 
                            key={col.key} 
                            className="flex items-center gap-2 hover:bg-muted/50 p-1 rounded-lg transition-colors cursor-pointer" 
                            onClick={() => toggleColumnVisibility(col.key)}
                          >
                            <Checkbox 
                              checked={col.visible} 
                              onCheckedChange={() => toggleColumnVisibility(col.key)}
                              id={`col-${col.key}`}
                              className="cursor-pointer border-border"
                            />
                            <Label htmlFor={`col-${col.key}`} className="text-xs font-medium cursor-pointer flex-1 text-foreground">
                              {col.label}
                            </Label>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* القسم الفرعي 4: خيارات تجميلية إضافية */}
                <div className="space-y-2.5">
                  <Label className="text-xs font-bold text-foreground block">خيارات عامة</Label>
                  <div className="space-y-2">
                    {/* عرض الشعار */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex items-center gap-2">
                        <ImageIcon className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-xs font-medium cursor-pointer text-foreground">عرض شعار الشركة كخلفية علوية</Label>
                      </div>
                      <Switch checked={showLogo} onCheckedChange={setShowLogo} />
                    </div>

                    {/* عرض البند الثامن */}
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/50">
                      <div className="flex items-center gap-2">
                        <Settings className="h-4 w-4 text-muted-foreground" />
                        <Label className="text-xs font-medium cursor-pointer text-foreground">عرض البند الثامن للجدول</Label>
                      </div>
                      <Switch checked={showTableTerm} onCheckedChange={setShowTableTerm} />
                    </div>
                  </div>
                </div>

                {/* معلومات إحصائية إضافية من الشركة */}
                {templateData?.settings && (
                  <div className="p-2.5 rounded-xl bg-muted/20 border border-border/40 text-[10px] text-muted-foreground space-y-1">
                    <p className="font-semibold text-foreground text-xs">إعدادات القالب المحملة من الخادم:</p>
                    <div className="grid grid-cols-2 gap-1.5">
                      <span>ارتفاع الصف الافتراضي: {templateData.settings.tableSettings?.rowHeight || 12}mm</span>
                      <span>عرض الجدول الكلي: {templateData.settings.tableSettings?.tableWidth || 90}%</span>
                      <span>حجم الخط الافتراضي: {templateData.settings.tableSettings?.fontSize || 10}px</span>
                      <span>حجم خط العناوين: {templateData.settings.tableSettings?.headerFontSize || 11}px</span>
                    </div>
                  </div>
                )}
              </div>
            </ScrollArea>
          </div>

          {/* العمود الثالث (يسار): المعاينة الحية */}
          <div className="lg:col-span-5 h-full overflow-hidden border border-border/60 rounded-xl bg-card flex flex-col shadow-sm">
            <div className="p-3 border-b flex justify-between items-center bg-muted/40 shrink-0">
              <div className="flex items-center gap-1.5">
                <FileImage className="h-4 w-4 text-primary" />
                <span className="font-bold text-xs text-foreground">معاينة صفحات الطباعة الحية (A4)</span>
              </div>
              {pages.length > 0 && (
                <Badge variant="secondary" className="text-[10px] py-0.5 px-2 bg-primary/10 text-primary border border-primary/20 rounded-full">
                  {pages.length} صفحة
                </Badge>
              )}
            </div>

            {/* شريط الانتقال بين الصفحات */}
            {pages.length > 1 && (
              <div className="p-2 border-b bg-muted/10 flex items-center justify-between shrink-0">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 rounded-md cursor-pointer"
                  onClick={() => setPreviewPageIndex(prev => Math.max(0, prev - 1))}
                  disabled={previewPageIndex === 0}
                >
                  <ChevronRight className="h-4 w-4 text-foreground" />
                </Button>
                
                <span className="text-xs font-semibold text-foreground">
                  صفحة {previewPageIndex + 1} من {pages.length}
                </span>
                
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="h-7 w-7 rounded-md cursor-pointer"
                  onClick={() => setPreviewPageIndex(prev => Math.min(pages.length - 1, prev + 1))}
                  disabled={previewPageIndex === pages.length - 1}
                >
                  <ChevronLeft className="h-4 w-4 text-foreground" />
                </Button>
              </div>
            )}

            {/* منطقة عرض المعاينة باستخدام iframe scaled */}
            <div 
              className="flex-1 p-3 flex flex-col items-center justify-center bg-muted/10 overflow-auto relative min-h-0"
              onWheel={(e) => {
                if (pages.length <= 1) return;
                const now = Date.now();
                if (now - lastWheelTimeRef.current < 200) return;
                if (e.deltaY > 15) {
                  setPreviewPageIndex(p => Math.min(pages.length - 1, p + 1));
                  lastWheelTimeRef.current = now;
                } else if (e.deltaY < -15) {
                  setPreviewPageIndex(p => Math.max(0, p - 1));
                  lastWheelTimeRef.current = now;
                }
              }}
            >
              {pages.length > 0 ? (
                <div 
                  className="flex items-center justify-center p-1 bg-white border rounded-xl overflow-hidden shadow-inner"
                  style={{
                    width: '100%',
                    height: '100%',
                    minHeight: '380px',
                    maxHeight: 'calc(90vh - 230px)',
                  }}
                >
                  <div 
                    className="relative flex items-center justify-center"
                    style={{
                      width: `${2480 * zoomScale}px`,
                      height: `${3508 * zoomScale}px`,
                      overflow: 'hidden',
                      transition: 'all 0.15s ease-out',
                    }}
                  >
                    <iframe
                      ref={iframeRef}
                      title="live-print-preview"
                      style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        width: '2480px',
                        height: '3508px',
                        border: 'none',
                        transform: `scale(${zoomScale})`,
                        transformOrigin: 'top left',
                        background: 'white',
                        pointerEvents: 'none',
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="text-center p-6 text-muted-foreground flex flex-col items-center gap-2.5">
                  <Printer className="h-9 w-9 text-muted-foreground/30 animate-pulse" />
                  <p className="text-xs font-bold text-foreground">الرجاء اختيار لوحة واحدة على الأقل لرؤية المعاينة الحية</p>
                </div>
              )}
            </div>

            {/* شريط التحكم بالزووم وتكبير المعاينة */}
            {pages.length > 0 && (
              <div className="p-2 border-t bg-muted/20 flex items-center justify-between gap-3 px-3 shrink-0">
                <div className="flex items-center gap-1 shrink-0">
                  <ZoomOut className="h-3.5 w-3.5 text-muted-foreground" />
                  <span className="text-[10px] text-muted-foreground font-bold">تصغير</span>
                </div>
                
                <input 
                  type="range" 
                  min="0.10" 
                  max="0.45" 
                  step="0.05"
                  value={zoomScale} 
                  onChange={(e) => setZoomScale(parseFloat(e.target.value))}
                  className="flex-1 h-1 bg-muted-foreground/20 rounded-lg appearance-none cursor-pointer accent-primary"
                />
                
                <div className="flex items-center gap-1 shrink-0">
                  <span className="text-[10px] text-muted-foreground font-bold">تكبير</span>
                  <ZoomIn className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                
                <Badge variant="outline" className="text-[9px] px-1.5 py-0.5 font-bold tabular-nums">
                  {Math.round(zoomScale * 100)}%
                </Badge>
              </div>
            )}
          </div>
        </div>

        {/* أزرار الإجراءات السفلية */}
        <div className="flex gap-3 justify-end pt-3 border-t shrink-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl border-border/80 hover:bg-muted cursor-pointer">
            إلغاء
          </Button>
          <Button 
            onClick={handlePrint} 
            disabled={isPrinting || templateLoading || selectedBillboardIds.size === 0}
            className="gap-2 rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-md cursor-pointer transition-colors duration-150"
          >
            {isPrinting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري التحضير...
              </>
            ) : (
              <>
                <Printer className="h-4 w-4" />
                طباعة ({selectedBillboardIds.size} لوحة)
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default BillboardPrintWithSelection;
