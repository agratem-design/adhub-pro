import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { User, ChevronDown, Megaphone, Tag, Building2, Phone } from 'lucide-react';

interface CustomerInfoFormProps {
  customerName: string;
  setCustomerName: (name: string) => void;
  adType: string;
  setAdType: (type: string) => void;
  pricingCategory: string;
  setPricingCategory: (category: string) => void;
  pricingCategories: string[];
  customers: Array<{ id: string; name: string; company?: string; phone?: string }>;
  customerOpen: boolean;
  setCustomerOpen: (open: boolean) => void;
  customerQuery: string;
  setCustomerQuery: (query: string) => void;
  onAddCustomer: (name: string) => Promise<void>;
  onSelectCustomer: (customer: { id: string; name: string; company?: string; phone?: string }) => void;
  customerCompany?: string | null;
  customerPhone?: string | null;
}

export function CustomerInfoForm({
  customerName,
  setCustomerName,
  adType,
  setAdType,
  pricingCategory,
  setPricingCategory,
  pricingCategories,
  customers,
  customerOpen,
  setCustomerOpen,
  customerQuery,
  setCustomerQuery,
  onAddCustomer,
  onSelectCustomer,
  customerCompany,
  customerPhone
}: CustomerInfoFormProps) {
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState('');

  const filteredCategories = useMemo(() => {
    if (!categoryQuery) return pricingCategories;
    return pricingCategories.filter(c => 
      c.toLowerCase().includes(categoryQuery.toLowerCase())
    );
  }, [pricingCategories, categoryQuery]);

  return (
    <Card className="border-border shadow-lg overflow-hidden">
      <CardHeader className="py-3 px-4 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border">
        <CardTitle className="flex items-center gap-2 text-base">
          <div className="p-1.5 rounded-lg bg-primary/20">
            <User className="h-4 w-4 text-primary" />
          </div>
          معلومات العميل
        </CardTitle>
      </CardHeader>
      <CardContent className="p-4 space-y-3">
        {/* Customer Name */}
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">اسم العميل</label>
          <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
            <PopoverTrigger asChild>
              <Button 
                variant="outline" 
                role="combobox" 
                className="w-full justify-between h-10 bg-background border-2 border-border hover:border-primary/50"
              >
                <span className={customerName ? 'text-foreground' : 'text-muted-foreground'}>
                  {customerName || 'اختر العميل'}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)] bg-popover border-border z-[10000]">
              <Command>
                <CommandInput 
                  placeholder="ابحث أو أضف عميل جديد..." 
                  value={customerQuery} 
                  onValueChange={setCustomerQuery}
                  className="h-10"
                />
                <CommandList className="max-h-48">
                  <CommandEmpty>
                    <Button
                      variant="ghost"
                      className="w-full justify-start text-primary"
                      onClick={() => onAddCustomer(customerQuery.trim())}
                    >
                      + إضافة "{customerQuery}"
                    </Button>
                  </CommandEmpty>
                  <CommandGroup>
                    {(customers || []).map((c) => (
                      <CommandItem
                        key={c.id}
                        value={c.name}
                        onSelect={() => onSelectCustomer(c)}
                        className="cursor-pointer"
                      >
                        <div className="flex flex-col">
                          <span>{c.name}</span>
                          {c.company && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {c.company}
                            </span>
                          )}
                        </div>
                      </CommandItem>
                    ))}
                    {customerQuery && !(customers || []).some((x) => x.name === customerQuery.trim()) && (
                      <CommandItem
                        value={`__add_${customerQuery}`}
                        onSelect={() => onAddCustomer(customerQuery.trim())}
                        className="text-primary cursor-pointer"
                      >
                        + إضافة "{customerQuery}"
                      </CommandItem>
                    )}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>

        {/* Customer Company & Phone Display */}
        {(customerCompany || customerPhone) && (
          <div className="flex flex-wrap items-center gap-3 p-2 bg-muted/50 rounded-lg text-sm">
            {customerCompany && (
              <div className="flex items-center gap-1.5">
                <Building2 className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">الشركة:</span>
                <span className="font-medium">{customerCompany}</span>
              </div>
            )}
            {customerPhone && (
              <div className="flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span className="text-muted-foreground">الهاتف:</span>
                <span className="font-medium" dir="ltr">{customerPhone}</span>
              </div>
            )}
          </div>
        )}

        {/* Ad Type & Category - Side by Side */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Megaphone className="h-3 w-3" />
              نوع الإعلان
            </label>
            <Input 
              value={adType} 
              onChange={(e) => setAdType(e.target.value)}
              placeholder="مثال: مواد صحية"
              className="h-9 text-sm bg-background border-border"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
              <Tag className="h-3 w-3" />
              فئة السعر
            </label>
            <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
              <PopoverTrigger asChild>
                <Button 
                  variant="outline" 
                  role="combobox" 
                  className="w-full justify-between h-9 text-sm bg-background border-border"
                >
                  <span className={pricingCategory ? 'text-foreground' : 'text-muted-foreground'}>
                    {pricingCategory || 'اختر الفئة'}
                  </span>
                  <ChevronDown className="h-3 w-3 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="p-0 w-[var(--radix-popover-trigger-width)] bg-popover border-border z-[10000]">
                <Command>
                  <CommandInput 
                    placeholder="ابحث في الفئات..." 
                    value={categoryQuery} 
                    onValueChange={setCategoryQuery}
                    className="h-9"
                  />
                  <CommandList className="max-h-40">
                    <CommandEmpty>لا توجد فئة مطابقة</CommandEmpty>
                    <CommandGroup>
                      {filteredCategories.map((c) => (
                        <CommandItem
                          key={c}
                          value={c}
                          onSelect={() => {
                            setPricingCategory(c);
                            setCategoryOpen(false);
                            setCategoryQuery('');
                          }}
                          className="cursor-pointer"
                        >
                          {c}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
