import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/sonner';
import { Printer, FileText, Calculator } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import ContractPrintOptions from './ContractPrintOptions';
import InstallmentPlanner from './InstallmentPlanner';
import BillboardPrintDialog from './BillboardPrintDialog';

interface ContractFormData {
  customerName: string;
  customerId: string;
  adType: string;
  startDate: string;
  endDate: string;
  totalRent: number;
  notes: string;
  designFaceAPath: string;
  designFaceBPath: string;
}

interface EnhancedContractFormProps {
  initialData?: Partial<ContractFormData>;
  contractId?: string;
  onSave?: (data: ContractFormData & { printTotal?: number; installments?: any[] }) => void;
  onCancel?: () => void;
}

export default function EnhancedContractForm({ 
  initialData, 
  contractId, 
  onSave, 
  onCancel 
}: EnhancedContractFormProps) {
  const [formData, setFormData] = useState<ContractFormData>({
    customerName: initialData?.customerName || '',
    customerId: initialData?.customerId || '',
    adType: initialData?.adType || '',
    startDate: initialData?.startDate || '',
    endDate: initialData?.endDate || '',
    totalRent: initialData?.totalRent || 0,
    notes: initialData?.notes || '',
    designFaceAPath: initialData?.designFaceAPath || '',
    designFaceBPath: initialData?.designFaceBPath || ''
  });

  const [finalTotal, setFinalTotal] = useState(formData.totalRent);
  const [installments, setInstallments] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);

  useEffect(() => {
    loadCustomers();
  }, []);

  const loadCustomers = async () => {
    try {
      const { data, error } = await supabase.from('customers').select('id, name');
      if (!error) setCustomers(data || []);
    } catch (error) {
      console.error('Error loading customers:', error);
    }
  };

  const handleInputChange = (field: keyof ContractFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (field === 'totalRent') {
      setFinalTotal(value);
    }
  };

  const handleTotalChange = (newTotal: number) => {
    setFinalTotal(newTotal);
  };

  const handleInstallmentsChange = (newInstallments: any[]) => {
    setInstallments(newInstallments);
  };

  const handleSave = async () => {
    try {
      // Validate required fields
      if (!formData.customerName || !formData.adType || !formData.startDate || !formData.endDate) {
        toast.error('يرجى ملء جميع الحقول المطلوبة');
        return;
      }

      const saveData = {
        ...formData,
        totalRent: finalTotal,
        printTotal: finalTotal - formData.totalRent,
        installments
      };

      if (onSave) {
        onSave(saveData);
      } else {
        // Default save logic
        const contractData = {
          'Customer Name': formData.customerName,
          customer_id: formData.customerId || null,
          'Ad Type': formData.adType,
          'Contract Date': formData.startDate,
          'End Date': formData.endDate,
          'Total Rent': finalTotal,
          notes: formData.notes,
          design_face_a_path: formData.designFaceAPath || null,
          design_face_b_path: formData.designFaceBPath || null
        };

        let result;
        if (contractId) {
          result = await supabase.from('Contract').update(contractData as any).eq('Contract_Number', Number(contractId));
        } else {
          result = await supabase.from('Contract').insert(contractData as any);
        }

        if (result.error) throw result.error;

        toast.success(contractId ? 'تم تحديث العقد بنجاح' : 'تم إنشاء العقد بنجاح');
        
        if (onCancel) onCancel();
      }
    } catch (error) {
      console.error('Error saving contract:', error);
      toast.error('فشل في حفظ العقد');
    }
  };

  const generateContractPreview = () => {
    const printTotal = finalTotal - formData.totalRent;
    
    const html = `
      <!DOCTYPE html>
      <html dir="rtl">
        <head>
          <meta charset="utf-8">
          <title>معاينة العقد - ${formData.customerName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700&display=swap');
            body {
              font-family: 'Cairo', Arial, sans-serif;
              padding: 20px;
              max-width: 900px;
              margin: auto;
              background: linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #422006 100%);
              color: #f1f5f9;
              min-height: 100vh;
            }
            .contract-header {
              text-align: center;
              margin-bottom: 30px;
              background: linear-gradient(135deg, #1e293b, #334155);
              padding: 20px;
              border-radius: 10px;
              border: 2px solid #d4af37;
            }
            .contract-title {
              font-size: 28px;
              font-weight: bold;
              color: #d4af37;
              margin-bottom: 10px;
            }
            .contract-details {
              background: linear-gradient(135deg, #1e293b, #334155);
              padding: 20px;
              border-radius: 10px;
              margin-bottom: 20px;
              border: 1px solid #475569;
            }
            .detail-row {
              display: flex;
              justify-content: space-between;
              margin-bottom: 12px;
              padding: 8px 0;
              border-bottom: 1px solid rgba(212, 175, 55, 0.2);
            }
            .detail-label {
              font-weight: bold;
              color: #d4af37;
            }
            .detail-value {
              color: #f1f5f9;
            }
            .financial-summary {
              background: linear-gradient(135deg, #422006, #92400e);
              padding: 20px;
              border-radius: 10px;
              margin: 20px 0;
              border: 2px solid #fbbf24;
            }
            .total-row {
              display: flex;
              justify-content: space-between;
              font-size: 18px;
              font-weight: bold;
              color: #fbbf24;
              margin-bottom: 10px;
            }
            .installments-section {
              background: linear-gradient(135deg, #164e63, #0891b2);
              padding: 20px;
              border-radius: 10px;
              margin: 20px 0;
              border: 1px solid #67e8f9;
            }
            .installment-item {
              display: flex;
              justify-content: space-between;
              padding: 8px 0;
              border-bottom: 1px solid rgba(103, 232, 249, 0.3);
              color: #67e8f9;
            }
            @media print {
              body {
                background: white !important;
                color: black !important;
                padding: 10px;
              }
              .contract-header, .contract-details, .financial-summary, .installments-section {
                background: white !important;
                color: black !important;
                border: 1px solid #ccc !important;
              }
              .detail-label, .contract-title {
                color: #333 !important;
              }
              .total-row {
                color: #333 !important;
              }
            }
          </style>
        </head>
        <body>
          <div class="contract-header">
            <div class="contract-title">عقد إعلان</div>
            <div>التاريخ: ${new Date().toLocaleDateString('ar-LY')}</div>
          </div>

          <div class="contract-details">
            <div class="detail-row">
              <span class="detail-label">العميل:</span>
              <span class="detail-value">${formData.customerName}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">نوع الإعلان:</span>
              <span class="detail-value">${formData.adType}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">تاريخ البداية:</span>
              <span class="detail-value">${new Date(formData.startDate).toLocaleDateString('ar-LY')}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">تاريخ النهاية:</span>
              <span class="detail-value">${new Date(formData.endDate).toLocaleDateString('ar-LY')}</span>
            </div>
            ${formData.notes ? `
            <div class="detail-row">
              <span class="detail-label">ملاحظات:</span>
              <span class="detail-value">${formData.notes}</span>
            </div>
            ` : ''}
          </div>

          <div class="financial-summary">
            <div class="total-row">
              <span>قيمة العقد الأساسية:</span>
              <span>${formData.totalRent.toLocaleString('ar-LY')} د.ل</span>
            </div>
            ${printTotal > 0 ? `
            <div class="total-row">
              <span>قيمة الطباعة:</span>
              <span>${printTotal.toLocaleString('ar-LY')} د.ل</span>
            </div>
            ` : ''}
            <div class="total-row" style="border-top: 2px solid #fbbf24; padding-top: 10px; font-size: 20px;">
              <span>الإجمالي النهائي:</span>
              <span>${finalTotal.toLocaleString('ar-LY')} دينار ليبي</span>
            </div>
          </div>

          ${installments.length > 0 ? `
          <div class="installments-section">
            <h3 style="color: #67e8f9; margin-bottom: 15px;">خطة الدفع:</h3>
            ${installments.map((installment, index) => `
              <div class="installment-item">
                <span>الدفعة ${index + 1}:</span>
                <span>${installment.amount.toLocaleString('ar-LY')} د.ل - ${new Date(installment.dueDate).toLocaleDateString('ar-LY')}</span>
              </div>
            `).join('')}
          </div>
          ` : ''}

          <div style="margin-top: 40px; display: flex; justify-content: space-between;">
            <div style="text-align: center; width: 200px;">
              <div style="border-top: 2px solid #d4af37; margin-top: 40px; padding-top: 10px;">توقيع العميل</div>
            </div>
            <div style="text-align: center; width: 200px;">
              <div style="border-top: 2px solid #d4af37; margin-top: 40px; padding-top: 10px;">توقيع الشركة</div>
            </div>
          </div>

          <script>window.onload = function() { window.print(); }</script>
        </body>
      </html>
    `;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  };

  return (
    <div className="space-y-6">
      {/* Basic Contract Information */}
      <Card className="expenses-preview-card">
        <CardHeader>
          <CardTitle className="expenses-preview-title flex items-center gap-2">
            <FileText className="h-5 w-5" />
            معلومات العقد الأساسية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="customer">العميل</Label>
              <Select value={formData.customerId} onValueChange={(value) => {
                const customer = customers.find(c => c.id === value);
                handleInputChange('customerId', value);
                handleInputChange('customerName', customer?.name || '');
              }}>
                <SelectTrigger className="bg-slate-700 border-slate-600 text-slate-200">
                  <SelectValue placeholder="اختر العميل" />
                </SelectTrigger>
                <SelectContent className="bg-slate-700 border-slate-600">
                  {customers.map(customer => (
                    <SelectItem key={customer.id} value={customer.id} className="text-slate-200">
                      {customer.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="adType">نوع الإعلان</Label>
              <Input
                id="adType"
                value={formData.adType}
                onChange={(e) => handleInputChange('adType', e.target.value)}
                className="bg-slate-700 border-slate-600 text-slate-200"
                placeholder="مثال: لوحة إعلانية خارجية"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="startDate">تاريخ البداية</Label>
              <Input
                id="startDate"
                type="date"
                value={formData.startDate}
                onChange={(e) => handleInputChange('startDate', e.target.value)}
                className="bg-slate-700 border-slate-600 text-slate-200"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endDate">تاريخ النهاية</Label>
              <Input
                id="endDate"
                type="date"
                value={formData.endDate}
                onChange={(e) => handleInputChange('endDate', e.target.value)}
                className="bg-slate-700 border-slate-600 text-slate-200"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalRent">قيمة العقد الأساسية (د.ل)</Label>
              <Input
                id="totalRent"
                type="number"
                value={formData.totalRent}
                onChange={(e) => handleInputChange('totalRent', Number(e.target.value) || 0)}
                className="bg-slate-700 border-slate-600 text-slate-200"
                placeholder="0"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">ملاحظات</Label>
              <Input
                id="notes"
                value={formData.notes}
                onChange={(e) => handleInputChange('notes', e.target.value)}
                className="bg-slate-700 border-slate-600 text-slate-200"
                placeholder="ملاحظات إضافية (اختياري)"
              />
            </div>
          </div>

          {/* Design Links Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 p-4 bg-slate-700/50 rounded-lg border border-yellow-500/30">
            <div className="space-y-2">
              <Label htmlFor="designFaceA" className="text-yellow-400 font-semibold">رابط تصميم الوجه الأمامي</Label>
              <Input
                id="designFaceA"
                value={formData.designFaceAPath}
                onChange={(e) => handleInputChange('designFaceAPath', e.target.value)}
                className="bg-slate-700 border-slate-600 text-slate-200"
                placeholder="https://example.com/design-front.jpg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="designFaceB" className="text-yellow-400 font-semibold">رابط تصميم الوجه الخلفي</Label>
              <Input
                id="designFaceB"
                value={formData.designFaceBPath}
                onChange={(e) => handleInputChange('designFaceBPath', e.target.value)}
                className="bg-slate-700 border-slate-600 text-slate-200"
                placeholder="https://example.com/design-back.jpg"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Print Options */}
      {contractId && (
        <ContractPrintOptions
          contractId={contractId}
          contractTotal={formData.totalRent}
          onTotalChange={handleTotalChange}
          onInstallmentsChange={handleInstallmentsChange}
          designFaceA={formData.designFaceAPath}
          designFaceB={formData.designFaceBPath}
        />
      )}

      {/* Installment Planner */}
      <InstallmentPlanner
        totalAmount={finalTotal}
        onInstallmentsChange={handleInstallmentsChange}
      />

      {/* Action Buttons */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button
            onClick={generateContractPreview}
            className="bg-blue-600 hover:bg-blue-700 text-white"
          >
            <Printer className="h-4 w-4 ml-2" />
            معاينة وطباعة العقد
          </Button>
          
          {contractId && (
            <BillboardPrintDialog 
              contractId={contractId}
              designFaceA={formData.designFaceAPath}
              designFaceB={formData.designFaceBPath}
            />
          )}
        </div>

        <div className="flex gap-2">
          {onCancel && (
            <Button variant="outline" onClick={onCancel}>
              إلغاء
            </Button>
          )}
          <Button onClick={handleSave} className="bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-slate-900 font-semibold">
            حفظ العقد
          </Button>
        </div>
      </div>
    </div>
  );
}