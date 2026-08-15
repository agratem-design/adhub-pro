import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Image as ImageIcon, Plus, Check, Trash2, Loader2, Edit2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ImageUploadZone } from '@/components/ui/image-upload-zone';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { normalizeGoogleImageUrl } from '@/utils/imageUtils';

interface PrintBackground {
  id: string;
  name: string;
  url: string;
  thumbnail_url?: string;
  logo_url?: string;
  logo_size?: string;
  category: string;
  is_default: boolean;
  usage_count: number;
}

interface BackgroundSelectorProps {
  value: string;
  onChange: (url: string) => void;
  compact?: boolean;
}

export function BackgroundSelector({ value, onChange, compact = false }: BackgroundSelectorProps) {
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [newName, setNewName] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newLogoUrl, setNewLogoUrl] = useState('');
  const [newLogoSize, setNewLogoSize] = useState('200px');

  // Edit dialog state
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [editingBg, setEditingBg] = useState<PrintBackground | null>(null);
  const [editName, setEditName] = useState('');
  const [editUrl, setEditUrl] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [editLogoSize, setEditLogoSize] = useState('200px');

  // جلب الخلفيات
  const { data: backgrounds = [], isLoading } = useQuery({
    queryKey: ['print-backgrounds'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('print_backgrounds')
        .select('*')
        .order('usage_count', { ascending: false });
      if (error) throw error;
      return (data || []) as PrintBackground[];
    },
  });

  // إضافة خلفية جديدة
  const addMutation = useMutation({
    mutationFn: async ({ name, url, logo_url, logo_size }: { name: string; url: string; logo_url: string; logo_size: string }) => {
      const { error } = await supabase
        .from('print_backgrounds')
        .insert({ name, url, logo_url, logo_size });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['print-backgrounds'] });
      toast.success('تم إضافة الخلفية والشعار الخاص بها وحجمه بنجاح');
      setShowAddDialog(false);
      setNewName('');
      setNewUrl('');
      setNewLogoUrl('');
      setNewLogoSize('200px');
    },
    onError: (err: any) => {
      toast.error('فشل إضافة الخلفية: ' + (err?.message || 'خطأ غير معروف'));
    },
  });

  // تعديل خلفية موجودة
  const editMutation = useMutation({
    mutationFn: async ({ id, name, url, logo_url, logo_size }: { id: string; name: string; url: string; logo_url: string; logo_size: string }) => {
      const { error } = await supabase
        .from('print_backgrounds')
        .update({ name, url, logo_url, logo_size })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['print-backgrounds'] });
      toast.success('تم تحديث الخلفية والشعار وحجمه بنجاح');
      setShowEditDialog(false);
      setEditingBg(null);
    },
    onError: (err: any) => {
      toast.error('فشل تحديث الخلفية: ' + (err?.message || 'خطأ غير معروف'));
    },
  });

  // حذف خلفية
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('print_backgrounds')
        .delete()
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['print-backgrounds'] });
      toast.success('تم حذف الخلفية');
    },
  });

  // تحديث عداد الاستخدام
  const updateUsage = async (id: string) => {
    await supabase
      .from('print_backgrounds')
      .update({ usage_count: (backgrounds.find(b => b.id === id)?.usage_count || 0) + 1 })
      .eq('id', id);
  };

  const handleSelect = (bg: PrintBackground) => {
    onChange(bg.url);
    updateUsage(bg.id);
  };

  const startEdit = (bg: PrintBackground) => {
    setEditingBg(bg);
    setEditName(bg.name);
    setEditUrl(bg.url);
    setEditLogoUrl(bg.logo_url || '');
    setEditLogoSize(bg.logo_size || '200px');
    setShowEditDialog(true);
  };

  const currentBg = backgrounds.find(b => b.url === value);

  // Mini cover page live blueprint renderer helper with dual tabs (Cover vs Background Only)
  const renderCoverPreview = (bgUrl: string, logoUrl: string, logoSizeStr: string) => {
    // Parse numeric size from logoSizeStr (supports px or mm or raw numbers)
    const rawVal = parseFloat(logoSizeStr) || 220;
    // Calculate exact percentage of A4 page width (794px = 210mm)
    const logoPercent = logoSizeStr?.endsWith('mm') 
      ? (rawVal / 210) * 100 
      : (rawVal / 794) * 100;
    const logoMm = (logoPercent / 100) * 210;

    const normalizedBgUrl = normalizeGoogleImageUrl(bgUrl);
    const normalizedLogoUrl = normalizeGoogleImageUrl(logoUrl) || '/logofaresgold.svg';

    return (
      <div className="flex flex-col gap-3 p-4 bg-slate-900/90 border border-slate-700/80 rounded-2xl text-slate-100 shadow-2xl dir-rtl w-full">
        {/* Header strip */}
        <div className="flex items-center justify-between border-b border-slate-700/60 pb-2.5 px-1">
          <span className="text-xs font-black text-amber-400 flex items-center gap-1.5 shrink-0">
            <Eye className="h-4 w-4 text-amber-400" /> معاينة الغلاف (A4)
          </span>
          <span className="text-[11px] font-mono bg-amber-500/15 text-amber-300 px-2.5 py-0.5 rounded-lg border border-amber-500/30 font-extrabold shrink-0">
            {logoSizeStr || '220px'} ({Math.round(logoMm)}mm)
          </span>
        </div>

        <Tabs defaultValue="cover_full" className="w-full">
          <TabsList className="grid grid-cols-2 bg-slate-850 p-1 rounded-xl border border-slate-700/80 h-10">
            <TabsTrigger 
              value="cover_full" 
              className="text-[11px] font-extrabold text-slate-300 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 transition-all rounded-lg h-8"
            >
              الشعار والنصوص فقط
            </TabsTrigger>
            <TabsTrigger 
              value="bg_isolated" 
              className="text-[11px] font-extrabold text-slate-300 data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 transition-all rounded-lg h-8"
            >
              معاينة الخلفية لوحدها
            </TabsTrigger>
          </TabsList>

          {/* 1. Clean Logo & Texts Preview (Unified Flex Column Component Flow) */}
          <TabsContent value="cover_full" className="mt-4 flex flex-col items-center">
            <div 
              className="w-[210px] aspect-[210/297] bg-white text-black border-2 border-slate-300 rounded-2xl shadow-2xl relative overflow-hidden flex flex-col items-center justify-start p-3 font-sans select-none transition-all"
            >
              {/* Flow component container */}
              <div 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] flex flex-col items-center justify-center gap-3 text-center transition-all duration-200"
              >
                {/* Logo component */}
                <div style={{ width: `${logoPercent}%` }} className="flex items-center justify-center mx-auto text-center transition-all duration-200">
                  <img 
                    src={normalizedLogoUrl} 
                    alt="شعار المعاينة" 
                    className="w-full h-auto object-contain object-center block mx-auto"
                    onError={(e) => { (e.target as any).src = '/logofaresgold.svg'; }}
                  />
                </div>

                {/* Text components: Phrase + Municipality Name */}
                <div className="flex flex-col items-center justify-center gap-1 text-center w-full mx-auto">
                  <div className="text-[11px] font-black text-slate-900 tracking-wide leading-tight text-center w-full">لوحات بلدية</div>
                  <div className="text-[13px] font-black text-amber-600 leading-tight text-center w-full">عين زارة / طرابلس</div>
                </div>
              </div>
            </div>
            <p className="text-[11px] text-slate-400 mt-3 text-center font-medium">
              معاينة تدفق الشعار والنصوص كمكوّن متصل ومستقل عن التداخل على (A4)
            </p>
          </TabsContent>

          {/* 2. Isolated Background Image Preview */}
          <TabsContent value="bg_isolated" className="mt-4 flex flex-col items-center">
            <div className="w-[210px] aspect-[210/297] bg-slate-950 border-2 border-slate-700 rounded-2xl shadow-2xl overflow-hidden relative flex items-center justify-center">
              {normalizedBgUrl ? (
                <img 
                  src={normalizedBgUrl} 
                  alt="صورة الخلفية منفصلة" 
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-center p-4 text-slate-500 text-xs font-bold">
                  لا توجد صورة خلفية محددة
                </div>
              )}
            </div>
            <p className="text-[11px] text-slate-400 mt-3 text-center font-medium">
              معاينة صورة خلفية الإطار فقط بدون شعار أو كتابات
            </p>
          </TabsContent>
        </Tabs>
      </div>
    );
  };

  // Render add and edit dialog content components for reuse
  const renderAddDialogContent = () => (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 text-right">
      {/* Left side: Inputs (7 cols) */}
      <div className="md:col-span-7 space-y-3.5">
        <div>
          <Label className="text-xs font-black text-foreground">اسم القالب *</Label>
          <Input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="مثال: خلفية الفارس الفضية"
            className="rounded-xl border-border bg-background text-foreground font-bold h-10 mt-1.5 shadow-sm"
          />
        </div>

        {/* Logo size slider & presets */}
        <div className="space-y-2.5 bg-slate-900/60 border border-slate-800 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-black text-amber-400">
              تكبير/تحديد عرض الشعار: <span className="font-mono text-white text-xs font-black dir-ltr inline-block ml-1">{newLogoSize || '200px'}</span>
            </Label>
            <span className="text-[10px] text-slate-400 font-mono">100px - 2000px</span>
          </div>

          <div className="flex items-center gap-3">
            <Slider
              value={[parseFloat(newLogoSize) || 200]}
              min={100}
              max={2000}
              step={10}
              onValueChange={([val]) => setNewLogoSize(`${val}px`)}
              className="flex-1"
            />
            <Input
              value={newLogoSize}
              onChange={(e) => setNewLogoSize(e.target.value)}
              placeholder="200px"
              className="w-24 rounded-xl border-slate-700 bg-slate-950 text-amber-400 font-mono text-xs font-black h-9 text-center"
            />
          </div>

          <div className="flex gap-1.5 flex-wrap pt-0.5">
            {['150px', '250px', '400px', '600px', '800px', '1000px', '1500px', '2000px'].map(size => (
              <button
                type="button"
                key={size}
                onClick={() => setNewLogoSize(size)}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-black border transition-all ${
                  newLogoSize === size
                    ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm font-extrabold'
                    : 'bg-slate-850 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-black text-foreground">صورة الخلفية للورقة *</Label>
            <ImageUploadZone
              value={newUrl}
              onChange={(url) => setNewUrl(url)}
              imageName={`bg-${newName || 'background'}`}
              folder="print-backgrounds"
              label="رفع الخلفية"
              showUrlInput={true}
              showPreview={true}
              previewHeight="h-20"
              dropZoneHeight="h-16"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-black text-foreground">الشعار المرتبط بالخلفية</Label>
            <ImageUploadZone
              value={newLogoUrl}
              onChange={(url) => setNewLogoUrl(url)}
              imageName={`bg-logo-${newName || 'background'}`}
              folder="print-backgrounds"
              label="رفع الشعار"
              showUrlInput={true}
              showPreview={true}
              previewHeight="h-20"
              dropZoneHeight="h-16"
            />
          </div>
        </div>

        <Button
          onClick={() => addMutation.mutate({ name: newName, url: newUrl, logo_url: newLogoUrl, logo_size: newLogoSize })}
          disabled={!newName || !newUrl || addMutation.isPending}
          className="w-full h-11 rounded-xl font-black text-sm bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg mt-2"
        >
          {addMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'إضافة الخلفية الجديدة'
          )}
        </Button>
      </div>

      {/* Right side: Live Cover Preview Blueprint (5 cols) */}
      <div className="md:col-span-5 flex flex-col justify-center">
        {renderCoverPreview(newUrl, newLogoUrl, newLogoSize)}
      </div>
    </div>
  );

  const renderEditDialogContent = () => (
    <div className="grid grid-cols-1 md:grid-cols-12 gap-5 text-right">
      {/* Left side: Inputs (7 cols) */}
      <div className="md:col-span-7 space-y-3.5">
        <div>
          <Label className="text-xs font-black text-foreground">اسم القالب *</Label>
          <Input
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="مثال: خلفية الفارس الذهبية"
            className="rounded-xl border-border bg-background text-foreground font-bold h-10 mt-1.5 shadow-sm"
          />
        </div>

        {/* Logo size slider & presets */}
        <div className="space-y-2.5 bg-slate-900/60 border border-slate-800 p-3.5 rounded-2xl">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-black text-amber-400">
              تكبير/تحديد عرض الشعار: <span className="font-mono text-white text-xs font-black dir-ltr inline-block ml-1">{editLogoSize || '200px'}</span>
            </Label>
            <span className="text-[10px] text-slate-400 font-mono">100px - 2000px</span>
          </div>

          <div className="flex items-center gap-3">
            <Slider
              value={[parseFloat(editLogoSize) || 200]}
              min={100}
              max={2000}
              step={10}
              onValueChange={([val]) => setEditLogoSize(`${val}px`)}
              className="flex-1"
            />
            <Input
              value={editLogoSize}
              onChange={(e) => setEditLogoSize(e.target.value)}
              placeholder="200px"
              className="w-24 rounded-xl border-slate-700 bg-slate-950 text-amber-400 font-mono text-xs font-black h-9 text-center"
            />
          </div>

          <div className="flex gap-1.5 flex-wrap pt-0.5">
            {['150px', '250px', '400px', '600px', '800px', '1000px', '1500px', '2000px'].map(size => (
              <button
                type="button"
                key={size}
                onClick={() => setEditLogoSize(size)}
                className={`px-2 py-1 rounded-lg text-[10px] font-mono font-black border transition-all ${
                  editLogoSize === size
                    ? 'bg-amber-500 text-slate-950 border-amber-500 shadow-sm font-extrabold'
                    : 'bg-slate-850 border-slate-700/80 text-slate-300 hover:bg-slate-800'
                }`}
              >
                {size}
              </button>
            ))}
          </div>
        </div>
        
        <div className="grid grid-cols-2 gap-3 pt-1">
          <div className="space-y-1.5">
            <Label className="text-xs font-black text-foreground">صورة الخلفية للورقة *</Label>
            <ImageUploadZone
              value={editUrl}
              onChange={(url) => setEditUrl(url)}
              imageName={`bg-${editName || 'background'}`}
              folder="print-backgrounds"
              label="تعديل الخلفية"
              showUrlInput={true}
              showPreview={true}
              previewHeight="h-20"
              dropZoneHeight="h-16"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-black text-foreground">الشعار المرتبط بالخلفية</Label>
            <ImageUploadZone
              value={editLogoUrl}
              onChange={(url) => setEditLogoUrl(url)}
              imageName={`bg-logo-${editName || 'background'}`}
              folder="print-backgrounds"
              label="تعديل الشعار"
              showUrlInput={true}
              showPreview={true}
              previewHeight="h-20"
              dropZoneHeight="h-16"
            />
          </div>
        </div>

        <Button
          onClick={() => {
            if (editingBg) {
              editMutation.mutate({ id: editingBg.id, name: editName, url: editUrl, logo_url: editLogoUrl, logo_size: editLogoSize });
            }
          }}
          disabled={!editName || !editUrl || editMutation.isPending}
          className="w-full h-11 rounded-xl font-black text-sm bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg mt-2"
        >
          {editMutation.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            'حفظ التعديلات في قاعدة البيانات'
          )}
        </Button>
      </div>

      {/* Right side: Live Cover Preview Blueprint (5 cols) */}
      <div className="md:col-span-5 flex flex-col justify-center">
        {renderCoverPreview(editUrl, editLogoUrl, editLogoSize)}
      </div>
    </div>
  );

  if (compact) {
    return (
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 gap-2 border-border/15 bg-background/50 hover:bg-muted/40">
            <ImageIcon className="h-3 w-3 text-primary" />
            <span className="text-xs truncate max-w-[100px] font-bold">
              {currentBg?.name || 'اختر خلفية'}
            </span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-80 p-3 rounded-2xl border border-border/15 bg-popover/98 backdrop-blur-md" align="start" dir="rtl">
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-border/10 pb-2">
              <Label className="text-xs font-bold text-foreground">قوالب الخلفية</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 text-[10px] font-extrabold text-primary hover:bg-primary/10 gap-1 rounded-lg"
                onClick={() => setShowAddDialog(true)}
              >
                <Plus className="h-3.5 w-3.5" />
                إضافة قالب
              </Button>
            </div>
            
            <ScrollArea className="h-[220px] pr-1">
              <div className="grid grid-cols-3 gap-2 pb-2">
                <button
                  onClick={() => onChange('')}
                  className={`aspect-[210/297] rounded-xl border-2 flex items-center justify-center text-xs font-bold text-muted-foreground hover:bg-muted/50 transition-all ${
                    !value ? 'border-primary bg-primary/8 text-primary shadow' : 'border-dashed border-border/20'
                  }`}
                >
                  بدون خلفية
                </button>
                
                {backgrounds.map((bg) => (
                  <div
                    key={bg.id}
                    onClick={() => handleSelect(bg)}
                    className={`aspect-[210/297] rounded-xl border-2 overflow-hidden relative group cursor-pointer transition-all ${
                      value === bg.url ? 'border-primary ring-2 ring-primary/20 shadow' : 'border-border/15'
                    }`}
                  >
                    <img 
                      src={bg.thumbnail_url || bg.url} 
                      alt={bg.name}
                      className="w-full h-full object-cover"
                    />
                    {value === bg.url && (
                      <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                        <Check className="h-4 w-4 text-primary" />
                      </div>
                    )}
                    
                    {/* Hover actions: Edit & Delete */}
                    <div className="absolute top-1 left-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(bg);
                        }}
                        className="p-1.5 bg-background/90 text-primary border border-border/10 rounded-lg hover:bg-primary hover:text-primary-foreground shadow transition-colors"
                        title="تعديل"
                      >
                        <Edit2 className="h-2.5 w-2.5" />
                      </button>
                      {!bg.is_default && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            deleteMutation.mutate(bg.id);
                          }}
                          className="p-1.5 bg-destructive/90 text-destructive-foreground rounded-lg hover:bg-destructive shadow transition-colors"
                          title="حذف"
                        >
                          <Trash2 className="h-2.5 w-2.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
          
          <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
            <DialogContent className="max-w-2xl border-border/10 rounded-3xl bg-background/98 backdrop-blur-xl shadow-2xl p-6" dir="rtl">
              <DialogHeader>
                <DialogTitle className="font-extrabold text-base">إضافة خلفية جديدة وشعار</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  أدخل اسم القالب، وصورة الخلفية للورقة، والشعار الخاص وحجمه المعتمد لصفحة الغلاف.
                </DialogDescription>
              </DialogHeader>
              {renderAddDialogContent()}
            </DialogContent>
          </Dialog>

          <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
            <DialogContent className="max-w-2xl border-border/10 rounded-3xl bg-background/98 backdrop-blur-xl shadow-2xl p-6" dir="rtl">
              <DialogHeader>
                <DialogTitle className="font-extrabold text-base">تعديل قالب الخلفية والشعار</DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  تعديل اسم القالب، صورة الخلفية للورقة، والشعار المرتبط بها وحجمه في المعاينة.
                </DialogDescription>
              </DialogHeader>
              {renderEditDialogContent()}
            </DialogContent>
          </Dialog>
        </PopoverContent>
      </Popover>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1">
          <ImageIcon className="h-3.5 w-3.5 text-primary" /> خلفية الطباعة والشعارات المرتبطة
        </Label>
        <Button
          variant="outline"
          type="button"
          size="sm"
          onClick={() => setShowAddDialog(true)}
          className="h-8 px-3 rounded-lg border-primary/25 bg-primary/5 text-primary hover:bg-primary/10 gap-1 text-[10px] font-black"
        >
          <Plus className="h-3.5 w-3.5" />
          إضافة خلفية جديدة
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <ScrollArea className="h-[160px] pr-1">
          <div className="grid grid-cols-4 gap-2.5 pb-2">
            <button
              type="button"
              onClick={() => onChange('')}
              className={`aspect-[210/297] rounded-xl border-2 flex items-center justify-center text-xs font-black text-muted-foreground hover:bg-muted/50 transition-all ${
                !value ? 'border-primary bg-primary/8 text-primary shadow' : 'border-dashed border-border/20'
              }`}
            >
              بدون خلفية
            </button>
            
            {backgrounds.map((bg) => (
              <div
                key={bg.id}
                onClick={() => handleSelect(bg)}
                className={`aspect-[210/297] rounded-xl border-2 overflow-hidden relative group cursor-pointer transition-all ${
                  value === bg.url ? 'border-primary ring-2 ring-primary/20 shadow' : 'border-border/15'
                }`}
                title={bg.name}
              >
                <img 
                  src={bg.thumbnail_url || bg.url} 
                  alt={bg.name}
                  className="w-full h-full object-cover"
                />
                {value === bg.url && (
                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                    <Check className="h-5 w-5 text-primary" />
                  </div>
                )}
                
                <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[9px] font-bold p-1 truncate text-center">
                  {bg.name}
                </div>

                {/* Hover actions: Edit & Delete */}
                <div className="absolute top-1 left-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      startEdit(bg);
                    }}
                    className="p-1.5 bg-background/90 text-primary border border-border/10 rounded-lg hover:bg-primary hover:text-primary-foreground shadow transition-colors"
                    title="تعديل"
                  >
                    <Edit2 className="h-2.5 w-2.5" />
                  </button>
                  {!bg.is_default && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteMutation.mutate(bg.id);
                      }}
                      className="p-1.5 bg-destructive/90 text-destructive-foreground rounded-lg hover:bg-destructive shadow transition-colors"
                      title="حذف"
                    >
                      <Trash2 className="h-2.5 w-2.5" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      )}

      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="max-w-4xl border-slate-700/80 rounded-3xl bg-slate-900 text-slate-100 shadow-2xl p-6" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-black text-lg text-amber-400">إضافة خلفية جديدة وشعار</DialogTitle>
            <DialogDescription className="text-xs text-slate-300 font-medium mt-1">
              قم بإدخال اسم القالب، وصورة الخلفية للورقة، والشعار الخاص وحجمه المعتمد لصفحة الغلاف.
            </DialogDescription>
          </DialogHeader>
          {renderAddDialogContent()}
        </DialogContent>
      </Dialog>

      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="max-w-4xl border-slate-700/80 rounded-3xl bg-slate-900 text-slate-100 shadow-2xl p-6" dir="rtl">
          <DialogHeader>
            <DialogTitle className="font-black text-lg text-amber-400">تعديل قالب الخلفية والشعار</DialogTitle>
            <DialogDescription className="text-xs text-slate-300 font-medium mt-1">
              تعديل اسم القالب، صورة الخلفية للورقة، والشعار المرتبط بها وحجمه في المعاينة.
            </DialogDescription>
          </DialogHeader>
          {renderEditDialogContent()}
        </DialogContent>
      </Dialog>
    </div>
  );
}
