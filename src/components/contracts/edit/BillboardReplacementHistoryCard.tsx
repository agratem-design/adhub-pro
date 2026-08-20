// @ts-nocheck
import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ArrowLeftRight, Calendar, ArrowRight, Layers, MapPin, CheckCircle2, History } from 'lucide-react';
import {
  getContractReplacementHistory,
  BillboardReplacementHistoryItem,
} from '@/services/contractReplacementHistoryService';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface Props {
  contractNumber: number | null | undefined;
  refreshKey?: number;
}

export function BillboardReplacementHistoryCard({ contractNumber, refreshKey }: Props) {
  const { data: replacements = [], isLoading } = useQuery({
    queryKey: ['billboard-replacement-history', contractNumber, refreshKey],
    queryFn: () => getContractReplacementHistory(Number(contractNumber)),
    enabled: !!contractNumber,
  });

  if (!contractNumber || (replacements.length === 0 && !isLoading)) {
    return null;
  }

  return (
    <Card className="border-2 border-primary/30 bg-gradient-to-br from-card via-card to-primary/5 shadow-md overflow-hidden" dir="rtl">
      <CardHeader className="py-3 px-4 bg-primary/10 border-b border-primary/20">
        <CardTitle className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="bg-primary/20 rounded-lg p-1.5 text-primary">
              <History className="h-5 w-5" />
            </div>
            <div>
              <span className="text-base font-bold text-foreground">سجل تبديل اللوحات</span>
              <p className="text-[11px] text-muted-foreground font-normal">
                سجل توثيق كافة عمليات استبدال اللوحات في العقد (اللوحة السابقة ➔ اللوحة البديلة)
              </p>
            </div>
          </div>
          <Badge variant="outline" className="bg-background text-primary border-primary/40 font-bold px-2.5 py-0.5">
            {replacements.length} {replacements.length === 1 ? 'عملية تبديل' : 'عمليات تبديل'}
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 space-y-3">
        {isLoading ? (
          <div className="text-xs text-muted-foreground text-center py-4">جاري تحميل سجل التبديل...</div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {replacements.map((item) => {
              let formattedDate = '—';
              try {
                if (item.replacedAt) {
                  formattedDate = format(new Date(item.replacedAt), 'yyyy/MM/dd HH:mm', { locale: ar });
                }
              } catch {}

              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-border/80 bg-background/90 hover:border-primary/40 transition-all p-3.5 shadow-sm space-y-2.5"
                >
                  {/* Top Bar: Timestamp and Status */}
                  <div className="flex items-center justify-between text-[11px] border-b border-border/40 pb-2">
                    <Badge className="bg-primary/15 text-primary border border-primary/30 text-[10px] font-bold px-2 py-0 flex items-center gap-1">
                      <ArrowLeftRight className="h-3 w-3" />
                      تم التبديل
                    </Badge>
                    <span className="text-muted-foreground flex items-center gap-1 font-mono text-[11px]" dir="ltr">
                      <Calendar className="h-3 w-3" />
                      {formattedDate}
                    </span>
                  </div>

                  {/* Swap Flow: Old -> New */}
                  <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-2 pt-1">
                    {/* Old Billboard */}
                    <div className="p-2 rounded-lg bg-muted/40 border border-border/50 space-y-1">
                      <span className="text-[10px] text-muted-foreground block font-medium">اللوحة السابقة</span>
                      <div className="text-xs font-bold text-foreground truncate">
                        {item.oldBillboardName}
                      </div>
                      {item.oldBillboardSize && (
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Layers className="h-2.5 w-2.5 text-primary/70 shrink-0" />
                          <span>{item.oldBillboardSize}</span>
                        </div>
                      )}
                      {item.oldBillboardLocation && (
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1 truncate">
                          <MapPin className="h-2.5 w-2.5 text-amber-500 shrink-0" />
                          <span className="truncate">{item.oldBillboardLocation}</span>
                        </div>
                      )}
                    </div>

                    {/* Arrow Divider */}
                    <div className="flex flex-col items-center justify-center px-1">
                      <div className="h-7 w-7 rounded-full bg-primary/15 text-primary flex items-center justify-center shadow-inner">
                        <ArrowRight className="h-4 w-4 rotate-180" />
                      </div>
                    </div>

                    {/* New Billboard */}
                    <div className="p-2 rounded-lg bg-primary/5 border border-primary/30 space-y-1">
                      <span className="text-[10px] text-primary font-medium block">اللوحة البديلة</span>
                      <div className="text-xs font-bold text-primary truncate">
                        {item.newBillboardName}
                      </div>
                      {item.newBillboardSize && (
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Layers className="h-2.5 w-2.5 text-primary/70 shrink-0" />
                          <span>{item.newBillboardSize}</span>
                        </div>
                      )}
                      {item.newBillboardLocation && (
                        <div className="text-[10px] text-muted-foreground flex items-center gap-1 truncate">
                          <MapPin className="h-2.5 w-2.5 text-amber-500 shrink-0" />
                          <span className="truncate">{item.newBillboardLocation}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
