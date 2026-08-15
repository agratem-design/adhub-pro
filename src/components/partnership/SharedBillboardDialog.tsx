import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { Users, Percent, Wallet, TrendingDown, X, Plus, Save, Loader2 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';

interface PartnerRow {
  id: string;
  name: string;
  phone?: string | null;
  partner_pre_pct: number;
  partner_post_pct: number;
}

interface Props {
  trigger: React.ReactNode;
  billboard: any;
  onSaved?: () => void;
  autoSave?: boolean; // تفعيل الحفظ التلقائي
}

export function SharedBillboardDialog({ trigger, billboard, onSaved, autoSave = true }: Props) {
  const { confirm: systemConfirm } = useSystemDialog();
  const [open, setOpen] = useState(false);
  const [allPartners, setAllPartners] = useState<{ id: string; name: string; phone?: string | null; default_partner_pre_pct?: number; default_partner_post_pct?: number }[]>([]);
  const [rows, setRows] = useState<PartnerRow[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const saveTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInitialLoad = useRef(true);

  // رأس المال للوحة
  const [totalCapital, setTotalCapital] = useState<number>(0);
  const [capitalRemaining, setCapitalRemaining] = useState<number>(0);

  // نسب الشركة - مرحلة الاسترداد
  const [companyNetPctPre, setCompanyNetPctPre] = useState<number>(35);
  const [capitalDeductionPct, setCapitalDeductionPct] = useState<number>(30);
  // نسب الشركة - مرحلة الأرباح
  const [companyNetPctPost, setCompanyNetPctPost] = useState<number>(50);

  const partnersPctSum = useMemo(() => rows.reduce((s, r) => s + (Number(r.partner_pre_pct) || 0), 0), [rows]);
  const partnersPostPctSum = useMemo(() => rows.reduce((s, r) => s + (Number(r.partner_post_pct) || 0), 0), [rows]);

  // حساب النسب المتبقية تلقائياً
  const remainingPrePct = Math.max(0, 100 - companyNetPctPre - capitalDeductionPct);
  const remainingPostPct = Math.max(0, 100 - companyNetPctPost);

  // تحديث نسب الشركاء تلقائياً عند تغيير نسب الشركة
  const updateCompanyPrePct = (value: number) => {
    const newValue = Math.min(100 - capitalDeductionPct, Math.max(0, value));
    setCompanyNetPctPre(newValue);
    // توزيع المتبقي على الشركاء بالتساوي
    const remaining = 100 - newValue - capitalDeductionPct;
    if (rows.length > 0) {
      const perPartner = remaining / rows.length;
      setRows(rs => rs.map(r => ({ ...r, partner_pre_pct: Math.round(perPartner * 10) / 10 })));
    }
  };

  const updateCapitalDeductionPct = (value: number) => {
    const newValue = Math.min(100 - companyNetPctPre, Math.max(0, value));
    setCapitalDeductionPct(newValue);
    const remaining = 100 - companyNetPctPre - newValue;
    if (rows.length > 0) {
      const perPartner = remaining / rows.length;
      setRows(rs => rs.map(r => ({ ...r, partner_pre_pct: Math.round(perPartner * 10) / 10 })));
    }
  };

  const updateCompanyPostPct = (value: number) => {
    const newValue = Math.min(100, Math.max(0, value));
    setCompanyNetPctPost(newValue);
    const remaining = 100 - newValue;
    if (rows.length > 0) {
      const perPartner = remaining / rows.length;
      setRows(rs => rs.map(r => ({ ...r, partner_post_pct: Math.round(perPartner * 10) / 10 })));
    }
  };

  const preTotalPct = companyNetPctPre + partnersPctSum + capitalDeductionPct;
  const postTotalPct = companyNetPctPost + partnersPostPctSum;

  const load = async () => {
    try {
      const { data: partners } = await supabase.from('partners').select('id,name,phone,default_partner_pre_pct,default_partner_post_pct').order('name');
      setAllPartners(partners || []);

      const billboardId = billboard.ID || billboard.id;
      
      // تحميل رأس المال من اللوحة
      setTotalCapital(Number(billboard.capital || 0));
      setCapitalRemaining(Number(billboard.capital_remaining || billboard.capital || 0));

      const { data: sbLinks } = await supabase
        .from('shared_billboards')
        .select('*')
        .eq('billboard_id', billboardId);

      if (Array.isArray(sbLinks) && sbLinks.length > 0) {
        const mapped: PartnerRow[] = sbLinks.map((r: any) => ({
          id: r.partner_company_id,
          name: partners?.find(p => p.id === r.partner_company_id)?.name || '',
          phone: partners?.find(p => p.id === r.partner_company_id)?.phone || null,
          partner_pre_pct: Number(r.partner_pre_pct ?? 35),
          partner_post_pct: Number(r.partner_post_pct ?? 50),
        }));
        setRows(mapped);
        const any = sbLinks[0];
        setCompanyNetPctPre(Number(any.pre_company_pct ?? 35));
        setCapitalDeductionPct(Number(any.pre_capital_pct ?? 30));
        setCompanyNetPctPost(Number(any.post_company_pct ?? 50));
      } else {
        const partnerNames = billboard.partner_companies || [];
        if (partnerNames.length > 0 && partners) {
          const matchedRows: PartnerRow[] = [];
          for (const name of partnerNames) {
            const found = partners.find(p => p.name === name || name.includes(p.name) || p.name.includes(name));
            if (found) {
              matchedRows.push({
                id: found.id,
                name: found.name,
                phone: found.phone,
                partner_pre_pct: Number(found.default_partner_pre_pct ?? 35),
                partner_post_pct: Number(found.default_partner_post_pct ?? 50),
              });
            }
          }
          setRows(matchedRows);
        } else {
          setRows([]);
        }
        setCompanyNetPctPre(35);
        setCapitalDeductionPct(30);
        setCompanyNetPctPost(50);
      }
    } catch (e: any) {
      console.error(e);
      toast.error('فشل تحميل بيانات المشاركة');
    } finally {
      isInitialLoad.current = false;
    }
  };

  // الحفظ التلقائي مع debounce
  const saveData = useCallback(async (silent = false) => {
    const preTotalPctCalc = companyNetPctPre + rows.reduce((s, r) => s + (Number(r.partner_pre_pct) || 0), 0) + capitalDeductionPct;
    const postTotalPctCalc = companyNetPctPost + rows.reduce((s, r) => s + (Number(r.partner_post_pct) || 0), 0);
    
    if (Math.round(preTotalPctCalc) !== 100 || Math.round(postTotalPctCalc) !== 100 || rows.length === 0) {
      return false;
    }

    setIsSaving(true);
    try {
      const billboardId = billboard.ID || billboard.id;

      await supabase.from('shared_billboards').delete().eq('billboard_id', billboardId);

      const inserts = rows.map(r => ({
        billboard_id: billboardId,
        partner_company_id: r.id,
        partnership_percentage: r.partner_post_pct,
        capital_contribution: totalCapital / rows.length,
        capital_remaining: capitalRemaining / rows.length,
        status: 'active',
        pre_company_pct: companyNetPctPre,
        pre_capital_pct: capitalDeductionPct,
        post_company_pct: companyNetPctPost,
        partner_pre_pct: r.partner_pre_pct,
        partner_post_pct: r.partner_post_pct,
      }));

      const { error } = await supabase.from('shared_billboards').insert(inserts);
      if (error) throw error;

      await supabase.from('billboards').update({
        is_partnership: true,
        partner_companies: rows.map(r => r.name),
        capital: totalCapital,
        capital_remaining: capitalRemaining,
      } as any).eq('ID', billboardId);

      setHasChanges(false);
      if (!silent) toast.success('تم الحفظ تلقائياً');
      onSaved?.();
      return true;
    } catch (e: any) {
      console.error('auto save error', e);
      if (!silent) toast.error('فشل الحفظ التلقائي');
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [billboard, rows, totalCapital, capitalRemaining, companyNetPctPre, capitalDeductionPct, companyNetPctPost, onSaved]);

  // مراقبة التغييرات وتفعيل الحفظ التلقائي
  useEffect(() => {
    if (!autoSave || !open || isInitialLoad.current) return;
    
    setHasChanges(true);
    
    // إلغاء المؤقت السابق
    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current);
    }
    
    // تأخير الحفظ 800ms بعد آخر تغيير
    saveTimeoutRef.current = setTimeout(() => {
      saveData(true);
    }, 800);

    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current);
      }
    };
  }, [rows, totalCapital, capitalRemaining, companyNetPctPre, capitalDeductionPct, companyNetPctPost, autoSave, open]);

  useEffect(() => { 
    if (open) {
      isInitialLoad.current = true;
      load();
    }
  }, [open]);

  const addRow = (partnerId: string) => {
    if (!partnerId) return;
    const p = allPartners.find(p => p.id === partnerId);
    if (!p) return;
    if (rows.some(r => r.id === partnerId)) { toast.error('تم إضافة الشريك بالفعل'); return; }
    
    // حساب النسب المتبقية للشركاء الجدد
    const newRowsCount = rows.length + 1;
    const remainingPrePct = Math.max(0, 100 - companyNetPctPre - capitalDeductionPct);
    const remainingPostPct = Math.max(0, 100 - companyNetPctPost);
    
    const perPartnerPre = Math.round((remainingPrePct / newRowsCount) * 10) / 10;
    const perPartnerPost = Math.round((remainingPostPct / newRowsCount) * 10) / 10;
    
    // تحديث نسب الشركاء الموجودين
    const updatedRows = rows.map(r => ({
      ...r,
      partner_pre_pct: perPartnerPre,
      partner_post_pct: perPartnerPost
    }));
    
    // إضافة الشريك الجديد
    setRows([...updatedRows, {
      id: p.id,
      name: p.name,
      phone: p.phone,
      partner_pre_pct: perPartnerPre,
      partner_post_pct: perPartnerPost
    }]);
  };

  const removeRow = (partnerId: string) => {
    const newRows = rows.filter(x => x.id !== partnerId);
    
    // إعادة توزيع النسب على الشركاء المتبقين
    if (newRows.length > 0) {
      const remainingPrePct = Math.max(0, 100 - companyNetPctPre - capitalDeductionPct);
      const remainingPostPct = Math.max(0, 100 - companyNetPctPost);
      
      const perPartnerPre = Math.round((remainingPrePct / newRows.length) * 10) / 10;
      const perPartnerPost = Math.round((remainingPostPct / newRows.length) * 10) / 10;
      
      setRows(newRows.map(r => ({
        ...r,
        partner_pre_pct: perPartnerPre,
        partner_post_pct: perPartnerPost
      })));
    } else {
      setRows([]);
    }
  };

  const validate = () => {
    if (Math.round(preTotalPct) !== 100) { toast.error(`نسب مرحلة الاسترداد يجب أن تساوي 100% (الحالي ${preTotalPct}%)`); return false; }
    if (Math.round(postTotalPct) !== 100) { toast.error(`نسب مرحلة الأرباح يجب أن تساوي 100% (الحالي ${postTotalPct}%)`); return false; }
    if (rows.length === 0) { toast.error('يجب إضافة شريك واحد على الأقل'); return false; }
    return true;
  };

  const save = async () => {
    if (!validate()) return;
    setIsSaving(true);
    try {
      const billboardId = billboard.ID || billboard.id;

      await supabase.from('shared_billboards').delete().eq('billboard_id', billboardId);

      const inserts = rows.map(r => ({
        billboard_id: billboardId,
        partner_company_id: r.id,
        partnership_percentage: r.partner_post_pct,
        capital_contribution: totalCapital / rows.length,
        capital_remaining: capitalRemaining / rows.length,
        status: 'active',
        pre_company_pct: companyNetPctPre,
        pre_capital_pct: capitalDeductionPct,
        post_company_pct: companyNetPctPost,
        partner_pre_pct: r.partner_pre_pct,
        partner_post_pct: r.partner_post_pct,
      }));

      const { error } = await supabase.from('shared_billboards').insert(inserts);
      if (error) throw error;

      await supabase.from('billboards').update({
        is_partnership: true,
        partner_companies: rows.map(r => r.name),
        capital: totalCapital,
        capital_remaining: capitalRemaining,
      } as any).eq('ID', billboardId);

      toast.success('تم حفظ بيانات المشاركة');
      setHasChanges(false);
      setOpen(false);
      onSaved?.();
    } catch (e: any) {
      console.error('save shared billboard', e);
      toast.error(e?.message || 'فشل الحفظ');
    } finally {
      setIsSaving(false);
    }
  };

  // إلغاء تفعيل الشراكة
  const removePartnership = async () => {
    const confirmed = await systemConfirm({ title: 'إلغاء الشراكة', message: 'هل تريد إلغاء تفعيل الشراكة لهذه اللوحة؟ سيتم حذف جميع بيانات المشاركة.', variant: 'destructive', confirmText: 'إلغاء الشراكة' });
    if (!confirmed) return;
    
    setIsSaving(true);
    try {
      const billboardId = billboard.ID || billboard.id;
      
      // حذف سجلات المشاركة أولاً
      const { error: sharedError } = await supabase
        .from('shared_billboards')
        .delete()
        .eq('billboard_id', billboardId);
      
      if (sharedError) {
        console.error('Error deleting shared_billboards:', sharedError);
      }
      
      // حذف المعاملات المالية المرتبطة
      const { error: transError } = await supabase
        .from('shared_transactions')
        .delete()
        .eq('billboard_id', billboardId);
      
      if (transError) {
        console.error('Error deleting shared_transactions:', transError);
      }
      
      // تحديث اللوحة
      const { error: updateError } = await supabase
        .from('billboards')
        .update({
          is_partnership: false,
          partner_companies: null,
          capital: 0,
          capital_remaining: 0,
        } as any)
        .eq('ID', billboardId);
      
      if (updateError) throw updateError;
      
      toast.success('تم إلغاء تفعيل الشراكة وحذف جميع البيانات المرتبطة');
      setRows([]);
      setTotalCapital(0);
      setCapitalRemaining(0);
      setOpen(false);
      onSaved?.();
    } catch (e: any) {
      console.error('remove partnership error', e);
      toast.error(e?.message || 'فشل إلغاء الشراكة');
    } finally {
      setIsSaving(false);
    }
  };

  const recoveryProgress = totalCapital > 0 ? ((totalCapital - capitalRemaining) / totalCapital) * 100 : 0;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            إعداد مشاركة اللوحة: {billboard.Billboard_Name || billboard.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* رأس المال */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 mb-4">
              <Wallet className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">رأس المال</h3>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs text-muted-foreground">إجمالي رأس المال</Label>
                <Input 
                  type="number" 
                  value={totalCapital} 
                  onChange={(e) => setTotalCapital(Number(e.target.value || 0))}
                  className="mt-1 text-lg font-semibold"
                />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">المتبقي للاسترداد</Label>
                <div className="mt-1 flex items-center gap-2">
                  <span className="text-2xl font-bold text-primary">{capitalRemaining.toLocaleString()}</span>
                  <span className="text-sm text-muted-foreground">د.ل</span>
                </div>
              </div>
            </div>
            {totalCapital > 0 && (
              <div className="mt-3">
                <div className="flex justify-between text-xs text-muted-foreground mb-1">
                  <span>نسبة الاسترداد</span>
                  <span>{recoveryProgress.toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500"
                    style={{ width: `${recoveryProgress}%` }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* نسب التوزيع */}
          <div className="p-4 rounded-xl bg-muted/50 border">
            <div className="flex items-center gap-2 mb-4">
              <Percent className="h-5 w-5 text-primary" />
              <h3 className="font-semibold">نسب التوزيع</h3>
            </div>
            
            <div className="space-y-4">
              {/* مرحلة الاسترداد */}
              <div className="p-3 rounded-lg bg-background border">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 text-orange-500" />
                    مرحلة الاسترداد
                  </span>
                  <Badge variant={preTotalPct === 100 ? "default" : "destructive"} className="text-xs">
                    {preTotalPct}%
                  </Badge>
                </div>
                <div className="grid grid-cols-3 gap-3">
                  <div>
                    <Label className="text-xs">نسبة الشركة</Label>
                    <Input type="number" min={0} max={100} value={companyNetPctPre} onChange={(e) => updateCompanyPrePct(Number(e.target.value || 0))} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">استرداد رأس المال</Label>
                    <Input type="number" min={0} max={100} value={capitalDeductionPct} onChange={(e) => updateCapitalDeductionPct(Number(e.target.value || 0))} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">نصيب الشركاء</Label>
                    <div className="mt-1 p-2 rounded-md bg-muted text-center font-medium">{partnersPctSum}%</div>
                  </div>
                </div>
              </div>

              {/* مرحلة الأرباح */}
              <div className="p-3 rounded-lg bg-background border">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium flex items-center gap-2">
                    <TrendingDown className="h-4 w-4 rotate-180 text-green-500" />
                    مرحلة الأرباح (بعد السداد)
                  </span>
                  <Badge variant={postTotalPct === 100 ? "default" : "destructive"} className="text-xs">
                    {postTotalPct}%
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-xs">نسبة الشركة</Label>
                    <Input type="number" min={0} max={100} value={companyNetPctPost} onChange={(e) => updateCompanyPostPct(Number(e.target.value || 0))} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-xs">نصيب الشركاء</Label>
                    <div className="mt-1 p-2 rounded-md bg-muted text-center font-medium">{partnersPostPctSum}%</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* الشركاء */}
          <div className="p-4 rounded-xl bg-muted/50 border">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                <h3 className="font-semibold">الشركاء</h3>
                <Badge variant="secondary">{rows.length}</Badge>
              </div>
              <Select onValueChange={addRow}>
                <SelectTrigger className="w-48">
                  <div className="flex items-center gap-2">
                    <Plus className="h-4 w-4" />
                    <span>إضافة شريك</span>
                  </div>
                </SelectTrigger>
                <SelectContent>
                  {allPartners.filter(p => !rows.some(r => r.id === p.id)).map(p => (
                    <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {rows.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Users className="h-12 w-12 mx-auto mb-2 opacity-20" />
                <p>لا يوجد شركاء - قم بإضافة شريك</p>
              </div>
            ) : (
              <div className="space-y-2">
                {rows.map(r => (
                  <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-background border group hover:border-primary/50 transition-colors">
                    <div className="flex-1">
                      <div className="font-medium">{r.name}</div>
                      {r.phone && <div className="text-xs text-muted-foreground">{r.phone}</div>}
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-center">
                        <Label className="text-xs text-muted-foreground">قبل السداد</Label>
                        <Input 
                          type="number" 
                          value={r.partner_pre_pct}
                          onChange={(e) => setRows(rs => rs.map(x => x.id === r.id ? { ...x, partner_pre_pct: Number(e.target.value || 0) } : x))}
                          className="w-20 text-center"
                        />
                      </div>
                      <div className="text-center">
                        <Label className="text-xs text-muted-foreground">بعد السداد</Label>
                        <Input 
                          type="number" 
                          value={r.partner_post_pct}
                          onChange={(e) => setRows(rs => rs.map(x => x.id === r.id ? { ...x, partner_post_pct: Number(e.target.value || 0) } : x))}
                          className="w-20 text-center"
                        />
                      </div>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => removeRow(r.id)}
                        className="opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0 mt-4 flex-wrap">
          <div className="flex items-center gap-2 mr-auto text-sm text-muted-foreground">
            {isSaving && (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                <span>جاري الحفظ...</span>
              </>
            )}
            {!isSaving && hasChanges && autoSave && (
              <span className="text-yellow-600">تغييرات غير محفوظة</span>
            )}
            {!isSaving && !hasChanges && autoSave && rows.length > 0 && (
 <span className="text-green-600"> محفوظ</span>
            )}
          </div>
          {rows.length > 0 && (
            <Button 
              variant="destructive" 
              onClick={removePartnership} 
              disabled={isSaving}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              إلغاء الشراكة
            </Button>
          )}
          <Button variant="outline" onClick={() => setOpen(false)}>إغلاق</Button>
          <Button onClick={save} disabled={isSaving} className="gap-2">
            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
