import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Loader2, Printer, ClipboardList, Sparkles, Save, Upload, Check, Trash2, ImageOff } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  renderAllBillboardsTablePagesPreviewLike,
  injectReportTitleOnFirstPage,
  BillboardRowData,
} from '@/lib/contractTableRenderer';
import { useContractTemplateSettings, DEFAULT_SECTION_SETTINGS } from '@/hooks/useContractTemplateSettings';
import { useContractPrint } from '@/hooks/useContractPrint';
import { uploadToImgbb } from '@/services/imgbbService';
import { cn } from '@/lib/utils';
import { useBillboardStatuses, STATUS_LABELS } from '@/hooks/useBillboardStatuses';
import { BillboardStatusBadges } from './BillboardStatusBadges';
import { AlertTriangle, X as XIcon } from 'lucide-react';

const REPORT_SETTINGS_KEY = 'billboard_report_print_settings';

interface BgOption { id: string; name: string; url: string; isCustom?: boolean }

const PRESET_BACKGROUNDS: BgOption[] = [
  { id: 'default', name: 'الافتراضية (من القالب)', url: 'default' },
  { id: 'none', name: 'بدون خلفية', url: 'none' },
  { id: '/bgc2.svg', name: 'bgc2', url: '/bgc2.svg' },
  { id: '/bgc.svg', name: 'bgc', url: '/bgc.svg' },
  { id: '/bgc1.svg', name: 'الذهبية', url: '/bgc1.svg' },
  { id: '/mt1.svg', name: 'mt1', url: '/mt1.svg' },
  { id: '/ipg.svg', name: 'ipg', url: '/ipg.svg' },
  { id: '/blank.svg', name: 'blank', url: '/blank.svg' },
];

interface BillboardReportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedBillboards: any[];
}

interface PhraseRow {
  id: string;
  phrase: string;
  usage_count: number;
}

/** Local-state textarea that only persists onBlur to avoid re-render storms. */
const StatusNoteEditor: React.FC<{ initialValue: string; onSave: (v: string) => void }> = ({ initialValue, onSave }) => {
  const [val, setVal] = useState(initialValue);
  const lastSaved = useRef(initialValue);
  useEffect(() => { setVal(initialValue); lastSaved.current = initialValue; }, [initialValue]);
  return (
    <Textarea
      value={val}
      onChange={(e) => setVal(e.target.value)}
      onBlur={() => { if (val !== lastSaved.current) { lastSaved.current = val; onSave(val); } }}
      placeholder="ملاحظة (تظهر في التقرير)"
      rows={1}
      className="text-xs resize-none h-7 min-h-7 py-1"
    />
  );
};

export const BillboardReportDialog: React.FC<BillboardReportDialogProps> = ({
  open,
  onOpenChange,
  selectedBillboards,
}) => {
  const [customTitle, setCustomTitle] = useState('');
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [phrases, setPhrases] = useState<PhraseRow[]>([]);
  const [isPrinting, setIsPrinting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [bgChoice, setBgChoice] = useState<string>('default');
  const [customBackgrounds, setCustomBackgrounds] = useState<BgOption[]>([]);
  const [isUploadingBg, setIsUploadingBg] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: templateData } = useContractTemplateSettings();
  const settings = templateData?.settings || DEFAULT_SECTION_SETTINGS;
  const defaultBg = templateData?.tableBackgroundUrl || '/bgc2.svg';
  const { printMultiplePages } = useContractPrint();

  const billboardIds = useMemo(
    () => selectedBillboards.map((b) => Number(b.ID || b.id)).filter(Boolean),
    [selectedBillboards]
  );
  const { statusesByBillboard, update: updateStatus, resolve: resolveStatus } = useBillboardStatuses(billboardIds);

  // Merge DB statuses with derived maintenance status (when billboard is not operational)
  const combinedStatusesByBillboard = useMemo(() => {
    const merged: Record<number, any[]> = {};
    selectedBillboards.forEach((b) => {
      const bid = Number(b.ID || b.id);
      if (!bid) return;
      const arr = [...(statusesByBillboard[bid] || [])];
      const mStatus = String((b as any).maintenance_status || '').trim();
      const mLower = mStatus.toLowerCase();
      const isNormal = !mStatus || mLower === 'operational' || mStatus === 'تعمل' || mStatus === 'يعمل' || mStatus === 'بحالة جيدة';
      if (!isNormal) {
        arr.push({
          id: `maint-${bid}`,
          billboard_id: bid,
          contract_number: null,
          status_type: 'maintenance' as any,
          note: [mStatus, (b as any).maintenance_reason].filter(Boolean).join(' — '),
          old_size: null,
          new_size: null,
          is_resolved: false,
          created_at: '',
          updated_at: '',
        });
      }
      merged[bid] = arr;
    });
    return merged;
  }, [selectedBillboards, statusesByBillboard]);

  const resolvedBg = bgChoice === 'default' ? defaultBg : bgChoice === 'none' ? '' : bgChoice;
  const allBackgrounds = useMemo(() => [...PRESET_BACKGROUNDS, ...customBackgrounds], [customBackgrounds]);

  // Load saved background settings
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data } = await supabase
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', REPORT_SETTINGS_KEY)
        .maybeSingle();
      if (data?.setting_value) {
        try {
          const parsed = JSON.parse(data.setting_value);
          if (parsed.bgChoice) setBgChoice(parsed.bgChoice);
          if (Array.isArray(parsed.customBackgrounds)) setCustomBackgrounds(parsed.customBackgrounds);
        } catch {}
      }
    })();
  }, [open]);

  const persistBgSettings = async (nextChoice: string, nextCustoms: BgOption[]) => {
    try {
      await supabase.from('system_settings').upsert({
        setting_key: REPORT_SETTINGS_KEY,
        setting_value: JSON.stringify({ bgChoice: nextChoice, customBackgrounds: nextCustoms }),
      }, { onConflict: 'setting_key' });
    } catch (e) {
      console.error('persist bg settings failed', e);
    }
  };

  const handleSelectBg = (id: string) => {
    setBgChoice(id);
    persistBgSettings(id, customBackgrounds);
  };

  const handleUploadBg = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار ملف صورة');
      return;
    }
    setIsUploadingBg(true);
    try {
      const fileName = `report_bg_${Date.now()}`;
      const url = await uploadToImgbb(file, fileName, 'report-backgrounds');
      if (!url || typeof url !== 'string') throw new Error('upload failed');
      const newBg: BgOption = { id: url, name: file.name.replace(/\.[^.]+$/, ''), url, isCustom: true };
      const nextCustoms = [...customBackgrounds, newBg];
      setCustomBackgrounds(nextCustoms);
      setBgChoice(url);
      await persistBgSettings(url, nextCustoms);
      toast.success('تم رفع الخلفية وحفظها');
    } catch (e) {
      console.error(e);
      toast.error('فشل رفع الخلفية');
    } finally {
      setIsUploadingBg(false);
    }
  };

  const handleDeleteCustomBg = async (id: string) => {
    const nextCustoms = customBackgrounds.filter((b) => b.id !== id);
    setCustomBackgrounds(nextCustoms);
    const nextChoice = bgChoice === id ? 'default' : bgChoice;
    if (bgChoice === id) setBgChoice('default');
    await persistBgSettings(nextChoice, nextCustoms);
  };

  // Load suggestions
  useEffect(() => {
    if (!open) return;
    (async () => {
      const { data, error } = await supabase
        .from('billboard_report_phrases')
        .select('id, phrase, usage_count')
        .order('usage_count', { ascending: false })
        .limit(30);
      if (!error && data) setPhrases(data as PhraseRow[]);
    })();
  }, [open]);

  // Reset notes when selection or dialog opens
  useEffect(() => {
    if (!open) return;
    setNotes((prev) => {
      const next: Record<string, string> = {};
      selectedBillboards.forEach((b) => {
        const id = String(b.ID || b.id || '');
        next[id] = prev[id] || '';
      });
      return next;
    });
  }, [open, selectedBillboards]);

  const setNote = (id: string, value: string) =>
    setNotes((prev) => ({ ...prev, [id]: value }));

  const persistPhrases = async () => {
    const unique = Array.from(
      new Set(
        Object.values(notes)
          .map((s) => s.trim())
          .filter((s) => s.length > 0)
      )
    );
    if (unique.length === 0) return;

    for (const phrase of unique) {
      const existing = phrases.find((p) => p.phrase === phrase);
      if (existing) {
        await supabase
          .from('billboard_report_phrases')
          .update({ usage_count: existing.usage_count + 1 })
          .eq('id', existing.id);
      } else {
        await supabase.from('billboard_report_phrases').insert({ phrase });
      }
    }
  };

  const handleSavePhrases = async () => {
    setIsSaving(true);
    try {
      await persistPhrases();
      toast.success('تم حفظ الحالات كاقتراحات');
      // Refresh
      const { data } = await supabase
        .from('billboard_report_phrases')
        .select('id, phrase, usage_count')
        .order('usage_count', { ascending: false })
        .limit(30);
      if (data) setPhrases(data as PhraseRow[]);
    } catch (e) {
      console.error(e);
      toast.error('تعذر حفظ الاقتراحات');
    } finally {
      setIsSaving(false);
    }
  };

  const formatStatusLine = (bbId: number): string => {
    const list = combinedStatusesByBillboard[bbId] || [];
    return list
      .map((s: any) => {
        if (s.status_type === 'size_changed' && s.old_size && s.new_size) {
          return `تغيير المقاس من ${s.old_size} إلى ${s.new_size}${s.note ? ' — ' + s.note : ''}`;
        }
        if (s.status_type === 'maintenance') {
          return `صيانة${s.note ? ': ' + s.note : ''}`;
        }
        const base = (STATUS_LABELS as any)[s.status_type] || s.status_type;
        return s.note ? `${base}: ${s.note}` : base;
      })
      .join(' • ');
  };

  const buildRows = (): BillboardRowData[] => {
    return selectedBillboards.map((b) => {
      const id = String(b.ID || b.id || '');
      const bbId = Number(b.ID || b.id);
      const statusLine = formatStatusLine(bbId);
      const userNote = notes[id] || '';
      const combined = [statusLine, userNote].filter(Boolean).join(' • ');
      return {
        id,
        billboardName: b.Billboard_Name || b.billboardName || '',
        image: b.image_url || b.image || b.Image_URL || '',
        municipality: b.Municipality || b.municipality || '',
        district: b.District || b.district || '',
        landmark: b.Nearest_Landmark || b.landmark || '',
        size: b.Size || b.size || '',
        level: b.Level || b.level || '',
        faces: b.Faces_Count ?? b.faces_count ?? b.faces ?? '',
        status: '',
        reportNote: combined,
      };
    });
  };


  const handlePrint = async () => {
    if (selectedBillboards.length === 0) {
      toast.error('لم يتم اختيار أي لوحات');
      return;
    }
    setIsPrinting(true);
    try {
      // Explicit columns for the report: image, name, size, municipality, district, landmark, status note
      const tblBase = settings.tableSettings || ({} as any);
      const mk = (key: string, label: string, width: number, fontSize?: number, headerFontSize?: number) => {
        const existing = (tblBase.columns || []).find((c: any) => c.key === key) || {};
        return {
          ...existing,
          key,
          label,
          visible: true,
          width,
          fontSize: existing.fontSize || fontSize || 22,
          headerFontSize: existing.headerFontSize || headerFontSize || 24,
          padding: existing.padding ?? 4,
          lineHeight: existing.lineHeight ?? 1.3,
        } as any;
      };

      const dynamicColumns = [
        mk('image', 'الصورة', 10),
        mk('billboardName', 'اسم اللوحة', 9),
        mk('size', 'المقاس', 6),
        mk('municipality', 'البلدية', 9),
        mk('district', 'المنطقة', 9),
        mk('name', 'أقرب نقطة دالة', 13),
        mk('status', 'الحالة / الملاحظات', 20),
      ];

      const adjustedSettings = {
        ...settings,
        tableSettings: { ...tblBase, columns: dynamicColumns },
      };

      const rows = buildRows();
      let pages = renderAllBillboardsTablePagesPreviewLike(
        rows,
        adjustedSettings,
        resolvedBg,
        settings.tableSettings?.maxRows || 12,
        false
      );

      pages = injectReportTitleOnFirstPage(pages, customTitle);

      // Persist phrases automatically
      await persistPhrases();

      printMultiplePages(pages, {
        title: `تقرير اللوحات - ${selectedBillboards.length} لوحة`,
        designWidth: 2480,
        designHeight: 3508,
      });
      onOpenChange(false);
    } catch (e) {
      console.error(e);
      toast.error('حدث خطأ أثناء الطباعة');
    } finally {
      setIsPrinting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ClipboardList className="h-5 w-5 text-primary" />
            تقرير حالة اللوحات
            <Badge variant="secondary" className="mr-auto">{selectedBillboards.length} لوحة</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="px-6 py-4 border-b space-y-3">
          <div className="space-y-2">
            <Label htmlFor="report-title">عنوان التقرير (يظهر فوق الجدول)</Label>
            <Input
              id="report-title"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder="مثال: تقرير حالة اللوحات - مايو 2026"
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label>خلفية الطباعة</Label>
              <div className="flex items-center gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadBg(f);
                    e.target.value = '';
                  }}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1 h-8"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploadingBg}
                >
                  {isUploadingBg ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                  رفع خلفية
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 max-h-56 overflow-y-auto p-1 rounded border bg-muted/30">
              {allBackgrounds.map((bg) => {
                const isSelected = bgChoice === bg.id;
                const showImage = bg.url !== 'default' && bg.url !== 'none';
                const previewSrc = bg.url === 'default' ? defaultBg : bg.url;
                return (
                  <div
                    key={bg.id}
                    onClick={() => handleSelectBg(bg.id)}
                    className={cn(
                      'relative group cursor-pointer rounded-md border-2 overflow-hidden transition-all bg-white',
                      isSelected ? 'border-primary ring-2 ring-primary/30' : 'border-border hover:border-primary/50'
                    )}
                  >
                    <div className="aspect-[1/1.414] flex items-center justify-center bg-white">
                      {bg.url === 'none' ? (
                        <div className="flex flex-col items-center gap-1 text-muted-foreground">
                          <ImageOff className="h-6 w-6" />
                          <span className="text-[10px]">بدون</span>
                        </div>
                      ) : (
                        <img
                          src={previewSrc}
                          alt={bg.name}
                          className="w-full h-full object-contain"
                          onError={(e) => ((e.target as HTMLImageElement).style.opacity = '0.3')}
                        />
                      )}
                    </div>
                    <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] px-1 py-0.5 truncate text-center">
                      {bg.name}
                    </div>
                    {isSelected && (
                      <div className="absolute top-1 right-1 bg-primary text-primary-foreground rounded-full p-0.5">
                        <Check className="h-3 w-3" />
                      </div>
                    )}
                    {bg.isCustom && (
                      <Button
                        type="button"
                        variant="destructive"
                        size="icon"
                        className="absolute top-1 left-1 h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => { e.stopPropagation(); handleDeleteCustomBg(bg.id); }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden px-6 py-4">
          <div className="space-y-3">
            {selectedBillboards.map((b) => {
              const id = String(b.ID || b.id || '');
              const name = b.Billboard_Name || b.billboardName || id;
              const size = b.Size || b.size || '';
              const image = b.image_url || b.image || b.Image_URL || '';
              const municipality = b.Municipality || b.municipality || '';
              const district = b.District || b.district || '';
              const landmark = b.Nearest_Landmark || b.landmark || '';
              return (
                <div key={id} className="border rounded-lg p-3 bg-card">
                  <div className="flex gap-3 mb-2">
                    {image ? (
                      <img
                        src={image}
                        alt={name}
                        className="w-20 h-20 object-cover rounded border flex-shrink-0"
                        onError={(e) => ((e.target as HTMLImageElement).style.display = 'none')}
                      />
                    ) : (
                      <div className="w-20 h-20 rounded border bg-muted flex items-center justify-center text-[10px] text-muted-foreground flex-shrink-0">
                        لا توجد صورة
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-wrap">
                          <span className="font-bold text-sm">{name}</span>
                          {size && <Badge variant="outline" className="text-[10px]">{size}</Badge>}
                          <BillboardStatusBadges statuses={combinedStatusesByBillboard[Number(id)]} size="xs" />
                        </div>
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" size="sm" className="h-7 gap-1 text-xs" type="button">
                              <Sparkles className="h-3.5 w-3.5" />
                              اقتراحات
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent align="end" className="w-72 p-2 max-h-72 overflow-y-auto">
                            {phrases.length === 0 ? (
                              <div className="text-xs text-muted-foreground p-2 text-center">
                                لا توجد اقتراحات محفوظة بعد
                              </div>
                            ) : (
                              <div className="flex flex-col gap-1">
                                {phrases.map((p) => (
                                  <button
                                    key={p.id}
                                    type="button"
                                    onClick={() => setNote(id, p.phrase)}
                                    className="text-right text-xs px-2 py-1.5 rounded hover:bg-muted transition-colors"
                                  >
                                    {p.phrase}
                                    <span className="text-[10px] text-muted-foreground mr-2">({p.usage_count})</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </PopoverContent>
                        </Popover>
                      </div>
                      <div className="text-[11px] text-muted-foreground space-y-0.5">
                        {(municipality || district) && (
                          <div>
                            <span className="font-medium text-foreground/70">الموقع:</span> {[municipality, district].filter(Boolean).join(' - ')}
                          </div>
                        )}
                        {landmark && (
                          <div>
                            <span className="font-medium text-foreground/70">أقرب نقطة:</span> {landmark}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  {(combinedStatusesByBillboard[Number(id)] || []).length > 0 && (
                    <div className="space-y-2 mb-2 p-2 rounded-md border border-amber-200 bg-amber-50/40 dark:bg-amber-950/10">
                      <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-700 dark:text-amber-400">
                        <AlertTriangle className="h-3 w-3" />
                        الحالات المسجلة
                      </div>
                      {(combinedStatusesByBillboard[Number(id)] || []).map((s: any) => {
                        const isDerived = String(s.id).startsWith('maint-');
                        return (
                          <div key={s.id} className="flex items-start gap-2">
                            <div className="flex-1 space-y-1">
                              <BillboardStatusBadges statuses={[s]} size="xs" />
                              {isDerived ? (
                                <div className="text-xs text-muted-foreground px-1">{s.note || '—'}</div>
                              ) : (
                                <StatusNoteEditor
                                  initialValue={s.note ?? ''}
                                  onSave={(v) => updateStatus({ id: s.id, note: v }).catch(() => {})}
                                />
                              )}
                            </div>
                            {!isDerived && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 shrink-0"
                                title="إنهاء الحالة"
                                onClick={() => resolveStatus(s.id)}
                              >
                                <XIcon className="h-3.5 w-3.5" />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <Textarea
                    value={notes[id] || ''}
                    onChange={(e) => setNote(id, e.target.value)}
                    placeholder="ملاحظة إضافية لهذه اللوحة..."
                    rows={2}
                    className="text-sm resize-none"
                  />
                </div>
              );
            })}
          </div>
        </div>

        <div className="border-t px-6 py-3 flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" onClick={handleSavePhrases} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            حفظ الاقتراحات
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button onClick={handlePrint} disabled={isPrinting} className="gap-2">
              {isPrinting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Printer className="h-4 w-4" />}
              طباعة التقرير
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
