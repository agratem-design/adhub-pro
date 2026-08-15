import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { supabase } from '@/integrations/supabase/client';

interface CustomerSelectorProps {
  customerName: string;
  customerId: string | null;
  onCustomerChange: (name: string, id: string | null) => void;
}

export const CustomerSelector: React.FC<CustomerSelectorProps> = ({
  customerName,
  customerId,
  onCustomerChange
}) => {
  const [customers, setCustomers] = useState<{ id: string; name: string }[]>([]);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [customerQuery, setCustomerQuery] = useState('');

  // Load customers
  useEffect(() => {
    (async () => {
      try {
        const { data, error } = await supabase
          .from('customers')
          .select('id,name')
          .order('name', { ascending: true });
        
        if (!error && Array.isArray(data)) {
          setCustomers(data);
        }
      } catch (e) {
        console.warn('load customers failed');
      }
    })();
  }, []);

  const handleAddCustomer = async (name: string) => {
    try {
      const { data: newC, error } = await supabase
        .from('customers')
        .insert({ name })
        .select()
        .single();
      
      if (!error && newC && newC.id) {
        onCustomerChange(name, newC.id);
        setCustomers((prev) => [{ id: newC.id, name }, ...prev]);
      }
    } catch (e) {
      console.warn(e);
    }
    setCustomerOpen(false);
    setCustomerQuery('');
  };

  return (
    <div>
      <label className="form-label">اسم الزبون</label>
      <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
        <PopoverTrigger asChild>
          <Button variant="outline" role="combobox" className="w-full justify-between">
            {customerName ? customerName : 'اختر أو اكتب اسم الزبون'}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="p-0">
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
                      onCustomerChange(c.name, c.id);
                      setCustomerOpen(false);
                      setCustomerQuery('');
                    }}
                  >
                    {c.name}
                  </CommandItem>
                ))}
                {customerQuery && !customers.some((x) => x.name === customerQuery.trim()) && (
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
  );
};