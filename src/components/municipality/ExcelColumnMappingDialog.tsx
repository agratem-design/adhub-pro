import { useState, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { MapPin, FileSpreadsheet } from 'lucide-react';

export interface ColumnMapping {
  billboard_id: string;
  size: string;
  faces_count: string;
  location_text: string;
  nearest_landmark: string;
  billboard_name: string;
  // Coordinates
  coordsMode: 'combined' | 'separate';
  coords_combined: string;
  coords_lat: string;
  coords_lng: string;
}

interface ExcelColumnMappingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  headers: string[];
  sampleRows: Record<string, any>[];
  onConfirm: (mapping: ColumnMapping) => void;
}

const FIELD_LABELS: Record<string, string> = {
  billboard_id: 'معرف اللوحة / الكود',
  size: 'المقاس',
  faces_count: 'عدد الأوجه',
  location_text: 'موقع اللوحة',
  nearest_landmark: 'أقرب نقطة دالة',
  billboard_name: 'اسم اللوحة',
};

const NONE_VALUE = '__none__';

// Auto-detect column mapping based on common Arabic/English names
function autoDetect(headers: string[]): Partial<ColumnMapping> {
  const mapping: Partial<ColumnMapping> = {};
  const lower = headers.map(h => h.trim().toLowerCase());

  const find = (patterns: string[]) => {
    for (const p of patterns) {
      const idx = lower.findIndex(h => h.includes(p));
      if (idx >= 0) return headers[idx];
    }
    return '';
  };

  mapping.billboard_id = find(['id', 'معرف', 'معرّف', 'كود', 'code', 'رقم اللوحة']);
  mapping.size = find(['مقاس', 'المقاس', 'size']);
  mapping.faces_count = find(['أوجه', 'الاوجه', 'وجه', 'faces']);
  mapping.location_text = find(['موقع اللوحة', 'الموقع', 'موقع', 'location']);
  mapping.nearest_landmark = find(['نقطة دالة', 'landmark', 'أقرب']);
  mapping.billboard_name = find(['اسم اللوحة', 'اسم', 'name', 'موقع اللوحة']);

  // Detect coordinates mode
  const combinedCol = find(['موقع القوقل', 'الاحداثيات', 'coordinates', 'احداثيات', 'gps']);
  const latCol = find(['خط العرض', 'latitude', 'lat', 'عرض']);
  const lngCol = find(['خط الطول', 'longitude', 'lng', 'lon', 'طول']);

  if (latCol && lngCol) {
    mapping.coordsMode = 'separate';
    mapping.coords_lat = latCol;
    mapping.coords_lng = lngCol;
    mapping.coords_combined = '';
  } else {
    mapping.coordsMode = 'combined';
    mapping.coords_combined = combinedCol;
    mapping.coords_lat = '';
    mapping.coords_lng = '';
  }

  return mapping;
}

export const ExcelColumnMappingDialog: React.FC<ExcelColumnMappingDialogProps> = ({
  open,
  onOpenChange,
  headers,
  sampleRows,
  onConfirm,
}) => {
  const detected = useMemo(() => autoDetect(headers), [headers]);

  const [mapping, setMapping] = useState<ColumnMapping>({
    billboard_id: detected.billboard_id || '',
    size: detected.size || '',
    faces_count: detected.faces_count || '',
    location_text: detected.location_text || '',
    nearest_landmark: detected.nearest_landmark || '',
    billboard_name: detected.billboard_name || '',
    coordsMode: detected.coordsMode || 'combined',
    coords_combined: detected.coords_combined || '',
    coords_lat: detected.coords_lat || '',
    coords_lng: detected.coords_lng || '',
  });

  // Reset mapping when headers change
  useMemo(() => {
    const d = autoDetect(headers);
    setMapping({
      billboard_id: d.billboard_id || '',
      size: d.size || '',
      faces_count: d.faces_count || '',
      location_text: d.location_text || '',
      nearest_landmark: d.nearest_landmark || '',
      billboard_name: d.billboard_name || '',
      coordsMode: d.coordsMode || 'combined',
      coords_combined: d.coords_combined || '',
      coords_lat: d.coords_lat || '',
      coords_lng: d.coords_lng || '',
    });
  }, [headers]);

  const updateField = (field: keyof ColumnMapping, value: string) => {
    setMapping(prev => ({ ...prev, [field]: value === NONE_VALUE ? '' : value }));
  };

  const headerOptions = headers.map(h => ({ label: h, value: h }));

  const renderSelect = (field: keyof ColumnMapping, label: string) => (
    <div className="grid grid-cols-[140px_1fr] items-center gap-2">
      <Label className="text-sm font-medium text-right">{label}</Label>
      <Select
        value={mapping[field] || NONE_VALUE}
        onValueChange={(v) => updateField(field, v)}
      >
        <SelectTrigger className="h-9">
          <SelectValue placeholder="اختر العمود" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>— لا يوجد —</SelectItem>
          {headerOptions.map(h => (
            <SelectItem key={h.value} value={h.value}>{h.label}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-emerald-600" />
            تحديد أعمدة الملف
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground mt-0.5">
            قم بمطابقة أعمدة ملف Excel مع حقول بيانات اللوحات في النظام
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Preview of first rows */}
          {sampleRows.length > 0 && (
            <div>
              <Label className="text-sm text-muted-foreground mb-2 block">
                معاينة البيانات ({sampleRows.length > 3 ? 3 : sampleRows.length} صفوف من {sampleRows.length})
              </Label>
              <ScrollArea className="max-h-40 border rounded-md">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map(h => (
                        <TableHead key={h} className="text-xs whitespace-nowrap px-2">{h}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sampleRows.slice(0, 3).map((row, i) => (
                      <TableRow key={i}>
                        {headers.map(h => (
                          <TableCell key={h} className="text-xs px-2 py-1 whitespace-nowrap max-w-[150px] truncate">
                            {String(row[h] ?? '')}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          )}

          {/* Field mapping */}
          <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
            <Label className="text-sm font-semibold">ربط الأعمدة بالحقول</Label>
            {renderSelect('billboard_id', 'معرف اللوحة / الكود (للمطابقة مع النظام)')}
            {renderSelect('billboard_name', 'اسم اللوحة')}
            {renderSelect('size', 'المقاس')}
            {renderSelect('faces_count', 'عدد الأوجه')}
            {renderSelect('location_text', 'موقع اللوحة')}
            {renderSelect('nearest_landmark', 'نقطة دالة')}
          </div>

          {/* Coordinates section */}
          <div className="space-y-3 border rounded-lg p-4 bg-muted/30">
            <div className="flex items-center gap-2 mb-2">
              <MapPin className="h-4 w-4 text-primary" />
              <Label className="text-sm font-semibold">الإحداثيات</Label>
            </div>

            <RadioGroup
              value={mapping.coordsMode}
              onValueChange={(v) => updateField('coordsMode', v)}
              className="flex gap-4"
            >
              <div className="flex items-center gap-2">
                <RadioGroupItem value="combined" id="coords-combined" />
                <Label htmlFor="coords-combined" className="text-sm cursor-pointer">
                  مدمجة في عمود واحد
                  <Badge variant="outline" className="mr-2 text-xs">مثال: 32.89, 13.18</Badge>
                </Label>
              </div>
              <div className="flex items-center gap-2">
                <RadioGroupItem value="separate" id="coords-separate" />
                <Label htmlFor="coords-separate" className="text-sm cursor-pointer">
                  منفصلة في عمودين
                </Label>
              </div>
            </RadioGroup>

            {mapping.coordsMode === 'combined' ? (
              renderSelect('coords_combined', 'عمود الإحداثيات')
            ) : (
              <div className="space-y-2">
                {renderSelect('coords_lat', 'خط العرض (Lat)')}
                {renderSelect('coords_lng', 'خط الطول (Lng)')}
              </div>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={() => onConfirm(mapping)}>
            متابعة
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
