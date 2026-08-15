import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { MapPin, Users, Calculator, Save, Plus, Edit2, Trash2, Printer, RefreshCw, Download, Eye, Filter, LayoutGrid, FileText } from 'lucide-react';
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

export default function PricingFactors() {
  const { canEdit: canEditAuth } = useAuth();
  const canEditSection = canEditAuth('pricing_factors');
  const [municipalityFactors, setMunicipalityFactors] = useState<MunicipalityFactor[]>([]);
  const [categoryFactors, setCategoryFactors] = useState<CategoryFactor[]>([]);
  const [basePrices, setBasePrices] = useState<BasePrice[]>([]);
  const [sizes, setSizes] = useState<SizeData[]>([]);
  const [loading, setLoading] = useState(true);
  
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
  
  // فلاتر معاينة الأسعار
  const [previewMunicipality, setPreviewMunicipality] = useState<string>('');
  const [previewCategory, setPreviewCategory] = useState<string>('');

  // حالات الطباعة
  const [printOpen, setPrintOpen] = useState(false);
  const [printCategory, setPrintCategory] = useState('');
  const [printType, setPrintType] = useState<'category' | 'municipalities'>('category');

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

  // حساب الأسعار مع الفلاتر
  const filteredPrices = useMemo(() => {
    const municipalityFactor = municipalityFactors.find(m => m.municipality_name === previewMunicipality)?.factor || 1;
    const categoryFactor = categoryFactors.find(c => c.category_name === previewCategory)?.factor || 1;
    
    return basePrices.map(bp => ({
      ...bp,
      calculated_one_month: Math.round((bp.one_month || 0) * municipalityFactor * categoryFactor),
      calculated_two_months: Math.round((bp.two_months || 0) * municipalityFactor * categoryFactor),
      calculated_three_months: Math.round((bp.three_months || 0) * municipalityFactor * categoryFactor),
      calculated_six_months: Math.round((bp.six_months || 0) * municipalityFactor * categoryFactor),
      calculated_full_year: Math.round((bp.full_year || 0) * municipalityFactor * categoryFactor),
      calculated_one_day: Math.round((bp.one_day || 0) * municipalityFactor * categoryFactor),
    }));
  }, [basePrices, municipalityFactors, categoryFactors, previewMunicipality, previewCategory]);

  const currentMunicipalityFactor = municipalityFactors.find(m => m.municipality_name === previewMunicipality)?.factor || 1;
  const currentCategoryFactor = categoryFactors.find(c => c.category_name === previewCategory)?.factor || 1;

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
      
      toast.success('تم حفظ المعامل بنجاح');
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
      
      toast.success('تم حفظ المعامل بنجاح');
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
      
      toast.success('تم حفظ السعر بنجاح');
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
      
      const { error } = await supabase
        .from('base_prices')
        .insert([insertData]);

      if (error) throw error;
      
      toast.success('تم إضافة السعر بنجاح');
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
      if (error.code === '23505') {
        toast.error('هذا المقاس موجود بالفعل');
      } else {
        toast.error('فشل في الإضافة');
      }
    }
  };

  // إضافة فئة جديدة
  const [addCategoryOpen, setAddCategoryOpen] = useState(false);
  const [newCategory, setNewCategory] = useState({ category_name: '', factor: 1.0, description: '' });

  const addNewCategory = async () => {
    if (!newCategory.category_name) {
      toast.error('يرجى إدخال اسم الفئة');
      return;
    }
    
    try {
      const { error } = await supabase
        .from('category_factors')
        .insert([newCategory]);

      if (error) throw error;
      
      toast.success('تم إضافة الفئة بنجاح');
      setAddCategoryOpen(false);
      setNewCategory({ category_name: '', factor: 1.0, description: '' });
      loadData();
    } catch (error: any) {
      console.error('Error adding:', error);
      toast.error('فشل في الإضافة');
    }
  };

  // دالة إنشاء HTML لطباعة معاملات البلديات (كروت أفقية)
  const buildMunicipalitiesPrintHtml = () => {
    const today = new Date().toLocaleDateString('ar-LY');
    
    const cards = municipalityFactors.map(m => `
      <div class="card">
        <div class="card-name">${m.municipality_name}</div>
        <div class="card-factor">${m.factor}x</div>
      </div>
    `).join('');

    return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>معاملات البلديات</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    body {
      font-family: 'Cairo', sans-serif;
      background: #1a1a1a;
      margin: 0;
      padding: 0;
    }

    .page {
      width: 210mm;
      height: 297mm;
      margin: 0 auto;
      position: relative;
      background: linear-gradient(145deg, #0d0d0d 0%, #1a1a1a 30%, #252525 60%, #1f1f1f 100%);
      padding: 10mm 8mm;
      overflow: hidden;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 6mm;
      padding-bottom: 4mm;
      border-bottom: 2px solid rgba(212, 175, 55, 0.3);
    }

    .logo-area { width: 60mm; }
    .logo { width: 55mm; height: auto; }

    .title-area { text-align: left; }

    .main-title {
      font-size: 20pt;
      font-weight: 800;
      color: #d4af37;
    }

    .subtitle {
      font-size: 10pt;
      color: rgba(255, 255, 255, 0.8);
      font-weight: 600;
    }

    .cards-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 2.5mm;
    }

    .card {
      background: rgba(40, 40, 40, 0.9);
      border: 1px solid rgba(212, 175, 55, 0.4);
      border-radius: 3mm;
      padding: 2.5mm 3mm;
      text-align: center;
      display: flex;
      flex-direction: column;
      justify-content: center;
      min-height: 12mm;
    }

    .card-name {
      font-size: 8pt;
      font-weight: 700;
      color: #ffffff;
      margin-bottom: 0.5mm;
      line-height: 1.2;
    }

    .card-factor {
      font-size: 10pt;
      font-weight: 800;
      color: #d4af37;
    }

    .footer {
      position: absolute;
      bottom: 8mm;
      left: 8mm;
      right: 8mm;
      display: flex;
      justify-content: space-between;
      padding-top: 3mm;
      border-top: 1px solid rgba(212, 175, 55, 0.2);
      font-size: 8pt;
      color: rgba(255, 255, 255, 0.5);
    }

    .print-btn {
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      padding: 14px 35px;
      background: linear-gradient(135deg, #d4af37 0%, #f4d03f 100%);
      color: #1a1a1a;
      border: none;
      border-radius: 10px;
      font-weight: 700;
      cursor: pointer;
      font-size: 16px;
      font-family: 'Cairo', sans-serif;
      z-index: 1000;
    }

    @media print {
      html, body { 
        width: 210mm; 
        height: 297mm; 
        margin: 0; 
        padding: 0;
        background: #1a1a1a;
      }
      .page { 
        width: 210mm; 
        height: 297mm; 
        margin: 0; 
        padding: 10mm 8mm;
      }
      .print-btn { display: none !important; }
      @page { 
        size: A4 portrait; 
        margin: 0; 
      }
    }
  </style>
</head>
<body>
  <div class="page">
    <div class="header">
      <div class="logo-area">
        <img src="${LOGO_FARES_GOLD_SRC}" class="logo" alt="شعار الفارس الذهبي" />
      </div>
      <div class="title-area">
        <h1 class="main-title">معاملات البلديات</h1>
        <div class="subtitle">${municipalityFactors.length} بلدية</div>
      </div>
    </div>
    
    <div class="cards-grid">
      ${cards}
    </div>
    
    <div class="footer">
      <div>${today}</div>
      <div style="color: rgba(212, 175, 55, 0.7);">نظام معاملات التسعير</div>
    </div>
  </div>
 <button class="print-btn" onclick="window.print()">️ طباعة</button>
</body>
</html>`;
  };

  // دالة إنشاء HTML لطباعة الأسعار حسب الفئة (صفحة واحدة فقط)
  const buildCategoryPrintHtml = (categoryName: string) => {
    const today = new Date().toLocaleDateString('ar-LY');
    const category = categoryFactors.find(c => c.category_name === categoryName);
    const categoryFactor = category?.factor || 1;
    
    // عرض جميع المقاسات من جدول sizes مرتبة حسب sort_order (حتى التي ليس لها سعر تظهر بصفر)
    const allSizesSorted = [...sizes].sort((a, b) => (a.sort_order || 999) - (b.sort_order || 999));
    
    // إنشاء صفوف الأسعار لجميع المقاسات
    const rows = allSizesSorted.map(size => {
      // البحث عن السعر الأساسي لهذا المقاس
      const bp = basePrices.find(p => p.size_name === size.name);
      const calculatePrice = (basePrice: number) => Math.round(basePrice * categoryFactor);
      
      return `
        <tr>
          <td class="size-cell">${size.name}</td>
          <td class="price-cell">${calculatePrice(bp?.one_month || 0).toLocaleString('ar-LY')}</td>
          <td class="price-cell">${calculatePrice(bp?.two_months || 0).toLocaleString('ar-LY')}</td>
          <td class="price-cell">${calculatePrice(bp?.three_months || 0).toLocaleString('ar-LY')}</td>
          <td class="price-cell">${calculatePrice(bp?.six_months || 0).toLocaleString('ar-LY')}</td>
          <td class="price-cell">${calculatePrice(bp?.full_year || 0).toLocaleString('ar-LY')}</td>
          <td class="price-cell">${calculatePrice(bp?.one_day || 0).toLocaleString('ar-LY')}</td>
        </tr>
      `;
    }).join('');

    // صفحة واحدة لجميع المقاسات
    const singlePage = `
      <div class="page">
        <div class="page-content">
          <div class="header">
            <div class="logo-area">
              <img src="${LOGO_FARES_GOLD_SRC}" class="logo" alt="شعار الفارس الذهبي" />
            </div>
            <div class="title-area">
              <h1 class="main-title">قائمة الأسعار</h1>
            </div>
          </div>
          
          <table class="prices-table">
            <thead>
              <tr>
                <th class="size-header">المقاس</th>
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

    return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <title>قائمة الأسعار - ${categoryName}</title>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
    
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    
    body {
      font-family: 'Cairo', sans-serif;
      background: #1a1a1a;
    }

    .page {
      width: 210mm;
      height: 297mm;
      margin: 0 auto 20px;
      position: relative;
      background: linear-gradient(145deg, #0d0d0d 0%, #1a1a1a 30%, #252525 60%, #1f1f1f 100%);
      overflow: hidden;
    }

    .page-break { page-break-before: always; }

    .page-content {
      position: relative;
      z-index: 1;
      padding: 18mm 12mm 15mm;
      height: 100%;
      display: flex;
      flex-direction: column;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 10mm;
      padding-bottom: 5mm;
      border-bottom: 2px solid rgba(212, 175, 55, 0.3);
    }

    .logo-area { width: 90mm; }
    .logo { width: 85mm; height: auto; }

    .title-area { text-align: left; }

    .main-title {
      font-size: 26pt;
      font-weight: 800;
      background: linear-gradient(135deg, #d4af37 0%, #f4d03f 50%, #d4af37 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 1mm;
    }

    .subtitle {
      font-size: 14pt;
      color: rgba(255, 255, 255, 0.9);
      font-weight: 700;
    }

    .municipality-name {
      font-size: 18pt;
      color: #d4af37;
      font-weight: 800;
      margin-top: 2mm;
    }

    .factors-info {
      font-size: 9pt;
      color: rgba(212, 175, 55, 0.7);
      margin-top: 1mm;
    }

    .prices-table {
      width: 100%;
      border-collapse: separate;
      border-spacing: 0;
      flex: 1;
      background: rgba(255, 255, 255, 0.02);
      border-radius: 8px;
      overflow: hidden;
      border: 1px solid rgba(212, 175, 55, 0.25);
    }

    .prices-table thead {
      background: linear-gradient(135deg, rgba(212, 175, 55, 0.18) 0%, rgba(212, 175, 55, 0.1) 100%);
    }

    .prices-table th {
      padding: 3.5mm 2mm;
      font-size: 9pt;
      font-weight: 700;
      color: #d4af37;
      text-align: center;
      border-bottom: 2px solid rgba(212, 175, 55, 0.35);
    }

    .prices-table th.size-header {
      text-align: right;
      padding-right: 4mm;
      width: 20%;
    }

    .prices-table td {
      padding: 2.5mm 1.5mm;
      text-align: center;
      border-bottom: 1px solid rgba(255, 255, 255, 0.05);
      font-size: 10pt;
      color: #ffffff;
    }

    .prices-table tr:nth-child(even) td {
      background: rgba(255, 255, 255, 0.015);
    }

    .size-cell {
      font-weight: 800;
      font-size: 11pt;
      text-align: right !important;
      padding-right: 4mm !important;
      color: #d4af37 !important;
    }

    .price-cell {
      font-weight: 600;
      font-size: 10pt;
      direction: ltr;
      color: #e8e8e8;
    }

    .footer {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-top: 6mm;
      padding-top: 3mm;
      border-top: 1px solid rgba(212, 175, 55, 0.2);
      font-size: 8pt;
      color: rgba(255, 255, 255, 0.5);
    }

    .footer-center {
      color: rgba(212, 175, 55, 0.7);
      font-weight: 600;
    }

    .footer-note {
      color: rgba(255, 255, 255, 0.7);
      font-weight: 600;
    }

    .print-btn {
      position: fixed;
      bottom: 30px;
      left: 50%;
      transform: translateX(-50%);
      padding: 14px 35px;
      background: linear-gradient(135deg, #d4af37 0%, #f4d03f 100%);
      color: #1a1a1a;
      border: none;
      border-radius: 10px;
      font-weight: 700;
      cursor: pointer;
      font-size: 16px;
      font-family: 'Cairo', sans-serif;
      z-index: 1000;
    }

    @media print {
      body { background: #0d0d0d; }
      .page { width: 100%; height: 100vh; margin: 0; }
      .print-btn { display: none !important; }
      .page-break { page-break-before: always; }
      @page { size: A4 portrait; margin: 0; }
    }
  </style>
</head>
<body>
  ${singlePage}
 <button class="print-btn" onclick="window.print()">️ طباعة القائمة</button>
</body>
</html>`;
  };

  const handlePrint = () => {
    const w = window.open('', '_blank');
    if (!w) return;
    
    if (printType === 'municipalities') {
      w.document.write(buildMunicipalitiesPrintHtml());
    } else {
      if (!printCategory) {
        toast.error('يرجى اختيار الفئة');
        return;
      }
      w.document.write(buildCategoryPrintHtml(printCategory));
    }
    
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 500);
  };

  if (loading) {
    return (
      <>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </>
    );
  }

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">نظام المعاملات</h1>
            <p className="text-muted-foreground">التسعير بناءً على السعر الأساسي × معامل البلدية × معامل الفئة</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button onClick={() => setPrintOpen(true)} className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Printer className="h-4 w-4 ml-2" />
              طباعة الأسعار
            </Button>
            <Button onClick={loadData} variant="outline">
              <RefreshCw className="h-4 w-4 ml-2" />
              تحديث
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-500/20 rounded-xl">
                  <LayoutGrid className="h-6 w-6 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">المقاسات</p>
                  <p className="text-2xl font-bold text-foreground">{basePrices.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-green-500/20 rounded-xl">
                  <MapPin className="h-6 w-6 text-green-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">البلديات</p>
                  <p className="text-2xl font-bold text-foreground">{municipalityFactors.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-purple-500/20 rounded-xl">
                  <Users className="h-6 w-6 text-purple-400" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">الفئات</p>
                  <p className="text-2xl font-bold text-foreground">{categoryFactors.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="preview-prices" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="preview-prices" className="gap-2">
              <Eye className="h-4 w-4" />
              معاينة الأسعار
            </TabsTrigger>
            <TabsTrigger value="base-prices">الأسعار الأساسية</TabsTrigger>
            <TabsTrigger value="municipalities">معاملات البلديات</TabsTrigger>
            <TabsTrigger value="categories">معاملات الفئات</TabsTrigger>
          </TabsList>

          {/* معاينة الأسعار مع الفلاتر */}
          <TabsContent value="preview-prices">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Filter className="h-5 w-5" />
                  معاينة الأسعار بعد تطبيق المعاملات
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Filters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border">
                  <div>
                    <Label className="mb-2 block">البلدية</Label>
                    <Select value={previewMunicipality || "__none__"} onValueChange={(v) => setPreviewMunicipality(v === "__none__" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر البلدية (اختياري)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">بدون تطبيق معامل بلدية</SelectItem>
                        {municipalityFactors.map(mf => (
                          <SelectItem key={mf.id} value={mf.municipality_name}>
                            {mf.municipality_name} ({mf.factor}x)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div>
                    <Label className="mb-2 block">الفئة</Label>
                    <Select value={previewCategory || "__none__"} onValueChange={(v) => setPreviewCategory(v === "__none__" ? "" : v)}>
                      <SelectTrigger>
                        <SelectValue placeholder="اختر الفئة (اختياري)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__none__">بدون تطبيق معامل فئة</SelectItem>
                        {categoryFactors.map(cf => (
                          <SelectItem key={cf.id} value={cf.category_name}>
                            {cf.category_name} ({cf.factor}x)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Applied Factors Info */}
                {(previewMunicipality || previewCategory) && (
                  <div className="flex items-center gap-4 p-3 bg-primary/10 border border-primary/20 rounded-lg">
                    <Calculator className="h-5 w-5 text-primary" />
                    <div className="flex-1">
                      <span className="text-sm font-medium">المعادلة: </span>
                      <span className="text-sm text-muted-foreground">
                        السعر الأساسي × {currentMunicipalityFactor} (بلدية) × {currentCategoryFactor} (فئة) = السعر النهائي
                      </span>
                    </div>
                    <div className="flex gap-2">
                      {previewMunicipality && (
                        <Badge variant="secondary">{previewMunicipality}: {currentMunicipalityFactor}x</Badge>
                      )}
                      {previewCategory && (
                        <Badge variant="outline">{previewCategory}: {currentCategoryFactor}x</Badge>
                      )}
                    </div>
                  </div>
                )}

                {/* Prices Table */}
                <div className="border rounded-lg overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead className="font-bold">المقاس</TableHead>
                        <TableHead className="text-center">شهر</TableHead>
                        <TableHead className="text-center">شهرين</TableHead>
                        <TableHead className="text-center">3 أشهر</TableHead>
                        <TableHead className="text-center">6 أشهر</TableHead>
                        <TableHead className="text-center">سنة</TableHead>
                        <TableHead className="text-center">يومي</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredPrices.map(bp => (
                        <TableRow key={bp.id} className="hover:bg-muted/30">
                          <TableCell className="font-bold text-primary">{bp.size_name}</TableCell>
                          <TableCell className="text-center font-medium">{bp.calculated_one_month.toLocaleString()}</TableCell>
                          <TableCell className="text-center font-medium">{bp.calculated_two_months.toLocaleString()}</TableCell>
                          <TableCell className="text-center font-medium">{bp.calculated_three_months.toLocaleString()}</TableCell>
                          <TableCell className="text-center font-medium">{bp.calculated_six_months.toLocaleString()}</TableCell>
                          <TableCell className="text-center font-medium">{bp.calculated_full_year.toLocaleString()}</TableCell>
                          <TableCell className="text-center font-medium">{bp.calculated_one_day.toLocaleString()}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* الأسعار الأساسية */}
          <TabsContent value="base-prices">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>الأسعار الأساسية حسب المقاس</CardTitle>
                <Button onClick={() => setAddBasePriceOpen(true)}>
                  <Plus className="h-4 w-4 ml-2" />
                  إضافة مقاس
                </Button>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>المقاس</TableHead>
                      <TableHead className="text-center">شهر</TableHead>
                      <TableHead className="text-center">شهرين</TableHead>
                      <TableHead className="text-center">3 أشهر</TableHead>
                      <TableHead className="text-center">6 أشهر</TableHead>
                      <TableHead className="text-center">سنة</TableHead>
                      <TableHead className="text-center">إجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {basePrices.map(bp => (
                      <TableRow key={bp.id}>
                        <TableCell className="font-bold">{bp.size_name}</TableCell>
                        <TableCell className="text-center">{bp.one_month?.toLocaleString() || 0}</TableCell>
                        <TableCell className="text-center">{bp.two_months?.toLocaleString() || 0}</TableCell>
                        <TableCell className="text-center">{bp.three_months?.toLocaleString() || 0}</TableCell>
                        <TableCell className="text-center">{bp.six_months?.toLocaleString() || 0}</TableCell>
                        <TableCell className="text-center">{bp.full_year?.toLocaleString() || 0}</TableCell>
                        <TableCell className="text-center">
                          <Button size="sm" variant="ghost" onClick={() => setEditingBasePrice(bp)}>
                            <Edit2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          </TabsContent>

          {/* معاملات البلديات */}
          <TabsContent value="municipalities">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  معاملات البلديات ({municipalityFactors.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                  {municipalityFactors.map(mf => (
                    <div 
                      key={mf.id} 
                      className="p-3 border rounded-lg hover:bg-muted/50 hover:border-primary/30 transition-all cursor-pointer group"
                      onClick={() => setEditingMunicipality(mf)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-sm">{mf.municipality_name}</span>
                        <Badge 
                          variant={mf.factor === 1 ? 'secondary' : mf.factor > 1 ? 'default' : 'outline'}
                          className="text-xs"
                        >
                          {mf.factor}x
                        </Badge>
                      </div>
                      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all"
                          style={{ width: `${Math.min(mf.factor * 50, 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* معاملات الفئات */}
          <TabsContent value="categories">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  معاملات الفئات ({categoryFactors.length})
                </CardTitle>
                <Button onClick={() => setAddCategoryOpen(true)}>
                  <Plus className="h-4 w-4 ml-2" />
                  إضافة فئة
                </Button>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {categoryFactors.map(cf => (
                    <div 
                      key={cf.id} 
                      className="p-4 border rounded-lg hover:bg-muted/50 hover:border-primary/30 transition-all cursor-pointer"
                      onClick={() => setEditingCategory(cf)}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold">{cf.category_name}</span>
                        <Badge variant={cf.factor === 1 ? 'secondary' : cf.factor > 1 ? 'destructive' : 'default'}>
                          {cf.factor}x
                          {cf.factor < 1 && ` (خصم ${Math.round((1 - cf.factor) * 100)}%)`}
                        </Badge>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-primary transition-all"
                          style={{ width: `${cf.factor * 100}%` }}
                        />
                      </div>
                      {cf.description && (
                        <p className="text-xs text-muted-foreground mt-2">{cf.description}</p>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* دايلوج تعديل معامل البلدية */}
        <Dialog open={!!editingMunicipality} onOpenChange={() => setEditingMunicipality(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تعديل معامل - {editingMunicipality?.municipality_name}</DialogTitle>
            </DialogHeader>
            {editingMunicipality && (
              <div className="space-y-4">
                <div>
                  <Label>المعامل: {editingMunicipality.factor}</Label>
                  <Slider
                    value={[editingMunicipality.factor]}
                    onValueChange={([v]) => setEditingMunicipality({...editingMunicipality, factor: v})}
                    min={0.5}
                    max={2}
                    step={0.05}
                    className="mt-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>0.5x (خصم 50%)</span>
                    <span>1x (بدون تغيير)</span>
                    <span>2x (ضعف السعر)</span>
                  </div>
                </div>
                <div>
                  <Label>الوصف</Label>
                  <Input
                    value={editingMunicipality.description || ''}
                    onChange={(e) => setEditingMunicipality({...editingMunicipality, description: e.target.value})}
                    placeholder="وصف اختياري"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingMunicipality(null)}>إلغاء</Button>
              <Button onClick={saveMunicipalityFactor}>
                <Save className="h-4 w-4 ml-2" />
                حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* دايلوج تعديل معامل الفئة */}
        <Dialog open={!!editingCategory} onOpenChange={() => setEditingCategory(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>تعديل معامل - {editingCategory?.category_name}</DialogTitle>
            </DialogHeader>
            {editingCategory && (
              <div className="space-y-4">
                <div>
                  <Label>المعامل: {editingCategory.factor}</Label>
                  <Slider
                    value={[editingCategory.factor]}
                    onValueChange={([v]) => setEditingCategory({...editingCategory, factor: v})}
                    min={0.5}
                    max={2}
                    step={0.05}
                    className="mt-2"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>0.5x (خصم 50%)</span>
                    <span>1x (بدون تغيير)</span>
                    <span>2x (ضعف السعر)</span>
                  </div>
                </div>
                <div>
                  <Label>الوصف</Label>
                  <Input
                    value={editingCategory.description || ''}
                    onChange={(e) => setEditingCategory({...editingCategory, description: e.target.value})}
                    placeholder="وصف اختياري"
                  />
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingCategory(null)}>إلغاء</Button>
              <Button onClick={saveCategoryFactor}>
                <Save className="h-4 w-4 ml-2" />
                حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* دايلوج تعديل السعر الأساسي */}
        <Dialog open={!!editingBasePrice} onOpenChange={() => setEditingBasePrice(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>تعديل أسعار - {editingBasePrice?.size_name}</DialogTitle>
            </DialogHeader>
            {editingBasePrice && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>شهر واحد</Label>
                    <Input
                      type="number"
                      value={editingBasePrice.one_month}
                      onChange={(e) => setEditingBasePrice({...editingBasePrice, one_month: Number(e.target.value)})}
                    />
                  </div>
                  <div>
                    <Label>شهرين</Label>
                    <Input
                      type="number"
                      value={editingBasePrice.two_months}
                      onChange={(e) => setEditingBasePrice({...editingBasePrice, two_months: Number(e.target.value)})}
                    />
                  </div>
                  <div>
                    <Label>3 أشهر</Label>
                    <Input
                      type="number"
                      value={editingBasePrice.three_months}
                      onChange={(e) => setEditingBasePrice({...editingBasePrice, three_months: Number(e.target.value)})}
                    />
                  </div>
                  <div>
                    <Label>6 أشهر</Label>
                    <Input
                      type="number"
                      value={editingBasePrice.six_months}
                      onChange={(e) => setEditingBasePrice({...editingBasePrice, six_months: Number(e.target.value)})}
                    />
                  </div>
                  <div>
                    <Label>سنة كاملة</Label>
                    <Input
                      type="number"
                      value={editingBasePrice.full_year}
                      onChange={(e) => setEditingBasePrice({...editingBasePrice, full_year: Number(e.target.value)})}
                    />
                  </div>
                  <div>
                    <Label>يوم واحد</Label>
                    <Input
                      type="number"
                      value={editingBasePrice.one_day}
                      onChange={(e) => setEditingBasePrice({...editingBasePrice, one_day: Number(e.target.value)})}
                    />
                  </div>
                </div>
              </div>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditingBasePrice(null)}>إلغاء</Button>
              <Button onClick={saveBasePrice}>
                <Save className="h-4 w-4 ml-2" />
                حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* دايلوج إضافة سعر أساسي */}
        <Dialog open={addBasePriceOpen} onOpenChange={setAddBasePriceOpen}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>إضافة سعر أساسي جديد</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>المقاس</Label>
                <Select 
                  value={newBasePrice.size_name} 
                  onValueChange={(v) => setNewBasePrice({...newBasePrice, size_name: v})}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر المقاس" />
                  </SelectTrigger>
                  <SelectContent>
                    {sizes.map(s => (
                      <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>شهر واحد</Label>
                  <Input
                    type="number"
                    value={newBasePrice.one_month}
                    onChange={(e) => setNewBasePrice({...newBasePrice, one_month: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <Label>شهرين</Label>
                  <Input
                    type="number"
                    value={newBasePrice.two_months}
                    onChange={(e) => setNewBasePrice({...newBasePrice, two_months: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <Label>3 أشهر</Label>
                  <Input
                    type="number"
                    value={newBasePrice.three_months}
                    onChange={(e) => setNewBasePrice({...newBasePrice, three_months: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <Label>6 أشهر</Label>
                  <Input
                    type="number"
                    value={newBasePrice.six_months}
                    onChange={(e) => setNewBasePrice({...newBasePrice, six_months: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <Label>سنة كاملة</Label>
                  <Input
                    type="number"
                    value={newBasePrice.full_year}
                    onChange={(e) => setNewBasePrice({...newBasePrice, full_year: Number(e.target.value)})}
                  />
                </div>
                <div>
                  <Label>يوم واحد</Label>
                  <Input
                    type="number"
                    value={newBasePrice.one_day}
                    onChange={(e) => setNewBasePrice({...newBasePrice, one_day: Number(e.target.value)})}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddBasePriceOpen(false)}>إلغاء</Button>
              <Button onClick={addNewBasePrice}>
                <Plus className="h-4 w-4 ml-2" />
                إضافة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* دايلوج إضافة فئة */}
        <Dialog open={addCategoryOpen} onOpenChange={setAddCategoryOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>إضافة فئة جديدة</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>اسم الفئة</Label>
                <Input
                  value={newCategory.category_name}
                  onChange={(e) => setNewCategory({...newCategory, category_name: e.target.value})}
                  placeholder="مثال: وكالات"
                />
              </div>
              <div>
                <Label>المعامل: {newCategory.factor}</Label>
                <Slider
                  value={[newCategory.factor]}
                  onValueChange={([v]) => setNewCategory({...newCategory, factor: v})}
                  min={0.5}
                  max={2}
                  step={0.05}
                  className="mt-2"
                />
              </div>
              <div>
                <Label>الوصف</Label>
                <Input
                  value={newCategory.description}
                  onChange={(e) => setNewCategory({...newCategory, description: e.target.value})}
                  placeholder="وصف اختياري"
                />
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setAddCategoryOpen(false)}>إلغاء</Button>
              <Button onClick={addNewCategory}>
                <Plus className="h-4 w-4 ml-2" />
                إضافة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* نافذة الطباعة */}
        <Dialog open={printOpen} onOpenChange={setPrintOpen}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>طباعة الأسعار</DialogTitle>
            </DialogHeader>
            <div className="space-y-6">
              {/* نوع الطباعة */}
              <div>
                <Label className="mb-3 block">نوع الطباعة</Label>
                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant={printType === 'category' ? 'default' : 'outline'}
                    className="h-auto py-4 flex flex-col gap-2"
                    onClick={() => setPrintType('category')}
                  >
                    <FileText className="h-6 w-6" />
                    <span>أسعار حسب الفئة</span>
                    <span className="text-xs opacity-70">صفحة لكل بلدية</span>
                  </Button>
                  <Button
                    variant={printType === 'municipalities' ? 'default' : 'outline'}
                    className="h-auto py-4 flex flex-col gap-2"
                    onClick={() => setPrintType('municipalities')}
                  >
                    <MapPin className="h-6 w-6" />
                    <span>معاملات البلديات</span>
                    <span className="text-xs opacity-70">جميع البلديات</span>
                  </Button>
                </div>
              </div>

              {/* اختيار الفئة (إذا كان النوع category) */}
              {printType === 'category' && (
                <div>
                  <Label className="mb-2 block">اختر الفئة السعرية</Label>
                  <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto p-2 border rounded-lg">
                    {categoryFactors.map((c) => (
                      <Button 
                        key={c.id}
                        variant={printCategory === c.category_name ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPrintCategory(c.category_name)}
                      >
                        {c.category_name} ({c.factor}x)
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {/* معلومات الطباعة */}
              <div className="p-4 bg-muted/50 rounded-lg border">
                {printType === 'category' && printCategory ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">سيتم طباعة:</p>
                    <p className="text-sm text-muted-foreground">
                      • الفئة: <strong className="text-foreground">{printCategory}</strong>
                    </p>
                    <p className="text-sm text-muted-foreground">
                      • صفحة واحدة تحتوي جميع المقاسات مع معامل الفئة
                    </p>
                  </div>
                ) : printType === 'municipalities' ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">سيتم طباعة:</p>
                    <p className="text-sm text-muted-foreground">
                      • جدول معاملات جميع البلديات ({municipalityFactors.length} بلدية)
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground text-center">اختر نوع الطباعة والفئة</p>
                )}
              </div>
            </div>
            <DialogFooter className="flex gap-2">
              <Button variant="outline" onClick={() => setPrintOpen(false)}>إلغاء</Button>
              <Button 
                onClick={handlePrint} 
                disabled={printType === 'category' && !printCategory}
              >
                <Printer className="h-4 w-4 ml-2" />
                طباعة
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </>
  );
}
