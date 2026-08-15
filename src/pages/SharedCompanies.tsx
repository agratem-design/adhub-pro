import { useAuth } from '@/contexts/AuthContext';
import { useEffect, useState } from 'react';
import { useSystemDialog } from '@/contexts/SystemDialogContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PartnerDialog } from '@/components/partnership/PartnerDialog';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { toast } from '@/components/ui/sonner';
import { Badge } from '@/components/ui/badge';
import { 
  Building2, 
  Phone, 
  MapPin, 
  FileText, 
  Wallet, 
  TrendingUp,
  Plus,
  Trash2,
  Edit,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface PartnerData {
  id: string;
  name: string;
  phone?: string | null;
  billboards: {
    billboard_id: number;
    billboard_name: string;
    capital_contribution: number;
    capital_remaining: number;
    partner_pre_pct: number;
    partner_post_pct: number;
  }[];
  contracts: {
    contract_number: number;
    customer_name: string;
    total_rent: number;
    partner_share: number;
    shared_billboards_count: number;
  }[];
  totals: {
    total_billboards: number;
    total_capital: number;
    capital_remaining: number;
    total_due: number;
    total_paid: number;
  };
}

export default function SharedCompanies() {
  const { canEdit: canEditAuth } = useAuth();
  const canEditSection = canEditAuth('shared_companies');
  const { confirm: systemConfirm } = useSystemDialog();
  const [partners, setPartners] = useState<PartnerData[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState('');
  const [expandedPartners, setExpandedPartners] = useState<Set<string>>(new Set());

  const load = async () => {
    setLoading(true);
    try {
      // جلب الشركاء
      const { data: partnersData } = await supabase
        .from('partners')
        .select('id, name, phone')
        .order('name');

      if (!partnersData) {
        setPartners([]);
        return;
      }

      // جلب بيانات المشاركات
      const { data: sharedData } = await supabase
        .from('shared_billboards')
        .select(`
          partner_company_id,
          billboard_id,
          capital_contribution,
          capital_remaining,
          partner_pre_pct,
          partner_post_pct,
          pre_capital_pct,
          contract_id
        `);

      // جلب بيانات اللوحات المشتركة فقط
      const { data: billboardsData } = await supabase
        .from('billboards')
        .select('ID, Billboard_Name, is_partnership');
      
      // فلترة المشاركات للوحات التي لا تزال مشتركة
      const activeBillboardIds = (billboardsData || [])
        .filter(b => b.is_partnership === true)
        .map(b => b.ID);
      
      // فلترة البيانات للوحات النشطة فقط
      const activeSharedData = (sharedData || []).filter(s => 
        activeBillboardIds.includes(s.billboard_id)
      );

      // جلب بيانات العقود مع billboard_ids
      const { data: contractsData } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Total Rent", billboard_ids');

      // جلب المعاملات المالية
      const { data: transactionsData } = await supabase
        .from('shared_transactions')
        .select('partner_company_id, amount, type');

      // بناء البيانات لكل شريك
      const enrichedPartners: PartnerData[] = partnersData.map(partner => {
        const partnerShares = activeSharedData.filter(s => s.partner_company_id === partner.id);
        
        // اللوحات المشتركة (فقط النشطة)
        const billboards = partnerShares.map(share => {
          const billboard = (billboardsData || []).find(b => b.ID === share.billboard_id);
          return {
            billboard_id: share.billboard_id,
            billboard_name: billboard?.Billboard_Name || `لوحة ${share.billboard_id}`,
            capital_contribution: Number(share.capital_contribution || 0),
            capital_remaining: Number(share.capital_remaining || 0),
            partner_pre_pct: Number(share.partner_pre_pct || 0),
            partner_post_pct: Number(share.partner_post_pct || 0),
            pre_capital_pct: Number(share.pre_capital_pct || 30),
          };
        }).filter((b, i, arr) => arr.findIndex(x => x.billboard_id === b.billboard_id) === i);

        // البحث عن العقود المرتبطة باللوحات المشتركة
        const partnerBillboardIds = billboards.map(b => b.billboard_id);
        const relatedContracts = (contractsData || []).filter(contract => {
          if (!contract.billboard_ids) return false;
          const contractBillboardIds = contract.billboard_ids.split(',').map((id: string) => parseInt(id.trim()));
          return contractBillboardIds.some((id: number) => partnerBillboardIds.includes(id));
        });

        // حساب حصة الشريك من كل عقد
        const contracts = relatedContracts.map(contract => {
          const contractBillboardIds = contract.billboard_ids.split(',').map((id: string) => parseInt(id.trim()));
          // عدد اللوحات المشتركة في هذا العقد
          const sharedBillboardsInContract = contractBillboardIds.filter((id: number) => partnerBillboardIds.includes(id));
          const totalBillboardsInContract = contractBillboardIds.length;
          
          // حصة اللوحات المشتركة من إجمالي العقد
          const billboardShareRatio = sharedBillboardsInContract.length / totalBillboardsInContract;
          const billboardShareAmount = Number(contract["Total Rent"] || 0) * billboardShareRatio;
          
          // حصة الشريك من اللوحات المشتركة
          const avgPartnerPct = billboards.length > 0 
            ? billboards.reduce((sum, b) => sum + b.partner_post_pct, 0) / billboards.length 
            : 0;
          
          return {
            contract_number: contract.Contract_Number,
            customer_name: contract["Customer Name"] || 'غير معروف',
            total_rent: Number(contract["Total Rent"] || 0),
            partner_share: (billboardShareAmount * avgPartnerPct) / 100,
            shared_billboards_count: sharedBillboardsInContract.length,
          };
        });

        // المعاملات المالية
        const partnerTrans = (transactionsData || []).filter(t => t.partner_company_id === partner.id);
        const totalPaid = partnerTrans
          .filter(t => t.type === 'payment' || t.type === 'withdrawal')
          .reduce((sum, t) => sum + Number(t.amount || 0), 0);

        // حساب الإجماليات
        const totalCapital = billboards.reduce((sum, b) => sum + b.capital_contribution, 0);
        const capitalRemaining = billboards.reduce((sum, b) => sum + b.capital_remaining, 0);
        const totalDueFromContracts = contracts.reduce((sum, c) => sum + c.partner_share, 0);

        return {
          id: partner.id,
          name: partner.name,
          phone: partner.phone,
          billboards,
          contracts,
          totals: {
            total_billboards: billboards.length,
            total_capital: totalCapital,
            capital_remaining: capitalRemaining,
            total_due: totalDueFromContracts,
            total_paid: totalPaid,
          },
        };
      });

      setPartners(enrichedPartners);
    } catch (e: any) {
      console.error(e);
      toast.error('فشل تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const addCompany = async () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const { error } = await supabase.from('partners').insert({ name }).select().single();
      if (error) throw error;
      toast.success('تمت الإضافة');
      setNewName('');
      load();
    } catch (e: any) {
      console.error(e);
      toast.error(e?.message || 'فشل الإضافة');
    }
  };

  const deletePartner = async (partner: PartnerData) => {
    const ok = await systemConfirm({ title: 'تأكيد الحذف', message: 'هل تريد حذف هذه الشركة؟ سيتم إزالة ربطها باللوحات المشتركة.', variant: 'destructive', confirmText: 'حذف' });
    if (!ok) return;
    try {
      await supabase.from('shared_billboards').delete().eq('partner_company_id', partner.id);
      const { error } = await supabase.from('partners').delete().eq('id', partner.id);
      if (error) throw error;
      toast.success('تم حذف الشركة');
      load();
    } catch (e: any) {
      toast.error(e?.message || 'فشل حذف الشركة');
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedPartners(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const recoveredPercentage = (partner: PartnerData) => {
    const total = partner.totals.total_capital;
    const remaining = partner.totals.capital_remaining;
    if (total <= 0) return 0;
    return ((total - remaining) / total) * 100;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Building2 className="h-7 w-7 text-primary" />
            الشركات المشاركة
          </h1>
          <p className="text-muted-foreground mt-1">إدارة الشركاء واللوحات والعقود المشتركة</p>
        </div>
        <div className="flex gap-2">
          <Input 
            placeholder="اسم الشركة الجديدة" 
            value={newName} 
            onChange={(e) => setNewName(e.target.value)}
            className="w-48"
          />
          <Button onClick={addCompany} className="gap-2">
            <Plus className="h-4 w-4" />
            إضافة
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-primary/20">
                <Building2 className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">عدد الشركاء</p>
                <p className="text-2xl font-bold">{partners.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-blue-500/20">
                <MapPin className="h-6 w-6 text-blue-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي اللوحات</p>
                <p className="text-2xl font-bold">
                  {partners.reduce((sum, p) => sum + p.totals.total_billboards, 0)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5 border-green-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-green-500/20">
                <Wallet className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">إجمالي رأس المال</p>
                <p className="text-2xl font-bold">
                  {partners.reduce((sum, p) => sum + p.totals.total_capital, 0).toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground mr-1">د.ل</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card className="bg-gradient-to-br from-orange-500/10 to-orange-500/5 border-orange-500/20">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-xl bg-orange-500/20">
                <TrendingUp className="h-6 w-6 text-orange-500" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">المتبقي للاسترداد</p>
                <p className="text-2xl font-bold">
                  {partners.reduce((sum, p) => sum + p.totals.capital_remaining, 0).toLocaleString()}
                  <span className="text-sm font-normal text-muted-foreground mr-1">د.ل</span>
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Partners Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {partners.map(partner => (
          <Card key={partner.id} className="overflow-hidden hover:shadow-lg transition-shadow">
            <CardHeader className="bg-gradient-to-r from-muted/50 to-muted/30 pb-4">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary/20 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{partner.name}</CardTitle>
                    {partner.phone && (
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <Phone className="h-3 w-3" />
                        {partner.phone}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex gap-1">
                  <PartnerDialog 
                    partner={{ id: partner.id, name: partner.name, phone: partner.phone }} 
                    onSaved={load} 
                    trigger={
                      <Button size="icon" variant="ghost" className="h-8 w-8">
                        <Edit className="h-4 w-4" />
                      </Button>
                    } 
                  />
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deletePartner(partner)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            <CardContent className="pt-4 space-y-4">
              {/* Stats Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/20">
                  <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400 mb-1">
                    <MapPin className="h-4 w-4" />
                    <span className="text-xs font-medium">اللوحات</span>
                  </div>
                  <p className="text-xl font-bold">{partner.totals.total_billboards}</p>
                </div>
                
                <div className="p-3 rounded-lg bg-purple-500/10 border border-purple-500/20">
                  <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400 mb-1">
                    <FileText className="h-4 w-4" />
                    <span className="text-xs font-medium">العقود</span>
                  </div>
                  <p className="text-xl font-bold">{partner.contracts.length}</p>
                </div>
              </div>

              {/* Capital Progress */}
              <div className="p-3 rounded-lg bg-muted/50 border">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">رأس المال</span>
                  <span className="text-sm text-muted-foreground">
                    {partner.totals.total_capital.toLocaleString()} د.ل
                  </span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden mb-2">
                  <div 
                    className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all duration-500"
                    style={{ width: `${recoveredPercentage(partner)}%` }}
                  />
                </div>
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>المسترد: {(partner.totals.total_capital - partner.totals.capital_remaining).toLocaleString()}</span>
                  <span>المتبقي: {partner.totals.capital_remaining.toLocaleString()}</span>
                </div>
              </div>

              {/* Financial Summary */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                  <p className="text-xs text-muted-foreground mb-1">المستحق</p>
                  <p className="text-lg font-bold text-green-600 dark:text-green-400">
                    {partner.totals.total_due.toLocaleString()}
                    <span className="text-xs font-normal mr-1">د.ل</span>
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20">
                  <p className="text-xs text-muted-foreground mb-1">المتبقي</p>
                  <p className="text-lg font-bold text-orange-600 dark:text-orange-400">
                    {(partner.totals.total_due - partner.totals.total_paid).toLocaleString()}
                    <span className="text-xs font-normal mr-1">د.ل</span>
                  </p>
                </div>
              </div>

              {/* Expandable Details */}
              <Collapsible open={expandedPartners.has(partner.id)}>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-between"
                    onClick={() => toggleExpanded(partner.id)}
                  >
                    <span>تفاصيل اللوحات والعقود</span>
                    {expandedPartners.has(partner.id) ? (
                      <ChevronUp className="h-4 w-4" />
                    ) : (
                      <ChevronDown className="h-4 w-4" />
                    )}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-3 mt-3">
                  {/* Billboards */}
                  {partner.billboards.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-blue-500" />
                        اللوحات المشتركة
                      </h4>
                      <div className="space-y-2">
                        {partner.billboards.map(b => (
                          <div 
                            key={b.billboard_id} 
                            className="p-2 rounded-lg bg-muted/50 flex items-center justify-between text-sm"
                          >
                            <span className="font-medium">{b.billboard_name}</span>
                            <div className="flex gap-2">
                              <Badge variant="secondary" className="text-xs">
                                قبل: {b.partner_pre_pct}%
                              </Badge>
                              <Badge variant="outline" className="text-xs">
                                بعد: {b.partner_post_pct}%
                              </Badge>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contracts */}
                  {partner.contracts.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                        <FileText className="h-4 w-4 text-purple-500" />
                        العقود
                      </h4>
                      <div className="space-y-2">
                        {partner.contracts.map(c => (
                          <div 
                            key={c.contract_number} 
                            className="p-2 rounded-lg bg-muted/50 flex items-center justify-between text-sm"
                          >
                            <div>
                              <span className="font-medium">عقد #{c.contract_number}</span>
                              <span className="text-muted-foreground mx-2">-</span>
                              <span className="text-muted-foreground">{c.customer_name}</span>
                            </div>
                            <Badge className="bg-green-500/20 text-green-600 hover:bg-green-500/30">
                              {c.partner_share.toLocaleString()} د.ل
                            </Badge>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {partner.billboards.length === 0 && partner.contracts.length === 0 && (
                    <p className="text-center text-sm text-muted-foreground py-4">
                      لا توجد لوحات أو عقود مرتبطة بهذا الشريك
                    </p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </CardContent>
          </Card>
        ))}
      </div>

      {partners.length === 0 && (
        <Card className="py-12">
          <CardContent className="text-center">
            <Building2 className="h-16 w-16 mx-auto text-muted-foreground/30 mb-4" />
            <h3 className="text-lg font-medium mb-2">لا توجد شركات مشاركة</h3>
            <p className="text-muted-foreground mb-4">ابدأ بإضافة شركة جديدة</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
