import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import { generateMunicipalityCode } from '@/utils/contractUtils';
import { 
  FileSpreadsheet, 
  Download, 
  Upload, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle,
  Loader2,
  FileDown,
  FileUp,
  Building2,
  Plus
} from 'lucide-react';

interface FriendCompany {
  id: string;
  name: string;
}

interface ExcelImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  municipalities: any[];
  sizes: any[];
  levels: string[];
  citiesList: string[];
  faces: any[];
  billboardTypes: string[];
  onSuccess: () => Promise<void>;
  generateBillboardName: (municipality: string, level: string, size: string, existingNames: string[], billboardId?: number) => string;
  getNextBillboardId: () => Promise<number>;
}

interface ImportRow {
  id: string;
  rowNumber: number;
  Municipality: string;
  Level: string;
  Size: string;
  City: string;
  District: string;
  Nearest_Landmark: string;
  GPS_Coordinates: string;
  Faces_Count: string;
  billboard_type: string;
  status: 'valid' | 'invalid' | 'success' | 'error';
  errors: string[];
  Billboard_Name?: string;
}

interface MissingValues {
  municipalities: string[];
  sizes: string[];
  levels: string[];
  cities: string[];
}

export const ExcelImportDialog: React.FC<ExcelImportDialogProps> = ({
  open,
  onOpenChange,
  municipalities,
  sizes,
  levels,
  citiesList,
  faces,
  billboardTypes,
  onSuccess,
  generateBillboardName,
  getNextBillboardId
}) => {
  const [importedRows, setImportedRows] = useState<ImportRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAddingMissing, setIsAddingMissing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // ✅ Friend company state
  const [isFriendImport, setIsFriendImport] = useState(false);
  const [friendCompanies, setFriendCompanies] = useState<FriendCompany[]>([]);
  const [selectedFriendCompanyId, setSelectedFriendCompanyId] = useState<string>('');

  // ✅ Dynamic reference lists (updated after adding missing values)
  const [currentMunicipalities, setCurrentMunicipalities] = useState(municipalities);
  const [currentSizes, setCurrentSizes] = useState(sizes);
  const [currentLevels, setCurrentLevels] = useState(levels);
  const [currentCities, setCurrentCities] = useState(citiesList);

  useEffect(() => {
    setCurrentMunicipalities(municipalities);
    setCurrentSizes(sizes);
    setCurrentLevels(levels);
    setCurrentCities(citiesList);
  }, [municipalities, sizes, levels, citiesList]);

  // Load friend companies when dialog opens
  useEffect(() => {
    if (!open) return;
    const loadFriendCompanies = async () => {
      const { data } = await supabase.from('friend_companies').select('id, name').order('name');
      if (data) setFriendCompanies(data);
    };
    loadFriendCompanies();
  }, [open]);

  // ✅ Collect missing values from imported rows
  const missingValues = useMemo<MissingValues>(() => {
    if (importedRows.length === 0) return { municipalities: [], sizes: [], levels: [], cities: [] };
    
    const municipalityNames = currentMunicipalities.map(m => m.name?.toLowerCase());
    const levelNames = currentLevels.map(l => l?.toLowerCase());
    const sizeNames = currentSizes.map(s => s.name?.toLowerCase());
    
    const missingMunicipalities = new Set<string>();
    const missingSizes = new Set<string>();
    const missingLevels = new Set<string>();
    const missingCities = new Set<string>();

    for (const row of importedRows) {
      if (row.Municipality && !municipalityNames.includes(row.Municipality.toLowerCase())) {
        missingMunicipalities.add(row.Municipality);
      }
      if (row.Level && !levelNames.includes(row.Level.toLowerCase())) {
        missingLevels.add(row.Level);
      }
      if (row.Size && !sizeNames.includes(row.Size.toLowerCase())) {
        missingSizes.add(row.Size);
      }
      if (row.City && row.City.trim() && !currentCities.map(c => c.toLowerCase()).includes(row.City.toLowerCase())) {
        missingCities.add(row.City);
      }
    }

    return {
      municipalities: Array.from(missingMunicipalities),
      sizes: Array.from(missingSizes),
      levels: Array.from(missingLevels),
      cities: Array.from(missingCities),
    };
  }, [importedRows, currentMunicipalities, currentSizes, currentLevels, currentCities]);

  const hasMissingValues = missingValues.municipalities.length > 0 || missingValues.sizes.length > 0 || missingValues.levels.length > 0;

  // ✅ Re-validate rows with current reference data
  const revalidateRows = (rows: ImportRow[]) => {
    const municipalityNames = currentMunicipalities.map(m => m.name?.toLowerCase());
    const levelNames = currentLevels.map(l => l?.toLowerCase());
    const sizeNames = currentSizes.map(s => s.name?.toLowerCase());

    return rows.map(row => {
      if (row.status === 'success' || row.status === 'error') return row;
      
      const errors: string[] = [];
      if (!row.Municipality) errors.push('البلدية مطلوبة');
      if (!row.Level) errors.push('المستوى مطلوب');
      if (!row.Size) errors.push('المقاس مطلوب');
      if (row.Municipality && !municipalityNames.includes(row.Municipality.toLowerCase())) {
        errors.push(`البلدية "${row.Municipality}" غير موجودة`);
      }
      if (row.Level && !levelNames.includes(row.Level.toLowerCase())) {
        errors.push(`المستوى "${row.Level}" غير موجود`);
      }
      if (row.Size && !sizeNames.includes(row.Size.toLowerCase())) {
        errors.push(`المقاس "${row.Size}" غير موجود`);
      }

      return {
        ...row,
        errors,
        status: errors.length > 0 ? 'invalid' as const : 'valid' as const,
      };
    });
  };

  // ✅ Add missing values to database
  const addMissingValues = async () => {
    setIsAddingMissing(true);
    try {
      let added = 0;

      // Add missing municipalities
      for (const name of missingValues.municipalities) {
        const code = generateMunicipalityCode(name);
        const { error } = await supabase.from('municipalities').insert({ name, code });
        if (!error) {
          setCurrentMunicipalities(prev => [...prev, { name, id: Date.now() }]);
          added++;
        } else {
          console.warn(`Failed to add municipality "${name}":`, error.message);
        }
      }

      // Add missing sizes
      for (const name of missingValues.sizes) {
        const { error } = await supabase.from('sizes').insert({ name });
        if (!error) {
          setCurrentSizes(prev => [...prev, { name, id: Date.now() }]);
          added++;
        } else {
          console.warn(`Failed to add size "${name}":`, error.message);
        }
      }

      // Add missing levels
      for (const levelCode of missingValues.levels) {
        const { error } = await supabase.from('billboard_levels').insert({
          level_code: levelCode.toUpperCase(),
          level_name: `مستوى ${levelCode}`,
          sort_order: 99
        });
        if (!error) {
          setCurrentLevels(prev => [...prev, levelCode]);
          added++;
        } else {
          console.warn(`Failed to add level "${levelCode}":`, error.message);
        }
      }

      if (added > 0) {
        toast.success(`تم إضافة ${added} قيمة جديدة — جاري إعادة التحقق...`);
        // Re-validate rows with updated reference data
        setTimeout(() => {
          setImportedRows(prev => revalidateRows(prev));
        }, 200);
      } else {
        toast.error('لم تتم إضافة أي قيم — قد تكون موجودة بالفعل');
      }
    } catch (error) {
      console.error('Error adding missing values:', error);
      toast.error('حدث خطأ أثناء إضافة القيم');
    } finally {
      setIsAddingMissing(false);
    }
  };

  // تنزيل قالب Excel
  const downloadTemplate = () => {
    const templateData = [
      {
        'البلدية': '',
        'المستوى': '',
        'المقاس': '',
        'المدينة': '',
        'المنطقة': '',
        'أقرب معلم': '',
        'الإحداثيات': '',
        'عدد الأوجه': '',
        'نوع اللوحة': ''
      }
    ];

    const exampleRows = [
      {
        'البلدية': municipalities[0]?.name || 'مثال: أبوسليم',
        'المستوى': levels[0] || 'A',
        'المقاس': sizes[0]?.name || '3x4',
        'المدينة': citiesList[0] || 'طرابلس',
        'المنطقة': 'منطقة المثال',
        'أقرب معلم': 'بالقرب من...',
        'الإحداثيات': '32.8872, 13.1913',
        'عدد الأوجه': '1',
        'نوع اللوحة': billboardTypes[0] || 'يوني بول'
      }
    ];

    const ws = XLSX.utils.json_to_sheet([...templateData, ...exampleRows]);
    ws['!cols'] = [
      { wch: 15 }, { wch: 10 }, { wch: 10 }, { wch: 12 },
      { wch: 15 }, { wch: 25 }, { wch: 20 }, { wch: 12 }, { wch: 15 },
    ];

    const refData = [
      { 'البلديات المتاحة': municipalities.map(m => m.name).join(', ') },
      { 'المستويات المتاحة': levels.join(', ') },
      { 'المقاسات المتاحة': sizes.map(s => s.name).join(', ') },
      { 'المدن المتاحة': citiesList.join(', ') },
      { 'أنواع اللوحات': billboardTypes.join(', ') },
    ];
    const refWs = XLSX.utils.json_to_sheet(refData);
    refWs['!cols'] = [{ wch: 100 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'اللوحات');
    XLSX.utils.book_append_sheet(wb, refWs, 'المراجع');

    XLSX.writeFile(wb, 'قالب_استيراد_اللوحات.xlsx');
    toast.success('تم تنزيل القالب');
  };

  // قراءة ملف Excel
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);
    
    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const jsonData = XLSX.utils.sheet_to_json(worksheet) as Record<string, any>[];

      if (jsonData.length === 0) {
        toast.error('الملف فارغ');
        return;
      }

      const municipalityNames = currentMunicipalities.map(m => m.name?.toLowerCase());
      const levelNames = currentLevels.map(l => l?.toLowerCase());
      const sizeNames = currentSizes.map(s => s.name?.toLowerCase());

      const rows: ImportRow[] = jsonData.map((row, index) => {
        const errors: string[] = [];
        
        const municipality = String(row['البلدية'] || '').trim();
        const level = String(row['المستوى'] || '').trim();
        const size = String(row['المقاس'] || '').trim();

        if (!municipality) errors.push('البلدية مطلوبة');
        if (!level) errors.push('المستوى مطلوب');
        if (!size) errors.push('المقاس مطلوب');

        // ✅ رسائل خطأ تفصيلية مع ذكر القيمة المرفوضة
        if (municipality && !municipalityNames.includes(municipality.toLowerCase())) {
          errors.push(`البلدية "${municipality}" غير موجودة`);
        }
        if (level && !levelNames.includes(level.toLowerCase())) {
          errors.push(`المستوى "${level}" غير موجود`);
        }
        if (size && !sizeNames.includes(size.toLowerCase())) {
          errors.push(`المقاس "${size}" غير موجود`);
        }

        return {
          id: crypto.randomUUID(),
          rowNumber: index + 2,
          Municipality: municipality,
          Level: level,
          Size: size,
          City: String(row['المدينة'] || '').trim(),
          District: String(row['المنطقة'] || '').trim(),
          Nearest_Landmark: String(row['أقرب معلم'] || '').trim(),
          GPS_Coordinates: String(row['الإحداثيات'] || '').trim(),
          Faces_Count: String(row['عدد الأوجه'] || '1').trim(),
          billboard_type: String(row['نوع اللوحة'] || '').trim(),
          status: errors.length > 0 ? 'invalid' : 'valid',
          errors
        };
      });

      setImportedRows(rows);
      
      const validCount = rows.filter(r => r.status === 'valid').length;
      const invalidCount = rows.filter(r => r.status === 'invalid').length;
      
      toast.success(`تم قراءة ${rows.length} صف (${validCount} صالح، ${invalidCount} يحتاج مراجعة)`);
    } catch (error) {
      console.error('Error reading Excel file:', error);
      toast.error('فشل قراءة الملف');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // استيراد اللوحات
  const importBillboards = async () => {
    const validRows = importedRows.filter(r => r.status === 'valid');
    if (validRows.length === 0) {
      toast.error('لا توجد صفوف صالحة للاستيراد');
      return;
    }

    setIsImporting(true);

    try {
      let nextId = await getNextBillboardId();
      
      const { data: existingBillboards } = await supabase
        .from('billboards')
        .select('Billboard_Name');
      const existingNames = (existingBillboards || []).map(b => b.Billboard_Name || '');

      for (const row of validRows) {
        try {
          const billboardName = generateBillboardName(
            row.Municipality,
            row.Level,
            row.Size,
            existingNames,
            nextId
          );

          let sizeId: number | null = null;
          const matchedSize = currentSizes.find(s => s.name?.toLowerCase() === row.Size.toLowerCase());
          if (matchedSize) sizeId = matchedSize.id;

          const payload: any = {
            ID: nextId,
            Billboard_Name: billboardName,
            City: row.City || null,
            Municipality: row.Municipality,
            District: row.District || null,
            Nearest_Landmark: row.Nearest_Landmark || null,
            GPS_Coordinates: row.GPS_Coordinates || null,
            Faces_Count: row.Faces_Count ? parseInt(row.Faces_Count) : 1,
            Size: row.Size,
            size_id: sizeId,
            Level: row.Level,
            billboard_type: row.billboard_type || null,
            Status: 'متاح',
            is_partnership: false
          };

          if (isFriendImport && selectedFriendCompanyId) {
            payload.friend_company_id = selectedFriendCompanyId;
            payload.is_visible_in_available = false;
          }

          const { error } = await supabase.from('billboards').insert(payload);
          if (error) throw error;

          existingNames.push(billboardName);
          
          setImportedRows(prev => prev.map(r => 
            r.id === row.id ? { ...r, status: 'success', Billboard_Name: billboardName } : r
          ));

          nextId++;
        } catch (error: any) {
          setImportedRows(prev => prev.map(r => 
            r.id === row.id ? { ...r, status: 'error', errors: [...r.errors, error.message] } : r
          ));
        }
      }

      const successCount = importedRows.filter(r => r.status === 'success').length;
      if (successCount > 0) {
        await supabase.rpc('setval_billboards_seq' as any);
        toast.success(`تم استيراد ${successCount} لوحة بنجاح`);
        await onSuccess();
      }

    } catch (error) {
      console.error('Import error:', error);
      toast.error('حدث خطأ أثناء الاستيراد');
    } finally {
      setIsImporting(false);
    }
  };

  const validCount = importedRows.filter(r => r.status === 'valid').length;
  const invalidCount = importedRows.filter(r => r.status === 'invalid').length;
  const successCount = importedRows.filter(r => r.status === 'success').length;
  const errorCount = importedRows.filter(r => r.status === 'error').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-green-600" />
            استيراد من Excel
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
          {/* تنزيل القالب ورفع الملف */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-6 rounded-lg border-2 border-dashed border-green-300 bg-green-50 dark:bg-green-950/20 text-center">
              <FileDown className="h-10 w-10 mx-auto mb-3 text-green-600" />
              <h4 className="font-medium mb-2">الخطوة 1: تنزيل القالب</h4>
              <p className="text-sm text-muted-foreground mb-4">
                قم بتنزيل قالب Excel وتعبئة بيانات اللوحات
              </p>
              <Button onClick={downloadTemplate} variant="outline" className="gap-2 border-green-500 text-green-700 hover:bg-green-100">
                <Download className="h-4 w-4" />
                تنزيل القالب
              </Button>
            </div>

            <div className="p-6 rounded-lg border-2 border-dashed border-blue-300 bg-blue-50 dark:bg-blue-950/20 text-center">
              <FileUp className="h-10 w-10 mx-auto mb-3 text-blue-600" />
              <h4 className="font-medium mb-2">الخطوة 2: رفع الملف</h4>
              <p className="text-sm text-muted-foreground mb-4">
                ارفع ملف Excel بعد تعبئة البيانات
              </p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileUpload}
                className="hidden"
              />
              <Button 
                onClick={() => fileInputRef.current?.click()} 
                variant="outline" 
                className="gap-2 border-blue-500 text-blue-700 hover:bg-blue-100"
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Upload className="h-4 w-4" />
                )}
                {isProcessing ? 'جاري القراءة...' : 'رفع الملف'}
              </Button>
            </div>
          </div>

 {/* خيار لوحات صديقة */}
          <div className="flex items-center gap-4 p-3 rounded-lg border bg-muted/30">
            <div className="flex items-center gap-2">
              <Switch
                id="friend-import"
                checked={isFriendImport}
                onCheckedChange={(checked) => {
                  setIsFriendImport(checked);
                  if (!checked) setSelectedFriendCompanyId('');
                }}
              />
              <Label htmlFor="friend-import" className="flex items-center gap-1.5 cursor-pointer">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                لوحات صديقة
              </Label>
            </div>
            {isFriendImport && (
              <Select value={selectedFriendCompanyId} onValueChange={setSelectedFriendCompanyId}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="اختر شركة صديقة" />
                </SelectTrigger>
                <SelectContent>
                  {friendCompanies.map((company) => (
                    <SelectItem key={company.id} value={company.id}>
                      {company.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {isFriendImport && !selectedFriendCompanyId && (
              <span className="text-xs text-destructive">يرجى اختيار شركة</span>
            )}
          </div>

          {/* الإحصائيات */}
          {importedRows.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Badge variant="outline">إجمالي: {importedRows.length}</Badge>
              {validCount > 0 && <Badge className="bg-green-500">{validCount} صالح</Badge>}
              {invalidCount > 0 && <Badge variant="destructive">{invalidCount} غير صالح</Badge>}
              {successCount > 0 && <Badge className="bg-blue-500">{successCount} مكتمل</Badge>}
              {errorCount > 0 && <Badge variant="destructive">{errorCount} فشل</Badge>}
            </div>
          )}

 {/* قسم القيم المفقودة مع زر إضافة */}
          {hasMissingValues && (
            <Alert className="border-amber-300 bg-amber-50 dark:bg-amber-950/20">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="space-y-2">
                <p className="font-medium text-amber-800 dark:text-amber-200">قيم غير موجودة في النظام:</p>
                <div className="flex flex-wrap gap-2 text-xs">
                  {missingValues.municipalities.map(v => (
                    <Badge key={`m-${v}`} variant="outline" className="border-amber-400 text-amber-700">بلدية: {v}</Badge>
                  ))}
                  {missingValues.sizes.map(v => (
                    <Badge key={`s-${v}`} variant="outline" className="border-amber-400 text-amber-700">مقاس: {v}</Badge>
                  ))}
                  {missingValues.levels.map(v => (
                    <Badge key={`l-${v}`} variant="outline" className="border-amber-400 text-amber-700">مستوى: {v}</Badge>
                  ))}
                </div>
                <Button
                  size="sm"
                  onClick={addMissingValues}
                  disabled={isAddingMissing}
                  className="gap-1.5 mt-1"
                >
                  {isAddingMissing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                  إضافة القيم المفقودة وإعادة التحقق
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* جدول المعاينة */}
          {importedRows.length > 0 && (
            <ScrollArea className="flex-1 border rounded-lg">
              <div className="min-w-[800px]">
                <div className="grid grid-cols-[50px_1fr_1fr_1fr_1fr_100px_1.5fr] gap-2 p-3 bg-muted/50 border-b text-xs font-medium text-muted-foreground sticky top-0">
                  <div>الصف</div>
                  <div>البلدية</div>
                  <div>المستوى</div>
                  <div>المقاس</div>
                  <div>المدينة</div>
                  <div>الحالة</div>
                  <div>الأخطاء</div>
                </div>
                
                {importedRows.map((row) => (
                  <div 
                    key={row.id} 
                    className={`grid grid-cols-[50px_1fr_1fr_1fr_1fr_100px_1.5fr] gap-2 p-2 border-b items-center text-sm ${
                      row.status === 'success' ? 'bg-green-50 dark:bg-green-950/20' :
                      row.status === 'error' || row.status === 'invalid' ? 'bg-red-50 dark:bg-red-950/20' : ''
                    }`}
                  >
                    <div className="text-xs text-muted-foreground">{row.rowNumber}</div>
                    <div className={!row.Municipality ? 'text-destructive' : ''}>{row.Municipality || '-'}</div>
                    <div className={!row.Level ? 'text-destructive' : ''}>{row.Level || '-'}</div>
                    <div className={!row.Size ? 'text-destructive' : ''}>{row.Size || '-'}</div>
                    <div>{row.City || '-'}</div>
                    <div>
                      {row.status === 'valid' && (
                        <Badge variant="outline" className="text-[10px]">صالح</Badge>
                      )}
                      {row.status === 'invalid' && (
                        <Badge variant="destructive" className="text-[10px]">
                          <AlertTriangle className="h-3 w-3 mr-1" />
                          خطأ
                        </Badge>
                      )}
                      {row.status === 'success' && (
                        <Badge className="bg-green-500 text-[10px]">
                          <CheckCircle2 className="h-3 w-3 mr-1" />
                          تم
                        </Badge>
                      )}
                      {row.status === 'error' && (
                        <Badge variant="destructive" className="text-[10px]">
                          <XCircle className="h-3 w-3 mr-1" />
                          فشل
                        </Badge>
                      )}
                    </div>
 {/* عمود الأخطاء التفصيلية */}
                    <div className="text-xs text-destructive">
                      {row.errors.length > 0 && (
                        <ul className="list-disc list-inside space-y-0.5">
                          {row.errors.map((err, i) => (
                            <li key={i}>{err}</li>
                          ))}
                        </ul>
                      )}
                      {row.status === 'success' && row.Billboard_Name && (
                        <span className="text-green-600">{row.Billboard_Name}</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* تحذير الصفوف غير الصالحة */}
          {invalidCount > 0 && !hasMissingValues && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                يوجد {invalidCount} صف يحتوي على أخطاء. سيتم تجاهل هذه الصفوف عند الاستيراد.
              </AlertDescription>
            </Alert>
          )}
        </div>

        {/* أزرار الإجراءات */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button variant="ghost" onClick={() => setImportedRows([])}>
            مسح البيانات
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              إغلاق
            </Button>
            <Button 
              onClick={importBillboards} 
              disabled={isImporting || validCount === 0 || (isFriendImport && !selectedFriendCompanyId)}
              className="gap-2"
            >
              {isImporting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري الاستيراد...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4" />
                  استيراد {validCount} لوحة
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
