import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { History, ArrowLeftRight, Clock, User, RotateCcw } from 'lucide-react';
import { getContractHistory, ContractHistoryRecord, restoreContractSnapshot } from '@/services/contractHistoryService';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ScrollArea } from '@/components/ui/scroll-area';

interface ContractHistoryTabProps {
  contractNumber: number;
  onRestore: () => void;
}

export function ContractHistoryTab({ contractNumber, onRestore }: ContractHistoryTabProps) {
  const [diffDialog, setDiffDialog] = useState<{ open: boolean; record: ContractHistoryRecord | null }>({
    open: false,
    record: null
  });

  const { data: history = [], isLoading, refetch } = useQuery({
    queryKey: ['contract-history', contractNumber],
    queryFn: () => getContractHistory(contractNumber)
  });

  const handleRestore = async (record: ContractHistoryRecord) => {
    if (!confirm('هل أنت متأكد من استرجاع حالة العقد لهذه النسخة؟ سيتم استرجاع أسعار العقد واللوحات لحالتها في هذا التاريخ.')) return;
    
    try {
      await restoreContractSnapshot(record.snapshot, contractNumber);
      toast.success('تم استرجاع حالة العقد بنجاح');
      refetch();
      onRestore();
    } catch (error: any) {
      console.error('Error restoring snapshot:', error);
      toast.error('حدث خطأ أثناء الاسترجاع: ' + error.message);
    }
  };

  if (isLoading) return <div className="p-8 text-center text-muted-foreground">جاري تحميل السجل...</div>;

  if (history.length === 0) return (
    <div className="p-8 text-center flex flex-col items-center justify-center text-muted-foreground bg-slate-50/50 rounded-xl border border-dashed">
      <History className="w-12 h-12 mb-4 opacity-20" />
      <p>لا توجد تعديلات مسجلة لهذا العقد بعد</p>
    </div>
  );

  return (
    <div className="space-y-4 relative">
      <div className="absolute top-0 bottom-0 right-4 w-px bg-border/50 z-0"></div>
      
      {history.map((record, index) => {
        const date = new Date(record.created_at);
        const actionLabel = getActionLabel(record.action);
        
        return (
          <div key={record.id} className="relative z-10 pl-8 pr-12 group transition-all">
            <div className="absolute right-2.5 top-1.5 w-3 h-3 rounded-full bg-primary/20 ring-4 ring-background border border-primary"></div>
            
            <div className="bg-card border shadow-sm rounded-lg p-4 transition-all hover:shadow-md hover:border-primary/30">
              <div className="flex justify-between items-start mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold text-primary">{actionLabel}</span>
                  {record.change_summary && (
                    <span className="text-sm text-muted-foreground px-2 bg-muted rounded-md">{record.change_summary}</span>
                  )}
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {format(date, 'yyyy-MM-dd HH:mm')}
                  </span>
                </div>
              </div>
              
              <div className="flex justify-end gap-2 mt-4 pt-4 border-t opacity-0 group-hover:opacity-100 transition-opacity">
                <Button variant="outline" size="sm" onClick={() => setDiffDialog({ open: true, record })}>
                  <ArrowLeftRight className="w-4 h-4 ml-1" />
                  عرض التفاصيل
                </Button>
                {index !== 0 && (
                  <Button variant="default" size="sm" onClick={() => handleRestore(record)}>
                    <RotateCcw className="w-4 h-4 ml-1" />
                    استرجاع هذه الحالة
                  </Button>
                )}
              </div>
            </div>
          </div>
        );
      })}

      <Dialog open={diffDialog.open} onOpenChange={(open) => setDiffDialog(prev => ({ ...prev, open }))}>
        <DialogContent className="max-w-2xl max-h-[80vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>تفاصيل النسخة</DialogTitle>
            <DialogDescription>
              نسخة العقد بتاريخ {diffDialog.record && format(new Date(diffDialog.record.created_at), 'yyyy-MM-dd HH:mm')}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 border rounded-md p-4 bg-slate-50">
            <pre className="text-left text-xs font-mono whitespace-pre-wrap direction-ltr" style={{ direction: 'ltr' }}>
              {JSON.stringify(diffDialog.record?.snapshot, null, 2)}
            </pre>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDiffDialog(prev => ({ ...prev, open: false }))}>إغلاق</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function getActionLabel(action: string) {
  switch(action) {
    case 'INSERT': return 'إنشاء العقد';
    case 'UPDATE': return 'تحديث العقد';
    case 'RESTORE': return 'استرجاع نسخة';
    default: return action;
  }
}
