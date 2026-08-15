import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { Loader2, FileText } from 'lucide-react';

interface QuickContractDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface Customer {
  id: string;
  name: string;
}

export function QuickContractDialog({ open, onOpenChange }: QuickContractDialogProps) {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [nextContractNumber, setNextContractNumber] = useState<string>('');
  
  const [customerName, setCustomerName] = useState('');
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');
  const [adType, setAdType] = useState('');
  const [durationMonths, setDurationMonths] = useState(3);
  const [startDate, setStartDate] = useState(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });

  // Load customers and next contract number
  useEffect(() => {
    if (open) {
      loadCustomers();
      loadNextContractNumber();
    }
  }, [open]);

  const loadCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .order('name', { ascending: true });
      
      if (error) throw error;
      setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast.error('فشل تحميل قائمة العملاء');
    } finally {
      setLoadingCustomers(false);
    }
  };

  const loadNextContractNumber = async () => {
    try {
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number')
        .order('Contract_Number', { ascending: false })
        .limit(1);

      if (!error && data && data.length > 0) {
        const lastNumber = parseInt(String(data[0].Contract_Number)) || 0;
        setNextContractNumber(String(lastNumber + 1));
      } else {
        setNextContractNumber('1');
      }
    } catch (e) {
      console.warn('Failed to get next contract number');
      setNextContractNumber('');
    }
  };

  const handleAddCustomer = async (name: string) => {
    try {
      const { data: newC, error } = await supabase
        .from('customers')
        .insert({ name })
        .select()
        .single();
      
      if (!error && newC && newC.id) {
        setCustomerName(name);
        setCustomerId(newC.id);
        setCustomers((prev) => [{ id: newC.id, name }, ...prev]);
        toast.success('تم إضافة العميل بنجاح');
      }
    } catch (e) {
      console.warn(e);
      toast.error('فشل إضافة العميل');
    }
    setCustomerOpen(false);
    setCustomerQuery('');
  };

  const calculateEndDate = (start: string, months: number): string => {
    const d = new Date(start);
    d.setMonth(d.getMonth() + months);
    return d.toISOString().split('T')[0];
  };

  const handleSubmit = async () => {
    // Validation
    if (!customerName.trim()) {
      toast.error('يرجى إدخال اسم العميل');
      return;
    }
    
    if (!adType.trim()) {
      toast.error('يرجى إدخال نوع الإعلان');
      return;
    }

    if (!durationMonths || durationMonths <= 0) {
      toast.error('يرجى إدخال مدة صحيحة');
      return;
    }

    setLoading(true);
    try {
      // Calculate end date
      const endDate = calculateEndDate(startDate, durationMonths);

      // Create contract with minimal data
      const insertPayload: any = {
        'Customer Name': customerName,
        customer_id: customerId,
        'Ad Type': adType,
        'Contract Date': startDate,
        'End Date': endDate,
        Total: 0,
        'Total Rent': 0,
        Discount: 0,
        'Total Paid': '0',
        Remaining: '0',
        billboard_ids: null,
        billboards_count: 0,
        payment_status: 'unpaid',
        'Renewal Status': 'نشط'
      };

      const { data: contract, error } = await supabase
        .from('Contract')
        .insert(insertPayload)
        .select()
        .single();

      if (error) throw error;

      toast.success('تم إنشاء العقد بنجاح');
      
      // Close dialog
      onOpenChange(false);
      
      // Reset form
      setCustomerName('');
      setCustomerId(null);
      setCustomerQuery('');
      setAdType('');
      setDurationMonths(3);
      
      // Navigate to edit page with contract number
      navigate(`/admin/contracts/edit?contract=${contract.Contract_Number}`);
      
    } catch (error: any) {
      console.error('Error creating contract:', error);
      toast.error(error?.message || 'فشل إنشاء العقد');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between text-xl font-bold">
            <span>إنشاء عقد جديد</span>
            {nextContractNumber && (
              <span className="flex items-center gap-2 text-sm font-normal text-muted-foreground">
                <FileText className="h-4 w-4" />
                رقم العقد: <span className="font-bold text-primary">#{nextContractNumber}</span>
              </span>
            )}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          {/* Customer Selection - Smart Selector */}
          <div className="space-y-2">
            <Label htmlFor="customer">اسم العميل *</Label>
            <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  role="combobox" 
                  className="w-full justify-between"
                  disabled={loadingCustomers}
                >
                  {customerName ? customerName : 'اختر أو اكتب اسم العميل'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-full" align="start">
                <Command>
                  <CommandInput 
                    placeholder="ابحث أو اكتب اسم جديد" 
                    value={customerQuery} 
                    onValueChange={setCustomerQuery} 
                  />
                  <CommandList>
                    <CommandEmpty>
                      <Button
                        variant="ghost"
                        className="w-full justify-start"
                        onClick={() => customerQuery.trim() && handleAddCustomer(customerQuery.trim())}
                      >
                        إضافة "{customerQuery}" كعميل جديد
                      </Button>
                    </CommandEmpty>
                    <CommandGroup>
                      {customers.map((c) => (
                        <CommandItem
                          key={c.id}
                          value={c.name}
                          onSelect={() => {
                            setCustomerName(c.name);
                            setCustomerId(c.id);
                            setCustomerOpen(false);
                            setCustomerQuery('');
                          }}
                        >
                          {c.name}
                        </CommandItem>
                      ))}
                      {customerQuery && !customers.some((x) => x.name.toLowerCase() === customerQuery.trim().toLowerCase()) && (
                        <CommandItem
                          value={`__add_${customerQuery}`}
                          onSelect={() => handleAddCustomer(customerQuery.trim())}
                        >
                          إضافة "{customerQuery}" كعميل جديد
                        </CommandItem>
                      )}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>

          {/* Ad Type */}
          <div className="space-y-2">
            <Label htmlFor="adType">نوع الإعلان *</Label>
            <Input
              id="adType"
              value={adType}
              onChange={(e) => setAdType(e.target.value)}
              placeholder="مثال: إعلان تجاري"
            />
          </div>

          {/* Start Date */}
          <div className="space-y-2">
            <Label htmlFor="startDate">تاريخ البداية</Label>
            <Input
              id="startDate"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {/* Duration */}
          <div className="space-y-2">
            <Label htmlFor="duration">المدة (بالأشهر) *</Label>
            <Select
              value={String(durationMonths)}
              onValueChange={(value) => setDurationMonths(Number(value))}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1">شهر واحد</SelectItem>
                <SelectItem value="2">شهرين</SelectItem>
                <SelectItem value="3">3 أشهر</SelectItem>
                <SelectItem value="6">6 أشهر</SelectItem>
                <SelectItem value="12">سنة</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-sm text-muted-foreground">
              تاريخ النهاية: {calculateEndDate(startDate, durationMonths)}
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={loading}
          >
            إلغاء
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
            إنشاء والانتقال للتعديل
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
