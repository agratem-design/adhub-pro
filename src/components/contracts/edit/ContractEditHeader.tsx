import React from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer } from 'lucide-react';

interface ContractEditHeaderProps {
  contractNumber: string;
  onBack: () => void;
  onPrint: () => void;
  onSave: () => void;
  saving: boolean;
}

export function ContractEditHeader({
  contractNumber,
  onBack,
  onPrint,
  onSave,
  saving
}: ContractEditHeaderProps) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border bg-card px-4 py-3 lg:px-5">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground mb-1">
          تعديل عقد {contractNumber && `#${contractNumber}`}
        </h1>
        <p className="text-xs sm:text-sm text-muted-foreground">
          راجع التغييرات والأسعار والدفعات قبل حفظ العقد
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 [&_button]:min-h-10 [&_button]:cursor-pointer [&_button]:transition-all [&_button]:duration-200">
        <Button 
          variant="outline" 
          onClick={onBack}
          className="border-border hover:bg-accent"
          size="sm"
        >
          <ArrowLeft className="h-4 w-4 ml-2" />
          عودة
        </Button>
        <Button 
          variant="outline" 
          onClick={onPrint}
          className="border-border hover:bg-accent"
          size="sm"
        >
          <Printer className="h-4 w-4 ml-2" />
          طباعة العقد
        </Button>
        <Button 
          onClick={onSave} 
          disabled={saving}
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          size="sm"
        >
          {saving ? 'جاري الحفظ...' : 'حفظ التعديلات'}
        </Button>
      </div>
    </div>
  );
}
