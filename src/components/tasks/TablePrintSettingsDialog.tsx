import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Save, RotateCcw, Palette, Image, Table2, FileText, GripVertical, ArrowUp, ArrowDown, Layout, Eye } from 'lucide-react';
import { TablePrintSettings, TableColumn } from '@/hooks/useTablePrintSettings';
import { BackgroundSelector } from '@/components/billboard-print/BackgroundSelector';

interface TablePrintSettingsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  settings: TablePrintSettings;
  onUpdateSetting: <K extends keyof TablePrintSettings>(key: K, value: TablePrintSettings[K]) => void;
  onSave: () => void;
  onReset: () => void;
  saving: boolean;
}

export function TablePrintSettingsDialog({
  open,
  onOpenChange,
  settings,
  onUpdateSetting,
  onSave,
  onReset,
  saving
}: TablePrintSettingsDialogProps) {
  
  // دالة لتحريك عمود للأعلى
  const moveColumnUp = (columnId: string) => {
    const columns = [...settings.columns_order];
    const index = columns.findIndex(c => c.id === columnId);
    if (index > 0) {
      [columns[index], columns[index - 1]] = [columns[index - 1], columns[index]];
      columns.forEach((c, i) => c.order = i);
      onUpdateSetting('columns_order', columns);
    }
  };

  // دالة لتحريك عمود للأسفل
  const moveColumnDown = (columnId: string) => {
    const columns = [...settings.columns_order];
    const index = columns.findIndex(c => c.id === columnId);
    if (index < columns.length - 1) {
      [columns[index], columns[index + 1]] = [columns[index + 1], columns[index]];
      columns.forEach((c, i) => c.order = i);
      onUpdateSetting('columns_order', columns);
    }
  };

  // دالة لتفعيل/تعطيل عمود
  const toggleColumn = (columnId: string, enabled: boolean) => {
    const columns = settings.columns_order.map(c => 
      c.id === columnId ? { ...c, enabled } : c
    );
    onUpdateSetting('columns_order', columns);
  };

  const sortedColumns = [...settings.columns_order].sort((a, b) => a.order - b.order);
  
  // حساب مجموع نسب الأعمدة المفعلة
  const enabledColumns = sortedColumns.filter(c => c.enabled);
  const totalWidth = enabledColumns.reduce((sum, col) => {
    const width = col.width || '8%';
    const numValue = parseFloat(width.replace('%', ''));
    return sum + (isNaN(numValue) ? 8 : numValue);
  }, 0);
  const widthDifference = totalWidth - 100;
  const isBalanced = Math.abs(widthDifference) < 0.1;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Table2 className="h-5 w-5 text-primary" />
            إعدادات طباعة الجدول
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="preview" className="w-full">
          <TabsList className="grid w-full grid-cols-6">
            <TabsTrigger value="preview" className="flex items-center gap-1">
              <Eye className="h-4 w-4" />
              معاينة
            </TabsTrigger>
            <TabsTrigger value="columns" className="flex items-center gap-1">
              <Table2 className="h-4 w-4" />
              الأعمدة
            </TabsTrigger>
            <TabsTrigger value="colors" className="flex items-center gap-1">
              <Palette className="h-4 w-4" />
              الألوان
            </TabsTrigger>
            <TabsTrigger value="images" className="flex items-center gap-1">
              <Image className="h-4 w-4" />
              الصور
            </TabsTrigger>
            <TabsTrigger value="page" className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              الصفحة
            </TabsTrigger>
            <TabsTrigger value="layout" className="flex items-center gap-1">
              <Layout className="h-4 w-4" />
              التخطيط
            </TabsTrigger>
          </TabsList>

          {/* تبويب المعاينة المباشرة */}
          <TabsContent value="preview" className="space-y-4 mt-4">
            <div className="text-sm text-muted-foreground mb-2">
              معاينة شكل الجدول كما سيظهر عند الطباعة
            </div>
            <ScrollArea className="h-[400px] border rounded-lg">
              <div 
                className="p-4" 
                style={{ 
                  fontFamily: `'${settings.primary_font}', Arial, sans-serif`,
                  direction: 'rtl'
                }}
              >
                <table 
                  style={{ 
                    width: '100%', 
                    borderCollapse: 'collapse',
                    border: `1px solid ${settings.border_color}`,
                    fontSize: settings.row_font_size
                  }}
                >
                  <thead>
                    <tr>
                      {sortedColumns.filter(c => c.enabled).map((col, idx) => (
                        <th
                          key={col.id}
                          style={{
                            background: idx === 0 ? settings.first_column_bg_color : settings.header_bg_color,
                            color: idx === 0 ? settings.first_column_text_color : settings.header_text_color,
                            padding: '8px 4px',
                            border: `1px solid ${settings.border_color}`,
                            fontSize: settings.header_font_size,
                            fontWeight: 'bold',
                            width: col.width || '8%'
                          }}
                        >
                          {col.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {[1, 2, 3, 4, 5].map((rowNum, rowIdx) => (
                      <tr 
                        key={rowNum}
                        style={{ 
                          background: rowIdx % 2 === 0 ? settings.row_bg_color : settings.row_alt_bg_color,
                          height: settings.row_height
                        }}
                      >
                        {sortedColumns.filter(c => c.enabled).map((col, colIdx) => (
                          <td
                            key={col.id}
                            style={{
                              background: colIdx === 0 ? settings.first_column_bg_color : undefined,
                              color: colIdx === 0 ? settings.first_column_text_color : settings.row_text_color,
                              padding: '4px',
                              border: `1px solid ${settings.border_color}`,
                              textAlign: 'center',
                              fontSize: settings.row_font_size
                            }}
                          >
                            {col.id === 'row_number' ? rowNum : 
                             col.id === 'billboard_image' ? (
                               <div style={{ 
                                 width: settings.billboard_image_size, 
                                 height: settings.billboard_image_size,
                                 background: '#e5e7eb',
                                 margin: '0 auto',
                                 borderRadius: '4px',
                                 display: 'flex',
                                 alignItems: 'center',
                                 justifyContent: 'center',
                                 fontSize: '8px',
                                 color: '#6b7280'
                               }}>صورة</div>
                             ) :
                             col.id === 'billboard_name' ? `لوحة نموذجية ${rowNum}` :
                             col.id === 'size' ? '4×3' :
                             col.id === 'faces_count' ? '2' :
                             col.id === 'location' ? 'طرابلس - المركز' :
                             col.id === 'landmark' ? 'بجانب المحل' :
                             col.id === 'contract_number' ? '1234' :
                             col.id === 'installation_date' ? '2026/01/09' :
                             col.id === 'design_images' ? (
                               <div style={{ 
                                 width: settings.design_image_size, 
                                 height: settings.design_image_size,
                                 background: '#dbeafe',
                                 margin: '0 auto',
                                 borderRadius: '4px',
                                 display: 'flex',
                                 alignItems: 'center',
                                 justifyContent: 'center',
                                 fontSize: '7px',
                                 color: '#3b82f6'
                               }}>تصميم</div>
                             ) :
                             col.id === 'installed_images' ? (
                               <div style={{ 
                                 width: settings.installed_image_size, 
                                 height: settings.installed_image_size,
                                 background: '#d1fae5',
                                 margin: '0 auto',
                                 borderRadius: '4px',
                                 display: 'flex',
                                 alignItems: 'center',
                                 justifyContent: 'center',
                                 fontSize: '7px',
                                 color: '#10b981'
                               }}>تركيب</div>
                             ) :
                             col.id === 'qr_code' ? (
                               <div style={{ 
                                 width: settings.qr_code_size, 
                                 height: settings.qr_code_size,
                                 background: '#f3f4f6',
                                 margin: '0 auto',
                                 borderRadius: '4px',
                                 display: 'flex',
                                 alignItems: 'center',
                                 justifyContent: 'center',
                                 fontSize: '7px',
                                 color: '#6b7280'
                               }}>QR</div>
                             ) :
                             '-'
                            }
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </ScrollArea>
            <p className="text-xs text-muted-foreground">
 هذه معاينة تقريبية. العمود الأول سيظهر ترقيم عناصر الجدول (1، 2، 3...)
            </p>
          </TabsContent>

          {/* تبويب الأعمدة - ترتيب وتفعيل وعرض */}
          <TabsContent value="columns" className="space-y-4 mt-4">
            <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border">
              <Label className="font-medium">إخفاء الأعمدة الفارغة تلقائياً</Label>
              <Switch
                checked={settings.auto_hide_empty_columns}
                onCheckedChange={(c) => onUpdateSetting('auto_hide_empty_columns', c)}
              />
            </div>
            
            <Separator />
            
            <p className="text-sm text-muted-foreground">رتب الأعمدة وتحكم في عرض كل عمود:</p>
            
            <div className="space-y-2 max-h-[350px] overflow-y-auto">
              {sortedColumns.map((column, index) => (
                <div 
                  key={column.id}
                  className={`flex items-center justify-between p-2 rounded-lg border transition-colors ${
                    column.enabled 
                      ? 'bg-background hover:bg-muted/50' 
                      : 'bg-muted/30 opacity-60'
                  }`}
                >
                  <div className="flex items-center gap-2 flex-1">
                    <GripVertical className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm font-medium min-w-[80px]">{column.label}</span>
                    <Input
                      value={column.width || '8%'}
                      onChange={(e) => {
                        const columns = settings.columns_order.map(c => 
                          c.id === column.id ? { ...c, width: e.target.value } : c
                        );
                        onUpdateSetting('columns_order', columns);
                      }}
                      className="w-16 h-7 text-xs"
                      placeholder="8%"
                      disabled={!column.enabled}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveColumnUp(column.id)}
                      disabled={index === 0}
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => moveColumnDown(column.id)}
                      disabled={index === sortedColumns.length - 1}
                    >
                      <ArrowDown className="h-3 w-3" />
                    </Button>
                    <Switch
                      checked={column.enabled}
                      onCheckedChange={(c) => toggleColumn(column.id, c)}
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* معاينة عرض الأعمدة مع مؤشر النسبة */}
            <div className="p-3 bg-muted/50 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <Label className="text-sm font-medium">معاينة نسب العرض:</Label>
                <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm font-medium ${
                  isBalanced 
                    ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                    : widthDifference > 0 
                      ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400'
                      : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                }`}>
                  <span>المجموع: {totalWidth.toFixed(1)}%</span>
                  {!isBalanced && (
                    <span className="font-bold">
                      ({widthDifference > 0 ? '+' : ''}{widthDifference.toFixed(1)}%)
                    </span>
                  )}
                </div>
              </div>
              <div className="flex gap-1 overflow-hidden rounded border bg-background">
                {enabledColumns.map(col => (
                  <div 
                    key={col.id}
                    className="text-[8px] text-center py-1 bg-primary/20 border-l last:border-l-0 truncate"
                    style={{ width: col.width || '8%', minWidth: '20px' }}
                  >
                    {col.label}
                  </div>
                ))}
              </div>
              {!isBalanced && (
                <p className="text-xs text-muted-foreground">
                  {widthDifference > 0 
 ? `️ يوجد فائض ${widthDifference.toFixed(1)}% - قم بتقليل بعض النسب`
 : `️ يوجد نقصان ${Math.abs(widthDifference).toFixed(1)}% - قم بزيادة بعض النسب`
                  }
                </p>
              )}
            </div>
          </TabsContent>

          {/* تبويب الألوان */}
          <TabsContent value="colors" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>لون خلفية العنوان</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings.header_bg_color}
                    onChange={(e) => onUpdateSetting('header_bg_color', e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings.header_bg_color}
                    onChange={(e) => onUpdateSetting('header_bg_color', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>لون نص العنوان</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings.header_text_color}
                    onChange={(e) => onUpdateSetting('header_text_color', e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings.header_text_color}
                    onChange={(e) => onUpdateSetting('header_text_color', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>لون خلفية الصف</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings.row_bg_color}
                    onChange={(e) => onUpdateSetting('row_bg_color', e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings.row_bg_color}
                    onChange={(e) => onUpdateSetting('row_bg_color', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>لون الصف البديل</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings.row_alt_bg_color}
                    onChange={(e) => onUpdateSetting('row_alt_bg_color', e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings.row_alt_bg_color}
                    onChange={(e) => onUpdateSetting('row_alt_bg_color', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>لون نص الصف</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings.row_text_color}
                    onChange={(e) => onUpdateSetting('row_text_color', e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings.row_text_color}
                    onChange={(e) => onUpdateSetting('row_text_color', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>لون الحدود</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings.border_color}
                    onChange={(e) => onUpdateSetting('border_color', e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings.border_color}
                    onChange={(e) => onUpdateSetting('border_color', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <Separator />
            
            <p className="text-sm font-medium text-muted-foreground">لون العمود الأول:</p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>لون خلفية العمود الأول</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings.first_column_bg_color}
                    onChange={(e) => onUpdateSetting('first_column_bg_color', e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings.first_column_bg_color}
                    onChange={(e) => onUpdateSetting('first_column_bg_color', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>لون نص العمود الأول</Label>
                <div className="flex gap-2">
                  <Input
                    type="color"
                    value={settings.first_column_text_color}
                    onChange={(e) => onUpdateSetting('first_column_text_color', e.target.value)}
                    className="w-12 h-10 p-1 cursor-pointer"
                  />
                  <Input
                    value={settings.first_column_text_color}
                    onChange={(e) => onUpdateSetting('first_column_text_color', e.target.value)}
                    className="flex-1"
                  />
                </div>
              </div>
            </div>

            <Separator />

            <div className="grid grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>حجم خط العنوان</Label>
                <Input
                  value={settings.header_font_size}
                  onChange={(e) => onUpdateSetting('header_font_size', e.target.value)}
                  placeholder="11px"
                />
              </div>
              <div className="space-y-2">
                <Label>حجم خط الصف</Label>
                <Input
                  value={settings.row_font_size}
                  onChange={(e) => onUpdateSetting('row_font_size', e.target.value)}
                  placeholder="10px"
                />
              </div>
              <div className="space-y-2">
                <Label>حجم عنوان الجدول</Label>
                <Input
                  value={settings.title_font_size}
                  onChange={(e) => onUpdateSetting('title_font_size', e.target.value)}
                  placeholder="16px"
                />
              </div>
            </div>
          </TabsContent>

          {/* تبويب الصور */}
          <TabsContent value="images" className="space-y-4 mt-4">
            <p className="text-sm text-muted-foreground">
              حجم الصورة يمثل الحد الأقصى للعرض أو الارتفاع (أيهما أكبر)
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>حجم صورة اللوحة</Label>
                <Input
                  value={settings.billboard_image_size}
                  onChange={(e) => onUpdateSetting('billboard_image_size', e.target.value)}
                  placeholder="35px"
                />
              </div>
              <div className="space-y-2">
                <Label>حجم صورة التصميم</Label>
                <Input
                  value={settings.design_image_size}
                  onChange={(e) => onUpdateSetting('design_image_size', e.target.value)}
                  placeholder="30px"
                />
              </div>
              <div className="space-y-2">
                <Label>حجم صورة التركيب</Label>
                <Input
                  value={settings.installed_image_size}
                  onChange={(e) => onUpdateSetting('installed_image_size', e.target.value)}
                  placeholder="30px"
                />
              </div>
              <div className="space-y-2">
                <Label>حجم رمز QR</Label>
                <Input
                  value={settings.qr_code_size || '30px'}
                  onChange={(e) => onUpdateSetting('qr_code_size', e.target.value)}
                  placeholder="30px"
                />
              </div>
            </div>

            <Separator />

            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <Label>عرض رمز QR للموقع</Label>
              <Switch
                checked={settings.show_qr_code}
                onCheckedChange={(c) => onUpdateSetting('show_qr_code', c)}
              />
            </div>
          </TabsContent>

          {/* تبويب الصفحة */}
          <TabsContent value="page" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>عنوان الصفحة</Label>
                <Input
                  value={settings.page_title}
                  onChange={(e) => onUpdateSetting('page_title', e.target.value)}
                  placeholder="جدول لوحات العقد"
                />
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>عدد الصفوف في كل صفحة</Label>
                  <Input
                    type="number"
                    min="1"
                    max="20"
                    value={settings.rows_per_page}
                    onChange={(e) => onUpdateSetting('rows_per_page', parseInt(e.target.value) || 10)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>اتجاه الصفحة</Label>
                  <Select
                    value={settings.page_orientation}
                    onValueChange={(v) => onUpdateSetting('page_orientation', v as 'portrait' | 'landscape')}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="landscape">أفقي (عرضي)</SelectItem>
                      <SelectItem value="portrait">عمودي (طولي)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>هامش الصفحة</Label>
                  <Input
                    value={settings.page_margin}
                    onChange={(e) => onUpdateSetting('page_margin', e.target.value)}
                    placeholder="8mm"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>الخط الأساسي</Label>
                <Select
                  value={settings.primary_font}
                  onValueChange={(v) => onUpdateSetting('primary_font', v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Doran">Doran</SelectItem>
                    <SelectItem value="Cairo">Cairo</SelectItem>
                    <SelectItem value="Tajawal">Tajawal</SelectItem>
                    <SelectItem value="Arial">Arial</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          {/* تبويب التخطيط والخلفية */}
          <TabsContent value="layout" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-blue-50 dark:bg-blue-950/30 rounded-lg border">
                <Label className="font-medium">تفعيل خلفية الجدول</Label>
                <Switch
                  checked={settings.table_background_enabled || false}
                  onCheckedChange={(c) => onUpdateSetting('table_background_enabled', c)}
                />
              </div>

              {settings.table_background_enabled && (
                <div className="space-y-2 p-3 bg-muted/50 rounded-lg">
                  <Label>اختر الخلفية</Label>
                  <BackgroundSelector
                    value={settings.table_background_url || '/ipg.svg'}
                    onChange={(url) => onUpdateSetting('table_background_url', url)}
                  />
                </div>
              )}

              <Separator />

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>المسافة من أعلى الصفحة</Label>
                  <Input
                    value={settings.table_top_margin || '20mm'}
                    onChange={(e) => onUpdateSetting('table_top_margin', e.target.value)}
                    placeholder="20mm"
                  />
                  <p className="text-xs text-muted-foreground">المسافة بين رأس الصفحة والجدول</p>
                </div>
                <div className="space-y-2">
                  <Label>ارتفاع الصف</Label>
                  <Input
                    value={settings.row_height || '14mm'}
                    onChange={(e) => onUpdateSetting('row_height', e.target.value)}
                    placeholder="14mm"
                  />
                  <p className="text-xs text-muted-foreground">ارتفاع صف واحد في الجدول</p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* أزرار التحكم */}
        <div className="flex gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onReset} className="flex-1">
            <RotateCcw className="h-4 w-4 ml-2" />
            إعادة تعيين
          </Button>
          <Button onClick={onSave} disabled={saving} className="flex-1">
            <Save className="h-4 w-4 ml-2" />
            {saving ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
