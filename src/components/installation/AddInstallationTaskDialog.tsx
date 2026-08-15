import { useState, useMemo, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Card, CardContent } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { 
  Search, 
  MapPin, 
  Ruler, 
  Image as ImageIcon,
  CheckCircle2,
  Building2,
  Users,
  Filter,
  Calendar,
  User,
  Hash,
  Layers,
  Star,
  Check,
  X,
  FileText
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { BillboardImage } from '@/components/BillboardImage';

interface InstallationTeam {
  id: string;
  team_name: string;
  sizes: string[];
  cities: string[];
}

interface Billboard {
  ID: number;
  Billboard_Name: string;
  Size: string;
  City: string;
  Municipality: string;
  District: string;
  Nearest_Landmark: string;
  Image_URL: string;
  Faces_Count: number;
  Level: string;
}

interface Contract {
  Contract_Number: number;
  'Customer Name': string;
  'Ad Type': string;
  'Contract Date': string;
  'End Date': string;
  billboard_ids: string;
}

interface AddInstallationTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  taskType: 'installation' | 'reinstallation';
  onTaskTypeChange: (type: 'installation' | 'reinstallation') => void;
  onSubmit: (data: {
    contractId: number;
    billboardIds: number[];
    teamId: string | null;
  }) => void;
  isSubmitting: boolean;
  teams: InstallationTeam[];
}

export function AddInstallationTaskDialog({
  open,
  onOpenChange,
  taskType,
  onTaskTypeChange,
  onSubmit,
  isSubmitting,
  teams
}: AddInstallationTaskDialogProps) {
  const [contractSearchTerm, setContractSearchTerm] = useState('');
  const [billboardSearchTerm, setBillboardSearchTerm] = useState('');
  const [selectedContractId, setSelectedContractId] = useState<number | null>(null);
  const [selectedBillboardIds, setSelectedBillboardIds] = useState<number[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [sizeFilter, setSizeFilter] = useState<string>('all');
  const [showContractDropdown, setShowContractDropdown] = useState(false);

  // Reset state when dialog closes
  useEffect(() => {
    if (!open) {
      setContractSearchTerm('');
      setBillboardSearchTerm('');
      setSelectedContractId(null);
      setSelectedBillboardIds([]);
      setSelectedTeamId('');
      setCityFilter('all');
      setSizeFilter('all');
      setShowContractDropdown(false);
    }
  }, [open]);

  // Fetch available contracts
  const { data: availableContracts = [], isLoading: loadingContracts } = useQuery({
    queryKey: ['available-contracts-dialog', taskType],
    enabled: open,
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      let query = supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type", "End Date", "Contract Date", billboard_ids');
      
      if (taskType === 'reinstallation') {
        query = query.gte('End Date', today);
      }
      
      const { data, error } = await query.order('Contract_Number', { ascending: false }).limit(500);
      
      if (error) throw error;
      return data as Contract[];
    },
  });

  // Filter contracts by search term - show immediately on focus
  const filteredContracts = useMemo(() => {
    if (!contractSearchTerm.trim()) return availableContracts.slice(0, 20);
    const term = contractSearchTerm.toLowerCase();
    return availableContracts.filter(c => 
      c.Contract_Number.toString().includes(term) ||
      c['Customer Name']?.toLowerCase().includes(term) ||
      c['Ad Type']?.toLowerCase().includes(term)
    ).slice(0, 20);
  }, [availableContracts, contractSearchTerm]);

  // Get selected contract
  const selectedContract = useMemo(() => {
    if (!selectedContractId) return null;
    return availableContracts.find(c => c.Contract_Number === selectedContractId);
  }, [selectedContractId, availableContracts]);

  // Fetch billboards for selected contract
  const { data: contractBillboards = [], isLoading: loadingBillboards } = useQuery({
    queryKey: ['contract-billboards-dialog', selectedContract?.billboard_ids],
    enabled: !!selectedContract?.billboard_ids,
    queryFn: async () => {
      if (!selectedContract?.billboard_ids) return [];
      const ids = selectedContract.billboard_ids.split(',').map(id => parseInt(id.trim())).filter(Boolean);
      if (ids.length === 0) return [];
      
      const { data, error } = await supabase
        .from('billboards')
        .select('ID, Billboard_Name, Size, City, Municipality, District, Nearest_Landmark, Image_URL, Faces_Count, Level')
        .in('ID', ids);
      
      if (error) throw error;
      return (data || []) as Billboard[];
    },
  });

  // Get unique cities and sizes from billboards
  const { cities, sizes } = useMemo(() => {
    const citiesSet = new Set<string>();
    const sizesSet = new Set<string>();
    contractBillboards.forEach(b => {
      if (b.City) citiesSet.add(b.City);
      if (b.Size) sizesSet.add(b.Size);
    });
    return {
      cities: Array.from(citiesSet).sort(),
      sizes: Array.from(sizesSet).sort()
    };
  }, [contractBillboards]);

  // Filter billboards
  const filteredBillboards = useMemo(() => {
    let result = contractBillboards;
    
    if (billboardSearchTerm.trim()) {
      const term = billboardSearchTerm.toLowerCase();
      result = result.filter(b =>
        b.Billboard_Name?.toLowerCase().includes(term) ||
        b.Nearest_Landmark?.toLowerCase().includes(term) ||
        b.Municipality?.toLowerCase().includes(term) ||
        b.District?.toLowerCase().includes(term) ||
        String(b.ID).includes(term)
      );
    }
    
    if (cityFilter !== 'all') {
      result = result.filter(b => b.City === cityFilter);
    }
    
    if (sizeFilter !== 'all') {
      result = result.filter(b => b.Size === sizeFilter);
    }
    
    return result;
  }, [contractBillboards, billboardSearchTerm, cityFilter, sizeFilter]);

  // Auto-select all billboards when contract changes
  useEffect(() => {
    if (contractBillboards.length > 0) {
      setSelectedBillboardIds(contractBillboards.map(b => b.ID));
    }
  }, [contractBillboards]);

  // Get recommended teams based on selected billboards
  const recommendedTeams = useMemo(() => {
    if (selectedBillboardIds.length === 0) return teams.map(t => ({ ...t, isRecommended: false, cityMatch: false, sizeMatch: false }));
    
    const selectedBillboards = contractBillboards.filter(b => selectedBillboardIds.includes(b.ID));
    const billboardCities = new Set(selectedBillboards.map(b => b.City).filter(Boolean));
    const billboardSizes = new Set(selectedBillboards.map(b => b.Size).filter(Boolean));
    
    return teams.map(team => {
      const teamCities = team.cities || [];
      const teamSizes = team.sizes || [];
      
      let cityMatch = teamCities.length === 0;
      let sizeMatch = teamSizes.length === 0;
      
      if (!cityMatch) {
        cityMatch = Array.from(billboardCities).some(city => teamCities.includes(city));
      }
      if (!sizeMatch) {
        sizeMatch = Array.from(billboardSizes).some(size => teamSizes.includes(size));
      }
      
      return {
        ...team,
        cityMatch,
        sizeMatch,
        isRecommended: cityMatch && sizeMatch
      };
    }).sort((a, b) => {
      if (a.isRecommended && !b.isRecommended) return -1;
      if (!a.isRecommended && b.isRecommended) return 1;
      return 0;
    });
  }, [teams, selectedBillboardIds, contractBillboards]);

  const handleSelectAll = () => {
    setSelectedBillboardIds(filteredBillboards.map(b => b.ID));
  };

  const handleDeselectAll = () => {
    setSelectedBillboardIds([]);
  };

  const toggleBillboard = (id: number) => {
    setSelectedBillboardIds(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  const handleSubmit = () => {
    if (!selectedContractId || selectedBillboardIds.length === 0) return;
    onSubmit({
      contractId: selectedContractId,
      billboardIds: selectedBillboardIds,
      teamId: selectedTeamId || null
    });
  };

  const handleContractSelect = (contract: Contract) => {
    setSelectedContractId(contract.Contract_Number);
    setContractSearchTerm(`#${contract.Contract_Number} - ${contract['Customer Name']}`);
    setShowContractDropdown(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <DialogHeader className="px-6 py-4 border-b bg-gradient-to-r from-primary/5 to-transparent">
          <DialogTitle className="text-xl flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Users className="h-5 w-5 text-primary" />
            </div>
            <div>
              <span>إضافة مهمة تركيب جديدة</span>
              {selectedContract && (
                <p className="text-sm font-normal text-muted-foreground mt-0.5">
                  العقد #{selectedContract.Contract_Number} • {selectedContract['Customer Name']}
                </p>
              )}
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-hidden flex flex-col">
          <div className="flex-1 overflow-y-auto px-6 py-4 space-y-5">
            {/* Task Type Selection */}
            <div className="flex gap-3">
              <Button
                type="button"
                variant={taskType === 'installation' ? 'default' : 'outline'}
                onClick={() => onTaskTypeChange('installation')}
                className="flex-1 h-12 gap-2"
              >
                <Layers className="h-4 w-4" />
                تركيب جديد
              </Button>
              <Button
                type="button"
                variant={taskType === 'reinstallation' ? 'default' : 'outline'}
                onClick={() => onTaskTypeChange('reinstallation')}
                className="flex-1 h-12 gap-2"
              >
                <FileText className="h-4 w-4" />
                إعادة تركيب
              </Button>
            </div>

            {/* Contract Search with Instant Dropdown */}
            <div className="space-y-2">
              <Label className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                اختيار العقد
              </Label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground z-10" />
                <Input
                  placeholder="ابحث برقم العقد أو اسم العميل..."
                  value={contractSearchTerm}
                  onChange={(e) => {
                    setContractSearchTerm(e.target.value);
                    setShowContractDropdown(true);
                    if (selectedContractId && !e.target.value.includes(String(selectedContractId))) {
                      setSelectedContractId(null);
                    }
                  }}
                  onFocus={() => setShowContractDropdown(true)}
                  className="pr-10 h-12 text-base"
                />
                
                {/* Instant Dropdown */}
                {showContractDropdown && (
                  <div className="absolute top-full left-0 right-0 z-[100] mt-1 bg-popover border rounded-xl shadow-xl max-h-[280px] overflow-hidden">
                    <ScrollArea className="h-[280px]">
                      <div className="p-2">
                        {loadingContracts ? (
                          <div className="text-center text-sm text-muted-foreground py-6">
                            جاري التحميل...
                          </div>
                        ) : filteredContracts.length === 0 ? (
                          <div className="text-center text-sm text-muted-foreground py-6">
                            {contractSearchTerm ? 'لا توجد نتائج' : 'لا توجد عقود متاحة'}
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {filteredContracts.map(contract => (
                              <button
                                key={contract.Contract_Number}
                                type="button"
                                onClick={() => handleContractSelect(contract)}
                                className={cn(
                                  "w-full p-3 rounded-lg text-right transition-all flex items-center gap-3",
                                  selectedContractId === contract.Contract_Number
                                    ? "bg-primary text-primary-foreground"
                                    : "hover:bg-muted"
                                )}
                              >
                                <div className="h-10 w-10 rounded-lg bg-background/20 flex items-center justify-center shrink-0">
                                  <Hash className="h-4 w-4" />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-bold">#{contract.Contract_Number}</span>
                                    <span className="font-medium truncate">{contract['Customer Name']}</span>
                                  </div>
                                  <div className="flex items-center gap-2 text-xs opacity-75 mt-0.5">
                                    {contract['Ad Type'] && (
                                      <Badge variant="secondary" className="text-[10px] h-5">
                                        {contract['Ad Type']}
                                      </Badge>
                                    )}
                                    {contract['Contract Date'] && (
                                      <span className="flex items-center gap-1">
                                        <Calendar className="h-3 w-3" />
                                        {new Date(contract['Contract Date']).toLocaleDateString('ar-LY')}
                                      </span>
                                    )}
                                  </div>
                                </div>
                                {selectedContractId === contract.Contract_Number && (
                                  <CheckCircle2 className="h-5 w-5 shrink-0" />
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </div>
              
              {/* Click outside to close dropdown */}
              {showContractDropdown && (
                <div 
                  className="fixed inset-0 z-[99]" 
                  onClick={() => setShowContractDropdown(false)}
                />
              )}
            </div>

            {/* Billboard Selection */}
            {selectedContract && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-semibold flex items-center gap-2">
                    <Layers className="h-4 w-4 text-primary" />
                    اللوحات ({selectedBillboardIds.length}/{contractBillboards.length} محددة)
                  </Label>
                  <div className="flex gap-2">
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={handleSelectAll}
                      className="h-8"
                    >
                      <Check className="h-3.5 w-3.5 ml-1" />
                      الكل
                    </Button>
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="sm" 
                      onClick={handleDeselectAll}
                      className="h-8"
                    >
                      <X className="h-3.5 w-3.5 ml-1" />
                      إلغاء
                    </Button>
                  </div>
                </div>

                {/* Billboard Filters */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="relative">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="بحث عن لوحة..."
                      value={billboardSearchTerm}
                      onChange={(e) => setBillboardSearchTerm(e.target.value)}
                      className="pr-10 h-10"
                    />
                  </div>
                  <Select value={cityFilter} onValueChange={setCityFilter}>
                    <SelectTrigger className="h-10">
                      <MapPin className="h-3.5 w-3.5 ml-1 text-muted-foreground" />
                      <SelectValue placeholder="المدينة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع المدن</SelectItem>
                      {cities.map(city => (
                        <SelectItem key={city} value={city}>{city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={sizeFilter} onValueChange={setSizeFilter}>
                    <SelectTrigger className="h-10">
                      <Ruler className="h-3.5 w-3.5 ml-1 text-muted-foreground" />
                      <SelectValue placeholder="المقاس" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">جميع المقاسات</SelectItem>
                      {sizes.map(size => (
                        <SelectItem key={size} value={size}>{size}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Billboard Cards Grid */}
                {loadingBillboards ? (
                  <div className="text-center py-8 text-muted-foreground">
                    جاري تحميل اللوحات...
                  </div>
                ) : filteredBillboards.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    لا توجد لوحات
                  </div>
                ) : (
                  <ScrollArea className="h-[320px]">
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 p-1">
                      {filteredBillboards.map(billboard => {
                        const isSelected = selectedBillboardIds.includes(billboard.ID);
                        return (
                          <Card
                            key={billboard.ID}
                            onClick={() => toggleBillboard(billboard.ID)}
                            className={cn(
                              "cursor-pointer overflow-hidden transition-all duration-200 hover:shadow-lg group",
                              isSelected 
                                ? "ring-2 ring-primary shadow-primary/20 bg-primary/5" 
                                : "hover:ring-1 hover:ring-primary/50"
                            )}
                          >
                            <CardContent className="p-0">
                              {/* Image */}
                              <div className="relative h-28 overflow-hidden bg-muted">
                                <BillboardImage 
                                  billboard={billboard as any}
                                  className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                                  alt={billboard.Billboard_Name}
                                />
                                
                                {/* Level Badge */}
                                {billboard.Level && (
                                  <Badge className="absolute top-2 left-2 bg-primary/90 text-[10px] h-5">
                                    {billboard.Level}
                                  </Badge>
                                )}
                                
                                {/* ID Badge */}
                                <Badge variant="secondary" className="absolute top-2 right-2 text-[10px] h-5">
                                  #{billboard.ID}
                                </Badge>
                                
                                {/* Selection Overlay */}
                                {isSelected && (
                                  <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                                    <div className="h-10 w-10 rounded-full bg-primary flex items-center justify-center">
                                      <CheckCircle2 className="h-6 w-6 text-primary-foreground" />
                                    </div>
                                  </div>
                                )}
                                
                                {/* Faces Count */}
                                {billboard.Faces_Count && (
                                  <Badge variant="secondary" className="absolute bottom-2 left-2 text-[10px] h-5">
                                    {billboard.Faces_Count} وجه
                                  </Badge>
                                )}
                              </div>
                              
                              {/* Info */}
                              <div className="p-3 space-y-1.5">
                                <div className="font-semibold text-sm truncate">
                                  {billboard.Billboard_Name}
                                </div>
                                
                                {/* Location */}
                                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                                  <Building2 className="h-3 w-3 shrink-0" />
                                  <span className="truncate">
                                    {[billboard.City, billboard.Municipality].filter(Boolean).join(' • ')}
                                  </span>
                                </div>
                                
                                {/* Nearest Landmark */}
                                {billboard.Nearest_Landmark && (
                                  <div className="flex items-center gap-1 text-xs text-primary/80">
                                    <MapPin className="h-3 w-3 shrink-0" />
                                    <span className="truncate">{billboard.Nearest_Landmark}</span>
                                  </div>
                                )}
                                
                                {/* Size */}
                                <Badge variant="outline" className="text-[10px] h-5 w-fit">
                                  <Ruler className="h-2.5 w-2.5 ml-1" />
                                  {billboard.Size}
                                </Badge>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  </ScrollArea>
                )}
              </div>
            )}

            {/* Team Selection */}
            {selectedBillboardIds.length > 0 && (
              <div className="space-y-3">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <Users className="h-4 w-4 text-primary" />
                  اختيار الفريق (اختياري)
                </Label>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  {recommendedTeams.map(team => (
                    <button
                      key={team.id}
                      type="button"
                      onClick={() => setSelectedTeamId(team.id === selectedTeamId ? '' : team.id)}
                      className={cn(
                        "p-3 rounded-xl border-2 text-right transition-all relative",
                        selectedTeamId === team.id
                          ? "border-primary bg-primary/5"
                          : team.isRecommended
                          ? "border-green-500/50 bg-green-50/50 dark:bg-green-950/20 hover:border-green-500"
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      {team.isRecommended && (
                        <Badge className="absolute -top-2 right-2 bg-green-500 text-[10px] h-5">
                          <Star className="h-3 w-3 ml-1" />
                          موصى به
                        </Badge>
                      )}
                      <div className="font-medium">{team.team_name}</div>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {team.cityMatch && team.cities?.length > 0 && (
                          <Badge variant="secondary" className="text-[10px] h-5">
                            <MapPin className="h-2.5 w-2.5 ml-0.5" />
                            المدن
                          </Badge>
                        )}
                        {team.sizeMatch && team.sizes?.length > 0 && (
                          <Badge variant="secondary" className="text-[10px] h-5">
                            <Ruler className="h-2.5 w-2.5 ml-0.5" />
                            المقاسات
                          </Badge>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <DialogFooter className="px-6 py-4 border-t bg-muted/30">
            <div className="flex items-center justify-between w-full">
              <div className="text-sm text-muted-foreground">
                {selectedBillboardIds.length > 0 && (
                  <span>تم اختيار <strong>{selectedBillboardIds.length}</strong> لوحة</span>
                )}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                  إلغاء
                </Button>
                <Button 
                  onClick={handleSubmit}
                  disabled={!selectedContractId || selectedBillboardIds.length === 0 || isSubmitting}
                  className="min-w-[120px]"
                >
                  {isSubmitting ? 'جاري الإنشاء...' : 'إنشاء المهمة'}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
