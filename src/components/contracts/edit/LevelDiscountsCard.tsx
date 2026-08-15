import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Layers, Percent, TrendingDown } from 'lucide-react';
import type { Billboard } from '@/types';

interface LevelDiscountsCardProps {
  selectedBillboards: Billboard[];
  levelDiscounts: Record<string, number>;
  setLevelDiscounts: (discounts: Record<string, number>) => void;
  currencySymbol?: string;
  calculateBillboardPrice: (billboard: Billboard) => number;
  sizeNames?: Map<number, string>;
}

interface LevelSummary {
  level: string;
  billboards: {
    id: string;
    name: string;
    size: string;
    price: number;
  }[];
  totalPrice: number;
  discountPercent: number;
  discountAmount: number;
  priceAfterDiscount: number;
}

export function LevelDiscountsCard({
  selectedBillboards,
  levelDiscounts,
  setLevelDiscounts,
  currencySymbol = 'د.ل',
  calculateBillboardPrice,
  sizeNames = new Map()
}: LevelDiscountsCardProps) {
  const [expandedLevel, setExpandedLevel] = useState<string | null>(null);

  const getDisplaySize = (billboard: any): string => {
    const sizeId = billboard.size_id || billboard.Size_ID;
    if (sizeId && sizeNames.has(sizeId)) {
      return sizeNames.get(sizeId)!;
    }
    return billboard.size || billboard.Size || 'غير محدد';
  };

  const levelSummaries = useMemo<LevelSummary[]>(() => {
    const levelMap = new Map<string, LevelSummary>();

    selectedBillboards.forEach((b) => {
      const level = (b as any).Level || (b as any).level || 'غير محدد';
      const price = calculateBillboardPrice(b);
      const billboardInfo = {
        id: String((b as any).ID),
        name: (b as any).Billboard_Name || (b as any).name || '',
        size: getDisplaySize(b),
        price
      };

      if (levelMap.has(level)) {
        const existing = levelMap.get(level)!;
        existing.billboards.push(billboardInfo);
        existing.totalPrice += price;
      } else {
        levelMap.set(level, {
          level,
          billboards: [billboardInfo],
          totalPrice: price,
          discountPercent: 0,
          discountAmount: 0,
          priceAfterDiscount: price
        });
      }
    });

    // Apply discounts
    levelMap.forEach((summary, level) => {
      const discountPercent = levelDiscounts[level] || 0;
      const discountAmount = summary.totalPrice * (discountPercent / 100);
      summary.discountPercent = discountPercent;
      summary.discountAmount = discountAmount;
      summary.priceAfterDiscount = summary.totalPrice - discountAmount;
    });

    return Array.from(levelMap.values()).sort((a, b) => a.level.localeCompare(b.level));
  }, [selectedBillboards, calculateBillboardPrice, levelDiscounts, sizeNames]);

  const handleDiscountChange = (level: string, value: number) => {
    const newDiscounts = { ...levelDiscounts };
    if (value > 0) {
      newDiscounts[level] = Math.min(100, Math.max(0, value));
    } else {
      delete newDiscounts[level];
    }
    setLevelDiscounts(newDiscounts);
  };

  const totalDiscountAmount = useMemo(() => {
    return levelSummaries.reduce((sum, s) => sum + s.discountAmount, 0);
  }, [levelSummaries]);

  if (levelSummaries.length === 0) return null;

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="py-3 px-4 bg-gradient-to-br from-purple-500/10 via-purple-500/5 to-transparent border-b border-border">
        <CardTitle className="flex items-center justify-between text-base">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-purple-500/20">
              <Layers className="h-4 w-4 text-purple-600" />
            </div>
            <span>تخفيض حسب المستوى</span>
          </div>
          {totalDiscountAmount > 0 && (
            <Badge className="bg-red-500/10 text-red-600 border-red-500/20">
              إجمالي التخفيض: <span className="font-manrope">{totalDiscountAmount.toLocaleString('ar-LY')}</span> {currencySymbol}
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-4">
        <div className="grid gap-3">
          {levelSummaries.map((summary) => (
            <div
              key={summary.level}
              className="bg-muted/50 border border-border rounded-xl overflow-hidden"
            >
              {/* Level Header */}
              <div
                className="p-4 cursor-pointer hover:bg-muted/80 transition-colors"
                onClick={() => setExpandedLevel(expandedLevel === summary.level ? null : summary.level)}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-lg font-bold font-manrope text-primary">{summary.level}</span>
                    </div>
                    <div>
                      <div className="font-bold text-foreground">مستوى {summary.level}</div>
                      <div className="text-sm text-muted-foreground font-manrope">
                        {summary.billboards.length} لوحة
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-4">
                    {/* Size badges */}
                    <div className="hidden sm:flex flex-wrap gap-1 max-w-[200px]">
                      {Array.from(new Set(summary.billboards.map(b => b.size))).map((size) => (
                        <Badge key={size} variant="outline" className="text-xs">
                          {size}
                        </Badge>
                      ))}
                    </div>
                    
                    {/* Discount Input */}
                    <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                      <div className="relative">
                        <Input
                          type="number"
                          min="0"
                          max="100"
                          value={summary.discountPercent || ''}
                          onChange={(e) => handleDiscountChange(summary.level, Number(e.target.value))}
                          placeholder="0"
                          className="w-20 h-9 text-center pr-7 bg-background"
                        />
                        <Percent className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                    </div>
                    
                    {/* Prices */}
                    <div className="text-left min-w-[120px]">
                      {summary.discountAmount > 0 ? (
                        <>
                          <div className="text-sm line-through text-muted-foreground font-manrope">
                            {summary.totalPrice.toLocaleString('ar-LY')}
                          </div>
                          <div className="font-bold font-manrope text-primary">
                            {summary.priceAfterDiscount.toLocaleString('ar-LY')} {currencySymbol}
                          </div>
                        </>
                      ) : (
                        <div className="font-bold font-manrope text-foreground">
                          {summary.totalPrice.toLocaleString('ar-LY')} {currencySymbol}
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Discount indicator */}
                {summary.discountAmount > 0 && (
                  <div className="mt-3 flex items-center gap-2 text-sm text-red-600 font-manrope">
                    <TrendingDown className="h-4 w-4" />
                    <span>تخفيض {summary.discountPercent}% = {summary.discountAmount.toLocaleString('ar-LY')} {currencySymbol}</span>
                  </div>
                )}
              </div>

              {/* Expanded Billboard Details */}
              {expandedLevel === summary.level && (
                <div className="border-t border-border bg-background p-3">
                  <div className="grid gap-2">
                    {summary.billboards.map((bb) => (
                      <div key={bb.id} className="flex items-center justify-between text-sm bg-muted/30 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-foreground">{bb.name}</span>
                          <Badge variant="outline" className="text-xs">{bb.size}</Badge>
                        </div>
                        <span className="font-bold font-manrope text-primary">{bb.price.toLocaleString('ar-LY')} {currencySymbol}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
