import { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import MultiSelect from '@/components/ui/multi-select';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import * as UIDialog from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Printer, Edit2, Trash2, Plus, Minus, Download } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import logoFaresGoldSvgRaw from '@/assets/logofaresgold.svg?raw';

function svgTextToDataUri(svgText: string): string {
  const bytes = new TextEncoder().encode(svgText);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

const LOGO_FARES_GOLD_FALLBACK_SRC = svgTextToDataUri(logoFaresGoldSvgRaw);

function normalize(val: any): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const num = Number(String(val).replace(/[^\d.-]/g, ''));
  return isNaN(num) ? null : num;
}

type MonthKeyAll = string;

// المدد الافتراضية (احتياطي)
const DEFAULT_MONTH_OPTIONS = [
  { key: 'شهر واحد', label: 'شهرياً', months: 1, days: 30, dbColumn: 'one_month', sort_order: 1 },
  { key: '2 أشهر', label: 'كل شهرين', months: 2, days: 60, dbColumn: '2_months', sort_order: 2 },
  { key: '3 أشهر', label: 'كل 3 أشهر', months: 3, days: 90, dbColumn: '3_months', sort_order: 3 },
  { key: '6 أشهر', label: 'كل 6 أشهر', months: 6, days: 180, dbColumn: '6_months', sort_order: 4 },
  { key: 'سنة كاملة', label: 'سنوي', months: 12, days: 365, dbColumn: 'full_year', sort_order: 5 },
  { key: 'يوم واحد', label: 'يومي', months: 0, days: 1, dbColumn: 'one_day', sort_order: 6 },
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

const PRIMARY_CUSTOMERS: string[] = ['عادي', 'مسوق', 'شركات'];
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
}

interface SizeData {
  id: number;
  name: string;
  level?: string; // جعل level اختياري لأنه قد لا يكون موجود
  sort_order?: number;
}

export default function PricingList() {
  // البيانات من قاعدة البيانات
  const [levels, setLevels] = useState<BillboardLevel[]>([]);
  const [categories, setCategories] = useState<PricingCategory[]>([]);
  const [pricingData, setPricingData] = useState<PricingData[]>([]);
  const [sizesData, setSizesData] = useState<SizeData[]>([]);
  const [durations, setDurations] = useState<PricingDuration[]>([]);
  const [loading, setLoading] = useState(true);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // إنشاء MONTH_OPTIONS من المدد المحملة
  const MONTH_OPTIONS = useMemo(() => {
    if (durations.length === 0) {
      return DEFAULT_MONTH_OPTIONS.map(d => ({
        key: d.key,
        label: d.label,
        months: d.months,
        days: d.days,
        dbColumn: d.dbColumn,
        sort_order: d.sort_order
      }));
    }
    return durations
      .filter(d => d.is_active)
      .sort((a, b) => a.sort_order - b.sort_order)
      .map(d => ({
        key: d.name,
        label: d.label,
        months: d.months,
        days: d.days,
        dbColumn: d.db_column,
        sort_order: d.sort_order
      }));
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
    
    console.log('📊 المستويات المتاحة (مرتبة حسب sort_order):', result);
    return result;
  }, [levels, sizesData, categories, pricingData]);

  const [selectedLevel, setSelectedLevel] = useState<string>('A');
  const [selectedMonthKey, setSelectedMonthKey] = useState<MonthKey>('شهر واحد');
  const [sizeFilter, setSizeFilter] = useState<string[]>([]);
  const [otherCustomer, setOtherCustomer] = useState<string>(PRIMARY_SENTINEL);

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

  const [printOpen, setPrintOpen] = useState(false);
  const [printCategory, setPrintCategory] = useState<string>('عادي');
  const [printLevel, setPrintLevel] = useState<string>('all');
  const [showLevelColumn, setShowLevelColumn] = useState(true);
  const [priceMarkupPercent, setPriceMarkupPercent] = useState<number>(0);
  const [printTheme, setPrintTheme] = useState<'dark' | 'light'>('light');
  const [categorySearchTerm, setCategorySearchTerm] = useState('');
  const [printCategorySearch, setPrintCategorySearch] = useState('');
  const [printLogo, setPrintLogo] = useState<string>('/logofaresgold.svg');

  // الشعارات المتوفرة
  const AVAILABLE_LOGOS = [
    { src: '/logofaresgold.svg', label: 'الفارس الذهبي' },
    { src: '/logofaresgold.svg', label: 'الفارس' },
    { src: '/logofares2.svg', label: 'الفارس 2' },
    { src: '/new-logo.svg', label: 'الشعار الجديد' },
    { src: '/logo-symbol.svg', label: 'الرمز' },
    { src: '/coplete logofares-text. and sympol.svg', label: 'الشعار الكامل' },
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
  const [editDurationOpen, setEditDurationOpen] = useState(false);
  const [deleteDurationOpen, setDeleteDurationOpen] = useState(false);
  const [editingDuration, setEditingDuration] = useState<PricingDuration | null>(null);
  const [deletingDuration, setDeletingDuration] = useState<PricingDuration | null>(null);
  const [newDurationName, setNewDurationName] = useState('');
  const [newDurationLabel, setNewDurationLabel] = useState('');
  const [newDurationDays, setNewDurationDays] = useState<number>(30);
  const [newDurationMonths, setNewDurationMonths] = useState<number>(1);
  const [newDurationOrder, setNewDurationOrder] = useState<number>(1);
  const [newDurationDbColumn, setNewDurationDbColumn] = useState('');
 const [isUpdatingSizeIds, setIsUpdatingSizeIds] = useState(false); // حالة تحديث size_id

  // ✅ دالة تحديث size_id للأسعار التي ليس لديها size_id
  const updateMissingSizeIds = async () => {
    try {
      setIsUpdatingSizeIds(true);
      console.log('🔄 بدء تحديث size_id للأسعار...');
      
      // الحصول على الأسعار التي ليس لديها size_id
      const { data: pricingWithoutSizeId, error: fetchError } = await supabase
        .from('pricing')
        .select('id, size')
        .is('size_id', null);
      
      if (fetchError) {
        console.error('❌ خطأ في جلب الأسعار:', fetchError);
        toast.error('فشل في جلب الأسعار');
        return;
      }
      
      if (!pricingWithoutSizeId || pricingWithoutSizeId.length === 0) {
        toast.success('جميع الأسعار لديها size_id بالفعل!');
        return;
      }
      
      console.log(`📊 وجدت ${pricingWithoutSizeId.length} سجل بدون size_id`);
      
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
            console.error(`❌ فشل تحديث السجل ${pricing.id}:`, updateError);
            failedCount++;
          } else {
            updatedCount++;
          }
        } else {
          console.warn(`⚠️ لم يتم العثور على size_id للمقاس: ${pricing.size}`);
          failedCount++;
        }
      }
      
      console.log(`✅ تم تحديث ${updatedCount} سجل`);
      if (failedCount > 0) {
        console.log(`⚠️ فشل تحديث ${failedCount} سجل`);
      }
      
      // إعادة تحميل البيانات
      await loadData();
      
      toast.success(`تم تحديث ${updatedCount} سجل بنجاح${failedCount > 0 ? ` (${failedCount} فشل)` : ''}`);
    } catch (error) {
      console.error('💥 خطأ في تحديث size_id:', error);
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

      console.log('🔄 بدء تحميل البيانات من قاعدة البيانات...');

      // اختبار الاتصال بقاعدة البيانات أولاً
      const { data: testData, error: testError } = await supabase
        .from('billboard_levels')
        .select('count', { count: 'exact', head: true });

      if (testError) {
        console.error('❌ خطأ في الاتصال بقاعدة البيانات:', testError);
        setConnectionError(`خطأ في الاتصال: ${testError.message}`);
        return;
      }

      console.log('✅ تم الاتصال بقاعدة البيانات بنجاح');

      // تحميل المستويات من جدول billboard_levels
      console.log('📊 تحميل المستويات...');
      const { data: levelsData, error: levelsError } = await supabase
        .from('billboard_levels')
        .select('*')
        .order('sort_order', { ascending: true });

      if (levelsError) {
        console.error('❌ خطأ في تحميل المستويات:', levelsError);
        console.log('⚠️ سيتم استخراج المستويات من البيانات الموجودة');
      } else {
        console.log('✅ تم تحميل المستويات:', levelsData?.length || 0, 'مستوى');
        if (levelsData && levelsData.length > 0) {
          console.table(levelsData);
        }
        setLevels(levelsData || []);
      }

      // تحميل الفئات من جدول pricing_categories
      console.log('📋 تحميل الفئات...');
      const { data: categoriesData, error: catError } = await supabase
        .from('pricing_categories')
        .select('id, name, created_at')
        .order('name');

      if (catError) {
        console.error('❌ خطأ في تحميل الفئات:', catError);
        toast.error(`فشل في تحميل الفئات: ${catError.message}`);
      } else {
        console.log('✅ تم تحميل الفئات:', categoriesData?.length || 0, 'فئة');
        if (categoriesData && categoriesData.length > 0) {
          console.table(categoriesData);
        }
        setCategories(categoriesData || []);
      }

      // محاولة تحميل المقاسات من جدول sizes (إذا كان موجود) مرتبة حسب sort_order
      console.log('📏 محاولة تحميل المقاسات...');
      const { data: sizesData, error: sizesError } = await supabase
        .from('sizes')
        .select('*')
        .order('sort_order', { ascending: true, nullsFirst: false });

      if (sizesError) {
        console.error('❌ خطأ في تحميل المقاسات من جدول sizes:', sizesError);
        console.log('⚠️ سيتم استخراج المقاسات من جدول الأسعار');
        setSizesData([]);
      } else {
        console.log('✅ تم تحميل المقاسات:', sizesData?.length || 0, 'مقاس');
        setSizesData(sizesData || []);
      }

      // تحميل بيانات الأسعار
      console.log('💰 تحميل الأسعار...');
      const { data: pricingData, error: pricingError } = await supabase
        .from('pricing')
        .select('*')
        .order('billboard_level, customer_category, size');

      if (pricingError) {
        console.error('❌ خطأ في تحميل الأسعار:', pricingError);
        toast.error(`فشل في تحميل الأسعار: ${pricingError.message}`);
      } else {
        console.log('✅ تم تحميل الأسعار:', pricingData?.length || 0, 'سعر');
        setPricingData(pricingData || []);
      }

      // تحميل المدد الزمنية
      console.log('⏱️ تحميل المدد...');
      const { data: durationsData, error: durationsError } = await supabase
        .from('pricing_durations')
        .select('*')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

      if (durationsError) {
        console.error('❌ خطأ في تحميل المدد:', durationsError);
        console.log('⚠️ سيتم استخدام المدد الافتراضية');
      } else {
        console.log('✅ تم تحميل المدد:', durationsData?.length || 0, 'مدة');
        setDurations(durationsData || []);
      }

      console.log('🎉 تم الانتهاء من تحميل جميع البيانات');

    } catch (error) {
      console.error('💥 خطأ عام في الاتصال بقاعدة البيانات:', error);
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
      console.log('🔄 تم تغيير المستوى المحدد إلى:', allLevels[0]);
    }
  }, [allLevels, selectedLevel]);

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

  // دالة حذف المقاس من قائمة الأسعار
  const deleteSize = async () => {
    if (!deletingSize) return;

    try {
      console.log('🗑️ بدء حذف المقاس من قائمة الأسعار...');
      console.log('📏 المقاس المحدد للحذف:', deletingSize);
      console.log('📊 المستوى المحدد:', selectedLevel);

      // حذف جميع الأسعار للمقاس في المستوى المحدد
      const { error } = await supabase
        .from('pricing')
        .delete()
        .eq('size', deletingSize)
        .eq('billboard_level', selectedLevel);

      if (error) {
        console.error('❌ خطأ في حذف المقاس من قائمة الأسعار:', error);
        toast.error(`حدث خطأ في حذف المقاس: ${error.message}`);
        return;
      }

      console.log('✅ تم حذف المقاس من قائمة الأسعار بنجاح');

      // إعادة تحميل البيانات
      await loadData();
      
      setDeleteSizeOpen(false);
      setDeletingSize(null);
      toast.success(`تم حذف المقاس ${deletingSize} من قائمة الأسعار بنجاح`);
    } catch (error) {
      console.error('💥 خطأ في الاتصال بقاعدة البيانات:', error);
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
      console.log('🔄 بدء إضافة المقاس إلى قائمة الأسعار...');
      console.log('📏 المقاس المحدد:', sz);
      console.log('📊 المستوى المحدد:', selectedLevel);

      // الحصول على جميع الفئات (الفئات عامة لجميع المستويات)
      const allCustomerCategories = Array.from(new Set([...PRIMARY_CUSTOMERS, ...categories.map(c => c.name)]));

      console.log('👥 الفئات المتاحة:', allCustomerCategories);

      // التحقق من السجلات الموجودة
      const { data: existingPricing } = await supabase
        .from('pricing')
        .select('customer_category')
        .eq('size', sz)
        .eq('billboard_level', selectedLevel);

      const existingCategories = new Set(existingPricing?.map(p => p.customer_category) || []);
      
      // فقط الفئات التي لا توجد بالفعل
      const newCategories = allCustomerCategories.filter(cat => !existingCategories.has(cat));

      if (newCategories.length === 0) {
        toast.error('هذا المقاس موجود بالفعل لجميع الفئات في هذا المستوى');
        return;
      }

      console.log('➕ الفئات الجديدة للإضافة:', newCategories.length);

      // ✅ الحصول على size_id من sizesData
      const sizeInfo = sizesData.find(s => s.name === sz);
      const sizeId = sizeInfo?.id || null;
      
      console.log('🔑 size_id للمقاس:', sizeId);

      // إنشاء سجلات أسعار للمقاس الجديد للفئات الجديدة فقط
      const pricingInserts = newCategories.map(category => ({
        size: sz,
 size_id: sizeId, // إضافة size_id
        billboard_level: selectedLevel,
        customer_category: category,
        one_month: 0,
        '2_months': 0,
        '3_months': 0,
        '6_months': 0,
        full_year: 0,
        one_day: 0
      }));

      console.log('💰 إدراج أسعار جديدة:', pricingInserts.length, 'سجل');

      const { data, error } = await supabase
        .from('pricing')
        .upsert(pricingInserts, {
          onConflict: 'size,billboard_level,customer_category'
        })
        .select();

      if (error) {
        console.error('❌ خطأ في إضافة الأسعار:', error);
        toast.error(`حدث خطأ في إضافة المقاس: ${error.message}`);
        return;
      }

      console.log('✅ تم إضافة الأسعار بنجاح:', data?.length, 'سجل');

      // إعادة تحميل البيانات
      await loadData();
      
      setAddSizeOpen(false);
      setSelectedNewSize('');
      setNewSizeName('');
      toast.success(`تم إضافة المقاس ${sz} إلى قائمة الأسعار بنجاح`);
    } catch (error) {
      console.error('💥 خطأ في الاتصال بقاعدة البيانات:', error);
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
    const name = newDurationName.trim();
    const label = newDurationLabel.trim();
    const dbColumn = newDurationDbColumn.trim().toLowerCase().replace(/\s+/g, '_');
    
    if (!name || !label || !dbColumn) {
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
      setAddDurationOpen(false);
      resetDurationForm();
      toast.success('تم إضافة المدة بنجاح');
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  // تعديل مدة
  const updateDuration = async () => {
    if (!editingDuration) return;
    
    const name = newDurationName.trim();
    const label = newDurationLabel.trim();
    
    if (!name || !label) {
      toast.error('يرجى ملء جميع الحقول المطلوبة');
      return;
    }

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
      setEditDurationOpen(false);
      setEditingDuration(null);
      resetDurationForm();
      toast.success('تم تعديل المدة بنجاح');
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  // حذف مدة
  const deleteDuration = async () => {
    if (!deletingDuration) return;

    try {
      const { error } = await supabase
        .from('pricing_durations')
        .delete()
        .eq('id', deletingDuration.id);

      if (error) {
        console.error('خطأ في حذف المدة:', error);
        toast.error('حدث خطأ في حذف المدة');
        return;
      }

      await loadData();
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
    setNewDurationDbColumn(duration.db_column);
    setEditDurationOpen(true);
  };

  // فتح نافذة حذف المدة
  const openDeleteDuration = (duration: PricingDuration) => {
    setDeletingDuration(duration);
    setDeleteDurationOpen(true);
  };

  // إعادة تعيين نموذج المدة
  const resetDurationForm = () => {
    setNewDurationName('');
    setNewDurationLabel('');
    setNewDurationDays(30);
    setNewDurationMonths(1);
    setNewDurationOrder(durations.length + 1);
    setNewDurationDbColumn('');
  };

  // الحصول على المقاسات للمستوى المحدد مع الترتيب حسب sort_order
  const sizesForLevel = useMemo(() => {
    // الحصول على المقاسات من جدول الأسعار للمستوى المحدد
    const levelSizes = Array.from(new Set(
      pricingData
        .filter(p => p.billboard_level === selectedLevel)
        .map(p => p.size)
    ));
    
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
  }, [selectedLevel, sizeFilter, pricingData, sizesData]);

  // الحصول على جميع المقاسات من جدول الأسعار
  const allSizes = useMemo(() => {
    return Array.from(new Set(pricingData.map(p => p.size)));
  }, [pricingData]);

  // الحصول على المقاسات المتاحة للإضافة - من جميع المقاسات الموجودة في النظام
  const availableSizesForLevel = useMemo(() => {
    console.log('🔍 بدء حساب المقاسات المتاحة للمستوى:', selectedLevel);
    
    // المقاسات الموجودة في قائمة الأسعار للمستوى الحالي
    const currentLevelSizes = Array.from(new Set(
      pricingData
        .filter(p => p.billboard_level === selectedLevel)
        .map(p => p.size)
    ));
    
    console.log('📊 المقاسات الموجودة في قائمة الأسعار للمستوى', selectedLevel, ':', currentLevelSizes);
    
    // جميع المقاسات الموجودة في النظام (من جدول الأسعار + جدول sizes)
    const allAvailableSizes = Array.from(new Set([
      ...pricingData.map(p => p.size),
      ...sizesData.map(s => s.name) // إضافة المقاسات من جدول sizes
    ]));
    
    console.log('📏 جميع المقاسات الموجودة في النظام:', allAvailableSizes);
    
    // المقاسات غير الموجودة في قائمة الأسعار للمستوى الحالي
    const availableSizes = allAvailableSizes.filter(size => !currentLevelSizes.includes(size));
    
    console.log('✅ المقاسات المتاحة للإضافة:', availableSizes);
    
    return availableSizes;
  }, [pricingData, sizesData, selectedLevel]);

  // عرض جميع الفئات (أصبحت عامة لجميع المستويات)
  const otherCategories = useMemo(() => {
    console.log('🔍 جميع الفئات المحملة:', categories);
    
    // جميع الفئات متاحة لجميع المستويات
    const allCategories = categories.map(c => c.name);
    
    // إزالة التكرار
    const uniqueCategories = Array.from(new Set(allCategories));
    
    console.log('📋 الفئات المتاحة:', uniqueCategories);
    return uniqueCategories;
  }, [categories]);

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
        const value = (dbRow as any)[monthOption.dbColumn];
        return normalize(value);
      }
    }
    
    return null;
  };

  const setVal = async (size: string, customer: string, month: MonthKeyAll, value: number | null) => {
    try {
      const monthOption = MONTH_OPTIONS.find(m => m.key === month);
      if (!monthOption) return;

      // ✅ الحصول على size_id من sizesData
      const sizeInfo = sizesData.find(s => s.name === size);
      const sizeId = sizeInfo?.id || null;
      
      console.log('💾 حفظ السعر:', { size, sizeId, customer, month, value });

      // البحث عن السجل الموجود
      const existingRow = pricingData.find(p => 
        p.size === size && 
        p.billboard_level === selectedLevel && 
        p.customer_category === customer
      );

      const updateData = {
        [monthOption.dbColumn]: value || 0,
 size_id: sizeId // إضافة size_id عند التحديث
      };

      if (existingRow) {
        // تحديث السجل الموجود
        const { error } = await supabase
          .from('pricing')
          .update(updateData as any)
          .eq('id', existingRow.id);

        if (error) {
          console.error('خطأ في تحديث السعر:', error);
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
        // إنشاء سجل جديد مع size_id
        const newRow = {
          size,
 size_id: sizeId, // إضافة size_id عند الإنشاء
          billboard_level: selectedLevel,
          customer_category: customer,
          one_month: monthOption.dbColumn === 'one_month' ? (value || 0) : 0,
          '2_months': monthOption.dbColumn === '2_months' ? (value || 0) : 0,
          '3_months': monthOption.dbColumn === '3_months' ? (value || 0) : 0,
          '6_months': monthOption.dbColumn === '6_months' ? (value || 0) : 0,
          full_year: monthOption.dbColumn === 'full_year' ? (value || 0) : 0,
          one_day: monthOption.dbColumn === 'one_day' ? (value || 0) : 0
        };

        console.log('➕ إضافة سجل جديد:', newRow);

        const { data, error } = await supabase
          .from('pricing')
          .insert([newRow])
          .select()
          .single();

        if (error) {
          console.error('خطأ في إضافة السعر:', error);
          toast.error(`حدث خطأ في إضافة السعر: ${error.message}`);
          return;
        }

        // إضافة السجل الجديد للبيانات المحلية
        setPricingData(prev => [...prev, data]);
      }

      toast.success('تم حفظ السعر بنجاح');
    } catch (error) {
      console.error('خطأ في الاتصال بقاعدة البيانات:', error);
      toast.error('حدث خطأ في الاتصال بقاعدة البيانات');
    }
  };

  const priceFor = (size: string, customer: string): string => {
    const v = getVal(size, customer, selectedMonthKey);
    return v == null ? '—' : `${v.toLocaleString()} د.ل`;
  };

  const buildPrintHtml = (cat: string, logoSrc: string, levelFilter: string, showLevel: boolean, theme: 'dark' | 'light' = 'dark') => {
    const cats = [cat]; // Always use single category
    const today = new Date().toLocaleDateString('ar-LY');
    
    // إنشاء خريطة لـ sort_order من جدول sizes
    const sizeOrderMap = new Map<string, number>();
    sizesData.forEach(s => {
      sizeOrderMap.set(s.name, s.sort_order ?? 999);
    });
    
    // تحديد المستويات المطلوب طباعتها
    const levelsToShow = levelFilter === 'all' ? allLevels : [levelFilter];
    
    // جمع جميع المقاسات من المستويات المحددة
    const allUniqueSizes = Array.from(new Set(
      pricingData
        .filter(p => p.size && p.size.trim() !== '' && (levelFilter === 'all' || p.billboard_level === levelFilter))
        .map(p => p.size)
    )).sort((a, b) => {
      const orderA = sizeOrderMap.get(a) ?? 999;
      const orderB = sizeOrderMap.get(b) ?? 999;
      return orderA - orderB;
    });
    
    // إنشاء صفحات منفصلة لكل مستوى
    const levelPages = levelsToShow.map((level, levelIndex) => {
      const levelInfo = levels.find(l => l.level_code === level);
      
      // الحصول على السعر لمستوى معين
      const getPriceForLevel = (size: string, customer: string, month: MonthKey): number | null => {
        const dbRow = pricingData.find(p => 
          p.size === size && 
          p.billboard_level === level && 
          p.customer_category === customer
        );
        
        if (dbRow) {
          const monthOption = MONTH_OPTIONS.find(m => m.key === month);
          if (monthOption) {
            const value = (dbRow as any)[monthOption.dbColumn];
            return normalize(value);
          }
        }
        
        return null;
      };

      // المقاسات لهذا المستوى
      const sizesForThisLevel = allUniqueSizes.filter(size => 
        pricingData.some(p => p.size === size && p.billboard_level === level)
      );

      // إنشاء صفوف الجدول لكل مقاس مع جميع الفترات (بما في ذلك اليومي)
      const rows = sizesForThisLevel.map(size => {
        return `
          <tr>
            <td class="size-cell">${size}</td>
            ${showLevel ? `<td class="level-cell">${levelInfo?.level_name || level}</td>` : ''}
            ${MONTH_OPTIONS.map(monthOpt => {
              const v = getPriceForLevel(size, cats[0], monthOpt.key);
              const price = v == null ? '0' : `${Number(v).toLocaleString('ar-LY')}`;
              return `<td class="price-cell">${price}</td>`;
            }).join('')}
          </tr>
        `;
      }).join('');

      return `
        <div class="page ${levelIndex > 0 ? 'page-break' : ''}">
          <div class="page-content">
            <div class="header">
              ${logoSrc ? `<div class="logo-area">
                <img src="${logoSrc}" class="logo" alt="شعار" onerror="this.style.display='none'" />
              </div>` : ''}
              <div class="title-area" style="${!logoSrc ? 'text-align: center; width: 100%;' : ''}">
                <h1 class="main-title">قائمة الأسعار</h1>
                <div class="subtitle">المستوى ${levelInfo?.level_name || level}</div>
              </div>
            </div>
            
            <table class="prices-table">
              <thead>
                <tr>
                  <th class="size-header">المقاس</th>
                  ${showLevel ? '<th class="level-header">المستوى</th>' : ''}
                  <th>شهر</th>
                  <th>شهرين</th>
                  <th>3 أشهر</th>
                  <th>6 أشهر</th>
                  <th>سنة</th>
                  <th>يومي</th>
                </tr>
              </thead>
              <tbody>
                ${rows}
              </tbody>
            </table>
            
            <div class="footer">
              <div class="footer-left">${today}</div>
              <div class="footer-center">الأسعار بالدينار الليبي وقابلة للتغيير</div>
              <div class="footer-note">السعر لا يشمل الطباعة ويشمل التركيب فقط</div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <base href="${window.location.origin}/">
  <title>قائمة الأسعار</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
    }
    
    body {
      font-family: 'Cairo', sans-serif;
      background: ${theme === 'dark' ? '#1a1a1a' : '#ffffff'};
    }

    .page {
      width: 210mm;
      height: 297mm;
      margin: 0 auto 20px;
      position: relative;
      background: ${theme === 'dark' 
        ? 'linear-gradient(145deg, #0d0d0d 0%, #1a1a1a 30%, #252525 60%, #1f1f1f 100%)' 
        : 'linear-gradient(145deg, #ffffff 0%, #f8f9fa 30%, #f0f2f5 60%, #fafafa 100%)'};
      overflow: hidden;
    }

    .page::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; bottom: 0;
      ${theme === 'dark' ? `background-image: url('data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><circle cx="20" cy="20" r="1" fill="%23ffffff05"/><circle cx="80" cy="40" r="0.5" fill="%23ffffff03"/></svg>');` : ''}
      background-size: 100px 100px;
      pointer-events: none;
    }

    .page-break { page-break-before: always; }

    .page-content {
      position: relative; z-index: 1;
      padding: 18mm 12mm 15mm;
      height: 100%; display: flex; flex-direction: column;
    }

    .header {
      display: flex; align-items: center; justify-content: space-between;
      margin-bottom: 12mm; padding-bottom: 6mm;
      border-bottom: 2px solid ${theme === 'dark' ? 'rgba(212, 175, 55, 0.3)' : 'rgba(180, 140, 20, 0.3)'};
    }

    .logo-area { width: 90mm; }
    .logo { width: 85mm; height: auto; }
    .title-area { text-align: left; }

    .main-title {
      font-size: 28pt; font-weight: 800;
      ${theme === 'dark' 
        ? 'background: linear-gradient(135deg, #d4af37 0%, #f4d03f 50%, #d4af37 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;'
        : 'color: #8B6914;'}
      margin-bottom: 2mm; letter-spacing: 2px;
    }

    .subtitle {
      font-size: 16pt; font-weight: 700;
      color: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.9)' : '#444444'};
    }

    .prices-table {
      width: 100%; border-collapse: separate; border-spacing: 0; flex: 1;
      background: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.01)'};
      border-radius: 8px; overflow: hidden;
      border: 1px solid ${theme === 'dark' ? 'rgba(212, 175, 55, 0.25)' : 'rgba(180, 140, 20, 0.25)'};
    }

    .prices-table thead {
      background: ${theme === 'dark' 
        ? 'linear-gradient(135deg, rgba(212, 175, 55, 0.18) 0%, rgba(212, 175, 55, 0.1) 100%)' 
        : 'linear-gradient(135deg, rgba(180, 140, 20, 0.1) 0%, rgba(180, 140, 20, 0.05) 100%)'};
    }

    .prices-table th {
      padding: 3.5mm 2mm; font-size: 9pt; font-weight: 700;
      color: ${theme === 'dark' ? '#d4af37' : '#8B6914'};
      text-align: center;
      border-bottom: 2px solid ${theme === 'dark' ? 'rgba(212, 175, 55, 0.35)' : 'rgba(180, 140, 20, 0.3)'};
      letter-spacing: 0.5px;
    }

    .prices-table th.size-header { text-align: right; padding-right: 4mm; width: 20%; }

    .prices-table td {
      padding: 2.5mm 1.5mm; text-align: center;
      border-bottom: 1px solid ${theme === 'dark' ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.06)'};
      font-size: 10pt;
      color: ${theme === 'dark' ? '#ffffff' : '#333333'};
    }

    .prices-table tr:nth-child(even) td {
      background: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.015)' : 'rgba(0, 0, 0, 0.02)'};
    }

    .prices-table tr:hover td {
      background: ${theme === 'dark' ? 'rgba(212, 175, 55, 0.06)' : 'rgba(180, 140, 20, 0.06)'};
    }

    .size-cell {
      font-weight: 800; font-size: 11pt; text-align: right !important; padding-right: 4mm !important;
      color: ${theme === 'dark' ? '#d4af37' : '#8B6914'} !important;
    }

    .level-cell {
      font-weight: 700; font-size: 10pt; text-align: center;
      color: ${theme === 'dark' ? '#d4af37' : '#8B6914'} !important;
      background: ${theme === 'dark' ? 'rgba(212, 175, 55, 0.08)' : 'rgba(180, 140, 20, 0.06)'};
    }

    .level-header { text-align: center; width: 12%; }

    .price-cell {
      font-weight: 600; font-size: 10pt; direction: ltr;
      color: ${theme === 'dark' ? '#e8e8e8' : '#333333'};
    }

    .footer {
      display: flex; justify-content: space-between; align-items: center;
      margin-top: 8mm; padding-top: 4mm;
      border-top: 1px solid ${theme === 'dark' ? 'rgba(212, 175, 55, 0.2)' : 'rgba(180, 140, 20, 0.2)'};
      font-size: 8pt;
      color: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0, 0, 0, 0.4)'};
    }

    .footer-center {
      color: ${theme === 'dark' ? 'rgba(212, 175, 55, 0.7)' : 'rgba(140, 105, 20, 0.8)'};
      font-weight: 600;
    }

    .footer-note {
      color: ${theme === 'dark' ? 'rgba(255, 255, 255, 0.7)' : 'rgba(0, 0, 0, 0.5)'};
      font-weight: 600; font-size: 8pt; text-align: left;
    }

    .print-btn {
      position: fixed; bottom: 30px; left: 50%; transform: translateX(-50%);
      padding: 14px 35px;
      background: linear-gradient(135deg, #d4af37 0%, #f4d03f 100%);
      color: #1a1a1a; border: none; border-radius: 10px;
      font-weight: 700; cursor: pointer; font-size: 16px;
      font-family: 'Cairo', sans-serif;
      box-shadow: 0 4px 20px rgba(212, 175, 55, 0.4); z-index: 1000;
    }

    .print-btn:hover {
      transform: translateX(-50%) translateY(-2px);
      box-shadow: 0 6px 25px rgba(212, 175, 55, 0.5);
    }

    @media print {
      body { background: ${theme === 'dark' ? '#0d0d0d' : '#ffffff'}; }
      .page { width: 100%; height: 100vh; margin: 0; box-shadow: none; }
      .print-btn { display: none !important; }
      .page-break { page-break-before: always; }
      @page { size: A4 portrait; margin: 0; }
    }
  </style>
</head>
<body>
  ${levelPages}
 <button class="print-btn" onclick="window.print()">️ طباعة القائمة</button>
</body>
</html>`;
  };

  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;

    // تحديد مصدر الشعار المحدد
    const logoToUse = printLogo || '';
    w.document.write(buildPrintHtml(printCategory, logoToUse, printLevel, showLevelColumn, printTheme));
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 800);
  };

  // تصدير الأسعار لفئة معينة إلى Excel - يشمل جميع المستويات
  const exportCategoryToExcel = (cat: string, markupPercent: number = 0) => {
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
      const targetLevels = printLevel === 'all' ? allLevels : [printLevel];
      
      targetLevels.forEach(level => {
        // الحصول على المقاسات المتوفرة لهذا المستوى
        const levelSizes = Array.from(new Set(
          pricingData
            .filter(p => p.billboard_level === level)
            .map(p => p.size)
        )).sort();
        
        if (levelSizes.length === 0) return;
        
        MONTH_OPTIONS.forEach(monthOpt => {
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
                const value = (dbRow as any)[monthOpt.dbColumn];
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
      const catName = cat === PRIMARY_SENTINEL ? 'الأساسية' : cat;
      const markupSuffix = markupPercent > 0 ? `_زيادة${markupPercent}%` : '';
      const levelSuffix = printLevel === 'all' ? 'جميع_المستويات' : printLevel;
      const filename = `أسعار_${catName}_${levelSuffix}${markupSuffix}_${dateStr}.xlsx`;

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
    
    const targetLevels = printLevel === 'all' ? allLevels : [printLevel];
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
          const originalPrice = normalize((dbRow as any)[monthOpt.dbColumn]) ?? 0;
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
 <div className="text-red-500 text-lg mb-4">️ خطأ في الاتصال بقاعدة البيانات</div>
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
    <div className="expenses-container">
      <Card className="bg-gradient-to-br from-card to-primary/10 border-0 shadow-lg">
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl text-primary">قائمة الأسعار</CardTitle>
              <p className="text-muted-foreground text-sm">
                إدارة أسعار اللوحات الإعلانية حسب المستوى والفئة
                <span className="ml-2 text-xs text-primary/70">
                  ({levels.length} مستوى، {categories.length} فئة، {allSizes.length} مقاس)
                </span>
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              {MONTH_OPTIONS.map(opt => (
                <button
                  key={`m-${opt.key}`}
                  className={`px-3 py-1.5 rounded-lg text-sm border transition-all duration-200 ${selectedMonthKey === opt.key ? 'bg-primary text-primary-foreground border-primary shadow-lg' : 'bg-background text-foreground border-border hover:bg-muted'}`}
                  onClick={() => setSelectedMonthKey(opt.key)}
                >
                  {opt.months === 1 ? 'شهرياً' : opt.months === 0 ? 'يومي' : opt.label}
                </button>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  resetDurationForm();
                  setNewDurationOrder(durations.length + 1);
                  setAddDurationOpen(true);
                }}
                title="إضافة مدة جديدة"
              >
                <Plus className="h-4 w-4" />
              </Button>
              {durations.length > 0 && (
                <Select 
                  value="" 
                  onValueChange={(val) => {
                    const duration = durations.find(d => d.id === val);
                    if (duration) openEditDuration(duration);
                  }}
                >
                  <SelectTrigger className="w-36">
                    <SelectValue placeholder="تعديل المدد" />
                  </SelectTrigger>
                  <SelectContent>
                    {durations.sort((a, b) => a.sort_order - b.sort_order).map(d => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.name} ({d.days} يوم)
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <div className="mx-2 h-6 w-px bg-border" />
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setPrintOpen(true)}>
                <Printer className="h-4 w-4 ml-2" /> طباعة الأسعار
              </Button>
              <Button 
                variant="outline" 
                onClick={updateMissingSizeIds}
                disabled={isUpdatingSizeIds}
                title="تحديث size_id للأسعار القديمة"
              >
                {isUpdatingSizeIds ? (
                  <span className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    جاري التحديث...
                  </span>
                ) : (
                  'تحديث size_id'
                )}
              </Button>
            </div>
          </div>

          {/* شريط الفئات المنفصل */}
          <div className="flex items-center gap-3 bg-muted/30 rounded-xl px-4 py-3 border border-border/50">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <Select
                value={otherCustomer}
                onValueChange={(val) => setOtherCustomer(val)}
              >
                <SelectTrigger className="w-44 h-9 bg-background border-border">
                  <SelectValue placeholder="اختر الفئة" />
                </SelectTrigger>
                <SelectContent>
                  <div className="px-2 pb-2 pt-1">
                    <Input
                      type="text"
 placeholder=" بحث..."
                      value={categorySearchTerm}
                      onChange={(e) => setCategorySearchTerm(e.target.value)}
                      className="h-7 text-xs"
                      onClick={(e) => e.stopPropagation()}
                      onKeyDown={(e) => e.stopPropagation()}
                    />
                  </div>
                  <SelectItem value={PRIMARY_SENTINEL}>
                    <span className="font-semibold">الأساسية</span>
                    <span className="text-muted-foreground text-xs mr-1">(عادي، مسوق، شركات)</span>
                  </SelectItem>
                  {otherCategories
                    .filter(c => !categorySearchTerm || c.includes(categorySearchTerm))
                    .map((c, index) => (
                      <SelectItem key={`cat-select-${index}-${c}`} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>

              <span className="text-xs text-muted-foreground whitespace-nowrap">
                الفئة الحالية:
              </span>
              <span className="text-sm font-bold text-primary whitespace-nowrap">
                {otherCustomer === PRIMARY_SENTINEL ? 'الأساسية' : otherCustomer}
              </span>

              {otherCustomer !== PRIMARY_SENTINEL && otherCategories.includes(otherCustomer) && (
                <div className="flex items-center gap-1 mr-2">
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7"
                    onClick={() => openEditCategory(otherCustomer)}
                    title="تعديل الفئة"
                  >
                    <Edit2 className="h-3.5 w-3.5" />
                  </Button>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive"
                    onClick={() => openDeleteCategory(otherCustomer)}
                    title="حذف الفئة"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" onClick={() => setAddCatOpen(true)}>
                <Plus className="h-3.5 w-3.5 ml-1" /> إضافة فئة
              </Button>
              <Button variant="outline" size="sm" onClick={() => setAddSizeOpen(true)}>
                <Plus className="h-3.5 w-3.5 ml-1" /> إضافة مقاس
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between bg-gradient-to-r from-blue-50/20 to-primary/10 border border-primary/20 rounded-xl px-4 py-3">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-2 bg-primary text-primary-foreground font-semibold rounded-lg px-3 py-1 shadow-lg">
                مستوى {levels.find(l => l.level_code === selectedLevel)?.level_name || selectedLevel}
              </span>
              <span className="text-sm text-muted-foreground">
                أسعار الأحجام حسب فئة العميل ({sizesForLevel.length} مقاس، {otherCategories.length} فئة إضافية)
              </span>
            </div>
            <div className="flex items-center gap-2">
              {allLevels.map((lvl, index) => {
                const levelInfo = levels.find(l => l.level_code === lvl);
                return (
                  <div key={`lvl-${index}-${lvl}`} className="relative group">
                    <button
                      onClick={() => setSelectedLevel(lvl)}
                      className={`px-3 py-1.5 rounded-lg text-sm border transition-all duration-200 ${lvl === selectedLevel ? 'bg-primary text-primary-foreground border-primary shadow-lg' : 'bg-background text-foreground border-border hover:bg-muted'}`}
                      title={`${levelInfo?.level_name || lvl} (ترتيب: ${levelInfo?.sort_order || '-'})`}
                    >
                      {lvl}
                      {levelInfo?.sort_order && (
                        <span className="text-[10px] opacity-60 mr-1">({levelInfo.sort_order})</span>
                      )}
                    </button>
                    {lvl === selectedLevel && levelInfo && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          openEditLevel(levelInfo);
                        }}
                        className="absolute -top-1 -right-1 bg-amber-500 text-white rounded-full p-0.5 opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        title="تعديل المستوى"
                      >
                        <Edit2 className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                );
              })}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setNewLevelOrder(Math.max(...levels.map(l => l.sort_order), 0) + 1);
                  setAddLevelOpen(true);
                }}
                title="إضافة مستوى جديد"
                className="text-green-600 hover:text-green-700"
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const levelInfo = levels.find(l => l.level_code === selectedLevel);
                  if (levelInfo) {
                    openEditLevel(levelInfo);
                  }
                }}
                title="تعديل المستوى المحدد"
                className="text-amber-500 hover:text-amber-700"
              >
                <Edit2 className="h-4 w-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setDeletingLevel(selectedLevel);
                  setDeleteLevelOpen(true);
                }}
                title="حذف المستوى"
                className="text-red-500 hover:text-red-700"
              >
                <Minus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <MultiSelect 
              options={allSizes.map((s, index) => ({ label: s, value: s }))} 
              value={sizeFilter} 
              onChange={setSizeFilter} 
              placeholder="تصفية الأحجام" 
            />
          </div>

          <div className="expenses-table-container">
            <table className="w-full text-sm text-right">
              <thead>
                <tr className="bg-muted/20 border-b border-border/30">
                  {(otherCustomer === PRIMARY_SENTINEL ? PRIMARY_CUSTOMERS : [otherCustomer]).map((c, index) => (
                    <th key={`head-${index}-${c}`} className="p-3 font-medium text-primary">{c}</th>
                  ))}
                  <th className="p-3 text-center w-32 bg-muted/20 font-medium text-primary">الحجم</th>
                </tr>
              </thead>
              <tbody>
                {sizesForLevel.map((size, sizeIndex) => (
                  <tr key={`size-${sizeIndex}-${size}`} className="border-b border-border/20 hover:bg-background/50">
                    {(otherCustomer === PRIMARY_SENTINEL ? PRIMARY_CUSTOMERS : [otherCustomer]).map((c, customerIndex) => {
                      const isEditing = editing && editing.size === size && editing.customer === c && editing.month === selectedMonthKey;
                      const current = getVal(size, c, selectedMonthKey);
                      return (
                        <td key={`col-${sizeIndex}-${customerIndex}-${c}`} className="p-3">
                          {isEditing ? (
                            <input
                              autoFocus
                              type="number"
                              className="w-24 rounded-md border px-2 py-1 bg-background"
                              defaultValue={current ?? ''}
                              onBlur={(e) => { 
                                const v = e.target.value.trim(); 
                                setVal(size, c, selectedMonthKey, v === '' ? null : Number(v)); 
                                setEditing(null); 
                              }}
                              onKeyDown={(e) => { 
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); 
                                if (e.key === 'Escape') setEditing(null); 
                              }}
                            />
                          ) : (
                            <button 
                              className="text-right w-full text-foreground hover:bg-muted/50 rounded px-2 py-1" 
                              onClick={() => setEditing({ size, customer: c, month: selectedMonthKey })}
                            >
                              {priceFor(size, c)}
                            </button>
                          )}
                        </td>
                      );
                    })}
                    <td className="p-3 text-center font-semibold bg-muted/20">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-primary font-bold">{size}</span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-500 hover:text-red-700 p-1 h-6 w-6"
                          onClick={() => {
                            setDeletingSize(size);
                            setDeleteSizeOpen(true);
                          }}
                          title="حذف المقاس من قائمة الأسعار"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

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
 ️ تحذير: سيتم حذف جميع المقاسات والأسعار والفئات المرتبطة بهذا المستوى نهائياً ولا يمكن التراجع عن هذا الإجراء.
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
        <UIDialog.DialogContent>
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>تأكيد حذف المقاس</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              هذا الإجراء لا يمكن التراجع عنه
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <div className="py-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              هل أنت متأكد من حذف المقاس <strong>"{deletingSize}"</strong> من قائمة الأسعار للمستوى <strong>"{selectedLevel}"</strong>؟ 
            </p>
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
              <p className="text-sm text-red-600 dark:text-red-400">
 ️ تحذير: سيتم حذف جميع الأسعار المرتبطة بهذا المقاس في هذا المستوى نهائياً ولا يمكن التراجع عن هذا الإجراء.
              </p>
            </div>
          </div>
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={()=>setDeleteSizeOpen(false)}>إلغاء</Button>
            <Button variant="destructive" onClick={deleteSize}>حذف نهائياً</Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* نافذة الطباعة */}
      <UIDialog.Dialog open={printOpen} onOpenChange={setPrintOpen}>
        <UIDialog.DialogContent className="max-w-lg">
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>طباعة الأسعار</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              اختر الفئة والمستوى وخيارات العرض
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <div className="grid gap-4 max-h-[70vh] overflow-y-auto pr-1">
            {/* وضع الطباعة */}
            <div>
              <label className="text-sm font-medium mb-2 block">وضع الطباعة</label>
              <div className="flex gap-2">
                <Button
                  variant={printTheme === 'light' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPrintTheme('light')}
                >
 ️ فاتح (مناسب للطباعة)
                </Button>
                <Button
                  variant={printTheme === 'dark' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPrintTheme('dark')}
                >
 غامق
                </Button>
              </div>
            </div>

            {/* اختيار الشعار */}
            <div className="border-t border-border pt-4">
              <label className="text-sm font-medium mb-2 block">الشعار</label>
              <div className="grid grid-cols-4 gap-2">
                {AVAILABLE_LOGOS.map((logo, index) => (
                  <button
                    key={`logo-${index}`}
                    onClick={() => setPrintLogo(logo.src)}
                    className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-all ${
                      printLogo === logo.src
                        ? 'border-primary bg-primary/10 shadow-sm'
                        : 'border-border bg-muted/30 hover:border-primary/50 hover:bg-muted/60'
                    }`}
                  >
                    {logo.src ? (
                      <img src={logo.src} alt={logo.label} className="h-8 w-auto object-contain" />
                    ) : (
 <div className="h-8 flex items-center justify-center text-muted-foreground text-lg"></div>
                    )}
                    <span className="text-[10px] text-muted-foreground leading-tight text-center">{logo.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* اختيار الفئة مع بحث */}
            <div className="border-t border-border pt-4">
              <label className="text-sm font-medium mb-2 block">الفئة السعرية</label>
              <Input
                type="text"
 placeholder=" ابحث عن الفئة..."
                value={printCategorySearch}
                onChange={(e) => setPrintCategorySearch(e.target.value)}
                className="h-8 text-sm mb-2"
              />
              <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
                {[...PRIMARY_CUSTOMERS, ...otherCategories]
                  .filter(c => !printCategorySearch || c.includes(printCategorySearch))
                  .map((c, index) => (
                    <button
                      key={`print-cat-${index}-${c}`}
                      onClick={() => { setPrintCategory(c); setPrintCategorySearch(''); }}
                      className={`px-2.5 py-1 rounded-full text-xs font-medium transition-all border ${
                        printCategory === c
                          ? 'bg-primary text-primary-foreground border-primary shadow-sm'
                          : 'bg-muted/50 text-foreground border-border hover:bg-muted'
                      }`}
                    >
                      {c}
                    </button>
                  ))}
              </div>
            </div>

            {/* اختيار المستوى */}
            <div className="border-t pt-4">
              <label className="text-sm font-medium mb-2 block">المستوى</label>
              <div className="flex flex-wrap gap-2">
                <Button 
                  variant={printLevel === 'all' ? "default" : "outline"}
                  size="sm"
                  onClick={() => setPrintLevel('all')}
                >
                  جميع المستويات
                </Button>
                {allLevels.map((lvl, index) => {
                  const levelInfo = levels.find(l => l.level_code === lvl);
                  return (
                    <Button 
                      key={`print-level-${index}-${lvl}`}
                      variant={printLevel === lvl ? "default" : "outline"}
                      size="sm"
                      onClick={() => setPrintLevel(lvl)}
                    >
                      {levelInfo?.level_name || lvl}
                    </Button>
                  );
                })}
              </div>
            </div>

            {/* خيارات العرض */}
            <div className="border-t pt-4">
              <label className="text-sm font-medium mb-2 block">خيارات العرض</label>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={showLevelColumn}
                    onChange={(e) => setShowLevelColumn(e.target.checked)}
                    className="w-4 h-4 rounded border-border"
                  />
                  <span className="text-sm">إظهار عمود المستوى</span>
                </label>
              </div>
            </div>
            
            {/* زيادة الأسعار */}
            <div className="border-t pt-4">
              <label className="text-sm font-medium mb-2 block">زيادة الأسعار (%)</label>
              <div className="flex items-center gap-3">
                <Input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  value={priceMarkupPercent}
                  onChange={(e) => setPriceMarkupPercent(Number(e.target.value) || 0)}
                  className="w-24"
                  placeholder="0"
                />
                <span className="text-sm text-muted-foreground">النسبة المئوية للزيادة على الأسعار الأصلية</span>
              </div>
              
              {/* معاينة الأسعار مع الزيادة */}
              {priceMarkupPercent > 0 && previewPricesWithMarkup.length > 0 && (
                <div className="mt-3 bg-muted/30 rounded-lg p-3 border border-border/50">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-medium text-primary">معاينة الأسعار بعد الزيادة ({priceMarkupPercent}%)</span>
                    <span className="text-xs text-muted-foreground">عينة من الأسعار</span>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead>
                        <tr className="border-b border-border/30">
                          <th className="text-right py-1 px-2">المستوى</th>
                          <th className="text-right py-1 px-2">المقاس</th>
                          <th className="text-right py-1 px-2">الفترة</th>
                          <th className="text-right py-1 px-2">السعر الأصلي</th>
                          <th className="text-right py-1 px-2">السعر الجديد</th>
                          <th className="text-right py-1 px-2 text-green-600">الزيادة</th>
                        </tr>
                      </thead>
                      <tbody>
                        {previewPricesWithMarkup.map((item, idx) => (
                          <tr key={idx} className="border-b border-border/20">
                            <td className="py-1 px-2">{item.level}</td>
                            <td className="py-1 px-2">{item.size}</td>
                            <td className="py-1 px-2">{item.period}</td>
                            <td className="py-1 px-2 text-muted-foreground">{item.originalPrice.toLocaleString()}</td>
                            <td className="py-1 px-2 font-semibold text-primary">{item.newPrice.toLocaleString()}</td>
                            <td className="py-1 px-2 text-green-600 font-medium">+{item.increase.toLocaleString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
          <UIDialog.DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => { setPrintOpen(false); setPriceMarkupPercent(0); }}>إلغاء</Button>
            <Button variant="outline" onClick={() => exportCategoryToExcel(printCategory, priceMarkupPercent)}>
              <Download className="h-4 w-4 ml-2" />
              تحميل Excel {priceMarkupPercent > 0 && `(+${priceMarkupPercent}%)`}
            </Button>
            <Button onClick={handlePrint}>
              <Printer className="h-4 w-4 ml-2" />
              طباعة
            </Button>
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
 ️ تحذير: سيتم حذف جميع الأسعار المرتبطة بهذه الفئة نهائياً ولا يمكن التراجع عن هذا الإجراء.
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
            <UIDialog.DialogTitle>إضافة مقاس جديد</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              اختر مقاس موجود أو أدخل مقاس جديد لإضافته للمستوى {selectedLevel}
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
              <label className="expenses-form-label">أدخل مقاس جديد</label>
              <Input 
                placeholder="مثال: 15x6, 9x4, إلخ..." 
                value={newSizeName} 
                onChange={e=>setNewSizeName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground mt-1">
                سيتم إضافة هذا المقاس الجديد لجميع المستويات في النظام
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
        <UIDialog.DialogContent className="max-w-md">
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>إضافة مدة جديدة</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              أضف مدة زمنية جديدة لقائمة الأسعار
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">الاسم</label>
                <Input 
                  placeholder="مثال: 4 أشهر" 
                  value={newDurationName} 
                  onChange={e => setNewDurationName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">التسمية المختصرة</label>
                <Input 
                  placeholder="مثال: كل 4 أشهر" 
                  value={newDurationLabel} 
                  onChange={e => setNewDurationLabel(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">عدد الأيام</label>
                <Input 
                  type="number" 
                  min={1}
                  value={newDurationDays} 
                  onChange={e => setNewDurationDays(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">عدد الأشهر (للحساب)</label>
                <Input 
                  type="number" 
                  min={0}
                  step={0.5}
                  value={newDurationMonths} 
                  onChange={e => setNewDurationMonths(Number(e.target.value))}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">اسم العمود (بالإنجليزية)</label>
                <Input 
                  placeholder="مثال: 4_months" 
                  value={newDurationDbColumn} 
                  onChange={e => setNewDurationDbColumn(e.target.value)}
                />
                <p className="text-xs text-muted-foreground mt-1">يجب أن يكون فريداً</p>
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">الترتيب</label>
                <Input 
                  type="number" 
                  min={1}
                  value={newDurationOrder} 
                  onChange={e => setNewDurationOrder(Number(e.target.value))}
                />
              </div>
            </div>
          </div>
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={() => { setAddDurationOpen(false); resetDurationForm(); }}>إلغاء</Button>
            <Button onClick={addNewDuration} disabled={!newDurationName.trim() || !newDurationLabel.trim() || !newDurationDbColumn.trim()}>
              إضافة
            </Button>
          </UIDialog.DialogFooter>
        </UIDialog.DialogContent>
      </UIDialog.Dialog>

      {/* نافذة تعديل المدة */}
      <UIDialog.Dialog open={editDurationOpen} onOpenChange={setEditDurationOpen}>
        <UIDialog.DialogContent className="max-w-md">
          <UIDialog.DialogHeader>
            <UIDialog.DialogTitle>تعديل المدة</UIDialog.DialogTitle>
            <UIDialog.DialogDescription>
              تعديل بيانات المدة الزمنية
            </UIDialog.DialogDescription>
          </UIDialog.DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">الاسم</label>
                <Input 
                  placeholder="مثال: 4 أشهر" 
                  value={newDurationName} 
                  onChange={e => setNewDurationName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">التسمية المختصرة</label>
                <Input 
                  placeholder="مثال: كل 4 أشهر" 
                  value={newDurationLabel} 
                  onChange={e => setNewDurationLabel(e.target.value)}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="text-sm font-medium mb-1 block">عدد الأيام</label>
                <Input 
                  type="number" 
                  min={1}
                  value={newDurationDays} 
                  onChange={e => setNewDurationDays(Number(e.target.value))}
                />
              </div>
              <div>
                <label className="text-sm font-medium mb-1 block">عدد الأشهر (للحساب)</label>
                <Input 
                  type="number" 
                  min={0}
                  step={0.5}
                  value={newDurationMonths} 
                  onChange={e => setNewDurationMonths(Number(e.target.value))}
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-medium mb-1 block">الترتيب</label>
              <Input 
                type="number" 
                min={1}
                value={newDurationOrder} 
                onChange={e => setNewDurationOrder(Number(e.target.value))}
              />
            </div>
            <div className="bg-muted/50 rounded-lg p-3">
              <p className="text-sm text-muted-foreground">
                <strong>اسم العمود:</strong> {editingDuration?.db_column}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                لا يمكن تغيير اسم العمود بعد الإنشاء
              </p>
            </div>
          </div>
          <UIDialog.DialogFooter>
            <Button variant="outline" onClick={() => { setEditDurationOpen(false); setEditingDuration(null); resetDurationForm(); }}>إلغاء</Button>
            <Button onClick={updateDuration} disabled={!newDurationName.trim() || !newDurationLabel.trim()}>
              تحديث
            </Button>
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
 ️ ملاحظة: حذف المدة لن يؤثر على البيانات المحفوظة في قاعدة البيانات، لكنها لن تظهر في واجهة الأسعار.
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