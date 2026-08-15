// @ts-nocheck
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';
import { Merge, AlertTriangle, Check } from 'lucide-react';

interface Customer {
  id: string;
  name: string;
  company?: string | null;
  phone?: string | null;
  email?: string | null;
  contracts_count: number;
  total_rent: string;
  created_at: string;
  updated_at: string;
}

interface DuplicateGroup {
  name: string;
  customers: Customer[];
  similarity: number;
}

export default function CustomerMerge() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [duplicateGroups, setDuplicateGroups] = useState<DuplicateGroup[]>([]);
  const [loading, setLoading] = useState(false);
  const [merging, setMerging] = useState(false);
  const [selectedGroup, setSelectedGroup] = useState<DuplicateGroup | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  // تحميل العملاء
  const loadCustomers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('customers')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        console.error('Error loading customers:', error);
        toast.error('خطأ في تحميل العملاء');
        return;
      }

      setCustomers(data || []);
      findDuplicates(data || []);
    } catch (error) {
      console.error('Load customers error:', error);
      toast.error('خطأ في تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  // البحث عن المكررات
  const findDuplicates = (customerList: Customer[]) => {
    const groups: DuplicateGroup[] = [];
    const processed = new Set<string>();

    for (let i = 0; i < customerList.length; i++) {
      const customer1 = customerList[i];
      if (processed.has(customer1.id)) continue;

      const duplicates = [customer1];
      processed.add(customer1.id);

      for (let j = i + 1; j < customerList.length; j++) {
        const customer2 = customerList[j];
        if (processed.has(customer2.id)) continue;

        const similarity = calculateSimilarity(customer1.name, customer2.name);
        
        // إذا كان التشابه عالي (أكثر من 80%) أو نفس الاسم تماماً
        if (similarity > 0.8 || customer1.name.trim().toLowerCase() === customer2.name.trim().toLowerCase()) {
          duplicates.push(customer2);
          processed.add(customer2.id);
        }
      }

      // إضافة المجموعة فقط إذا كان هناك أكثر من عميل واحد
      if (duplicates.length > 1) {
        groups.push({
          name: customer1.name,
          customers: duplicates.sort((a, b) => b.contracts_count - a.contracts_count), // ترتيب حسب عدد العقود
          similarity: 1.0
        });
      }
    }

    setDuplicateGroups(groups);
  };

  // حساب التشابه بين النصوص
  const calculateSimilarity = (str1: string, str2: string): number => {
    const s1 = str1.trim().toLowerCase();
    const s2 = str2.trim().toLowerCase();
    
    if (s1 === s2) return 1.0;
    
    // حساب التشابه باستخدام Levenshtein distance
    const matrix = [];
    const n = s1.length;
    const m = s2.length;

    if (n === 0) return m === 0 ? 1.0 : 0.0;
    if (m === 0) return 0.0;

    for (let i = 0; i <= n; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= m; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        if (s1.charAt(i - 1) === s2.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }

    const distance = matrix[n][m];
    const maxLength = Math.max(n, m);
    return (maxLength - distance) / maxLength;
  };

  // فحص القيود الفريدة قبل التحديث
  const checkUniqueConstraints = async (name: string, phone: string | null, excludeId: string) => {
    if (!phone) return true; // إذا لم يكن هناك هاتف، لا توجد مشكلة

    const { data, error } = await supabase
      .from('customers')
      .select('id')
      .eq('name', name)
      .eq('phone', phone)
      .neq('id', excludeId);

    if (error) {
      console.error('Error checking constraints:', error);
      return false;
    }

    return data.length === 0; // true إذا لم يوجد تعارض
  };

  // دمج العملاء
  const mergeCustomers = async (group: DuplicateGroup) => {
    try {
      setMerging(true);
      
      // اختيار العميل الرئيسي (الذي لديه أكبر عدد عقود أو معلومات أكثر)
      const mainCustomer = group.customers.reduce((best, current) => {
        // أولوية للعميل الذي لديه معلومات أكثر (شركة، هاتف)
        const bestScore = (best.company ? 1 : 0) + (best.phone ? 1 : 0) + best.contracts_count;
        const currentScore = (current.company ? 1 : 0) + (current.phone ? 1 : 0) + current.contracts_count;
        
        return currentScore > bestScore ? current : best;
      });

      console.log('Main customer selected:', mainCustomer);

      // جمع جميع المعلومات من العملاء المكررين مع تجنب التعارضات
      let bestCompany = mainCustomer.company;
      let bestPhone = mainCustomer.phone;
      let bestEmail = mainCustomer.email;

      // البحث عن أفضل معلومات من العملاء الآخرين
      for (const customer of group.customers) {
        if (customer.id !== mainCustomer.id) {
          if (!bestCompany && customer.company) {
            bestCompany = customer.company;
          }
          if (!bestEmail && customer.email) {
            bestEmail = customer.email;
          }
          // للهاتف، نتحقق من عدم وجود تعارض
          if (!bestPhone && customer.phone) {
            const isUnique = await checkUniqueConstraints(mainCustomer.name, customer.phone, mainCustomer.id);
            if (isUnique) {
              bestPhone = customer.phone;
            }
          }
        }
      }

      // إعداد البيانات المحدثة
      const mergedData = {
        company: bestCompany || null,
        email: bestEmail || null,
        updated_at: new Date().toISOString(),
      };

      // إضافة الهاتف فقط إذا كان لن يسبب تعارض
      if (bestPhone && bestPhone !== mainCustomer.phone) {
        const isPhoneUnique = await checkUniqueConstraints(mainCustomer.name, bestPhone, mainCustomer.id);
        if (isPhoneUnique) {
          mergedData.phone = bestPhone;
        }
      }

      console.log('Updating main customer:', mainCustomer.id, 'with data:', mergedData);

      // تحديث بيانات العميل الرئيسي
      const { data: updateData, error: updateError } = await supabase
        .from('customers')
        .update(mergedData)
        .eq('id', mainCustomer.id)
        .select();

      if (updateError) {
        console.error('Update error:', updateError);
        toast.error(`فشل في تحديث العميل الرئيسي: ${updateError.message}`);
        return;
      }

      console.log('Main customer updated successfully:', updateData);

      // نقل العقود والمدفوعات من العملاء المكررين إلى العميل الرئيسي
      const duplicateIds = group.customers.filter(c => c.id !== mainCustomer.id).map(c => c.id);
      let transferSuccess = true;

      for (const duplicateId of duplicateIds) {
        console.log(`Processing duplicate customer: ${duplicateId}`);
        
        // نقل العقود
        const { error: contractsError } = await supabase
          .from('Contract')
          .update({ customer_id: mainCustomer.id })
          .eq('customer_id', duplicateId);

        if (contractsError) {
          console.error('Error updating contracts:', contractsError);
          transferSuccess = false;
        } else {
          console.log(`Contracts transferred from ${duplicateId} to ${mainCustomer.id}`);
        }

        // نقل المدفوعات
        const { error: paymentsError } = await supabase
          .from('customer_payments')
          .update({ customer_id: mainCustomer.id })
          .eq('customer_id', duplicateId);

        if (paymentsError) {
          console.error('Error updating payments:', paymentsError);
          transferSuccess = false;
        } else {
          console.log(`Payments transferred from ${duplicateId} to ${mainCustomer.id}`);
        }

        // حذف العميل المكرر
        const { error: deleteError } = await supabase
          .from('customers')
          .delete()
          .eq('id', duplicateId);

        if (deleteError) {
          console.error('Error deleting duplicate customer:', deleteError);
          transferSuccess = false;
        } else {
          console.log(`Duplicate customer deleted: ${duplicateId}`);
        }
      }

      if (transferSuccess) {
        toast.success(`تم دمج ${group.customers.length} عملاء بنجاح`);
      } else {
        toast.info('تم الدمج مع بعض التحذيرات - تحقق من السجلات');
      }
      
      // إعادة تحميل البيانات
      await loadCustomers();
      setDialogOpen(false);
      setSelectedGroup(null);

    } catch (error) {
      console.error('Merge error:', error);
      toast.error(`خطأ في عملية الدمج: ${error instanceof Error ? error.message : 'خطأ غير معروف'}`);
    } finally {
      setMerging(false);
    }
  };

  useEffect(() => {
    loadCustomers();
  }, []);

  return (
    <div className="space-y-6">
      <Card className="bg-gradient-card border-0 shadow-card">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Merge className="h-5 w-5" />
            دمج العملاء المكررين
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between mb-4">
            <div className="text-sm text-muted-foreground">
              تم العثور على {duplicateGroups.length} مجموعة من العملاء المكررين
            </div>
            <Button onClick={loadCustomers} disabled={loading}>
              {loading ? 'جاري التحميل...' : 'إعادة فحص'}
            </Button>
          </div>

          {duplicateGroups.length === 0 ? (
            <div className="text-center py-8">
              <Check className="h-12 w-12 text-green-500 mx-auto mb-4" />
              <p className="text-lg font-medium text-green-600">ممتاز! لا توجد عملاء مكررين</p>
              <p className="text-sm text-muted-foreground">جميع العملاء فريدون في قاعدة البيانات</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>اسم العميل</TableHead>
                    <TableHead>عدد المكررات</TableHead>
                    <TableHead>إجمالي العقود</TableHead>
                    <TableHead>إجمالي الإيجار</TableHead>
                    <TableHead>إجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {duplicateGroups.map((group, index) => {
                    const totalContracts = group.customers.reduce((sum, c) => sum + c.contracts_count, 0);
                    const totalRent = group.customers.reduce((sum, c) => sum + (Number(c.total_rent) || 0), 0);

                    return (
                      <TableRow key={index}>
                        <TableCell className="font-medium">{group.name}</TableCell>
                        <TableCell>
                          <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-sm">
                            {group.customers.length} مكررات
                          </span>
                        </TableCell>
                        <TableCell>{totalContracts}</TableCell>
                        <TableCell className="font-semibold">
                          {totalRent.toLocaleString('ar-LY')} د.ل
                        </TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            onClick={() => {
                              setSelectedGroup(group);
                              setDialogOpen(true);
                            }}
                            className="bg-orange-600 hover:bg-orange-700"
                          >
                            <Merge className="h-4 w-4 mr-2" />
                            دمج
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* نافذة تأكيد الدمج */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-orange-500" />
              تأكيد دمج العملاء: {selectedGroup?.name}
            </DialogTitle>
          </DialogHeader>

          {selectedGroup && (
            <div className="space-y-6">
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <h4 className="font-medium text-orange-800 mb-2">تحذير مهم:</h4>
                <p className="text-sm text-orange-700">
                  سيتم دمج جميع العملاء التالية في عميل واحد. هذه العملية لا يمكن التراجع عنها!
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">ملاحظة:</h4>
                <p className="text-sm text-blue-700">
                  سيتم تجنب تحديث رقم الهاتف إذا كان سيؤدي لتعارض مع القيود الفريدة في قاعدة البيانات.
                </p>
              </div>

              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>الاسم</TableHead>
                      <TableHead>الشركة</TableHead>
                      <TableHead>الهاتف</TableHead>
                      <TableHead>عدد العقود</TableHead>
                      <TableHead>إجمالي الإيجار</TableHead>
                      <TableHead>الحالة</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedGroup.customers.map((customer, index) => (
                      <TableRow key={customer.id} className={index === 0 ? 'bg-green-50' : ''}>
                        <TableCell className="font-medium">{customer.name}</TableCell>
                        <TableCell>{customer.company || '—'}</TableCell>
                        <TableCell>{customer.phone || '—'}</TableCell>
                        <TableCell>{customer.contracts_count}</TableCell>
                        <TableCell>{Number(customer.total_rent).toLocaleString('ar-LY')} د.ل</TableCell>
                        <TableCell>
                          {index === 0 ? (
                            <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                              العميل الرئيسي
                            </span>
                          ) : (
                            <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                              سيتم حذفه
                            </span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-800 mb-2">ما سيحدث:</h4>
                <ul className="text-sm text-blue-700 space-y-1">
                  <li>• سيتم الاحتفاظ بالعميل الأول كعميل رئيسي</li>
                  <li>• سيتم نقل جميع العقود والمدفوعات إلى العميل الرئيسي</li>
                  <li>• سيتم دمج المعلومات (الشركة، البريد) بأمان</li>
                  <li>• سيتم تجنب تحديث الهاتف في حالة التعارض</li>
                  <li>• سيتم حذف العملاء المكررين نهائياً</li>
                </ul>
              </div>

              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button
                  onClick={() => mergeCustomers(selectedGroup)}
                  disabled={merging}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {merging ? 'جاري الدمج...' : 'تأكيد الدمج'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}