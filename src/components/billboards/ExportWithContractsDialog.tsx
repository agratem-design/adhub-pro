import React, { useState, useEffect, useMemo } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Download, Search, Clock, Plus, Minus, CalendarX } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { smartArabicMatch } from '@/lib/arabicSearch';

interface ExportWithContractsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onExport: (selectedContractIds: number[], hideEndDateContractIds?: number[]) => void;
  title?: string;
  description?: string;
}

interface ContractOption {
  Contract_Number: number;
  customerName: string;
  billboardCount: number;
  endDate: string;
  daysRemaining: number;
}

export const ExportWithContractsDialog: React.FC<ExportWithContractsDialogProps> = ({
  open,
  onOpenChange,
  onExport,
  title = 'تصدير المتاح مع عقود محددة',
  description = 'اختر العقود التي تريد إضافة لوحاتها إلى ملف اللوحات المتاحة'
}) => {
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [selectedContracts, setSelectedContracts] = useState<number[]>([]);
  const [hideEndDateContracts, setHideEndDateContracts] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'expiring'>('all');
  const [showWithoutDate, setShowWithoutDate] = useState(false);

  // العقود بدون تاريخ انتهاء
  const contractsWithoutDate = useMemo(() => {
    return contracts.filter(c => !c.endDate);
  }, [contracts]);

  useEffect(() => {
    if (open) {
      loadContracts();
    }
  }, [open]);

  const loadContracts = async () => {
    setLoading(true);
    try {
      // جلب العقود
      const { data: contractsData, error: contractsError } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name", "End Date"')
        .order('Contract_Number', { ascending: false });

      if (contractsError) throw contractsError;

      // جلب عدد اللوحات لكل عقد من جدول اللوحات مباشرة
      const { data: billboardsData, error: billboardsError } = await supabase
        .from('billboards')
        .select('Contract_Number')
        .not('Contract_Number', 'is', null);

      if (billboardsError) throw billboardsError;

      // حساب عدد اللوحات لكل عقد
      const billboardCountMap: { [key: number]: number } = {};
      (billboardsData || []).forEach((b: any) => {
        const cn = b.Contract_Number;
        if (cn) {
          billboardCountMap[cn] = (billboardCountMap[cn] || 0) + 1;
        }
      });

      const today = new Date();
      const contractOptions: ContractOption[] = (contractsData || []).map((contract: any) => {
        const endDate = contract['End Date'] ? new Date(contract['End Date']) : null;
        const daysRemaining = endDate 
          ? Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
          : 9999;

        return {
          Contract_Number: contract.Contract_Number,
          customerName: contract['Customer Name'] || 'غير محدد',
          billboardCount: billboardCountMap[contract.Contract_Number] || 0,
          endDate: contract['End Date'] || '',
          daysRemaining
        };
      });

      setContracts(contractOptions);
    } catch (error) {
      console.error('Error loading contracts:', error);
      toast.error('فشل في تحميل العقود');
    } finally {
      setLoading(false);
    }
  };

  // العقود المنتهية خلال 3 أشهر (90 يوم) - استبعاد العقود بدون تاريخ
  const expiringContracts = useMemo(() => {
    return contracts.filter(c => c.endDate && c.daysRemaining >= 0 && c.daysRemaining <= 90);
  }, [contracts]);

  const displayedContracts = useMemo(() => {
    let list = activeTab === 'expiring' ? expiringContracts : contracts;
    // استبعاد العقود بدون تاريخ إذا لم يكن الخيار مفعل
    if (!showWithoutDate) {
      list = list.filter(c => c.endDate);
    }
    return list;
  }, [activeTab, expiringContracts, contracts, showWithoutDate]);

  const filteredContracts = displayedContracts.filter(contract => {
    return smartArabicMatch(
      [contract.Contract_Number, contract.customerName],
      searchQuery
    );
  });

  const toggleContract = (contractNumber: number) => {
    setSelectedContracts(prev => 
      prev.includes(contractNumber)
        ? prev.filter(id => id !== contractNumber)
        : [...prev, contractNumber]
    );
  };

  const toggleHideEndDate = (contractNumber: number) => {
    setHideEndDateContracts(prev => 
      prev.includes(contractNumber)
        ? prev.filter(id => id !== contractNumber)
        : [...prev, contractNumber]
    );
  };

  const selectAllExpiring = () => {
    const expiringIds = expiringContracts.map(c => c.Contract_Number);
    setSelectedContracts(prev => {
      const newSet = new Set([...prev, ...expiringIds]);
      return Array.from(newSet);
    });
  };

  const handleExport = () => {
    onExport(selectedContracts, hideEndDateContracts);
    onOpenChange(false);
    setSelectedContracts([]);
    setHideEndDateContracts([]);
  };

  const totalSelectedBillboards = contracts
    .filter(c => selectedContracts.includes(c.Contract_Number))
    .reduce((sum, c) => sum + c.billboardCount, 0);

  const getDaysRemainingBadge = (days: number, hasEndDate: boolean) => {
    if (!hasEndDate) return <Badge variant="secondary" className="bg-gray-500/20 text-gray-600 dark:text-gray-400">بدون تاريخ</Badge>;
    if (days < 0) return <Badge variant="destructive">منتهي</Badge>;
    if (days <= 30) return <Badge variant="destructive">{days} يوم</Badge>;
    if (days <= 60) return <Badge className="bg-orange-500">{days} يوم</Badge>;
    if (days <= 90) return <Badge className="bg-yellow-500 text-black">{days} يوم</Badge>;
    return <Badge variant="outline">{days} يوم</Badge>;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            {description}
          </p>

          {/* Tabs for filtering */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'all' | 'expiring')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="all">جميع العقود ({contracts.length})</TabsTrigger>
              <TabsTrigger value="expiring" className="gap-1">
                <Clock className="h-4 w-4" />
                تنتهي خلال 3 أشهر ({expiringContracts.length})
              </TabsTrigger>
            </TabsList>
          </Tabs>


          {/* Search */}
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث برقم العقد أو اسم العميل..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
            />
          </div>

          {/* Quick actions for expiring */}
          {activeTab === 'expiring' && expiringContracts.length > 0 && (
            <Button variant="outline" size="sm" onClick={selectAllExpiring} className="w-full">
              اختيار جميع العقود المنتهية خلال 3 أشهر ({expiringContracts.length} عقد)
            </Button>
          )}

          {/* Selected summary */}
          {selectedContracts.length > 0 && (
            <div className="p-3 bg-green-50 dark:bg-green-950/30 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex justify-between items-center">
                <span className="text-sm font-medium text-green-800 dark:text-green-300">
                  تم اختيار {selectedContracts.length} عقد ({totalSelectedBillboards} لوحة)
                </span>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedContracts([])}
                  className="text-green-700 hover:text-green-800"
                >
                  إلغاء الكل
                </Button>
              </div>
            </div>
          )}

          {/* Contracts list */}
          <ScrollArea className="h-[300px] border rounded-lg">
            {loading ? (
              <div className="flex items-center justify-center h-full">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
              </div>
            ) : (
              <div className="p-2 space-y-1">
                {filteredContracts.map(contract => {
                  const isSelected = selectedContracts.includes(contract.Contract_Number);
                  const isHideEndDate = hideEndDateContracts.includes(contract.Contract_Number);
                  return (
                    <div
                      key={contract.Contract_Number}
                      className={`p-3 rounded-lg transition-colors ${
                        isSelected
                          ? 'bg-primary/10 border border-primary/30'
                          : 'hover:bg-muted border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <Checkbox 
                          checked={isSelected}
                          onCheckedChange={() => toggleContract(contract.Contract_Number)}
                          className="shrink-0"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="font-mono">
                              #{contract.Contract_Number}
                            </Badge>
                            <span className="font-medium truncate">{contract.customerName}</span>
                            {getDaysRemainingBadge(contract.daysRemaining, !!contract.endDate)}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                            <span>{contract.billboardCount} لوحة</span>
                            {contract.endDate && (
                              <span>ينتهي: {new Date(contract.endDate).toLocaleDateString('ar-LY')}</span>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant={isSelected ? "destructive" : "default"}
                          onClick={() => toggleContract(contract.Contract_Number)}
                          className="shrink-0"
                        >
                          {isSelected ? (
                            <>
                              <Minus className="h-4 w-4 ml-1" />
                              إزالة
                            </>
                          ) : (
                            <>
                              <Plus className="h-4 w-4 ml-1" />
                              جلب اللوحات
                            </>
                          )}
                        </Button>
                      </div>
                      {/* خيار إخفاء تاريخ الانتهاء - يظهر فقط عند تحديد العقد */}
                      {isSelected && (
                        <div className="flex items-center gap-2 mt-2 mr-7 p-2 bg-orange-50 dark:bg-orange-950/30 rounded border border-orange-200 dark:border-orange-800">
                          <Checkbox 
                            id={`hideDate-${contract.Contract_Number}`}
                            checked={isHideEndDate}
                            onCheckedChange={() => toggleHideEndDate(contract.Contract_Number)}
                          />
                          <Label 
                            htmlFor={`hideDate-${contract.Contract_Number}`} 
                            className="text-xs flex items-center gap-1 cursor-pointer text-orange-700 dark:text-orange-400"
                          >
                            <CalendarX className="h-3 w-3" />
                            إظهار بدون تاريخ انتهاء
                          </Label>
                        </div>
                      )}
                    </div>
                  );
                })}
                {filteredContracts.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">
                    {activeTab === 'expiring' 
                      ? 'لا توجد عقود تنتهي خلال 3 أشهر'
                      : 'لا توجد عقود مطابقة للبحث'
                    }
                  </div>
                )}
              </div>
            )}
          </ScrollArea>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={handleExport} disabled={selectedContracts.length === 0}>
            <Download className="h-4 w-4 ml-2" />
            تصدير المتاح + {selectedContracts.length} عقد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
