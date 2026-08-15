// @ts-nocheck
import { useEffect, useState } from 'react';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { CheckCircle2, Info, TrendingUp, Settings2, FileText, Users } from 'lucide-react';
import { SharedBillboardDialog } from '@/components/partnership/SharedBillboardDialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import InteractiveMap from '@/components/InteractiveMap';

export default function SharedBillboards() {
  const { confirm: systemConfirm } = useSystemDialog();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [rentAmountById, setRentAmountById] = useState<Record<string, number>>({});
  const [rentContractById, setRentContractById] = useState<Record<string, string>>({});
  const [contractsById, setContractsById] = useState<Record<string, any[]>>({});

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('billboards')
        .select('*')
        .eq('is_partnership', true)
        .order('updated_at', { ascending: false });
      if (error) throw error;
      setList(Array.isArray(data) ? data : []);
    } catch (e: any) {
      console.error('load shared billboards', e, { message: e?.message, details: e?.details, hint: e?.hint });
      const msg = e?.message || (typeof e === 'object' ? JSON.stringify(e, Object.getOwnPropertyNames(e)) : String(e));
      toast.error(msg || 'فشل تحميل اللوحات المشتركة');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const fetchTerms = async (billboardId: number | string) => {
    const { data } = await supabase
      .from('shared_billboards')
      .select('pre_company_pct, pre_capital_pct, post_company_pct, partner_company_id, partner_pre_pct, partner_post_pct')
      .eq('billboard_id', billboardId);
    return Array.isArray(data) ? data : [];
  };

  const getRentFromContract = (contract: any, billboardId: string | number) => {
    try {
      const raw = contract.billboards_data;
      if (!raw) return 0;
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) {
        const found = arr.find((it: any) => String(it.id) === String(billboardId));
        if (found && found.contractPrice != null) return Number(found.contractPrice) || 0;
      }
    } catch {}
    return 0;
  };

  const loadContractsFor = async (billboardId: number | string) => {
    const idStr = String(billboardId);
    try {
      const results: any[] = [];
      
      // Search in billboard_ids (comma-separated)
      const { data: byIds } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type", "Total Rent", billboards_data, billboard_ids, "Contract Date", "End Date"')
        .or(`billboard_ids.ilike."%25,${idStr},%25",billboard_ids.ilike."${idStr},%25",billboard_ids.ilike."%25,${idStr}",billboard_ids.eq.${idStr}`);
      
      if (Array.isArray(byIds)) {
        // Filter to ensure exact match in comma-separated list
        const filtered = byIds.filter(c => {
          if (!c.billboard_ids) return false;
          const ids = c.billboard_ids.split(',').map((id: string) => id.trim());
          return ids.includes(idStr);
        });
        results.push(...filtered);
      }

      // Search in billboards_data JSON
      const { data: byJson } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type", "Total Rent", billboards_data, billboard_ids, "Contract Date", "End Date"')
        .or(`billboards_data.ilike.%"id":"${idStr}"%,billboards_data.ilike.%"id":${idStr},%`);
      
      if (Array.isArray(byJson)) {
        // Filter to ensure exact match in JSON
        const filtered = byJson.filter(c => {
          if (!c.billboards_data) return false;
          try {
            const arr = JSON.parse(c.billboards_data);
            return Array.isArray(arr) && arr.some((item: any) => String(item.id) === idStr);
          } catch { return false; }
        });
        results.push(...filtered);
      }

      // Search by billboard_id column
      const { data: byCol } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type", "Total Rent", billboards_data, billboard_ids, billboard_id, "Contract Date", "End Date"')
        .eq('billboard_id', billboardId);
      if (Array.isArray(byCol)) results.push(...byCol);

      const uniq = Object.values((results || []).reduce((acc: any, cur: any) => {
        acc[cur.Contract_Number] = cur; return acc;
      }, {}));

      setContractsById((p) => ({ ...p, [idStr]: uniq as any[] }));
      
      // Calculate total rent from contracts for this billboard
      let totalRentFromContracts = 0;
      uniq.forEach((contract: any) => {
        const rentFromThis = getRentFromContract(contract, idStr);
        totalRentFromContracts += rentFromThis;
      });
      
      return { contracts: uniq, totalRent: totalRentFromContracts };
    } catch (e) {
      console.warn('loadContractsFor error', e);
      return { contracts: [], totalRent: 0 };
    }
  };

  // Auto-calculate capital recovery from contracts
  const calculateRecoveryFromContracts = async (billboard: any) => {
    const idStr = String(billboard.ID || billboard.id);
    const contracts = contractsById[idStr] || [];
    
    let totalRent = 0;
    contracts.forEach((contract: any) => {
      const rentFromThis = getRentFromContract(contract, idStr);
      totalRent += rentFromThis;
    });
    
    if (totalRent <= 0) {
      toast.error('لا توجد عقود مرتبطة بهذه اللوحة');
      return;
    }
    
    const capital = Number(billboard.capital || 0);
    const terms = await fetchTerms(billboard.ID || billboard.id);
    const preCapitalPct = Number(terms?.[0]?.pre_capital_pct ?? 30) / 100;
    
    // Calculate capital deduction (30% of rent goes to capital recovery)
    const capitalDeduction = totalRent * preCapitalPct;
    const newCapitalRemaining = Math.max(0, capital - capitalDeduction);
    
    try {
      const { error } = await supabase
        .from('billboards')
        .update({ capital_remaining: newCapitalRemaining })
        .eq('ID', billboard.ID || billboard.id);
      
      if (error) throw error;
      
      toast.success(
        `تم تحديث الاسترداد\n` +
        `• إجمالي الإيجار من العقود: ${totalRent.toLocaleString()} د.ل\n` +
        `• خصم رأس المال (${preCapitalPct * 100}%): ${capitalDeduction.toLocaleString()} د.ل\n` +
        `• المتبقي: ${newCapitalRemaining.toLocaleString()} د.ل`,
        { duration: 5000 }
      );
      
      load();
    } catch (e: any) {
      toast.error(e?.message || 'فشل تحديث الاسترداد');
    }
  };

  // حساب الاسترداد الديناميكي من العقود عند تحميل البيانات
  const [dynamicRecovery, setDynamicRecovery] = useState<Record<string, { totalRent: number; capitalDeduction: number; newRemaining: number }>>({});

  const calculateDynamicRecovery = async (bb: any) => {
    const idStr = String(bb.ID || bb.id);
    const contracts = contractsById[idStr] || [];
    
    let totalRent = 0;
    contracts.forEach((contract: any) => {
      const rentFromThis = getRentFromContract(contract, idStr);
      totalRent += rentFromThis;
    });
    
    if (totalRent > 0) {
      const capital = Number(bb.capital || 0);
      const terms = await fetchTerms(bb.ID || bb.id);
      const preCapitalPct = Number(terms?.[0]?.pre_capital_pct ?? 30) / 100;
      
      const capitalDeduction = totalRent * preCapitalPct;
      const newRemaining = Math.max(0, capital - capitalDeduction);
      
      setDynamicRecovery(prev => ({
        ...prev,
        [idStr]: { totalRent, capitalDeduction, newRemaining }
      }));
    }
  };

  useEffect(() => {
    if (list && list.length > 0) {
      list.forEach((bb:any) => loadContractsFor(bb.ID || bb.id));
    }
  }, [list]);

  // حساب الاسترداد الديناميكي بعد تحميل العقود
  useEffect(() => {
    if (list && list.length > 0 && Object.keys(contractsById).length > 0) {
      list.forEach((bb: any) => calculateDynamicRecovery(bb));
    }
  }, [contractsById]);

  const calculateSplit = async (billboard: any, rent: number) => {
    const capital = Number(billboard.capital || 0);
    const capRem = Number(billboard.capital_remaining ?? capital);
    const terms = await fetchTerms(billboard.ID || billboard.id);

    const preCompanyPct = Number(terms?.[0]?.pre_company_pct ?? 35) / 100;
    const preCapitalPct = Number(terms?.[0]?.pre_capital_pct ?? 30) / 100;
    const postCompanyPct = Number(terms?.[0]?.post_company_pct ?? 50) / 100;

    const partners = terms.map(t => ({ id: t.partner_company_id, pre: Number(t.partner_pre_pct ?? 35)/100, post: Number(t.partner_post_pct ?? 50)/100 }));

    if (capRem > 0) {
      const company = rent * preCompanyPct;
      const partnerTotal = rent * partners.reduce((s,p)=>s + p.pre, 0);
      const deduct = rent * preCapitalPct;
      const newCap = Math.max(0, capRem - deduct);
      return { company, partnerTotal, partners, deduct, newCap, phase: 'recovery' };
    }

    const company = rent * postCompanyPct;
    const partnerTotal = rent * partners.reduce((s,p)=>s + p.post, 0);
    return { company, partnerTotal, partners, deduct: 0, newCap: 0, phase: 'profit_sharing' };
  };

  const applyRent = async (bb: any) => {
    const rent = Number(rentAmountById[bb.ID || bb.id] || 0);
    if (!rent || rent <= 0) {
      toast.error('أدخل مبلغ إيجار صالح');
      return;
    }

    const split = await calculateSplit(bb, rent);

    // Optional: contract lookup
    const rowKey = String(bb.ID || bb.id);
    const contractNumberRaw = rentContractById[rowKey];
    const contractNumber = contractNumberRaw ? Number(contractNumberRaw) : null;
    let contractInfo: any = null;
    if (contractNumber) {
      try {
        const { data: c } = await supabase
          .from('Contract')
          .select('"Contract Date", "End Date", customer_id, "Customer Name"')
          .eq('Contract_Number', contractNumber)
          .limit(1)
          .single();
        contractInfo = c || null;
      } catch {}
    }

    try {
      const payload: any = {};
      if (split.newCap !== undefined) {
        payload.capital_remaining = split.newCap;
      }

      const { error } = await supabase
        .from('billboards')
        .update(payload)
        .eq('ID', bb.ID || bb.id);

      if (error) throw error;

      try {
        await supabase.from('shared_transactions').insert({
          billboard_id: bb.ID || bb.id,
          beneficiary: 'الفارس',
          amount: Number(split.company || 0),
          type: 'rental_income'
        });

        if (split.partners && split.partners.length > 0) {
          const partnerNames: Record<string,string> = {};
          try {
            const { data: ps } = await supabase.from('partners').select('id,name');
            (ps||[]).forEach((p:any)=>{ partnerNames[p.id]=p.name; });
          } catch {}

          const inserts = split.partners.map((p:any) => ({
            billboard_id: bb.ID || bb.id,
            beneficiary: partnerNames[p.id] || p.id,
            amount: (split.phase==='recovery' ? p.pre : p.post) * rent,
            type: 'rental_income'
          }));
          await supabase.from('shared_transactions').insert(inserts as any[]);
        }

        if (Number(split.deduct || 0) > 0) {
          await supabase.from('shared_transactions').insert({
            billboard_id: bb.ID || bb.id,
            beneficiary: 'رأس المال',
            amount: Number(split.deduct || 0),
            type: 'capital_deduction'
          });
        }
      } catch (txErr) {
        console.warn('failed to insert shared transactions', txErr);
      }

      const phase = split.phase === 'recovery' ? 'مرحلة استرداد رأس المال' : 'مرحلة توزيع الأرباح';
      toast.success(
        `تم تطبيق الإيجار (${phase})` +
        `\n• الفارس: ${split.company.toLocaleString()} د.ل` +
        `\n• الشركاء: ${split.partnerTotal.toLocaleString()} د.ل` +
        (split.deduct > 0 ? `\n• خصم رأس المال: ${split.deduct.toLocaleString()} د.ل` : ''),
        { duration: 5000 }
      );

      try {
        await supabase.from('billboard_rental_history').insert({
          billboard_id: bb.ID || bb.id,
          contract_number: contractNumber || null,
          customer_id: contractInfo?.customer_id || null,
          customer_name: contractInfo?.['Customer Name'] || null,
          start_date: contractInfo?.['Contract Date'] || null,
          end_date: contractInfo?.['End Date'] || null,
          rent_amount: rent,
          phase: split.phase,
        });
      } catch (e) {
        console.warn('rental history insert failed', e);
      }

      setRentAmountById(p => ({ ...p, [String(bb.ID || bb.id)]: 0 }));
      setRentContractById(p => ({ ...p, [String(bb.ID || bb.id)]: '' }));
      load();
    } catch (e: any) {
      console.error('apply rent error', e);
      toast.error(e?.message || 'فشل تطبيق الإيجار');
    }
  };

  const removeFromPartnership = async (bb: any) => {
    const confirmed = await systemConfirm({ title: 'إزالة من الشراكة', message: 'هل تريد إزالة هذه اللوحة من الشراكة؟ سيتم حذف جميع بيانات المشاركة المرتبطة بها.', variant: 'destructive', confirmText: 'إزالة' });
    if (!confirmed) return;

    try {
      const billboardId = bb.ID || bb.id;
      
      // حذف سجلات المشاركة
      await supabase
        .from('shared_billboards')
        .delete()
        .eq('billboard_id', billboardId);
      
      // حذف المعاملات المالية المرتبطة
      await supabase
        .from('shared_transactions')
        .delete()
        .eq('billboard_id', billboardId);
      
      // تحديث اللوحة
      const { error } = await supabase
        .from('billboards')
        .update({ 
          is_partnership: false, 
          partner_companies: null,
          capital: 0,
          capital_remaining: 0
        })
        .eq('ID', billboardId);

      if (error) throw error;
      toast.success('تمت إزالة اللوحة من الشراكة وتحديث جميع البيانات');
      load();
    } catch (e: any) {
      console.error('remove partnership error', e);
      toast.error(e?.message || 'فشل إزالة اللوحة من الشراكة');
    }
  };

  const getCapitalStatus = (bb: any) => {
    const capital = Number(bb.capital || 0);
    const remaining = Number(bb.capital_remaining ?? capital);

    if (remaining <= 0) {
      return {
        badge: <Badge className="bg-green-600 hover:bg-green-700">مكتمل</Badge>,
        percentage: 100,
        phase: 'توزيع الأرباح'
      };
    }

    const recovered = capital - remaining;
    const percentage = capital > 0 ? Math.round((recovered / capital) * 100) : 0;

    return {
      badge: <Badge className="bg-blue-600 hover:bg-blue-700">استرداد</Badge>,
      percentage,
      phase: 'استرداد رأس المال'
    };
  };

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">اللوحات المشتركة</h1>
        <p className="text-muted-foreground mt-2">إدارة اللوحات الإعلانية المشتركة مع الشركاء</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-purple-500/10 to-purple-600/5 border-purple-500/20">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">إجمالي اللوحات</div>
            <div className="text-2xl font-bold text-purple-600">{list.length}</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-600/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">إجمالي رأس المال</div>
            <div className="text-2xl font-bold text-blue-600">
              {list.reduce((sum, bb) => sum + Number(bb.capital || 0), 0).toLocaleString()} د.ل
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-600/5 border-orange-500/20">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">المتبقي للاسترداد</div>
            <div className="text-2xl font-bold text-orange-600">
              {list.reduce((sum, bb) => sum + Number(bb.capital_remaining || bb.capital || 0), 0).toLocaleString()} د.ل
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-green-600/5 border-green-500/20">
          <CardContent className="p-4">
            <div className="text-sm text-muted-foreground">المسترد</div>
            <div className="text-2xl font-bold text-green-600">
              {list.reduce((sum, bb) => {
                const capital = Number(bb.capital || 0);
                const remaining = Number(bb.capital_remaining ?? capital);
                return sum + (capital - remaining);
              }, 0).toLocaleString()} د.ل
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Billboards Grid */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground">جاري التحميل...</div>
      ) : list.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">لا توجد لوحات مشتركة</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {list.map((bb, i) => {
            const rowKey = String(bb.ID || bb.id || `bb-${i}`);
            const capital = Number(bb.capital || 0);
            
            // استخدام القيم الديناميكية من العقود إن وجدت
            const dynamicData = dynamicRecovery[rowKey];
            const remaining = dynamicData ? dynamicData.newRemaining : Number(bb.capital_remaining ?? capital);
            const recovered = capital - remaining;
            
            // تحديث حالة الاسترداد ديناميكياً
            const dynamicStatus = (() => {
              if (remaining <= 0) {
                return {
                  badge: <Badge className="bg-green-600 hover:bg-green-700">مكتمل</Badge>,
                  percentage: 100,
                  phase: 'توزيع الأرباح'
                };
              }
              const percentage = capital > 0 ? Math.round((recovered / capital) * 100) : 0;
              return {
                badge: <Badge className="bg-blue-600 hover:bg-blue-700">استرداد</Badge>,
                percentage,
                phase: 'استرداد رأس المال'
              };
            })();

            return (
              <Card key={rowKey} className="overflow-hidden hover:shadow-lg transition-all duration-300 border-purple-500/20">
                {/* Image */}
                {bb.Image_URL && (
                  <div className="relative h-40 overflow-hidden">
                    <img 
                      src={bb.Image_URL} 
                      alt={bb.Billboard_Name}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute top-2 right-2">
                      {dynamicStatus.badge}
                    </div>
                    <div className="absolute top-2 left-2">
                      <Badge variant="outline" className="bg-black/50 text-white border-none">
                        {bb.Size || '-'}
                      </Badge>
                    </div>
                  </div>
                )}

                <CardContent className="p-4 space-y-3">
                  {/* Name & Location */}
                  <div>
                    <h3 className="font-bold text-lg">{bb.Billboard_Name || bb.name || '-'}</h3>
                    <p className="text-sm text-muted-foreground">{bb.Nearest_Landmark || bb.City || '-'}</p>
                  </div>

                  {/* Partners */}
                  <div className="flex flex-wrap gap-1">
                    <Users className="h-4 w-4 text-purple-500" />
                    {Array.isArray(bb.partner_companies) && bb.partner_companies.length > 0 ? (
                      bb.partner_companies.map((partner: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="text-xs bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300">
                          {partner}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-muted-foreground text-sm">لم يتم تحديد الشركاء</span>
                    )}
                  </div>

                  {/* Contracts Info */}
                  {contractsById[rowKey] && contractsById[rowKey].length > 0 && (
                    <div className="flex items-center gap-2 text-sm bg-blue-50 dark:bg-blue-950/30 p-2 rounded-lg">
                      <FileText className="h-4 w-4 text-blue-500" />
                      <span className="text-blue-700 dark:text-blue-300">
                        {contractsById[rowKey].length} عقد مرتبط
                        {' - '}
                        إجمالي: {contractsById[rowKey].reduce((sum: number, c: any) => sum + getRentFromContract(c, rowKey), 0).toLocaleString()} د.ل
                      </span>
                    </div>
                  )}

                  {/* Capital Info */}
                  <div className="bg-muted/50 rounded-lg p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">رأس المال:</span>
                      <span className="font-bold">{capital.toLocaleString()} د.ل</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">المسترد:</span>
                      <span className="font-bold text-green-600">{recovered.toLocaleString()} د.ل</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">المتبقي:</span>
                      <span className={`font-bold ${remaining <= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                        {remaining.toLocaleString()} د.ل
                      </span>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 dark:bg-gray-700 rounded-full h-2 overflow-hidden">
                          <div
                            className={`h-full transition-all ${dynamicStatus.percentage === 100 ? 'bg-green-600' : 'bg-purple-600'}`}
                            style={{ width: `${dynamicStatus.percentage}%` }}
                          />
                        </div>
                        <span className="text-xs font-medium w-10">{dynamicStatus.percentage}%</span>
                      </div>
                      <div className="text-xs text-center text-muted-foreground">
                        {dynamicStatus.phase}
                      </div>
                    </div>

                    {/* Dynamic recovery info */}
                    {dynamicData && dynamicData.capitalDeduction > 0 && (
                      <div className="text-xs text-center p-2 bg-green-50 dark:bg-green-950/30 rounded-lg text-green-700 dark:text-green-300">
                        خصم رأس المال: {dynamicData.capitalDeduction.toLocaleString()} د.ل
                      </div>
                    )}

                    {/* Save dynamic recovery to database */}
                    {dynamicData && dynamicData.newRemaining !== Number(bb.capital_remaining ?? bb.capital) && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="w-full mt-2 text-green-600 border-green-600 hover:bg-green-50"
                        onClick={() => calculateRecoveryFromContracts(bb)}
                      >
                        <TrendingUp className="h-4 w-4 ml-1" />
                        حفظ الاسترداد ({dynamicData.newRemaining.toLocaleString()} د.ل)
                      </Button>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <SharedBillboardDialog
                      billboard={bb}
                      onSaved={load}
                      trigger={
                        <Button size="sm" variant="outline" className="flex-1">
                          <Settings2 className="h-4 w-4 ml-1" /> إعدادات
                        </Button>
                      }
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => removeFromPartnership(bb)}
                    >
                      إزالة
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
