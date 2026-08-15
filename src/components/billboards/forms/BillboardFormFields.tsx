import React, { useMemo, useState } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { MultiSelect } from '@/components/ui/multi-select';

interface BillboardFormFieldsProps {
  form: any;
  setForm: (form: any) => void;
  municipalities: any[];
  sizes: any[];
  levels: string[];
  citiesList: string[];
  faces: any[];
  billboardTypes: string[];
  billboards: any[];
  partnersOptions: { label: string; value: string }[];
  isEdit?: boolean;
  addSizeIfNew?: (size: string, level: string, sizes: any[], setSizes: any, setDbSizes: any) => Promise<void>;
  addLevelIfNew?: (level: string, levels: string[], setLevels: any) => Promise<void>;
  addBillboardTypeIfNew?: (type: string, types: string[], setTypes: any) => Promise<void>;
  setSizes?: (sizes: any[]) => void;
  setLevels?: (levels: string[]) => void;
  setBillboardTypes?: (types: string[]) => void;
  setDbSizes?: (sizes: string[]) => void;
}

export const BillboardFormFields: React.FC<BillboardFormFieldsProps> = ({
  form,
  setForm,
  municipalities,
  sizes,
  levels,
  citiesList,
  faces,
  billboardTypes,
  billboards,
  partnersOptions,
  isEdit = false,
  addSizeIfNew,
  addLevelIfNew,
  addBillboardTypeIfNew,
  setSizes,
  setLevels,
  setBillboardTypes,
  setDbSizes
}) => {
  const [districtInput, setDistrictInput] = useState(form.District || '');
  const [showDistrictSuggestions, setShowDistrictSuggestions] = useState(false);

  const availableDistricts = useMemo(() => {
    const districts = new Set<string>();
    billboards.forEach(billboard => {
      const district = billboard.District || billboard.district;
      if (district && String(district).trim()) {
        districts.add(String(district).trim());
      }
    });
    return Array.from(districts).sort();
  }, [billboards]);

  const filteredDistricts = useMemo(() => {
    if (!districtInput.trim()) return availableDistricts.slice(0, 10);
    return availableDistricts.filter(district => 
      district.toLowerCase().includes(districtInput.toLowerCase())
    ).slice(0, 10);
  }, [districtInput, availableDistricts]);

  const handleDistrictChange = (value: string) => {
    setDistrictInput(value);
    setForm((p: any) => ({ ...p, District: value }));
    setShowDistrictSuggestions(true);
  };

  const handleDistrictSelect = (district: string) => {
    setDistrictInput(district);
    setForm((p: any) => ({ ...p, District: district }));
    setShowDistrictSuggestions(false);
  };

  return (
    <div className="space-y-6">
      {/* معلومات أساسية */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-primary rounded-full" />
          المعلومات الأساسية
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-lg bg-muted/30 border border-border">
          {!isEdit && (
            <div>
              <Label className="text-xs text-muted-foreground mb-1.5 block">رقم اللوحة (تلقائي)</Label>
              <Input 
                type="number" 
                value={form.ID || ''} 
                disabled 
                className="bg-muted/50 cursor-not-allowed text-sm text-muted-foreground h-9"
                placeholder="يتم إنشاؤه تلقائياً" 
              />
            </div>
          )}
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">
              اسم اللوحة {isEdit ? '' : '(تلقائي)'}
            </Label>
            <Input 
              value={form.Billboard_Name || ''} 
              disabled 
              className="bg-muted/50 cursor-not-allowed text-sm font-medium text-muted-foreground h-9"
              placeholder="يتم إنشاؤه تلقائياً" 
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">المدينة</Label>
            <Select value={form.City || ''} onValueChange={(v) => setForm((p: any) => ({ ...p, City: v }))}>
              <SelectTrigger className="text-sm bg-background border-border h-9">
                <SelectValue placeholder="اختر المدينة" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {citiesList.filter(c => c && String(c).trim()).map((c) => (
                  <SelectItem key={c} value={c as string}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">البلدية *</Label>
            <Select value={form.Municipality || ''} onValueChange={(v) => setForm((p: any) => ({ ...p, Municipality: v }))}>
              <SelectTrigger className="text-sm bg-background border-border h-9">
                <SelectValue placeholder="اختر البلدية" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border max-h-60">
                {municipalities.filter(m => m && m.id && m.name).map((m) => (
                  <SelectItem key={m.id} value={m.name}>{m.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* معلومات الموقع */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-blue-500 rounded-full" />
          معلومات الموقع
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 p-4 rounded-lg bg-muted/30 border border-border">
          <div className="relative lg:col-span-1">
            <Label className="text-xs text-muted-foreground mb-1.5 block">المنطقة</Label>
            <Input 
              className="text-sm bg-background border-border h-9" 
              value={districtInput} 
              onChange={(e) => handleDistrictChange(e.target.value)}
              onFocus={() => setShowDistrictSuggestions(true)}
              onBlur={() => setTimeout(() => setShowDistrictSuggestions(false), 200)}
              placeholder="اكتب للبحث" 
            />
            {showDistrictSuggestions && filteredDistricts.length > 0 && (
              <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-md shadow-lg max-h-48 overflow-y-auto">
                {filteredDistricts.map((district, index) => (
                  <div
                    key={index}
                    className="px-3 py-2 text-sm cursor-pointer hover:bg-accent border-b border-border/50 last:border-b-0"
                    onClick={() => handleDistrictSelect(district)}
                  >
                    {district}
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="lg:col-span-2">
            <Label className="text-xs text-muted-foreground mb-1.5 block">أقرب معلم</Label>
            <Input 
              className="text-sm bg-background border-border h-9" 
              value={form.Nearest_Landmark || ''} 
              onChange={(e) => setForm((p: any) => ({ ...p, Nearest_Landmark: e.target.value }))} 
              placeholder="أدخل أقرب معلم"
            />
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">الإحداثيات</Label>
            <Input 
              className="text-sm bg-background border-border h-9" 
              value={form.GPS_Coordinates || ''} 
              onChange={(e) => setForm((p: any) => ({ ...p, GPS_Coordinates: e.target.value }))} 
              placeholder="lat, lng" 
              dir="ltr"
            />
          </div>
        </div>
      </div>

      {/* مواصفات اللوحة */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full" />
          مواصفات اللوحة
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 rounded-lg bg-muted/30 border border-border">
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">عدد الأوجه</Label>
            <Select value={String(form.Faces_Count || '')} onValueChange={(v) => setForm((p: any) => ({ ...p, Faces_Count: v }))}>
              <SelectTrigger className="text-sm bg-background border-border h-9">
                <SelectValue placeholder="اختر" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {faces.filter(face => face && face.id).map((face) => {
                  const faceCount = face.count || face.face_count;
                  return (
                    <SelectItem key={face.id} value={String(faceCount)}>
                      {face.name} ({faceCount})
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">المقاس *</Label>
            <Select 
              value={form.Size || ''} 
              onValueChange={(v) => {
                if (v === '__add_new__' && addSizeIfNew && setSizes && setDbSizes) {
                  const newSize = prompt('أدخل المقاس الجديد:');
                  if (newSize?.trim()) {
                    addSizeIfNew(newSize.trim(), form.Level || 'A', sizes, setSizes, setDbSizes);
                    setForm((p: any) => ({ ...p, Size: newSize.trim() }));
                  }
                } else {
                  setForm((p: any) => ({ ...p, Size: v }));
                }
              }}
            >
              <SelectTrigger className="text-sm bg-background border-border h-9">
                <SelectValue placeholder="اختر" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border max-h-60">
                {sizes.filter(s => s && s.id && s.name).map((s) => (
                  <SelectItem key={s.id} value={s.name}>{s.name}</SelectItem>
                ))}
                <SelectItem value="__add_new__" className="text-primary font-medium">
                  + إضافة مقاس جديد
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">المستوى *</Label>
            <Select 
              value={form.Level || ''} 
              onValueChange={(v) => {
                if (v === '__add_new__' && addLevelIfNew && setLevels) {
                  const newLevel = prompt('أدخل المستوى الجديد:');
                  if (newLevel?.trim()) {
                    addLevelIfNew(newLevel.trim(), levels, setLevels);
                    setForm((p: any) => ({ ...p, Level: newLevel.trim() }));
                  }
                } else {
                  setForm((p: any) => ({ ...p, Level: v }));
                }
              }}
            >
              <SelectTrigger className="text-sm bg-background border-border h-9">
                <SelectValue placeholder="اختر" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {levels.filter(lv => lv && String(lv).trim()).map((lv) => (
                  <SelectItem key={lv} value={lv}>{lv}</SelectItem>
                ))}
                <SelectItem value="__add_new__" className="text-primary font-medium">
                  + إضافة مستوى
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs text-muted-foreground mb-1.5 block">نوع اللوحة</Label>
            <Select 
              value={form.billboard_type || ''} 
              onValueChange={(v) => {
                if (v === '__add_new__' && addBillboardTypeIfNew && setBillboardTypes) {
                  const newType = prompt('أدخل نوع اللوحة الجديد:');
                  if (newType?.trim()) {
                    addBillboardTypeIfNew(newType.trim(), billboardTypes, setBillboardTypes);
                    setForm((p: any) => ({ ...p, billboard_type: newType.trim() }));
                  }
                } else {
                  setForm((p: any) => ({ ...p, billboard_type: v }));
                }
              }}
            >
              <SelectTrigger className="text-sm bg-background border-border h-9">
                <SelectValue placeholder="اختر" />
              </SelectTrigger>
              <SelectContent className="bg-popover border-border">
                {billboardTypes.filter(type => type && String(type).trim()).map((type) => (
                  <SelectItem key={type} value={type}>{type}</SelectItem>
                ))}
                <SelectItem value="__add_new__" className="text-primary font-medium">
                  + إضافة نوع
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* معلومات الشراكة */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
          <span className="w-1.5 h-1.5 bg-purple-500 rounded-full" />
          الشراكة
        </h3>
        <div className="p-4 rounded-lg bg-muted/30 border border-border">
          <div className="flex items-center gap-3 mb-4">
            <input 
              type="checkbox" 
              id="is_partnership"
              checked={!!form.is_partnership} 
              onChange={(e) => setForm((p: any) => ({ ...p, is_partnership: e.target.checked }))} 
              className="w-4 h-4 accent-primary rounded"
            />
            <Label htmlFor="is_partnership" className="text-sm cursor-pointer">لوحة شراكة</Label>
          </div>
          
          {form.is_partnership && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-border/50">
              <div className="md:col-span-2">
                <Label className="text-xs text-muted-foreground mb-1.5 block">الشركات المشاركة</Label>
                <MultiSelect
                  options={partnersOptions}
                  value={Array.isArray(form.partner_companies) ? form.partner_companies : []}
                  onChange={(vals) => setForm((p: any) => ({ ...p, partner_companies: vals }))}
                  placeholder="اختر الشركات"
                  emptyText="لا توجد شركات"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1.5 block">رأس المال</Label>
                <Input 
                  type="number" 
                  className="text-sm bg-background border-border h-9" 
                  value={form.capital || 0} 
                  onChange={(e) => setForm((p: any) => ({ ...p, capital: Number(e.target.value) }))} 
                />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* معاينة الاسم */}
      {form.Municipality && form.Level && form.Size && (
        <div className="p-4 bg-primary/10 rounded-lg border border-primary/20">
          <Label className="text-primary font-medium text-sm">الاسم المقترح:</Label>
          <div className="text-primary font-mono text-lg mt-1">{form.Billboard_Name}</div>
        </div>
      )}
    </div>
  );
};
