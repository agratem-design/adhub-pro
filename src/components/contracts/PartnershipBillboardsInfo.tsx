import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { AlertTriangle, Users, TrendingDown, DollarSign } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface PartnershipInfo {
  billboard_id: number;
  billboard_name: string;
  capital: number;
  capital_remaining: number;
  reserved_amount: number;
  confirmed_amount: number;
  monthly_rent: number;
  duration_months: number;
  total_deduction: number;
  partners: Array<{
    partner_id: string;
    partner_name: string;
    capital_contribution: number;
    capital_remaining: number;
    reserved_amount: number;
    confirmed_amount: number;
    pre_pct: number;
    post_pct: number;
    deduction_amount: number;
  }>;
}

interface Props {
  billboardIds: number[];
  startDate: string;
  endDate: string;
}

export function PartnershipBillboardsInfo({ billboardIds, startDate, endDate }: Props) {
  const [partnershipBillboards, setPartnershipBillboards] = useState<PartnershipInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const serializedBillboardIds = JSON.stringify(billboardIds);

  useEffect(() => {
    loadPartnershipInfo();
  }, [serializedBillboardIds, startDate, endDate]);

  const loadPartnershipInfo = async () => {
    if (!billboardIds || billboardIds.length === 0) {
      setPartnershipBillboards([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Calculate duration in months
      const start = new Date(startDate);
      const end = new Date(endDate);
      const durationMs = end.getTime() - start.getTime();
      const durationMonths = Math.max(1, durationMs / (30.44 * 24 * 60 * 60 * 1000));

      const results: PartnershipInfo[] = [];

      for (const billboardId of billboardIds) {
        // Check if billboard is partnership
        const { data: billboard } = await supabase
          .from('billboards')
          .select('ID, Billboard_Name, Price, is_partnership, capital, capital_remaining')
          .eq('ID', billboardId)
          .single();

        if (!billboard || !billboard.is_partnership) continue;

        // Get partnership details
        const { data: partnerships } = await supabase
          .from('shared_billboards')
          .select(`
            id,
            partner_company_id,
            capital_contribution,
            capital_remaining,
            reserved_amount,
            confirmed_amount,
            partner_pre_pct,
            partner_post_pct
          `)
          .eq('billboard_id', billboardId)
          .eq('status', 'active');

        if (!partnerships || partnerships.length === 0) continue;

        // Get partner names
        const partnerIds = partnerships.map(p => p.partner_company_id).filter(Boolean);
        const { data: partners } = await supabase
          .from('partners')
          .select('id, name')
          .in('id', partnerIds);

        // Get customer names (for suppliers)
        const { data: customers } = await supabase
          .from('customers')
          .select('id, name')
          .in('id', partnerIds);

        const allNames = [...(partners || []), ...(customers || [])];

        const monthlyRent = billboard.Price || 0;
        const totalDeduction = monthlyRent * durationMonths;

        const partnersInfo = partnerships.map(p => {
          const partnerName = allNames.find(n => n.id === p.partner_company_id)?.name || 'غير معروف';
          const deductionAmount = totalDeduction * (p.partner_pre_pct / 100);

          return {
            partner_id: p.partner_company_id,
            partner_name: partnerName,
            capital_contribution: p.capital_contribution || 0,
            capital_remaining: p.capital_remaining || 0,
            reserved_amount: p.reserved_amount || 0,
            confirmed_amount: p.confirmed_amount || 0,
            pre_pct: p.partner_pre_pct || 0,
            post_pct: p.partner_post_pct || 0,
            deduction_amount: deductionAmount
          };
        });

        results.push({
          billboard_id: billboard.ID,
          billboard_name: billboard.Billboard_Name || `لوحة ${billboard.ID}`,
          capital: billboard.capital || 0,
          capital_remaining: billboard.capital_remaining || 0,
          reserved_amount: partnerships.reduce((sum, p) => sum + (p.reserved_amount || 0), 0),
          confirmed_amount: partnerships.reduce((sum, p) => sum + (p.confirmed_amount || 0), 0),
          monthly_rent: monthlyRent,
          duration_months: durationMonths,
          total_deduction: totalDeduction,
          partners: partnersInfo
        });
      }

      setPartnershipBillboards(results);
    } catch (error) {
      console.error('Error loading partnership info:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            لوحات المشاركة
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">جاري التحميل...</p>
        </CardContent>
      </Card>
    );
  }

  if (partnershipBillboards.length === 0) {
    return null;
  }

  const totalCapitalDeduction = partnershipBillboards.reduce((sum, b) => sum + b.total_deduction, 0);
  const hasInsufficientCapital = partnershipBillboards.some(b => 
    b.capital_remaining < b.total_deduction
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Users className="h-5 w-5" />
          لوحات المشاركة ({partnershipBillboards.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {hasInsufficientCapital && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              تحذير: بعض اللوحات لا تحتوي على رأس مال كافٍ لتغطية المدة المطلوبة
            </AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {partnershipBillboards.map((billboard) => (
            <div key={billboard.billboard_id} className="border rounded-lg p-4 space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <h4 className="font-medium">{billboard.billboard_name}</h4>
                  <p className="text-sm text-muted-foreground">
                    {billboard.partners.length} {billboard.partners.length === 1 ? 'شريك' : 'شركاء'}
                  </p>
                </div>
                <Badge variant={billboard.capital_remaining >= billboard.total_deduction ? 'default' : 'destructive'}>
                  {billboard.capital_remaining >= billboard.total_deduction ? 'رأس مال كافٍ' : 'رأس مال غير كافٍ'}
                </Badge>
              </div>

              <Separator />

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <p className="text-muted-foreground">الإيجار الشهري</p>
                  <p className="font-medium">{billboard.monthly_rent.toLocaleString()} ريال</p>
                </div>
                <div>
                  <p className="text-muted-foreground">المدة (أشهر)</p>
                  <p className="font-medium">{billboard.duration_months.toFixed(1)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground">إجمالي الخصم</p>
                  <p className="font-medium text-orange-600">{billboard.total_deduction.toLocaleString()} ريال</p>
                </div>
                <div>
                  <p className="text-muted-foreground">المتبقي من رأس المال</p>
                  <p className={`font-medium ${billboard.capital_remaining >= billboard.total_deduction ? 'text-green-600' : 'text-red-600'}`}>
                    {billboard.capital_remaining.toLocaleString()} ريال
                  </p>
                </div>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-sm font-medium">تفاصيل الشركاء:</p>
                {billboard.partners.map((partner, idx) => (
                  <div key={idx} className="bg-muted/50 rounded p-2 text-sm space-y-1">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">{partner.partner_name}</span>
                      <Badge variant="outline" className="text-xs">
                        {partner.pre_pct}% (قبل السداد)
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                      <div>رأس المال: {partner.capital_contribution.toLocaleString()}</div>
                      <div>المتبقي: {partner.capital_remaining.toLocaleString()}</div>
                      <div className="col-span-2 text-orange-600 font-medium">
                        سيتم خصم: {partner.deduction_amount.toLocaleString()} ريال
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        <Separator />

        <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
          <div className="flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-orange-600" />
            <span className="font-medium">إجمالي الخصم من رأس المال</span>
          </div>
          <span className="text-lg font-bold text-orange-600">
            {totalCapitalDeduction.toLocaleString()} ريال
          </span>
        </div>

        <Alert>
          <DollarSign className="h-4 w-4" />
          <AlertDescription className="text-xs">
            سيتم حجز المبلغ مؤقتاً عند إضافة اللوحات في العقد، وتأكيد الخصم عند إكمال مهمة التركيب
          </AlertDescription>
        </Alert>
      </CardContent>
    </Card>
  );
}
