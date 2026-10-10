import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Building2, ChevronDown, Megaphone, Phone, Plus, Tag, User } from 'lucide-react';
import { EditSection, Field } from './ui';

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
  customerName, adType, setAdType, pricingCategory, setPricingCategory, pricingCategories, customers,
  customerOpen, setCustomerOpen, customerQuery, setCustomerQuery, onAddCustomer, onSelectCustomer,
  customerCompany, customerPhone,
}: CustomerInfoFormProps) {
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [categoryQuery, setCategoryQuery] = useState('');
  const filteredCategories = useMemo(
    () => (!categoryQuery ? pricingCategories : pricingCategories.filter(c => c.toLowerCase().includes(categoryQuery.toLowerCase()))),
    [pricingCategories, categoryQuery],
  );
  const trimmedQuery = customerQuery.trim();
  const canAdd = Boolean(trimmedQuery) && !(customers || []).some(x => x.name === trimmedQuery);

  return (
    <EditSection icon={User} title="الزبون والإعلان" description="الزبون، نوع الإعلان، والفئة السعرية المعتمدة للأسعار">
      <Field label="الزبون" icon={User}>
        <Popover open={customerOpen} onOpenChange={setCustomerOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" role="combobox" className="h-10 w-full justify-between font-medium">
              <span className={customerName ? 'text-foreground' : 'text-muted-foreground'}>{customerName || 'اختر الزبون'}</span>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </Button>
          </PopoverTrigger>
          <PopoverContent className="z-[10000] w-[var(--radix-popover-trigger-width)] p-0">
            <Command>
              <CommandInput placeholder="ابحث أو أضف زبوناً جديداً..." value={customerQuery} onValueChange={setCustomerQuery} className="h-10" />
              <CommandList className="max-h-56">
                <CommandEmpty>
                  <Button variant="ghost" className="w-full justify-start gap-1.5 text-primary" onClick={() => onAddCustomer(trimmedQuery)}>
                    <Plus className="h-4 w-4" />إضافة «{customerQuery}»
                  </Button>
                </CommandEmpty>
                <CommandGroup>
                  {(customers || []).map(c => (
                    <CommandItem key={c.id} value={c.name} onSelect={() => onSelectCustomer(c)} className="cursor-pointer">
                      <div className="flex flex-col">
                        <span>{c.name}</span>
                        {c.company && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Building2 className="h-3 w-3" />{c.company}</span>}
                      </div>
                    </CommandItem>
                  ))}
                  {canAdd && (
                    <CommandItem value={`__add_${customerQuery}`} onSelect={() => onAddCustomer(trimmedQuery)} className="cursor-pointer gap-1.5 text-primary">
                      <Plus className="h-4 w-4" />إضافة «{customerQuery}»
                    </CommandItem>
                  )}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </Field>

      {(customerCompany || customerPhone) && (
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-muted/40 px-3 py-2 text-xs">
          {customerCompany && (
            <div className="min-w-0"><span className="flex items-center gap-1 text-muted-foreground"><Building2 className="h-3.5 w-3.5" />الشركة</span><p className="truncate font-semibold">{customerCompany}</p></div>
          )}
          {customerPhone && (
            <div className="min-w-0"><span className="flex items-center gap-1 text-muted-foreground"><Phone className="h-3.5 w-3.5" />الهاتف</span><p className="font-semibold" dir="ltr">{customerPhone}</p></div>
          )}
        </div>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="نوع الإعلان" icon={Megaphone}>
          <Input value={adType} onChange={e => setAdType(e.target.value)} placeholder="مثال: مواد صحية" className="h-10" />
        </Field>
        <Field label="الفئة السعرية" icon={Tag}>
          <Popover open={categoryOpen} onOpenChange={setCategoryOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="h-10 w-full justify-between font-medium">
                <span className={pricingCategory ? 'text-foreground' : 'text-muted-foreground'}>{pricingCategory || 'اختر الفئة'}</span>
                <ChevronDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="z-[10000] w-[var(--radix-popover-trigger-width)] p-0">
              <Command>
                <CommandInput placeholder="ابحث في الفئات..." value={categoryQuery} onValueChange={setCategoryQuery} className="h-9" />
                <CommandList className="max-h-44">
                  <CommandEmpty>لا توجد فئة مطابقة</CommandEmpty>
                  <CommandGroup>
                    {filteredCategories.map(c => (
                      <CommandItem key={c} value={c} className="cursor-pointer"
                        onSelect={() => { setPricingCategory(c); setCategoryOpen(false); setCategoryQuery(''); }}>
                        {c}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </Field>
      </div>
    </EditSection>
  );
}
