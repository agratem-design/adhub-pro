import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';
import { DollarSign, TrendingUp, Building2, Users, Wallet, Receipt, Calendar, ArrowDownRight, ArrowUpRight, RefreshCw, Eye, Printer, FileText } from 'lucide-react';

interface Partner {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  partnership_percentage: number;
  default_partner_pre_pct: number;
  default_partner_post_pct: number;
  default_capital_contribution: number;
}

interface PartnerSummary {
  name: string;
  phone: string | null;
  total_due: number;
  total_paid: number;
  remaining: number;
  billboards_count: number;
}

interface SharedBillboard {
  id: string;
  billboard_id: number;
  partner_company_id: string;
  partnership_percentage: number;
  capital_contribution: number;
  capital_remaining: number;
  reserved_amount: number;
  confirmed_amount: number;
  status: string;
  start_date: string;
  end_date: string;
  partner_pre_pct: number;
  partner_post_pct: number;
}

interface Transaction {
  id: string;
  billboard_id: number;
  beneficiary: string;
  amount: number;
  type: string;
  notes: string;
  created_at: string;
}

export default function PartnershipDashboard() {
  const navigate = useNavigate();
  const [withdrawAmount, setWithdrawAmount] = useState<Record<string, number>>({});
  const [withdrawNotes, setWithdrawNotes] = useState<Record<string, string>>({});
  const [selectedPartner, setSelectedPartner] = useState<string | null>(null);
  const [partnerDetailOpen, setPartnerDetailOpen] = useState(false);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);

  // Fetch partners
  const { data: partners, isLoading: partnersLoading, refetch: refetchPartners } = useQuery({
    queryKey: ['partners'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('partners')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Partner[];
    }
  });

  // Fetch partner summaries using RPC
  const { data: summaries, isLoading: summariesLoading, refetch: refetchSummaries } = useQuery({
    queryKey: ['partner-summaries', partners],
    queryFn: async () => {
      if (!partners) return [];
      
      const results: PartnerSummary[] = [];
      // Add الفارس as first entry
      const names = ['الفارس', ...partners.map(p => p.name)];
      
      for (const name of names) {
        const { data, error } = await supabase.rpc('shared_company_summary', { p_beneficiary: name });
        if (error) {
          console.error('Error fetching summary for', name, error);
          continue;
        }
        const r = (data && data[0]) || { total_due: 0, total_paid: 0 };
        
        // Get billboards count for this partner
        const { count } = await supabase
          .from('shared_billboards')
          .select('*', { count: 'exact', head: true })
          .eq('partner_company_id', partners?.find(p => p.name === name)?.id || '');
        
        results.push({
          name,
          phone: partners?.find(p => p.name === name)?.phone || null,
          total_due: Number(r.total_due || 0),
          total_paid: Number(r.total_paid || 0),
          remaining: Number(r.total_due || 0) - Number(r.total_paid || 0),
          billboards_count: count || 0
        });
      }
      return results;
    },
    enabled: !!partners
  });

  // Fetch shared billboards
  const { data: sharedBillboards, isLoading: billboardsLoading, refetch: refetchBillboards } = useQuery({
    queryKey: ['shared-billboards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shared_billboards')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as SharedBillboard[];
    }
  });

  // Fetch transactions
  const { data: transactions, isLoading: transactionsLoading, refetch: refetchTransactions } = useQuery({
    queryKey: ['shared-transactions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shared_transactions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Transaction[];
    }
  });

  // Fetch partner contracts (billboards grouped by contract)
  const { data: partnerContracts, refetch: refetchPartnerContracts } = useQuery({
    queryKey: ['partner-contracts', selectedPartner],
    queryFn: async () => {
      if (!selectedPartner) return [];
      
      // Get partner's shared billboards with contract info
      const { data: billboardsData, error } = await supabase
        .from('shared_billboards')
        .select('*')
        .eq('status', 'active');
      
      if (error) throw error;

      // Get contracts for these billboards
      const { data: contractsData } = await supabase
        .from('Contract')
        .select('*');

      // Get billboard info
      const { data: billboardInfo } = await supabase
        .from('billboards')
        .select('ID, Billboard_Name, City, Size, Contract_Number, Price');

      // Group by contract
      const contractMap = new Map<number, any>();
      
      for (const sb of billboardsData || []) {
        const billboard = billboardInfo?.find(b => b.ID === sb.billboard_id);
        const contractNumber = billboard?.Contract_Number;
        
        if (!contractNumber) continue;
        
        const contract = contractsData?.find(c => c.Contract_Number === contractNumber);
        if (!contract) continue;

        // Calculate partner share based on percentage
        const partnerShare = (billboard?.Price || 0) * (sb.partnership_percentage / 100);

        if (!contractMap.has(contractNumber)) {
          contractMap.set(contractNumber, {
            contractNumber,
            customerName: contract['Customer Name'],
            contractDate: contract['Contract Date'],
            endDate: contract['End Date'],
            billboards: [],
            totalPartnerShare: 0
          });
        }

        const entry = contractMap.get(contractNumber);
        entry.billboards.push({
          id: sb.billboard_id,
          name: billboard?.Billboard_Name,
          city: billboard?.City,
          size: billboard?.Size,
          price: billboard?.Price || 0,
          percentage: sb.partnership_percentage,
          partnerShare
        });
        entry.totalPartnerShare += partnerShare;
      }

      return Array.from(contractMap.values());
    },
    enabled: !!selectedPartner && partnerDetailOpen
  });

  // Calculate totals
  const totalDue = summaries?.reduce((sum, s) => sum + s.total_due, 0) || 0;
  const totalPaid = summaries?.reduce((sum, s) => sum + s.total_paid, 0) || 0;
  const totalRemaining = totalDue - totalPaid;
  const totalBillboards = sharedBillboards?.length || 0;

  const withdraw = async (name: string) => {
    const amount = Number(withdrawAmount[name] || 0);
    if (!amount || amount <= 0) {
      toast.error('أدخل مبلغاً صحيحاً');
      return;
    }
    try {
      const { error } = await supabase.from('shared_transactions').insert({
        beneficiary: name,
        amount,
        type: 'withdrawal',
        notes: withdrawNotes[name] || ''
      });
      if (error) throw error;
      toast.success('تم تسجيل السحب بنجاح');
      setWithdrawAmount(p => ({ ...p, [name]: 0 }));
      setWithdrawNotes(p => ({ ...p, [name]: '' }));
      refetchSummaries();
      refetchTransactions();
    } catch (e: any) {
      toast.error(e?.message || 'خطأ أثناء السحب');
    }
  };

  const refreshAll = () => {
    refetchPartners();
    refetchSummaries();
    refetchBillboards();
    refetchTransactions();
    toast.success('تم تحديث البيانات');
  };

  const isLoading = partnersLoading || summariesLoading || billboardsLoading || transactionsLoading;

  return (
    <>
      <div className="container mx-auto p-3 sm:p-6 space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">لوحة الشراكات</h1>
            <p className="text-muted-foreground mt-1 text-sm">
              إدارة اللوحات المشتركة وحسابات الشركاء
            </p>
          </div>
          <Button variant="outline" onClick={refreshAll} disabled={isLoading} size="sm">
            <RefreshCw className={`h-4 w-4 ml-2 ${isLoading ? 'animate-spin' : ''}`} />
            تحديث
          </Button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-500" />
                إجمالي المستحق
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {totalDue.toLocaleString('ar-LY')} د.ل
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Wallet className="h-4 w-4 text-red-500" />
                إجمالي المسحوب
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {totalPaid.toLocaleString('ar-LY')} د.ل
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-blue-500" />
                المتبقي
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {totalRemaining.toLocaleString('ar-LY')} د.ل
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4 text-purple-500" />
                اللوحات المشتركة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-purple-600">
                {totalBillboards}
              </div>
            </CardContent>
          </Card>
        </div>

        <Tabs defaultValue="partners" className="space-y-4">
          <div className="overflow-x-auto">
            <TabsList>
              <TabsTrigger value="partners">حسابات الشركاء</TabsTrigger>
              <TabsTrigger value="billboards">اللوحات المشتركة</TabsTrigger>
              <TabsTrigger value="transactions">سجل المعاملات</TabsTrigger>
            </TabsList>
          </div>

          {/* Partners Tab */}
          <TabsContent value="partners">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  حصة كل شريك من إجمالي الإيرادات
                </CardTitle>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
                ) : summaries && summaries.length > 0 ? (
              <div className="overflow-x-auto">
              <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الشريك</TableHead>
                        <TableHead className="hidden sm:table-cell">الهاتف</TableHead>
                        <TableHead className="text-center">عدد اللوحات</TableHead>
                        <TableHead className="text-right">المستحق</TableHead>
                        <TableHead className="text-right">المسحوب</TableHead>
                        <TableHead className="text-right">المتبقي</TableHead>
                        <TableHead className="hidden md:table-cell">سحب جديد</TableHead>
                        <TableHead>إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {summaries.map(s => (
                        <TableRow key={s.name} className={s.name === 'الفارس' ? 'bg-primary/5' : ''}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {s.name}
                              {s.name === 'الفارس' && (
                                <Badge variant="secondary">الشركة</Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-muted-foreground hidden sm:table-cell">{s.phone || '-'}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="outline">{s.billboards_count}</Badge>
                          </TableCell>
                          <TableCell className="text-right font-medium text-green-600">
                            {s.total_due.toLocaleString('ar-LY')} د.ل
                          </TableCell>
                          <TableCell className="text-right font-medium text-red-600">
                            {s.total_paid.toLocaleString('ar-LY')} د.ل
                          </TableCell>
                          <TableCell className="text-right font-bold text-blue-600">
                            {s.remaining.toLocaleString('ar-LY')} د.ل
                          </TableCell>
                          <TableCell className="hidden md:table-cell">
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                className="w-24"
                                placeholder="المبلغ"
                                value={withdrawAmount[s.name] || ''}
                                onChange={(e) => setWithdrawAmount(p => ({ ...p, [s.name]: Number(e.target.value || 0) }))}
                              />
                              <Input
                                type="text"
                                className="w-28"
                                placeholder="ملاحظة"
                                value={withdrawNotes[s.name] || ''}
                                onChange={(e) => setWithdrawNotes(p => ({ ...p, [s.name]: e.target.value }))}
                              />
                              <Button size="sm" onClick={() => withdraw(s.name)} disabled={!withdrawAmount[s.name]}>
                                سحب
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Button 
                              size="sm" 
                              variant="outline"
                              onClick={() => {
                                setSelectedPartner(s.name);
                                setPartnerDetailOpen(true);
                              }}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    لا توجد بيانات
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Billboards Tab */}
          <TabsContent value="billboards">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Building2 className="h-5 w-5" />
                  تفاصيل اللوحات المشتركة
                </CardTitle>
              </CardHeader>
              <CardContent>
                {billboardsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
                ) : sharedBillboards && sharedBillboards.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>رقم اللوحة</TableHead>
                        <TableHead className="text-center">نسبة الشراكة</TableHead>
                        <TableHead className="text-right">المساهمة</TableHead>
                        <TableHead className="text-right">المتبقي من رأس المال</TableHead>
                        <TableHead className="text-right">المحجوز</TableHead>
                        <TableHead className="text-right">المؤكد</TableHead>
                        <TableHead className="text-center">الحالة</TableHead>
                        <TableHead>تاريخ البداية</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sharedBillboards.map(b => (
                        <TableRow key={b.id}>
                          <TableCell className="font-mono font-medium">{b.billboard_id}</TableCell>
                          <TableCell className="text-center">
                            <Badge variant="secondary">{b.partnership_percentage}%</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(b.capital_contribution || 0).toLocaleString('ar-LY')} د.ل
                          </TableCell>
                          <TableCell className="text-right">
                            {Number(b.capital_remaining || 0).toLocaleString('ar-LY')} د.ل
                          </TableCell>
                          <TableCell className="text-right text-orange-600">
                            {Number(b.reserved_amount || 0).toLocaleString('ar-LY')} د.ل
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {Number(b.confirmed_amount || 0).toLocaleString('ar-LY')} د.ل
                          </TableCell>
                          <TableCell className="text-center">
                            <Badge variant={b.status === 'active' ? 'default' : 'secondary'}>
                              {b.status === 'active' ? 'نشط' : b.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            {b.start_date ? new Date(b.start_date).toLocaleDateString('ar-LY') : '-'}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    لا توجد لوحات مشتركة
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Transactions Tab */}
          <TabsContent value="transactions">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5" />
                  سجل المعاملات
                </CardTitle>
              </CardHeader>
              <CardContent>
                {transactionsLoading ? (
                  <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
                ) : transactions && transactions.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                          <TableHead>التاريخ</TableHead>
                          <TableHead>المستفيد</TableHead>
                          <TableHead>رقم اللوحة</TableHead>
                          <TableHead className="text-center">النوع</TableHead>
                          <TableHead className="text-right">المبلغ</TableHead>
                          <TableHead>ملاحظات</TableHead>
                          <TableHead>طباعة</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {transactions.map(t => (
                          <TableRow key={t.id}>
                            <TableCell>
                              {new Date(t.created_at).toLocaleDateString('ar-LY')}
                            </TableCell>
                            <TableCell className="font-medium">{t.beneficiary}</TableCell>
                            <TableCell className="font-mono">{t.billboard_id || '-'}</TableCell>
                            <TableCell className="text-center">
                              {t.type === 'withdrawal' ? (
                                <Badge variant="destructive" className="gap-1">
                                  <ArrowUpRight className="h-3 w-3" />
                                  سحب
                                </Badge>
                              ) : t.type === 'income' ? (
                                <Badge variant="default" className="gap-1 bg-green-500">
                                  <ArrowDownRight className="h-3 w-3" />
                                  إيراد
                                </Badge>
                              ) : (
                                <Badge variant="secondary">{t.type}</Badge>
                              )}
                            </TableCell>
                            <TableCell className={`text-right font-medium ${t.type === 'withdrawal' ? 'text-red-600' : 'text-green-600'}`}>
                              {t.type === 'withdrawal' ? '-' : '+'}{Number(t.amount).toLocaleString('ar-LY')} د.ل
                            </TableCell>
                            <TableCell className="text-muted-foreground max-w-[200px] truncate">{t.notes || '-'}</TableCell>
                            <TableCell>
                              {t.type === 'withdrawal' && (
                                <Button 
                                  size="sm" 
                                  variant="outline"
                                  onClick={() => {
                                    setSelectedTransaction(t);
                                    setReceiptOpen(true);
                                  }}
                                >
                                  <Printer className="h-4 w-4" />
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  ) : (
                    <div className="text-center py-8 text-muted-foreground">
                      لا توجد معاملات
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
        </Tabs>
      </div>

      {/* Partner Detail Dialog */}
      <Dialog open={partnerDetailOpen} onOpenChange={setPartnerDetailOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              تفاصيل الشريك: {selectedPartner}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Partner Summary */}
            {summaries?.find(s => s.name === selectedPartner) && (
              <div className="grid grid-cols-3 gap-4 p-4 bg-accent/10 rounded-lg">
                <div>
                  <div className="text-sm text-muted-foreground">المستحق</div>
                  <div className="text-xl font-bold text-green-600">
                    {summaries.find(s => s.name === selectedPartner)?.total_due.toLocaleString('ar-LY')} د.ل
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">المسحوب</div>
                  <div className="text-xl font-bold text-red-600">
                    {summaries.find(s => s.name === selectedPartner)?.total_paid.toLocaleString('ar-LY')} د.ل
                  </div>
                </div>
                <div>
                  <div className="text-sm text-muted-foreground">المتبقي</div>
                  <div className="text-xl font-bold text-blue-600">
                    {summaries.find(s => s.name === selectedPartner)?.remaining.toLocaleString('ar-LY')} د.ل
                  </div>
                </div>
              </div>
            )}

            {/* Contracts grouped */}
            <div className="space-y-4">
              <h3 className="font-semibold flex items-center gap-2">
                <FileText className="h-4 w-4" />
                العقود واللوحات المشتركة
              </h3>
              
              {partnerContracts && partnerContracts.length > 0 ? (
                partnerContracts.map((contract: any) => (
                  <Card key={contract.contractNumber} className="overflow-hidden">
                    <CardHeader className="pb-2 bg-accent/5">
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle className="text-base">عقد رقم {contract.contractNumber}</CardTitle>
                          <p className="text-sm text-muted-foreground">{contract.customerName}</p>
                        </div>
                        <div className="text-left">
                          <Badge variant="outline">
                            {new Date(contract.contractDate).toLocaleDateString('ar-LY')}
                          </Badge>
                          <div className="text-lg font-bold text-primary mt-1">
                            {contract.totalPartnerShare.toLocaleString('ar-LY')} د.ل
                          </div>
                        </div>
                      </div>
                    </CardHeader>
                    <CardContent className="pt-3">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>اللوحة</TableHead>
                            <TableHead>المدينة</TableHead>
                            <TableHead>المقاس</TableHead>
                            <TableHead className="text-center">النسبة</TableHead>
                            <TableHead className="text-right">السعر</TableHead>
                            <TableHead className="text-right">الحصة</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {contract.billboards.map((b: any) => (
                            <TableRow key={b.id}>
                              <TableCell className="font-mono">{b.name || b.id}</TableCell>
                              <TableCell>{b.city || '-'}</TableCell>
                              <TableCell>{b.size || '-'}</TableCell>
                              <TableCell className="text-center">
                                <Badge variant="secondary">{b.percentage}%</Badge>
                              </TableCell>
                              <TableCell className="text-right">{b.price.toLocaleString('ar-LY')} د.ل</TableCell>
                              <TableCell className="text-right font-medium text-primary">
                                {b.partnerShare.toLocaleString('ar-LY')} د.ل
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  لا توجد عقود مشتركة
                </div>
              )}
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setPartnerDetailOpen(false)}>
              إغلاق
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Receipt Print Dialog */}
      <Dialog open={receiptOpen} onOpenChange={setReceiptOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>إيصال سحب</DialogTitle>
          </DialogHeader>
          
          {selectedTransaction && (
            <div className="space-y-4 p-4 border rounded-lg bg-white text-black" id="receipt-content">
              <div className="text-center border-b pb-3">
                <h2 className="text-xl font-bold">إيصال سحب مستحقات</h2>
              </div>
              
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">التاريخ:</span>
                  <span className="font-medium">{new Date(selectedTransaction.created_at).toLocaleDateString('ar-LY')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">المستفيد:</span>
                  <span className="font-medium">{selectedTransaction.beneficiary}</span>
                </div>
                <div className="flex justify-between border-t pt-2 mt-2">
                  <span className="text-gray-600 font-semibold">المبلغ:</span>
                  <span className="font-bold text-lg">{Number(selectedTransaction.amount).toLocaleString('ar-LY')} د.ل</span>
                </div>
                {selectedTransaction.notes && (
                  <div className="border-t pt-2">
                    <span className="text-gray-600">ملاحظات:</span>
                    <p className="mt-1">{selectedTransaction.notes}</p>
                  </div>
                )}
              </div>
              
              <div className="border-t pt-3 mt-4 flex justify-between text-xs text-gray-500">
                <span>توقيع المستلم: _____________</span>
                <span>توقيع المسلم: _____________</span>
              </div>
            </div>
          )}
          
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReceiptOpen(false)}>
              إغلاق
            </Button>
            <Button onClick={() => {
              const content = document.getElementById('receipt-content');
              if (content) {
                const printWindow = window.open('', '', 'width=400,height=600');
                if (printWindow) {
                  printWindow.document.write(`
                    <html dir="rtl">
                      <head>
                        <title>إيصال سحب</title>
                        <style>
                          body { font-family: Arial, sans-serif; padding: 20px; }
                          * { direction: rtl; }
                        </style>
                      </head>
                      <body>${content.innerHTML}</body>
                    </html>
                  `);
                  printWindow.document.close();
                  printWindow.print();
                }
              }
            }}>
              <Printer className="h-4 w-4 ml-2" />
              طباعة
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
