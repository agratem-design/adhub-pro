import React, { useState, useRef, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import * as XLSX from 'xlsx';
import {
  Image as ImageIcon,
  Download,
  Upload,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  FileDown,
  FileUp,
  Search,
  Eye
} from 'lucide-react';

interface ExcelImageImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => Promise<void>;
}

interface BillboardRef {
  id: number;
  name: string;
  image_name: string | null;
}

interface ImageRow {
  id: string;
  rowNumber: number;
  image_name: string;
  image_url: string;
  billboard_id: number | null;
  billboard_name: string | null;
  status: 'valid' | 'invalid' | 'success' | 'error';
  errors: string[];
  matchType?: string;
}

const NONE_VALUE = '__none__';

// Normalize string for fuzzy matching
function normalize(s: string): string {
  return s.trim().toLowerCase().replace(/[\s\-_\.]+/g, '');
}

// Smart matching: try exact, then normalized, then partial, then by ID
function findBestMatch(
  searchValue: string,
  billboards: BillboardRef[]
): { billboard: BillboardRef; matchType: string } | null {
  if (!searchValue) return null;
  const sv = searchValue.trim();
  const svLower = sv.toLowerCase();
  const svNorm = normalize(sv);

  // 1. Exact match by image_name
  for (const b of billboards) {
    if (b.image_name && b.image_name.trim().toLowerCase() === svLower) {
      return { billboard: b, matchType: 'اسم الصورة (مطابق)' };
    }
  }

  // 2. Exact match by Billboard_Name
  for (const b of billboards) {
    if (b.name && b.name.trim().toLowerCase() === svLower) {
      return { billboard: b, matchType: 'اسم اللوحة (مطابق)' };
    }
  }

  // 3. Match by ID
  const numericVal = parseInt(sv, 10);
  if (!isNaN(numericVal)) {
    const byId = billboards.find(b => b.id === numericVal);
    if (byId) return { billboard: byId, matchType: 'رقم اللوحة' };
  }

  // 4. Normalized match (ignore spaces, dashes, dots)
  for (const b of billboards) {
    if (b.image_name && normalize(b.image_name) === svNorm) {
      return { billboard: b, matchType: 'اسم الصورة (تقريبي)' };
    }
    if (b.name && normalize(b.name) === svNorm) {
      return { billboard: b, matchType: 'اسم اللوحة (تقريبي)' };
    }
  }

  // 5. Partial match - search value contains or is contained in name
  for (const b of billboards) {
    const bNameNorm = b.name ? normalize(b.name) : '';
    const bImgNorm = b.image_name ? normalize(b.image_name) : '';
    if (bImgNorm && (svNorm.includes(bImgNorm) || bImgNorm.includes(svNorm))) {
      return { billboard: b, matchType: 'تطابق جزئي (اسم الصورة)' };
    }
    if (bNameNorm && (svNorm.includes(bNameNorm) || bNameNorm.includes(svNorm))) {
      return { billboard: b, matchType: 'تطابق جزئي (اسم اللوحة)' };
    }
  }

  return null;
}

export const ExcelImageImportDialog: React.FC<ExcelImageImportDialogProps> = ({
  open,
  onOpenChange,
  onSuccess,
}) => {
  const [rows, setRows] = useState<ImageRow[]>([]);
  const [isImporting, setIsImporting] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [billboards, setBillboards] = useState<BillboardRef[]>([]);
  const [sampleBillboards, setSampleBillboards] = useState<BillboardRef[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Column mapping state
  const [excelHeaders, setExcelHeaders] = useState<string[]>([]);
  const [excelRawRows, setExcelRawRows] = useState<Record<string, any>[]>([]);
  const [nameColumn, setNameColumn] = useState('');
  const [urlColumn, setUrlColumn] = useState('');
  const [showColumnMapping, setShowColumnMapping] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);

  // Load billboards on open
  useEffect(() => {
    if (open) {
      loadBillboards();
    }
  }, [open]);

  const loadBillboards = async () => {
    const { data } = await supabase
      .from('billboards')
      .select('ID, Billboard_Name, image_name');
    
    const bbs: BillboardRef[] = (data || []).map(b => ({
      id: b.ID,
      name: b.Billboard_Name || '',
      image_name: b.image_name || null,
    }));
    setBillboards(bbs);
    // Pick some samples for the template
    setSampleBillboards(bbs.filter(b => b.name || b.image_name).slice(0, 5));
  };

  const downloadTemplate = () => {
    const examples = sampleBillboards.length > 0
      ? sampleBillboards.map(b => ({
          'معرّف اللوحة (الاسم أو الرقم)': b.image_name || b.name || String(b.id),
          'رابط الصورة': 'https://example.com/image.jpg',
        }))
      : [{ 'معرّف اللوحة (الاسم أو الرقم)': 'مثال: لوحة 1', 'رابط الصورة': 'https://example.com/image.jpg' }];

    const ws = XLSX.utils.json_to_sheet(examples);
    ws['!cols'] = [{ wch: 35 }, { wch: 60 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'الصور');
    XLSX.writeFile(wb, 'قالب_استيراد_صور_اللوحات.xlsx');
    toast.success('تم تنزيل القالب مع أمثلة حقيقية من لوحاتك');
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessing(true);

    try {
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data);
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const jsonData = XLSX.utils.sheet_to_json(sheet) as Record<string, any>[];

      if (jsonData.length === 0) {
        toast.error('الملف فارغ');
        return;
      }

      const headers = Object.keys(jsonData[0]);
      setExcelHeaders(headers);
      setExcelRawRows(jsonData);

      // Auto-detect columns
      const nameLower = headers.map(h => h.toLowerCase());
      const nameIdx = nameLower.findIndex(h => 
        h.includes('اسم') || h.includes('معرف') || h.includes('لوحة') || h.includes('name') || h.includes('id')
      );
      const urlIdx = nameLower.findIndex(h => 
        h.includes('رابط') || h.includes('صورة') || h.includes('url') || h.includes('image') || h.includes('link')
      );

      setNameColumn(nameIdx >= 0 ? headers[nameIdx] : headers[0] || '');
      setUrlColumn(urlIdx >= 0 ? headers[urlIdx] : (headers[1] || headers[0] || ''));
      setShowColumnMapping(true);
      setRows([]);
    } catch (error) {
      console.error('Error reading Excel file:', error);
      toast.error('فشل قراءة الملف');
    } finally {
      setIsProcessing(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const processWithMapping = () => {
    if (!nameColumn || !urlColumn) {
      toast.error('اختر عمود المعرّف وعمود الرابط');
      return;
    }

    const parsed: ImageRow[] = excelRawRows.map((row, index) => {
      const errors: string[] = [];
      const imageName = String(row[nameColumn] || '').trim();
      const imageUrl = String(row[urlColumn] || '').trim();

      if (!imageName) errors.push('معرّف اللوحة مطلوب');
      if (!imageUrl) errors.push('رابط الصورة مطلوب');

      let matchResult: { billboard: BillboardRef; matchType: string } | null = null;
      if (imageName && errors.length === 0) {
        matchResult = findBestMatch(imageName, billboards);
        if (!matchResult) errors.push('لم يتم العثور على لوحة مطابقة');
      }

      return {
        id: crypto.randomUUID(),
        rowNumber: index + 2,
        image_name: imageName,
        image_url: imageUrl,
        billboard_id: matchResult?.billboard.id ?? null,
        billboard_name: matchResult?.billboard.name ?? null,
        status: errors.length > 0 ? 'invalid' as const : 'valid' as const,
        errors,
        matchType: matchResult?.matchType,
      };
    });

    setRows(parsed);
    setShowColumnMapping(false);

    const validCount = parsed.filter(r => r.status === 'valid').length;
    const invalidCount = parsed.filter(r => r.status === 'invalid').length;
    
    if (validCount > 0) {
      toast.success(`تم مطابقة ${validCount} لوحة بنجاح${invalidCount > 0 ? ` (${invalidCount} لم تتطابق)` : ''}`);
    } else {
      toast.error('لم يتم مطابقة أي لوحة. تأكد من صحة أسماء اللوحات.');
    }
  };

  // Allow manual billboard selection for unmatched rows
  const manualMatch = (rowId: string, billboardId: number) => {
    const bb = billboards.find(b => b.id === billboardId);
    if (!bb) return;
    setRows(prev => prev.map(r =>
      r.id === rowId ? {
        ...r,
        billboard_id: bb.id,
        billboard_name: bb.name,
        status: 'valid',
        errors: [],
        matchType: 'اختيار يدوي',
      } : r
    ));
  };

  const importImages = async () => {
    const validRows = rows.filter(r => r.status === 'valid' && r.billboard_id);
    if (validRows.length === 0) {
      toast.error('لا توجد صفوف صالحة للاستيراد');
      return;
    }

    setIsImporting(true);
    let successCount = 0;

    try {
      for (const row of validRows) {
        try {
          const { error } = await supabase
            .from('billboards')
            .update({ Image_URL: row.image_url, image_name: row.image_name })
            .eq('ID', row.billboard_id!);

          if (error) throw error;

          setRows(prev => prev.map(r =>
            r.id === row.id ? { ...r, status: 'success' } : r
          ));
          successCount++;
        } catch (error: any) {
          setRows(prev => prev.map(r =>
            r.id === row.id ? { ...r, status: 'error', errors: [...r.errors, error.message] } : r
          ));
        }
      }

      if (successCount > 0) {
        toast.success(`تم تحديث صور ${successCount} لوحة بنجاح`);
        await onSuccess();
      }
    } catch (error) {
      console.error('Import error:', error);
      toast.error('حدث خطأ أثناء الاستيراد');
    } finally {
      setIsImporting(false);
    }
  };

  const resetAll = () => {
    setRows([]);
    setExcelHeaders([]);
    setExcelRawRows([]);
    setShowColumnMapping(false);
    setNameColumn('');
    setUrlColumn('');
  };

  const validCount = rows.filter(r => r.status === 'valid').length;
  const invalidCount = rows.filter(r => r.status === 'invalid').length;
  const successCount = rows.filter(r => r.status === 'success').length;
  const errorCount = rows.filter(r => r.status === 'error').length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="pb-4 border-b">
          <DialogTitle className="text-xl font-bold flex items-center gap-2">
            <ImageIcon className="h-5 w-5 text-primary" />
            استيراد صور اللوحات من Excel
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col gap-4 py-4">
          {/* Step 1 & 2: Template + Upload (show when no column mapping or rows) */}
          {!showColumnMapping && rows.length === 0 && (
            <>
              {/* Real billboard examples */}
              {sampleBillboards.length > 0 && (
                <Alert>
                  <Search className="h-4 w-4" />
                  <AlertDescription>
                    <span className="font-medium">أمثلة على أسماء اللوحات لديك:</span>
                    <div className="flex flex-wrap gap-1.5 mt-2">
                      {sampleBillboards.map(b => (
                        <Badge key={b.id} variant="secondary" className="text-xs">
                          {b.image_name || b.name || String(b.id)}
                        </Badge>
                      ))}
                    </div>
                    <p className="text-xs mt-2 text-muted-foreground">
                      استخدم هذه الأسماء أو أرقام اللوحات في ملف Excel للمطابقة التلقائية
                    </p>
                  </AlertDescription>
                </Alert>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-5 rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/30 text-center">
                  <FileDown className="h-10 w-10 mx-auto mb-3 text-primary" />
                  <h4 className="font-medium mb-2">الخطوة 1: تنزيل القالب</h4>
                  <p className="text-sm text-muted-foreground mb-3">
                    القالب يحتوي على أمثلة حقيقية من لوحاتك
                  </p>
                  <Button onClick={downloadTemplate} variant="outline" className="gap-2">
                    <Download className="h-4 w-4" />
                    تنزيل القالب
                  </Button>
                </div>

                <div className="p-5 rounded-lg border-2 border-dashed border-muted-foreground/20 bg-muted/30 text-center">
                  <FileUp className="h-10 w-10 mx-auto mb-3 text-primary" />
                  <h4 className="font-medium mb-2">الخطوة 2: رفع الملف</h4>
                  <p className="text-sm text-muted-foreground mb-3">
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
                    className="gap-2"
                    disabled={isProcessing}
                  >
                    {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                    {isProcessing ? 'جاري القراءة...' : 'رفع الملف'}
                  </Button>
                </div>
              </div>

              <Alert>
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-xs">
                  <strong>طرق المطابقة:</strong> يمكنك استخدام <strong>اسم اللوحة</strong> أو <strong>اسم الصورة</strong> أو <strong>رقم اللوحة (ID)</strong> للمطابقة.
                  النظام يحاول المطابقة تلقائياً بعدة طرق (مطابقة كاملة، تقريبية، جزئية).
                </AlertDescription>
              </Alert>
            </>
          )}

          {/* Column Mapping Step */}
          {showColumnMapping && (
            <div className="space-y-4">
              <Alert>
                <Search className="h-4 w-4" />
                <AlertDescription>
                  تم قراءة <strong>{excelRawRows.length}</strong> صف. حدد الأعمدة المطلوبة ثم اضغط "معاينة المطابقة".
                </AlertDescription>
              </Alert>

              {/* Preview of raw data */}
              <div>
                <Label className="text-sm text-muted-foreground mb-2 block">
                  معاينة البيانات (أول 3 صفوف)
                </Label>
                <ScrollArea className="max-h-32 border rounded-md">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-muted/50">
                        {excelHeaders.map(h => (
                          <th key={h} className="px-2 py-1.5 text-right whitespace-nowrap font-medium">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {excelRawRows.slice(0, 3).map((row, i) => (
                        <tr key={i} className="border-t">
                          {excelHeaders.map(h => (
                            <td key={h} className="px-2 py-1 whitespace-nowrap max-w-[200px] truncate">
                              {String(row[h] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </ScrollArea>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border rounded-lg p-4 bg-muted/30">
                <div className="space-y-2">
                  <Label className="text-sm font-medium">عمود معرّف اللوحة (الاسم/الرقم)</Label>
                  <Select value={nameColumn} onValueChange={setNameColumn}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر العمود" />
                    </SelectTrigger>
                    <SelectContent>
                      {excelHeaders.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label className="text-sm font-medium">عمود رابط الصورة</Label>
                  <Select value={urlColumn} onValueChange={setUrlColumn}>
                    <SelectTrigger>
                      <SelectValue placeholder="اختر العمود" />
                    </SelectTrigger>
                    <SelectContent>
                      {excelHeaders.map(h => (
                        <SelectItem key={h} value={h}>{h}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={resetAll}>إلغاء</Button>
                <Button onClick={processWithMapping} className="gap-2" disabled={!nameColumn || !urlColumn}>
                  <Eye className="h-4 w-4" />
                  معاينة المطابقة
                </Button>
              </div>
            </div>
          )}

          {/* Results Preview */}
          {rows.length > 0 && (
            <>
              {/* Stats */}
              <div className="flex flex-wrap gap-2 items-center">
                <Badge variant="outline">إجمالي: {rows.length}</Badge>
                {validCount > 0 && <Badge className="bg-emerald-600 text-white">{validCount} متطابق</Badge>}
                {invalidCount > 0 && <Badge variant="destructive">{invalidCount} غير متطابق</Badge>}
                {successCount > 0 && <Badge className="bg-blue-600 text-white">{successCount} مكتمل</Badge>}
                {errorCount > 0 && <Badge variant="destructive">{errorCount} فشل</Badge>}

                <Button variant="ghost" size="sm" className="mr-auto text-xs" onClick={() => {
                  setShowColumnMapping(true);
                  setRows([]);
                }}>
                  ← تعديل الأعمدة
                </Button>
              </div>

              {/* Preview table with manual fix option */}
              <ScrollArea className="flex-1 border rounded-lg">
                <div className="min-w-[700px]">
                  <div className="grid grid-cols-[40px_1fr_1fr_80px_1fr_70px] gap-2 p-3 bg-muted/50 border-b text-xs font-medium text-muted-foreground sticky top-0">
                    <div>#</div>
                    <div>المعرّف في الملف</div>
                    <div>اللوحة المطابقة</div>
                    <div>نوع المطابقة</div>
                    <div>رابط الصورة</div>
                    <div>الحالة</div>
                  </div>

                  {rows.map((row) => (
                    <div
                      key={row.id}
                      className={`grid grid-cols-[40px_1fr_1fr_80px_1fr_70px] gap-2 p-2 border-b items-center text-sm ${
                        row.status === 'success' ? 'bg-emerald-50 dark:bg-emerald-950/20' :
                        row.status === 'error' || row.status === 'invalid' ? 'bg-destructive/5' : ''
                      }`}
                    >
                      <div className="text-xs text-muted-foreground">{row.rowNumber}</div>
                      <div className="truncate text-xs font-medium">{row.image_name || '-'}</div>
                      <div className="truncate text-xs">
                        {row.billboard_name ? (
                          <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                            {row.billboard_name} <span className="text-muted-foreground">(#{row.billboard_id})</span>
                          </span>
                        ) : (
                          <Select onValueChange={(v) => manualMatch(row.id, parseInt(v))}>
                            <SelectTrigger className="h-7 text-xs border-destructive/50">
                              <SelectValue placeholder="اختر اللوحة يدوياً" />
                            </SelectTrigger>
                            <SelectContent>
                              <div className="max-h-48">
                                {billboards.slice(0, 50).map(b => (
                                  <SelectItem key={b.id} value={String(b.id)} className="text-xs">
                                    {b.name || b.image_name || `#${b.id}`}
                                  </SelectItem>
                                ))}
                              </div>
                            </SelectContent>
                          </Select>
                        )}
                      </div>
                      <div className="text-[10px] text-muted-foreground truncate">{row.matchType || '-'}</div>
                      <div className="flex items-center gap-1">
                        <span className="truncate text-xs text-muted-foreground flex-1" title={row.image_url}>
                          {row.image_url || '-'}
                        </span>
                        {row.image_url && (
                          <button
                            onClick={() => setPreviewImageUrl(previewImageUrl === row.image_url ? null : row.image_url)}
                            className="shrink-0 text-primary hover:text-primary/70"
                            title="معاينة الصورة"
                          >
                            <Eye className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                      <div>
 {row.status === 'valid' && <Badge variant="outline" className="text-[10px] border-emerald-500 text-emerald-600"> صالح</Badge>}
                        {row.status === 'invalid' && (
                          <Badge variant="destructive" className="text-[10px]" title={row.errors.join(', ')}>
                            <AlertTriangle className="h-3 w-3 ml-0.5" />خطأ
                          </Badge>
                        )}
                        {row.status === 'success' && (
                          <Badge className="bg-emerald-600 text-white text-[10px]">
                            <CheckCircle2 className="h-3 w-3 ml-0.5" />تم
                          </Badge>
                        )}
                        {row.status === 'error' && (
                          <Badge variant="destructive" className="text-[10px]">
                            <XCircle className="h-3 w-3 ml-0.5" />فشل
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>

              {/* Image preview */}
              {previewImageUrl && (
                <div className="border rounded-lg p-2 bg-muted/30">
                  <img
                    src={previewImageUrl}
                    alt="معاينة"
                    className="max-h-32 mx-auto rounded object-contain"
                    onError={(e) => { (e.target as HTMLImageElement).src = ''; }}
                  />
                </div>
              )}

              {invalidCount > 0 && (
                <Alert variant="destructive">
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    {invalidCount} صف لم يتطابق. يمكنك اختيار اللوحة يدوياً من القائمة المنسدلة أو سيتم تجاهلها عند الاستيراد.
                  </AlertDescription>
                </Alert>
              )}
            </>
          )}
        </div>

        {/* Actions */}
        <div className="flex justify-between items-center pt-4 border-t">
          <Button variant="ghost" onClick={resetAll} size="sm">مسح البيانات</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)} size="sm">إغلاق</Button>
            {rows.length > 0 && (
              <Button
                onClick={importImages}
                disabled={isImporting || validCount === 0}
                className="gap-2"
                size="sm"
              >
                {isImporting ? (
                  <><Loader2 className="h-4 w-4 animate-spin" />جاري التحديث...</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4" />تحديث صور {validCount} لوحة</>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
