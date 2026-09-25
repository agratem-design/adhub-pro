import { useAuth } from '@/contexts/AuthContext';
import { FactorValueEditor } from '@/components/pricing/FactorValueEditor';
import './PricingFactors.css';
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { 
  MapPin, Users, Calculator, Save, Plus, Edit2, Printer, 
  RefreshCw, Eye, LayoutGrid, Search, 
  TrendingUp, TrendingDown, Minus, Building2, SlidersHorizontal,
  HelpCircle, Info, Sparkles, ChevronDown, ChevronUp, Table as TableIcon,
  CheckCircle2, ArrowRight, FileText, Check
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

import logoFaresGoldSvgRaw from '@/assets/logofaresgold.svg?raw';

function svgTextToDataUri(svgText: string): string {
  const bytes = new TextEncoder().encode(svgText);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return `data:image/svg+xml;base64,${btoa(binary)}`;
}

const LOGO_FARES_GOLD_SRC = svgTextToDataUri(logoFaresGoldSvgRaw);

interface MunicipalityFactor {
  id: string;
  municipality_name: string;
  factor: number;
  description: string | null;
  is_active: boolean;
}

interface CategoryFactor {
  id: string;
  category_name: string;
  factor: number;
  description: string | null;
  is_active: boolean;
}

interface BasePrice {
  id: string;
  size_name: string;
  billboard_level: string;
  one_month: number;
  two_months: number;
  three_months: number;
  six_months: number;
  full_year: number;
  one_day: number;
}

interface SizeData {
  id: number;
  name: string;
  sort_order?: number;
}

// تصنيفات البلديات حسب الأهمية والكثافة
type MunicipalityTier = 'all' | 'tier1' | 'tier2' | 'tier3' | 'tier4' | 'tier5';

function getMunicipalityTier(factor: number): 'tier1' | 'tier2' | 'tier3' | 'tier4' | 'tier5' {
  if (factor >= 1.00) return 'tier1';
  if (factor >= 0.85) return 'tier2';
  if (factor >= 0.70) return 'tier3';
  if (factor >= 0.65) return 'tier4';
  return 'tier5';
}

function getTierName(factor: number): string {
  if (factor >= 1.00) return 'العاصمة ومراكز الثقل';
  if (factor >= 0.85) return 'الكثافة العالية والمحاور الكبرى';
  if (factor >= 0.70) return 'المدن الساحلية والتجارية';
  if (factor >= 0.65) return 'الضواحي والمدن المجاورة';
  return 'المدن الداخلية والمناطق الهادئة';
}

function getTierBadge(factor: number) {
  if (factor > 1.00) {
    const pct = Math.round((factor - 1) * 100);
    return {
      label: `زيادة +${pct}%`,
      className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30',
      icon: TrendingUp,
    };
  }
  if (factor < 1.00) {
    const pct = Math.round((1 - factor) * 100);
    return {
      label: `تخفيض -${pct}%`,
      className: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30',
      icon: TrendingDown,
    };
  }
  return {
    label: 'المعيار القياسي 1.00x',
    className: 'bg-muted text-muted-foreground border-border',
    icon: Minus,
  };
}

export default function PricingFactors() {
  const { canEdit: canEditAuth } = useAuth();
  const canEditSection = canEditAuth('pricing_factors');

  const [municipalityFactors, setMunicipalityFactors] = useState<MunicipalityFactor[]>([]);
  const [categoryFactors, setCategoryFactors] = useState<CategoryFactor[]>([]);
  const [basePrices, setBasePrices] = useState<BasePrice[]>([]);
  const [sizes, setSizes] = useState<SizeData[]>([]);
  const [loading, setLoading] = useState(true);

  // إظهار أو طي دليل النظام
  const [showGuide, setShowGuide] = useState(true);

  // طريقة عرض معاملات البلديات (جدول منظم أو بطاقات)
  const [munViewMode, setMunViewMode] = useState<'table' | 'cards'>('table');

  // المقاس والمستوى المعروض للمقارنة العملية في جدول البلديات (يمكن تغييره بسهولة)
  const [comparisonSize, setComparisonSize] = useState<string>('12x4');
  const [comparisonLevel, setComparisonLevel] = useState<string>('A');

  // البحث والفلترة
  const [search, setSearch] = useState('');
  const [priceLevel, setPriceLevel] = useState('all');
  const [selectedMunTier, setSelectedMunTier] = useState<MunicipalityTier>('all');

  // الآلة الحاسبة الذكية السريعة في الأعلى (الافتراضي: 12x4 في زليتن لفئة الشركات)
  const [calcSize, setCalcSize] = useState<string>('12x4');
  const [calcLevel, setCalcLevel] = useState<string>('A');
  const [calcMunicipality, setCalcMunicipality] = useState<string>('زليتن');
  const [calcCategory, setCalcCategory] = useState<string>('شركات');

  // فلاتر جدول معاينة المدينة (الافتراضي: زليتن)
  const [previewMunicipality, setPreviewMunicipality] = useState<string>('زليتن');
  const [previewCategory, setPreviewCategory] = useState<string>('شركات');

  // حالات الطباعة المنظمة (مثل قائمة الأسعار الرسمية)
  const [printDialogOpen, setPrintDialogOpen] = useState(false);
  const [printType, setPrintType] = useState<'all' | 'base_prices' | 'municipalities' | 'single_city'>('all');
  const [printCity, setPrintCity] = useState<string>('زليتن');
  const [printCategory, setPrintCategory] = useState<string>('شركات');
  const [printComparisonSize, setPrintComparisonSize] = useState<string>('12x4');

  // حالات التعديل
  const [editingMunicipality, setEditingMunicipality] = useState<MunicipalityFactor | null>(null);
  const [editingCategory, setEditingCategory] = useState<CategoryFactor | null>(null);
  const [editingBasePrice, setEditingBasePrice] = useState<BasePrice | null>(null);

  // حالات الإضافة
  const [addBasePriceOpen, setAddBasePriceOpen] = useState(false);
  const [newBasePrice, setNewBasePrice] = useState<Partial<BasePrice>>({
    size_name: '',
    billboard_level: 'A',
    one_month: 0,
    two_months: 0,
    three_months: 0,
    six_months: 0,
    full_year: 0,
    one_day: 0
  });

  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [newCategory, setNewCategory] = useState({ category_name: '', factor: 1.0, description: '' });

  const priceLevels = useMemo(() => {
    return Array.from(new Set(['A', 'B', ...basePrices.map(price => price.billboard_level)])).sort();
  }, [basePrices]);

  const availableSizeNames = useMemo(() => {
    const fromBase = Array.from(new Set(basePrices.map(b => b.size_name)));
    return fromBase.length > 0 ? fromBase : ['12x4', '10x4', '13x5', '8x3', '8X3-T', '6x3', '4x3', '3X8-T', 'سوسيت'];
  }, [basePrices]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [municipalitiesRes, categoriesRes, basePricesRes, sizesRes] = await Promise.all([
        supabase.from('municipality_factors').select('*').order('municipality_name'),
        supabase.from('category_factors').select('*').order('category_name'),
        supabase.from('base_prices').select('*').order('size_name'),
        supabase.from('sizes').select('id, name, sort_order').order('sort_order')
      ]);

      if (municipalitiesRes.data) setMunicipalityFactors(municipalitiesRes.data);
      if (categoriesRes.data) setCategoryFactors(categoriesRes.data);
      if (basePricesRes.data) setBasePrices(basePricesRes.data);
      if (sizesRes.data) setSizes(sizesRes.data);
    } catch (error) {
      console.error('Error loading data:', error);
      toast.error('فشل في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const matchesSearch = (name: string) => name.toLowerCase().includes(search.trim().toLowerCase());
  const matchesPrice = (price: BasePrice) => (priceLevel === 'all' || price.billboard_level === priceLevel) && matchesSearch(`${price.size_name} ${price.billboard_level}`);

  // السعر الأساسي للمقاس والمستوى المحدد للمقارنة
  const comparisonBasePrice = useMemo(() => {
    const bp = basePrices.find(b => b.size_name === comparisonSize && b.billboard_level === comparisonLevel)
      || basePrices.find(b => b.size_name === comparisonSize)
      || basePrices[0];
    return bp?.full_year || 65000;
  }, [basePrices, comparisonSize, comparisonLevel]);

  // الحساب المباشر للآلة الحاسبة الذكية لجميع الفترات
  const liveCalcResult = useMemo(() => {
    const bp = basePrices.find(b => b.size_name === calcSize && b.billboard_level === calcLevel) 
      || basePrices.find(b => b.size_name === calcSize)
      || basePrices[0];
    
    const mFactor = municipalityFactors.find(m => m.municipality_name === calcMunicipality)?.factor || 1.0;
    const cFactor = categoryFactors.find(c => c.category_name === calcCategory)?.factor || 1.0;
    const combinedMultiplier = Number((mFactor * cFactor).toFixed(4));

    const baseDaily = bp?.one_day || 0;
    const baseMonthly = bp?.one_month || 0;
    const baseTwoMonths = bp?.two_months || 0;
    const baseThreeMonths = bp?.three_months || 0;
    const baseSixMonths = bp?.six_months || 0;
    const baseYearly = bp?.full_year || 0;

    return {
      basePrice: bp,
      mFactor,
      cFactor,
      combinedMultiplier,
      baseDaily,
      baseMonthly,
      baseTwoMonths,
      baseThreeMonths,
      baseSixMonths,
      baseYearly,
      finalDaily: Math.round(baseDaily * combinedMultiplier),
      finalMonthly: Math.round(baseMonthly * combinedMultiplier),
      finalTwoMonths: Math.round(baseTwoMonths * combinedMultiplier),
      finalThreeMonths: Math.round(baseThreeMonths * combinedMultiplier),
      finalSixMonths: Math.round(baseSixMonths * combinedMultiplier),
      finalYearly: Math.round(baseYearly * combinedMultiplier),
    };
  }, [basePrices, municipalityFactors, categoryFactors, calcSize, calcLevel, calcMunicipality, calcCategory]);

  // حساب أسعار المعاينة لتبويب المدينة
  const filteredPrices = useMemo(() => {
    const targetMun = previewMunicipality || 'زليتن';
    const targetCat = previewCategory || 'شركات';
    const municipalityFactor = municipalityFactors.find(m => m.municipality_name === targetMun)?.factor || 1;
    const categoryFactor = categoryFactors.find(c => c.category_name === targetCat)?.factor || 1;
    const multiplier = municipalityFactor * categoryFactor;
    
    return basePrices.map(bp => ({
      ...bp,
      calculated_one_month: Math.round((bp.one_month || 0) * multiplier),
      calculated_two_months: Math.round((bp.two_months || 0) * multiplier),
      calculated_three_months: Math.round((bp.three_months || 0) * multiplier),
      calculated_six_months: Math.round((bp.six_months || 0) * multiplier),
      calculated_full_year: Math.round((bp.full_year || 0) * multiplier),
      calculated_one_day: Math.round((bp.one_day || 0) * multiplier),
    }));
  }, [basePrices, municipalityFactors, categoryFactors, previewMunicipality, previewCategory]);

  const currentPreviewMunFactor = municipalityFactors.find(m => m.municipality_name === (previewMunicipality || 'زليتن'))?.factor || 1;
  const currentPreviewCatFactor = categoryFactors.find(c => c.category_name === (previewCategory || 'شركات'))?.factor || 1;

  // حفظ معامل البلدية
  const saveMunicipalityFactor = async () => {
    if (!editingMunicipality) return;
    try {
      const { error } = await supabase
        .from('municipality_factors')
        .update({ 
          factor: editingMunicipality.factor,
          description: editingMunicipality.description 
        })
        .eq('id', editingMunicipality.id);

      if (error) throw error;
      toast.success('تم حفظ معامل البلدية بنجاح');
      setEditingMunicipality(null);
      loadData();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('فشل في الحفظ');
    }
  };

  // حفظ معامل الفئة
  const saveCategoryFactor = async () => {
    if (!editingCategory) return;
    try {
      const { error } = await supabase
        .from('category_factors')
        .update({ 
          factor: editingCategory.factor,
          description: editingCategory.description 
        })
        .eq('id', editingCategory.id);

      if (error) throw error;
      toast.success('تم حفظ معامل الفئة بنجاح');
      setEditingCategory(null);
      loadData();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('فشل في الحفظ');
    }
  };

  // حفظ السعر الأساسي
  const saveBasePrice = async () => {
    if (!editingBasePrice) return;
    try {
      const { error } = await supabase
        .from('base_prices')
        .update({
          one_month: editingBasePrice.one_month,
          two_months: editingBasePrice.two_months,
          three_months: editingBasePrice.three_months,
          six_months: editingBasePrice.six_months,
          full_year: editingBasePrice.full_year,
          one_day: editingBasePrice.one_day
        })
        .eq('id', editingBasePrice.id);

      if (error) throw error;
      toast.success('تم حفظ السعر الأساسي بنجاح');
      setEditingBasePrice(null);
      loadData();
    } catch (error) {
      console.error('Error saving:', error);
      toast.error('فشل في الحفظ');
    }
  };

  // إضافة سعر أساسي جديد
  const addNewBasePrice = async () => {
    if (!newBasePrice.size_name) {
      toast.error('يرجى اختيار المقاس');
      return;
    }
    if (basePrices.some(price => price.size_name === newBasePrice.size_name && price.billboard_level === newBasePrice.billboard_level)) {
      toast.error('يوجد سعر مسجل لهذا المقاس في المستوى المحدد');
      return;
    }
    
    try {
      const insertData = {
        size_name: newBasePrice.size_name!,
        billboard_level: newBasePrice.billboard_level || 'A',
        one_month: newBasePrice.one_month || 0,
        two_months: newBasePrice.two_months || 0,
        three_months: newBasePrice.three_months || 0,
        six_months: newBasePrice.six_months || 0,
        full_year: newBasePrice.full_year || 0,
        one_day: newBasePrice.one_day || 0
      };
      
      const { error } = await supabase.from('base_prices').insert([insertData]);
      if (error) throw error;
      
      toast.success('تمت إضافة السعر بنجاح');
      setAddBasePriceOpen(false);
      setNewBasePrice({
        size_name: '',
        billboard_level: 'A',
        one_month: 0,
        two_months: 0,
        three_months: 0,
        six_months: 0,
        full_year: 0,
        one_day: 0
      });
      loadData();
    } catch (error: any) {
      console.error('Error adding:', error);
      toast.error('فشل في الإضافة');
    }
  };

  // إضافة فئة جديدة
  const addNewCategory = async () => {
    if (!newCategory.category_name) {
      toast.error('يرجى إدخال اسم الفئة');
      return;
    }
    try {
      const { error } = await supabase.from('category_factors').insert([newCategory]);
      if (error) throw error;
      toast.success('تمت إضافة الفئة بنجاح');
      setAddCategoryOpen(false);
      setNewCategory({ category_name: '', factor: 1.0, description: '' });
      loadData();
    } catch (error: any) {
      console.error('Error adding:', error);
      toast.error('فشل في الإضافة');
    }
  };

  // إنشاء مستند الطباعة الاحترافي المنظم
  const buildPrintDocumentHtml = () => {
    const today = new Date().toLocaleDateString('ar-LY');
    const compBase = basePrices.find(b => b.size_name === printComparisonSize && b.billboard_level === 'A')?.full_year || 65000;

    // 1. جدول الأسعار الأساسية
    const baseRows = basePrices.map(bp => `
      <tr>
        <td style="font-weight: 800; text-align: right; padding: 6px 8px;">${bp.size_name} (مستوى ${bp.billboard_level})</td>
        <td style="text-align: center;">${Number(bp.one_month || 0).toLocaleString('ar-LY')} د.ل</td>
        <td style="text-align: center;">${Number(bp.two_months || 0).toLocaleString('ar-LY')} د.ل</td>
        <td style="text-align: center;">${Number(bp.three_months || 0).toLocaleString('ar-LY')} د.ل</td>
        <td style="text-align: center;">${Number(bp.six_months || 0).toLocaleString('ar-LY')} د.ل</td>
        <td style="text-align: center; font-weight: 800; color: #785b13; background: #fff8e6;">${Number(bp.full_year || 0).toLocaleString('ar-LY')} د.ل</td>
        <td style="text-align: center; color: #666;">${Number(bp.one_day || 0).toLocaleString('ar-LY')} د.ل</td>
      </tr>
    `).join('');

    // 2. جدول البلديات
    const munRows = municipalityFactors.map(m => {
      const pct = m.factor === 1 ? 'المعيار القياسي 1.00x' : m.factor > 1 ? `زيادة +${Math.round((m.factor - 1) * 100)}%` : `تخفيض -${Math.round((1 - m.factor) * 100)}%`;
      const dynamicPrice = Math.round(compBase * m.factor).toLocaleString('ar-LY');
      const isAnchor = m.municipality_name === 'زليتن';

      return `
        <tr ${isAnchor ? 'style="background: #fdf6e2; font-weight: bold;"' : ''}>
          <td style="padding: 6px 8px; text-align: right;">${m.municipality_name} ${isAnchor ? '(معيار 45k)' : ''}</td>
          <td style="text-align: center; font-weight: 800;">${m.factor}x</td>
          <td style="text-align: center;">${pct}</td>
          <td style="text-align: center; font-weight: 800; color: #785b13;">${dynamicPrice} د.ل</td>
          <td style="text-align: right; color: #555;">${m.description || getTierName(m.factor)}</td>
        </tr>
      `;
    }).join('');

    // 3. جدول فئات العملاء
    const catRows = categoryFactors.map(c => {
      const discount = c.factor === 1 ? 'السعر الكامل 100%' : c.factor < 1 ? `خصم ${Math.round((1 - c.factor) * 100)}%` : `زيادة +${Math.round((c.factor - 1) * 100)}%`;
      return `
        <tr>
          <td style="padding: 6px 8px; text-align: right; font-weight: 700;">${c.category_name}</td>
          <td style="text-align: center; font-weight: 800;">${c.factor}x</td>
          <td style="text-align: center;">${discount}</td>
          <td style="text-align: right; color: #555;">${c.description || 'معامل فئة مخصص'}</td>
        </tr>
      `;
    }).join('');

    // 4. جدول مدينة محددة
    const mFactorSingle = municipalityFactors.find(m => m.municipality_name === printCity)?.factor || 1;
    const cFactorSingle = categoryFactors.find(c => c.category_name === printCategory)?.factor || 1;
    const combinedSingle = Number((mFactorSingle * cFactorSingle).toFixed(4));

    const singleCityRows = basePrices.map(bp => {
      const p1m = Math.round((bp.one_month || 0) * combinedSingle).toLocaleString('ar-LY');
      const p2m = Math.round((bp.two_months || 0) * combinedSingle).toLocaleString('ar-LY');
      const p3m = Math.round((bp.three_months || 0) * combinedSingle).toLocaleString('ar-LY');
      const p6m = Math.round((bp.six_months || 0) * combinedSingle).toLocaleString('ar-LY');
      const p1y = Math.round((bp.full_year || 0) * combinedSingle).toLocaleString('ar-LY');
      const p1d = Math.round((bp.one_day || 0) * combinedSingle).toLocaleString('ar-LY');

      return `
        <tr>
          <td style="font-weight: 800; text-align: right; padding: 7px 8px;">${bp.size_name} (مستوى ${bp.billboard_level})</td>
          <td style="text-align: center;">${p1m} د.ل</td>
          <td style="text-align: center;">${p2m} د.ل</td>
          <td style="text-align: center;">${p3m} د.ل</td>
          <td style="text-align: center;">${p6m} د.ل</td>
          <td style="text-align: center; font-weight: 800; color: #785b13; background: #fff8e6;">${p1y} د.ل</td>
          <td style="text-align: center; color: #666;">${p1d} د.ل</td>
        </tr>
      `;
    }).join('');

    let contentHtml = '';

    if (printType === 'all') {
      contentHtml = `
        <div class="section-title">1. الأسعار الأساسية المعتمدة لجميع المقاسات (المستوى A والمستوى B المرن)</div>
        <table>
          <thead>
            <tr>
              <th style="width: 25%;">المقاس والمستوى</th>
              <th>شهر واحد</th>
              <th>شهرين</th>
              <th>3 أشهر</th>
              <th>6 أشهر</th>
              <th style="background: #eedfad;">سنة كاملة</th>
              <th>يومي</th>
            </tr>
          </thead>
          <tbody>${baseRows}</tbody>
        </table>

        <div class="section-title" style="margin-top: 20px;">2. معاملات المدن والبلديات (${municipalityFactors.length} بلدية رسمية)</div>
        <table>
          <thead>
            <tr>
              <th style="width: 25%;">المدينة / البلدية</th>
              <th>المعامل</th>
              <th>التأثير على السعر</th>
              <th>سعر ${printComparisonSize} سنوي (استرشادي)</th>
              <th>التصنيف والأهمية</th>
            </tr>
          </thead>
          <tbody>${munRows}</tbody>
        </table>

        <div class="section-title" style="margin-top: 20px;">3. معاملات فئات العملاء والخصومات التجارية المعتمدة</div>
        <table>
          <thead>
            <tr>
              <th style="width: 25%;">فئة العميل</th>
              <th>المعامل</th>
              <th>نسبة الاستحقاق / الخصم</th>
              <th>الوصف التجاري</th>
            </tr>
          </thead>
          <tbody>${catRows}</tbody>
        </table>
      `;
    } else if (printType === 'base_prices') {
      contentHtml = `
        <div class="section-title">قائمة الأسعار الأساسية المعتمدة (المستوى A والمستوى B المرن)</div>
        <table>
          <thead>
            <tr>
              <th style="width: 25%;">المقاس والمستوى</th>
              <th>شهر واحد</th>
              <th>شهرين</th>
              <th>3 أشهر</th>
              <th>6 أشهر</th>
              <th style="background: #eedfad;">سنة كاملة</th>
              <th>يومي</th>
            </tr>
          </thead>
          <tbody>${baseRows}</tbody>
        </table>
      `;
    } else if (printType === 'municipalities') {
      contentHtml = `
        <div class="section-title">جدول معاملات ونسب المدن والبلديات (${municipalityFactors.length} بلدية رسمية)</div>
        <table>
          <thead>
            <tr>
              <th style="width: 25%;">المدينة / البلدية</th>
              <th>المعامل</th>
              <th>التأثير على السعر</th>
              <th>سعر ${printComparisonSize} سنوي (استرشادي)</th>
              <th>التصنيف والأهمية</th>
            </tr>
          </thead>
          <tbody>${munRows}</tbody>
        </table>
      `;
    } else if (printType === 'single_city') {
      contentHtml = `
        <div class="badge-bar">
          <div>البلدية المحددة: <b>${printCity}</b> (معامل ${mFactorSingle}x)</div>
          <div>فئة العميل: <b>${printCategory}</b> (معامل ${cFactorSingle}x)</div>
          <div>المعامل المطبق: <b>${combinedSingle}x</b></div>
        </div>
        <div class="section-title">لائحة الأسعار المعتمدة لكافة المقاسات في بلدية ${printCity}</div>
        <table>
          <thead>
            <tr>
              <th style="width: 25%;">المقاس والمستوى</th>
              <th>شهر واحد</th>
              <th>شهرين</th>
              <th>3 أشهر</th>
              <th>6 أشهر</th>
              <th style="background: #eedfad;">سنة كاملة</th>
              <th>يومي</th>
            </tr>
          </thead>
          <tbody>${singleCityRows}</tbody>
        </table>
      `;
    }

    return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>وثيقة نظام المعاملات والتسعير الذكي - الفارس الذهبي</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap');
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Cairo', sans-serif; background: #fff; color: #1a1a1a; padding: 12mm 15mm; line-height: 1.5; font-size: 10pt; }
    .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #d6ac40; padding-bottom: 12px; margin-bottom: 16px; }
    .title { font-size: 18pt; font-weight: 900; color: #785b13; }
    .subtitle { font-size: 10.5pt; color: #555; margin-top: 3px; }
    .section-title { font-size: 12.5pt; font-weight: 800; color: #785b13; margin: 16px 0 8px 0; border-right: 4px solid #d6ac40; padding-right: 8px; }
    .formula-box, .badge-bar { background: #fdfaf3; border: 1px solid #e8dcbe; border-radius: 8px; padding: 10px 14px; margin-bottom: 16px; display: flex; justify-content: space-between; font-size: 9.5pt; }
    table { width: 100%; border-collapse: collapse; margin-top: 6px; font-size: 9.5pt; }
    th { background: #f5efe1; color: #5a430c; font-weight: 800; padding: 7px 6px; border: 1px solid #dcd1ba; text-align: center; }
    th:first-child { text-align: right; padding-right: 8px; }
    td { padding: 6px 6px; border: 1px solid #e5e5e5; }
    tr:nth-child(even) td { background: #fafafa; }
    .footer { margin-top: 25px; border-top: 1px solid #eee; padding-top: 10px; font-size: 8.5pt; color: #777; display: flex; justify-content: space-between; }
    @media print {
      body { padding: 8mm; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">وثيقة نظام المعاملات والتسعير الذكي الرسمية</div>
      <div class="subtitle">شركة الفارس الذهبي للدعاية والإعلان - طرابلس، ليبيا</div>
    </div>
    <div style="text-align: left;">
      <div style="font-weight: 800; color: #d6ac40; font-size: 13pt;">الفارس الذهبي</div>
      <div style="font-size: 8.5pt; color: #888;">تاريخ الإصدار: ${today}</div>
    </div>
  </div>

  <div class="formula-box">
    <div><b>معادلة التسعير المعتمدة:</b> السعر النهائي = السعر الأساسي × معامل المدينة × معامل فئة العميل</div>
    <div><b>المرجع القياسي:</b> العاصمة طرابلس (1.00x) | معيار زليتن للوحة 12×4: 45,000 د.ل (0.70x)</div>
  </div>

  ${contentHtml}

  <div class="footer">
    <div>ملاحظة: كافة الأسعار بالدينار الليبي وتشمل المساحات المعتمدة وفق شروط التعاقد الرسمية.</div>
    <div>شركة الفارس الذهبي للدعاية والإعلان - جميع الحقوق محفوظة</div>
  </div>
</body>
</html>`;
  };

  const handleExecutePrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    w.document.write(buildPrintDocumentHtml());
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
    setPrintDialogOpen(false);
  };

  const handlePrintCitySheet = () => {
    setPrintType('single_city');
    setPrintCity(previewMunicipality || 'زليتن');
    setPrintCategory(previewCategory || 'شركات');
    setPrintDialogOpen(true);
  };

  // تصفية البلديات حسب الفئة المختارة والبحث
  const filteredMunicipalities = useMemo(() => {
    return municipalityFactors
      .filter(m => matchesSearch(m.municipality_name) || matchesSearch(m.description || ''))
      .filter(m => {
        if (selectedMunTier === 'all') return true;
        return getMunicipalityTier(m.factor) === selectedMunTier;
      })
      .sort((a, b) => b.factor - a.factor);
  }, [municipalityFactors, search, selectedMunTier]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-10 w-10 border-2 border-primary border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div dir="rtl" className="pricing-factors-page mx-auto w-full max-w-[1600px] space-y-6 p-4 sm:p-6 text-foreground text-right">
      
      {/* ========================================================
          1. HEADER SECTION (رأس الصفحة)
      ======================================================== */}
      <div className="flex flex-col gap-4 rounded-2xl border border-border bg-gradient-to-l from-primary/10 via-primary/5 to-transparent p-5 sm:p-6 lg:flex-row lg:items-center lg:justify-between shadow-sm">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-primary/20 p-2.5 text-primary shrink-0">
            <Calculator className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-foreground">نظام المعاملات والتسعير الذكي</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              التسعير التلقائي: السعر النهائي = السعر الأساسي × معامل المدينة × معامل فئة العميل
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap justify-start lg:justify-end">
          <Button 
            onClick={() => setShowGuide(!showGuide)} 
            variant="outline" 
            size="sm"
            className="border-primary/40 bg-primary/5 text-primary hover:bg-primary/15 transition-colors cursor-pointer font-bold h-9"
          >
            <HelpCircle className="h-4 w-4 ml-1.5" />
            {showGuide ? 'إخفاء دليل النظام' : 'كيف يعمل هذا النظام؟'}
            {showGuide ? <ChevronUp className="h-4 w-4 mr-1" /> : <ChevronDown className="h-4 w-4 mr-1" />}
          </Button>

          <Button 
            onClick={() => setPrintDialogOpen(true)} 
            variant="outline" 
            size="sm"
            className="border-primary/30 bg-primary/10 text-primary hover:bg-primary/20 transition-colors cursor-pointer h-9 font-bold"
          >
            <Printer className="h-4 w-4 ml-1.5" />
            طباعة الأسعار والمعاملات
          </Button>

          <Button 
            onClick={loadData} 
            variant="outline" 
            size="sm"
            className="border-border hover:border-primary/50 transition-colors cursor-pointer h-9"
          >
            <RefreshCw className="h-4 w-4 ml-1.5 text-muted-foreground" />
            تحديث
          </Button>
        </div>
      </div>

      {/* ========================================================
          2. COLLAPSIBLE SYSTEM EXPLAINER GUIDE (دليل توضيح النظام)
      ======================================================== */}
      {showGuide && (
        <Card className="border-primary/30 bg-primary/5 shadow-sm overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
          <CardHeader className="p-4 sm:p-5 pb-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-primary font-bold text-base">
                <Sparkles className="h-5 w-5" />
                كيف يعمل نظام التسعير بالمعاملات؟ (3 خطوات بسيطة ومباشرة)
              </div>
              <Badge variant="outline" className="border-primary/40 bg-primary/10 text-primary text-xs font-semibold">
                دليل توضيحي
              </Badge>
            </div>
            <CardDescription className="text-xs text-muted-foreground mt-1">
              تم بناء هذا النظام لتحديد أسعار كافة اللوحات الإعلانية في مدن ليبيا تلقائياً بناءً على 3 ركائز رئيسية:
            </CardDescription>
          </CardHeader>

          <CardContent className="p-4 sm:p-5 pt-2 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3.5">
              
              {/* الخطوة 1: السعر الأساسي */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-right">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Building2 className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-primary block">الخطوة الأولى</span>
                    <h2 className="text-sm font-bold text-foreground">السعر الأساسي (معيار العاصمة)</h2>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  هو السعر القياسي المعتمد في العاصمة (طرابلس / سوق الجمعة) لكل مقاس، مقسم بمرونة بين <b>المستوى A (المميز)</b> و <b>المستوى B (المرن)</b>.
                </p>
                <div className="text-[11px] bg-muted/60 rounded px-2 py-1 text-foreground font-mono">
                  12×4 مستوى A = 65,000 د.ل | مستوى B = 58,000 د.ل
                </div>
              </div>

              {/* الخطوة 2: معامل المدينة */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-right">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <MapPin className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-primary block">الخطوة الثانية</span>
                    <h2 className="text-sm font-bold text-foreground">معامل المدينة (الكثافة والجغرافيا)</h2>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  يحدد نسبة السعر في كل مدينة مقارنة بالعاصمة. مثلاً <b>زليتن (0.70x)</b> ينخفض سعر اللوحة 12×4 إلى <b>45,500 د.ل</b> (معيار 45k المعتمد).
                </p>
                <div className="text-[11px] bg-muted/60 rounded px-2 py-1 text-foreground font-mono">
                  زليتن = 0.70x | طرابلس = 1.05x | مصراتة = 0.85x
                </div>
              </div>

              {/* الخطوة 3: معامل فئة العميل */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-2 text-right">
                <div className="flex items-center gap-2">
                  <div className="rounded-lg bg-primary/10 p-2 text-primary">
                    <Users className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-primary block">الخطوة الثالثة</span>
                    <h2 className="text-sm font-bold text-foreground">فئة العميل (الخصم التجاري)</h2>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  يحدد هل السعر كامل أو يحتوي على خصم خاص: <b>الشركات (1.00x - بدون خصم)</b>، أما <b>الوكالات الإعلانية (0.90x - خصم 10%)</b>.
                </p>
                <div className="text-[11px] bg-muted/60 rounded px-2 py-1 text-foreground font-mono">
                  شركات = 1.00x | وكالات = 0.90x | البحباح = 0.75x
                </div>
              </div>

            </div>

            {/* شريط المعادلة التوضيحي البسيط */}
            <div className="rounded-xl border border-primary/20 bg-background/80 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-bold text-primary">المعادلة الإجمالية:</span>
                <span className="bg-muted px-2 py-0.5 rounded font-mono text-foreground font-medium">السعر الأساسي</span>
                <span>×</span>
                <span className="bg-muted px-2 py-0.5 rounded font-mono text-foreground font-medium">معامل المدينة</span>
                <span>×</span>
                <span className="bg-muted px-2 py-0.5 rounded font-mono text-foreground font-medium">معامل الفئة</span>
                <span>=</span>
                <span className="bg-primary/20 text-primary font-bold px-2.5 py-0.5 rounded font-mono text-sm">السعر النهائي للوحة</span>
              </div>
              <div className="text-muted-foreground text-[11px]">
                مثال عملي: لوحة 12×4 في زليتن للشركات = 65,000 د.ل × 0.70 × 1.00 = <b className="text-foreground">45,500 د.ل سنوياً</b>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ========================================================
          3. INTERACTIVE QUICK PRICE CHECKER (حاسبة الأسعار السريعة)
      ======================================================== */}
      <Card className="border-border/80 bg-card shadow-sm overflow-hidden text-right">
        <div className="bg-primary/5 border-b border-border/80 px-5 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm text-primary">
            <SlidersHorizontal className="h-4 w-4" />
            حاسبة الأسعار الفورية (اختر اللوحة والمدينة لرؤية السعر لجميع الفترات)
          </div>
          <Badge variant="outline" className="border-primary/30 text-primary bg-primary/10 text-xs">
            معاينة حية ومباشرة
          </Badge>
        </div>

        <CardContent className="p-4 sm:p-5 space-y-4">
          {/* الاختيارات الأربعة مرتبة من اليمين إلى اليسار */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-right">
            
            {/* 1. المقاس */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">1. المقاس</Label>
              <Select value={calcSize} onValueChange={setCalcSize}>
                <SelectTrigger className="cursor-pointer h-9 text-xs">
                  <SelectValue placeholder="اختر المقاس" />
                </SelectTrigger>
                <SelectContent>
                  {availableSizeNames.map(size => (
                    <SelectItem key={size} value={size}>{size}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 2. المستوى */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">2. المستوى الإعلاني</Label>
              <Select value={calcLevel} onValueChange={setCalcLevel}>
                <SelectTrigger className="cursor-pointer h-9 text-xs">
                  <SelectValue placeholder="المستوى" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="A">مستوى A (المميز)</SelectItem>
                  <SelectItem value="B">مستوى B (المرن)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* 3. المدينة / البلدية */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">3. المدينة (المعامل)</Label>
              <Select value={calcMunicipality} onValueChange={setCalcMunicipality}>
                <SelectTrigger className="cursor-pointer h-9 text-xs">
                  <SelectValue placeholder="اختر المدينة" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {municipalityFactors.map(m => (
                    <SelectItem key={m.id} value={m.municipality_name}>
                      <span className="font-medium">{m.municipality_name}</span>
                      <span className="text-xs text-primary mr-2 font-bold font-mono">({m.factor}x)</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* 4. فئة العميل */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-muted-foreground">4. فئة العميل</Label>
              <Select value={calcCategory} onValueChange={setCalcCategory}>
                <SelectTrigger className="cursor-pointer h-9 text-xs">
                  <SelectValue placeholder="اختر الفئة" />
                </SelectTrigger>
                <SelectContent>
                  {categoryFactors.map(c => (
                    <SelectItem key={c.id} value={c.category_name}>
                      <span>{c.category_name}</span>
                      <span className="text-xs text-primary mr-2 font-bold font-mono">({c.factor}x)</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

          </div>

          {/* لوحة عرض الأسعار لجميع الفترات (مرتبة بتدرج المدة من اليمين لليسار) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
            
            {/* شهر واحد */}
            <div className="rounded-xl border border-border bg-muted/20 p-2.5 text-center flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground">شهر واحد (30 يوم)</span>
              <div className="my-1">
                <span className="text-base font-black text-foreground font-mono">
                  {liveCalcResult.finalMonthly.toLocaleString('ar-LY')}
                </span>
                <span className="text-[10px] text-muted-foreground mr-1">د.ل</span>
              </div>
              <span className="text-[10px] text-muted-foreground/70">
                الأساس: {liveCalcResult.baseMonthly.toLocaleString('ar-LY')}
              </span>
            </div>

            {/* شهرين */}
            <div className="rounded-xl border border-border bg-muted/20 p-2.5 text-center flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground">شهرين (60 يوم)</span>
              <div className="my-1">
                <span className="text-base font-black text-foreground font-mono">
                  {liveCalcResult.finalTwoMonths.toLocaleString('ar-LY')}
                </span>
                <span className="text-[10px] text-muted-foreground mr-1">د.ل</span>
              </div>
              <span className="text-[10px] text-muted-foreground/70">
                الأساس: {liveCalcResult.baseTwoMonths.toLocaleString('ar-LY')}
              </span>
            </div>

            {/* 3 أشهر */}
            <div className="rounded-xl border border-border bg-muted/20 p-2.5 text-center flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground">3 أشهر (90 يوم)</span>
              <div className="my-1">
                <span className="text-base font-black text-foreground font-mono">
                  {liveCalcResult.finalThreeMonths.toLocaleString('ar-LY')}
                </span>
                <span className="text-[10px] text-muted-foreground mr-1">د.ل</span>
              </div>
              <span className="text-[10px] text-muted-foreground/70">
                الأساس: {liveCalcResult.baseThreeMonths.toLocaleString('ar-LY')}
              </span>
            </div>

            {/* 6 أشهر */}
            <div className="rounded-xl border border-border bg-muted/20 p-2.5 text-center flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground">6 أشهر (180 يوم)</span>
              <div className="my-1">
                <span className="text-base font-black text-foreground font-mono">
                  {liveCalcResult.finalSixMonths.toLocaleString('ar-LY')}
                </span>
                <span className="text-[10px] text-muted-foreground mr-1">د.ل</span>
              </div>
              <span className="text-[10px] text-muted-foreground/70">
                الأساس: {liveCalcResult.baseSixMonths.toLocaleString('ar-LY')}
              </span>
            </div>

            {/* سنة كاملة - مميزة */}
            <div className="rounded-xl border-2 border-primary/60 bg-primary/10 p-2.5 text-center flex flex-col justify-between shadow-sm">
              <div className="flex items-center justify-center gap-1">
                <span className="text-[11px] font-bold text-primary">سنة كاملة (360 يوم)</span>
              </div>
              <div className="my-1">
                <span className="text-lg font-black text-primary font-mono">
                  {liveCalcResult.finalYearly.toLocaleString('ar-LY')}
                </span>
                <span className="text-xs text-foreground mr-1">د.ل</span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                الأساس: {liveCalcResult.baseYearly.toLocaleString('ar-LY')} د.ل
              </span>
            </div>

            {/* يومي */}
            <div className="rounded-xl border border-border bg-muted/20 p-2.5 text-center flex flex-col justify-between">
              <span className="text-[11px] font-semibold text-muted-foreground">يومي (1 يوم)</span>
              <div className="my-1">
                <span className="text-base font-black text-foreground font-mono">
                  {liveCalcResult.finalDaily.toLocaleString('ar-LY')}
                </span>
                <span className="text-[10px] text-muted-foreground mr-1">د.ل</span>
              </div>
              <span className="text-[10px] text-muted-foreground/70">
                الأساس: {liveCalcResult.baseDaily.toLocaleString('ar-LY')}
              </span>
            </div>

          </div>

          {/* شريط التفسير البشري الواضح */}
          <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <div>
              <span>النتيجة للوحة <b>{calcSize}</b> (مستوى {calcLevel}) في مدينة <b>{calcMunicipality}</b>: </span>
              <span className="text-foreground font-semibold">
                السعر السنوي هو <b className="text-primary font-mono text-sm">{liveCalcResult.finalYearly.toLocaleString('ar-LY')} د.ل</b>
              </span>
              <span className="mr-2 text-muted-foreground">
                (الأساس {liveCalcResult.baseYearly.toLocaleString('ar-LY')} د.ل × معامل {liveCalcResult.combinedMultiplier}x)
              </span>
            </div>
            <div className="text-[11px] text-primary font-medium">
              تم تقسيم المستويات A و B بمرونة وذكاء
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ========================================================
          4. MAIN TABS NAVIGATION (تبويبات الإدارة والعرض)
      ======================================================== */}
      <Tabs defaultValue="municipalities" className="w-full">
        <TabsList className="grid grid-cols-2 md:grid-cols-4 h-auto p-1.5 bg-muted/50 border border-border rounded-xl gap-1">
          <TabsTrigger value="municipalities" className="cursor-pointer py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold text-xs sm:text-sm">
            <MapPin className="h-4 w-4 ml-1.5" />
            معاملات المدن والبلديات ({municipalityFactors.length})
          </TabsTrigger>
          <TabsTrigger value="base-prices" className="cursor-pointer py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold text-xs sm:text-sm">
            <LayoutGrid className="h-4 w-4 ml-1.5" />
            الأسعار الأساسية (المستوى A و B)
          </TabsTrigger>
          <TabsTrigger value="categories" className="cursor-pointer py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold text-xs sm:text-sm">
            <Users className="h-4 w-4 ml-1.5" />
            معاملات فئات العملاء ({categoryFactors.length})
          </TabsTrigger>
          <TabsTrigger value="preview" className="cursor-pointer py-2.5 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground font-bold text-xs sm:text-sm">
            <Eye className="h-4 w-4 ml-1.5" />
            لائحة أسعار أي مدينة (معاينة وطباعة)
          </TabsTrigger>
        </TabsList>

        {/* ========================================================
            TAB 1: معاملات المدن والبلديات (مع خاصية تبديل المقاس المقارن بسهولة)
        ======================================================== */}
        <TabsContent value="municipalities" className="space-y-4 mt-4">
          <Card className="border-border bg-card">
            <CardHeader className="p-4 sm:p-5 border-b border-border/80">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <MapPin className="h-5 w-5 text-primary" />
                    معاملات البلديات والمدن الرسمية ({municipalityFactors.length} بلدية)
                  </CardTitle>
                  <CardDescription className="mt-1 text-xs">
                    مبنية على معيار زليتن (0.70x = 45,000 د.ل للوحة 12×4) مقابل العاصمة طرابلس (1.00x = 65,000 د.ل).
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  
                  {/* أداة تبديل المقاس المقارن بسهولة */}
                  <div className="flex items-center gap-1.5 bg-muted/60 p-1 rounded-lg border border-border">
                    <span className="text-xs font-semibold text-muted-foreground mr-1">المقاس المقارن:</span>
                    <Select value={comparisonSize} onValueChange={setComparisonSize}>
                      <SelectTrigger className="h-7 w-24 text-xs font-bold cursor-pointer bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {availableSizeNames.map(s => (
                          <SelectItem key={s} value={s}>{s}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={comparisonLevel} onValueChange={setComparisonLevel}>
                      <SelectTrigger className="h-7 w-20 text-xs font-bold cursor-pointer bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">مستوى A</SelectItem>
                        <SelectItem value="B">مستوى B</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* زر تبديل العرض */}
                  <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border border-border">
                    <Button 
                      size="sm" 
                      variant={munViewMode === 'table' ? 'default' : 'ghost'} 
                      className="h-7 text-xs px-2.5 cursor-pointer font-bold"
                      onClick={() => setMunViewMode('table')}
                    >
                      <TableIcon className="h-3.5 w-3.5 ml-1" />
                      جدول
                    </Button>
                    <Button 
                      size="sm" 
                      variant={munViewMode === 'cards' ? 'default' : 'ghost'} 
                      className="h-7 text-xs px-2.5 cursor-pointer font-bold"
                      onClick={() => setMunViewMode('cards')}
                    >
                      <LayoutGrid className="h-3.5 w-3.5 ml-1" />
                      بطاقات
                    </Button>
                  </div>

                  {/* البحث */}
                  <div className="relative w-full sm:w-48">
                    <Search className="absolute right-3 top-2 h-4 w-4 text-muted-foreground pointer-events-none" />
                    <Input 
                      placeholder="ابحث عن مدينة..." 
                      value={search} 
                      onChange={e => setSearch(e.target.value)}
                      className="pr-9 h-8 text-xs"
                    />
                  </div>
                </div>
              </div>

              {/* أزرار الفلترة السريعة للمستويات الـ 5 */}
              <div className="flex items-center gap-1.5 flex-wrap pt-3 mt-1">
                {[
                  { key: 'all', label: `جميع المدن (${municipalityFactors.length})` },
                  { key: 'tier1', label: 'العاصمة ومراكز الثقل (1.00x - 1.05x)' },
                  { key: 'tier2', label: 'الكثافة العالية والمحاور الاقتصادية (0.85x - 0.95x)' },
                  { key: 'tier3', label: 'المدن الساحلية والتجارية / معيار زليتن (0.70x - 0.80x)' },
                  { key: 'tier4', label: 'الضواحي والمدن المجاورة (0.65x)' },
                  { key: 'tier5', label: 'المدن الداخلية والمناطق الهادئة (0.55x - 0.60x)' },
                ].map(tier => (
                  <Button
                    key={tier.key}
                    type="button"
                    variant={selectedMunTier === tier.key ? 'default' : 'outline'}
                    size="sm"
                    className="h-7 text-xs rounded-lg cursor-pointer transition-colors font-medium"
                    onClick={() => setSelectedMunTier(tier.key as MunicipalityTier)}
                  >
                    {tier.label}
                  </Button>
                ))}
              </div>
            </CardHeader>

            <CardContent className="p-4 sm:p-5">
              
              {/* النمط 1: عرض الجدول المنظم */}
              {munViewMode === 'table' ? (
                <div className="overflow-x-auto rounded-xl border border-border">
                  <Table className="min-w-[800px]">
                    <TableHeader className="bg-muted/50">
                      <TableRow>
                        <TableHead className="font-bold text-right py-3">المدينة / البلدية</TableHead>
                        <TableHead className="text-center font-bold">المعامل</TableHead>
                        <TableHead className="text-center font-bold">التأثير على السعر</TableHead>
                        <TableHead className="text-center font-bold bg-primary/10 text-primary">
                          سعر {comparisonSize} سنوي (مستوى {comparisonLevel})
                        </TableHead>
                        <TableHead className="font-bold text-right">التصنيف والأهمية</TableHead>
                        <TableHead className="text-center font-bold">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredMunicipalities.map(m => {
                        const badge = getTierBadge(m.factor);
                        const Icon = badge.icon;
                        const dynamicPrice = Math.round(comparisonBasePrice * m.factor);
                        const isAnchor = m.municipality_name === 'زليتن';

                        return (
                          <TableRow key={m.id} className={`hover:bg-muted/30 transition-colors ${isAnchor ? 'bg-primary/5' : ''}`}>
                            <TableCell className="font-bold py-3 text-right">
                              <div className="flex items-center gap-2">
                                <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
                                  <Building2 className="h-4 w-4" />
                                </div>
                                <span className="font-bold text-sm text-foreground">{m.municipality_name}</span>
                                {isAnchor && (
                                  <Badge className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0 font-bold">
                                    معيار زليتن المعتمد 45k
                                  </Badge>
                                )}
                              </div>
                            </TableCell>

                            <TableCell className="text-center">
                              <Badge className="font-mono text-sm font-black px-2 py-0.5 border-border bg-muted/80 text-foreground">
                                {m.factor}x
                              </Badge>
                            </TableCell>

                            <TableCell className="text-center">
                              <Badge variant="outline" className={`text-xs px-2 py-0.5 border font-semibold inline-flex items-center gap-1 ${badge.className}`}>
                                <Icon className="h-3 w-3" />
                                {badge.label}
                              </Badge>
                            </TableCell>

                            <TableCell className="text-center bg-primary/5">
                              <span className="font-mono font-bold text-sm text-foreground">
                                {dynamicPrice.toLocaleString('ar-LY')}
                              </span>
                              <span className="text-xs text-muted-foreground mr-1">د.ل</span>
                            </TableCell>

                            <TableCell className="text-right">
                              <span className="text-xs text-muted-foreground">
                                {m.description || getTierName(m.factor)}
                              </span>
                            </TableCell>

                            <TableCell className="text-center">
                              <Button 
                                type="button"
                                variant="ghost" 
                                size="sm" 
                                className="h-7 px-2.5 text-xs text-primary hover:bg-primary/10 hover:text-primary cursor-pointer transition-colors font-bold"
                                onClick={() => setEditingMunicipality(m)}
                              >
                                <Edit2 className="h-3.5 w-3.5 ml-1" />
                                تعديل
                              </Button>
                            </TableCell>
                          </TableRow>
                        );
                      })}

                      {filteredMunicipalities.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                            لا توجد مدن مطابقة للبحث أو الفلتر المحدد.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                /* النمط 2: عرض البطاقات */
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3.5">
                  {filteredMunicipalities.map(m => {
                    const badge = getTierBadge(m.factor);
                    const Icon = badge.icon;
                    const dynamicPrice = Math.round(comparisonBasePrice * m.factor);
                    const isAnchor = m.municipality_name === 'زليتن';

                    return (
                      <div
                        key={m.id}
                        className={`group relative rounded-xl border border-border bg-card p-4 transition-all duration-200 hover:border-primary/60 hover:shadow-md flex flex-col justify-between ${isAnchor ? 'border-primary/50 bg-primary/5' : ''}`}
                      >
                        <div>
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <div className="rounded-lg bg-primary/10 p-1.5 text-primary">
                                <Building2 className="h-4 w-4" />
                              </div>
                              <div>
                                <span className="font-bold text-sm text-foreground block">{m.municipality_name}</span>
                                {isAnchor && (
                                  <span className="text-[10px] text-primary font-bold">معيار زليتن (45k)</span>
                                )}
                              </div>
                            </div>
                            <Badge className="font-mono text-base font-black px-2.5 py-0.5 border-border bg-muted/80 text-foreground">
                              {m.factor}x
                            </Badge>
                          </div>

                          <div className="mb-2.5 flex items-center justify-between">
                            <Badge variant="outline" className={`text-xs px-2 py-0.5 border font-semibold flex items-center w-fit gap-1 ${badge.className}`}>
                              <Icon className="h-3 w-3" />
                              {badge.label}
                            </Badge>
                            <span className="text-xs font-mono font-bold text-foreground">
                              {comparisonSize}: {dynamicPrice.toLocaleString('ar-LY')} د.ل
                            </span>
                          </div>

                          <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                            {m.description || getTierName(m.factor)}
                          </p>
                        </div>

                        <div className="mt-3 pt-3 border-t border-border/60 flex items-center justify-end">
                          <Button 
                            type="button"
                            variant="ghost" 
                            size="sm" 
                            className="h-7 px-2.5 text-xs text-primary hover:bg-primary/10 hover:text-primary cursor-pointer transition-colors font-bold"
                            onClick={() => setEditingMunicipality(m)}
                          >
                            <Edit2 className="h-3.5 w-3.5 ml-1" />
                            تعديل المعامل
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================
            TAB 2: الأسعار الأساسية (معيار طرابلس مقسم بمرونة بين A و B)
        ======================================================== */}
        <TabsContent value="base-prices" className="space-y-4 mt-4">
          <Card className="border-border bg-card">
            <CardHeader className="p-4 sm:p-5 border-b border-border/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <LayoutGrid className="h-5 w-5 text-primary" />
                  الأسعار الأساسية لجميع المقاسات (مقسمة بمرونة بين المستوى A والمستوى B)
                </CardTitle>
                <CardDescription className="mt-1 text-xs">
                  المستوى A مخصص للمواقع الحيوية والشرايين الكبرى، بينما المستوى B يقدم تسعيرة مرنة وتنافسية بنسبة تخفيض مدروسة.
                </CardDescription>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1 bg-muted p-1 rounded-lg border border-border">
                  <Button 
                    size="sm" 
                    variant={priceLevel === 'all' ? 'default' : 'ghost'} 
                    className="h-7 text-xs px-2.5 cursor-pointer font-bold"
                    onClick={() => setPriceLevel('all')}
                  >
                    الكل
                  </Button>
                  <Button 
                    size="sm" 
                    variant={priceLevel === 'A' ? 'default' : 'ghost'} 
                    className="h-7 text-xs px-2.5 cursor-pointer font-bold"
                    onClick={() => setPriceLevel('A')}
                  >
                    المستوى A (المميز)
                  </Button>
                  <Button 
                    size="sm" 
                    variant={priceLevel === 'B' ? 'default' : 'ghost'} 
                    className="h-7 text-xs px-2.5 cursor-pointer font-bold"
                    onClick={() => setPriceLevel('B')}
                  >
                    المستوى B (المرن)
                  </Button>
                </div>

                <Button 
                  size="sm"
                  className="bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer h-8 text-xs font-bold"
                  onClick={() => { 
                    setNewBasePrice(curr => ({ ...curr, billboard_level: priceLevel === 'all' ? 'A' : priceLevel }));
                    setAddBasePriceOpen(true); 
                  }}
                >
                  <Plus className="h-3.5 w-3.5 ml-1" />
                  إضافة سعر أساسي
                </Button>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="min-w-[760px]">
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="font-bold text-right py-3">المقاس / المستوى</TableHead>
                      <TableHead className="text-center font-bold">شهر واحد (30 يوم)</TableHead>
                      <TableHead className="text-center font-bold">شهرين (60 يوم)</TableHead>
                      <TableHead className="text-center font-bold">3 أشهر (90 يوم)</TableHead>
                      <TableHead className="text-center font-bold">6 أشهر (180 يوم)</TableHead>
                      <TableHead className="text-center font-bold bg-primary/10 text-primary">سنة كاملة (360 يوم)</TableHead>
                      <TableHead className="text-center font-bold">يومي (1 يوم)</TableHead>
                      <TableHead className="text-center font-bold">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {basePrices.filter(matchesPrice).map(bp => (
                      <TableRow key={bp.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-bold py-3.5 text-right">
                          <span className="font-mono text-base font-black text-foreground">{bp.size_name}</span>
                          <Badge 
                            variant="outline" 
                            className={`mr-2 border text-xs font-semibold ${
                              bp.billboard_level === 'A' 
                                ? 'border-primary/40 text-primary bg-primary/10' 
                                : 'border-border text-muted-foreground bg-muted/40'
                            }`}
                          >
                            مستوى {bp.billboard_level}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono font-medium">{Number(bp.one_month || 0).toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell className="text-center font-mono font-medium">{Number(bp.two_months || 0).toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell className="text-center font-mono font-medium">{Number(bp.three_months || 0).toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell className="text-center font-mono font-medium">{Number(bp.six_months || 0).toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell className="text-center font-mono font-black text-primary bg-primary/5">{Number(bp.full_year || 0).toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell className="text-center font-mono text-muted-foreground">{Number(bp.one_day || 0).toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell className="text-center">
                          <Button 
                            size="sm" 
                            variant="ghost" 
                            className="h-8 w-8 p-0 text-muted-foreground hover:text-primary cursor-pointer"
                            onClick={() => setEditingBasePrice(bp)}
                            title="تعديل السعر الأساسي"
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}

                    {basePrices.filter(matchesPrice).length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="h-32 text-center text-muted-foreground">
                          لا توجد أسعار مسجلة مطابقة للمستوى أو البحث.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================
            TAB 3: معاملات فئات العملاء والخصومات
        ======================================================== */}
        <TabsContent value="categories" className="space-y-4 mt-4">
          <Card className="border-border bg-card">
            <CardHeader className="p-4 sm:p-5 border-b border-border/80 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Users className="h-5 w-5 text-primary" />
                  معاملات فئات العملاء والخصومات التجارية
                </CardTitle>
                <CardDescription className="mt-1 text-xs">
                  يحدد هذا المعامل نسبة السعر المستحق لكل فئة عميل (معامل 1.00 = السعر الكامل 100% بدون خصم).
                </CardDescription>
              </div>

              <Button 
                size="sm" 
                className="bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer text-xs font-bold"
                onClick={() => setAddCategoryOpen(true)}
              >
                <Plus className="h-3.5 w-3.5 ml-1" />
                إضافة فئة جديدة
              </Button>
            </CardHeader>

            <CardContent className="p-5">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {categoryFactors.map(cf => {
                  const discountPct = Math.round((1 - cf.factor) * 100);
                  const isDiscount = cf.factor < 1.0;
                  const isBase = cf.factor === 1.0;
                  const examplePrice = Math.round(10000 * cf.factor);

                  return (
                    <div 
                      key={cf.id} 
                      className="rounded-xl border border-border bg-card p-5 transition-all duration-200 hover:border-primary/60 hover:shadow-md flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-base font-bold text-foreground flex items-center gap-2">
                            <Users className="h-4 w-4 text-primary" />
                            {cf.category_name}
                          </span>
                          <Badge className="font-mono text-lg font-black px-3 py-0.5 border-border bg-muted text-foreground">
                            {cf.factor}x
                          </Badge>
                        </div>

                        <div className="mb-3">
                          {isBase ? (
                            <Badge variant="outline" className="text-xs bg-muted text-muted-foreground border-border font-semibold">
                              السعر القياسي الكامل (100% بدون خصم)
                            </Badge>
                          ) : isDiscount ? (
                            <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-semibold">
                              خصم {discountPct}% عن السعر الأساسي
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/30 font-semibold">
                              زيادة +{Math.round((cf.factor - 1) * 100)}%
                            </Badge>
                          )}
                        </div>

                        <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                          {cf.description || 'معامل فئة مخصص'}
                        </p>

                        <div className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground font-mono">
                          مثال: لوحة بقيمة 10,000 د.ل تصبح: <b className="text-foreground">{examplePrice.toLocaleString('ar-LY')} د.ل</b>
                        </div>
                      </div>

                      <div className="mt-4 pt-3 border-t border-border/60 flex items-center justify-end">
                        <Button 
                          type="button" 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 text-xs text-primary hover:bg-primary/10 cursor-pointer font-bold"
                          onClick={() => setEditingCategory(cf)}
                        >
                          <Edit2 className="h-3.5 w-3.5 ml-1" />
                          تعديل المعامل
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ========================================================
            TAB 4: لائحة أسعار أي مدينة (معاينة وطباعة رسمية فورية)
        ======================================================== */}
        <TabsContent value="preview" className="space-y-4 mt-4">
          <Card className="border-border bg-card">
            <CardHeader className="p-4 sm:p-5 border-b border-border/80">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div>
                  <CardTitle className="text-lg font-bold flex items-center gap-2">
                    <Eye className="h-5 w-5 text-primary" />
                    لائحة الأسعار المعتمدة لأي مدينة (عرض وطباعة فورية)
                  </CardTitle>
                  <CardDescription className="mt-1 text-xs">
                    اختر المدينة والفئة لعرض جدول الأسعار النهائي لكافة المقاسات أو طباعته كعرض أسعار رسمي.
                  </CardDescription>
                </div>

                {/* خيارات المدينة والفئة والطباعة */}
                <div className="flex items-center gap-2 flex-wrap">
                  <Select value={previewMunicipality} onValueChange={setPreviewMunicipality}>
                    <SelectTrigger className="w-48 cursor-pointer h-9 text-xs font-semibold">
                      <SelectValue placeholder="اختر المدينة" />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {municipalityFactors.map(mf => (
                        <SelectItem key={mf.id} value={mf.municipality_name}>
                          {mf.municipality_name} ({mf.factor}x)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Select value={previewCategory} onValueChange={setPreviewCategory}>
                    <SelectTrigger className="w-40 cursor-pointer h-9 text-xs font-semibold">
                      <SelectValue placeholder="اختر الفئة" />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryFactors.map(cf => (
                        <SelectItem key={cf.id} value={cf.category_name}>
                          {cf.category_name} ({cf.factor}x)
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>

                  <Button 
                    onClick={handlePrintCitySheet}
                    className="bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer h-9 text-xs font-bold"
                  >
                    <Printer className="h-4 w-4 ml-1.5" />
                    طباعة لائحة أسعار {previewMunicipality}
                  </Button>
                </div>
              </div>

              {/* شريط معلومات اللائحة */}
              <div className="mt-3 rounded-lg border border-primary/30 bg-primary/5 p-3 flex flex-wrap items-center justify-between gap-3 text-xs">
                <div className="flex items-center gap-3">
                  <span className="font-bold text-foreground">
                    المدينة: <b className="text-primary">{previewMunicipality}</b> (معامل {currentPreviewMunFactor}x)
                  </span>
                  <span>•</span>
                  <span>
                    الفئة: <b className="text-foreground">{previewCategory}</b> ({currentPreviewCatFactor}x)
                  </span>
                  <span>•</span>
                  <span>
                    المعامل المطبق: <b className="text-primary font-bold font-mono">{Number((currentPreviewMunFactor * currentPreviewCatFactor).toFixed(4))}x</b>
                  </span>
                </div>
                <span className="text-muted-foreground text-[11px]">
                  جميع الأسعار جاهزة ومعتمدة ومقربة لأقرب دينار
                </span>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <Table className="min-w-[760px]">
                  <TableHeader className="bg-muted/40">
                    <TableRow>
                      <TableHead className="font-bold text-right py-3">المقاس / المستوى</TableHead>
                      <TableHead className="text-center font-bold">شهر واحد</TableHead>
                      <TableHead className="text-center font-bold">شهرين</TableHead>
                      <TableHead className="text-center font-bold">3 أشهر</TableHead>
                      <TableHead className="text-center font-bold">6 أشهر</TableHead>
                      <TableHead className="text-center font-bold bg-primary/10 text-primary">سنة كاملة</TableHead>
                      <TableHead className="text-center font-bold">يومي</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPrices.filter(matchesPrice).map(bp => (
                      <TableRow key={bp.id} className="hover:bg-muted/30 transition-colors">
                        <TableCell className="font-bold py-3 text-right">
                          <span className="font-mono text-base font-black text-foreground">{bp.size_name}</span>
                          <Badge 
                            variant="outline" 
                            className={`mr-2 border text-xs font-semibold ${
                              bp.billboard_level === 'A' 
                                ? 'border-primary/40 text-primary bg-primary/10' 
                                : 'border-border text-muted-foreground bg-muted/40'
                            }`}
                          >
                            مستوى {bp.billboard_level}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-center font-mono font-medium">{bp.calculated_one_month.toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell className="text-center font-mono font-medium">{bp.calculated_two_months.toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell className="text-center font-mono font-medium">{bp.calculated_three_months.toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell className="text-center font-mono font-medium">{bp.calculated_six_months.toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell className="text-center font-mono font-black text-primary bg-primary/5">{bp.calculated_full_year.toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell className="text-center font-mono text-muted-foreground">{bp.calculated_one_day.toLocaleString('ar-LY')} د.ل</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ========================================================
          5. DIALOGS: EDIT, ADD & ADVANCED PRINT
      ======================================================== */}

      {/* نافذة خيارات الطباعة المتقدمة المنظمة (مثل قائمة الأسعار الرسمية) */}
      <Dialog open={printDialogOpen} onOpenChange={setPrintDialogOpen}>
        <DialogContent dir="rtl" className="sm:max-w-lg text-right">
          <DialogHeader className="border-b border-border pb-3 text-right">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Printer className="h-5 w-5 text-primary" />
              خيارات طباعة نظام المعاملات والتسعير
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-3 text-right">
            {/* نوع التقرير */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">نوع التقرير المطلوب طباعته:</Label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {[
                  { id: 'all', title: 'وثيقة شاملة للمنظومة بالكامل', desc: 'الأسعار الأساسية + كل البلديات + فئات العملاء' },
                  { id: 'base_prices', title: 'جدول الأسعار الأساسية فقط', desc: 'المستوى A والمستوى B لكافة المقاسات' },
                  { id: 'municipalities', title: 'جدول معاملات ونسب البلديات', desc: `معاملات كافة البلديات (${municipalityFactors.length} بلدية)` },
                  { id: 'single_city', title: 'لائحة أسعار بلدية محددة', desc: 'جدول أسعار معتمد لمدينة وفئة معينة' },
                ].map(opt => (
                  <div
                    key={opt.id}
                    onClick={() => setPrintType(opt.id as any)}
                    className={`cursor-pointer rounded-xl border p-3 transition-all duration-200 text-right flex flex-col justify-between ${
                      printType === opt.id 
                        ? 'border-primary bg-primary/10 shadow-sm' 
                        : 'border-border bg-card hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-xs text-foreground">{opt.title}</span>
                      {printType === opt.id && <Check className="h-4 w-4 text-primary" />}
                    </div>
                    <span className="text-[11px] text-muted-foreground">{opt.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* خيارات إضافية حسب نوع التقرير */}
            {(printType === 'all' || printType === 'municipalities') && (
              <div className="space-y-1.5 pt-2 border-t border-border/60">
                <Label className="text-xs font-semibold text-muted-foreground">المقاس الاسترشادي المعروض في جدول البلديات:</Label>
                <Select value={printComparisonSize} onValueChange={setPrintComparisonSize}>
                  <SelectTrigger className="cursor-pointer h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableSizeNames.map(s => (
                      <SelectItem key={s} value={s}>{s}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {printType === 'single_city' && (
              <div className="grid grid-cols-2 gap-3 pt-2 border-t border-border/60">
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">البلدية:</Label>
                  <Select value={printCity} onValueChange={setPrintCity}>
                    <SelectTrigger className="cursor-pointer h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-56">
                      {municipalityFactors.map(m => (
                        <SelectItem key={m.id} value={m.municipality_name}>{m.municipality_name} ({m.factor}x)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold text-muted-foreground">فئة العميل:</Label>
                  <Select value={printCategory} onValueChange={setPrintCategory}>
                    <SelectTrigger className="cursor-pointer h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categoryFactors.map(c => (
                        <SelectItem key={c.id} value={c.category_name}>{c.category_name} ({c.factor}x)</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            <div className="rounded-lg bg-muted/40 p-2.5 text-xs text-muted-foreground">
              سيتم إنشاء مستند A4 منظم ومطبوع بهوية الفارس الذهبي جاهز للطباعة أو الحفظ كملف PDF.
            </div>
          </div>

          <DialogFooter className="gap-2 border-t border-border pt-3">
            <Button variant="outline" className="cursor-pointer" onClick={() => setPrintDialogOpen(false)}>إلغاء</Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer font-bold" onClick={handleExecutePrint}>
              <Printer className="h-4 w-4 ml-1.5" />
              بدء الطباعة الآن
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* دايلوج تعديل معامل البلدية */}
      <Dialog open={!!editingMunicipality} onOpenChange={() => setEditingMunicipality(null)}>
        <DialogContent dir="rtl" className="sm:max-w-lg text-right">
          <DialogHeader className="border-b border-border pb-3 text-right">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <MapPin className="h-5 w-5 text-primary" />
              تعديل معامل مدينة: {editingMunicipality?.municipality_name}
            </DialogTitle>
          </DialogHeader>
          {editingMunicipality && (
            <div className="space-y-4 py-2">
              <FactorValueEditor 
                value={editingMunicipality.factor} 
                onChange={factor => setEditingMunicipality({ ...editingMunicipality, factor })} 
              />
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">الوصف والأهمية الاقتصادية</Label>
                <Input
                  value={editingMunicipality.description || ''}
                  onChange={(e) => setEditingMunicipality({...editingMunicipality, description: e.target.value})}
                  placeholder="وصف الكثافة والأهمية الإعلانية"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 border-t border-border pt-3">
            <Button variant="outline" className="cursor-pointer" onClick={() => setEditingMunicipality(null)}>إلغاء</Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer" onClick={saveMunicipalityFactor}>
              <Save className="h-4 w-4 ml-1.5" />
              حفظ المعامل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* دايلوج تعديل معامل الفئة */}
      <Dialog open={!!editingCategory} onOpenChange={() => setEditingCategory(null)}>
        <DialogContent dir="rtl" className="sm:max-w-lg text-right">
          <DialogHeader className="border-b border-border pb-3 text-right">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Users className="h-5 w-5 text-primary" />
              تعديل معامل فئة: {editingCategory?.category_name}
            </DialogTitle>
          </DialogHeader>
          {editingCategory && (
            <div className="space-y-4 py-2">
              <FactorValueEditor 
                value={editingCategory.factor} 
                onChange={factor => setEditingCategory({ ...editingCategory, factor })} 
              />
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">الوصف</Label>
                <Input
                  value={editingCategory.description || ''}
                  onChange={(e) => setEditingCategory({...editingCategory, description: e.target.value})}
                  placeholder="وصف الفئة ونسبة الخصم"
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 border-t border-border pt-3">
            <Button variant="outline" className="cursor-pointer" onClick={() => setEditingCategory(null)}>إلغاء</Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer" onClick={saveCategoryFactor}>
              <Save className="h-4 w-4 ml-1.5" />
              حفظ المعامل
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* دايلوج تعديل السعر الأساسي */}
      <Dialog open={!!editingBasePrice} onOpenChange={() => setEditingBasePrice(null)}>
        <DialogContent dir="rtl" className="sm:max-w-lg text-right">
          <DialogHeader className="border-b border-border pb-3 text-right">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Edit2 className="h-4 w-4 text-primary" />
              تعديل السعر الأساسي: {editingBasePrice?.size_name} (مستوى {editingBasePrice?.billboard_level})
            </DialogTitle>
          </DialogHeader>
          {editingBasePrice && (
            <div className="grid grid-cols-2 gap-3.5 py-3">
              <div className="space-y-1">
                <Label className="text-xs">شهر واحد (30 يوم)</Label>
                <Input
                  type="number"
                  value={editingBasePrice.one_month}
                  onChange={(e) => setEditingBasePrice({...editingBasePrice, one_month: Number(e.target.value)})}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">شهرين (60 يوم)</Label>
                <Input
                  type="number"
                  value={editingBasePrice.two_months}
                  onChange={(e) => setEditingBasePrice({...editingBasePrice, two_months: Number(e.target.value)})}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">3 أشهر (90 يوم)</Label>
                <Input
                  type="number"
                  value={editingBasePrice.three_months}
                  onChange={(e) => setEditingBasePrice({...editingBasePrice, three_months: Number(e.target.value)})}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">6 أشهر (180 يوم)</Label>
                <Input
                  type="number"
                  value={editingBasePrice.six_months}
                  onChange={(e) => setEditingBasePrice({...editingBasePrice, six_months: Number(e.target.value)})}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">سنة كاملة (360 يوم)</Label>
                <Input
                  type="number"
                  value={editingBasePrice.full_year}
                  onChange={(e) => setEditingBasePrice({...editingBasePrice, full_year: Number(e.target.value)})}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">يومي (1 يوم)</Label>
                <Input
                  type="number"
                  value={editingBasePrice.one_day}
                  onChange={(e) => setEditingBasePrice({...editingBasePrice, one_day: Number(e.target.value)})}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 border-t border-border pt-3">
            <Button variant="outline" className="cursor-pointer" onClick={() => setEditingBasePrice(null)}>إلغاء</Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer" onClick={saveBasePrice}>
              <Save className="h-4 w-4 ml-1.5" />
              حفظ التعديلات
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* دايلوج إضافة سعر أساسي جديد */}
      <Dialog open={addBasePriceOpen} onOpenChange={setAddBasePriceOpen}>
        <DialogContent dir="rtl" className="sm:max-w-lg text-right">
          <DialogHeader className="border-b border-border pb-3 text-right">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Plus className="h-4 w-4 text-primary" />
              إضافة سعر أساسي جديد
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">المقاس</Label>
                <Input
                  value={newBasePrice.size_name || ''}
                  onChange={(e) => setNewBasePrice({...newBasePrice, size_name: e.target.value})}
                  placeholder="مثال: 4x3"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">المستوى</Label>
                <Select 
                  value={newBasePrice.billboard_level || 'A'} 
                  onValueChange={(v) => setNewBasePrice({...newBasePrice, billboard_level: v})}
                >
                  <SelectTrigger className="cursor-pointer">
                    <SelectValue placeholder="اختر المستوى" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="A">مستوى A</SelectItem>
                    <SelectItem value="B">مستوى B</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">شهر واحد</Label>
                <Input
                  type="number"
                  value={newBasePrice.one_month || ''}
                  onChange={(e) => setNewBasePrice({...newBasePrice, one_month: Number(e.target.value)})}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">شهرين</Label>
                <Input
                  type="number"
                  value={newBasePrice.two_months || ''}
                  onChange={(e) => setNewBasePrice({...newBasePrice, two_months: Number(e.target.value)})}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">3 أشهر</Label>
                <Input
                  type="number"
                  value={newBasePrice.three_months || ''}
                  onChange={(e) => setNewBasePrice({...newBasePrice, three_months: Number(e.target.value)})}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">6 أشهر</Label>
                <Input
                  type="number"
                  value={newBasePrice.six_months || ''}
                  onChange={(e) => setNewBasePrice({...newBasePrice, six_months: Number(e.target.value)})}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">سنة كاملة</Label>
                <Input
                  type="number"
                  value={newBasePrice.full_year || ''}
                  onChange={(e) => setNewBasePrice({...newBasePrice, full_year: Number(e.target.value)})}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">يومي</Label>
                <Input
                  type="number"
                  value={newBasePrice.one_day || ''}
                  onChange={(e) => setNewBasePrice({...newBasePrice, one_day: Number(e.target.value)})}
                />
              </div>
            </div>
          </div>
          <DialogFooter className="gap-2 border-t border-border pt-3">
            <Button variant="outline" className="cursor-pointer" onClick={() => setAddBasePriceOpen(false)}>إلغاء</Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer" onClick={addNewBasePrice}>
              <Plus className="h-4 w-4 ml-1.5" />
              إضافة السعر
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* دايلوج إضافة فئة جديدة */}
      <Dialog open={addCategoryOpen} onOpenChange={setAddCategoryOpen}>
        <DialogContent dir="rtl" className="sm:max-w-md text-right">
          <DialogHeader className="border-b border-border pb-3 text-right">
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Users className="h-4 w-4 text-primary" />
              إضافة فئة عملاء جديدة
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3.5 py-3">
            <div className="space-y-1">
              <Label className="text-xs">اسم الفئة</Label>
              <Input
                value={newCategory.category_name}
                onChange={(e) => setNewCategory({...newCategory, category_name: e.target.value})}
                placeholder="مثال: جهات حكومية"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">قيمة المعامل (1.00 = السعر الأساسي)</Label>
              <Input
                type="number"
                step="0.05"
                min="0.1"
                max="2.0"
                value={newCategory.factor}
                onChange={(e) => setNewCategory({...newCategory, factor: Number(e.target.value)})}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">الوصف</Label>
              <Input
                value={newCategory.description}
                onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
                placeholder="وصف الفئة ونسبة الخصم أو الزيادة"
              />
            </div>
          </div>
          <DialogFooter className="gap-2 border-t border-border pt-3">
            <Button variant="outline" className="cursor-pointer" onClick={() => setAddCategoryOpen(false)}>إلغاء</Button>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 cursor-pointer" onClick={addNewCategory}>
              <Plus className="h-4 w-4 ml-1.5" />
              إضافة الفئة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

    </div>
  );
}
