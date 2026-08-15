import React, { useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Wrench, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface MaintenanceForm {
  status: string;
  type: string;
  description: string;
  priority: string;
}

interface MaintenanceStatus {
  id: string;
  name: string;
  label: string;
  color: string;
}

interface MaintenanceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedBillboard: any;
  setSelectedBillboard: (b: any) => void;
  maintenanceForm: MaintenanceForm;
  setMaintenanceForm: React.Dispatch<React.SetStateAction<MaintenanceForm>>;
  onSubmit: () => Promise<void>;
  loadBillboards?: (opts?: any) => Promise<void>;
  onLocalUpdate?: (id: number | string, updates: Record<string, any>) => void;
}

export const MaintenanceDialog: React.FC<MaintenanceDialogProps> = ({
  open,
  onOpenChange,
  selectedBillboard,
  setSelectedBillboard,
  maintenanceForm,
  setMaintenanceForm,
  onSubmit,
  loadBillboards,
  onLocalUpdate,
}) => {
  const [dynamicStatuses, setDynamicStatuses] = useState<MaintenanceStatus[]>([]);
  const [customStatus, setCustomStatus] = useState('');
  const [showCustomInput, setShowCustomInput] = useState(false);

  useEffect(() => {
    if (open) {
      loadStatuses();
    } else {
      // ✅ تنظيف pointer-events من body بعد إغلاق Radix Dialog لمنع تجميد الواجهة
      const t = setTimeout(() => {
        if (document.body.style.pointerEvents === 'none') {
          document.body.style.pointerEvents = '';
        }
        document.body.style.removeProperty('overflow');
      }, 250);
      return () => clearTimeout(t);
    }
  }, [open]);

  const loadStatuses = async () => {
    const { data } = await supabase
      .from('maintenance_statuses')
      .select('*')
      .order('created_at');
    if (data) setDynamicStatuses(data as MaintenanceStatus[]);
  };

  const addCustomStatus = async () => {
    if (!customStatus.trim()) return;
    const name = customStatus.trim();
    // Check if already exists
    if (dynamicStatuses.some(s => s.name === name || s.label === name)) {
      const existing = dynamicStatuses.find(s => s.label === name || s.name === name);
      if (existing) setMaintenanceForm(prev => ({ ...prev, status: existing.name }));
      setCustomStatus('');
      setShowCustomInput(false);
      return;
    }
    // Insert new
    const { error } = await supabase
      .from('maintenance_statuses')
      .insert({ name, label: name, color: '#6b7280' });
    if (!error) {
      await loadStatuses();
      setMaintenanceForm(prev => ({ ...prev, status: name }));
      toast.success(`تمت إضافة حالة "${name}"`);
    }
    setCustomStatus('');
    setShowCustomInput(false);
  };

  // Merge hardcoded + dynamic for display
  const allStatuses: { value: string; label: string }[] = dynamicStatuses.length > 0
    ? dynamicStatuses.map(s => ({ value: s.name, label: s.label }))
    : [
        { value: 'operational', label: 'بحالة جيدة' },
        { value: 'maintenance', label: 'قيد الصيانة' },
        { value: 'repair_needed', label: 'تحتاج إصلاح' },
        { value: 'out_of_service', label: 'خارج الخدمة' },
        { value: 'لم يتم التركيب', label: 'لم يتم التركيب' },
        { value: 'متضررة اللوحة', label: 'متضررة اللوحة' },
        { value: 'تحتاج ازالة لغرض التطوير', label: 'تحتاج إزالة للتطوير' },
        { value: 'removed', label: 'تمت الإزالة' },
      ];

  const getStatusColor = (status: string) => {
    const found = dynamicStatuses.find(s => s.name === status);
    return found?.color || '#6b7280';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="h-5 w-5 text-primary" />
            إدارة صيانة اللوحة
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {selectedBillboard && (
            <div className="p-3 bg-muted rounded-lg space-y-2">
              <div className="flex items-start justify-between">
                <div>
                  <p className="font-semibold">{selectedBillboard.Billboard_Name || `لوحة رقم ${selectedBillboard.ID}`}</p>
                  <p className="text-sm text-muted-foreground">{selectedBillboard.Nearest_Landmark || selectedBillboard.District}</p>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  {selectedBillboard.maintenance_status && selectedBillboard.maintenance_status !== 'operational' && (
                    <Badge variant="outline" style={{ borderColor: getStatusColor(selectedBillboard.maintenance_status), color: getStatusColor(selectedBillboard.maintenance_status) }}>
                      {dynamicStatuses.find(s => s.name === selectedBillboard.maintenance_status)?.label || selectedBillboard.maintenance_status}
                    </Badge>
                  )}
                  {selectedBillboard.maintenance_priority && selectedBillboard.maintenance_priority !== 'normal' && (
                    <Badge className={
                      selectedBillboard.maintenance_priority === 'low' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' :
                      selectedBillboard.maintenance_priority === 'high' ? 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400' :
                      selectedBillboard.maintenance_priority === 'urgent' ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' :
                      ''
                    }>
                      {selectedBillboard.maintenance_priority === 'low' ? 'منخفضة' :
                       selectedBillboard.maintenance_priority === 'high' ? 'عالية' :
                       selectedBillboard.maintenance_priority === 'urgent' ? 'عاجلة' : ''}
                    </Badge>
                  )}
                </div>
              </div>
              {selectedBillboard.maintenance_type && (
                <p className="text-xs text-muted-foreground bg-background/50 rounded px-2 py-1">
                  {selectedBillboard.maintenance_type}
                </p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="maintenance-status">حالة الصيانة *</Label>
              {showCustomInput ? (
                <div className="flex gap-1">
                  <Input
                    className="h-9 text-sm"
                    placeholder="اكتب حالة جديدة..."
                    value={customStatus}
                    onChange={(e) => setCustomStatus(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCustomStatus()}
                    autoFocus
                  />
                  <Button size="sm" className="h-9 px-2" onClick={addCustomStatus}>
                    <Plus className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="ghost" className="h-9 px-2" onClick={() => setShowCustomInput(false)}>
 
                  </Button>
                </div>
              ) : (
                <div className="flex gap-1">
                  <Select
                    value={maintenanceForm.status}
                    onValueChange={(value) => setMaintenanceForm(prev => ({ ...prev, status: value }))}
                  >
                    <SelectTrigger className="h-9 flex-1">
                      <SelectValue placeholder="اختر الحالة" />
                    </SelectTrigger>
                    <SelectContent>
                      {allStatuses.map(s => (
                        <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button size="sm" variant="outline" className="h-9 px-2" onClick={() => setShowCustomInput(true)} title="إضافة حالة جديدة">
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">الأولوية</Label>
              <Select
                value={maintenanceForm.priority}
                onValueChange={(value) => setMaintenanceForm(prev => ({ ...prev, priority: value }))}
              >
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">منخفضة</SelectItem>
                  <SelectItem value="normal">عادية</SelectItem>
                  <SelectItem value="high">عالية</SelectItem>
                  <SelectItem value="urgent">عاجلة</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="maintenance-type">ملاحظات الصيانة</Label>
            <input
              id="maintenance-type"
              list="maintenance-suggestions"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              placeholder="اكتب أو اختر من المتاح..."
              value={maintenanceForm.type}
              onChange={(e) => setMaintenanceForm(prev => ({ ...prev, type: e.target.value }))}
            />
            <datalist id="maintenance-suggestions">
              <option value="صيانة دورية" />
              <option value="إصلاح" />
              <option value="تنظيف" />
              <option value="استبدال اللوحة" />
              <option value="قص اللوحة" />
              <option value="لم يتم التركيب" />
              <option value="تحتاج إزالة" />
              <option value="إزالة للتطوير" />
              <option value="تمت الإزالة" />
            </datalist>
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">وصف تفصيلي (اختياري)</Label>
            <Textarea
              id="description"
              className="min-h-[60px]"
              placeholder="اكتب وصف تفصيلي للمشكلة أو الصيانة..."
              value={maintenanceForm.description}
              onChange={(e) => setMaintenanceForm(prev => ({ ...prev, description: e.target.value }))}
            />
          </div>

          {/* زر إخفاء من المتاح */}
          {selectedBillboard && (
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border">
              <div className="flex flex-col">
                <span className="text-sm font-medium">إخفاء من اللوحات المتاحة</span>
                <span className="text-xs text-muted-foreground">
                  {selectedBillboard.is_visible_in_available === false 
                    ? 'اللوحة مخفية حالياً' 
                    : 'اللوحة ظاهرة في المتاح'}
                </span>
              </div>
              <Button
                type="button"
                size="sm"
                variant={selectedBillboard.is_visible_in_available === false ? "default" : "destructive"}
                onClick={async () => {
                  const newValue = selectedBillboard.is_visible_in_available === false ? true : false;
                  const prevValue = selectedBillboard.is_visible_in_available !== false;
                  // ✅ تحديث متفائل فوري
                  setSelectedBillboard({ ...selectedBillboard, is_visible_in_available: newValue });
                  onLocalUpdate?.(selectedBillboard.ID, { is_visible_in_available: newValue });
                  try {
                    const { error } = await supabase
                      .from('billboards')
                      .update({ is_visible_in_available: newValue })
                      .eq('ID', selectedBillboard.ID);
                    
                    if (error) throw error;
                    
                    toast.success(newValue ? 'تم إظهار اللوحة في المتاح' : 'تم إخفاء اللوحة من المتاح');
                  } catch (error) {
                    // ✅ Rollback
                    setSelectedBillboard({ ...selectedBillboard, is_visible_in_available: prevValue });
                    onLocalUpdate?.(selectedBillboard.ID, { is_visible_in_available: prevValue });
                    toast.error('فشل في تحديث حالة الإظهار');
                  }
                }}
              >
                {selectedBillboard.is_visible_in_available === false ? 'إظهار' : 'إخفاء'}
              </Button>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button onClick={onSubmit} className="flex-1">
              حفظ التغييرات
            </Button>
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              className="flex-1"
            >
              إلغاء
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
