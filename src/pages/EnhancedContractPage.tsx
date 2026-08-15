// @ts-nocheck
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import EnhancedContractForm from '@/components/contracts/EnhancedContractForm';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/components/ui/sonner';

export default function EnhancedContractPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [contractData, setContractData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (id) {
      loadContractData();
    }
  }, [id]);

  const loadContractData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('Contract')
        .select('*')
        .eq('Contract_Number', id)
        .single();

      if (error) throw error;

      setContractData({
        customerName: data['Customer Name'] || '',
        customerId: data.customer_id || '',
        adType: data['Ad Type'] || '',
        startDate: data['Contract Date'] ? data['Contract Date'].split('T')[0] : '',
        endDate: data['End Date'] ? data['End Date'].split('T')[0] : '',
        totalRent: Number(data['Total Rent']) || 0,
        notes: data.notes || '',
        designFaceAPath: data.design_face_a_path || '',
        designFaceBPath: data.design_face_b_path || ''
      });
    } catch (error) {
      console.error('Error loading contract:', error);
      toast.error('فشل في تحميل بيانات العقد');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (formData: any) => {
    try {
      const contractData = {
        'Customer Name': formData.customerName,
        customer_id: formData.customerId || null,
        'Ad Type': formData.adType,
        'Contract Date': formData.startDate,
        'End Date': formData.endDate,
        'Total Rent': formData.totalRent,
        notes: formData.notes
      };

      let result;
      if (id) {
        result = await supabase.from('Contract').update(contractData).eq('Contract_Number', id);
      } else {
        result = await supabase.from('Contract').insert(contractData);
      }

      if (result.error) throw result.error;

      toast.success(id ? 'تم تحديث العقد بنجاح' : 'تم إنشاء العقد بنجاح');
      navigate('/admin/contracts');
    } catch (error) {
      console.error('Error saving contract:', error);
      toast.error('فشل في حفظ العقد');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-yellow-500 mx-auto mb-4"></div>
          <p className="text-slate-400">جاري التحميل...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl">
      {/* Header */}
      <Card className="mb-6 bg-gradient-to-r from-slate-800 to-slate-700 border-yellow-500/30">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-2xl font-bold text-yellow-400">
              {id ? 'تعديل العقد المحسن' : 'إنشاء عقد محسن جديد'}
            </CardTitle>
            <Button
              variant="outline"
              onClick={() => navigate('/admin/contracts')}
              className="flex items-center gap-2 border-slate-600 text-slate-300 hover:bg-slate-700"
            >
              <ArrowLeft className="h-4 w-4" />
              العودة للعقود
            </Button>
          </div>
        </CardHeader>
      </Card>

      {/* Enhanced Contract Form */}
      <EnhancedContractForm
        initialData={contractData}
        contractId={id}
        onSave={handleSave}
        onCancel={() => navigate('/admin/contracts')}
      />
    </div>
  );
}