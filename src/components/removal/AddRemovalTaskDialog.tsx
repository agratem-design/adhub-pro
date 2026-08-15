import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Card } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { toast } from 'sonner';
import { format, subDays, differenceInDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Building2,
  MapPin,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  FileText,
  Plus,
  ArrowLeft,
  ArrowRight,
  Users,
  Calendar,
  Layers,
  AlertTriangle,
  Image,
  Check,
  X
} from 'lucide-react';

interface AddRemovalTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  teams: any[];
  existingTaskBillboardIds: Set<number>;
}

export function AddRemovalTaskDialog({ 
  open, 
  onOpenChange, 
  teams,
  existingTaskBillboardIds
}: AddRemovalTaskDialogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContracts, setSelectedContracts] = useState<Set<number>>(new Set());
  const [selectedBillboards, setSelectedBillboards] = useState<Set<number>>(new Set());
  const [selectedTeamId, setSelectedTeamId] = useState<string>('');
  const [notes, setNotes] = useState('');
  const [currentStep, setCurrentStep] = useState<1 | 2 | 3>(1);
  
  const queryClient = useQueryClient();

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setSearchTerm('');
      setSelectedContracts(new Set());
      setSelectedBillboards(new Set());
      setSelectedTeamId(teams.length > 0 ? teams[0].id : '');
      setNotes('');
      setCurrentStep(1);
    }
  }, [open, teams]);

  // جلب العقود المنتهية - مرتبة من الأحدث
  const { data: expiredContracts = [], isLoading: contractsLoading } = useQuery({
    queryKey: ['expired-contracts-dialog', open],
    enabled: open,
    queryFn: async () => {
      const today = new Date();
      const sixMonthsAgo = subDays(today, 180);
      
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "Ad Type", "End Date", billboard_ids, "Contract Date"')
        .lte('End Date', today.toISOString())
        .gte('End Date', sixMonthsAgo.toISOString())
        .order('"End Date"', { ascending: false })
        .limit(500);
      
      if (error) throw error;
      return data || [];
    }
  });

  // جلب اللوحات المتاحة عند اختيار العقود (مع استثناء اللوحات المؤجرة حالياً)
  const { data: availableBillboards = [], isLoading: billboardsLoading } = useQuery({
    queryKey: ['available-billboards-dialog', Array.from(selectedContracts).join(',')],
    enabled: selectedContracts.size > 0,
    queryFn: async () => {
      const today = new Date();
      const todayStr = today.toISOString().split('T')[0];
      today.setHours(0, 0, 0, 0);
      
      const allBillboardIds: number[] = [];
      for (const contractNumber of selectedContracts) {
        const contract = expiredContracts.find(c => c.Contract_Number === contractNumber);
        if (contract?.billboard_ids) {
          const ids = contract.billboard_ids.split(',').map((id: string) => parseInt(id.trim())).filter(Boolean);
          allBillboardIds.push(...ids);
        }
      }
      
      if (allBillboardIds.length === 0) return [];
      
      // جلب جميع العقود النشطة (غير منتهية) للتحقق من اللوحات المؤجرة
      const { data: activeContracts } = await supabase
        .from('Contract')
        .select('billboard_ids')
        .gte('End Date', todayStr);
      
      // استخراج معرفات اللوحات المؤجرة حالياً
      const rentedBillboardIds = new Set<number>();
      (activeContracts || []).forEach(contract => {
        if (contract.billboard_ids) {
          const ids = contract.billboard_ids.split(',').map((id: string) => parseInt(id.trim())).filter(Boolean);
          ids.forEach((id: number) => rentedBillboardIds.add(id));
        }
      });
      
      const { data, error } = await supabase
        .from('billboards')
        .select('*')
        .in('ID', allBillboardIds);
      
      if (error) throw error;
      
      return (data || []).filter(b => {
        // استثناء اللوحات الموجودة في مهام إزالة
        if (existingTaskBillboardIds.has(b.ID)) return false;
        // استثناء اللوحات المؤجرة حالياً في عقود نشطة
        if (rentedBillboardIds.has(b.ID)) return false;
        // التحقق من انتهاء تاريخ الإيجار
        const rentEndDate = b.Rent_End_Date;
        if (!rentEndDate) return false;
        const endDate = new Date(rentEndDate);
        endDate.setHours(0, 0, 0, 0);
        return endDate < today;
      });
    }
  });

  // تحديد كل اللوحات تلقائياً عند الانتقال للخطوة 2
  useEffect(() => {
    if (currentStep === 2 && availableBillboards.length > 0 && selectedBillboards.size === 0) {
      setSelectedBillboards(new Set(availableBillboards.map(b => b.ID)));
    }
  }, [currentStep, availableBillboards, selectedBillboards.size]);

  // فلترة العقود
  const filteredContracts = useMemo(() => {
    if (!searchTerm.trim()) return expiredContracts;
    
    const search = searchTerm.toLowerCase();
    return expiredContracts.filter(c => 
      String(c.Contract_Number).includes(search) ||
      c['Customer Name']?.toLowerCase().includes(search) ||
      c['Ad Type']?.toLowerCase().includes(search)
    );
  }, [expiredContracts, searchTerm]);

  const toggleContract = (contractNumber: number) => {
    const newSet = new Set(selectedContracts);
    if (newSet.has(contractNumber)) {
      newSet.delete(contractNumber);
    } else {
      newSet.add(contractNumber);
    }
    setSelectedContracts(newSet);
    setSelectedBillboards(new Set());
  };

  const toggleBillboard = (billboardId: number) => {
    const newSet = new Set(selectedBillboards);
    if (newSet.has(billboardId)) {
      newSet.delete(billboardId);
    } else {
      newSet.add(billboardId);
    }
    setSelectedBillboards(newSet);
  };

  const selectAllBillboards = () => {
    if (selectedBillboards.size === availableBillboards.length) {
      setSelectedBillboards(new Set());
    } else {
      setSelectedBillboards(new Set(availableBillboards.map(b => b.ID)));
    }
  };

  const getDaysExpired = (endDate: string) => {
    return differenceInDays(new Date(), new Date(endDate));
  };

  const getExpiryBadge = (daysExpired: number) => {
    if (daysExpired <= 7) return { color: 'bg-yellow-500', text: 'منتهي حديثاً' };
    if (daysExpired <= 30) return { color: 'bg-orange-500', text: 'منتهي' };
    return { color: 'bg-red-500', text: 'متأخر جداً' };
  };

  // إنشاء مهمة الإزالة
  const createTaskMutation = useMutation({
    mutationFn: async () => {
      if (selectedContracts.size === 0) {
        throw new Error('يرجى اختيار عقد واحد على الأقل');
      }
      
      const billboardsToAdd = selectedBillboards.size > 0 
        ? Array.from(selectedBillboards)
        : availableBillboards.map(b => b.ID);
      
      if (billboardsToAdd.length === 0) {
        throw new Error('لا توجد لوحات متاحة للإضافة');
      }

      let teamId = selectedTeamId;
      if (!teamId && teams.length > 0) {
        teamId = teams[0].id;
      }

      const contractNumbers = Array.from(selectedContracts);
      const { data: task, error: taskError } = await supabase
        .from('removal_tasks')
        .insert({
          contract_id: contractNumbers[0],
          contract_ids: contractNumbers,
          team_id: teamId,
          status: 'pending'
        })
        .select()
        .single();

      if (taskError) throw taskError;

      for (const billboardId of billboardsToAdd) {
        const { data: installationItem } = await supabase
          .from('installation_task_items')
          .select('design_face_a, design_face_b, installed_image_url')
          .eq('billboard_id', billboardId)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        await supabase
          .from('removal_task_items')
          .insert({
            task_id: task.id,
            billboard_id: billboardId,
            status: 'pending',
            notes: notes || null,
            design_face_a: installationItem?.design_face_a || null,
            design_face_b: installationItem?.design_face_b || null,
            installed_image_url: installationItem?.installed_image_url || null
          });
      }
      
      return billboardsToAdd.length;
    },
    onSuccess: (count) => {
      toast.success(`تم إنشاء مهمة إزالة بنجاح (${count} لوحة)`);
      queryClient.invalidateQueries({ queryKey: ['removal-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['all-removal-task-items'] });
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error('فشل إنشاء المهمة: ' + error.message);
    }
  });

  const canProceedToStep2 = selectedContracts.size > 0;
  const canProceedToStep3 = selectedBillboards.size > 0;
  const canSubmit = selectedTeamId && selectedBillboards.size > 0;

  const steps = [
    { number: 1, title: 'اختيار العقود', icon: FileText },
    { number: 2, title: 'اختيار اللوحات', icon: MapPin },
    { number: 3, title: 'إعدادات المهمة', icon: Users },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col p-0">
        {/* Header with Steps */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 dark:from-red-800 dark:to-red-900 text-white p-6">
          <DialogHeader className="text-white">
            <DialogTitle className="flex items-center gap-3 text-xl text-white">
              <div className="p-2 bg-white/20 rounded-lg">
                <Plus className="h-6 w-6" />
              </div>
              إنشاء مهمة إزالة جديدة
            </DialogTitle>
          </DialogHeader>
          
          {/* Step Indicators */}
          <div className="flex items-center justify-center mt-6 gap-4">
            {steps.map((step, idx) => {
              const StepIcon = step.icon;
              const isActive = currentStep === step.number;
              const isCompleted = currentStep > step.number;
              
              return (
                <div key={step.number} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div 
                      className={`
                        w-12 h-12 rounded-full flex items-center justify-center transition-all
                        ${isActive ? 'bg-white text-red-600 scale-110 shadow-lg' : 
                          isCompleted ? 'bg-green-500 text-white' : 'bg-white/30 text-white'}
                      `}
                    >
                      {isCompleted ? <Check className="h-5 w-5" /> : <StepIcon className="h-5 w-5" />}
                    </div>
                    <span className={`text-xs mt-2 ${isActive ? 'font-bold' : 'opacity-80'}`}>
                      {step.title}
                    </span>
                  </div>
                  {idx < steps.length - 1 && (
                    <div className={`w-16 h-1 mx-2 mt-[-20px] rounded ${isCompleted ? 'bg-green-500' : 'bg-white/30'}`} />
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden p-6">
          <AnimatePresence mode="wait">
            {/* Step 1: اختيار العقود */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="h-full flex flex-col"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">اختر العقود المنتهية</h3>
                    <p className="text-sm text-muted-foreground">
                      يعرض آخر 6 أشهر من العقود المنتهية مرتبة من الأحدث
                    </p>
                  </div>
                  <Badge variant="outline" className="text-lg px-4 py-2">
                    {selectedContracts.size} مختار
                  </Badge>
                </div>

                <div className="relative mb-4">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder="بحث برقم العقد أو اسم الزبون أو نوع الإعلان..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pr-12 text-lg h-12"
                  />
                  {searchTerm && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchTerm('')}
                      className="absolute left-2 top-1/2 -translate-y-1/2"
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </div>

                <ScrollArea className="flex-1 border rounded-xl">
                  <div className="p-3 space-y-2">
                    {contractsLoading ? (
                      <div className="text-center py-12">
                        <RefreshCw className="h-10 w-10 animate-spin mx-auto mb-3 text-red-500" />
                        <p className="text-muted-foreground">جاري تحميل العقود...</p>
                      </div>
                    ) : filteredContracts.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <AlertCircle className="h-12 w-12 mx-auto mb-3 opacity-50" />
                        <p className="text-lg">لا توجد عقود منتهية</p>
                        <p className="text-sm mt-1">جرب البحث بكلمات مختلفة</p>
                      </div>
                    ) : (
                      filteredContracts.map((contract) => {
                        const isSelected = selectedContracts.has(contract.Contract_Number);
                        const billboardCount = contract.billboard_ids?.split(',').filter(Boolean).length || 0;
                        const daysExpired = getDaysExpired(contract['End Date']);
                        const expiryInfo = getExpiryBadge(daysExpired);
                        
                        return (
                          <motion.div
                            key={contract.Contract_Number}
                            layout
                            whileHover={{ scale: 1.01 }}
                            whileTap={{ scale: 0.99 }}
                            className={`
                              flex items-center gap-4 p-4 rounded-xl border-2 transition-all cursor-pointer
                              ${isSelected 
                                ? 'bg-red-50 dark:bg-red-950/30 border-red-500 shadow-md' 
                                : 'bg-card hover:bg-accent/50 border-border hover:border-red-300'
                              }
                            `}
                            onClick={() => toggleContract(contract.Contract_Number)}
                          >
                            <div className={`
                              w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all
                              ${isSelected ? 'bg-red-500 border-red-500' : 'border-muted-foreground'}
                            `}>
                              {isSelected && <Check className="h-4 w-4 text-white" />}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-xl font-bold text-red-600 dark:text-red-400">
                                  #{contract.Contract_Number}
                                </span>
                                <Badge variant="outline" className="text-sm">
                                  {contract['Ad Type'] || 'غير محدد'}
                                </Badge>
                                <Badge className={`${expiryInfo.color} text-white`}>
                                  {expiryInfo.text} ({daysExpired} يوم)
                                </Badge>
                              </div>
                              <div className="flex items-center gap-4 mt-2 text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Building2 className="h-4 w-4" />
                                  {contract['Customer Name'] || 'زبون غير محدد'}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Layers className="h-4 w-4" />
                                  {billboardCount} لوحة
                                </span>
                              </div>
                            </div>
                            
                            <div className="text-left shrink-0">
                              <p className="text-sm font-medium flex items-center gap-1">
                                <Calendar className="h-4 w-4" />
                                انتهى: {format(new Date(contract['End Date']), 'dd MMM yyyy', { locale: ar })}
                              </p>
                            </div>
                          </motion.div>
                        );
                      })
                    )}
                  </div>
                </ScrollArea>
              </motion.div>
            )}

            {/* Step 2: اختيار اللوحات */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="h-full flex flex-col"
              >
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-lg font-semibold">اختر اللوحات للإزالة</h3>
                    <p className="text-sm text-muted-foreground">
                      من {selectedContracts.size} عقد مختار
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Button 
                      variant="outline" 
                      size="sm"
                      onClick={selectAllBillboards}
                    >
                      {selectedBillboards.size === availableBillboards.length ? 'إلغاء الكل' : 'تحديد الكل'}
                    </Button>
                    <Badge variant="outline" className="text-lg px-4 py-2">
                      {selectedBillboards.size} / {availableBillboards.length}
                    </Badge>
                  </div>
                </div>

                <ScrollArea className="flex-1 border rounded-xl">
                  <div className="p-3">
                    {billboardsLoading ? (
                      <div className="text-center py-12">
                        <RefreshCw className="h-10 w-10 animate-spin mx-auto mb-3 text-red-500" />
                        <p className="text-muted-foreground">جاري تحميل اللوحات...</p>
                      </div>
                    ) : availableBillboards.length === 0 ? (
                      <div className="text-center py-12 text-muted-foreground">
                        <AlertTriangle className="h-12 w-12 mx-auto mb-3 text-orange-500" />
                        <p className="text-lg">لا توجد لوحات متاحة للإزالة</p>
                        <p className="text-sm mt-1">قد تكون جميع اللوحات مضافة لمهام أخرى أو مؤجرة لعقود جديدة</p>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {availableBillboards.map((billboard) => {
                          const isSelected = selectedBillboards.has(billboard.ID);
                          
                          return (
                            <motion.div
                              key={billboard.ID}
                              layout
                              whileHover={{ scale: 1.01 }}
                              whileTap={{ scale: 0.99 }}
                              className={`
                                flex gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer
                                ${isSelected 
                                  ? 'bg-red-50 dark:bg-red-950/30 border-red-500' 
                                  : 'bg-card hover:bg-accent/50 border-border hover:border-red-300'
                                }
                              `}
                              onClick={() => toggleBillboard(billboard.ID)}
                            >
                              <div className={`
                                w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 mt-1
                                ${isSelected ? 'bg-red-500 border-red-500' : 'border-muted-foreground'}
                              `}>
                                {isSelected && <Check className="h-3 w-3 text-white" />}
                              </div>
                              
                              {billboard.Image_URL && (
                                <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 border">
                                  <img 
                                    src={billboard.Image_URL} 
                                    alt="" 
                                    className="w-full h-full object-cover"
                                    onError={(e) => (e.currentTarget.style.display = 'none')}
                                  />
                                </div>
                              )}
                              
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="font-bold text-red-600">#{billboard.ID}</span>
                                  <span className="text-sm truncate">{billboard.Billboard_Name || ''}</span>
                                </div>
                                <div className="text-xs text-muted-foreground mt-1 space-y-0.5">
                                  <p className="flex items-center gap-1">
                                    <MapPin className="h-3 w-3" />
                                    {billboard.Municipality} - {billboard.District}
                                  </p>
                                  <p>{billboard.Size} | {billboard.Faces_Count} وجه</p>
                                </div>
                              </div>
                              
                              <Badge variant="secondary" className="shrink-0 self-start">
                                عقد #{billboard.Contract_Number}
                              </Badge>
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </ScrollArea>
              </motion.div>
            )}

            {/* Step 3: إعدادات المهمة */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -50 }}
                className="h-full flex flex-col"
              >
                <div className="mb-6">
                  <h3 className="text-lg font-semibold">إعدادات المهمة</h3>
                  <p className="text-sm text-muted-foreground">
                    راجع التفاصيل واختر الفريق المسؤول
                  </p>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  <Card className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950/50 dark:to-blue-900/30 border-blue-200">
                    <div className="flex items-center gap-3">
                      <FileText className="h-8 w-8 text-blue-600" />
                      <div>
                        <p className="text-2xl font-bold text-blue-700">{selectedContracts.size}</p>
                        <p className="text-sm text-blue-600">عقد مختار</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/50 dark:to-red-900/30 border-red-200">
                    <div className="flex items-center gap-3">
                      <MapPin className="h-8 w-8 text-red-600" />
                      <div>
                        <p className="text-2xl font-bold text-red-700">{selectedBillboards.size}</p>
                        <p className="text-sm text-red-600">لوحة للإزالة</p>
                      </div>
                    </div>
                  </Card>
                  <Card className="p-4 bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950/50 dark:to-green-900/30 border-green-200">
                    <div className="flex items-center gap-3">
                      <Users className="h-8 w-8 text-green-600" />
                      <div>
                        <p className="text-2xl font-bold text-green-700">
                          {teams.find(t => t.id === selectedTeamId)?.team_name || '-'}
                        </p>
                        <p className="text-sm text-green-600">الفريق المسؤول</p>
                      </div>
                    </div>
                  </Card>
                </div>

                <Separator className="my-4" />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-3">
                    <Label className="text-base font-medium">اختر فريق التركيب</Label>
                    <Select value={selectedTeamId} onValueChange={setSelectedTeamId}>
                      <SelectTrigger className="h-12 text-lg">
                        <SelectValue placeholder="اختيار الفريق" />
                      </SelectTrigger>
                      <SelectContent>
                        {teams.filter(team => team.id && team.id.trim() !== '').map(team => (
                          <SelectItem key={team.id} value={team.id} className="text-base py-3">
                            <div className="flex items-center gap-2">
                              <Users className="h-4 w-4" />
                              {team.team_name}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-3">
                    <Label className="text-base font-medium">ملاحظات إضافية (اختياري)</Label>
                    <Textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="أضف أي ملاحظات للفريق..."
                      className="min-h-[100px] resize-none"
                    />
                  </div>
                </div>

                {/* Selected Contracts Preview */}
                <div className="mt-6">
                  <Label className="text-base font-medium mb-3 block">العقود المختارة:</Label>
                  <div className="flex flex-wrap gap-2">
                    {Array.from(selectedContracts).map(contractNum => {
                      const contract = expiredContracts.find(c => c.Contract_Number === contractNum);
                      return (
                        <Badge key={contractNum} variant="secondary" className="text-sm py-1.5 px-3">
                          #{contractNum} - {contract?.['Customer Name'] || 'غير محدد'}
                        </Badge>
                      );
                    })}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Fixed Bottom Selection Bar for Step 2 */}
        <AnimatePresence>
          {currentStep === 2 && selectedBillboards.size > 0 && (
            <motion.div
              initial={{ y: 100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 100, opacity: 0 }}
              className="fixed bottom-4 left-1/2 -translate-x-1/2 z-50"
            >
              <div className="bg-gradient-to-r from-red-600 to-red-700 text-white px-6 py-3 rounded-full shadow-2xl flex items-center gap-4">
                <Badge variant="secondary" className="bg-white text-red-600 text-lg px-4 py-1">
                  {selectedBillboards.size} لوحة محددة
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-white hover:bg-white/20"
                  onClick={selectAllBillboards}
                >
                  <Layers className="h-4 w-4 ml-1" />
                  {selectedBillboards.size === availableBillboards.length ? 'إلغاء الكل' : 'تحديد الكل'}
                </Button>
                <Button
                  size="sm"
                  className="bg-white text-red-600 hover:bg-white/90"
                  onClick={() => setCurrentStep(3)}
                >
                  التالي
                  <ArrowLeft className="h-4 w-4 mr-1" />
                </Button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Footer with Navigation */}
        <DialogFooter className="p-6 border-t bg-muted/30">
          <div className="flex items-center justify-between w-full">
            <Button 
              variant="outline" 
              onClick={() => {
                if (currentStep === 1) {
                  onOpenChange(false);
                } else {
                  setCurrentStep(prev => (prev - 1) as 1 | 2 | 3);
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

            {currentStep < 3 ? (
              <Button
                onClick={() => setCurrentStep(prev => (prev + 1) as 1 | 2 | 3)}
                disabled={
                  (currentStep === 1 && !canProceedToStep2) ||
                  (currentStep === 2 && !canProceedToStep3)
                }
                className="gap-2 bg-red-600 hover:bg-red-700"
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
