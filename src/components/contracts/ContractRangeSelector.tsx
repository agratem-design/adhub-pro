import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { Calendar, Hash, Filter, CheckSquare } from 'lucide-react';
import { Contract } from '@/services/contractService';

interface ContractRangeSelectorProps {
  contracts: Contract[];
  onSelectRange: (contractIds: Set<string | number>) => void;
}

export const ContractRangeSelector = ({
  contracts,
  onSelectRange
}: ContractRangeSelectorProps) => {
  const [open, setOpen] = useState(false);
  const [fromNumber, setFromNumber] = useState('');
  const [toNumber, setToNumber] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [sameCustomerOnly, setSameCustomerOnly] = useState(false);

  const handleSelectByNumber = () => {
    const from = Number(fromNumber);
    const to = Number(toNumber);
    
    if (!from || !to) return;
    
    const selectedIds = new Set<string | number>();
    let firstCustomerName: string | null = null;
    
    // Sort contracts by number to get the first one in range
    const sortedContracts = [...contracts].sort((a, b) => {
      const aNum = Number((a as any).Contract_Number || a.id);
      const bNum = Number((b as any).Contract_Number || b.id);
      return aNum - bNum;
    });
    
    sortedContracts.forEach(c => {
      const contractNumber = Number((c as any).Contract_Number || c.id);
      const customerName = c.customer_name || '';
      
      if (contractNumber >= from && contractNumber <= to) {
        if (sameCustomerOnly) {
          if (firstCustomerName === null) {
            firstCustomerName = customerName;
          }
          if (customerName === firstCustomerName) {
            selectedIds.add(c.id);
          }
        } else {
          selectedIds.add(c.id);
        }
      }
    });
    
    onSelectRange(selectedIds);
    setOpen(false);
    setFromNumber('');
    setToNumber('');
  };

  const handleSelectByDate = () => {
    if (!fromDate || !toDate) return;
    
    const fromDateTime = new Date(fromDate).getTime();
    const toDateTime = new Date(toDate).getTime();
    
    const selectedIds = new Set<string | number>();
    let firstCustomerName: string | null = null;
    
    // Sort contracts by date to get the first one in range
    const sortedContracts = [...contracts].sort((a, b) => {
      const aDate = a.start_date ? new Date(a.start_date).getTime() : 0;
      const bDate = b.start_date ? new Date(b.start_date).getTime() : 0;
      return aDate - bDate;
    });
    
    sortedContracts.forEach(c => {
      const contractDate = c.start_date ? new Date(c.start_date).getTime() : 0;
      const customerName = c.customer_name || '';
      
      if (contractDate >= fromDateTime && contractDate <= toDateTime) {
        if (sameCustomerOnly) {
          if (firstCustomerName === null) {
            firstCustomerName = customerName;
          }
          if (customerName === firstCustomerName) {
            selectedIds.add(c.id);
          }
        } else {
          selectedIds.add(c.id);
        }
      }
    });
    
    onSelectRange(selectedIds);
    setOpen(false);
    setFromDate('');
    setToDate('');
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-4 w-4" />
          تحديد نطاق
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80" align="start" dir="rtl">
        <Tabs defaultValue="number" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="number" className="gap-1">
              <Hash className="h-3 w-3" />
              برقم العقد
            </TabsTrigger>
            <TabsTrigger value="date" className="gap-1">
              <Calendar className="h-3 w-3" />
              بالتاريخ
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="number" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">من رقم</Label>
                <Input
                  type="number"
                  value={fromNumber}
                  onChange={(e) => setFromNumber(e.target.value)}
                  placeholder="مثال: 100"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">إلى رقم</Label>
                <Input
                  type="number"
                  value={toNumber}
                  onChange={(e) => setToNumber(e.target.value)}
                  placeholder="مثال: 150"
                />
              </div>
            </div>
            <Button 
              onClick={handleSelectByNumber} 
              className="w-full gap-2"
              disabled={!fromNumber || !toNumber}
            >
              <CheckSquare className="h-4 w-4" />
              تحديد العقود
            </Button>
          </TabsContent>
          
          <TabsContent value="date" className="space-y-4 mt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">من تاريخ</Label>
                <Input
                  type="date"
                  value={fromDate}
                  onChange={(e) => setFromDate(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">إلى تاريخ</Label>
                <Input
                  type="date"
                  value={toDate}
                  onChange={(e) => setToDate(e.target.value)}
                />
              </div>
            </div>
            <Button 
              onClick={handleSelectByDate} 
              className="w-full gap-2"
              disabled={!fromDate || !toDate}
            >
              <CheckSquare className="h-4 w-4" />
              تحديد العقود
            </Button>
          </TabsContent>
        </Tabs>
        
        <div className="flex items-center gap-2 mt-4 pt-4 border-t">
          <Checkbox 
            id="sameCustomer" 
            checked={sameCustomerOnly}
            onCheckedChange={(checked) => setSameCustomerOnly(checked === true)}
          />
          <Label htmlFor="sameCustomer" className="text-sm cursor-pointer">
            نفس الزبون فقط
          </Label>
        </div>
      </PopoverContent>
    </Popover>
  );
};
