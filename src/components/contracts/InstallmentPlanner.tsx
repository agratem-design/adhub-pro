import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Plus, Minus, Calendar } from 'lucide-react';

interface Installment {
  id: string;
  amount: number;
  dueDate: string;
  description: string;
}

interface InstallmentPlannerProps {
  totalAmount: number;
  onInstallmentsChange: (installments: Installment[]) => void;
}

export default function InstallmentPlanner({ totalAmount, onInstallmentsChange }: InstallmentPlannerProps) {
  const [installments, setInstallments] = useState<Installment[]>([]);
  const [planType, setPlanType] = useState<'manual' | 'auto'>('manual');
  const [numberOfInstallments, setNumberOfInstallments] = useState(3);
  const [startDate, setStartDate] = useState<string>(() => {
    const today = new Date();
    return today.toISOString().split('T')[0];
  });
  const [intervalType, setIntervalType] = useState<'monthly' | 'weekly' | 'custom'>('monthly');

  useEffect(() => {
    onInstallmentsChange(installments);
  }, [installments, onInstallmentsChange]);

  const generateAutoInstallments = () => {
    if (totalAmount <= 0 || numberOfInstallments <= 0) return;

    const installmentAmount = Math.round(totalAmount / numberOfInstallments);
    const remainder = totalAmount - (installmentAmount * (numberOfInstallments - 1));

    const newInstallments: Installment[] = [];
    const baseDate = new Date(startDate);

    for (let i = 0; i < numberOfInstallments; i++) {
      const dueDate = new Date(baseDate);
      
      if (intervalType === 'monthly') {
        dueDate.setMonth(baseDate.getMonth() + i);
      } else if (intervalType === 'weekly') {
        dueDate.setDate(baseDate.getDate() + (i * 7));
      }

      const amount = i === numberOfInstallments - 1 ? remainder : installmentAmount;

      newInstallments.push({
        id: `installment-${i + 1}`,
        amount,
        dueDate: dueDate.toISOString().split('T')[0],
        description: `الدفعة ${i + 1}`
      });
    }

    setInstallments(newInstallments);
  };

  const addManualInstallment = () => {
    const newInstallment: Installment = {
      id: `installment-${Date.now()}`,
      amount: 0,
      dueDate: startDate,
      description: `الدفعة ${installments.length + 1}`
    };

    setInstallments([...installments, newInstallment]);
  };

  const updateInstallment = (id: string, field: keyof Installment, value: any) => {
    setInstallments(prev => prev.map(installment => 
      installment.id === id ? { ...installment, [field]: value } : installment
    ));
  };

  const removeInstallment = (id: string) => {
    setInstallments(prev => prev.filter(installment => installment.id !== id));
  };

  const totalInstallments = installments.reduce((sum, installment) => sum + installment.amount, 0);
  const remainingAmount = totalAmount - totalInstallments;

  return (
    <Card className="border-2 border-blue-500/30 bg-gradient-to-r from-slate-800 to-slate-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-blue-400">
          <Calendar className="h-5 w-5" />
          خطة الدفع والأقساط
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Plan Type Selection */}
        <div className="flex gap-4">
          <Button
            variant={planType === 'manual' ? 'default' : 'outline'}
            onClick={() => setPlanType('manual')}
            className="flex-1"
          >
            خطة يدوية
          </Button>
          <Button
            variant={planType === 'auto' ? 'default' : 'outline'}
            onClick={() => setPlanType('auto')}
            className="flex-1"
          >
            خطة تلقائية
          </Button>
        </div>

        {/* Auto Plan Settings */}
        {planType === 'auto' && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-slate-700 rounded-lg">
            <div>
              <label className="text-sm font-medium text-slate-300 block mb-2">عدد الأقساط</label>
              <Input
                type="number"
                min="1"
                max="12"
                value={numberOfInstallments}
                onChange={(e) => setNumberOfInstallments(Number(e.target.value) || 1)}
                className="bg-slate-600 border-slate-500 text-slate-200"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 block mb-2">تاريخ البداية</label>
              <Input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="bg-slate-600 border-slate-500 text-slate-200"
              />
            </div>
            <div>
              <label className="text-sm font-medium text-slate-300 block mb-2">الفترة الزمنية</label>
              <Select value={intervalType} onValueChange={(value: 'monthly' | 'weekly' | 'custom') => setIntervalType(value)}>
                <SelectTrigger className="bg-slate-600 border-slate-500 text-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  <SelectItem value="monthly" className="text-slate-200">شهرياً</SelectItem>
                  <SelectItem value="weekly" className="text-slate-200">أسبوعياً</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="md:col-span-3">
              <Button onClick={generateAutoInstallments} className="w-full bg-blue-600 hover:bg-blue-700">
                إنشاء خطة الدفع التلقائية
              </Button>
            </div>
          </div>
        )}

        {/* Manual Plan */}
        {planType === 'manual' && (
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-slate-200">الأقساط اليدوية</h3>
            <Button onClick={addManualInstallment} className="bg-green-600 hover:bg-green-700">
              <Plus className="h-4 w-4 ml-1" />
              إضافة قسط
            </Button>
          </div>
        )}

        {/* Installments Table */}
        {installments.length > 0 && (
          <div className="space-y-4">
            <Table>
              <TableHeader>
                <TableRow className="bg-slate-700 border-slate-600">
                  <TableHead className="text-blue-400 text-center">الوصف</TableHead>
                  <TableHead className="text-blue-400 text-center">المبلغ (د.ل)</TableHead>
                  <TableHead className="text-blue-400 text-center">تاريخ الاستحقاق</TableHead>
                  <TableHead className="text-blue-400 text-center">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {installments.map((installment, index) => (
                  <TableRow key={installment.id} className="hover:bg-slate-750 border-slate-600">
                    <TableCell className="text-center">
                      <Input
                        value={installment.description}
                        onChange={(e) => updateInstallment(installment.id, 'description', e.target.value)}
                        className="bg-slate-700 border-slate-600 text-slate-200"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="number"
                        min="0"
                        value={installment.amount}
                        onChange={(e) => updateInstallment(installment.id, 'amount', Number(e.target.value) || 0)}
                        className="bg-slate-700 border-slate-600 text-slate-200"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Input
                        type="date"
                        value={installment.dueDate}
                        onChange={(e) => updateInstallment(installment.id, 'dueDate', e.target.value)}
                        className="bg-slate-700 border-slate-600 text-slate-200"
                      />
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeInstallment(installment.id)}
                        className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {/* Summary */}
            <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">إجمالي المبلغ:</span>
                  <span className="font-semibold text-slate-200">{totalAmount.toLocaleString('ar-LY')} د.ل</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">إجمالي الأقساط:</span>
                  <span className="font-semibold text-blue-400">{totalInstallments.toLocaleString('ar-LY')} د.ل</span>
                </div>
                <div className="flex justify-between border-t border-slate-600 pt-2">
                  <span className="text-slate-400">المتبقي:</span>
                  <span className={`font-bold ${remainingAmount === 0 ? 'text-green-400' : remainingAmount > 0 ? 'text-red-400' : 'text-yellow-400'}`}>
                    {remainingAmount.toLocaleString('ar-LY')} د.ل
                  </span>
                </div>
                {remainingAmount !== 0 && (
                  <div className="text-xs text-slate-500 mt-2">
                    {remainingAmount > 0 ? 'يجب إضافة أقساط إضافية' : 'إجمالي الأقساط أكبر من المبلغ المطلوب'}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}