import React, { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Wrench,
  Plus,
  AlertTriangle,
  Check,
  Loader2,
  Eye,
  EyeOff,
  Layers,
  Sparkles,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MaintenanceStatus {
  id: string;
  name: string;
  label: string;
  color?: string;
}

interface BulkMaintenanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billboards: any[];
  onSuccess?: () => Promise<void> | void;
  onLocalUpdate?: (id: number | string, updates: Record<string, any>) => void;
}

const DEFAULT_STATUSES: { value: string; label: string; color: string }[] = [
  { value: 'operational', label: 'بحالة جيدة', color: '#22c55e' },
  { value: 'maintenance', label: 'قيد الصيانة', color: '#f59e0b' },
  { value: 'repair_needed', label: 'تحتاج إصلاح', color: '#ef4444' },
  { value: 'out_of_service', label: 'خارج الخدمة', color: '#dc2626' },
  { value: 'لم يتم التركيب', label: 'لم يتم التركيب', color: '#9333ea' },
  { value: 'متضررة اللوحة', label: 'متضررة اللوحة', color: '#ea580c' },
  { value: 'تحتاج ازالة لغرض التطوير', label: 'تحتاج إزالة للتطوير', color: '#d97706' },
  { value: 'removed', label: 'تمت الإزالة', color: '#64748b' },
];

export const BulkMaintenanceDialog: React.FC<BulkMaintenanceDialogProps> = ({
  open,
  onOpenChange,
  billboards,
  onSuccess,
  onLocalUpdate,
}) => {
  const [dynamicStatuses, setDynamicStatuses] = useState<MaintenanceStatus[]>([]);
  const [status, setStatus] = useState<string>('maintenance');
  const [priority, setPriority] = useState<string>('normal');
  const [type, setType] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  const [visibilityAction, setVisibilityAction] = useState<'keep' | 'show' | 'hide'>('keep');
  const [customStatus, setCustomStatus] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) {
      loadStatuses();
      setStatus('maintenance');
      setPriority('normal');
      setType('');
      setDescription('');
      setVisibilityAction('keep');
      setCustomStatus('');
      setShowCustomInput(false);
    }
  }, [open]);

  const loadStatuses = async () => {
    try {
      const { data } = await supabase
        .from('maintenance_statuses')
        .select('*')
        .order('created_at');
      if (data && data.length > 0) {
        setDynamicStatuses(data as MaintenanceStatus[]);
      }
    } catch (e) {
      console.warn('Failed to load dynamic maintenance statuses:', e);
    }
  };

  const addCustomStatus = async () => {
    if (!customStatus.trim()) return;
    const name = customStatus.trim();
    if (dynamicStatuses.some((s) => s.name === name || s.label === name)) {
      const existing = dynamicStatuses.find((s) => s.label === name || s.name === name);
      if (existing) setStatus(existing.name);
      setCustomStatus('');
      setShowCustomInput(false);
      return;
    }
    const { error } = await supabase
      .from('maintenance_statuses')
      .insert({ name, label: name, color: '#6b7280' });
    if (!error) {
      await loadStatuses();
      setStatus(name);
      toast.success(`تمت إضافة حالة "${name}" بنجاح`);
    } else {
      toast.error('تعذر حفظ الحالة الجديدة');
    }
    setCustomStatus('');
    setShowCustomInput(false);
  };

  const allStatuses = React.useMemo(() => {
    if (dynamicStatuses.length > 0) {
      return dynamicStatuses.map((s) => ({
        value: s.name,
        label: s.label || s.name,
        color: s.color || '#6b7280',
      }));
    }
    return DEFAULT_STATUSES;
  }, [dynamicStatuses]);

  const isRemovalStatus =
    status === 'تحتاج ازالة لغرض التطوير' ||
    status === 'لم يتم التركيب' ||
    status === 'removed';

  const billboardIds = React.useMemo(() => {
    return billboards.map((b) => Number(b.ID || b.id)).filter((id) => Boolean(id) && !isNaN(id));
  }, [billboards]);

  const handleSubmit = async () => {
    if (billboardIds.length === 0) {
      toast.error('لا توجد لوحات محددة');
      return;
    }
    if (!status) {
      toast.error('يرجى اختيار حالة الصيانة');
      return;
    }

    setSaving(true);
    try {
      const updateData: Record<string, any> = {
        maintenance_status: status,
        maintenance_date: new Date().toISOString(),
        maintenance_priority: priority,
        maintenance_notes: description.trim() || null,
        maintenance_type: type.trim() || null,
      };

      if (isRemovalStatus) {
        updateData.Status = 'إزالة';
      }

      if (visibilityAction === 'show') {
        updateData.is_visible_in_available = true;
      } else if (visibilityAction === 'hide') {
        updateData.is_visible_in_available = false;
      }

      const { error } = await supabase
        .from('billboards')
        .update(updateData)
        .in('ID', billboardIds);

      if (error) throw error;

      // Add to maintenance_history if type or description exists
      if (type.trim() || description.trim()) {
        const historyRecords = billboardIds.map((id) => ({
          billboard_id: id,
          maintenance_type: type.trim() || status,
          description: description.trim() || null,
          priority: priority,
          maintenance_date: new Date().toISOString(),
        }));
        const { error: histErr } = await supabase
          .from('maintenance_history')
          .insert(historyRecords);
        if (histErr) {
          console.warn('Could not insert maintenance history batch:', histErr);
        }
      }

      // Optimistic local cache updates
      if (onLocalUpdate) {
        billboardIds.forEach((id) => {
          onLocalUpdate(id, updateData);
        });
      }

      toast.success(
        isRemovalStatus
          ? `تم تحديث حالة الصيانة لـ (${billboardIds.length}) لوحة وتغيير حالتها إلى "إزالة"`
          : `تم تحديث حالة الصيانة لـ (${billboardIds.length}) لوحة بنجاح`
      );

      onOpenChange(false);
      if (onSuccess) {
        await onSuccess();
      }
    } catch (err: any) {
      console.error('Error updating bulk maintenance:', err);
      toast.error(`فشل التحديث الجماعي: ${err?.message || 'خطأ غير متوقع'}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !saving && onOpenChange(v)}>
      <DialogContent dir="rtl" className="max-w-lg bg-card border-border rounded-2xl shadow-2xl p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-5 bg-muted/40 border-b border-border/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/15 text-amber-500 border border-amber-500/30">
              <Wrench className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
                <span>تعديل حالة الصيانة الجماعي</span>
                <Badge variant="outline" className="border-amber-500/30 text-amber-600 bg-amber-500/10 text-xs">
                  {billboardIds.length} لوحة
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                تطبيق حالة صيانة موحدة وتفاصيل الصيانة لكافة اللوحات المحددة دفعة واحدة
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {/* Billboards Preview summary */}
          <div className="p-3 rounded-xl bg-muted/40 border border-border/70 space-y-2">
            <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-1.5 text-foreground">
                <Layers className="h-3.5 w-3.5 text-primary" />
                اللوحات المختارة:
              </span>
              <span className="text-[11px] font-mono">{billboardIds.length} لوحة</span>
            </div>
            <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto pr-1">
              {billboards.slice(0, 30).map((b) => (
                <Badge
                  key={b.ID || b.id}
                  variant="secondary"
                  className="text-[10px] bg-background/80 hover:bg-background border border-border/80 text-foreground py-0.5 px-2"
                >
                  {b.Billboard_Name || `#${b.ID || b.id}`}
                </Badge>
              ))}
              {billboards.length > 30 && (
                <Badge variant="outline" className="text-[10px] text-muted-foreground">
                  +{billboards.length - 30} لوحة أخرى
                </Badge>
              )}
            </div>
          </div>

          {/* Maintenance Status & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="bulk-status" className="text-xs font-semibold text-foreground">
                حالة الصيانة <span className="text-destructive">*</span>
              </Label>
              {showCustomInput ? (
                <div className="flex gap-1">
                  <Input
                    id="bulk-status-custom"
                    className="h-9 text-xs rounded-xl"
                    placeholder="اكتب حالة جديدة..."
                    value={customStatus}
                    onChange={(e) => setCustomStatus(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCustomStatus()}
                    autoFocus
                  />
                  <Button size="sm" className="h-9 px-2.5 rounded-xl cursor-pointer" onClick={addCustomStatus}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-9 px-2 rounded-xl text-xs cursor-pointer"
                    onClick={() => setShowCustomInput(false)}
                  >
                    إلغاء
                  </Button>
                </div>
              ) : (
                <div className="flex gap-1.5">
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger id="bulk-status" className="h-9 text-xs rounded-xl flex-1">
                      <SelectValue placeholder="اختر حالة الصيانة" />
                    </SelectTrigger>
                    <SelectContent>
                      {allStatuses.map((s) => (
                        <SelectItem key={s.value} value={s.value} className="text-xs cursor-pointer">
                          <div className="flex items-center gap-2">
                            <span
                              className="w-2 h-2 rounded-full shrink-0"
                              style={{ backgroundColor: s.color }}
                            />
                            <span>{s.label}</span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-9 px-2.5 rounded-xl border-border cursor-pointer hover:bg-muted"
                    onClick={() => setShowCustomInput(true)}
                    title="إضافة حالة صيانة جديدة"
                  >
                    <Plus className="h-4 w-4 text-primary" />
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="bulk-priority" className="text-xs font-semibold text-foreground">
                درجة الأولوية
              </Label>
              <Select value={priority} onValueChange={setPriority}>
                <SelectTrigger id="bulk-priority" className="h-9 text-xs rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low" className="text-xs cursor-pointer">منخفضة</SelectItem>
                  <SelectItem value="normal" className="text-xs cursor-pointer">عادية</SelectItem>
                  <SelectItem value="high" className="text-xs cursor-pointer">عالية</SelectItem>
                  <SelectItem value="urgent" className="text-xs cursor-pointer">عاجلة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Maintenance Type suggestions */}
          <div className="space-y-1.5">
            <Label htmlFor="bulk-type" className="text-xs font-semibold text-foreground">
              نوع الصيانة / الإجراء
            </Label>
            <input
              id="bulk-type"
              list="bulk-maintenance-suggestions"
              className="flex h-9 w-full rounded-xl border border-input bg-background px-3 py-1.5 text-xs ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent transition-all"
              placeholder="اختر أو اكتب نوع الصيانة (صيانة دورية، إصلاح، تنظيف...)"
              value={type}
              onChange={(e) => setType(e.target.value)}
            />
            <datalist id="bulk-maintenance-suggestions">
              <option value="صيانة دورية" />
              <option value="إصلاح كشافات" />
              <option value="إصلاح شاسيه/هيكل" />
              <option value="تنظيف اللوحة" />
              <option value="استبدال اللوحة" />
              <option value="قص اللوحة" />
              <option value="لم يتم التركيب" />
              <option value="تحتاج إزالة للتطوير" />
              <option value="تمت الإزالة" />
            </datalist>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="bulk-desc" className="text-xs font-semibold text-foreground">
              وصف وتفاصيل الصيانة (اختياري)
            </Label>
            <Textarea
              id="bulk-desc"
              className="min-h-[70px] text-xs rounded-xl resize-none"
              placeholder="اكتب ملاحظات إضافية تُسجّل في أرشيف الصيانة لهذه اللوحات..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </div>

          {/* Visibility Action */}
          <div className="p-3.5 rounded-xl bg-muted/40 border border-border/80 space-y-2">
            <Label className="text-xs font-semibold text-foreground flex items-center justify-between">
              <span>الظهور في اللوحات المتاحة:</span>
              <span className="text-[10px] text-muted-foreground font-normal">اختياري</span>
            </Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setVisibilityAction('keep')}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all cursor-pointer ${
                  visibilityAction === 'keep'
                    ? 'bg-card border-primary text-primary shadow-xs'
                    : 'bg-background/60 border-border text-muted-foreground hover:bg-background'
                }`}
              >
                دون تغيير
              </button>
              <button
                type="button"
                onClick={() => setVisibilityAction('show')}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  visibilityAction === 'show'
                    ? 'bg-emerald-500/15 border-emerald-500 text-emerald-600 shadow-xs'
                    : 'bg-background/60 border-border text-muted-foreground hover:bg-background'
                }`}
              >
                <Eye className="h-3 w-3" />
                إظهار في المتاح
              </button>
              <button
                type="button"
                onClick={() => setVisibilityAction('hide')}
                className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all flex items-center justify-center gap-1 cursor-pointer ${
                  visibilityAction === 'hide'
                    ? 'bg-destructive/15 border-destructive text-destructive shadow-xs'
                    : 'bg-background/60 border-border text-muted-foreground hover:bg-background'
                }`}
              >
                <EyeOff className="h-3 w-3" />
                إخفاء من المتاح
              </button>
            </div>
          </div>

          {/* Automatic Removal Warning */}
          {isRemovalStatus && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5">
              <AlertTriangle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div className="text-xs text-amber-600 dark:text-amber-400 space-y-0.5">
                <p className="font-bold">تنبيه تلقائي لحالة الإزالة:</p>
                <p className="text-[11px] leading-relaxed">
                  سيتم تعيين حالة اللوحات المختارة إلى <strong>«إزالة»</strong> تلقائياً حتى لا تظهر في قوائم اللوحات المتاحة للتأجير.
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <DialogFooter className="p-4 bg-muted/40 border-t border-border/80 flex items-center justify-between gap-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onOpenChange(false)}
            disabled={saving}
            className="cursor-pointer text-xs"
          >
            إلغاء
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSubmit}
            disabled={saving || billboardIds.length === 0}
            className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground font-bold text-xs shadow-md cursor-pointer px-4"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                <span>جاري تحديث ({billboardIds.length}) لوحة...</span>
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                <span>تطبيق على ({billboardIds.length}) لوحة</span>
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BulkMaintenanceDialog;
