import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Slider } from '@/components/ui/slider';
import { 
  Shuffle, Play, CheckCircle, ArrowLeftRight, Trash2, 
  Download, Loader2, MapPin, Users, BarChart3, Star
} from 'lucide-react';
import { useSmartDistribution } from '@/hooks/useSmartDistribution';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

interface SmartDistributionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  billboards: any[];
  isContractExpired: (endDate: string | null) => boolean;
  filters: {
    municipality: string;
    city: string;
    size: string;
    status: string;
    adType: string;
  };
  billboardMunicipalities: string[];
  cities: string[];
  billboardSizes: string[];
  uniqueAdTypes: string[];
}

export const SmartDistributionDialog: React.FC<SmartDistributionDialogProps> = ({
  open,
  onOpenChange,
  billboards,
  isContractExpired,
  filters: externalFilters,
  billboardMunicipalities,
  cities,
  billboardSizes,
  uniqueAdTypes,
}) => {
  const {
    loading,
    distributions,
    fetchDistributions,
    fetchDistributionItems,
    generateAndSave,
    setActive,
    swapBillboards,
    deleteDistribution,
  } = useSmartDistribution();

  const [activeTab, setActiveTab] = useState('generate');
  const [filters, setFilters] = useState(externalFilters);
  const [threshold, setThreshold] = useState(175);
  const [partnerAName, setPartnerAName] = useState('الشريك أ');
  const [partnerBName, setPartnerBName] = useState('الشريك ب');
  const [selectedDistId, setSelectedDistId] = useState<string | null>(null);
  const [distItems, setDistItems] = useState<any[]>([]);
  const [swapMode, setSwapMode] = useState(false);
  const [swapSelection, setSwapSelection] = useState<number[]>([]);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    if (open) {
      setFilters(externalFilters);
      fetchDistributions();
    }
  }, [open, externalFilters, fetchDistributions]);

  // Get available billboards using same logic as print
  const availableBillboards = useMemo(() => {
    let filtered = billboards.filter((b: any) => {
      const statusValue = String(b.Status ?? b.status ?? '').trim();
      const statusLower = statusValue.toLowerCase();
      const maintenanceStatus = String(b.maintenance_status ?? '').trim();
      const maintenanceType = String(b.maintenance_type ?? '').trim();
      const hasContract = !!(b.Contract_Number ?? b.contractNumber);
      const contractExpired = isContractExpired(b.Rent_End_Date ?? b.rent_end_date);

      if (statusValue === 'إزالة' || statusValue === 'ازالة' || 
          statusLower === 'removed' || maintenanceStatus === 'removed' ||
          maintenanceStatus === 'تحتاج ازالة لغرض التطوير' || maintenanceStatus === 'لم يتم التركيب' ||
          maintenanceType.includes('إزالة') || maintenanceType.includes('ازالة') ||
          maintenanceType === 'تحتاج إزالة' || maintenanceType === 'تمت الإزالة' ||
          maintenanceType === 'لم يتم التركيب') {
        return false;
      }
      
      return (statusLower === 'available' || statusValue === 'متاح') || !hasContract || contractExpired;
    });

    // Apply filters
    filtered = filtered.filter((b: any) => {
      const matchesMunicipality = filters.municipality === 'all' || (b.Municipality || '') === filters.municipality;
      const matchesCity = filters.city === 'all' || (b.City || '') === filters.city;
      const matchesSize = filters.size === 'all' || (b.Size || '') === filters.size;
      const matchesAdType = filters.adType === 'all' || (b.Ad_Type || '') === filters.adType;
      return matchesMunicipality && matchesCity && matchesSize && matchesAdType;
    });

    return filtered;
  }, [billboards, filters, isContractExpired]);

  const handleGenerate = async () => {
    if (availableBillboards.length === 0) {
      toast.error('لا توجد لوحات متاحة بالفلاتر المحددة');
      return;
    }
    const result = await generateAndSave(availableBillboards, filters, threshold, [partnerAName, partnerBName]);
    if (result) {
      setActiveTab('distributions');
      loadDistItems(result.id);
    }
  };

  const loadDistItems = async (distId: string) => {
    setLoadingItems(true);
    setSelectedDistId(distId);
    try {
      const items = await fetchDistributionItems(distId);
      setDistItems(items);
    } finally {
      setLoadingItems(false);
    }
  };

  const handleSwap = async () => {
    if (!selectedDistId || swapSelection.length !== 2) return;
    const success = await swapBillboards(selectedDistId, swapSelection[0], swapSelection[1]);
    if (success) {
      setSwapSelection([]);
      setSwapMode(false);
      loadDistItems(selectedDistId);
    }
  };

  const toggleSwapSelect = (billboardId: number) => {
    setSwapSelection(prev => {
      if (prev.includes(billboardId)) return prev.filter(id => id !== billboardId);
      if (prev.length >= 2) return [billboardId];
      return [...prev, billboardId];
    });
  };

  const getBillboardName = (billboardId: number) => {
    const b = billboards.find((bb: any) => bb.ID === billboardId);
    return b?.Billboard_Name || `#${billboardId}`;
  };

  const getBillboardInfo = (billboardId: number) => {
    return billboards.find((bb: any) => bb.ID === billboardId);
  };

  const selectedDist = distributions.find(d => d.id === selectedDistId);

  // Group items by site
  const groupedItems = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const item of distItems) {
      const key = item.site_group || 'ungrouped';
      (groups[key] ||= []).push(item);
    }
    return groups;
  }, [distItems]);

  const partnerAItems = distItems.filter(i => i.partner === 'A');
  const partnerBItems = distItems.filter(i => i.partner === 'B');

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        <DialogHeader className="p-4 pb-3 border-b border-border bg-gradient-to-r from-emerald-500/10 to-teal-500/5">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <div className="p-1.5 rounded-lg bg-emerald-500/20">
              <Shuffle className="h-4 w-4 text-emerald-600" />
            </div>
            التوزيع الذكي للوحات
            <Badge variant="secondary" className="mr-2">{availableBillboards.length} لوحة</Badge>
          </DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-4 mt-2 grid grid-cols-3 w-auto">
            <TabsTrigger value="generate">إنشاء توزيع</TabsTrigger>
            <TabsTrigger value="distributions">التوزيعات ({distributions.length})</TabsTrigger>
            <TabsTrigger value="details" disabled={!selectedDistId}>التفاصيل</TabsTrigger>
          </TabsList>

          {/* Generate Tab */}
          <TabsContent value="generate" className="flex-1 overflow-y-auto p-4 space-y-4 mt-0">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>البلدية</Label>
                <Select value={filters.municipality} onValueChange={v => setFilters(p => ({ ...p, municipality: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {billboardMunicipalities.filter(Boolean).map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>المدينة</Label>
                <Select value={filters.city} onValueChange={v => setFilters(p => ({ ...p, city: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {cities.filter(Boolean).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>المقاس</Label>
                <Select value={filters.size} onValueChange={v => setFilters(p => ({ ...p, size: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {billboardSizes.filter(Boolean).map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>نوع الإعلان</Label>
                <Select value={filters.adType} onValueChange={v => setFilters(p => ({ ...p, adType: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">الكل</SelectItem>
                    {uniqueAdTypes.filter(Boolean).map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>مسافة التقارب الجغرافي: {threshold} متر</Label>
              <Slider
                value={[threshold]}
                onValueChange={([v]) => setThreshold(v)}
                min={50}
                max={500}
                step={25}
                className="w-full"
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>50م</span>
                <span>500م</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>اسم الشريك أ</Label>
                <Input value={partnerAName} onChange={e => setPartnerAName(e.target.value)} />
              </div>
              <div>
                <Label>اسم الشريك ب</Label>
                <Input value={partnerBName} onChange={e => setPartnerBName(e.target.value)} />
              </div>
            </div>

            {/* Preview stats */}
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-4 text-sm">
                  <div className="flex items-center gap-1.5">
                    <MapPin className="h-4 w-4 text-muted-foreground" />
                    <span>{availableBillboards.length} لوحة متاحة</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <BarChart3 className="h-4 w-4 text-muted-foreground" />
                    <span>~{Math.ceil(availableBillboards.length / 2)} لكل شريك</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Button
              onClick={handleGenerate}
              disabled={loading || availableBillboards.length === 0}
              className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-600 hover:to-teal-700"
              size="lg"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Play className="h-4 w-4 ml-2" />}
              إنشاء توزيع جديد
            </Button>
          </TabsContent>

          {/* Distributions List Tab */}
          <TabsContent value="distributions" className="flex-1 overflow-y-auto p-4 space-y-3 mt-0">
            {distributions.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">
                لا توجد توزيعات. أنشئ توزيعاً جديداً من تبويب "إنشاء توزيع"
              </div>
            ) : (
              distributions.map(dist => (
                <Card 
                  key={dist.id}
                  className={cn(
                    "cursor-pointer transition-colors",
                    dist.is_active && "ring-2 ring-emerald-500 bg-emerald-500/5",
                    selectedDistId === dist.id && "bg-accent"
                  )}
                  onClick={() => { loadDistItems(dist.id); setActiveTab('details'); }}
                >
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {dist.is_active && <Star className="h-4 w-4 text-emerald-500 fill-emerald-500" />}
                        <span className="font-medium text-sm">{dist.name}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {dist.total_billboards} لوحة
                        </Badge>
                        {!dist.is_active && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={(e) => { e.stopPropagation(); setActive(dist.id, dist.size_filter); }}
                            className="h-7 text-xs"
                          >
                            <CheckCircle className="h-3 w-3 ml-1" />
                            تفعيل
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={(e) => { e.stopPropagation(); deleteDistribution(dist.id); fetchDistributions(); }}
                          className="h-7 text-xs text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    <div className="flex gap-3 mt-2 text-xs text-muted-foreground">
                      <span>أ: {dist.partner_a_count}</span>
                      <span>ب: {dist.partner_b_count}</span>
                      <span>المسافة: {dist.distance_threshold}م</span>
                      <span>{new Date(dist.created_at).toLocaleDateString('ar-LY')}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>

          {/* Details Tab */}
          <TabsContent value="details" className="flex-1 overflow-hidden flex flex-col mt-0">
            {selectedDist && (
              <>
                <div className="p-4 border-b border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold">{selectedDist.name}</h3>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant={swapMode ? "destructive" : "outline"}
                        onClick={() => { setSwapMode(!swapMode); setSwapSelection([]); }}
                        className="text-xs"
                      >
                        <ArrowLeftRight className="h-3 w-3 ml-1" />
                        {swapMode ? 'إلغاء التبديل' : 'تبديل لوحات'}
                      </Button>
                      {swapMode && swapSelection.length === 2 && (
                        <Button size="sm" onClick={handleSwap} className="text-xs bg-emerald-600">
                          تنفيذ التبديل
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Partner summary */}
                  <div className="grid grid-cols-2 gap-2">
                    <div className="p-2 rounded-lg bg-blue-500/10 border border-blue-500/20 text-center">
                      <div className="text-xs text-muted-foreground">{selectedDist.partner_a_name}</div>
                      <div className="text-lg font-bold text-blue-600">{partnerAItems.length}</div>
                    </div>
                    <div className="p-2 rounded-lg bg-orange-500/10 border border-orange-500/20 text-center">
                      <div className="text-xs text-muted-foreground">{selectedDist.partner_b_name}</div>
                      <div className="text-lg font-bold text-orange-600">{partnerBItems.length}</div>
                    </div>
                  </div>
                </div>

                <ScrollArea className="flex-1 p-4">
                  {loadingItems ? (
                    <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
                  ) : (
                    <div className="space-y-3">
                      {Object.entries(groupedItems).map(([siteGroup, items]) => (
                        <Card key={siteGroup} className="overflow-hidden">
                          <CardHeader className="p-2 pb-1 bg-muted/30">
                            <CardTitle className="text-xs flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {siteGroup.replace(/_/g, ' › ')}
                              <Badge variant="outline" className="mr-auto text-[10px]">{items.length} لوحة</Badge>
                            </CardTitle>
                          </CardHeader>
                          <CardContent className="p-2 space-y-1">
                            {items.map((item: any) => {
                              const info = getBillboardInfo(item.billboard_id);
                              const isSelected = swapSelection.includes(item.billboard_id);
                              return (
                                <div
                                  key={item.id}
                                  onClick={() => swapMode && toggleSwapSelect(item.billboard_id)}
                                  className={cn(
                                    "flex items-center justify-between p-1.5 rounded text-xs",
                                    item.partner === 'A' ? "bg-blue-500/5" : "bg-orange-500/5",
                                    swapMode && "cursor-pointer hover:ring-1 hover:ring-primary",
                                    isSelected && "ring-2 ring-primary bg-primary/10",
                                    item.is_random && "border-l-2 border-yellow-500"
                                  )}
                                >
                                  <div className="flex items-center gap-2">
                                    <Badge 
                                      variant="outline"
                                      className={cn(
                                        "text-[10px] px-1.5",
                                        item.partner === 'A' ? "border-blue-500 text-blue-600" : "border-orange-500 text-orange-600"
                                      )}
                                    >
                                      {item.partner === 'A' ? selectedDist.partner_a_name : selectedDist.partner_b_name}
                                    </Badge>
                                    <span className="font-medium">{getBillboardName(item.billboard_id)}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    {info?.Municipality && <span>{info.Municipality}</span>}
                                    {item.is_random && (
                                      <Badge variant="secondary" className="text-[9px] px-1">عشوائي</Badge>
                                    )}
                                    {item.swap_count > 0 && (
                                      <Badge variant="secondary" className="text-[9px] px-1">مبدّل ×{item.swap_count}</Badge>
                                    )}
                                  </div>
                                </div>
                              );
                            })}
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </ScrollArea>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
};
