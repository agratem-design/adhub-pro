import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Download, FileSpreadsheet, EyeOff, Building2 } from 'lucide-react';

interface ExportMunicipalityDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (excludeHidden: boolean, selectedMunicipality: string) => void;
  municipalities: string[];
}

export const ExportMunicipalityDialog: React.FC<ExportMunicipalityDialogProps> = ({
  open,
  onOpenChange,
  onExport,
  municipalities = []
}) => {
  const [excludeHidden, setExcludeHidden] = useState(true);
  const [selectedMunicipality, setSelectedMunicipality] = useState<string>('all');

  const handleExport = () => {
    onExport(excludeHidden, selectedMunicipality);
    onOpenChange(false);
  };

  // filter out any empty or null values and sort alphabetically
  const cleanMunicipalities = React.useMemo(() => {
    return Array.from(new Set(municipalities.filter(Boolean).map(m => m.trim()))).sort();
  }, [municipalities]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px] rounded-[1.5rem] border border-border/80 bg-card/95 backdrop-blur-md shadow-2xl p-6 overflow-hidden animate-in fade-in zoom-in-95 duration-200" style={{ direction: 'rtl' }}>
        <DialogHeader className="space-y-3 text-right">
          <div className="mx-auto sm:mx-0 w-12 h-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <FileSpreadsheet className="h-6 w-6" />
          </div>
          <DialogTitle className="text-xl sm:text-2xl font-bold text-foreground font-tajawal">
            تنزيل لوحات البلدية Excel
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground font-tajawal leading-relaxed">
            سيتم تصدير ملف Excel يحتوي على بيانات اللوحات بما في ذلك إحداثيات GPS، المنطقة، رابط صورة اللوحة، ورابط صورة الإعلان الحالي.
          </DialogDescription>
        </DialogHeader>

        <div className="my-6 space-y-5">
          {/* Municipality Selector Dropdown */}
          <div className="space-y-2 text-right">
            <Label htmlFor="municipality-select" className="text-sm font-bold text-foreground font-tajawal flex items-center gap-1.5 justify-start">
              <Building2 className="h-4 w-4 text-primary" />
              البلدية المراد تنزيلها:
            </Label>
            <Select
              value={selectedMunicipality}
              onValueChange={setSelectedMunicipality}
            >
              <SelectTrigger id="municipality-select" className="w-full h-11 rounded-xl border-border bg-background font-tajawal text-right flex justify-between items-center cursor-pointer">
                <SelectValue placeholder="اختر البلدية" />
              </SelectTrigger>
              <SelectContent className="max-h-[200px] rounded-xl font-tajawal">
                <SelectItem value="all" className="cursor-pointer text-right">كل البلديات</SelectItem>
                {cleanMunicipalities.map((m) => (
                  <SelectItem key={m} value={m} className="cursor-pointer text-right">
                    {m}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="p-4 rounded-2xl bg-muted/40 border border-border/50 space-y-4">
            <div className="flex items-start gap-3 cursor-pointer select-none">
              <Checkbox
                id="exclude-hidden-checkbox"
                checked={excludeHidden}
                onCheckedChange={(checked) => setExcludeHidden(!!checked)}
                className="mt-1 cursor-pointer accent-primary border-muted-foreground/35 data-[state=checked]:bg-emerald-600 data-[state=checked]:border-emerald-600"
              />
              <div className="grid gap-1.5 leading-none">
                <Label
                  htmlFor="exclude-hidden-checkbox"
                  className="text-sm font-bold text-foreground cursor-pointer font-tajawal"
                >
                  استبعاد اللوحات المخفية من المتاح
                </Label>
                <p className="text-xs text-muted-foreground font-tajawal">
                  عند التفعيل، لن يتم تضمين اللوحات التي حالتها "مخفي" أو التي تم إلغاء تفعيل ظهورها في المتاح.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 text-xs text-amber-600 dark:text-amber-400 bg-amber-500/10 p-3 rounded-xl border border-amber-500/20">
              <EyeOff className="h-4 w-4 shrink-0" />
              <span className="font-tajawal">
                اللوحات المخفية هي اللوحات الصديقة أو اللوحات المعلمة بـ "غير مرئي في المتاح".
              </span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 mt-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="w-full sm:w-auto h-11 rounded-xl font-tajawal text-muted-foreground hover:bg-muted cursor-pointer transition-all duration-200"
          >
            إلغاء
          </Button>
          <Button
            type="button"
            onClick={handleExport}
            className="w-full sm:w-auto h-11 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-tajawal cursor-pointer transition-all duration-200 gap-2 flex items-center justify-center"
          >
            <Download className="h-4 w-4" />
            تنزيل الملف
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
