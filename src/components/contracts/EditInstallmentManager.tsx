import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Trash2, Calculator } from 'lucide-react';
import { toast } from 'sonner';

interface EditInstallment {
  amount: number;
  paymentType: string;
  description: string;
  dueDate: string;
}

interface EditInstallmentManagerProps {
  installments: EditInstallment[];
  setInstallments: (installments: EditInstallment[]) => void;
  updateInstallment: (index: number, field: string, value: any) => void;
  formData: any;
  calculateDueDate: (paymentType: string, index: number, startDateOverride?: string) => string;
  totalAmount: number;
}

export function EditInstallmentManager({
  installments,
  setInstallments,
  updateInstallment,
  formData,
  calculateDueDate,
  totalAmount
}: EditInstallmentManagerProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newInstallment, setNewInstallment] = useState<EditInstallment>({
    amount: 0,
    paymentType: 'شهري',
    description: '',
    dueDate: ''
  });

  const paymentTypes = [
    'عند التوقيع',
    'عند التركيب',
    'شهري',
    'شهرين',
    'ثلاثة أشهر',
    'نهاية العقد'
  ];

  const addInstallment = () => {
    if (newInstallment.amount <= 0) {
      toast.error('يرجى إدخال مبلغ صحيح');
      return;
    }

    const dueDate = calculateDueDate(newInstallment.paymentType, installments.length);
    const installment: EditInstallment = {
      ...newInstallment,
      description: newInstallment.description || `دفعة ${installments.length + 1}`,
      dueDate
    };

    setInstallments([...installments, installment]);
    setNewInstallment({
      amount: 0,
      paymentType: 'شهري',
      description: '',
      dueDate: ''
    });
    setShowAddForm(false);
    toast.success('تم إضافة الدفعة بنجاح');
  };

  const removeInstallment = (index: number) => {
    setInstallments(installments.filter((_, i) => i !== index));
    toast.success('تم حذف الدفعة');
  };

  const distributeEvenly = () => {
    if (installments.length === 0) {
      toast.error('يرجى إضافة دفعة واحدة على الأقل');
      return;
    }

    const amountPerInstallment = Math.round(totalAmount / installments.length);
    const remainder = totalAmount - (amountPerInstallment * installments.length);

    const updatedInstallments = installments.map((installment, index) => ({
      ...installment,
      amount: index === 0 ? amountPerInstallment + remainder : amountPerInstallment
    }));

    setInstallments(updatedInstallments);
    toast.success('تم توزيع المبلغ بالتساوي');
  };

  const clearAllInstallments = () => {
    setInstallments([]);
    toast.success('تم حذف جميع الدفعات');
  };

  const totalInstallments = installments.reduce((sum, inst) => sum + inst.amount, 0);
  const remainingAmount = totalAmount - totalInstallments;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span>إدارة الدفعات</span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={distributeEvenly}
              disabled={installments.length === 0}
              className="flex items-center gap-1"
            >
              <Calculator className="h-4 w-4" />
              توزيع متساوي
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1"
            >
              <Plus className="h-4 w-4" />
              إضافة دفعة
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary */}
        <div className="grid grid-cols-3 gap-4 p-4 bg-muted rounded-lg">
          <div className="text-center">
            <div className="text-sm text-muted-foreground">إجمالي العقد</div>
            <div className="text-lg font-semibold">{totalAmount.toLocaleString()} ريال</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">إجمالي الدفعات</div>
            <div className="text-lg font-semibold">{totalInstallments.toLocaleString()} ريال</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">المتبقي</div>
            <div className={`text-lg font-semibold ${remainingAmount < 0 ? 'text-red-500' : remainingAmount > 0 ? 'text-orange-500' : 'text-green-500'}`}>
              {remainingAmount.toLocaleString()} ريال
            </div>
          </div>
        </div>

        {/* Add New Installment Form */}
        {showAddForm && (
          <Card className="border-dashed">
            <CardContent className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="amount">المبلغ (ريال)</Label>
                  <Input
                    id="amount"
                    type="number"
                    min="0"
                    step="0.01"
                    value={newInstallment.amount || ''}
                    onChange={(e) => setNewInstallment(prev => ({
                      ...prev,
                      amount: parseFloat(e.target.value) || 0
                    }))}
                    placeholder="أدخل المبلغ"
                  />
                </div>
                <div>
                  <Label htmlFor="paymentType">نوع الدفع</Label>
                  <Select
                    value={newInstallment.paymentType}
                    onValueChange={(value) => setNewInstallment(prev => ({
                      ...prev,
                      paymentType: value
                    }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="description">الوصف</Label>
                  <Textarea
                    id="description"
                    value={newInstallment.description}
                    onChange={(e) => setNewInstallment(prev => ({
                      ...prev,
                      description: e.target.value
                    }))}
                    placeholder="وصف الدفعة (اختياري)"
                    rows={2}
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 mt-4">
                <Button
                  variant="outline"
                  onClick={() => setShowAddForm(false)}
                >
                  إلغاء
                </Button>
                <Button onClick={addInstallment}>
                  إضافة الدفعة
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Existing Installments */}
        <div className="space-y-3">
          {installments.map((installment, index) => (
            <Card key={index} className="border-l-4 border-l-primary">
              <CardContent className="p-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div>
                    <Label htmlFor={`amount-${index}`}>المبلغ (ريال)</Label>
                    <Input
                      id={`amount-${index}`}
                      type="number"
                      min="0"
                      step="0.01"
                      value={installment.amount || ''}
                      onChange={(e) => updateInstallment(index, 'amount', parseFloat(e.target.value) || 0)}
                    />
                  </div>
                  <div>
                    <Label htmlFor={`paymentType-${index}`}>نوع الدفع</Label>
                    <Select
                      value={installment.paymentType}
                      onValueChange={(value) => updateInstallment(index, 'paymentType', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {paymentTypes.map((type) => (
                          <SelectItem key={type} value={type}>
                            {type}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label htmlFor={`dueDate-${index}`}>تاريخ الاستحقاق</Label>
                    <Input
                      id={`dueDate-${index}`}
                      type="date"
                      value={installment.dueDate}
                      onChange={(e) => updateInstallment(index, 'dueDate', e.target.value)}
                    />
                  </div>
                  <div className="flex items-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => removeInstallment(index)}
                      className="w-full text-red-500 hover:text-red-700"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="mt-3">
                  <Label htmlFor={`description-${index}`}>الوصف</Label>
                  <Textarea
                    id={`description-${index}`}
                    value={installment.description}
                    onChange={(e) => updateInstallment(index, 'description', e.target.value)}
                    placeholder="وصف الدفعة"
                    rows={2}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {installments.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            لم يتم إضافة أي دفعات بعد
            <br />
            <Button
              variant="outline"
              className="mt-2"
              onClick={() => setShowAddForm(true)}
            >
              إضافة أول دفعة
            </Button>
          </div>
        )}

        {installments.length > 0 && (
          <div className="flex justify-end">
            <Button
              variant="outline"
              onClick={clearAllInstallments}
              className="text-red-500 hover:text-red-700"
            >
              حذف جميع الدفعات
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}