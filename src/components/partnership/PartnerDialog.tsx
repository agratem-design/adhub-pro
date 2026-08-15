import { useEffect, useState, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { Loader2, Save } from 'lucide-react';

interface PartnerDialogProps {
  trigger?: React.ReactNode;
  partner?: { id?: string; name: string; phone?: string | null } | null;
  onSaved?: () => void;
  autoSave?: boolean;
}

export function PartnerDialog({ trigger, partner, onSaved, autoSave = true }: PartnerDialogProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [defaultPre, setDefaultPre] = useState<number>(35);
  const [defaultPost, setDefaultPost] = useState<number>(50);
  const [defaultCapital, setDefaultCapital] = useState<number>(0);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoad = useRef(true);
  const isEdit = Boolean(partner?.id);

  useEffect(() => {
    const loadDefaults = async () => {
      if (!partner?.id) return;
      const { data } = await supabase.from('partners').select('default_partner_pre_pct, default_partner_post_pct, default_capital_contribution').eq('id', partner.id).single();
      if (data) {
        setDefaultPre(Number(data.default_partner_pre_pct ?? 35));
        setDefaultPost(Number(data.default_partner_post_pct ?? 50));
        setDefaultCapital(Number(data.default_capital_contribution ?? 0));
      }
      isInitialLoad.current = false;
    };
    if (open) {
      isInitialLoad.current = true;
      setName(partner?.name || '');
      setPhone(partner?.phone || '');
      setDefaultPre(35); setDefaultPost(50); setDefaultCapital(0);
      setHasChanges(false);
      if (isEdit) loadDefaults();
      else isInitialLoad.current = false;
    }
  }, [open, partner, isEdit]);

  // الحفظ التلقائي
  const saveData = useCallback(async (silent = false) => {
    if (!isEdit || !partner?.id) return false;
    
    const payload: any = {
      name: name.trim(),
      phone: phone.trim() || null,
      default_partner_pre_pct: Number(defaultPre||0),
      default_partner_post_pct: Number(defaultPost||0),
      default_capital_contribution: Number(defaultCapital||0),
    };
    
    if (!payload.name) return false;
    if (payload.default_partner_pre_pct < 0 || payload.default_partner_post_pct < 0) return false;
    if (payload.default_partner_pre_pct > 100 || payload.default_partner_post_pct > 100) return false;

    setIsSaving(true);
    try {
      const { error } = await supabase.from('partners').update(payload).eq('id', partner.id);
      if (error) throw error;
      setHasChanges(false);
      onSaved?.();
      return true;
    } catch (e: any) {
      console.error('auto save partner error', e);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [partner?.id, isEdit, name, phone, defaultPre, defaultPost, defaultCapital, onSaved]);

  // مراقبة التغييرات
  useEffect(() => {
    if (!autoSave || !open || !isEdit || isInitialLoad.current) return;
    
    setHasChanges(true);
    
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    saveTimeoutRef.current = setTimeout(() => {
      saveData(true);
    }, 800);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [name, phone, defaultPre, defaultPost, defaultCapital, autoSave, open, isEdit]);

  const save = async () => {
    const payload: any = {
      name: name.trim(),
      phone: phone.trim() || null,
      default_partner_pre_pct: Number(defaultPre||0),
      default_partner_post_pct: Number(defaultPost||0),
      default_capital_contribution: Number(defaultCapital||0),
    };
    if (!payload.name) { toast.error('الاسم مطلوب'); return; }
    if (payload.default_partner_pre_pct < 0 || payload.default_partner_post_pct < 0) { toast.error('النِسب يجب أن تكون موجبة'); return; }
    if (payload.default_partner_pre_pct > 100 || payload.default_partner_post_pct > 100) { toast.error('النِسب لا تتجاوز 100%'); return; }

    setIsSaving(true);
    try {
      let error;
      if (isEdit) {
        ({ error } = await supabase.from('partners').update(payload).eq('id', partner!.id));
      } else {
        ({ error } = await supabase.from('partners').insert(payload));
      }
      if (error) throw error;
      toast.success(isEdit ? 'تم تحديث الشركة' : 'تمت إضافة الشركة');
      setHasChanges(false);
      setOpen(false);
      onSaved?.();
    } catch (e: any) {
      toast.error(e?.message || 'فشل الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger ? <DialogTrigger asChild>{trigger}</DialogTrigger> : null}
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? 'تعديل شركة مشاركة' : 'إضافة شركة مشاركة'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2">
            <Label>اسم الشركة</Label>
            <Input value={name} onChange={(e)=>setName(e.target.value)} placeholder="اسم الشركة" />
          </div>
          <div className="grid gap-2">
            <Label>رقم الهاتف</Label>
            <Input value={phone} onChange={(e)=>setPhone(e.target.value)} placeholder="09XXXXXXXX" />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="grid gap-2">
              <Label>نسبة الشريك (الاسترداد)</Label>
              <Input type="number" value={defaultPre} onChange={(e)=>setDefaultPre(Number(e.target.value||0))} />
            </div>
            <div className="grid gap-2">
              <Label>نسبة الشريك (بعد السداد)</Label>
              <Input type="number" value={defaultPost} onChange={(e)=>setDefaultPost(Number(e.target.value||0))} />
            </div>
            <div className="grid gap-2">
              <Label>رأس المال الافتراضي</Label>
              <Input type="number" value={defaultCapital} onChange={(e)=>setDefaultCapital(Number(e.target.value||0))} />
            </div>
          </div>
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <div className="flex items-center gap-2 mr-auto text-sm text-muted-foreground">
            {isSaving && (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>جاري الحفظ...</span>
              </>
            )}
            {!isSaving && hasChanges && autoSave && isEdit && (
              <span className="text-yellow-600">تغييرات غير محفوظة</span>
            )}
            {!isSaving && !hasChanges && autoSave && isEdit && (
 <span className="text-green-600"> محفوظ</span>
            )}
          </div>
          <Button variant="secondary" onClick={()=>setOpen(false)}>إغلاق</Button>
          <Button onClick={save} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {isEdit ? 'حفظ' : 'إضافة'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
