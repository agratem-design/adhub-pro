// @ts-nocheck
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from '@/components/ui/sonner';
import { Printer, Calculator, Plus, Minus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface PrintItem {
  size: string;
  quantity: number;
  area: number;
  pricePerMeter: number;
  totalArea: number;
  totalPrice: number;
}

interface ContractPrintOptionsProps {
  contractId: string;
  contractTotal: number;
  onTotalChange: (newTotal: number) => void;
  onInstallmentsChange: (installments: any[]) => void;
  designFaceA?: string;
  designFaceB?: string;
}

export default function ContractPrintOptions({ 
  contractId, 
  contractTotal, 
  onTotalChange, 
  onInstallmentsChange,
  designFaceA,
  designFaceB
}: ContractPrintOptionsProps) {
  const [includePrintInvoice, setIncludePrintInvoice] = useState(false);
  const [includeDesigns, setIncludeDesigns] = useState(true);
  const [printItems, setPrintItems] = useState<PrintItem[]>([]);
  const [printTotal, setPrintTotal] = useState(0);
  const [finalTotal, setFinalTotal] = useState(contractTotal);

  // Load billboard sizes for this contract
  useEffect(() => {
    if (includePrintInvoice && contractId) {
      loadContractBillboards();
    } else {
      setPrintItems([]);
      setPrintTotal(0);
      setFinalTotal(contractTotal);
      onTotalChange(contractTotal);
    }
  }, [includePrintInvoice, contractId, contractTotal]);

  const loadContractBillboards = async () => {
    try {
      // Get billboards for this contract
      const { data: billboards, error } = await supabase
        .from('Billboard')
        .select('Size')
        .eq('Contract_Number', contractId);

      if (error) throw error;

      // Count sizes
      const sizeCounts: Record<string, number> = {};
      billboards?.forEach(board => {
        const size = board.Size || 'غير محدد';
        sizeCounts[size] = (sizeCounts[size] || 0) + 1;
      });

      // Get size dimensions and pricing
      const sizes = Object.keys(sizeCounts);
      if (sizes.length === 0) return;

      const { data: sizeData } = await supabase
        .from('Size')
        .select('name, width, height')
        .in('name', sizes);

      const { data: pricingData } = await supabase
        .from('installation_print_pricing')
        .select('size, print_price')
        .in('size', sizes);

      // Create print items
      const items: PrintItem[] = Object.entries(sizeCounts).map(([size, quantity]) => {
        const sizeInfo = sizeData?.find(s => s.name === size);
        const pricingInfo = pricingData?.find(p => p.size === size);
        
        const area = sizeInfo ? (parseFloat(sizeInfo.width) * parseFloat(sizeInfo.height)) : 1;
        const pricePerMeter = pricingInfo ? Number(pricingInfo.print_price) : 25;
        const totalArea = area * quantity;
        const totalPrice = totalArea * pricePerMeter;

        return {
          size,
          quantity,
          area,
          pricePerMeter,
          totalArea,
          totalPrice
        };
      });

      setPrintItems(items);
      const total = items.reduce((sum, item) => sum + item.totalPrice, 0);
      setPrintTotal(total);
      
      const newFinalTotal = contractTotal + total;
      setFinalTotal(newFinalTotal);
      onTotalChange(newFinalTotal);

    } catch (error) {
      console.error('Error loading contract billboards:', error);
      toast.error('فشل في تحميل بيانات اللوحات');
    }
  };

  const updatePrintItem = (index: number, field: keyof PrintItem, value: number) => {
    const newItems = [...printItems];
    newItems[index] = { ...newItems[index], [field]: value };
    
    if (field === 'quantity' || field === 'pricePerMeter') {
      newItems[index].totalArea = newItems[index].area * newItems[index].quantity;
      newItems[index].totalPrice = newItems[index].totalArea * newItems[index].pricePerMeter;
    }
    
    setPrintItems(newItems);
    
    const total = newItems.reduce((sum, item) => sum + item.totalPrice, 0);
    setPrintTotal(total);
    
    const newFinalTotal = contractTotal + total;
    setFinalTotal(newFinalTotal);
    onTotalChange(newFinalTotal);
  };

  const removeItem = (index: number) => {
    const newItems = printItems.filter((_, i) => i !== index);
    setPrintItems(newItems);
    
    const total = newItems.reduce((sum, item) => sum + item.totalPrice, 0);
    setPrintTotal(total);
    
    const newFinalTotal = contractTotal + total;
    setFinalTotal(newFinalTotal);
    onTotalChange(newFinalTotal);
  };

  const addCustomItem = () => {
    const newItem: PrintItem = {
      size: 'مقاس مخصص',
      quantity: 1,
      area: 1,
      pricePerMeter: 25,
      totalArea: 1,
      totalPrice: 25
    };
    
    const newItems = [...printItems, newItem];
    setPrintItems(newItems);
    
    const total = newItems.reduce((sum, item) => sum + item.totalPrice, 0);
    setPrintTotal(total);
    
    const newFinalTotal = contractTotal + total;
    setFinalTotal(newFinalTotal);
    onTotalChange(newFinalTotal);
  };

  return (
    <Card className="mt-6 border-2 border-yellow-500/30 bg-gradient-to-r from-slate-800 to-slate-700">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-yellow-400">
          <Calculator className="h-5 w-5" />
          خيارات فاتورة الطباعة
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Enable/Disable Print Invoice */}
        <div className="flex items-center space-x-2 space-x-reverse">
          <Checkbox
            id="include-print-invoice"
            checked={includePrintInvoice}
            onCheckedChange={(checked) => setIncludePrintInvoice(checked as boolean)}
          />
          <label htmlFor="include-print-invoice" className="text-sm cursor-pointer text-slate-200 font-medium">
            إضافة فاتورة طباعة مع العقد
          </label>
        </div>

        {/* Include Designs Option */}
        {(designFaceA || designFaceB) && (
          <div className="flex items-center space-x-2 space-x-reverse">
            <Checkbox
              id="include-designs"
              checked={includeDesigns}
              onCheckedChange={(checked) => setIncludeDesigns(checked as boolean)}
            />
            <label htmlFor="include-designs" className="text-sm cursor-pointer text-slate-200 font-medium">
              طباعة التصميمات (الوجه الأمامي والخلفي)
            </label>
          </div>
        )}

        {includePrintInvoice && (
          <>
            {/* Print Items Table */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-yellow-400">تفاصيل الطباعة</h3>
                <Button
                  size="sm"
                  onClick={addCustomItem}
                  className="bg-green-600 hover:bg-green-700 text-white"
                >
                  <Plus className="h-4 w-4 ml-1" />
                  إضافة مقاس مخصص
                </Button>
              </div>

              {printItems.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-slate-700 border-slate-600">
                        <TableHead className="text-yellow-400 text-center">المقاس</TableHead>
                        <TableHead className="text-yellow-400 text-center">الكمية</TableHead>
                        <TableHead className="text-yellow-400 text-center">المساحة/الوحدة (م²)</TableHead>
                        <TableHead className="text-yellow-400 text-center">إجمالي المساحة (م²)</TableHead>
                        <TableHead className="text-yellow-400 text-center">سعر المتر (د.ل)</TableHead>
                        <TableHead className="text-yellow-400 text-center">إجمالي السعر (د.ل)</TableHead>
                        <TableHead className="text-yellow-400 text-center">إجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {printItems.map((item, index) => (
                        <TableRow key={index} className="hover:bg-slate-750 border-slate-600">
                          <TableCell className="text-center">
                            <Input
                              value={item.size}
                              onChange={(e) => updatePrintItem(index, 'size' as keyof PrintItem, e.target.value as any)}
                              className="w-24 bg-slate-700 border-slate-600 text-slate-200 text-center"
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              min="0"
                              value={item.quantity}
                              onChange={(e) => updatePrintItem(index, 'quantity', Number(e.target.value) || 0)}
                              className="w-16 bg-slate-700 border-slate-600 text-slate-200 text-center"
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              min="0"
                              step="0.1"
                              value={item.area}
                              onChange={(e) => updatePrintItem(index, 'area', Number(e.target.value) || 0)}
                              className="w-20 bg-slate-700 border-slate-600 text-slate-200 text-center"
                            />
                          </TableCell>
                          <TableCell className="font-bold text-blue-400 text-center">
                            {item.totalArea.toFixed(2)}
                          </TableCell>
                          <TableCell className="text-center">
                            <Input
                              type="number"
                              min="0"
                              step="0.1"
                              value={item.pricePerMeter}
                              onChange={(e) => updatePrintItem(index, 'pricePerMeter', Number(e.target.value) || 0)}
                              className="w-20 bg-slate-700 border-slate-600 text-slate-200 text-center"
                            />
                          </TableCell>
                          <TableCell className="font-bold text-yellow-400 text-center">
                            {item.totalPrice.toLocaleString('ar-LY')}
                          </TableCell>
                          <TableCell className="text-center">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removeItem(index)}
                              className="text-red-400 hover:text-red-300 hover:bg-red-900/20"
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 bg-slate-700/50 rounded-lg border border-slate-600">
                  <Calculator className="h-12 w-12 text-slate-400 mx-auto mb-4" />
                  <p className="text-slate-400">لا توجد لوحات مرتبطة بهذا العقد</p>
                  <p className="text-slate-500 text-sm mt-2">يمكنك إضافة مقاسات مخصصة</p>
                </div>
              )}
            </div>

            {/* Totals Summary */}
            <div className="bg-slate-700 rounded-lg p-4 border border-slate-600">
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-400">إجمالي العقد:</span>
                  <span className="font-semibold text-slate-200">{contractTotal.toLocaleString('ar-LY')} د.ل</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">إجمالي الطباعة:</span>
                  <span className="font-semibold text-blue-400">{printTotal.toLocaleString('ar-LY')} د.ل</span>
                </div>
                <div className="flex justify-between border-t border-slate-600 pt-2">
                  <span className="text-slate-400 font-bold">الإجمالي النهائي:</span>
                  <span className="font-bold text-yellow-400 text-lg">{finalTotal.toLocaleString('ar-LY')} د.ل</span>
                </div>
              </div>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}