import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { Users, Search, X } from 'lucide-react';

interface UserCustomersDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string | null;
  userName: string | null;
  currentCustomers: string[] | null;
  onCustomersUpdated: () => void;
}

export function UserCustomersDialog({ 
  open, 
  onOpenChange, 
  userId, 
  userName, 
  currentCustomers,
  onCustomersUpdated 
}: UserCustomersDialogProps) {
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<string[]>([]);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);

  useEffect(() => {
    if (open) {
      loadCustomers();
      setSelectedCustomers(currentCustomers || []);
    }
  }, [open, currentCustomers]);

  const loadCustomers = async () => {
    setLoading(true);
    try {
      // Get unique customer names from contracts
      const { data: contractData, error: contractError } = await supabase
        .from('Contract')
        .select('"Customer Name"');

      if (contractError) throw contractError;

      // Get customers from customers table
      const { data: customersData, error: customersError } = await supabase
        .from('customers')
        .select('name');

      if (customersError) throw customersError;

      // Combine and deduplicate
      const contractCustomers = (contractData || [])
        .map((c: any) => c['Customer Name'])
        .filter(Boolean);
      
      const tableCustomers = (customersData || [])
        .map((c: any) => c.name)
        .filter(Boolean);

      const allCustomers = Array.from(new Set([...contractCustomers, ...tableCustomers]));
      allCustomers.sort((a, b) => a.localeCompare(b, 'ar'));
      
      setCustomers(allCustomers);
    } catch (error) {
      console.error('Error loading customers:', error);
      toast.error('فشل في تحميل العملاء');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    if (!userId) return;

    setSaving(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          allowed_clients: selectedCustomers.length > 0 ? selectedCustomers : null,
          updated_at: new Date().toISOString(),
        })
        .eq('id', userId);

      if (error) throw error;

      toast.success('تم حفظ العملاء المسموح بهم');
      onCustomersUpdated();
      onOpenChange(false);
    } catch (error: any) {
      console.error('Error saving customers:', error);
      toast.error(error.message || 'فشل في حفظ العملاء');
    } finally {
      setSaving(false);
    }
  };

  const toggleCustomer = (customer: string) => {
    setSelectedCustomers(prev =>
      prev.includes(customer)
        ? prev.filter(c => c !== customer)
        : [...prev, customer]
    );
  };

  const selectAll = () => {
    setSelectedCustomers(filteredCustomers);
  };

  const clearAll = () => {
    setSelectedCustomers([]);
  };

  const filteredCustomers = customers.filter(c =>
    c.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            ربط المستخدم بالعملاء
            {userName && <Badge variant="outline">{userName}</Badge>}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          <p className="text-sm text-muted-foreground">
            اختر العملاء الذين يمكن لهذا المستخدم الوصول إلى بياناتهم
          </p>

          {/* Selected customers */}
          {selectedCustomers.length > 0 && (
            <div className="flex flex-wrap gap-2 p-3 bg-muted/50 rounded-lg">
              {selectedCustomers.map(customer => (
                <Badge key={customer} variant="secondary" className="gap-1">
                  {customer}
                  <X 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => toggleCustomer(customer)}
                  />
                </Badge>
              ))}
            </div>
          )}

          {/* Search and actions */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="ابحث عن عميل..."
                className="pr-10"
              />
            </div>
            <Button variant="outline" size="sm" onClick={selectAll}>
              تحديد الكل
            </Button>
            <Button variant="outline" size="sm" onClick={clearAll}>
              إلغاء الكل
            </Button>
          </div>

          {/* Customers list */}
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : (
            <ScrollArea className="h-[300px] border rounded-lg">
              <div className="p-2 space-y-1">
                {filteredCustomers.length === 0 ? (
                  <p className="text-center text-muted-foreground py-4">
                    لا توجد نتائج
                  </p>
                ) : (
                  filteredCustomers.map(customer => (
                    <div
                      key={customer}
                      className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer hover:bg-muted/50 transition-colors ${
                        selectedCustomers.includes(customer) ? 'bg-primary/10' : ''
                      }`}
                      onClick={() => toggleCustomer(customer)}
                    >
                      <Checkbox
                        checked={selectedCustomers.includes(customer)}
                        onCheckedChange={() => toggleCustomer(customer)}
                      />
                      <span className="flex-1">{customer}</span>
                    </div>
                  ))
                )}
              </div>
            </ScrollArea>
          )}

          {/* Footer */}
          <div className="flex items-center justify-between pt-4 border-t">
            <div className="text-sm text-muted-foreground">
              العملاء المحددين: <Badge>{selectedCustomers.length}</Badge>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                إلغاء
              </Button>
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'جاري الحفظ...' : 'حفظ'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
