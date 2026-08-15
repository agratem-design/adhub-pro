import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';
import { Plus, MapPin, ChevronDown, FileText, ImageIcon, Building2, Navigation, Ruler, Layers, X, ZoomIn, Search } from 'lucide-react';

interface AddBillboardsToTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskId: string;
  contractId: number;
  contractIds?: number[];
  existingBillboardIds: number[];
  customerName?: string;
  onSuccess: () => void;
}

export function AddBillboardsToTaskDialog({
  open,
  onOpenChange,
  taskId,
  contractId,
  contractIds = [],
  existingBillboardIds,
  customerName,
  onSuccess
}: AddBillboardsToTaskDialogProps) {
  const queryClient = useQueryClient();
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [openContracts, setOpenContracts] = useState<Set<number>>(new Set());
  const [zoomedImage, setZoomedImage] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Step 1: Get customer_id from the main contract
  const { data: mainContract, isLoading: isLoadingMain } = useQuery({
    queryKey: ['main-contract-customer', contractId],
    enabled: open && !!contractId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number, customer_id, "Customer Name"')
        .eq('Contract_Number', contractId)
        .single();
      if (error) throw error;
      return data;
    }
  });

  const resolvedCustomerName = customerName || mainContract?.['Customer Name'];
  const customerId = mainContract?.customer_id;

  // Step 2: Fetch ALL contracts for this customer
  const { data: customerContracts = [], isLoading: isLoadingContracts } = useQuery({
    queryKey: ['customer-all-contracts', customerId, resolvedCustomerName],
    enabled: open && !!(customerId || resolvedCustomerName),
    queryFn: async () => {
      let query = supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type", billboard_ids');
      
      if (customerId) {
        query = query.eq('customer_id', customerId);
      } else if (resolvedCustomerName) {
        query = query.eq('Customer Name', resolvedCustomerName);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data || [];
    }
  });

  const contractNumbers = useMemo(() => {
    return customerContracts.map(c => Number(c.Contract_Number)).filter(Boolean);
  }, [customerContracts]);

  // Fetch paused billboards for these contracts
  const { data: pausedRows = [] } = useQuery({
    queryKey: ['paused-billboards-for-customer-contracts', contractNumbers.join(',')],
    enabled: open && contractNumbers.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('paused_billboards' as any)
        .select('billboard_id, contract_number')
        .in('contract_number', contractNumbers);
      if (error) throw error;
      return data || [];
    }
  });

  const pausedSet = useMemo(() => {
    return new Set<number>(pausedRows.map((r: any) => Number(r.billboard_id)));
  }, [pausedRows]);

  // Extract all billboard IDs from all customer contracts
  const contractBillboardMap = useMemo(() => {
    const map = new Map<number, number[]>();
    customerContracts.forEach((c: any) => {
      const ids: number[] = [];
      if (c.billboard_ids) {
        const parsed = c.billboard_ids.split(',')
          .map((id: string) => parseInt(id.trim()))
          .filter((n: number) => !isNaN(n) && n > 0);
        ids.push(...parsed);
      }
      map.set(c.Contract_Number, ids);
    });

    // Merge paused billboards
    pausedRows.forEach((r: any) => {
      const cNum = Number(r.contract_number);
      const bId = Number(r.billboard_id);
      if (cNum && bId) {
        const existing = map.get(cNum) || [];
        if (!existing.includes(bId)) {
          existing.push(bId);
          map.set(cNum, existing);
        }
      }
    });

    return map;
  }, [customerContracts, pausedRows]);

  const allBillboardIds = useMemo(() => {
    const ids = new Set<number>();
    contractBillboardMap.forEach(bbIds => bbIds.forEach(id => ids.add(id)));
    return Array.from(ids);
  }, [contractBillboardMap]);

  // Step 3: Fetch billboard data with design images
  const { data: billboards = [], isLoading: isLoadingBillboards } = useQuery({
    queryKey: ['billboards-for-add-customer', allBillboardIds.join(',')],
    enabled: open && allBillboardIds.length > 0,
    queryFn: async () => {
      const batchSize = 100;
      const all: any[] = [];
      for (let i = 0; i < allBillboardIds.length; i += batchSize) {
        const batch = allBillboardIds.slice(i, i + batchSize);
        const { data, error } = await supabase
          .from('billboards')
          .select('ID, Billboard_Name, Size, Faces_Count, District, Nearest_Landmark, Image_URL, design_face_a, design_face_b, Municipality')
          .in('ID', batch);
        if (error) throw error;
        if (data) all.push(...data);
      }
      return all;
    }
  });

  // Consider loading if any query is loading OR if we have billboard IDs but no billboard data yet
  const isLoading = isLoadingMain || isLoadingContracts || isLoadingBillboards || 
    (allBillboardIds.length > 0 && billboards.length === 0);

  const billboardById = useMemo(() => {
    const map: Record<number, any> = {};
    billboards.forEach(b => { map[b.ID] = b; });
    return map;
  }, [billboards]);

  // Group available billboards by contract, with search filtering
  const contractGroups = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return customerContracts
      .map((contract: any) => {
        const bbIds = contractBillboardMap.get(contract.Contract_Number) || [];
        const available = bbIds
          .filter(id => !existingBillboardIds.includes(id))
          .map(id => billboardById[id])
          .filter(Boolean)
          .filter((b: any) => {
            if (!q) return true;
            const name = (b.Billboard_Name || '').toLowerCase();
            const landmark = (b.Nearest_Landmark || '').toLowerCase();
            return name.includes(q) || landmark.includes(q);
          });
        return {
          contractNumber: contract.Contract_Number,
          customerName: contract['Customer Name'],
          adType: contract['Ad Type'],
          billboards: available,
          totalInContract: bbIds.length,
        };
      })
      .filter(g => g.billboards.length > 0);
  }, [customerContracts, contractBillboardMap, existingBillboardIds, billboardById, searchQuery]);

  const totalAvailable = contractGroups.reduce((sum, g) => sum + g.billboards.length, 0);

  // Mutations
  const addMutation = useMutation({
    mutationFn: async (billboardIds: number[]) => {
      const facesMap: Record<number, number> = {};
      billboards.forEach(b => { facesMap[b.ID] = b.Faces_Count || 1; });

      const itemsToInsert = billboardIds.map(billboardId => ({
        task_id: taskId,
        billboard_id: billboardId,
        status: 'pending',
        customer_installation_cost: 0,
        faces_to_install: facesMap[billboardId] || 2
      }));

      const { error } = await supabase
        .from('installation_task_items')
        .insert(itemsToInsert);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(`تمت إضافة ${selectedIds.length} لوحة للمهمة`);
      queryClient.invalidateQueries({ queryKey: ['installation-task-items'] });
      setSelectedIds([]);
      onSuccess();
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error adding billboards:', error);
      toast.error('فشل في إضافة اللوحات');
    }
  });

  const handleToggle = (id: number) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    const allAvailableIds = contractGroups.flatMap(g => g.billboards.map((b: any) => b.ID));
    if (selectedIds.length === allAvailableIds.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(allAvailableIds);
    }
  };

  const handleSelectContract = (contractNumber: number) => {
    const group = contractGroups.find(g => g.contractNumber === contractNumber);
    if (!group) return;
    const groupIds = group.billboards.map((b: any) => b.ID);
    const allSelected = groupIds.every((id: number) => selectedIds.includes(id));
    if (allSelected) {
      setSelectedIds(prev => prev.filter(id => !groupIds.includes(id)));
    } else {
      setSelectedIds(prev => [...new Set([...prev, ...groupIds])]);
    }
  };

  const toggleContract = (cn: number) => {
    setOpenContracts(prev => {
      const next = new Set(prev);
      if (next.has(cn)) next.delete(cn); else next.add(cn);
      return next;
    });
  };

  const handleAdd = () => {
    if (selectedIds.length === 0) {
      toast.error('يرجى اختيار لوحة واحدة على الأقل');
      return;
    }
    addMutation.mutate(selectedIds);
  };

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Plus className="h-5 w-5 text-primary" />
            إضافة لوحات للمهمة
          </DialogTitle>
          <DialogDescription>
            {resolvedCustomerName ? `الزبون: ${resolvedCustomerName}` : 'اختر اللوحات لإضافتها للمهمة'}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {/* Stats */}
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <Badge variant="outline">{customerContracts.length} عقد للزبون</Badge>
            <Badge variant="outline">{existingBillboardIds.length} موجودة في المهمة</Badge>
            <Badge variant="default" className="bg-emerald-600">{totalAvailable} متاحة للإضافة</Badge>
          </div>

          {/* Search */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث بالاسم أو أقرب نقطة دالة..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-9"
            />
          </div>

          {isLoading ? (
            <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>
          ) : totalAvailable === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? 'لا توجد نتائج مطابقة للبحث' : 'جميع لوحات الزبون موجودة في المهمة بالفعل'}
            </div>
          ) : (
            <>
              {/* Select all + counter */}
              <div className="flex items-center justify-between">
                <Button variant="outline" size="sm" onClick={handleSelectAll}>
                  {selectedIds.length === totalAvailable ? 'إلغاء تحديد الكل' : 'تحديد الكل'}
                </Button>
                <Badge variant="secondary">{selectedIds.length} محددة</Badge>
              </div>

              {/* Contracts list */}
              <ScrollArea className="h-[500px] border rounded-lg">
                <div className="p-3 space-y-3">
                  {contractGroups.map(group => {
                    const groupIds = group.billboards.map((b: any) => b.ID);
                    const allGroupSelected = groupIds.every((id: number) => selectedIds.includes(id));
                    const someGroupSelected = groupIds.some((id: number) => selectedIds.includes(id));
                    const isOpen = openContracts.has(group.contractNumber);

                    return (
                      <Collapsible
                        key={group.contractNumber}
                        open={isOpen}
                        onOpenChange={() => toggleContract(group.contractNumber)}
                      >
                        <div className="border rounded-xl overflow-hidden">
                          <CollapsibleTrigger asChild>
                            <div className="flex items-center gap-2 p-3 bg-muted/30 hover:bg-muted/50 cursor-pointer transition-colors">
                              <Checkbox
                                checked={allGroupSelected}
                                className={someGroupSelected && !allGroupSelected ? 'opacity-50' : ''}
                                onCheckedChange={() => {
                                  handleSelectContract(group.contractNumber);
                                }}
                                onClick={(e) => e.stopPropagation()}
                              />
                              <FileText className="h-4 w-4 text-primary shrink-0" />
                              <div className="flex-1 min-w-0">
                                <span className="font-medium text-sm">عقد #{group.contractNumber}</span>
                                {group.adType && (
                                  <span className="text-xs text-muted-foreground mr-2">• {group.adType}</span>
                                )}
                              </div>
                              <Badge variant="outline" className="text-xs shrink-0">
                                {group.billboards.length} لوحة
                              </Badge>
                              <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                            </div>
                          </CollapsibleTrigger>

                          <CollapsibleContent>
                            <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
                              {group.billboards.map((billboard: any) => {
                                const imgSrc = billboard.design_face_a || billboard.Image_URL;
                                const isSelected = selectedIds.includes(billboard.ID);
                                return (
                                  <Card
                                    key={billboard.ID}
                                    className={`group relative overflow-hidden rounded-2xl border-2 transition-all duration-300 cursor-pointer hover:shadow-lg ${
                                      isSelected
                                        ? 'border-primary shadow-md bg-primary/5'
                                        : 'border-border hover:border-primary/30'
                                    }`}
                                    onClick={() => handleToggle(billboard.ID)}
                                  >
                                    {/* Checkbox overlay */}
                                    <div className="absolute top-3 right-3 z-30">
                                      <Checkbox
                                        checked={isSelected}
                                        onCheckedChange={() => handleToggle(billboard.ID)}
                                        onClick={(e) => e.stopPropagation()}
                                        className="bg-background/80 backdrop-blur-sm"
                                      />
                                    </div>

                                    {/* Image */}
                                    <div className="aspect-[4/3] bg-muted relative overflow-hidden">
                                      {imgSrc ? (
                                        <>
                                          <img
                                            src={imgSrc}
                                            alt={billboard.Billboard_Name}
                                            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                            loading="lazy"
                                            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
                                          />
                                          <button
                                            className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100"
                                            onClick={(e) => { e.stopPropagation(); setZoomedImage(imgSrc); }}
                                          >
                                            <div className="bg-black/50 rounded-full p-2 backdrop-blur-sm">
                                              <ZoomIn className="h-5 w-5 text-white" />
                                            </div>
                                          </button>
                                        </>
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center">
                                          <ImageIcon className="h-10 w-10 text-muted-foreground/40" />
                                        </div>
                                      )}
                                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />

                                      {/* Size badge */}
                                      <div className="absolute top-3 left-3 z-20">
                                        <Badge className="bg-background/90 text-foreground shadow border-0 backdrop-blur-sm font-bold text-xs">
                                          {billboard.Size || '—'}
                                        </Badge>
                                      </div>

                                      {/* Design face indicators */}
                                      <div className="absolute bottom-3 left-3 flex gap-1 z-20">
                                        {billboard.design_face_a && (
                                          <span className="bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded shadow">أ</span>
                                        )}
                                        {billboard.design_face_b && (
                                          <span className="bg-secondary text-secondary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded shadow">ب</span>
                                        )}
                                      </div>

                                      {/* Billboard name on image */}
                                      <div className="absolute bottom-3 right-3 z-20 flex items-center gap-1.5 flex-wrap">
                                        <h4 className="font-bold text-white text-sm drop-shadow-lg truncate max-w-[150px]">
                                          {billboard.Billboard_Name}
                                        </h4>
                                        {pausedSet.has(billboard.ID) && (
                                          <Badge className="bg-amber-600 hover:bg-amber-700 text-white text-[9px] h-4 rounded px-1 shrink-0 font-bold border-0 shadow-lg">
                                            موقوفة
                                          </Badge>
                                        )}
                                      </div>
                                    </div>

                                    {/* Details */}
                                    <CardContent className="p-3 space-y-2">
                                      {billboard.Nearest_Landmark && (
                                        <p className="text-sm font-semibold text-primary flex items-center gap-1.5 truncate">
                                          <MapPin className="h-3.5 w-3.5 shrink-0" />
                                          {billboard.Nearest_Landmark}
                                        </p>
                                      )}

                                      <div className="flex flex-wrap gap-1.5">
                                        <Badge variant="secondary" className="text-[10px] gap-1">
                                          <Layers className="h-2.5 w-2.5" />
                                          {billboard.Faces_Count || 0} وجه
                                        </Badge>
                                        {billboard.Municipality && (
                                          <Badge variant="secondary" className="text-[10px] gap-1">
                                            <Building2 className="h-2.5 w-2.5" />
                                            {billboard.Municipality}
                                          </Badge>
                                        )}
                                        {billboard.District && (
                                          <Badge variant="secondary" className="text-[10px] gap-1">
                                            {billboard.District}
                                          </Badge>
                                        )}
                                        {billboard.Municipality && (
                                          <Badge variant="secondary" className="text-[10px] gap-1">
                                            <Navigation className="h-2.5 w-2.5" />
                                            {billboard.Municipality}
                                          </Badge>
                                        )}
                                      </div>
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            </div>
                          </CollapsibleContent>
                        </div>
                      </Collapsible>
                    );
                  })}
                </div>
              </ScrollArea>
            </>
          )}

          {/* Actions */}
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
            <Button
              onClick={handleAdd}
              disabled={selectedIds.length === 0 || addMutation.isPending}
              className="gap-2"
            >
              <Plus className="h-4 w-4" />
              إضافة {selectedIds.length > 0 ? `(${selectedIds.length})` : ''}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>

    {/* Image Zoom Overlay */}
    {zoomedImage && (
      <Dialog open={!!zoomedImage} onOpenChange={() => setZoomedImage(null)}>
        <DialogContent className="max-w-3xl max-h-[90vh] p-2" dir="rtl">
          <div className="relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute top-2 left-2 z-10 bg-background/80 backdrop-blur-sm rounded-full"
              onClick={() => setZoomedImage(null)}
            >
              <X className="h-4 w-4" />
            </Button>
            <img
              src={zoomedImage}
              alt="صورة مكبرة"
              className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
            />
          </div>
        </DialogContent>
      </Dialog>
    )}
    </>
  );
}