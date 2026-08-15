import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { LayoutGrid, MapPin, PackageCheck } from 'lucide-react';
import { isBillboardAvailable } from '@/utils/contractUtils';

interface BillboardSummaryCardsProps {
  billboards: any[];
  isContractExpired: (endDate: string | null) => boolean;
  /** Sizes from DB (with sort_order) — used to order size groupings consistently with settings. */
  sizes?: Array<{ name: string; sort_order?: number | null }>;
}

export const BillboardSummaryCards: React.FC<BillboardSummaryCardsProps> = ({
  billboards,
  isContractExpired,
  sizes = []
}) => {
  // Build size → rank map from DB settings (Billboard Sizes Settings page)
  const sizeRankMap = useMemo(() => {
    const m = new Map<string, number>();
    sizes.forEach((s, i) => m.set(s.name, (s.sort_order ?? i + 1) as number));
    return m;
  }, [sizes]);
  const sizeRank = (s: string) => sizeRankMap.get(s) ?? 999;

  const availableBillboards = useMemo(() => {
    return billboards.filter((billboard: any) => isBillboardAvailable(billboard));
  }, [billboards]);

  const availableBySize = useMemo(() => {
    const sizeMap = new Map<string, number>();
    availableBillboards.forEach((billboard: any) => {
      const size = billboard.Size || billboard.size || 'غير محدد';
      sizeMap.set(size, (sizeMap.get(size) || 0) + 1);
    });
    return Array.from(sizeMap.entries())
      .sort(([a], [b]) => sizeRank(a) - sizeRank(b));
  }, [availableBillboards, sizeRankMap]);

  const availableByMunicipality = useMemo(() => {
    const municipalityMap = new Map<string, Map<string, number>>();
    availableBillboards.forEach((billboard: any) => {
      const municipality = billboard.Municipality || billboard.municipality || 'غير محدد';
      const size = billboard.Size || billboard.size || 'غير محدد';
      if (!municipalityMap.has(municipality)) {
        municipalityMap.set(municipality, new Map());
      }
      const sizeMap = municipalityMap.get(municipality)!;
      sizeMap.set(size, (sizeMap.get(size) || 0) + 1);
    });
    return Array.from(municipalityMap.entries())
      .map(([municipality, sizeMap]) => ({
        municipality,
        total: Array.from(sizeMap.values()).reduce((sum, count) => sum + count, 0),
        sizes: Array.from(sizeMap.entries())
          .sort(([a], [b]) => sizeRank(a) - sizeRank(b))
      }))
      .sort((a, b) => b.total - a.total);
  }, [availableBillboards, sizeRankMap]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-6 mb-4 sm:mb-6">
      {/* Available by Size Card */}
      <Card className="overflow-hidden border border-border/50 bg-card/60 backdrop-blur-md hover:border-primary/30 shadow-md hover:shadow-lg transition-all duration-300 rounded-xl sm:rounded-[1.5rem]">
        <CardHeader className="bg-gradient-to-br from-primary/8 via-primary/3 to-transparent border-b border-border/40 p-3 sm:p-5 pb-3">
          <CardTitle className="flex items-center gap-2 sm:gap-3 text-sm sm:text-xl">
            <div className="p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl bg-primary/10 border border-primary/20">
              <LayoutGrid className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
            </div>
            <span className="font-bold text-foreground">اللوحات المتاحة حسب المقاس</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6">
          <div className="space-y-2 sm:space-y-3">
            {availableBySize.map(([size, count]) => (
              <div 
                key={size}
                className="flex items-center justify-between p-2.5 sm:p-4 rounded-lg sm:rounded-xl bg-gradient-to-r from-muted/50 to-muted/30 hover:from-muted/70 hover:to-muted/50 hover:border-primary/20 hover:scale-[1.01] transition-all duration-200 border border-border/50"
              >
                <div className="flex items-center gap-2.5 sm:gap-3">
                  <div className="flex items-center justify-center w-8 h-8 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl bg-primary/10 border border-primary/15 shrink-0">
                    <PackageCheck className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                  </div>
                  <div>
                    <p className="font-bold text-xs sm:text-base text-foreground font-manrope">{size}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">مقاس اللوحة</p>
                  </div>
                </div>
                <Badge 
                  variant="secondary" 
                  className="text-xs sm:text-sm font-black px-2.5 py-1 sm:px-4 sm:py-2 bg-primary/10 text-primary border-primary/20"
                >
                  {count} لوحة
                </Badge>
              </div>
            ))}
            {availableBySize.length === 0 && (
              <p className="text-center text-muted-foreground py-6 sm:py-8 text-xs sm:text-sm">لا توجد لوحات متاحة</p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Available by Municipality Card */}
      <Card className="overflow-hidden border border-border/50 bg-card/60 backdrop-blur-md hover:border-accent/30 shadow-md hover:shadow-lg transition-all duration-300 rounded-xl sm:rounded-[1.5rem]">
        <CardHeader className="bg-gradient-to-br from-accent/8 via-accent/3 to-transparent border-b border-border/40 p-3 sm:p-5 pb-3">
          <CardTitle className="flex items-center gap-2 sm:gap-3 text-sm sm:text-xl">
            <div className="p-1.5 sm:p-2.5 rounded-lg sm:rounded-xl bg-accent/10 border border-accent/20">
              <MapPin className="h-4 w-4 sm:h-5 sm:w-5 text-accent" />
            </div>
            <span className="font-bold text-foreground">اللوحات المتاحة حسب البلدية</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 sm:p-6 max-h-[400px] sm:max-h-[600px] overflow-y-auto custom-scrollbar">
          <div className="space-y-2.5 sm:space-y-4">
            {availableByMunicipality.map(({ municipality, total, sizes }) => (
              <div 
                key={municipality}
                className="p-2.5 sm:p-4 rounded-lg sm:rounded-xl bg-gradient-to-br from-muted/40 to-muted/20 border border-border/40 hover:border-accent/35 hover:scale-[1.01] transition-all duration-300"
              >
                <div className="flex items-center justify-between mb-2 sm:mb-3 pb-2 sm:pb-3 border-b border-border/50">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <div className="flex items-center justify-center w-7 h-7 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl bg-accent/10 border border-accent/15 shrink-0">
                      <MapPin className="h-3.5 w-3.5 sm:h-4.5 sm:w-4.5 text-accent" />
                    </div>
                    <div>
                      <p className="font-bold text-xs sm:text-base text-foreground">{municipality}</p>
                      <p className="text-[10px] sm:text-xs text-muted-foreground">البلدية</p>
                    </div>
                  </div>
                  <Badge 
                    variant="outline" 
                    className="text-[11px] sm:text-xs font-black px-2 py-1 sm:px-3 sm:py-1.5 bg-accent/15 text-accent border-accent/35"
                  >
                    {total} لوحة
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-1.5 sm:gap-2">
                  {sizes.map(([size, count]) => (
                    <div 
                      key={size}
                      className="flex items-center justify-between px-2 py-1.5 sm:px-3 sm:py-2 rounded-md sm:rounded-lg bg-background/50 border border-border/30 hover:border-primary/20 transition-colors"
                    >
                      <span className="text-[11px] sm:text-xs font-semibold text-foreground font-manrope">{size}</span>
                      <Badge 
                        variant="secondary" 
                        className="text-[10px] sm:text-xs font-black px-1.5 py-0 bg-primary/10 text-primary border border-primary/20"
                      >
                        {count}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            {availableByMunicipality.length === 0 && (
              <p className="text-center text-muted-foreground py-6 sm:py-8 text-xs sm:text-sm">لا توجد لوحات متاحة</p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
