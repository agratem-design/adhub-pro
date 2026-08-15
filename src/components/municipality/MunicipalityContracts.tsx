import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ChevronDown, ChevronUp, FileText, Image as ImageIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { DesignImageWithBlur } from '@/components/DesignImageWithBlur';

interface BillboardContract {
  billboard_id: number;
  billboard_name: string;
  image_url: string | null;
  size: string | null;
  contract_number: number;
  customer_name: string | null;
  contract_date: string | null;
  end_date: string | null;
  total: number | null;
  status: string | null;
}

interface MunicipalityContractsProps {
  municipalityName: string;
}

const MunicipalityContracts = ({ municipalityName }: MunicipalityContractsProps) => {
  const [contracts, setContracts] = useState<BillboardContract[]>([]);
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  useEffect(() => {
    if (expanded && contracts.length === 0) {
      fetchContracts();
    }
  }, [expanded]);

  const fetchContracts = async () => {
    setLoading(true);
    const { data } = await supabase
      .from('billboards')
      .select('ID, Billboard_Name, Image_URL, Size, Contract_Number, Customer_Name, Rent_Start_Date, Rent_End_Date, Status')
      .eq('Municipality', municipalityName)
      .not('Contract_Number', 'is', null)
      .order('Contract_Number', { ascending: false });

    if (data) {
      // Get unique contract numbers to fetch totals
      const contractNums = [...new Set(data.map(b => b.Contract_Number).filter(Boolean))];
      
      let contractTotals: Record<number, { total: number | null; date: string | null; endDate: string | null; customer: string | null }> = {};
      
      if (contractNums.length > 0) {
        const { data: contractsData } = await supabase
          .from('Contract')
          .select('Contract_Number, Total, "Contract Date", "End Date", "Customer Name"')
          .in('Contract_Number', contractNums as number[]);
        
        (contractsData || []).forEach((c: any) => {
          contractTotals[c.Contract_Number] = {
            total: c.Total,
            date: c['Contract Date'],
            endDate: c['End Date'],
            customer: c['Customer Name'],
          };
        });
      }

      const mapped: BillboardContract[] = data.map(b => ({
        billboard_id: b.ID,
        billboard_name: b.Billboard_Name || `لوحة #${b.ID}`,
        image_url: b.Image_URL,
        size: b.Size,
        contract_number: b.Contract_Number!,
        customer_name: contractTotals[b.Contract_Number!]?.customer || b.Customer_Name,
        contract_date: contractTotals[b.Contract_Number!]?.date || b.Rent_Start_Date,
        end_date: contractTotals[b.Contract_Number!]?.endDate || b.Rent_End_Date,
        total: contractTotals[b.Contract_Number!]?.total || null,
        status: b.Status,
      }));

      setContracts(mapped);
    }
    setLoading(false);
  };

  // Group by contract number
  const groupedByContract = contracts.reduce<Record<number, BillboardContract[]>>((acc, item) => {
    if (!acc[item.contract_number]) acc[item.contract_number] = [];
    acc[item.contract_number].push(item);
    return acc;
  }, {});

  const isActive = (endDate: string | null) => {
    if (!endDate) return false;
    return new Date(endDate) >= new Date();
  };

  return (
    <div>
      <Button
        variant="ghost"
        size="sm"
        className="gap-1 text-xs h-6 px-2"
        onClick={() => setExpanded(!expanded)}
      >
        <FileText className="h-3 w-3" />
        العقود
        {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
      </Button>

      {expanded && (
        <div className="mt-2 space-y-3">
          {loading ? (
            <p className="text-xs text-muted-foreground p-2">جاري التحميل...</p>
          ) : Object.keys(groupedByContract).length === 0 ? (
            <p className="text-xs text-muted-foreground p-2">لا توجد عقود حالياً</p>
          ) : (
            Object.entries(groupedByContract).map(([contractNum, billboards]) => {
              const first = billboards[0];
              const active = isActive(first.end_date);
              return (
                <Card key={contractNum} className="border-border/40">
                  <CardHeader className="py-2 px-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-sm">عقد #{contractNum}</CardTitle>
                        <Badge variant={active ? 'default' : 'secondary'} className="text-[10px] h-5">
                          {active ? 'نشط' : 'منتهي'}
                        </Badge>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {first.customer_name || '—'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-muted-foreground mt-1">
                      {first.contract_date && <span>من: {first.contract_date}</span>}
                      {first.end_date && <span>إلى: {first.end_date}</span>}
                      {first.total != null && (
                        <span className="font-semibold text-foreground">
                          {first.total.toLocaleString('ar-LY')} د.ل
                        </span>
                      )}
                    </div>
                  </CardHeader>
                  <CardContent className="px-3 pb-3 pt-0">
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {billboards.map(b => (
                        <div
                          key={b.billboard_id}
                          className="border border-border/30 rounded-lg overflow-hidden bg-card hover:shadow-md transition-shadow"
                        >
                          <div
                            className="h-20 cursor-pointer"
                            onClick={() => b.image_url && setImagePreview(b.image_url)}
                          >
                            {b.image_url ? (
                              <DesignImageWithBlur
                                src={b.image_url}
                                alt={b.billboard_name}
                                className="w-full h-full"
                              />
                            ) : (
                              <div className="w-full h-full bg-muted flex items-center justify-center">
                                <ImageIcon className="h-5 w-5 text-muted-foreground/50" />
                              </div>
                            )}
                          </div>
                          <div className="p-1.5 text-center">
                            <p className="text-[11px] font-medium truncate">{b.billboard_name}</p>
                            {b.size && (
                              <p className="text-[10px] text-muted-foreground">{b.size}</p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </div>
      )}

      {/* Image Preview Dialog */}
      <Dialog open={!!imagePreview} onOpenChange={() => setImagePreview(null)}>
        <DialogContent className="max-w-2xl p-2" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-sm">صورة اللوحة</DialogTitle>
            <DialogDescription className="sr-only">عرض صورة اللوحة في وضع التكبير</DialogDescription>
          </DialogHeader>
          {imagePreview && (
            <DesignImageWithBlur
              src={imagePreview}
              alt="صورة اللوحة"
              className="w-full h-[400px] rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MunicipalityContracts;
