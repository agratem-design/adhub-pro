import React, { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Building2, DollarSign, Wrench, Save, ChevronDown, ChevronUp, Calculator, Edit3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface FriendBillboard {
  id: string;
  size: string;
  friendCompanyId: string;
  friendCompanyName?: string;
}

interface FriendBillboardCost {
  billboardId: string;
  friendCompanyId: string;
  friendCompanyName: string;
  friendRentalCost: number;
}

interface CompanySizeGroup {
  companyId: string;
  companyName: string;
  sizes: {
    size: string;
    billboards: FriendBillboard[];
  }[];
  totalBillboards: number;
}

interface FriendBillboardsBulkRentalProps {
  friendBillboards: FriendBillboard[];
  friendBillboardCosts: FriendBillboardCost[];
  onUpdateFriendCost: (billboardId: string, friendCompanyId: string, friendCompanyName: string, cost: number) => void;
  includesInstallation: boolean;
  onIncludesInstallationChange: (includes: boolean) => void;
  currencySymbol?: string;
  // ✅ NEW: Operating fee props
  operatingFeeEnabled?: boolean;
  operatingFeeRate?: number;
  onOperatingFeeEnabledChange?: (enabled: boolean) => void;
  onOperatingFeeRateChange?: (rate: number) => void;
  operatingFeeAmount?: number;
}

export function FriendBillboardsBulkRental({
  friendBillboards,
  friendBillboardCosts,
  onUpdateFriendCost,
  includesInstallation,
  onIncludesInstallationChange,
  currencySymbol = 'د.ل',
  operatingFeeEnabled = false,
  operatingFeeRate = 3,
  onOperatingFeeEnabledChange,
  onOperatingFeeRateChange,
  operatingFeeAmount = 0
}: FriendBillboardsBulkRentalProps) {
  // Local state for bulk rental inputs per company+size
  const [bulkRentals, setBulkRentals] = useState<Record<string, number>>({});
  const [expandedCompanies, setExpandedCompanies] = useState<Record<string, boolean>>({});
  // State for manual total editing per company
  const [manualTotals, setManualTotals] = useState<Record<string, number>>({});
  const [editingCompanyTotal, setEditingCompanyTotal] = useState<string | null>(null);

  // Group billboards by company, then by size
  const companyGroups = useMemo(() => {
    const companies = new Map<string, { name: string; billboards: FriendBillboard[] }>();
    
    friendBillboards.forEach(bb => {
      const companyId = bb.friendCompanyId || 'unknown';
      const companyName = bb.friendCompanyName || 'شركة صديقة';
      
      if (!companies.has(companyId)) {
        companies.set(companyId, { name: companyName, billboards: [] });
      }
      companies.get(companyId)!.billboards.push(bb);
    });

    // Convert to array with size groups
    const result: CompanySizeGroup[] = [];
    
    companies.forEach((company, companyId) => {
      // Group by size within company
      const sizeMap = new Map<string, FriendBillboard[]>();
      company.billboards.forEach(bb => {
        const size = bb.size || 'غير محدد';
        if (!sizeMap.has(size)) {
          sizeMap.set(size, []);
        }
        sizeMap.get(size)!.push(bb);
      });

      const sizes = Array.from(sizeMap.entries())
        .map(([size, billboards]) => ({ size, billboards }))
        .sort((a, b) => b.billboards.length - a.billboards.length);

      result.push({
        companyId,
        companyName: company.name,
        sizes,
        totalBillboards: company.billboards.length
      });
    });

    return result.sort((a, b) => b.totalBillboards - a.totalBillboards);
  }, [friendBillboards]);

  // Initialize all companies as expanded
  React.useEffect(() => {
    const initial: Record<string, boolean> = {};
    companyGroups.forEach(g => {
      initial[g.companyId] = true;
    });
    setExpandedCompanies(initial);
  }, [companyGroups.length]);

  // Get key for bulk rental (company + size)
  const getKey = (companyId: string, size: string) => `${companyId}__${size}`;

  // Calculate totals per company
  const getCompanyTotal = (company: CompanySizeGroup) => {
    let total = 0;
    company.sizes.forEach(sizeGroup => {
      const key = getKey(company.companyId, sizeGroup.size);
      const rental = bulkRentals[key] || 0;
      total += rental * sizeGroup.billboards.length;
    });
    return total;
  };

  // Calculate grand total
  const grandTotal = useMemo(() => {
    let total = 0;
    companyGroups.forEach(company => {
      total += getCompanyTotal(company);
    });
    return total;
  }, [companyGroups, bulkRentals]);

  // Apply bulk rental to all billboards of a company+size
  const applyBulkRental = (company: CompanySizeGroup, size: string) => {
    const key = getKey(company.companyId, size);
    const rental = bulkRentals[key] || 0;
    const sizeGroup = company.sizes.find(g => g.size === size);
    
    if (sizeGroup && rental > 0) {
      sizeGroup.billboards.forEach(bb => {
        onUpdateFriendCost(bb.id, company.companyId, company.companyName, rental);
      });
    }
  };

  // Apply all rentals for a company
  const applyCompanyRentals = (company: CompanySizeGroup) => {
    company.sizes.forEach(sizeGroup => {
      const key = getKey(company.companyId, sizeGroup.size);
      const rental = bulkRentals[key] || 0;
      if (rental > 0) {
        sizeGroup.billboards.forEach(bb => {
          onUpdateFriendCost(bb.id, company.companyId, company.companyName, rental);
        });
      }
    });
  };

  // Apply all bulk rentals
  const applyAllBulkRentals = () => {
    companyGroups.forEach(company => {
      applyCompanyRentals(company);
    });
  };

  // Apply manual total with proportional distribution
  const applyManualTotal = (company: CompanySizeGroup) => {
    const newTotal = manualTotals[company.companyId];
    if (!newTotal || newTotal <= 0) return;

    const currentTotal = getCompanyTotal(company);
    
    if (currentTotal === 0) {
      // If no current prices, distribute equally
      const perBillboard = newTotal / company.totalBillboards;
      company.sizes.forEach(sizeGroup => {
        const key = getKey(company.companyId, sizeGroup.size);
        setBulkRentals(prev => ({
          ...prev,
          [key]: Math.round(perBillboard)
        }));
        sizeGroup.billboards.forEach(bb => {
          onUpdateFriendCost(bb.id, company.companyId, company.companyName, Math.round(perBillboard));
        });
      });
    } else {
      // Proportional distribution based on current prices
      const ratio = newTotal / currentTotal;
      
      company.sizes.forEach(sizeGroup => {
        const key = getKey(company.companyId, sizeGroup.size);
        const currentRental = bulkRentals[key] || 0;
        const newRental = Math.round(currentRental * ratio);
        
        setBulkRentals(prev => ({
          ...prev,
          [key]: newRental
        }));
        
        sizeGroup.billboards.forEach(bb => {
          onUpdateFriendCost(bb.id, company.companyId, company.companyName, newRental);
        });
      });
    }

    setEditingCompanyTotal(null);
  };

  // Toggle company expansion
  const toggleCompany = (companyId: string) => {
    setExpandedCompanies(prev => ({
      ...prev,
      [companyId]: !prev[companyId]
    }));
  };

  if (friendBillboards.length === 0) {
    return null;
  }

  return (
    <Card className="bg-card border-border shadow-sm">
      <CardHeader className="py-3 px-4 bg-amber-500/10 border-b border-amber-500/20">
        <CardTitle className="flex items-center justify-between text-card-foreground">
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-amber-600" />
            <span className="text-base font-bold">إيجارات اللوحات الصديقة</span>
            <Badge variant="secondary" className="bg-amber-500/20 text-amber-700">
              {friendBillboards.length} لوحة
            </Badge>
            <Badge variant="outline" className="bg-background text-muted-foreground">
              {companyGroups.length} شركة
            </Badge>
          </div>
          <div className="flex items-center gap-4 flex-wrap">
            {/* Toggle for installation included */}
            <div className="flex items-center gap-2 bg-background/80 rounded-lg px-3 py-1.5 border border-border">
              <Wrench className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="includes-installation" className="text-sm cursor-pointer">
                السعر يشمل التركيب
              </Label>
              <Switch
                id="includes-installation"
                checked={includesInstallation}
                onCheckedChange={onIncludesInstallationChange}
              />
            </div>
            
 {/* NEW: Toggle for operating fee */}
            <div className="flex items-center gap-2 bg-background/80 rounded-lg px-3 py-1.5 border border-border">
              <DollarSign className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="operating-fee-enabled" className="text-sm cursor-pointer">
                رسوم التشغيل
              </Label>
              <Switch
                id="operating-fee-enabled"
                checked={operatingFeeEnabled}
                onCheckedChange={(enabled) => onOperatingFeeEnabledChange?.(enabled)}
              />
              {operatingFeeEnabled && (
                <div className="flex items-center gap-1 mr-2">
                  <Input
                    type="number"
                    value={operatingFeeRate}
                    onChange={(e) => onOperatingFeeRateChange?.(Number(e.target.value) || 0)}
                    className="h-7 w-16 text-sm text-center"
                    min={0}
                    max={100}
                    step={0.5}
                  />
                  <span className="text-xs text-muted-foreground">%</span>
                </div>
              )}
            </div>
          </div>
        </CardTitle>
      </CardHeader>

      <CardContent className="p-4 space-y-4">
        {/* Each company as a separate section */}
        <div className="space-y-3">
          {companyGroups.map(company => {
            const companyTotal = getCompanyTotal(company);
            const isEditing = editingCompanyTotal === company.companyId;
            
            return (
              <Collapsible
                key={company.companyId}
                open={expandedCompanies[company.companyId]}
                onOpenChange={() => toggleCompany(company.companyId)}
              >
                <div className="border border-border rounded-lg overflow-hidden">
                  {/* Company header */}
                  <CollapsibleTrigger asChild>
                    <div className="flex items-center justify-between bg-muted/50 px-4 py-2 cursor-pointer hover:bg-muted/70 transition-colors">
                      <div className="flex items-center gap-3">
                        <Building2 className="h-4 w-4 text-amber-600" />
                        <span className="font-bold text-foreground">{company.companyName}</span>
                        <Badge variant="secondary" className="text-xs">
                          {company.totalBillboards} لوحة
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {company.sizes.length} مقاس
                        </Badge>
                      </div>
                      <div className="flex items-center gap-3">
                        {companyTotal > 0 && !isEditing && (
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-bold text-amber-600">
                              {companyTotal.toLocaleString('ar-LY')} {currencySymbol}
                            </span>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-6 w-6 p-0 text-muted-foreground hover:text-amber-600"
                              onClick={(e) => {
                                e.stopPropagation();
                                setManualTotals(prev => ({ ...prev, [company.companyId]: companyTotal }));
                                setEditingCompanyTotal(company.companyId);
                              }}
                            >
                              <Edit3 className="h-3 w-3" />
                            </Button>
                          </div>
                        )}
                        {isEditing && (
                          <div 
                            className="flex items-center gap-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Input
                              type="number"
                              value={manualTotals[company.companyId] || ''}
                              onChange={(e) => setManualTotals(prev => ({
                                ...prev,
                                [company.companyId]: Number(e.target.value) || 0
                              }))}
                              className="h-7 w-28 text-sm"
                              placeholder="الإجمالي الجديد"
                              autoFocus
                            />
                            <Button
                              size="sm"
                              variant="default"
                              className="h-7 px-2 bg-amber-600 hover:bg-amber-700"
                              onClick={(e) => {
                                e.stopPropagation();
                                applyManualTotal(company);
                              }}
                            >
                              <Calculator className="h-3 w-3 ml-1" />
                              توزيع
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-7 px-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingCompanyTotal(null);
                              }}
                            >
                              إلغاء
                            </Button>
                          </div>
                        )}
                        {expandedCompanies[company.companyId] ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </div>
                    </div>
                  </CollapsibleTrigger>

                  <CollapsibleContent>
                    <div className="p-3 space-y-3 bg-background">
                      {/* Size groups for this company */}
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                        {company.sizes.map(sizeGroup => {
                          const key = getKey(company.companyId, sizeGroup.size);
                          return (
                            <div
                              key={sizeGroup.size}
                              className="bg-muted/30 rounded-lg p-3 border border-border space-y-2"
                            >
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="font-semibold text-foreground">{sizeGroup.size}</span>
                                  <Badge variant="outline" className="text-xs">
                                    {sizeGroup.billboards.length} لوحة
                                  </Badge>
                                </div>
                              </div>

                              <div className="flex items-center gap-2">
                                <div className="relative flex-1">
                                  <DollarSign className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                  <Input
                                    type="number"
                                    placeholder="الإيجار للوحة"
                                    value={bulkRentals[key] || ''}
                                    onChange={(e) => setBulkRentals(prev => ({
                                      ...prev,
                                      [key]: Number(e.target.value) || 0
                                    }))}
                                    className="pr-9 h-9 bg-background"
                                  />
                                </div>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => applyBulkRental(company, sizeGroup.size)}
                                  disabled={!bulkRentals[key]}
                                  className="h-9"
                                >
                                  <Save className="h-4 w-4" />
                                </Button>
                              </div>

                              {/* Show total for this size */}
                              {bulkRentals[key] > 0 && (
                                <div className="flex justify-between items-center text-xs bg-amber-500/10 rounded px-2 py-1">
                                  <span className="text-amber-700">إجمالي المقاس:</span>
                                  <span className="font-bold text-amber-700">
                                    {(bulkRentals[key] * sizeGroup.billboards.length).toLocaleString('ar-LY')} {currencySymbol}
                                  </span>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Apply all for this company */}
                      <div className="flex justify-end pt-2 border-t border-border">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => applyCompanyRentals(company)}
                          disabled={company.sizes.every(s => !bulkRentals[getKey(company.companyId, s.size)])}
                          className="text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
                        >
                          <Save className="h-4 w-4 ml-2" />
                          تطبيق إيجارات {company.companyName}
                        </Button>
                      </div>
                    </div>
                  </CollapsibleContent>
                </div>
              </Collapsible>
            );
          })}
        </div>

        {/* Summary and apply all button */}
        <div className="flex flex-col gap-3 pt-3 border-t border-border">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-4 flex-wrap">
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">إجمالي إيجارات الشركات الصديقة:</span>
                <span className="font-bold text-lg text-amber-600">
                  {grandTotal.toLocaleString('ar-LY')} {currencySymbol}
                </span>
              </div>
              
              {!includesInstallation && (
                <Badge variant="outline" className="bg-accent/10 text-accent border-accent/30">
                  <Wrench className="h-3 w-3 ml-1" />
                  بدون تركيب
                </Badge>
              )}
            </div>

            <Button
              onClick={applyAllBulkRentals}
              disabled={Object.values(bulkRentals).every(v => !v || v === 0)}
              className="bg-amber-600 hover:bg-amber-700"
            >
              <Save className="h-4 w-4 ml-2" />
              تطبيق جميع الإيجارات
            </Button>
          </div>
          
 {/* NEW: Operating fee summary */}
          {operatingFeeEnabled && operatingFeeAmount > 0 && (
            <div className="flex items-center justify-between bg-green-500/10 rounded-lg px-4 py-2 border border-green-500/20">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">رسوم التشغيل ({operatingFeeRate}%):</span>
              </div>
              <span className="font-bold text-green-600">
                {operatingFeeAmount.toLocaleString('ar-LY')} {currencySymbol}
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
