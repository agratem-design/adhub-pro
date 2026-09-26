import { CompanyPriceEditor } from '@/components/pricing/CompanyPriceEditor';
import { normalizePrintLevels, resolvePrintLevels, type PrintLevelSelection } from '@/utils/pricingPrintLevels';
import { escapePrintText, printSizeCatalog } from '@/utils/printSizeCatalog';
import './PricingList.css';
import { pricingPrintStyles } from '@/utils/pricingPrintStyles';
import { printablePricing } from '@/utils/printablePricing';
import { DurationEditor } from '@/components/pricing/DurationEditor';
import { useQueryClient } from '@tanstack/react-query';
import { isCustomDuration, readDurationPrice } from '@/utils/pricingDuration';
import { parsePriceInput, formatPriceWithCommas } from '@/utils/priceInputParser';
import { PriceFormattedInput } from '@/components/pricing/PriceFormattedInput';
import { createRequestId } from '@/lib/requestId';
import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import MultiSelect from '@/components/ui/multi-select';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as UIDialog from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Printer, Edit2, Trash2, Plus, Minus, Download, Tag, Users, Search, Check, Filter, X, ChevronDown, RotateCcw, Sun, Moon, Layers, Palette, CheckCircle2, FileSpreadsheet, EyeOff, Percent, Sparkles, TrendingDown, TrendingUp, ShieldCheck, Calendar, Clock, ChevronLeft, ChevronRight, Save, ArrowUpDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import logoFaresSvgRaw from '@/assets/logofares.svg?raw';
import logoFaresGoldSvgRaw from '@/assets/logofaresgold.svg?raw';
import {
  DEFAULT_PRIMARY_CUSTOMERS,
  resolveOrderedCategories,
  loadCachedCategoryOrder,
  persistCategoryOrder,
} from '@/utils/pricingCategoryOrder';
import { CategoryOrderDialog } from '@/components/pricing/CategoryOrderDialog';

function svgTextToDataUri(svgText: string): string {
  const bytes = new TextEncoder().encode(svgText);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

const LOGO_FARES_BLACK_FALLBACK_SRC = svgTextToDataUri(logoFaresSvgRaw);
const LOGO_FARES_GOLD_FALLBACK_SRC = svgTextToDataUri(logoFaresGoldSvgRaw);

// مفتاح تخزين إعدادات وتفضيلات الطباعة والتصدير في التخزين المحلي
const PRINT_SETTINGS_STORAGE_KEY = 'adhub_pricing_print_settings';

export const ARABIC_MONTH_NAMES = [
  'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
  'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
] as const;

export interface PricingPrintSettings {
  category: string;
  level: PrintLevelSelection;
  theme: 'dark' | 'light';
  logo: string;
  showLevelColumn: boolean;
  priceMarkupPercent: number;
  autoSave?: boolean;
  durationVisibility?: Record<string, boolean>;
  month?: string;
  year?: number;
}

const loadSavedPrintSettings = (): PricingPrintSettings => {
  const currentMonth = ARABIC_MONTH_NAMES[new Date().getMonth()];
  const currentYear = new Date().getFullYear();
  if (typeof window === 'undefined') {
    return {
      category: 'شركات',
      level: 'all',
      theme: 'light',
      logo: '/logofares.svg',
      showLevelColumn: false,
      priceMarkupPercent: 0,
      autoSave: true,
      month: currentMonth,
      year: currentYear,
    };
  }
  try {
    const raw = localStorage.getItem(PRINT_SETTINGS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        category: typeof parsed.category === 'string' && parsed.category ? parsed.category : 'شركات',
        level: normalizePrintLevels(parsed.level),
        theme: parsed.theme === 'dark' ? 'dark' : 'light',
        logo: typeof parsed.logo === 'string' && parsed.logo ? parsed.logo : '/logofares.svg',
        showLevelColumn: parsed.showLevelColumn === true,
        priceMarkupPercent: typeof parsed.priceMarkupPercent === 'number' ? parsed.priceMarkupPercent : 0,
        autoSave: parsed.autoSave !== false,
        durationVisibility: parsed.durationVisibility && typeof parsed.durationVisibility === 'object' && !Array.isArray(parsed.durationVisibility)
          ? Object.fromEntries(Object.entries(parsed.durationVisibility).filter(([, value]) => typeof value === 'boolean')) as Record<string, boolean>
          : {},
        month: typeof parsed.month === 'string' && parsed.month ? parsed.month : currentMonth,
        year: typeof parsed.year === 'number' && parsed.year > 2000 ? parsed.year : currentYear,
      };
    }
  } catch (e) {
    console.error('Error loading print settings:', e);
  }
  return {
    category: 'شركات',
    level: 'all',
    theme: 'light',
    logo: '/logofares.svg',
    showLevelColumn: false,
    priceMarkupPercent: 0,
    autoSave: true,
    month: currentMonth,
    year: currentYear,
  };
};

function normalize(val: any): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const num = Number(String(val).replace(/[^\d.-]/g, ''));
  return isNaN(num) ? null : num;
}

type MonthKeyAll = string;

// المدد الافتراضية (مرتبة تصاعدياً من المدة الأقل إلى المدة الأعلى)
const DEFAULT_MONTH_OPTIONS = [
  { key: '15 يوم', label: '15 يوم', months: 0.5, days: 15, dbColumn: 'duration_15_days', sort_order: 1 },
  { key: 'شهر واحد', label: 'شهرياً', months: 1, days: 30, dbColumn: 'one_month', sort_order: 2 },
  { key: '2 أشهر', label: 'كل شهرين', months: 2, days: 60, dbColumn: '2_months', sort_order: 3 },
  { key: '3 أشهر', label: 'كل 3 أشهر', months: 3, days: 90, dbColumn: '3_months', sort_order: 4 },
  { key: '6 أشهر', label: 'كل 6 أشهر', months: 6, days: 180, dbColumn: '6_months', sort_order: 5 },
  { key: 'سنة كاملة', label: 'سنوي', months: 12, days: 365, dbColumn: 'full_year', sort_order: 6 },
];

interface PricingDuration {
  id: string;
  name: string;
  label: string;
  days: number;
  months: number;
  db_column: string;
  sort_order: number;
  is_active: boolean;
}

type MonthKey = string;

const PRIMARY_CUSTOMERS: string[] = DEFAULT_PRIMARY_CUSTOMERS;
const PRIMARY_SENTINEL = '__primary__';

interface BillboardLevel {
  id: number;
  level_code: string;
  level_name: string;
  description: string | null;
  created_at: string;
  sort_order: number;
}

interface PricingCategory {
  id: number;
  name: string;
  created_at: string;
}

interface PricingData {
  id: number;
  size: string;
  billboard_level: string;
  customer_category: string;
  one_month: number;
  '2_months': number;
  '3_months': number;
  '6_months': number;
  full_year: number;
  one_day: number;
  size_id?: number | null;
  duration_prices?: import('@/integrations/supabase/types').Json;
}

interface SizeData {
  print_size?: string | null;
  show_in_catalog?: boolean;
  id: number;
  name: string;
  level?: string; // جعل level اختياري لأنه قد لا يكون موجود
  sort_order?: number;
}

export default function PricingList() {
  const queryClient = useQueryClient();
  // البيانات من قاعدة البيانات
  const [levels, setLevels] = useState<BillboardLevel[]>([]);
  const [categories, setCategories] = useState<PricingCategory[]>([]);
  const [pricingData, setPricingData] = useState<PricingData[]>([]);
  const [sizesData, setSizesData] = useState<SizeData[]>([]);
  const [durations, setDurations] = useState<PricingDuration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // إنشاء MONTH_OPTIONS من المدد المحملة مرتبة تصاعدياً من الأقل إلى الأعلى
  const MONTH_OPTIONS = useMemo(() => {
    const list = durations.length === 0
      ? DEFAULT_MONTH_OPTIONS.map(d => ({
          key: d.key,
          label: d.label,
          months: d.months,
          days: d.days,
          dbColumn: d.dbColumn,
          sort_order: d.sort_order
        }))
      : durations
          .filter(d => d.is_active && d.name !== 'يوم واحد' && d.db_column !== 'one_day' && Number(d.days) > 1)
          .map(d => ({
            key: d.name,
            label: d.label,
            months: d.months,
            days: d.days,
            dbColumn: d.db_column,
            sort_order: d.sort_order
          }));

    // ترتيب المدد تصاعدياً: من المدة الأقل إلى المدة الأعلى
    return [...list].sort((a, b) => {
      const daysA = Number(a.days ?? 0);
      const daysB = Number(b.days ?? 0);
      if (daysA !== daysB) return daysA - daysB;
      const monthsA = Number(a.months ?? 0);
      const monthsB = Number(b.months ?? 0);
      if (monthsA !== monthsB) return monthsA - monthsB;
      return (a.sort_order ?? 0) - (b.sort_order ?? 0);
    });
  }, [durations]);

  // استخراج المستويات المتاحة - مرتبة حسب sort_order
  const allLevels = useMemo(() => {
    const levelSet = new Set<string>();

    // استخراج من المقاسات والفئات والأسعار (البيانات الموجودة فعلاً)
    if (sizesData.length > 0 && sizesData[0].level) {
      sizesData.forEach(s => s.level && levelSet.add(s.level));
    }
    // الفئات أصبحت عامة وليست مرتبطة بمستوى
    pricingData.forEach(p => levelSet.add(p.billboard_level));

    // إضافة من جدول المستويات إذا كان متاحاً
    levels.forEach(l => levelSet.add(l.level_code));

    // ترتيب المستويات حسب sort_order
    const result = Array.from(levelSet).sort((a, b) => {
      const levelA = levels.find(l => l.level_code === a);
      const levelB = levels.find(l => l.level_code === b);
      const orderA = levelA?.sort_order ?? 999;
      const orderB = levelB?.sort_order ?? 999;
      return orderA - orderB;
    });

    return result;
  }, [levels, sizesData, categories, pricingData]);

  const [selectedLevel, setSelectedLevel] = useState<string>('A');
  const [selectedMonthKey, setSelectedMonthKey] = useState<MonthKey>('سنة كاملة');
  const [sizeFilter, setSizeFilter] = useState<string[]>([]);
  const [otherCustomer, setOtherCustomer] = useState<string>('شركات');
  const [customCategoryOrder, setCustomCategoryOrder] = useState<string[]>(loadCachedCategoryOrder);
  const [categoryOrderOpen, setCategoryOrderOpen] = useState(false);

  const [editing, setEditing] = useState<{ size: string; customer: string; month: MonthKeyAll } | null>(null);

  const [addCatOpen, setAddCatOpen] = useState(false);
  const [newCatName, setNewCatName] = useState('');
  const [addSizeOpen, setAddSizeOpen] = useState(false);
  const [selectedNewSize, setSelectedNewSize] = useState('');
  const [newSizeName, setNewSizeName] = useState(''); // إضافة حقل لإدخال مقاس جديد
  const [addLevelOpen, setAddLevelOpen] = useState(false);
  const [newLevelCode, setNewLevelCode] = useState('');
  const [newLevelName, setNewLevelName] = useState('');
  const [newLevelOrder, setNewLevelOrder] = useState<number>(1);
  const [deleteLevelOpen, setDeleteLevelOpen] = useState(false);
  const [deletingLevel, setDeletingLevel] = useState<string | null>(null);

  // حالات تعديل المستوى
  const [editLevelOpen, setEditLevelOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<BillboardLevel | null>(null);
  const [editLevelCode, setEditLevelCode] = useState('');
  const [editLevelName, setEditLevelName] = useState('');
  const [editLevelOrder, setEditLevelOrder] = useState<number>(1);

  // إضافة حالات حذف المقاس
  const [deleteSizeOpen, setDeleteSizeOpen] = useState(false);
  const [deletingSize, setDeletingSize] = useState<string | null>(null);

  const initialPrintSettings = useMemo(() => loadSavedPrintSettings(), []);
  const [printOpen, setPrintOpen] = useState(false);
  const [printCategory, setPrintCategory] = useState<string>(initialPrintSettings.category);
  const [printLevel, setPrintLevel] = useState<PrintLevelSelection>(initialPrintSettings.level);
  const selectedPrintLevels = resolvePrintLevels(printLevel, allLevels);
  const printLevelsLabel = printLevel === 'all' ? 'جميع المستويات' : selectedPrintLevels.length
    ? selectedPrintLevels.map(code => levels.find(level => level.level_code === code)?.level_name || code).join('، ')
    : 'لم يتم اختيار مستويات';
  const togglePrintLevel = (code: string) => {
    setPrintLevel(current => {
      const selected = resolvePrintLevels(current, allLevels);
      return selected.includes(code) ? selected.filter(level => level !== code) : [...selected, code];
    });
  };
  const [durationVisibility, setDurationVisibility] = useState<Record<string, boolean>>(initialPrintSettings.durationVisibility || {});
  const printMonthOptions = MONTH_OPTIONS.filter(option => durationVisibility[option.dbColumn] ?? ![15, 45].includes(option.days));
  const [showLevelColumn, setShowLevelColumn] = useState<boolean>(initialPrintSettings.showLevelColumn);
  const [priceMarkupPercent, setPriceMarkupPercent] = useState<number>(initialPrintSettings.priceMarkupPercent);
  const [printTheme, setPrintTheme] = useState<'dark' | 'light'>(initialPrintSettings.theme);
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [printCategorySearch, setPrintCategorySearch] = useState('');
  const [printLogo, setPrintLogo] = useState<string>(initialPrintSettings.logo);
  const [autoSavePrintSettings, setAutoSavePrintSettings] = useState<boolean>(initialPrintSettings.autoSave ?? true);
  const [printMonth, setPrintMonth] = useState<string>(() => initialPrintSettings.month || ARABIC_MONTH_NAMES[new Date().getMonth()]);
  const [printYear, setPrintYear] = useState<number>(() => initialPrintSettings.year || new Date().getFullYear());
  const [hasSavedSettings, setHasSavedSettings] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return !!localStorage.getItem(PRINT_SETTINGS_STORAGE_KEY);
  });

  // دالة حفظ إعدادات الطباعة والتصدير في المتصفح
  const savePrintSettings = (showToast = true) => {
    try {
      const settingsToSave: PricingPrintSettings = {
        category: printCategory,
        level: printLevel,
        theme: printTheme,
        logo: printLogo,
        showLevelColumn,
        priceMarkupPercent,
        autoSave: autoSavePrintSettings,
        durationVisibility,
        month: printMonth,
        year: printYear,
      };
      localStorage.setItem(PRINT_SETTINGS_STORAGE_KEY, JSON.stringify(settingsToSave));
      setHasSavedSettings(true);
      if (showToast) {
        toast.success('تم حفظ إعدادات وتفضيلات الطباعة بنجاح كإعدادات افتراضية');
      }
    } catch (e) {
      console.error('Failed to save print settings', e);
      if (showToast) toast.error('فشل في حفظ إعدادات الطباعة');
    }
  };

  // دالة استعادة الإعدادات الأصلية
  const resetPrintSettings = () => {
    const currentMonth = ARABIC_MONTH_NAMES[new Date().getMonth()];
    const currentYear = new Date().getFullYear();
    const defaults: PricingPrintSettings = {
      category: 'شركات',
      level: 'all',
      theme: 'light',
      logo: '/logofares.svg',
      showLevelColumn: false,
      priceMarkupPercent: 0,
      autoSave: true,
      month: currentMonth,
      year: currentYear,
    };
    setDurationVisibility({});
    setPrintCategory(defaults.category);
    setPrintLevel(defaults.level);
    setPrintTheme(defaults.theme);
    setPrintLogo(defaults.logo);
    setShowLevelColumn(defaults.showLevelColumn);
    setPriceMarkupPercent(defaults.priceMarkupPercent);
    setPrintMonth(currentMonth);
    setPrintYear(currentYear);
    setAutoSavePrintSettings(true);
    localStorage.removeItem(PRINT_SETTINGS_STORAGE_KEY);
    setHasSavedSettings(false);
    toast.info('تمت استعادة الإعدادات الافتراضية للطباعة والتصدير');
  };
  const [relativeTarget, setRelativeTarget] = useState<{ customer: string; size?: string; level?: string } | null>(null);
  const [showCompanyComparison, setShowCompanyComparison] = useState<boolean>(true);
  const [comparisonBenchmark, setComparisonBenchmark] = useState<string>('شركات');

  const orderedCategories = useMemo(() => {
    const allKnown = Array.from(new Set([...PRIMARY_CUSTOMERS, ...categories.map(c => c.name)]));
    return resolveOrderedCategories(allKnown, customCategoryOrder);
  }, [categories, customCategoryOrder]);

  const handleSaveCategoryOrder = async (newOrder: string[]) => {
    setCustomCategoryOrder(newOrder);
    const ok = await persistCategoryOrder(newOrder);
    if (ok) {
      toast.success('تم حفظ ترتيب الفئات بنجاح');
    } else {
      toast.info('تم حفظ ترتيب الفئات محلياً');
    }
  };

  // الشعارات المتوفرة
  const AVAILABLE_LOGOS = [
    { src: '/logofares.svg', label: 'الفارس الذهبي (كتابة سوداء)' },
    { src: '/logofaresgold.svg', label: 'الفارس الذهبي (كتابة ذهبية)' },
    { src: '/coplete logofares-text. and sympol.svg', label: 'الشعار الكامل' },
    { src: '/new-logo.svg', label: 'الشعار الحديث' },
    { src: '/logofares2.svg', label: 'النمط 2' },
    { src: '/logo-symbol.svg', label: 'الرمز فقط' },
    { src: '', label: 'بدون شعار' },
  ];

  // حالات التعديل والحذف
  const [editCatOpen, setEditCatOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<PricingCategory | null>(null);
  const [editCatName, setEditCatName] = useState('');
  const [deleteCatOpen, setDeleteCatOpen] = useState(false);
  const [deletingCategory, setDeletingCategory] = useState<PricingCategory | null>(null);

  // حالات إدارة المدد
  const [addDurationOpen, setAddDurationOpen] = useState(false);
  const [savingDuration, setSavingDuration] = useState(false);
  const [editDurationOpen, setEditDurationOpen] = useState(false);
  const [deleteDurationOpen, setDeleteDurationOpen] = useState(false);
  const [editingDuration, setEditingDuration] = useState<PricingDuration | null>(null);
  const [deletingDuration, setDeletingDuration] = useState<PricingDuration | null>(null);
  const [newDurationName, setNewDurationName] = useState('');
  const [newDurationLabel, setNewDurationLabel] = useState('');
  const [newDurationDays, setNewDurationDays] = useState<number>(30);
  const [newDurationMonths, setNewDurationMonths] = useState<number>(1);
  const [newDurationOrder, setNewDurationOrder] = useState<number>(1);
 const [isUpdatingSizeIds, setIsUpdatingSizeIds] = useState(false); // حالة تحديث size_id

  // دالة تحديث size_id للأسعار التي ليس لديها size_id
  const updateMissingSizeIds = async () => {
    try {
      setIsUpdatingSizeIds(true);
      console.log('[Pricing] بدء تحديث size_id للأسعار...');

      // الحصول على الأسعار التي ليس لديها size_id
      const { data: pricingWithoutSizeId, error: fetchError } = await supabase
        .from('pricing')
        .select('id, size')
        .is('size_id', null);

      if (fetchError) {
        console.error('[Pricing] خطأ في جلب الأسعار:', fetchError);
        toast.error('فشل في جلب الأسعار');
        return;
      }

      if (!pricingWithoutSizeId || pricingWithoutSizeId.length === 0) {
        toast.success('جميع الأسعار لديها size_id بالفعل!');
        return;
      }

      console.log(`[Pricing] وجد ${pricingWithoutSizeId.length} سجل بدون size_id`);

      let updatedCount = 0;
      let failedCount = 0;

      for (const pricing of pricingWithoutSizeId) {
        // البحث عن size_id المناسب
        const sizeInfo = sizesData.find(s => s.name === pricing.size);

        if (sizeInfo?.id) {
          const { error: updateError } = await supabase
            .from('pricing')
            .update({ size_id: sizeInfo.id })
            .eq('id', pricing.id);

          if (updateError) {
            console.error(`[Pricing] فشل تحديث السجل ${pricing.id}:`, updateError);
            failedCount++;
          } else {
            updatedCount++;
          }
        } else {
          console.warn(`[Pricing] لم يتم العثور على size_id للمقاس: ${pricing.size}`);
          failedCount++;
        }
      }

      console.log(`[Pricing] تم تحديث ${updatedCount} سجل`);
      if (failedCount > 0) {
        console.log(`[Pricing] فشل تحديث ${failedCount} سجل`);
      }

      // إعادة تحميل البيانات
      await loadData();

      toast.success(`تم تحديث ${updatedCount} سجل بنجاح${failedCount > 0 ? ` (${failedCount} فشل)` : ''}`);
    } catch (error) {
      console.error('[Pricing] خطأ في تحديث size_id:', error);
      toast.error('حدث خطأ في تحديث size_id');
    } finally {
      setIsUpdatingSizeIds(false);
    }
  };

  // تحميل البيانات من قاعدة البيانات
  const loadData = async () => {
    try {
      setLoading(true);
      setConnectionError(null);

      console.log('[Pricing] بدء تحميل البيانات من قاعدة البيانات...');

      // اختبار الاتصال بقاعدة البيانات أولاً
      const { data: testData, error: testError } = await supabase
        .from('billboard_levels')
        .select('count', { count: 'exact', head: true });

      if (testError) {
        console.error('[Pricing] خطأ في الاتصال بقاعدة البيانات:', testError);
        setConnectionError(`خطأ في الاتصال: ${testError.message}`);
        return;
      }

      console.log('[Pricing] تم الاتصال بقاعدة البيانات بنجاح');

      // تحميل المستويات من جدول billboard_levels
      console.log('[Pricing] تحميل المستويات...');
      const { data: levelsData, error: levelsError } = await supabase
        .from('billboard_levels')
        .select('*')
        .order('sort_order', { ascending: true });

      if (levelsError) {
        console.error('[Pricing] خطأ في تحميل المستويات:', levelsError);
        console.log('[Pricing] سيتم استخراج المستويات من البيانات الموجودة');
      } else {
        console.log('[Pricing] تم تحميل المستويات:', levelsData?.length || 0, 'مستوى');
        if (levelsData && levelsData.length > 0) {
          console.table(levelsData);
        }
        setLevels(levelsData || []);
      }

      // تحميل الفئات من جدول pricing_categories
      console.log('[Pricing] تحميل الفئات...');
      const { data: categoriesData, error: catError } = await supabase
        .from('pricing_categories')
        .select('id, name, created_at')
        .order('name');

      if (catError) {
        console.error('[Pricing] خطأ في تحميل الفئات:', catError);
        toast.error(`فشل في تحميل الفئات: ${catError.message}`);
      } else {
        console.log('[Pricing] تم تحميل الفئات:', categoriesData?.length || 0, 'فئة');
        if (categoriesData && categoriesData.length > 0) {
          console.table(categoriesData);
        }
        setCategories(categoriesData || []);
      }

      // تحميل ترتيب الفئات المخصص من system_settings
      try {
        const { data: catOrderData } = await supabase
          .from('system_settings')
          .select('setting_value')
          .eq('setting_key', 'pricing_categories_order')
          .maybeSingle();

        if (catOrderData?.setting_value) {
          const parsed = JSON.parse(catOrderData.setting_value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setCustomCategoryOrder(parsed);
            try {
              localStorage.setItem('pricing_categories_order', JSON.stringify(parsed));
            } catch {}
          }
        }
      } catch (err) {
        console.warn('[Pricing] تعذر قراءة ترتيب الفئات من system_settings:', err);
      }

      // محاولة تحميل المقاسات من جدول sizes (إذا كان موجود) مرتبة حسب sort_order
      console.log('[Pricing] محاولة تحميل المقاسات...');
      const { data: sizesData, error: sizesError } = await supabase
        .from('sizes')
        .select('*')
        .order('sort_order', { ascending: true, nullsFirst: false });

      if (sizesError) {
        console.error('[Pricing] خطأ في تحميل المقاسات من جدول sizes:', sizesError);
        console.log('[Pricing] سيتم استخراج المقاسات من جدول الأسعار');
        setSizesData([]);
      } else {
        console.log('[Pricing] تم تحميل المقاسات:', sizesData?.length || 0, 'مقاس');
        setSizesData(sizesData || []);
      }

      // تحميل بيانات الأسعار
      console.log('[Pricing] تحميل الأسعار...');
      const { data: pricingData, error: pricingError } = await supabase
        .from('pricing')
        .select('*')
        .order('billboard_level, customer_category, size');

      if (pricingError) {
        console.error('[Pricing] خطأ في تحميل الأسعار:', pricingError);
        toast.error(`فشل في تحميل الأسعار: ${pricingError.message}`);
      } else {
        console.log('[Pricing] تم تحميل الأسعار:', pricingData?.length || 0, 'سعر');
        setPricingData(pricingData || []);
      }

      // تحميل المدد الزمنية
      console.log('[Pricing] تحميل المدد...');
      const { data: durationsData, error: durationsError } = await supabase
        .from('pricing_durations')
        .select('*')
        .order('sort_order', { ascending: true });

      if (durationsError) {
        console.error('[Pricing] خطأ في تحميل المدد:', durationsError);
        console.log('[Pricing] سيتم استخدام المدد الافتراضية');
      } else {
        console.log('[Pricing] تم تحميل المدد:', durationsData?.length || 0, 'مدة');
        setDurations(durationsData || []);
      }

      console.log('[Pricing] تم الانتهاء من تحميل جميع البيانات');

    } catch (error) {
      console.error('[Pricing] خطأ عام في الاتصال بقاعدة البيانات:', error);
      setConnectionError(`خطأ عام: ${error}`);
      toast.error('حدث خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  // تحميل البيانات عند بدء التشغيل
  useEffect(() => {
    loadData();
  }, []);

  // تحديث المستوى المحدد عند تحميل البيانات
  useEffect(() => {
    if (allLevels.length > 0 && !allLevels.includes(selectedLevel)) {
      setSelectedLevel(allLevels[0]);
      console.log('[Pricing] تم تغيير المستوى المحدد إلى:', allLevels[0]);
    }
  }, [allLevels, selectedLevel]);

  // عند فتح صفحة الأسعار يتم عرض أعلى مدة (العنصر الأخير في الترتيب التصاعدي)
  const [hasInitializedDuration, setHasInitializedDuration] = useState(false);

  useEffect(() => {
    if (MONTH_OPTIONS.length > 0) {
      if (!hasInitializedDuration) {
        const highestDuration = MONTH_OPTIONS[MONTH_OPTIONS.length - 1];
        setSelectedMonthKey(highestDuration.key);
        setHasInitializedDuration(true);
      } else {
        const exists = MONTH_OPTIONS.some(m => m.key === selectedMonthKey);
        if (!exists) {
          const highestDuration = MONTH_OPTIONS[MONTH_OPTIONS.length - 1];
          setSelectedMonthKey(highestDuration.key);
        }
      }
    }
  }, [MONTH_OPTIONS, hasInitializedDuration, selectedMonthKey]);

  // إضافة مستوى جديد
  const addNewLevel = async () => {
    const levelCode = newLevelCode.trim().toUpperCase();
    const levelName = newLevelName.trim();

    if (!levelCode || !levelName) {
      toast.error('يرجى إدخال كود واسم المستوى');
      return;
    }

    if (allLevels.includes(levelCode)) {
      toast.error('هذا المستوى موجود بالفعل');
      return;
    }

    // التحقق من عدم تكرار الترتيب
    const existingOrder = levels.find(l => l.sort_order === newLevelOrder);
    if (existingOrder) {
      toast.error(`الترتيب ${newLevelOrder} مستخدم بالفعل للمستوى ${existingOrder.level_code}`);
      return;
    }

    try {
      // إضافة المستوى الجديد إلى جدول billboard_levels
      const { error: levelError } = await supabase
        .from('billboard_levels')
        .insert([{
          level_code: levelCode,
          level_name: levelName,
          description: `مستوى ${levelName}`,
          sort_order: newLevelOrder
        }]);

      if (levelError) {
        console.error('خطأ في إضافة المستوى:', levelError);
        if (levelError.code === '23505') {
          toast.error('هذا الترتيب مستخدم بالفعل');
        } else {
          toast.error('حدث خطأ في إضافة المستوى');
        }
        return;
      }

      // إضافة فئة أساسية للمستوى الجديد (إذا لم تكن موجودة)
      const { data: existingCat } = await supabase
        .from('pricing_categories')
        .select('id')
        .eq('name', 'المدينة')
        .maybeSingle();

      if (!existingCat) {
        const { error: catError } = await supabase
          .from('pricing_categories')
          .insert([{ name: 'المدينة' }]);

        if (catError) {
          console.error('خطأ في إضافة الفئة:', catError);
        }
      }

      // إعادة تحميل البيانات
      await loadData();

      setSelectedLevel(levelCode);
      setAddLevelOpen(false);
      setNewLevelCode('');
      setNewLevelName('');
      setNewLevelOrder(levels.length + 2);
      toast.success(`تم إضافة المستوى ${levelCode} بنجاح`);
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  // تعديل مستوى
  const updateLevel = async () => {
    if (!editingLevel) return;

    const levelCode = editLevelCode.trim().toUpperCase();
    const levelName = editLevelName.trim();

    if (!levelCode || !levelName) {
      toast.error('يرجى إدخال كود واسم المستوى');
      return;
    }

    // التحقق من عدم تكرار الكود (إذا تغير)
    if (levelCode !== editingLevel.level_code && allLevels.includes(levelCode)) {
      toast.error('هذا الكود مستخدم بالفعل');
      return;
    }

    // التحقق من عدم تكرار الترتيب (إذا تغير)
    const existingOrder = levels.find(l => l.sort_order === editLevelOrder && l.id !== editingLevel.id);
    if (existingOrder) {
      toast.error(`الترتيب ${editLevelOrder} مستخدم بالفعل للمستوى ${existingOrder.level_code}`);
      return;
    }

    try {
      // تحديث المستوى
      const { error } = await supabase
        .from('billboard_levels')
        .update({
          level_code: levelCode,
          level_name: levelName,
          sort_order: editLevelOrder
        })
        .eq('id', editingLevel.id);

      if (error) {
        console.error('خطأ في تحديث المستوى:', error);
        if (error.code === '23505') {
          toast.error('هذا الترتيب مستخدم بالفعل');
        } else {
          toast.error('حدث خطأ في تحديث المستوى');
        }
        return;
      }

      // تحديث الأسعار إذا تغير كود المستوى
      if (levelCode !== editingLevel.level_code) {
        const { error: pricingError } = await supabase
          .from('pricing')
          .update({ billboard_level: levelCode })
          .eq('billboard_level', editingLevel.level_code);

        if (pricingError) {
          console.error('خطأ في تحديث الأسعار:', pricingError);
        }
      }

      // إعادة تحميل البيانات
      await loadData();

      if (selectedLevel === editingLevel.level_code) {
        setSelectedLevel(levelCode);
      }

      setEditLevelOpen(false);
      setEditingLevel(null);
      toast.success(`تم تحديث المستوى بنجاح`);
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  // فتح نافذة تعديل المستوى
  const openEditLevel = (level: BillboardLevel) => {
    setEditingLevel(level);
    setEditLevelCode(level.level_code);
    setEditLevelName(level.level_name);
    setEditLevelOrder(level.sort_order);
    setEditLevelOpen(true);
  };

  // حذف مستوى
  const deleteLevel = async () => {
    if (!deletingLevel) return;

    try {
      // حذف جميع الأسعار للمستوى
      const { error: pricingError } = await supabase
        .from('pricing')
        .delete()
        .eq('billboard_level', deletingLevel);

      if (pricingError) {
        console.error('خطأ في حذف الأسعار:', pricingError);
      }

      // الفئات أصبحت عامة وليست مرتبطة بمستوى معين
      // الفئات أصبحت عامة وليست مرتبطة بمستوى معين

      // حذف المستوى من جدول billboard_levels إذا كان موجوداً
      const levelObj = levels.find(l => l.level_code === deletingLevel);
      if (levelObj) {
        const { error: levelError } = await supabase
          .from('billboard_levels')
          .delete()
          .eq('id', levelObj.id);

        if (levelError) {
          console.error('خطأ في حذف المستوى:', levelError);
        }
      }

      // إعادة تحميل البيانات
      await loadData();

      // تغيير المستوى المحدد إذا كان المحذوف
      if (selectedLevel === deletingLevel) {
        setSelectedLevel(allLevels.find(l => l !== deletingLevel) || 'A');
      }

      setDeleteLevelOpen(false);
      setDeletingLevel(null);
      toast.success(`تم حذف المستوى ${deletingLevel} بنجاح`);
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  // دالة حذف المقاس من قائمة الأسعار (يدعم الحذف على مستوى الفئة فقط أو المستوى بالكامل)
  const deleteSize = async (deleteAllCategories: boolean = false) => {
    if (!deletingSize) return;

    try {
      const targetCustomer = otherCustomer === PRIMARY_SENTINEL ? 'عادي' : otherCustomer;
      console.log('[Pricing] بدء حذف المقاس...', deletingSize, selectedLevel, targetCustomer, deleteAllCategories);

      if (!deleteAllCategories) {
        // حذف من الفئة المحددة فقط
        const { error } = await supabase
          .from('pricing')
          .delete()
          .eq('size', deletingSize)
          .eq('billboard_level', selectedLevel)
          .eq('customer_category', targetCustomer);

        if (error) {
          console.error('[Pricing] خطأ في حذف المقاس من الفئة:', error);
          toast.error(`حدث خطأ في حذف المقاس من فئة ${targetCustomer}: ${error.message}`);
          return;
        }

        toast.success(`تم حذف المقاس "${deletingSize}" من فئة "${targetCustomer}" بنجاح`);
      } else {
        // حذف لجميع الفئات في المستوى المحدد
        const { error } = await supabase
          .from('pricing')
          .delete()
          .eq('size', deletingSize)
          .eq('billboard_level', selectedLevel);

        if (error) {
          console.error('[Pricing] خطأ في حذف المقاس من المستوى:', error);
          toast.error(`حدث خطأ في حذف المقاس: ${error.message}`);
          return;
        }

        toast.success(`تم حذف المقاس "${deletingSize}" من المستوى ${selectedLevel} بالكامل`);
      }

      // إعادة تحميل البيانات
      await loadData();

      setDeleteSizeOpen(false);
      setDeletingSize(null);
    } catch (error) {
      console.error('[Pricing] خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  const saveNewCategory = async () => {
    const name = newCatName.trim();
    if (!name) {
      toast.error('يرجى إدخال اسم الفئة');
      return;
    }

    if (PRIMARY_CUSTOMERS.includes(name)) {
      toast.error('لا يمكن استخدام اسم فئة أساسية');
      return;
    }

    try {
      // التحقق من وجود الفئة بالفعل
      const { data: existing } = await supabase
        .from('pricing_categories')
        .select('id')
        .eq('name', name)
        .maybeSingle();

      if (existing) {
        toast.error(`الفئة "${name}" موجودة بالفعل في المستوى ${selectedLevel}`);
        return;
      }

      // حفظ في قاعدة البيانات (الفئات عامة بدون مستوى)
      const { error } = await supabase
        .from('pricing_categories')
        .insert([{ name }]);

      if (error) {
        console.error('خطأ في حفظ الفئة:', error);
        if (error.code === '23505') {
          toast.error(`الفئة "${name}" موجودة بالفعل`);
        } else {
          toast.error(`حدث خطأ في حفظ الفئة: ${error.message}`);
        }
        return;
      }

      // إعادة تحميل البيانات
      await loadData();

      setOtherCustomer(name);
      setAddCatOpen(false);
      setNewCatName('');
      toast.success(`تم إضافة الفئة "${name}" بنجاح`);
    } catch (error: any) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error(`حدث خطأ: ${error?.message || 'خطأ غير معروف'}`);
    }
  };

  // إصلاح دالة حفظ مقاس جديد - إضافة إلى جدول الأسعار
  const saveNewSize = async () => {
    let sz = selectedNewSize.trim() || newSizeName.trim();
    if (!sz) {
      toast.error('يرجى اختيار مقاس أو إدخال مقاس جديد');
      return;
    }

    try {
      console.log('[Pricing] بدء إضافة المقاس إلى قائمة الأسعار...', sz, selectedLevel);

      // تحديد الفئات المستهدفة: إذا كان المستخدم يتصفح فئة محددة، نضيف المقاس لتلك الفئة فقط
      const targetCategories = otherCustomer !== PRIMARY_SENTINEL
        ? [otherCustomer]
        : PRIMARY_CUSTOMERS;

      // التحقق من السجلات الموجودة
      const { data: existingPricing } = await supabase
        .from('pricing')
        .select('customer_category')
        .eq('size', sz)
        .eq('billboard_level', selectedLevel)
        .in('customer_category', targetCategories);

      const existingCategories = new Set(existingPricing?.map(p => p.customer_category) || []);

      // فقط الفئات التي لا توجد بالفعل
      const newCategories = targetCategories.filter(cat => !existingCategories.has(cat));

      if (newCategories.length === 0) {
        toast.error(otherCustomer !== PRIMARY_SENTINEL
          ? `المقاس ${sz} موجود بالفعل لفئة "${otherCustomer}" في هذا المستوى`
          : `هذا المقاس موجود بالفعل للفئات الأساسية في هذا المستوى`);
        return;
      }

      // الحصول على size_id من sizesData
      const sizeInfo = sizesData.find(s => s.name === sz);
      const sizeId = sizeInfo?.id || null;

      // إنشاء سجلات أسعار للمقاس الجديد للفئات الجديدة فقط
      const pricingInserts = newCategories.map(category => ({
        size: sz,
        ...(sizeId != null ? { size_id: sizeId } : {}),
        billboard_level: selectedLevel,
        customer_category: category,
        one_month: 0,
        '2_months': 0,
        '3_months': 0,
        '6_months': 0,
        full_year: 0,
        one_day: 0,
        duration_prices: {}
      }));

      const { data, error } = await supabase
        .from('pricing')
        .upsert(pricingInserts, {
          onConflict: 'size,billboard_level,customer_category'
        })
        .select();

      if (error) {
        console.error('[Pricing] خطأ في إضافة الأسعار:', error);
        toast.error(`حدث خطأ في إضافة المقاس: ${error.message}`);
        return;
      }

      console.log('[Pricing] تم إضافة الأسعار بنجاح:', data?.length, 'سجل');

      // إعادة تحميل البيانات
      await loadData();

      setAddSizeOpen(false);
      setSelectedNewSize('');
      setNewSizeName('');
      toast.success(`تم إضافة المقاس ${sz} إلى قائمة الأسعار بنجاح`);
    } catch (error) {
      console.error('[Pricing] خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  // تعديل فئة موجودة
  const updateCategory = async () => {
    if (!editingCategory || !editCatName.trim()) return;

    const newName = editCatName.trim();

    if (PRIMARY_CUSTOMERS.includes(newName)) {
      toast.error('لا يمكن استخدام اسم فئة أساسية');
      return;
    }

    try {
      const { error } = await supabase
        .from('pricing_categories')
        .update({ name: newName })
        .eq('id', editingCategory.id);

      if (error) {
        console.error('خطأ في تحديث الفئة:', error);
        toast.error('حدث خطأ في تحديث الفئة');
        return;
      }

      // إعادة تحميل البيانات
      await loadData();

      // إذا كانت الفئة المحددة هي المحررة، قم بتحديثها
      if (otherCustomer === editingCategory.name) {
        setOtherCustomer(newName);
      }

      setEditCatOpen(false);
      setEditingCategory(null);
      setEditCatName('');
      toast.success('تم تحديث الفئة بنجاح');
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  // حذف فئة
  const deleteCategory = async () => {
    if (!deletingCategory) return;

    try {
      // حذف الأسعار المرتبطة بالفئة أولاً
      const { error: pricingError } = await supabase
        .from('pricing')
        .delete()
        .eq('customer_category', deletingCategory.name);

      if (pricingError) {
        console.error('خطأ في حذف الأسعار المرتبطة:', pricingError);
      }

      // حذف الفئة
      const { error } = await supabase
        .from('pricing_categories')
        .delete()
        .eq('id', deletingCategory.id);

      if (error) {
        console.error('خطأ في حذف الفئة:', error);
        toast.error('حدث خطأ في حذف الفئة');
        return;
      }

      // إعادة تحميل البيانات
      await loadData();

      // إذا كانت الفئة المحذوفة محددة، قم بإعادة تعيينها للأساسية
      if (otherCustomer === deletingCategory.name) {
        setOtherCustomer(PRIMARY_SENTINEL);
      }

      setDeleteCatOpen(false);
      setDeletingCategory(null);
      toast.success('تم حذف الفئة بنجاح');
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  // فتح نافذة التعديل
  const openEditCategory = (categoryName: string) => {
    const category = categories.find(c => c.name === categoryName);
    if (category) {
      setEditingCategory(category);
      setEditCatName(category.name);
      setEditCatOpen(true);
    }
  };

  // فتح نافذة الحذف
  const openDeleteCategory = (categoryName: string) => {
    const category = categories.find(c => c.name === categoryName);
    if (category) {
      setDeletingCategory(category);
      setDeleteCatOpen(true);
    }
  };

  // ========== إدارة المدد ==========

  // إضافة مدة جديدة
  const addNewDuration = async () => {
    if (savingDuration) return;
    const name = newDurationName.trim();
    const label = newDurationLabel.trim();
    const dbColumn = `duration_${createRequestId().replace(/-/g, '')}`;

    if (!name || !label) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    // التحقق من عدم تكرار الاسم أو العمود
    const existingName = durations.find(d => d.name === name);
    const existingColumn = durations.find(d => d.db_column === dbColumn);

    if (existingName) {
      toast.error('هذا الاسم مستخدم بالفعل');
      return;
    }

    if (existingColumn) {
      toast.error('هذا العمود مستخدم بالفعل');
      return;
    }

    if (!Number.isInteger(newDurationDays) || newDurationDays < 1 || !Number.isFinite(newDurationMonths) || newDurationMonths < 0 || (newDurationMonths === 0 && !editingDuration)) {
      toast.error('أدخل أياماً صحيحة وأشهراً أكبر من صفر'); return;
    }
    if (durations.some(d => d.id !== editingDuration?.id && Number(d.months) === newDurationMonths)) {
      toast.error('توجد مدة بنفس عدد الأشهر؛ عدّل أسعارها بدلاً من تكرارها'); return;
    }
    setSavingDuration(true);
    try {
      const { error } = await supabase
        .from('pricing_durations')
        .insert([{
          name,
          label,
          days: newDurationDays,
          months: newDurationMonths,
          db_column: dbColumn,
          sort_order: newDurationOrder,
          is_active: true
        }]);

      if (error) {
        console.error('خطأ في إضافة المدة:', error);
        toast.error('حدث خطأ في إضافة المدة');
        return;
      }

      await loadData();
      queryClient.invalidateQueries({ queryKey: ['pricing-durations'] });
      setSelectedMonthKey(name);
      setAddDurationOpen(false);
      resetDurationForm();
      toast.success('تم إضافة المدة بنجاح');
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    } finally { setSavingDuration(false); }
  };

  // تعديل مدة
  const updateDuration = async () => {
    if (savingDuration) return;
    if (!editingDuration) return;

    const name = newDurationName.trim();
    const label = newDurationLabel.trim();

    if (!name || !label) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

    if (!Number.isInteger(newDurationDays) || newDurationDays < 1 || !Number.isFinite(newDurationMonths) || newDurationMonths < 0 || (newDurationMonths === 0 && !editingDuration)) {
      toast.error('أدخل أياماً صحيحة وأشهراً أكبر من صفر'); return;
    }
    if (durations.some(d => d.id !== editingDuration?.id && Number(d.months) === newDurationMonths)) {
      toast.error('توجد مدة بنفس عدد الأشهر؛ عدّل أسعارها بدلاً من تكرارها'); return;
    }
    setSavingDuration(true);
    try {
      const { error } = await supabase
        .from('pricing_durations')
        .update({
          name,
          label,
          days: newDurationDays,
          months: newDurationMonths,
          sort_order: newDurationOrder
        })
        .eq('id', editingDuration.id);

      if (error) {
        console.error('خطأ في تعديل المدة:', error);
        toast.error('حدث خطأ في تعديل المدة');
        return;
      }

      await loadData();
      queryClient.invalidateQueries({ queryKey: ['pricing-durations'] });
      setSelectedMonthKey(name);
      setEditDurationOpen(false);
      setEditingDuration(null);
      resetDurationForm();
      toast.success('تم تعديل المدة بنجاح');
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    } finally { setSavingDuration(false); }
  };

  // حذف مدة
  const deleteDuration = async () => {
    if (!deletingDuration) return;

    try {
      const { error } = await supabase
        .from('pricing_durations')
        .update({ is_active: false })
        .eq('id', deletingDuration.id);

      if (error) {
        console.error('خطأ في حذف المدة:', error);
        toast.error('حدث خطأ في حذف المدة');
        return;
      }

      await loadData();
      queryClient.invalidateQueries({ queryKey: ['pricing-durations'] });
      const fallbackDuration = MONTH_OPTIONS[MONTH_OPTIONS.length - 1]?.key || 'سنة كاملة';
      setSelectedMonthKey(fallbackDuration);
      setDeleteDurationOpen(false);
      setDeletingDuration(null);
      toast.success('تم حذف المدة بنجاح');
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  // فتح نافذة تعديل المدة
  const openEditDuration = (duration: PricingDuration) => {
    setEditingDuration(duration);
    setNewDurationName(duration.name);
    setNewDurationLabel(duration.label);
    setNewDurationDays(duration.days);
    setNewDurationMonths(duration.months);
    setNewDurationOrder(duration.sort_order);
    setEditDurationOpen(true);
  };

  // فتح نافذة حذف المدة
  const openDeleteDuration = (duration: PricingDuration) => {
    setDeletingDuration(duration);
    setDeleteDurationOpen(true);
  };

  // إعادة تعيين نموذج المدة
  const resetDurationForm = () => {
    setEditingDuration(null);
    setNewDurationName('');
    setNewDurationLabel('');
    setNewDurationDays(30);
    setNewDurationMonths(1);
    setNewDurationOrder(durations.length + 1);
  };

  // الحصول على المقاسات للمستوى المحدد مع الترتيب حسب sort_order (مفلترة حسب الفئة إذا كانت فئة مخصصة)
  const sizesForLevel = useMemo(() => {
    // الحصول على المقاسات من جدول الأسعار للمستوى المحدد والفئة الحالية
    const filteredRows = pricingData.filter(p => {
      if (p.billboard_level !== selectedLevel) return false;
      if (otherCustomer !== PRIMARY_SENTINEL) {
        return p.customer_category === otherCustomer;
      }
      return true;
    });

    const levelSizes = Array.from(new Set(filteredRows.map(p => p.size)));

    // إنشاء خريطة لـ sort_order من جدول sizes
    const sizeOrderMap = new Map<string, number>();
    sizesData.forEach(s => {
      sizeOrderMap.set(s.name, s.sort_order ?? 999); // استخدام sort_order
    });

    // ترتيب المقاسات حسب sort_order
    const sortedSizes = levelSizes.sort((a, b) => {
      const orderA = sizeOrderMap.get(a) ?? 999;
      const orderB = sizeOrderMap.get(b) ?? 999;
      return orderA - orderB;
    });

    // فلترة المقاسات الفارغة
    const validSizes = sortedSizes.filter(s => s && s.trim() !== '');

    return sizeFilter.length ? validSizes.filter(s => sizeFilter.includes(s)) : validSizes;
  }, [selectedLevel, sizeFilter, pricingData, sizesData, otherCustomer]);

  // الحصول على جميع المقاسات من جدول الأسعار
  const allSizes = useMemo(() => {
    return Array.from(new Set(pricingData.map(p => p.size)));
  }, [pricingData]);

  // الحصول على المقاسات المتاحة للإضافة - من جميع المقاسات الموجودة في النظام
  const availableSizesForLevel = useMemo(() => {
    // المقاسات الحالية المعروضة في الجدول
    const currentSizes = new Set(sizesForLevel);

    // جميع المقاسات الموجودة في النظام (من جدول الأسعار + جدول sizes)
    const allAvailableSizes = Array.from(new Set([
      ...pricingData.map(p => p.size),
      ...sizesData.map(s => s.name)
    ]));

    // المقاسات غير الموجودة في الجدول الحالي
    const availableSizes = allAvailableSizes.filter(size => size && size.trim() !== '' && !currentSizes.has(size));
    return availableSizes;
  }, [sizesForLevel, pricingData, sizesData]);

  // عرض جميع الفئات (مرتبة ومستبعدة منها الفئات الأساسية المجمعة)
  const otherCategories = useMemo(() => {
    const allCatNames = [
      ...categories.map(c => c.name),
      ...pricingData.map(p => p.customer_category)
    ];

    const uniqueCategories = Array.from(new Set(allCatNames))
      .filter(c => c && !PRIMARY_CUSTOMERS.includes(c))
      .sort((a, b) => a.localeCompare('ar'));

    return uniqueCategories;
  }, [categories, pricingData]);

  const getVal = (size: string, customer: string, month: MonthKeyAll): number | null => {
    // البحث في قاعدة البيانات
    const dbRow = pricingData.find(p =>
      p.size === size &&
      p.billboard_level === selectedLevel &&
      p.customer_category === customer
    );

    if (dbRow) {
      const monthOption = MONTH_OPTIONS.find(m => m.key === month);
      if (monthOption) {
        const value = readDurationPrice(dbRow, monthOption.dbColumn);
        return normalize(value);
      }
    }

    return null;
  };

  // دالة حساب المقارنة اللحظية مع الفئة المرجعية (افتراضياً: فئة الشركات)
  const getComparison = (size: string, customer: string, month: MonthKeyAll) => {
    if (!showCompanyComparison) return null;

    if (customer === comparisonBenchmark) {
      return { isBenchmark: true as const };
    }

    const currentPrice = getVal(size, customer, month);
    const benchmarkPrice = getVal(size, comparisonBenchmark, month);

    if (currentPrice == null || currentPrice < 0) {
      return { hasPrice: false as const };
    }

    if (benchmarkPrice == null || benchmarkPrice <= 0) {
      return { hasBenchmark: false as const, currentPrice };
    }

    const diff = currentPrice - benchmarkPrice;
    const pct = ((currentPrice - benchmarkPrice) / benchmarkPrice) * 100;

    return {
      isBenchmark: false as const,
      hasPrice: true as const,
      hasBenchmark: true as const,
      currentPrice,
      benchmarkPrice,
      diff,
      pct,
      isDiscount: diff < 0,
      isMarkup: diff > 0,
      isEqual: diff === 0
    };
  };

  // إحصائيات المقارنة الإجمالية المعروضة
  const comparisonStats = useMemo(() => {
    if (!showCompanyComparison) return null;

    const targetCustomer = otherCustomer !== PRIMARY_SENTINEL ? otherCustomer : null;

    // حساب المقارنة لفئة محددة
    if (targetCustomer && targetCustomer !== comparisonBenchmark) {
      let totalDiffPercentCurrent = 0;
      let countCurrent = 0;
      let totalCurrentPrice = 0;
      let totalBenchmarkPrice = 0;

      let totalDiffPercentAnnual = 0;
      let countAnnual = 0;
      let totalAnnualCustomer = 0;
      let totalAnnualBenchmark = 0;

      sizesForLevel.forEach(size => {
        // المدة المحددة حالياً
        const curPrice = getVal(size, targetCustomer, selectedMonthKey);
        const benchPrice = getVal(size, comparisonBenchmark, selectedMonthKey);

        if (curPrice != null && curPrice > 0 && benchPrice != null && benchPrice > 0) {
          const pct = ((curPrice - benchPrice) / benchPrice) * 100;
          totalDiffPercentCurrent += pct;
          countCurrent++;
          totalCurrentPrice += curPrice;
          totalBenchmarkPrice += benchPrice;
        }

        // السنوي
        const annualCur = getVal(size, targetCustomer, 'سنة كاملة');
        const annualBench = getVal(size, comparisonBenchmark, 'سنة كاملة');

        if (annualCur != null && annualCur > 0 && annualBench != null && annualBench > 0) {
          const pctAnnual = ((annualCur - annualBench) / annualBench) * 100;
          totalDiffPercentAnnual += pctAnnual;
          countAnnual++;
          totalAnnualCustomer += annualCur;
          totalAnnualBenchmark += annualBench;
        }
      });

      const avgCurrentPct = countCurrent > 0 ? totalDiffPercentCurrent / countCurrent : null;
      const avgAnnualPct = countAnnual > 0 ? totalDiffPercentAnnual / countAnnual : null;
      const overallAnnualDiff = countAnnual > 0 ? totalAnnualCustomer - totalAnnualBenchmark : null;

      return {
        mode: 'single' as const,
        targetCustomer,
        countCurrent,
        avgCurrentPct,
        countAnnual,
        avgAnnualPct,
        overallAnnualDiff,
        totalAnnualCustomer,
        totalAnnualBenchmark
      };
    }

    // حساب مقارنة الفئات الأساسية (عادي ومسوق مقابل شركات)
    if (otherCustomer === PRIMARY_SENTINEL && comparisonBenchmark === 'شركات') {
      const calcCatAvg = (cat: string) => {
        let totalPct = 0;
        let count = 0;
        sizesForLevel.forEach(size => {
          const cur = getVal(size, cat, 'سنة كاملة');
          const bench = getVal(size, 'شركات', 'سنة كاملة');
          if (cur != null && cur > 0 && bench != null && bench > 0) {
            totalPct += ((cur - bench) / bench) * 100;
            count++;
          }
        });
        return count > 0 ? totalPct / count : null;
      };

      return {
        mode: 'primary' as const,
        targetCustomer: null,
        countCurrent: 0,
        avgCurrentPct: null,
        countAnnual: 0,
        avgAnnualPct: null,
        overallAnnualDiff: null,
        totalAnnualCustomer: 0,
        totalAnnualBenchmark: 0,
        aadiAvgAnnual: calcCatAvg('عادي'),
        musawweqAvgAnnual: calcCatAvg('مسوق')
      };
    }

    return null;
  }, [showCompanyComparison, otherCustomer, comparisonBenchmark, sizesForLevel, selectedMonthKey, pricingData, selectedLevel]);

  const setVal = async (size: string, customer: string, month: MonthKeyAll, rawValue: number | string | null) => {
    try {
      const monthOption = MONTH_OPTIONS.find(m => m.key === month);
      if (!monthOption) return;

      const parsed = parsePriceInput(rawValue);
      if (!parsed.isValid) {
        toast.error('أدخل سعراً صحيحاً غير سالب');
        return;
      }
      const value = parsed.value;

      // الحصول على size_id من sizesData
      const sizeInfo = sizesData.find(s => s.name === size);
      const sizeId = sizeInfo?.id || null;

      // البحث عن السجل الموجود
      const existingRow = pricingData.find(p =>
        p.size === size &&
        p.billboard_level === selectedLevel &&
        p.customer_category === customer
      );

      const isCustom = isCustomDuration(monthOption.dbColumn);
      const updateData: any = {
        ...(isCustom
          ? { duration_prices: { ...((existingRow as any)?.duration_prices || {}), [monthOption.dbColumn]: value ?? 0 } }
          : { [monthOption.dbColumn]: value ?? 0 })
      };
      if (sizeId != null) {
        updateData.size_id = sizeId;
      }

      if (existingRow) {
        // تحديث السجل الموجود
        const { error } = await supabase
          .from('pricing')
          .update(updateData)
          .eq('id', existingRow.id);

        if (error) {
          console.error('[Pricing] خطأ في تحديث السعر:', error);
          toast.error(`حدث خطأ في تحديث السعر: ${error.message}`);
          return;
        }

        // تحديث البيانات المحلية
        setPricingData(prev => prev.map(p =>
          p.id === existingRow.id
            ? { ...p, ...updateData }
            : p
        ));
      } else {
        // إنشاء سجل جديد
        const newRow: any = {
          size,
          billboard_level: selectedLevel,
          customer_category: customer,
          one_month: 0,
          '2_months': 0,
          '3_months': 0,
          '6_months': 0,
          full_year: 0,
          one_day: 0,
          duration_prices: {},
          ...updateData
        };
        if (sizeId != null) {
          newRow.size_id = sizeId;
        }

        const { data, error } = await supabase
          .from('pricing')
          .insert([newRow])
          .select()
          .single();

        if (error) {
          console.error('[Pricing] خطأ في إضافة السعر:', error);
          toast.error(`حدث خطأ في إضافة السعر: ${error.message}`);
          return;
        }

        // إضافة السجل الجديد للبيانات المحلية
        if (data) {
          setPricingData(prev => [...prev, data]);
        }
      }

      toast.success('تم حفظ السعر بنجاح');
    } catch (error) {
      console.error('[Pricing] خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  const priceFor = (size: string, customer: string): string => {
    const v = getVal(size, customer, selectedMonthKey);
    return v == null ? '—' : `${v.toLocaleString()} د.ل`;
  };

  const buildPrintHtml = (
    cat: string,
    logoSrc: string,
    levelFilter: PrintLevelSelection,
    showLevel: boolean,
    theme: 'dark' | 'light' = 'dark',
    monthName: string = ARABIC_MONTH_NAMES[new Date().getMonth()],
    yearNum: number = new Date().getFullYear()
  ) => {
    const cats = [cat]; // Always use single category
    const today = new Date().toLocaleDateString('ar-LY');
    const catName = cat === PRIMARY_SENTINEL ? 'عادي' : cat;
    const catDisplayTitle = catName === 'شركات' ? 'فئة الشركات' : `فئة ${catName}`;
    const monthYearDisplay = `شهر ${monthName} ${yearNum}`;
    const pageTitle = `قائمة أسعار ${catDisplayTitle} - ${monthName} ${yearNum}`;

    // إنشاء خريطة لـ sort_order من جدول sizes
    const sizeOrderMap = new Map<string, number>();
    sizesData.forEach(s => {
      sizeOrderMap.set(s.name, s.sort_order ?? 999);
    });

    // تحديد المستويات المطلوب طباعتها
    const levelsToShow = resolvePrintLevels(levelFilter, allLevels);

    // جمع جميع المقاسات من المستويات المحددة
    const allUniqueSizes = Array.from(new Set(
      pricingData
        .filter(p => p.size && p.size.trim() !== '' && levelsToShow.includes(p.billboard_level))
        .map(p => p.size)
    )).sort((a, b) => {
      const orderA = sizeOrderMap.get(a) ?? 999;
      const orderB = sizeOrderMap.get(b) ?? 999;
      return orderA - orderB;
    });

    // إنشاء صفحات منفصلة لكل مستوى
    const levelPages = levelsToShow.map((level, levelIndex) => {
      const levelInfo = levels.find(l => l.level_code === level);
      const levelTitle = levelInfo
        ? `${levelInfo.level_name} (${levelInfo.level_code})`
        : `المستوى ${level}`;

      // الحصول على السعر لمستوى معين
      const getPriceForLevel = (size: string, customer: string, month: MonthKey): number | null => {
        const dbRow = pricingData.find(p =>
          p.size?.trim() === size.trim() &&
          p.billboard_level === level &&
          p.customer_category === customer
        );

        if (dbRow) {
          const monthOption = MONTH_OPTIONS.find(m => m.key === month);
          if (monthOption) {
            const value = readDurationPrice(dbRow, monthOption.dbColumn);
            return normalize(value);
          }
        }

        return null;
      };

      // المقاسات لهذا المستوى
      const { rows: sizesForThisLevel, columns: printDurations } = printablePricing(
        allUniqueSizes, printMonthOptions, (size, option) => getPriceForLevel(size, cats[0], option.key)
      );
      if (!sizesForThisLevel.length) return '';

      // إنشاء صفوف الجدول لكل مقاس مع جميع الفترات (بما في ذلك اليومي)
      const sheets: string[] = [];
      // Keep every duration together; paginate only between sizes.
      const sheetDurations = printDurations;
      const totalPages = Math.ceil(sizesForThisLevel.length / 7);
      const perPage = totalPages > 0 ? Math.ceil(sizesForThisLevel.length / totalPages) : 7;
      for (let rowOffset = 0; rowOffset < sizesForThisLevel.length; rowOffset += perPage) {
        const sheetSizes = sizesForThisLevel.slice(rowOffset, rowOffset + perPage);
        const rows = sheetSizes.map(size => `
        <section class="size-card">
          <div class="size-heading"><div class="size-label"><span>مقاس المساحة الإعلانية</span><bdi dir="ltr">${escapePrintText(size)}</bdi>${showLevel ? `<small>${escapePrintText(level)}</small>` : ''}</div><div class="print-size-label"><span>مقاس الطباعة</span><bdi dir="ltr">${escapePrintText(sizesData.find(s => s.name.trim() === size.trim())?.print_size?.trim() || 'غير محدد')}</bdi></div></div>
          <div class="duration-prices" style="--columns: ${sheetDurations.length}; --price-font: ${Math.max(6, Math.min(11, 66 / sheetDurations.length))}pt; --label-font: ${Math.max(6, Math.min(11, 70 / sheetDurations.length))}pt">
            ${sheetDurations.map(monthOpt => {
              const v = getPriceForLevel(size, cats[0], monthOpt.key);
              const price = v == null || v <= 0 ? '—' : Number(v).toLocaleString('ar-LY');
              return `<div class="duration-price"><div class="duration-label">${monthOpt.days} يوم</div><div class="price"><bdi>${price}</bdi>${v != null && v > 0 ? '<small>د.ل</small>' : ''}</div></div>`;
            }).join('')}
          </div>
        </section>
      `).join('');

      sheets.push(`
        <div class="page">
          <div class="page-content">
            <div class="header">
              ${logoSrc ? `<div class="logo-area">
                <img src="${logoSrc}" class="logo" alt="شعار" onerror="this.style.display='none'" />
              </div>` : ''}
              <div class="title-area" style="${!logoSrc ? 'text-align: center; width: 100%;' : ''}">
                <h1 class="main-title"><span>أسعار إيجار</span><br><span>المساحات الإعلانية</span></h1>
                <div class="header-note">السعر يشمل التركيب · <strong>ولا يشمل تكلفة الطباعة</strong></div>
              </div>
            </div>

            <div class="sheet-meta">
              <span class="meta-level-title">${escapePrintText(levelTitle)}</span>
              <span class="meta-currency">الأسعار بالدينار الليبي</span>
            </div>
            <div class="price-cards" data-count="${sheetSizes.length}" style="--size-count: ${sheetSizes.length};">${rows}</div>

            <div class="footer">
              <div class="footer-left">تاريخ الإصدار: ${today} (${escapePrintText(monthYearDisplay)})</div>
              <div class="footer-center">الأسعار قابلة للتغيير · ورقة ${sheets.length + 1} من ${totalPages || 1}</div>
            </div>
          </div>
        </div>
      `);
        }
      return sheets.join('');
    }).join('');

    return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <base href="${window.location.origin}/">
  <title>${escapePrintText(pageTitle)}</title>
  <style>
    ${pricingPrintStyles(theme)}
  </style>
</head>
<body>
<nav class="preview-toolbar" aria-label="أدوات معاينة الطباعة"><button class="print-btn" onclick="window.print()">طباعة</button><button class="close-preview-btn" onclick="if(window.opener){window.opener.focus();window.close();}else{window.location.href='/admin/pricing';}">إغلاق والرجوع</button></nav>
  ${levelPages}
</body>
</html>`;
  };

  const handlePrint = () => {
    if (!selectedPrintLevels.length) { toast.info('اختر مستوى واحدًا على الأقل للطباعة'); return; }
    if (!printMonthOptions.length) { toast.info('اختر مدة واحدة على الأقل للطباعة'); return; }
    const hasPrices = pricingData.some(row => row.customer_category === printCategory && selectedPrintLevels.includes(row.billboard_level) && printMonthOptions.some(option => (readDurationPrice(row, option.dbColumn) ?? 0) > 0));
    if (!hasPrices) { toast.info('لا توجد أسعار أكبر من صفر لهذه الفئة ضمن المستويات المختارة'); return; }
    const w = window.open('', '_blank');
    if (!w) return;

    // تحديد مصدر الشعار المحدد
    const logoToUse = printLogo === '/logofares.svg'
      ? LOGO_FARES_BLACK_FALLBACK_SRC
      : (printLogo === '/logofaresgold.svg'
        ? LOGO_FARES_GOLD_FALLBACK_SRC
        : (printLogo || ''));
    w.document.write(buildPrintHtml(printCategory, logoToUse, printLevel, showLevelColumn, printTheme, printMonth, printYear));
    w.document.close();
    w.focus();

  };

  // تصدير الأسعار لفئة معينة إلى Excel - يشمل جميع المستويات
  const exportCategoryToExcel = (cat: string, markupPercent: number = 0) => {
    if (!selectedPrintLevels.length) { toast.info('اختر مستوى واحدًا على الأقل للتصدير'); return; }
    try {
      toast.info('جاري تحضير ملف Excel...');
      const cats = cat === PRIMARY_SENTINEL ? PRIMARY_CUSTOMERS : [cat];

      // الحصول على جميع المقاسات من جميع المستويات
      const allSizesSet = new Set<string>();
      pricingData.forEach(p => allSizesSet.add(p.size));
      const allSizesArray = Array.from(allSizesSet).sort();

      // دالة لحساب السعر مع الزيادة
      const applyMarkup = (price: number | null): number => {
        if (price === null || price === 0) return 0;
        return Math.round(price * (1 + markupPercent / 100));
      };

      // إنشاء بيانات لكل مستوى وفترة
      const allData: any[] = [];

      // تحديد المستويات المطلوبة
      const targetLevels = resolvePrintLevels(printLevel, allLevels);

      targetLevels.forEach(level => {
        // الحصول على المقاسات المتوفرة لهذا المستوى
        const levelSizes = Array.from(new Set(
          pricingData
            .filter(p => p.billboard_level === level)
            .map(p => p.size)
        )).sort();

        if (levelSizes.length === 0) return;

        printMonthOptions.forEach(monthOpt => {
          levelSizes.forEach(size => {
            // الحصول على size_id من sizesData
            const sizeInfo = sizesData.find(s => s.name === size);
            const sizeId = sizeInfo?.id || '';

            const row: any = {
              'billboard_level': level,
              'الفترة': monthOpt.label,
              'size_id': sizeId,
              'المقاس': size
            };
            cats.forEach(c => {
              // البحث عن السعر في قاعدة البيانات
              const dbRow = pricingData.find(p =>
                p.size === size &&
                p.billboard_level === level &&
                p.customer_category === c
              );

              if (dbRow) {
                const value = readDurationPrice(dbRow, monthOpt.dbColumn);
                const originalPrice = normalize(value) ?? 0;
                row[c] = applyMarkup(originalPrice);
              } else {
                row[c] = 0;
              }
            });
            allData.push(row);
          });
        });
      });

      const wb = XLSX.utils.book_new();
      const ws = XLSX.utils.json_to_sheet(allData);

      // تعيين عرض الأعمدة
      const colWidths = [{ wch: 12 }, { wch: 15 }, { wch: 10 }, { wch: 12 }];
      cats.forEach(() => colWidths.push({ wch: 15 }));
      ws['!cols'] = colWidths;

      XLSX.utils.book_append_sheet(wb, ws, 'الأسعار');

      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      const catName = cat === PRIMARY_SENTINEL ? 'عادي' : cat;
      const catDisplayTitle = catName === 'شركات' ? 'فئة_الشركات' : `فئة_${catName}`;
      const markupSuffix = markupPercent > 0 ? `_زيادة${markupPercent}%` : '';
      const levelSuffix = printLevel === 'all' ? 'جميع_المستويات' : selectedPrintLevels.join('_');
      const filename = `قائمة_أسعار_${catDisplayTitle}_${printMonth}_${printYear}_${levelSuffix}${markupSuffix}.xlsx`;

      XLSX.writeFile(wb, filename);
      toast.success(`تم تنزيل ملف Excel: ${filename}${markupPercent > 0 ? ` (مع زيادة ${markupPercent}%)` : ''}`);
    } catch (error) {
      console.error('Error exporting to Excel:', error);
      toast.error('فشل في تصدير ملف Excel');
    }
  };

  // حساب معاينة الأسعار مع الزيادة للمستوى المحدد
  const previewPricesWithMarkup = useMemo(() => {
    if (priceMarkupPercent <= 0) return [];

    const targetLevels = resolvePrintLevels(printLevel, allLevels);
    const preview: Array<{
      level: string;
      size: string;
      period: string;
      originalPrice: number;
      newPrice: number;
      increase: number;
    }> = [];

    targetLevels.slice(0, 2).forEach(level => {
      const levelSizes = Array.from(new Set(
        pricingData
          .filter(p => p.billboard_level === level)
          .map(p => p.size)
      )).slice(0, 3); // أول 3 مقاسات فقط للمعاينة

      levelSizes.forEach(size => {
        // نستخدم الفترة المحددة حالياً
        const dbRow = pricingData.find(p =>
          p.size === size &&
          p.billboard_level === level &&
          p.customer_category === printCategory
        );

        if (dbRow) {
          const monthOpt = MONTH_OPTIONS.find(m => m.key === selectedMonthKey) || MONTH_OPTIONS[0];
          const originalPrice = normalize(readDurationPrice(dbRow, monthOpt.dbColumn)) ?? 0;
          if (originalPrice > 0) {
            const newPrice = Math.round(originalPrice * (1 + priceMarkupPercent / 100));
            preview.push({
              level,
              size,
              period: monthOpt.label,
              originalPrice,
              newPrice,
              increase: newPrice - originalPrice
            });
          }
        }
      });
    });

    return preview;
  }, [priceMarkupPercent, printLevel, printCategory, pricingData, allLevels, selectedMonthKey, MONTH_OPTIONS]);

  if (loading) {
    return (
      <div className="expenses-loading">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">جاري تحميل البيانات من قاعدة البيانات...</p>
          <p className="text-xs text-muted-foreground mt-2">يرجى فتح وحدة التحكم (F12) لمراقبة عملية التحميل</p>
        </div>
      </div>
    );
  }

  if (connectionError) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-red-500 text-lg mb-4">خطأ في الاتصال بقاعدة البيانات</div>
          <p className="text-muted-foreground mb-4">{connectionError}</p>
          <Button onClick={loadData} variant="outline">
            إعادة المحاولة
          </Button>
        </div>
      </div>
    );
  }

  if (allLevels.length === 0) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
 <div className="text-yellow-600 text-lg mb-4"> لا توجد مستويات متاحة</div>
          <p className="text-muted-foreground mb-4">لم يتم العثور على أي مستويات في قاعدة البيانات</p>
          <Button onClick={() => setAddLevelOpen(true)} className="mr-2">
            إضافة مستوى جديد
          </Button>
          <Button onClick={loadData} variant="outline">
            إعادة تحميل البيانات
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="pricing-workspace mx-auto max-w-[1600px] space-y-6 p-3 sm:p-6 [&_button]:cursor-pointer [&_button]:transition-all [&_button]:duration-200">
      <Card className="rounded-2xl border border-border bg-card shadow-sm overflow-hidden">
        <CardHeader className="pricing-page-header p-5 sm:p-6 space-y-5">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button variant="outline" size="sm" onClick={() => { const panel = document.getElementById('pricing-management') as HTMLDetailsElement | null; if (panel) { panel.open = !panel.open; if (panel.open) panel.scrollIntoView({ block: 'start', behavior: 'auto' }); } }}><Layers className="h-4 w-4 ml-2" />إدارة الفئات والمقاسات والمدد</Button>
            {(sizeFilter.length > 0 || categorySearchTerm) && <Button variant="ghost" size="sm" onClick={() => { setSizeFilter([]); setCategorySearchTerm(''); }}><X className="h-4 w-4 ml-2" />مسح فلاتر البحث والمقاسات</Button>}
          </div>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div><CardTitle className="text-2xl font-bold">قائمة الأسعار</CardTitle><p className="mt-1 text-sm text-muted-foreground">اختر الفئة والمستوى والمدة، ثم اضغط على السعر لتعديله.</p></div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <Button
                variant="outline"
                onClick={() => printSizeCatalog(sizesData)}
                className="cursor-pointer font-semibold border-border hover:border-primary/60 shadow-sm"
                title="طباعة دليل مقاسات الطباعة المعتمدة للمساحات الإعلانية"
              >
                <Printer className="h-4 w-4 ml-1.5 text-primary" />
                <span>طباعة مقاسات الطباعة</span>
              </Button>
              <Button
                onClick={() => { setPrintCategory(otherCustomer === PRIMARY_SENTINEL ? 'عادي' : otherCustomer); setPrintOpen(true); }}
                className="cursor-pointer font-bold shadow-sm"
              >
                <Printer className="h-4 w-4 ml-1.5" />
                <span>طباعة وتصدير</span>
              </Button>
            </div>
          </div>
          <div className="space-y-4">
            <section aria-labelledby="pricing-category-heading" className="rounded-xl border border-border p-3 sm:p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h3 id="pricing-category-heading" className="text-sm font-bold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  فئة العميل <span className="font-normal text-muted-foreground">· {otherCustomer}</span>
                </h3>
                <div className="flex items-center gap-2 flex-wrap w-full sm:w-auto">
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => { setNewCatName(''); setAddCatOpen(true); }}
                    className="gap-1.5 h-10 cursor-pointer font-bold shadow-sm"
                    title="إضافة فئة عميل جديدة"
                  >
                    <Plus className="h-4 w-4 ml-1" />
                    <span>إضافة فئة</span>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCategoryOrderOpen(true)}
                    className="gap-1.5 h-10 cursor-pointer font-semibold border-border hover:border-primary/60 shadow-sm"
                    title="تعديل وترتيب ظهور فئات العملاء"
                  >
                    <ArrowUpDown className="h-4 w-4 text-primary ml-1" />
                    <span>ترتيب الفئات</span>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const cat = categories.find(c => c.name === otherCustomer);
                      if (cat) {
                        openEditCategory(otherCustomer);
                      } else {
                        toast.info(`فئة «${otherCustomer}» هي فئة نظام أساسية، يمكنك استخدام زر «ترتيب الفئات» لتغيير ترتيب ظهورها.`);
                      }
                    }}
                    className="gap-1.5 h-10 cursor-pointer text-xs"
                    title="تعديل اسم الفئة المحددة حالياً"
                  >
                    <Edit2 className="h-3.5 w-3.5 ml-1 text-muted-foreground" />
                    <span>تعديل الفئة</span>
                  </Button>
                  <Input aria-label="البحث عن فئة العميل" placeholder="ابحث عن فئة..." value={categorySearchTerm} onChange={event => setCategorySearchTerm(event.target.value)} className="w-full sm:w-52 h-10" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto" role="group" aria-label="فئات العملاء">
                {orderedCategories.filter(c => c.includes(categorySearchTerm.trim())).map(c => <Button key={c} variant={otherCustomer === c ? 'default' : 'outline'} aria-pressed={otherCustomer === c} className="min-h-10 h-auto py-2" onClick={() => setOtherCustomer(c)}>{c}</Button>)}
                {!orderedCategories.some(c => c.includes(categorySearchTerm.trim())) && <p className="text-sm text-muted-foreground">لا توجد فئة مطابقة للبحث.</p>}
              </div>
            </section>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2" role="group" aria-label="مستوى اللوحات">
                <span className="text-sm font-bold ml-2 flex items-center gap-1.5">
                  <Layers className="h-4 w-4 text-primary" />
                  المستوى
                </span>
                {allLevels.map(code => (
                  <Button
                    key={code}
                    variant={selectedLevel === code ? 'default' : 'outline'}
                    aria-pressed={selectedLevel === code}
                    className="h-10"
                    onClick={() => setSelectedLevel(code)}
                  >
                    {levels.find(l => l.level_code === code)?.level_name || code}
                    <span className="mr-1 text-xs opacity-70">({code})</span>
                  </Button>
                ))}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setNewLevelCode('');
                    setNewLevelName('');
                    setNewLevelOrder(levels.length + 1);
                    setAddLevelOpen(true);
                  }}
                  className="gap-1.5 h-10 cursor-pointer font-semibold border-dashed border-primary/40 hover:border-primary hover:bg-primary/5"
                  title="إضافة مستوى جديد"
                >
                  <Plus className="h-4 w-4 ml-1 text-primary" />
                  <span>إضافة مستوى</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const lvl = levels.find(l => l.level_code === selectedLevel);
                    if (lvl) {
                      openEditLevel(lvl);
                    } else {
                      setNewLevelCode(selectedLevel);
                      setNewLevelName(selectedLevel);
                      setNewLevelOrder(levels.length + 1);
                      setAddLevelOpen(true);
                    }
                  }}
                  className="gap-1 h-10 cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                  title="تعديل بيانات المستوى المحدد وترتيبه"
                >
                  <Edit2 className="h-3.5 w-3.5 ml-1" />
                  <span>تعديل المستوى</span>
                </Button>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <MultiSelect options={allSizes.filter(Boolean).map(size => ({ label: size, value: size }))} value={sizeFilter} onChange={setSizeFilter} placeholder="تصفية المقاسات" className="w-full sm:w-60" />
                {sizeFilter.length > 0 && <Button variant="ghost" onClick={() => setSizeFilter([])} aria-label="إلغاء تصفية المقاسات"><X className="h-4 w-4" /></Button>}
              </div>
            </div>
            <section className="rounded-xl bg-muted/30 border border-border p-3 flex flex-wrap items-center justify-between gap-3" aria-label="مدة الإيجار">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-bold ml-2 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  مدة الإيجار
                </span>
                {MONTH_OPTIONS.map(option => (
                  <Button
                    key={option.key}
                    variant={selectedMonthKey === option.key ? 'default' : 'outline'}
                    aria-pressed={selectedMonthKey === option.key}
                    className="h-10 gap-2"
                    onClick={() => setSelectedMonthKey(option.key)}
                  >
                    {option.label}
                    <span className="text-xs opacity-70">{option.days} يوم</span>
                  </Button>
                ))}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    resetDurationForm();
                    setNewDurationOrder(durations.length + 1);
                    setAddDurationOpen(true);
                  }}
                  className="gap-1.5 h-10 cursor-pointer font-semibold border-dashed border-primary/40 hover:border-primary hover:bg-primary/5"
                  title="إضافة مدة تسعير جديدة"
                >
                  <Plus className="h-4 w-4 ml-1 text-primary" />
                  <span>إضافة مدة</span>
                </Button>
                {durations.some(d => d.name === selectedMonthKey) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const d = durations.find(dur => dur.name === selectedMonthKey);
                      if (d) openEditDuration(d);
                    }}
                    className="gap-1 h-10 cursor-pointer text-xs text-muted-foreground hover:text-foreground"
                    title="تعديل المدة المحددة حالياً أو ترتيبها"
                  >
                    <Edit2 className="h-3.5 w-3.5 ml-1" />
                    <span>تعديل المدة</span>
                  </Button>
                )}
              </div>
            </section>
          </div>
        </CardHeader>
        <CardContent className="p-4 sm:p-6 space-y-4">
          <div className="flex flex-wrap justify-between items-center gap-3">
            <p className="text-sm text-muted-foreground font-medium">
              {sizesForLevel.length} مقاس متاح لفئة «{otherCustomer === PRIMARY_SENTINEL ? 'عادي' : otherCustomer}» في المستوى {selectedLevel} · الأسعار بالدينار الليبي
            </p>
            <div className="flex items-center gap-2 flex-wrap">
              <Button 
                variant="default" 
                size="sm" 
                onClick={() => setAddSizeOpen(true)}
                className="gap-1.5 h-9 font-bold cursor-pointer"
              >
                <Plus className="h-4 w-4" />
                <span>إضافة مقاس للفئة</span>
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setRelativeTarget({
                  customer: otherCustomer === PRIMARY_SENTINEL ? 'عادي' : otherCustomer,
                  level: selectedLevel,
                })}
                className="gap-1.5 h-9 cursor-pointer"
              >
                <Percent className="h-4 w-4 ml-1" />
                <span>{otherCustomer === 'شركات' ? 'تعديل أسعار المستوى بنسبة' : 'تعديل أسعار الفئة بنسبة'}</span>
              </Button>
            </div>
          </div>
          <div className="overflow-auto rounded-xl border border-border" role="region" aria-label="جدول الأسعار" tabIndex={0}>
            <table className="w-full min-w-[700px] text-right text-sm">
              <thead className="bg-muted">
                <tr>
                  {['المقاس', 'سعر الشركات', `سعر ${otherCustomer === PRIMARY_SENTINEL ? 'عادي' : otherCustomer}`, 'الفرق عن الشركات', 'الإجراءات'].map((title,i) => (
                    <th key={i} className="p-4 font-bold border-b">{title}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {sizesForLevel.map(size => {
                  const customer = otherCustomer === PRIMARY_SENTINEL ? 'عادي' : otherCustomer;
                  const price = getVal(size, customer, selectedMonthKey);
                  const base = getVal(size, 'شركات', selectedMonthKey);
                  const diff = price != null && base != null && base > 0 ? price - base : null;
                  const isEditing = editing?.size === size && editing.customer === customer && editing.month === selectedMonthKey;
                  return (
                    <tr key={size} className="border-b last:border-0 even:bg-muted/20 hover:bg-primary/5 transition-colors">
                      <th scope="row" className="p-4 text-base font-bold"><bdi>{size}</bdi></th>
                      <td className="p-4 tabular-nums">{base == null ? 'غير محدد' : formatPriceWithCommas(base)}</td>
                      <td className="p-3">
                        {isEditing ? (
                          <PriceFormattedInput 
                            autoFocus 
                            initialValue={price} 
                            aria-label={`سعر ${size}`} 
                            onCommit={(newVal) => {
                              if (newVal !== price) {
                                void setVal(size, customer, selectedMonthKey, newVal); 
                              }
                              setEditing(null); 
                            }}
                            onCancel={() => setEditing(null)}
                          />
                        ) : (
                          <button 
                            className="inline-flex items-center gap-3 rounded-lg px-3 py-2 font-bold text-base hover:bg-primary/10 focus-visible:ring-2 focus-visible:ring-primary cursor-pointer" 
                            onClick={() => setEditing({ size, customer, month: selectedMonthKey })} 
                            aria-label={`تعديل سعر ${size} لفئة ${customer}`}
                          >
                            {price == null ? 'إضافة سعر' : formatPriceWithCommas(price)}
                            <Edit2 className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        )}
                      </td>
                      <td className="p-4">
                        {diff == null ? (
                          <span className="text-muted-foreground">لا تتوفر مقارنة</span>
                        ) : diff === 0 ? (
                          <span className="text-muted-foreground">نفس السعر</span>
                        ) : (
                          <div className={diff < 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-amber-700 dark:text-amber-400'}>
                            <span className="font-bold">{diff < 0 ? 'أقل' : 'أعلى'} {Math.abs(diff / base! * 100).toFixed(1)}%</span>
                            <span className="block text-xs mt-1">بفارق {Math.abs(diff).toLocaleString('ar-LY')} د.ل</span>
                          </div>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex items-center gap-1.5 justify-start flex-wrap">
                          <Button 
                            variant="outline" 
                            size="sm" 
                            onClick={() => setRelativeTarget({ customer, size, level: selectedLevel })}
                            className="h-8 text-xs font-semibold cursor-pointer"
                          >
                            نسبة / تصفير
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 px-2.5 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive border border-transparent hover:border-destructive/20 gap-1 rounded-lg cursor-pointer"
                            onClick={() => {
                              setDeletingSize(size);
                              setDeleteSizeOpen(true);
                            }}
                            title={`حذف مقاس ${size} من فئة ${customer}`}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            <span>حذف من الفئة</span>
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {sizesForLevel.length === 0 && (
                  <tr>
                    <td colSpan={5} className="p-10 text-center text-muted-foreground">
                      <div className="space-y-3">
                        <p>لا توجد مقاسات مسجلة لفئة «{otherCustomer === PRIMARY_SENTINEL ? 'عادي' : otherCustomer}» في المستوى {selectedLevel}.</p>
                        <Button variant="outline" size="sm" onClick={() => setAddSizeOpen(true)} className="gap-1.5 cursor-pointer">
                          <Plus className="h-4 w-4" />
                          <span>إضافة مقاس لهذه الفئة الآن</span>
                        </Button>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <details id="pricing-management" className="rounded-xl border border-border scroll-mt-6">
            <summary className="p-4 cursor-pointer font-semibold hover:bg-muted/50 transition-colors">إدارة الأسعار <span className="mr-2 font-normal text-xs text-muted-foreground">الفئات والمقاسات والمدد</span></summary>
            <div className="border-t p-4 grid sm:grid-cols-3 gap-4">
              <div className="space-y-2">
                <p className="font-bold text-sm">فئات العملاء</p>
                <Button variant="outline" className="w-full" onClick={() => setAddCatOpen(true)}>إضافة فئة</Button>
                <Button variant="outline" className="w-full" onClick={() => setCategoryOrderOpen(true)}>ترتيب الفئات</Button>
                <Button variant="ghost" className="w-full" onClick={() => openEditCategory(otherCustomer)}>تعديل الفئة المحددة</Button>
                <Button variant="ghost" className="w-full text-destructive hover:text-destructive" onClick={() => openDeleteCategory(otherCustomer)} disabled={!categories.some(c => c.name === otherCustomer)}>حذف الفئة المحددة</Button>
              </div>
              <div className="space-y-2"><p className="font-bold text-sm">المقاسات</p><Button variant="outline" className="w-full" onClick={() => setAddSizeOpen(true)}>إضافة مقاس للفئة</Button><Button variant="ghost" className="w-full" onClick={() => printSizeCatalog(sizesData)}>طباعة مقاسات الطباعة</Button><Button variant="outline" className="w-full" disabled={isUpdatingSizeIds} onClick={updateMissingSizeIds}><RotateCcw className="h-4 w-4 ml-2" />{isUpdatingSizeIds ? 'جارٍ المزامنة...' : 'مزامنة المقاسات'}</Button><Select value="" onValueChange={size => { setDeletingSize(size); setDeleteSizeOpen(true); }}><SelectTrigger><SelectValue placeholder="حذف مقاس من الفئة" /></SelectTrigger><SelectContent>{sizesForLevel.map(size => <SelectItem key={size} value={size}>{size}</SelectItem>)}</SelectContent></Select></div>
              <div className="space-y-2"><p className="font-bold text-sm">المدد والمستويات</p><Button variant="outline" className="w-full" onClick={() => { resetDurationForm(); setNewDurationOrder(durations.length + 1); setAddDurationOpen(true); }}>إضافة مدة</Button><Select value="" onValueChange={id => { const duration = durations.find(d => d.id === id); if (duration) openEditDuration(duration); }}><SelectTrigger><SelectValue placeholder="تعديل مدة" /></SelectTrigger><SelectContent>{durations.filter(d => d.is_active).map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select><Button variant="ghost" className="w-full" onClick={() => setAddLevelOpen(true)}>إضافة مستوى</Button><Button variant="ghost" className="w-full" onClick={() => { const level = levels.find(l => l.level_code === selectedLevel); if (level) openEditLevel(level); }}>تعديل المستوى المحدد</Button><Button variant="ghost" className="w-full text-destructive hover:text-destructive" onClick={() => { setDeletingLevel(selectedLevel); setDeleteLevelOpen(true); }}>حذف المستوى المحدد</Button><Select value="" onValueChange={id => { const duration = durations.find(d => d.id === id); if (duration) openDeleteDuration(duration); }}><SelectTrigger aria-label="حذف مدة"><SelectValue placeholder="حذف مدة" /></SelectTrigger><SelectContent>{durations.filter(d => d.is_active).map(d => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}</SelectContent></Select></div>
            </div>
          </details>
        </CardContent>
      </Card>

      {relativeTarget && (
        <CompanyPriceEditor
          target={relativeTarget}
          categories={orderedCategories}
          records={pricingData}
          periods={MONTH_OPTIONS}
          level={selectedLevel}
          levels={allLevels.map(code => ({
            code,
            name: levels.find(l => l.level_code === code)?.level_name || code,
          }))}
          month={selectedMonthKey}
          sizes={sizesData}
          onClose={() => setRelativeTarget(null)}
          onSaved={loadData}
        />
      )}

      <CategoryOrderDialog
        open={categoryOrderOpen}
        onOpenChange={setCategoryOrderOpen}
        categories={orderedCategories}
        onSaveOrder={handleSaveCategoryOrder}
      />

      {/* نافذة إضافة مستوى جديد */}
      <UIDialog.Dialog open={addLevelOpen} onOpenChange={setAddLevelOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>إضافة مستوى جديد</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              أدخل كود واسم وترتيب المستوى الجديد
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <div className="expenses-dialog-form">
            <div>
              <label className="expenses-form-label">كود المستوى</label>
              <Input
                placeholder="مثال: C, D, E"
                value={newLevelCode}
                onChange={e=>setNewLevelCode(e.target.value)}
                maxLength={2}
              />
            </div>
            <div>
              <label className="expenses-form-label">اسم المستوى</label>
              <Input
                placeholder="مثال: ممتاز، جيد، عادي"
                value={newLevelName}
                onChange={e=>setNewLevelName(e.target.value)}
              />
            </div>
            <div>
              <label className="expenses-form-label">الترتيب</label>
              <Input
                type="number"
                placeholder="مثال: 1, 2, 3"
                value={newLevelOrder}
                onChange={e=>setNewLevelOrder(Number(e.target.value))}
                min={1}
              />
              <p className="text-xs text-muted-foreground mt-1">
                الترتيبات المستخدمة: {levels.map(l => l.sort_order).sort((a,b) => a-b).join(', ') || 'لا يوجد'}
              </p>
            </div>
          </div>
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={()=>setAddLevelOpen(false)}>إلغاء</Button>
            <Button onClick={addNewLevel} disabled={!newLevelCode.trim() || !newLevelName.trim()}>إضافة</Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* نافذة تعديل المستوى */}
      <UIDialog.Dialog open={editLevelOpen} onOpenChange={setEditLevelOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>تعديل المستوى</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              تعديل بيانات المستوى {editingLevel?.level_code}
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <div className="expenses-dialog-form">
            <div>
              <label className="expenses-form-label">كود المستوى</label>
              <Input
                placeholder="مثال: C, D, E"
                value={editLevelCode}
                onChange={e=>setEditLevelCode(e.target.value)}
                maxLength={2}
              />
            </div>
            <div>
              <label className="expenses-form-label">اسم المستوى</label>
              <Input
                placeholder="مثال: ممتاز، جيد، عادي"
                value={editLevelName}
                onChange={e=>setEditLevelName(e.target.value)}
              />
            </div>
            <div>
              <label className="expenses-form-label">الترتيب</label>
              <Input
                type="number"
                placeholder="مثال: 1, 2, 3"
                value={editLevelOrder}
                onChange={e=>setEditLevelOrder(Number(e.target.value))}
                min={1}
              />
              <p className="text-xs text-muted-foreground mt-1">
                الترتيبات المستخدمة: {levels.filter(l => l.id !== editingLevel?.id).map(l => l.sort_order).sort((a,b) => a-b).join(', ') || 'لا يوجد'}
              </p>
            </div>
          </div>
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={()=>setEditLevelOpen(false)}>إلغاء</Button>
            <Button onClick={updateLevel} disabled={!editLevelCode.trim() || !editLevelName.trim()}>حفظ</Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* نافذة حذف المستوى */}
      <UIDialog.Dialog open={deleteLevelOpen} onOpenChange={setDeleteLevelOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>تأكيد حذف المستوى</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              هذا الإجراء لا يمكن التراجع عنه
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              هل أنت متأكد من حذف المستوى <strong>"{deletingLevel}"</strong>؟
            </p>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400">
  تحذير: سيتم حذف جميع المقاسات والأسعار والفئات المرتبطة بهذا المستوى نهائياً ولا يمكن التراجع عن هذا الإجراء.
              </p>
            </div>
          </div>
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={()=>setDeleteLevelOpen(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={deleteLevel}>حذف نهائياً</Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* نافذة حذف المقاس */}
      <UIDialog.Dialog open={deleteSizeOpen} onOpenChange={setDeleteSizeOpen}>
        <UIDialog.DialogContent className="max-w-md rounded-2xl">
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>
              حذف المقاس من فئة «{otherCustomer === PRIMARY_SENTINEL ? 'عادي' : otherCustomer}»
            </UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              المستوى {selectedLevel} · الفئة: {otherCustomer === PRIMARY_SENTINEL ? 'عادي' : otherCustomer}
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-foreground">
              هل أنت متأكد من حذف المقاس <strong>"{deletingSize}"</strong> من فئة <strong>"{otherCustomer === PRIMARY_SENTINEL ? 'عادي' : otherCustomer}"</strong> فقط للمستوى <strong>"{selectedLevel}"</strong>؟
            </p>
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3">
              <p className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                ملاحظة: سيتم حذف هذا المقاس من فئة «{otherCustomer === PRIMARY_SENTINEL ? 'عادي' : otherCustomer}» فقط، ولن تتأثر باقي الفئات ولا أسعار الشركات أو اللوحات المنشأة.
              </p>
            </div>
          </div>
          <UIDialog.DialogFooter className="flex flex-col-reverse sm:flex-row gap-2 justify-between">
            <Button variant="outline" onClick={()=>setDeleteSizeOpen(false)} className="cursor-pointer">إلغاء</Button>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                className="text-red-600 border-red-300 hover:bg-red-50 dark:hover:bg-red-950/20 text-xs cursor-pointer" 
                onClick={() => deleteSize(true)}
                title="حذف هذا المقاس من كل الفئات في هذا المستوى"
              >
                حذف من المستوى بالكامل
              </Button>
              <Button variant="destructive" onClick={() => deleteSize(false)} className="cursor-pointer">
                حذف من فئة {otherCustomer === PRIMARY_SENTINEL ? 'عادي' : otherCustomer}
              </Button>
            </div>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* نافذة الطباعة المتطورة */}
      <UIDialog.Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <UIDialog.DialogContent dir="rtl" className="pricing-workspace pricing-print-dialog max-w-4xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden rounded-2xl border border-border/80 shadow-2xl bg-card">
          {/* رأس النافذة الأنيق مع إمكانية حفظ واستعادة الإعدادات */}
          <UIDialog.DialogHeader className="bg-gradient-to-l from-primary/10 via-primary/5 to-transparent px-6 py-5 border-b border-border/70 shrink-0">
            <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-11 h-11 rounded-xl bg-primary/15 border border-primary/30 flex items-center justify-center text-primary shadow-sm shrink-0">
                  <Printer className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <UIDialog.DialogTitle className="text-xl font-bold text-foreground">
                      تخصيص وطباعة قائمة الأسعار
                    </UIDialog.DialogTitle>
                    {hasSavedSettings && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25">
                        <CheckCircle2 className="w-3 h-3" />
                        إعدادات محفوظة
                      </span>
                    )}
                  </div>
                  <UIDialog.DialogDescription className="text-xs sm:text-sm text-muted-foreground mt-0.5">
                    حدد فئة العميل والمستويات، ثم خصص مظهر القائمة وصدّرها أو اطبعها.
                  </UIDialog.DialogDescription>
                </div>
              </div>

              {/* أزرار الحفظ السريع واستعادة الإعدادات */}
              <div className="flex items-center gap-2 self-start sm:self-center flex-wrap">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => savePrintSettings(true)}
                  className="h-8 text-xs font-bold gap-1.5 border-primary/40 hover:bg-primary/10 hover:border-primary text-foreground cursor-pointer rounded-xl transition-all shadow-2xs"
                  title="حفظ الخيارات الحالية كإعداداتك الافتراضية دائماً"
                >
                  <Save className="w-3.5 h-3.5 text-primary" />
                  <span>حفظ الإعدادات</span>
                </Button>

                {hasSavedSettings && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={resetPrintSettings}
                    className="h-8 text-xs font-medium gap-1 text-muted-foreground hover:text-foreground cursor-pointer rounded-xl"
                    title="استعادة الإعدادات الأصلية للنظام"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">استعادة الافتراضي</span>
                  </Button>
                )}
              </div>
            </div>

            {/* شريط الملخص وخيار الحفظ التلقائي */}
            <div className="mt-3 flex items-center justify-between gap-3 flex-wrap bg-background/80 backdrop-blur-sm border border-border/80 rounded-xl px-3.5 py-2 text-xs text-muted-foreground">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-foreground">الفئة: <strong className="text-primary">{printCategory}</strong></span>
                <span className="text-border">·</span>
                <span>الشهر: <strong className="text-primary">{printMonth} {printYear}</strong></span>
                <span className="text-border">·</span>
                <span>المستوى: <strong className="text-foreground">{printLevelsLabel}</strong></span>
                <span className="text-border">·</span>
                <span>المظهر: <strong className={printTheme === 'light' ? 'text-amber-600 dark:text-amber-400 font-semibold' : 'text-primary font-semibold'}>{printTheme === 'light' ? 'فاتح (ورقي / PDF)' : 'داكن (شاشات)'}</strong></span>
                {priceMarkupPercent > 0 && (
                  <>
                    <span className="text-border">·</span>
                    <span>الزيادة: <strong className="text-emerald-600 dark:text-emerald-400 font-bold">+{priceMarkupPercent}%</strong></span>
                  </>
                )}
              </div>

              <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-muted-foreground hover:text-foreground shrink-0 select-none">
                <input
                  type="checkbox"
                  checked={autoSavePrintSettings}
                  onChange={(e) => {
                    const checked = e.target.checked;
                    setAutoSavePrintSettings(checked);
                    if (checked) savePrintSettings(false);
                  }}
                  className="w-3.5 h-3.5 rounded border-border text-primary focus:ring-primary cursor-pointer accent-primary"
                />
                <span>حفظ التعديلات تلقائياً للاستخدام القادم</span>
              </label>
            </div>
          </UIDialog.DialogHeader>

          {/* جسم النافذة القابل للتمرير */}
          <div className="print-dialog-body flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-5 space-y-5">
            
            {/* 2. اختيار الفئة السعرية */}
            <div className="space-y-3 border-t border-border/70 pt-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Tag className="w-4 h-4 text-primary" />
                  الفئة السعرية للعميل
                </label>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">الفئة المحددة:</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-md bg-primary/15 text-primary border border-primary/30">
                    {printCategory}
                  </span>
                </div>
              </div>

              {/* بطاقات الفئات السريعة الأكثر طلباً */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {['شركات', 'عادي', 'مسوق', 'البحباح'].map((catName) => {
                  const isSelected = printCategory === catName;
                  return (
                    <button
                      key={`quick-cat-${catName}`}
                      type="button"
                      onClick={() => { setPrintCategory(catName); setPrintCategorySearch(''); }}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-semibold transition-all cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                          : 'border-border/80 bg-muted/20 text-foreground hover:bg-muted/50 hover:border-primary/40'
                      }`}
                    >
                      <span>{catName}</span>
                      {isSelected ? (
                        <Check className="w-3.5 h-3.5 shrink-0" />
                      ) : (
                        <span className="text-[10px] text-muted-foreground opacity-70">فئة رئيسية</span>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* حقل البحث وشريط باقي الفئات */}
              <div className="bg-muted/15 border border-border/60 rounded-xl p-3 space-y-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    placeholder="ابحث بين جميع الفئات المسجلة..."
                    value={printCategorySearch}
                    onChange={(e) => setPrintCategorySearch(e.target.value)}
                    className="h-8 text-xs pr-9 pl-8 bg-background border-border/80"
                  />
                  {printCategorySearch && (
                    <button
                      type="button"
                      onClick={() => setPrintCategorySearch('')}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pt-1">
                  {orderedCategories
                    .filter(c => !printCategorySearch || c.toLowerCase().includes(printCategorySearch.toLowerCase()))
                    .map((c, index) => {
                      const isSelected = printCategory === c;
                      return (
                        <button
                          key={`print-cat-${index}-${c}`}
                          type="button"
                          onClick={() => { setPrintCategory(c); setPrintCategorySearch(''); }}
                          className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all border cursor-pointer ${
                            isSelected
                              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                              : 'bg-background text-foreground border-border/80 hover:bg-muted hover:border-primary/40'
                          }`}
                        >
                          {c}
                        </button>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* 3. شهر وتاريخ القائمة والاسم المقترح للحفظ */}
            <div className="space-y-3 border-t border-border/70 pt-5">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <label className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Calendar className="w-4 h-4 text-primary" />
                  <span>شهر وتاريخ القائمة (الاسم المقترح للحفظ)</span>
                </label>
                <span className="text-xs text-muted-foreground">
                  يُعتمد كاسم مقترح عند حفظ الملف بصيغة PDF وتوثيقه في تاريخ الإصدار أسفل الصفحة
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">شهر القائمة</label>
                  <select
                    value={printMonth}
                    onChange={e => setPrintMonth(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-border bg-background text-sm font-medium focus:ring-2 focus:ring-primary focus:outline-none cursor-pointer"
                  >
                    {ARABIC_MONTH_NAMES.map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted-foreground">السنة</label>
                  <Input
                    type="number"
                    value={printYear}
                    onChange={e => setPrintYear(parseInt(e.target.value) || new Date().getFullYear())}
                    min={2020}
                    max={2040}
                    className="h-10 text-sm font-bold bg-background border-border"
                  />
                </div>
              </div>

              {/* معاينة شكل الترويسة واسم ملف الحفظ */}
              <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="text-xs font-semibold text-muted-foreground">التاريخ الموثق أسفل الصفحة:</span>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="inline-flex items-center text-xs font-semibold px-2.5 py-0.5 rounded-md bg-muted text-foreground border border-border">
                      {new Date().toLocaleDateString('ar-LY')} (شهر {printMonth} {printYear})
                    </span>
                  </div>
                </div>
                <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-primary/10">
                  <span className="text-xs font-semibold text-muted-foreground">الاسم المقترح لحفظ الملف (PDF):</span>
                  <span className="text-xs font-mono font-bold text-foreground bg-background px-2.5 py-1 rounded-lg border border-border/80" dir="ltr">
                    قائمة أسعار {printCategory === 'شركات' ? 'فئة الشركات' : `فئة ${printCategory}`} - {printMonth} {printYear}.pdf
                  </span>
                </div>
              </div>
            </div>

            <section className="print-level-section space-y-3" aria-labelledby="print-level-title">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 id="print-level-title" className="font-bold flex items-center gap-2"><Layers className="h-4 w-4 text-primary" />مستويات اللوحات المطلوبة</h3>
                  <p className="mt-1 text-sm text-muted-foreground">حدد مستوى أو أكثر. ستُطبع المستويات المحددة فقط، وجميع المدد في صف واحد.</p>
                </div>
                <span className="rounded-lg bg-primary/10 px-3 py-1 text-sm font-bold">{selectedPrintLevels.length} من {allLevels.length}</span>
              </div>
              <div className="flex gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setPrintLevel('all')}>تحديد الكل</Button>
                <Button type="button" size="sm" variant="ghost" onClick={() => setPrintLevel([])}>إلغاء التحديد</Button>
              </div>
              <div className="grid grid-cols-1 min-[420px]:grid-cols-2 gap-2">
                {allLevels.map(code => {
                  const info = levels.find(level => level.level_code === code);
                  const selected = selectedPrintLevels.includes(code);
                  const hasPrices = pricingData.some(row => row.billboard_level === code && row.customer_category === printCategory && printMonthOptions.some(option => (readDurationPrice(row, option.dbColumn) ?? 0) > 0));
                  return (
                    <label key={code} className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-all duration-200 ${selected ? 'border-primary bg-primary/10' : 'border-border bg-background hover:border-primary/60'}`}>
                      <input type="checkbox" checked={selected} onChange={() => togglePrintLevel(code)} className="h-5 w-5 shrink-0 accent-primary cursor-pointer" />
                      <span className="flex-1"><span className="block text-sm font-bold">{info?.level_name || code}</span><span className="text-xs text-muted-foreground">{hasPrices ? 'توجد أسعار للطباعة' : 'لا توجد أسعار لهذه الفئة؛ لن تُطبع صفحة فارغة'}</span></span>
                      <span className="font-bold text-sm" dir="ltr">{code}</span>
                    </label>
                  );
                })}
              </div>
              {!selectedPrintLevels.length && <p role="status" className="text-sm text-destructive">اختر مستوى واحدًا على الأقل لتفعيل الطباعة والتصدير.</p>}
            </section>

            <section className="space-y-3" aria-labelledby="print-durations-title">
              <h3 id="print-durations-title" className="font-bold flex items-center gap-2"><Calendar className="h-4 w-4 text-primary" />المدد الظاهرة في الطباعة</h3>
              <p className="text-sm text-muted-foreground">اختر المدد المطلوبة. مدتا 15 و45 يومًا مخفيتان افتراضيًا، وتظهر المدد المحددة في صف واحد.</p>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setDurationVisibility(Object.fromEntries(MONTH_OPTIONS.map(option => [option.dbColumn, true])))}>إظهار الكل</Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => setDurationVisibility({})}>المدد الافتراضية</Button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {MONTH_OPTIONS.map(option => {
                  const checked = durationVisibility[option.dbColumn] ?? ![15, 45].includes(option.days);
                  return <label key={option.dbColumn} className={`flex items-center gap-2 rounded-xl border p-3 cursor-pointer ${checked ? 'border-primary bg-primary/10' : 'border-border'}`}>
                    <input type="checkbox" checked={checked} onChange={event => setDurationVisibility(current => ({ ...current, [option.dbColumn]: event.target.checked }))} className="h-4 w-4 accent-primary cursor-pointer" />
                    <span className="text-sm">{option.label}<span className="block text-xs text-muted-foreground">{option.days} يوم</span></span>
                  </label>;
                })}
              </div>
              {!printMonthOptions.length && <p role="status" className="text-sm text-destructive">اختر مدة واحدة على الأقل.</p>}
            </section>

            {/* 1. وضع ومظهر الطباعة */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Palette className="w-4 h-4 text-primary" />
                  وضع ومظهر الطباعة
                </label>
                <span className="text-xs text-muted-foreground">
                  اختر النمط المناسب سواء للطباعة الورقية أو الاستعراض الرقمي
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* نمط فاتح */}
                <button
                  type="button"
                  onClick={() => setPrintTheme('light')}
                  className={`group relative flex flex-col gap-2 p-4 rounded-xl border-2 text-right transition-all cursor-pointer ${
                    printTheme === 'light'
                      ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/20'
                      : 'border-border/80 bg-card hover:border-primary/40 hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                        <Sun className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-sm text-foreground">فاتح (مناسب للطباعة)</span>
                    </div>
                    {printTheme === 'light' ? (
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-muted-foreground/30" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pr-9">
                    خلفية بيضاء وحدود سوداء ولمسات ذهبية للطباعة على A4.
                  </p>
                  <div className="mt-1 flex items-center gap-2 pr-9">
                    <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                      موصى به للطباعة الورقية و PDF
                    </span>
                  </div>
                </button>

                {/* نمط داكن */}
                <button
                  type="button"
                  onClick={() => setPrintTheme('dark')}
                  className={`group relative flex flex-col gap-2 p-4 rounded-xl border-2 text-right transition-all cursor-pointer ${
                    printTheme === 'dark'
                      ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/20'
                      : 'border-border/80 bg-card hover:border-primary/40 hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center justify-between w-full">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 rounded-lg bg-indigo-500/10 text-indigo-400">
                        <Moon className="w-4 h-4" />
                      </div>
                      <span className="font-semibold text-sm text-foreground">داكن (للعرض الرقمي)</span>
                    </div>
                    {printTheme === 'dark' ? (
                      <CheckCircle2 className="w-4 h-4 text-primary shrink-0" />
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-muted-foreground/30" />
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed pr-9">
                    خلفية داكنة ونصوص واضحة لعرض القائمة على الشاشة.
                  </p>
                  <div className="mt-1 flex items-center gap-2 pr-9">
                    <span className="inline-flex items-center text-[11px] font-medium px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                      مناسب للشاشات
                    </span>
                  </div>
                </button>
              </div>
            </div>

            {/* 4. اختيار الشعار */}
            <div className="space-y-3 border-t border-border/70 pt-5">
              <div className="flex items-center justify-between">
                <label className="text-sm font-semibold flex items-center gap-2 text-foreground">
                  <Sparkles className="w-4 h-4 text-primary" />
                  شعار رأس القائمة
                </label>
                <span className="text-xs text-muted-foreground">
                  يظهر الشعار في أعلى صفحة المطبوعة الرسمية
                </span>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {AVAILABLE_LOGOS.map((logo, index) => {
                  const isSelected = printLogo === logo.src;
                  return (
                    <button
                      key={`logo-${index}`}
                      type="button"
                      onClick={() => setPrintLogo(logo.src)}
                      className={`flex flex-col items-center justify-between p-2.5 rounded-xl border-2 transition-all cursor-pointer min-h-[76px] ${
                        isSelected
                          ? 'border-primary bg-primary/10 shadow-sm ring-1 ring-primary/20'
                          : 'border-border/80 bg-muted/15 hover:border-primary/40 hover:bg-muted/40'
                      }`}
                    >
                      <div className="h-8 w-full flex items-center justify-center">
                        {logo.src ? (
                          <img src={logo.src} alt={logo.label} className="h-7 w-auto max-w-[80px] object-contain" />
                        ) : (
                          <div className="flex items-center justify-center text-muted-foreground">
                            <EyeOff className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                      <span className={`text-[11px] font-medium leading-tight text-center truncate w-full ${isSelected ? 'text-primary font-bold' : 'text-muted-foreground'}`}>
                        {logo.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 5. خيارات العرض وهوامش الأسعار */}
            <div className="space-y-4 border-t border-border/70 pt-5">
              <div className="bg-muted/20 border border-border/70 rounded-xl p-4 space-y-4">
                {/* إظهار عمود المستوى */}
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={showLevelColumn}
                      onChange={(e) => setShowLevelColumn(e.target.checked)}
                      className="w-4 h-4 rounded border-border text-primary focus:ring-primary cursor-pointer accent-amber-500"
                    />
                    <div>
                      <span className="text-sm font-semibold text-foreground block">إظهار عمود المستوى في جدول الطباعة</span>
                      <span className="text-xs text-muted-foreground block">مفيد عند طباعة كل المستويات معاً لتمييز تصنيف كل لوحة</span>
                    </div>
                  </label>
                </div>

                {/* نسبة زيادة الأسعار */}
                <div className="border-t border-border/60 pt-3 space-y-2.5">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <label className="text-sm font-semibold flex items-center gap-1.5 text-foreground">
                      <Percent className="w-4 h-4 text-primary" />
                      هامش الزيادة على الأسعار (%)
                    </label>
                    <span className="text-xs text-muted-foreground">
                      تطبيق نسبة ربح إضافية تلقائياً على كل الأسعار المعروضة
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="relative w-28">
                      <Input
                        type="number"
                        min={0}
                        max={100}
                        step={1}
                        value={priceMarkupPercent}
                        onChange={(e) => setPriceMarkupPercent(Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                        className="h-9 pr-3 pl-7 text-sm font-bold text-center border-border/80"
                        placeholder="0"
                      />
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">%</span>
                    </div>

                    {/* أزرار سريعة للنسب */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {[0, 5, 10, 15, 20, 25].map((pct) => (
                        <button
                          key={`pct-${pct}`}
                          type="button"
                          onClick={() => setPriceMarkupPercent(pct)}
                          className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all border cursor-pointer ${
                            priceMarkupPercent === pct
                              ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                              : 'bg-background text-foreground border-border/80 hover:bg-muted hover:border-primary/40'
                          }`}
                        >
                          {pct === 0 ? 'الأصلي (0%)' : `+${pct}%`}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* جدول معاينة عينة من الأسعار مع الزيادة */}
                  {priceMarkupPercent > 0 && previewPricesWithMarkup.length > 0 && (
                    <div className="mt-3 bg-card rounded-xl p-3.5 border border-primary/20 shadow-sm space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-primary">
                            معاينة حية للأسعار بعد الزيادة ({priceMarkupPercent}%)
                          </span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-semibold">
                            زيادة فعالة
                          </span>
                        </div>
                        <span className="text-[11px] text-muted-foreground">عينة لأول مقاسات</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="border-b border-border/50 text-muted-foreground">
                              <th className="text-right py-1.5 px-2 font-semibold">المستوى</th>
                              <th className="text-right py-1.5 px-2 font-semibold">المقاس</th>
                              <th className="text-right py-1.5 px-2 font-semibold">الفترة</th>
                              <th className="text-right py-1.5 px-2 font-semibold">السعر الأصلي</th>
                              <th className="text-right py-1.5 px-2 font-semibold text-primary">السعر الجديد</th>
                              <th className="text-right py-1.5 px-2 font-semibold text-emerald-600 dark:text-emerald-400">الزيادة الصافية</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-border/30">
                            {previewPricesWithMarkup.map((item, idx) => (
                              <tr key={idx} className="hover:bg-muted/30 transition-colors">
                                <td className="py-1.5 px-2 font-medium">{item.level}</td>
                                <td className="py-1.5 px-2 font-semibold">{item.size}</td>
                                <td className="py-1.5 px-2 text-muted-foreground">{item.period}</td>
                                <td className="py-1.5 px-2 text-muted-foreground">{item.originalPrice.toLocaleString()} د.ل</td>
                                <td className="py-1.5 px-2 font-bold text-primary">{item.newPrice.toLocaleString()} د.ل</td>
                                <td className="py-1.5 px-2 text-emerald-600 dark:text-emerald-400 font-bold">+{item.increase.toLocaleString()} د.ل</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

          </div>

          {/* تذييل النافذة والإجراءات مع حفظ التفضيلات */}
          <UIDialog.DialogFooter className="px-6 py-4 border-t border-border/70 bg-muted/15 flex flex-col-reverse sm:flex-row items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Button
                variant="outline"
                onClick={() => setPrintOpen(false)}
                className="cursor-pointer w-full sm:w-auto"
              >
                إغلاق
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => savePrintSettings(true)}
                className="cursor-pointer gap-1.5 border-border hover:border-primary text-xs font-semibold text-foreground w-full sm:w-auto"
                title="حفظ الإعدادات الحالية لتكون الخيارات الافتراضية دائماً"
              >
                <Save className="h-3.5 w-3.5 text-primary" />
                <span>حفظ الإعدادات</span>
              </Button>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto">
              <Button
                variant="outline"
                disabled={!selectedPrintLevels.length || !printMonthOptions.length}
                onClick={() => {
                  if (autoSavePrintSettings) savePrintSettings(false);
                  exportCategoryToExcel(printCategory, priceMarkupPercent);
                }}
                className="cursor-pointer border-border hover:border-primary/50 flex-1 sm:flex-initial"
              >
                <FileSpreadsheet className="h-4 w-4 ml-2 text-emerald-600 dark:text-emerald-400" />
                تصدير Excel {priceMarkupPercent > 0 && `(+${priceMarkupPercent}%)`}
              </Button>
              <Button
                disabled={!selectedPrintLevels.length || !printMonthOptions.length}
                onClick={() => {
                  if (autoSavePrintSettings) savePrintSettings(false);
                  handlePrint();
                }}
                className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold px-5 shadow-md cursor-pointer flex-1 sm:flex-initial"
              >
                <Printer className="h-4 w-4 ml-2" />
                معاينة وطباعة القائمة
              </Button>
            </div>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* نافذة إضافة فئة جديدة */}
      <UIDialog.Dialog open={addCatOpen} onOpenChange={setAddCatOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>إضافة فئة جديدة</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              أدخل اسم الفئة الجديدة التي تريد إضافتها للمستوى {selectedLevel}
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <Input placeholder="اسم الفئة (مثال: المدينة)" value={newCatName} onChange={e=>setNewCatName(e.target.value)} />
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={()=>setAddCatOpen(false)}>إلغاء</Button>
            <Button onClick={saveNewCategory}>حفظ</Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* نافذة تعديل الفئة */}
      <UIDialog.Dialog open={editCatOpen} onOpenChange={setEditCatOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>تعديل الفئة</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              قم بتعديل اسم الفئة المحددة
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <div className="expenses-dialog-form">
            <div>
              <label className="expenses-form-label">الاسم الحالي: {editingCategory?.name}</label>
            </div>
            <Input
              placeholder="اسم الفئة الجديد"
              value={editCatName}
              onChange={e=>setEditCatName(e.target.value)}
              autoFocus
            />
          </div>
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={()=>setEditCatOpen(false)}>إلغاء</Button>
            <Button onClick={updateCategory} disabled={!editCatName.trim()}>تحديث</Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* نافذة تأكيد الحذف */}
      <UIDialog.Dialog open={deleteCatOpen} onOpenChange={setDeleteCatOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>تأكيد الحذف</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              هذا الإجراء لا يمكن التراجع عنه
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              هل أنت متأكد من حذف الفئة <strong>"{deletingCategory?.name}"</strong>؟
            </p>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400">
  تحذير: سيتم حذف جميع الأسعار المرتبطة بهذه الفئة نهائياً ولا يمكن التراجع عن هذا الإجراء.
              </p>
            </div>
          </div>
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={()=>setDeleteCatOpen(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={deleteCategory}>حذف نهائياً</Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* نافذة إضافة مقاس - محدثة للعمل مع جدول الأسعار */}
      <UIDialog.Dialog open={addSizeOpen} onOpenChange={setAddSizeOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>
              {otherCustomer !== PRIMARY_SENTINEL 
                ? `إضافة مقاس لفئة «${otherCustomer}»` 
                : 'إضافة مقاس جديد'}
            </UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              {otherCustomer !== PRIMARY_SENTINEL 
                ? `اختر مقاساً لإضافته وتسعيره لفئة «${otherCustomer}» في المستوى ${selectedLevel}`
                : `اختر مقاس موجود أو أدخل مقاس جديد لإضافته للمستوى ${selectedLevel}`}
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <div className="expenses-dialog-form space-y-4">
            <div>
              <label className="expenses-form-label">اختر من المقاسات الموجودة</label>
              {availableSizesForLevel.length > 0 ? (
                <Select value={selectedNewSize} onValueChange={setSelectedNewSize}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر مقاس من المقاسات المتاحة" />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSizesForLevel.map((size, index) => (
                      <SelectItem key={`available-size-${index}`} value={size}>
                        {size}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-sm text-muted-foreground">جميع المقاسات الموجودة في النظام مضافة بالفعل لهذا المستوى</p>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-px bg-border"></div>
              <span className="text-xs text-muted-foreground">أو</span>
              <div className="flex-1 h-px bg-border"></div>
            </div>

            <div>
              <label className="expenses-form-label">أدخل مقاس جديد (العرض × الارتفاع)</label>
              <Input
                placeholder="مثال: 12x4, 8x3, إلخ..."
                value={newSizeName}
                onChange={e=>setNewSizeName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                القاعدة القياسية المعتمدة: اكتب العرض أولاً ثم الارتفاع دائماً (مثال: 12x4 حيث 12 هو العرض و 4 هو الارتفاع).
              </p>
            </div>
          </div>
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={()=>{setAddSizeOpen(false); setSelectedNewSize(''); setNewSizeName('');}}>إلغاء</Button>
            <Button
              onClick={saveNewSize}
              disabled={!selectedNewSize.trim() && !newSizeName.trim()}
            >
              حفظ
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* نافذة إضافة مدة جديدة */}
      <UIDialog.Dialog open={addDurationOpen} onOpenChange={setAddDurationOpen}>
        <UIDialog.DialogContent dir="rtl" className="max-w-lg overflow-y-auto [&_button]:cursor-pointer [&_button]:transition-all [&_button]:duration-200">
          <UIDialog.DialogHeader className="border-b border-border pb-4 pl-8">
            <UIDialog.DialogTitle className="text-xl">إضافة مدة تسعير</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>حدد اسم المدة وطولها ليظهر سعرها في العقود والعروض.</UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <DurationEditor name={newDurationName} months={newDurationMonths} days={newDurationDays}
            onChange={({ name, months, days }) => { setNewDurationName(name); setNewDurationLabel(name); setNewDurationMonths(months); setNewDurationDays(days); }} />
          <UIDialog.DialogFooter className="border-t border-border pt-4">
            <Button className="h-11 flex-1" onClick={addNewDuration} disabled={savingDuration || !newDurationName.trim() || newDurationDays < 1 || !Number.isFinite(newDurationDays)}>{savingDuration ? 'جارٍ الحفظ...' : 'إضافة المدة وتحديد أسعارها'}</Button>
            <Button className="h-11" variant="outline" onClick={() => { setAddDurationOpen(false); resetDurationForm(); }}>إلغاء</Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* نافذة تعديل المدة */}
      <UIDialog.Dialog open={editDurationOpen} onOpenChange={setEditDurationOpen}>
        <UIDialog.DialogContent dir="rtl" className="max-w-lg overflow-y-auto [&_button]:cursor-pointer [&_button]:transition-all [&_button]:duration-200">
          <UIDialog.DialogHeader className="border-b border-border pb-4 pl-8">
            <UIDialog.DialogTitle className="text-xl">تعديل مدة التسعير</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>حدد اسم المدة وطولها ليظهر سعرها في العقود والعروض.</UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <DurationEditor name={newDurationName} months={newDurationMonths} days={newDurationDays}
            onChange={({ name, months, days }) => { setNewDurationName(name); setNewDurationLabel(name); setNewDurationMonths(months); setNewDurationDays(days); }} />
          <UIDialog.DialogFooter className="border-t border-border pt-4">
            <Button className="h-11 flex-1" onClick={updateDuration} disabled={savingDuration || !newDurationName.trim() || newDurationDays < 1 || !Number.isFinite(newDurationDays)}>{savingDuration ? 'جارٍ الحفظ...' : 'حفظ التعديلات'}</Button>
            <Button className="h-11" variant="outline" onClick={() => { setEditDurationOpen(false); resetDurationForm(); }}>إلغاء</Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* نافذة تأكيد حذف المدة */}
      <UIDialog.Dialog open={deleteDurationOpen} onOpenChange={setDeleteDurationOpen}>
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>تأكيد الحذف</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              هذا الإجراء لا يمكن التراجع عنه
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              هل أنت متأكد من حذف المدة <strong>"{deletingDuration?.name}"</strong>؟
            </p>
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-3">
              <p className="text-sm text-amber-600 dark:text-amber-400">
 ملاحظة: ستُخفى المدة من الاختيارات الجديدة وتبقى أسعارها محفوظة للعقود السابقة.
              </p>
            </div>
          </div>
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDurationOpen(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={deleteDuration}>حذف</Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>
    </div>
  );
}