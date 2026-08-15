import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  MapPin,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ArrowLeft,
  ArrowRight,
  Users,
  Layers,
  Check,
  X,
  Wrench,
  FileText,
  ChevronDown,
  ChevronUp,
  Image,
  Navigation,
  Maximize2
} from 'lucide-react';

interface ManualRemovalTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: any[];
  existingTaskBillboardIds: Set<number>;
}

interface ContractGroup {
  contractNumber: number | null;
  customerName: string;
  adType: string;
  designUrl: string | null;
  billboards: any[];
}

export function ManualRemovalTaskDialog({ 
  open, 
  onOpenChange, 
  teams,
  existingTaskBillboardIds
}: ManualRemovalTaskDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedBillboards, setSelectedBillboards] = useState<Set<number>>(new Set());
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [currentStep, setCurrentStep] = useState<1 | 2>(1);
  const [filterCity, setFilterCity] = useState<string>('all');
  const [expandedContracts, setExpandedContracts] = useState<Set<number | string>>(new Set());
  
  const queryClient = useQueryClient();

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSearchTerm('');
      setSelectedBillboards(new Set());
      setSelectedTeamId(teams.length > 0 ? teams[0].id : '');
      setNotes('');
      setCurrentStep(1);
      setFilterCity('all');
      setExpandedContracts(new Set());
    }
  }, [open, teams]);

  // جلب اللوحات من العقود المنتهية فقط وغير المضافة لمهام إزالة وغير المؤجرة حالياً
  const { data: allBillboards = [], isLoading: billboardsLoading } = useQuery({
    queryKey: ['expired-billboards-for-manual-removal', open],
    enabled: open,
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayStr = today.toISOString().split('T')[0];
      
      // جلب جميع اللوحات المرتبطة بعقود (دون قيد انتهاء التاريخ لتسهيل الإضافة اليدوية لأي لوحة)
      const { data: billboards, error } = await supabase
        .from('billboards')
        .select('*')
        .not('Contract_Number', 'is', null)
        .order('Rent_End_Date', { ascending: false, nullsFirst: false });
      
      if (error) throw error;
      
      // جلب جميع العقود النشطة (غير منتهية) للتحقق من اللوحات المؤجرة
      const { data: activeContracts } = await supabase
        .from('Contract')
        .select('billboard_ids, "End Date"')
        .gt('"End Date"', todayStr); // العقود التي لم تنتهي بعد فقط
      
      // استخراج معرفات اللوحات المؤجرة حالياً في عقود نشطة
      const rentedBillboardIds = new Set<number>();
      (activeContracts || []).forEach(contract => {
        if (contract.billboard_ids) {
          const ids = contract.billboard_ids.split(',').map((id: string) => parseInt(id.trim())).filter(Boolean);
          ids.forEach((id: number) => rentedBillboardIds.add(id));
        }
      });
      
      // فلترة اللوحات الموجودة بالفعل في مهام إزالة مع وسم اللوحات ذات العقود النشطة
      return (billboards || []).filter(b => 
        !existingTaskBillboardIds.has(b.ID)
      ).map(b => ({
        ...b,
        isRentedInActiveContract: rentedBillboardIds.has(b.ID)
      }));
    }
  });

  // استخراج المدن الفريدة
  const uniqueCities = useMemo(() => {
    const cities = new Set(allBillboards.map(b => b.City).filter(Boolean));
    return Array.from(cities).sort();
  }, [allBillboards]);

  // فلترة اللوحات
  const filteredBillboards = useMemo(() => {
    let result = allBillboards;
    
    if (searchTerm.trim()) {
      const search = searchTerm.toLowerCase();
      result = result.filter(b => 
        String(b.ID).includes(search) ||
        String(b.Contract_Number).includes(search) ||
        b.Billboard_Name?.toLowerCase().includes(search) ||
        b.Municipality?.toLowerCase().includes(search) ||
        b.District?.toLowerCase().includes(search) ||
        b.Customer_Name?.toLowerCase().includes(search) ||
        b.Nearest_Landmark?.toLowerCase().includes(search)
      );
    }
    
    if (filterCity !== 'all') {
      result = result.filter(b => b.City === filterCity);
    }
    
    return result;
  }, [allBillboards, searchTerm, filterCity]);

  // تجميع اللوحات حسب العقود
  const groupedByContract = useMemo(() => {
    const groups: Map<number | string, ContractGroup> = new Map();
    
    filteredBillboards.forEach(billboard => {
      const contractNum = billboard.Contract_Number;
      const key = contractNum || `no-contract-${billboard.ID}`;
      
      if (!groups.has(key)) {
        groups.set(key, {
          contractNumber: contractNum,
          customerName: billboard.Customer_Name || 'غير محدد',
          adType: billboard.Ad_Type || 'غير محدد',
          designUrl: billboard.design_face_a || billboard.design_face_b || null,
          billboards: []
        });
      }
      
      groups.get(key)!.billboards.push(billboard);
    });
    
    // ترتيب المجموعات - العقود ذات الأرقام أولاً
    return Array.from(groups.entries()).sort((a, b) => {
      const aNum = typeof a[0] === 'number' ? a[0] : 0;
      const bNum = typeof b[0] === 'number' ? b[0] : 0;
      return bNum - aNum;
    });
  }, [filteredBillboards]);

  const toggleBillboard = (billboardId: number) => {
    const newSet = new Set(selectedBillboards);
    if (newSet.has(billboardId)) {
      newSet.delete(billboardId);
    } else {
      newSet.add(billboardId);
    }
    setSelectedBillboards(newSet);
  };

  const toggleContractExpanded = (key: number | string) => {
    const newSet = new Set(expandedContracts);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setExpandedContracts(newSet);
  };

  const toggleContractBillboards = (billboards: any[]) => {
    const billboardIds = billboards.map(b => b.ID);
    const allSelected = billboardIds.every(id => selectedBillboards.has(id));
    
    const newSet = new Set(selectedBillboards);
    if (allSelected) {
      billboardIds.forEach(id => newSet.delete(id));
    } else {
      billboardIds.forEach(id => newSet.add(id));
    }
    setSelectedBillboards(newSet);
  };

  const selectAllFiltered = () => {
    const allIds = filteredBillboards.map(b => b.ID);
    const allSelected = allIds.every(id => selectedBillboards.has(id));
    
    if (allSelected) {
      setSelectedBillboards(new Set());
    } else {
      setSelectedBillboards(new Set(allIds));
    }
  };

  const expandAll = () => {
    const allKeys = groupedByContract.map(([key]) => key);
    setExpandedContracts(new Set(allKeys));
  };

  const collapseAll = () => {
    setExpandedContracts(new Set());
  };

  // إنشاء مهمة الإزالة اليدوية
  const createTaskMutation = useMutation({
    mutationFn: async () => {
      if (selectedBillboards.size === 0) {
        throw new Error('يرجى اختيار لوحة واحدة على الأقل');
      }

      // تجميع اللوحات حسب الفريق المناسب
      const teamBillboardsMap = new Map<string, number[]>();

      for (const billboardId of selectedBillboards) {
        const billboard = allBillboards.find(b => b.ID === billboardId);
        const billboardSize = billboard?.Size || '';
        const billboardCity = billboard?.City || '';

        let teamId = selectedTeamId;

        if (!teamId) {
          // توزيع تلقائي حسب المقاس والمدينة
          let matchedTeam = teams.find(team => {
            const hasSize = team.sizes && team.sizes.length > 0 && team.sizes.some((s: string) => s.trim() === billboardSize.trim());
            const hasCities = team.cities && team.cities.length > 0;
            const hasCity = hasCities && team.cities.some((c: string) => c.trim() === billboardCity.trim());
            return hasSize && (!hasCities || hasCity);
          });

          if (!matchedTeam) {
            matchedTeam = teams.find(team => {
              return team.sizes && team.sizes.length > 0 && team.sizes.some((s: string) => s.trim() === billboardSize.trim());
            });
          }

          teamId = matchedTeam?.id || (teams.length > 0 ? teams[0].id : '');
        }

        if (!teamBillboardsMap.has(teamId)) {
          teamBillboardsMap.set(teamId, []);
        }
        teamBillboardsMap.get(teamId)!.push(billboardId);
      }

      // إنشاء مهمة لكل فريق
      for (const [teamId, billboardIds] of teamBillboardsMap) {
        // استخراج أرقام العقود الفريدة للوحات المحددة لهذا الفريق
        const contractNumbers = Array.from(new Set(
          billboardIds.map(id => allBillboards.find(b => b.ID === id)?.Contract_Number).filter(Boolean)
        )) as number[];

        const { data: task, error: taskError } = await supabase
          .from('removal_tasks')
          .insert({
            team_id: teamId,
            status: 'pending',
            contract_id: contractNumbers.length === 1 ? contractNumbers[0] : null,
            contract_ids: contractNumbers
          })
          .select()
          .single();

        if (taskError) throw taskError;

        for (const billboardId of billboardIds) {
          const billboard = allBillboards.find(b => b.ID === billboardId);
          
          // جلب صور التصميم من آخر مهمة تركيب للوحة
          const { data: installationItems } = await supabase
            .from('installation_task_items')
            .select('design_face_a, design_face_b')
            .eq('billboard_id', billboardId)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

          let designFaceA = installationItems?.design_face_a || null;
          let designFaceB = installationItems?.design_face_b || null;

          // جلب التصاميم من العقد كـ fallback إذا لم تتوفر في مهام التركيب
          if ((!designFaceA || !designFaceB) && billboard?.Contract_Number) {
            const { data: contractData } = await supabase
              .from('Contract')
              .select('design_data')
              .eq('Contract_Number', billboard.Contract_Number)
              .maybeSingle();
              
            if (contractData?.design_data) {
              try {
                const dd = typeof contractData.design_data === 'string'
                  ? JSON.parse(contractData.design_data) : contractData.design_data;
                const arr = typeof dd === 'string' ? JSON.parse(dd) : dd;
                if (Array.isArray(arr)) {
                  const match = arr.find((d: any) => String(d.billboardId) === String(billboardId));
                  if (match) {
                    if (!designFaceA) designFaceA = match.designFaceA || match.design_face_a_url || null;
                    if (!designFaceB) designFaceB = match.designFaceB || match.design_face_b_url || null;
                  }
                }
              } catch (e) {
                console.error("Error parsing contract design_data for manual removal:", e);
              }
            }
          }

          await supabase
            .from('removal_task_items')
            .insert({
              task_id: task.id,
              billboard_id: billboardId,
              status: 'pending',
              notes: notes || null,
              design_face_a: designFaceA,
              design_face_b: designFaceB
            });
        }
      }
      
      return selectedBillboards.size;
    },
    onSuccess: (count) => {
      toast.success(`تم إنشاء مهمة إزالة يدوية بنجاح (${count} لوحة)`);
      queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error('فشل إنشاء المهمة: ' + error.message);
    }
  });

  const canProceedToStep2 = selectedBillboards.size > 0;
  const canSubmit = selectedBillboards.size > 0;

  const steps = [
    { number: 1, title: 'اختيار اللوحات', icon: MapPin },
    { number: 2, title: 'إعدادات المهمة', icon: Users },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header with Steps */}
        <div className="bg-gradient-to-r from-amber-500 to-orange-500 dark:from-amber-600 dark:to-orange-600 text-white p-4 shrink-0">
          <DialogHeader className="text-white">
            <DialogTitle className="flex items-center gap-3 text-lg text-white">
              <div className="p-2 bg-white/20 rounded-lg">
                <Wrench className="h-5 w-5" />
              </div>
              إنشاء مهمة إزالة يدوية
            </DialogTitle>
          </DialogHeader>
          
          {/* Step Indicators */}
          <div className="flex items-center justify-center mt-3 gap-4">
            {steps.map((step, idx) => {
              const StepIcon = step.icon;
              const isActive = currentStep === step.number;
              const isCompleted = currentStep > step.number;
              
              return (
                <div key={step.number} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div 
                      className={`
                        w-10 h-10 rounded-full flex items-center justify-center transition-all
                        ${isActive ? 'bg-white text-orange-600 scale-110 shadow-lg' : 
                          isCompleted ? 'bg-green-500 text-white' : 'bg-white/30 text-white'}
                      `}
                    >
                      {isCompleted ? <Check className="h-4 w-4" /> : <StepIcon className="h-4 w-4" />}
                    </div>
                    <span className={`text-xs mt-1 ${isActive ? 'font-bold' : 'opacity-80'}`}>
                      {step.title}
                    </span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={`w-16 h-1 mx-2 mt-[-18px] rounded-full ${isCompleted ? 'bg-green-500' : 'bg-white/30'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-4">
          <AnimatePresence mode="wait">
            {/* Step 1: اختيار اللوحات */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="h-full flex flex-col"
              >
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <h3 className="text-lg font-semibold">اختر اللوحات للإزالة</h3>
                    <p className="text-sm text-muted-foreground">
                      {groupedByContract.length} عقد • {filteredBillboards.length} لوحة
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={expandAll} className="gap-1 text-xs">
                      <Maximize2 className="h-3 w-3" />
                      فتح الكل
                    </Button>
                    <Button variant="ghost" size="sm" onClick={collapseAll} className="gap-1 text-xs">
                      <ChevronUp className="h-3 w-3" />
                      طي الكل
                    </Button>
                    <Separator orientation="vertical" className="h-6" />
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={selectAllFiltered}
                      className="gap-1"
                    >
                      <Layers className="h-4 w-4" />
                      {selectedBillboards.size === filteredBillboards.length && filteredBillboards.length > 0
                        ? 'إلغاء الكل' 
                        : 'تحديد الكل'}
                    </Button>
                    <Badge variant="default" className="text-base px-3 py-1.5 bg-orange-600">
                      {selectedBillboards.size} مختار
                    </Badge>
                  </div>
                </div>

                {/* Filters */}
                <div className="flex gap-2 mb-3">
                  <div className="relative flex-1">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="بحث بالرقم، العقد، الاسم، الموقع، النقطة الدالة..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pr-10 h-10"
                    />
                    {searchTerm && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setSearchTerm('')}
                        className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7 p-0"
                      >
                        <X className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                  <Select value={filterCity} onValueChange={setFilterCity}>
                    <SelectTrigger className="w-[160px] h-10">
                      <SelectValue placeholder="المدينة" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">كل المدن</SelectItem>
                      {uniqueCities.map(city => (
                        <SelectItem key={city} value={city}>{city}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex-1 border rounded-xl overflow-auto max-h-[calc(90vh-280px)]">
                  <div className="p-2 space-y-2">
                    {billboardsLoading ? (
                      <div className="text-center py-12">
                        <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-3 text-orange-500" />
                        <p className="text-muted-foreground">جاري تحميل اللوحات...</p>
                      </div>
                    ) : groupedByContract.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <AlertCircle className="h-10 w-10 mx-auto mb-3 opacity-50" />
                        <p className="text-lg">لا توجد لوحات متطابقة</p>
                        <p className="text-sm mt-2">جميع اللوحات المنتهية إما مؤجرة حالياً أو لها مهام إزالة</p>
                      </div>
                    ) : (
                      groupedByContract.map(([key, group]) => {
                        const isExpanded = expandedContracts.has(key);
                        const selectedCount = group.billboards.filter(b => selectedBillboards.has(b.ID)).length;
                        const allSelected = selectedCount === group.billboards.length;
                        
                        return (
                          <Collapsible 
                            key={key} 
                            open={isExpanded}
                            onOpenChange={() => toggleContractExpanded(key)}
                          >
                            <Card className={`overflow-hidden transition-all border ${
                              selectedCount > 0 ? 'border-orange-400 bg-orange-50/50 dark:bg-orange-950/20' : 'hover:border-muted-foreground/30'
                            }`}>
                              {/* Contract Header */}
                              <CollapsibleTrigger asChild>
                                <div className="flex items-center gap-3 p-3 cursor-pointer hover:bg-muted/60 transition-colors">
                                  {/* Select All Contract Button */}
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className={`shrink-0 h-8 px-2 ${allSelected ? 'bg-orange-100 text-orange-700' : ''}`}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      toggleContractBillboards(group.billboards);
                                    }}
                                  >
                                    <div 
                                      className={`
                                        w-5 h-5 rounded border-2 flex items-center justify-center ml-1
                                        ${allSelected ? 'bg-orange-500 border-orange-500' : 
                                          selectedCount > 0 ? 'bg-orange-200 border-orange-400' : 'border-muted-foreground'}
                                      `}
                                    >
                                      {allSelected && <Check className="h-3 w-3 text-white" />}
                                      {!allSelected && selectedCount > 0 && <div className="w-2 h-2 bg-orange-500 rounded-sm" />}
                                    </div>
                                    <span className="text-xs">الكل</span>
                                  </Button>
                                  
                                  
                                  {/* Design Image */}
                                  {group.designUrl ? (
                                    <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 border-2 border-orange-200">
                                      <img 
                                        src={group.designUrl} 
                                        alt="التصميم"
                                        className="w-full h-full object-cover"
                                        onError={(e) => {
                                          e.currentTarget.style.display = 'none';
                                          e.currentTarget.parentElement!.innerHTML = '<div class="w-full h-full flex items-center justify-center bg-muted"><svg class="h-5 w-5 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"></path></svg></div>';
                                        }}
                                      />
                                    </div>
                                  ) : (
                                    <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0 border">
                                      <Image className="h-5 w-5 text-muted-foreground" />
                                    </div>
                                  )}
                                  
                                  {/* Contract Info */}
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      {group.contractNumber ? (
                                        <Badge variant="secondary" className="bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                                          <FileText className="h-3 w-3 ml-1" />
                                          عقد #{group.contractNumber}
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="text-muted-foreground">
                                          بدون عقد
                                        </Badge>
                                      )}
                                      <Badge variant="outline">{group.adType}</Badge>
                                    </div>
                                    <p className="text-sm text-muted-foreground mt-1 truncate">
                                      {group.customerName}
                                    </p>
                                  </div>
                                  
                                  {/* Count & Expand */}
                                  <div className="flex items-center gap-2">
                                    {selectedCount > 0 && (
                                      <Badge className="bg-orange-500">
                                        {selectedCount}/{group.billboards.length}
                                      </Badge>
                                    )}
                                    <Badge variant="outline" className="text-muted-foreground">
                                      {group.billboards.length} لوحة
                                    </Badge>
                                    {isExpanded ? (
                                      <ChevronUp className="h-5 w-5 text-muted-foreground" />
                                    ) : (
                                      <ChevronDown className="h-5 w-5 text-muted-foreground" />
                                    )}
                                  </div>
                                </div>
                              </CollapsibleTrigger>
                              
                              {/* Billboards Grid */}
                              <CollapsibleContent>
                                <div className="border-t bg-gradient-to-b from-muted/20 to-transparent p-4">
                                  <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                                    {group.billboards.map((billboard) => {
                                      const isSelected = selectedBillboards.has(billboard.ID);
                                      const heroImage = billboard.Image_URL || billboard.design_face_a;
                                      
                                      return (
                                        <motion.div
                                          key={billboard.ID}
                                          initial={{ opacity: 0, y: 10 }}
                                          animate={{ opacity: 1, y: 0 }}
                                          whileTap={{ scale: 0.98 }}
                                          className={`
                                            group/card relative overflow-hidden rounded-2xl cursor-pointer transition-all duration-300
                                            ${isSelected 
                                              ? 'ring-2 ring-primary shadow-lg shadow-primary/20' 
                                              : 'ring-1 ring-border hover:ring-primary/50 hover:shadow-lg'
                                            }
                                          `}
                                          onClick={() => toggleBillboard(billboard.ID)}
                                        >
                                          {/* Hero Image */}
                                          <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                                            {heroImage ? (
                                              <>
                                                <img 
                                                  src={heroImage} 
                                                  alt=""
                                                  className="w-full h-full object-cover transition-transform duration-500 group-hover/card:scale-105"
                                                  onError={(e) => (e.currentTarget.style.display = 'none')}
                                                />
                                                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                                              </>
                                            ) : (
                                              <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                                                <Image className="h-8 w-8 text-muted-foreground/30" />
                                              </div>
                                            )}
                                            
                                            {/* Selection Indicator */}
                                            <div className={`
                                              absolute top-3 right-3 w-6 h-6 rounded-full flex items-center justify-center transition-all duration-300
                                              ${isSelected 
                                                ? 'bg-primary text-primary-foreground scale-110' 
                                                : 'bg-white/20 backdrop-blur-md group-hover/card:bg-white/40'
                                              }
                                            `}>
                                              {isSelected && <Check className="h-4 w-4" />}
                                            </div>
                                            
                                            {/* ID Badge */}
                                            <div className="absolute top-3 left-3 flex flex-col gap-1.5 items-start">
                                              <span className="text-xs font-bold text-white bg-black/40 backdrop-blur-md px-2 py-1 rounded-full">
                                                #{billboard.ID}
                                              </span>
                                              {(billboard as any).isRentedInActiveContract && (
                                                <span className="text-[9px] font-extrabold text-white bg-amber-600/90 backdrop-blur-sm px-1.5 py-0.5 rounded-md">
                                                  عقد نشط
                                                </span>
                                              )}
                                            </div>
                                            
                                            {/* Bottom Info on Image */}
                                            <div className="absolute bottom-0 right-0 left-0 p-3">
                                              <h4 className="text-white font-semibold text-sm line-clamp-1 drop-shadow-sm">
                                                {billboard.Billboard_Name || billboard.Municipality}
                                              </h4>
                                              <div className="flex items-center gap-2 mt-1">
                                                <span className="text-white/80 text-xs bg-white/20 backdrop-blur-sm px-2 py-0.5 rounded-full">
                                                  {billboard.Size}
                                                </span>
                                              </div>
                                            </div>
                                          </div>
                                          
                                          {/* Content */}
                                          <div className={`p-3 space-y-2 transition-colors duration-300 ${isSelected ? 'bg-primary/5' : 'bg-card'}`}>
                                            {billboard.Nearest_Landmark && (
                                              <p className="text-xs text-muted-foreground flex items-start gap-1.5 leading-relaxed">
                                                <Navigation className="h-3.5 w-3.5 shrink-0 text-blue-500 mt-0.5" />
                                                <span className="line-clamp-2">{billboard.Nearest_Landmark}</span>
                                              </p>
                                            )}
                                            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                                              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary/70" />
                                              {billboard.City} - {billboard.District || billboard.Municipality}
                                            </p>
                                          </div>
                                        </motion.div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </CollapsibleContent>
                            </Card>
                          </Collapsible>
                        );
                      })
                    )}
                  </div>
                </div>
              </motion.div>
            )}

            {/* Step 2: إعدادات المهمة */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="h-full flex flex-col"
              >
                <div className="mb-4">
                  <h3 className="text-lg font-semibold">إعدادات المهمة</h3>
                  <p className="text-sm text-muted-foreground">
                    راجع التفاصيل واختر الفريق المسؤول
                  </p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <Card className="p-4 bg-gradient-to-br from-orange-50 to-amber-100 dark:from-orange-950/50 dark:to-amber-900/30 border-orange-200">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-orange-500 rounded-xl">
                        <MapPin className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-orange-700">{selectedBillboards.size}</p>
                        <p className="text-sm text-orange-600">لوحة للإزالة</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 bg-gradient-to-br from-green-50 to-emerald-100 dark:from-green-950/50 dark:to-emerald-900/30 border-green-200">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-green-500 rounded-xl">
                        <Users className="h-6 w-6 text-white" />
                      </div>
                      <div>
                        <p className="text-lg font-bold text-green-700 truncate">
                          {teams.find(t => t.id === selectedTeamId)?.team_name || 'غير محدد'}
                        </p>
                        <p className="text-sm text-green-600">الفريق المسؤول</p>
                      </div>
                    </div>
                  </Card>
                </div>

                <Separator className="my-3" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-base font-medium">اختر فريق الإزالة</Label>
                    <Select value={selectedTeamId || 'auto'} onValueChange={(v) => setSelectedTeamId(v === 'auto' ? '' : v)}>
                      <SelectTrigger className="h-11">
                        <SelectValue placeholder="تحديد تلقائي حسب المقاس والمدينة" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="auto">تحديد تلقائي حسب المقاس والمدينة</SelectItem>
                        {teams.filter(team => team.id && team.id.trim() !== '').map(team => (
                          <SelectItem key={team.id} value={team.id} className="py-2.5">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              {team.team_name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="text-base font-medium">ملاحظات (اختياري)</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="أضف أي ملاحظات للفريق..."
                      className="min-h-[80px] resize-none"
                    />
                  </div>
                </div>

                {/* Selected Billboards Preview */}
                <div className="mt-4 flex-1">
                  <Label className="text-base font-medium mb-2 block">اللوحات المختارة:</Label>
                  <ScrollArea className="h-[180px] border rounded-lg p-3">
                    <div className="flex flex-wrap gap-1.5">
                      {Array.from(selectedBillboards).map(billboardId => {
                        const billboard = allBillboards.find(b => b.ID === billboardId);
                        return (
                          <Badge 
                            key={billboardId} 
                            variant="secondary" 
                            className="text-xs py-1 px-2 cursor-pointer hover:bg-muted gap-1 transition-colors"
                            onClick={() => toggleBillboard(billboardId)}
                          >
                            #{billboardId}
                            {billboard?.Nearest_Landmark && (
                              <span className="text-muted-foreground">• {billboard.Nearest_Landmark.slice(0, 15)}</span>
                            )}
                            <X className="h-2.5 w-2.5 opacity-50" />
                          </Badge>
                        );
                      })}
                    </div>
                  </ScrollArea>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Fixed Bottom Selection Bar */}
        <AnimatePresence>
          {currentStep === 1 && selectedBillboards.size > 0 && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50"
            >
              <div className="bg-gradient-to-r from-orange-600 to-amber-600 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4">
                <Badge variant="secondary" className="bg-white text-orange-600 text-lg px-4 py-1">
                  {selectedBillboards.size} لوحة محددة
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/20"
                  onClick={selectAllFiltered}
                >
                  <Layers className="h-4 w-4 ml-1" />
                  {selectedBillboards.size === filteredBillboards.length ? 'إلغاء الكل' : 'تحديد الكل'}
                </Button>
                <Button
                  size="sm"
                  className="bg-white text-orange-600 hover:bg-white/90"
                  onClick={() => setCurrentStep(2)}
                >
                  التالي
                  <ArrowLeft className="h-4 w-4 mr-1" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer with Navigation */}
        <DialogFooter className="p-4 border-t bg-muted/30">
          <div className="flex items-center justify-between w-full">
            <Button 
              variant="outline" 
              onClick={() => {
                if (currentStep === 1) {
                  onOpenChange(false);
                } else {
                  setCurrentStep(1);
                }
              }}
              className="gap-2"
            >
              {currentStep === 1 ? (
                <>إلغاء</>
              ) : (
                <>
                  <ArrowRight className="h-4 w-4" />
                  السابق
                </>
              )}
            </Button>

            {currentStep === 1 ? (
              <Button
                onClick={() => setCurrentStep(2)}
                disabled={!canProceedToStep2}
                className="gap-2 bg-orange-600 hover:bg-orange-700 min-w-[160px]"
              >
                التالي
                <ArrowLeft className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                onClick={() => createTaskMutation.mutate()}
                disabled={createTaskMutation.isPending || !canSubmit}
                className="gap-2 bg-green-600 hover:bg-green-700 min-w-[200px]"
              >
                {createTaskMutation.isPending ? (
                  <>
                    <RefreshCw className="h-5 w-5 animate-spin" />
                    جاري الإنشاء...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="h-5 w-5" />
                    إنشاء المهمة ({selectedBillboards.size} لوحة)
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
