import { useAuth } from '@/contexts/AuthContext';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Building2, MapPin, Phone, Mail, DollarSign, Calendar, Search, Printer } from 'lucide-react';
import { toast } from 'sonner';

interface RentalWithDetails {
  id: string;
  billboard_id: number;
  billboard_name: string;
  billboard_size: string;
  municipality: string;
  district: string;
  nearest_landmark: string;
  ad_type: string;
  contract_number: number;
  friend_company_id: string;
  friend_company_name: string;
  friend_rental_cost: number;
  customer_rental_price: number;
  profit: number;
  start_date: string;
  end_date: string;
  duration_days: number;
  status: string;
}

export default function FriendBillboards() {
  const { canEdit: canEditAuth } = useAuth();
  const canEditSection = canEditAuth('friend_billboards');
  const [isAddingCompany, setIsAddingCompany] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [newCompany, setNewCompany] = useState<{ name: string; contact_person: string; phone: string; email: string; notes: string }>({
    name: '',
    contact_person: '',
    phone: '',
    email: '',
    notes: ''
  });

  // queryClient available via useQuery refetch

  // Fetch friend companies
  const { data: friendCompanies, refetch: refetchCompanies } = useQuery({
    queryKey: ['friend-companies'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('friend_companies')
        .select('*')
        .order('name', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });

  // Fetch friend billboards with rental details
  const { data: friendBillboards } = useQuery({
    queryKey: ['friend-billboard-rentals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('friend_billboard_rentals')
        .select(`
          *,
          billboards:billboard_id (
            "Billboard_Name",
            "Size",
            "Municipality",
            "District",
            "Nearest_Landmark",
            "Ad_Type",
            "Status"
          ),
          friend_companies:friend_company_id (
            name
          )
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map((rental: any) => {
        const startDate = new Date(rental.start_date);
        const endDate = new Date(rental.end_date);
        const durationDays = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
        const now = new Date();
        const status = endDate < now ? 'منتهي' : startDate > now ? 'قادم' : 'نشط';
        
        return {
          id: rental.id,
          billboard_id: rental.billboard_id,
          billboard_name: rental.billboards?.Billboard_Name || `لوحة ${rental.billboard_id}`,
          billboard_size: rental.billboards?.Size || '-',
          municipality: rental.billboards?.Municipality || '-',
          district: rental.billboards?.District || '-',
          nearest_landmark: rental.billboards?.Nearest_Landmark || '-',
          ad_type: rental.billboards?.Ad_Type || '-',
          friend_company_id: rental.friend_company_id,
          friend_company_name: rental.friend_companies?.name || '-',
          contract_number: rental.contract_number,
          friend_rental_cost: Number(rental.friend_rental_cost) || 0,
          customer_rental_price: Number(rental.customer_rental_price) || 0,
          profit: Number(rental.profit) || 0,
          start_date: rental.start_date,
          end_date: rental.end_date,
          duration_days: durationDays,
          status
        } as RentalWithDetails;
      });
    }
  });

  const filteredBillboards = friendBillboards?.filter(b => 
    b.billboard_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.friend_company_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    b.municipality.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleAddCompany = async () => {
    if (!newCompany.name.trim()) {
      toast.error('الرجاء إدخال اسم الشركة');
      return;
    }

    const { error } = await (supabase as any)
      .from('friend_companies')
      .insert([newCompany]);

    if (error) {
      toast.error('فشل إضافة الشركة');
      console.error(error);
      return;
    }

    toast.success('تمت إضافة الشركة بنجاح');
    setIsAddingCompany(false);
    setNewCompany({
      name: '',
      contact_person: '',
      phone: '',
      email: '',
      notes: ''
    });
    refetchCompanies();
  };

  const handlePrintInvoice = (rental: RentalWithDetails) => {
    const durationMonths = Math.ceil(rental.duration_days / 30);
    
    const invoiceHTML = `
      <!DOCTYPE html>
      <html lang="ar" dir="rtl">
      <head>
        <meta charset="UTF-8">
        <title>فاتورة مشتريات - ${rental.friend_company_name}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          @page { size: A4; margin: 15mm; }
          body {
            font-family: 'Segoe UI', Tahoma, sans-serif;
            background: #f5f5f5;
            padding: 20px;
            direction: rtl;
          }
          .invoice-container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 12px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.1);
            overflow: hidden;
          }
          .header {
            background: linear-gradient(135deg, #1e3a5f 0%, #2d5a87 100%);
            color: white;
            padding: 30px;
            text-align: center;
          }
          .header h1 { font-size: 28px; margin-bottom: 10px; }
          .header .subtitle { font-size: 16px; opacity: 0.9; }
          .invoice-type {
            background: #dc2626;
            color: white;
            padding: 8px 24px;
            border-radius: 20px;
            display: inline-block;
            margin-top: 15px;
            font-weight: bold;
          }
          .content { padding: 30px; }
          .info-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 20px;
            margin-bottom: 30px;
          }
          .info-box {
            background: #f8fafc;
            border-radius: 8px;
            padding: 20px;
            border-right: 4px solid #1e3a5f;
          }
          .info-box h3 {
            color: #1e3a5f;
            font-size: 14px;
            margin-bottom: 12px;
            font-weight: 600;
          }
          .info-box p {
            font-size: 15px;
            color: #334155;
            margin-bottom: 8px;
          }
          .info-box strong { color: #1e40af; }
          .billboard-details {
            background: linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%);
            border-radius: 12px;
            padding: 25px;
            margin-bottom: 25px;
            border: 2px solid #0ea5e9;
          }
          .billboard-details h3 {
            color: #0369a1;
            font-size: 18px;
            margin-bottom: 15px;
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .billboard-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 15px;
          }
          .billboard-item {
            background: white;
            padding: 15px;
            border-radius: 8px;
            text-align: center;
            box-shadow: 0 2px 8px rgba(0,0,0,0.05);
          }
          .billboard-item .label {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 5px;
          }
          .billboard-item .value {
            font-size: 16px;
            font-weight: bold;
            color: #1e3a5f;
          }
          .duration-box {
            background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
            border-radius: 12px;
            padding: 20px;
            margin-bottom: 25px;
            border: 2px solid #f59e0b;
            text-align: center;
          }
          .duration-box h3 {
            color: #92400e;
            font-size: 16px;
            margin-bottom: 10px;
          }
          .duration-box .duration {
            font-size: 24px;
            font-weight: bold;
            color: #b45309;
          }
          .duration-box .dates {
            font-size: 14px;
            color: #78350f;
            margin-top: 10px;
          }
          .amount-section {
            background: linear-gradient(135deg, #fef2f2 0%, #fee2e2 100%);
            border-radius: 12px;
            padding: 25px;
            text-align: center;
            border: 2px solid #dc2626;
          }
          .amount-section h3 {
            color: #991b1b;
            font-size: 16px;
            margin-bottom: 15px;
          }
          .amount {
            font-size: 36px;
            font-weight: bold;
            color: #dc2626;
          }
          .footer {
            background: #f1f5f9;
            padding: 20px 30px;
            text-align: center;
            border-top: 1px solid #e2e8f0;
          }
          .footer p {
            font-size: 12px;
            color: #64748b;
          }
          .signatures {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 40px;
            margin-top: 40px;
            padding-top: 30px;
            border-top: 2px dashed #cbd5e1;
          }
          .signature-box {
            text-align: center;
          }
          .signature-box .label {
            font-size: 14px;
            color: #64748b;
            margin-bottom: 40px;
          }
          .signature-box .line {
            border-bottom: 2px solid #1e3a5f;
            width: 150px;
            margin: 0 auto;
          }
          @media print {
            body { background: white; padding: 0; }
            .invoice-container { box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="invoice-container">
          <div class="header" style="direction: rtl; display: flex; flex-direction: row-reverse; justify-content: space-between; align-items: flex-start; border-bottom: 3px solid #D4AF37; padding-bottom: 15px;">
            <div style="text-align: right;">
              <p class="subtitle" style="margin-top: 8px; font-size: 11px;">فاتورة تأجير لوحة من شركة صديقة</p>
            </div>
            <div style="text-align: left;">
              <span class="invoice-type" style="background: #D4AF37; color: white; padding: 6px 12px; border-radius: 4px; font-weight: bold;">فاتورة مشتريات</span>
            </div>
          </div>
          
          <div class="content">
            <div class="info-grid">
              <div class="info-box">
                <h3>بيانات المورد (الشركة الصديقة)</h3>
                <p><strong>الشركة:</strong> ${rental.friend_company_name}</p>
                <p><strong>رقم العقد:</strong> ${rental.contract_number}</p>
              </div>
              <div class="info-box">
                <h3>بيانات الفاتورة</h3>
                <p><strong>رقم الفاتورة:</strong> FBR-${rental.id.slice(0, 8).toUpperCase()}</p>
                <p><strong>تاريخ الإصدار:</strong> ${new Date().toLocaleDateString('ar-LY')}</p>
              </div>
            </div>
            
            <div class="billboard-details">
              <h3>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                  <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/>
                  <circle cx="12" cy="10" r="3"/>
                </svg>
                بيانات اللوحة المستأجرة
              </h3>
              <div class="billboard-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
                <div class="billboard-item">
                  <div class="label" style="font-size: 11px; color: #666; margin-bottom: 5px;">اسم اللوحة</div>
                  <div class="value" style="font-weight: bold;">${rental.billboard_name}</div>
                </div>
                <div class="billboard-item">
                  <div class="label" style="font-size: 11px; color: #666; margin-bottom: 5px;">المقاس</div>
                  <div class="value" style="font-weight: bold;">${rental.billboard_size}</div>
                </div>
                <div class="billboard-item" style="grid-column: span 2; border-top: 1px solid #eee; padding-top: 10px; margin-top: 5px;">
                  <div class="label" style="font-size: 11px; color: #666; margin-bottom: 5px;">الموقع والتفاصيل</div>
                  <div class="value" style="line-height: 1.6;">
                    البلدية: ${rental.municipality || '—'} • 
                    المنطقة: ${rental.district || '—'} • 
                    أقرب نقطة دالة: ${rental.nearest_landmark || '—'} • 
                    نوع الإعلان: ${rental.ad_type || '—'}
                  </div>
                </div>
              </div>
            </div>
            
            <div class="duration-box">
              <h3>مدة الإيجار</h3>
              <div class="duration">${rental.duration_days} يوم (${durationMonths} شهر)</div>
              <div class="dates">
                من ${new Date(rental.start_date).toLocaleDateString('ar-LY')} 
                إلى ${new Date(rental.end_date).toLocaleDateString('ar-LY')}
              </div>
            </div>
            
            <div class="amount-section">
              <h3>المبلغ المستحق للشركة الصديقة</h3>
              <div class="amount">${rental.friend_rental_cost.toLocaleString('ar-LY')} د.ل</div>
            </div>
            
            <div class="signatures">
              <div class="signature-box">
                <div class="label">توقيع المستلم</div>
                <div class="line"></div>
              </div>
              <div class="signature-box">
                <div class="label">ختم الشركة</div>
                <div class="line"></div>
              </div>
            </div>
          </div>
          
          <div class="footer">
            <p>هذه الفاتورة تمثل تكلفة استئجار لوحة من شركة صديقة</p>
            <p>تم إصدارها بتاريخ: ${new Date().toLocaleDateString('ar-LY')} - ${new Date().toLocaleTimeString('ar-LY')}</p>
          </div>
        </div>
        
        <script>
          window.onload = function() { window.print(); }
        </script>
      </body>
      </html>
    `;
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(invoiceHTML);
      printWindow.document.close();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'نشط':
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20">نشط</Badge>;
      case 'منتهي':
        return <Badge className="bg-red-500/10 text-red-600 border-red-500/20">منتهي</Badge>;
      case 'قادم':
        return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20">قادم</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const totalRentals = friendBillboards?.length || 0;
  const activeRentals = friendBillboards?.filter(b => b.status === 'نشط').length || 0;
  const totalCost = friendBillboards?.reduce((sum, b) => sum + b.friend_rental_cost, 0) || 0;
  const totalProfit = friendBillboards?.reduce((sum, b) => sum + b.profit, 0) || 0;

  return (
    <>
      <div className="container mx-auto p-6 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">لوحات الأصدقاء</h1>
            <p className="text-muted-foreground mt-1">
              إدارة اللوحات المستأجرة من الشركات الصديقة
            </p>
          </div>
          
          <Dialog open={isAddingCompany} onOpenChange={setIsAddingCompany}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 ml-2" />
                إضافة شركة صديقة
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>إضافة شركة صديقة جديدة</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label>اسم الشركة *</Label>
                  <Input
                    value={newCompany.name}
                    onChange={(e) => setNewCompany({ ...newCompany, name: e.target.value })}
                    placeholder="اسم الشركة"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>الشخص المسؤول</Label>
                  <Input
                    value={newCompany.contact_person}
                    onChange={(e) => setNewCompany({ ...newCompany, contact_person: e.target.value })}
                    placeholder="اسم الشخص المسؤول"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>رقم الهاتف</Label>
                  <Input
                    value={newCompany.phone}
                    onChange={(e) => setNewCompany({ ...newCompany, phone: e.target.value })}
                    placeholder="رقم الهاتف"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>البريد الإلكتروني</Label>
                  <Input
                    type="email"
                    value={newCompany.email}
                    onChange={(e) => setNewCompany({ ...newCompany, email: e.target.value })}
                    placeholder="البريد الإلكتروني"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>ملاحظات</Label>
                  <Textarea
                    value={newCompany.notes}
                    onChange={(e) => setNewCompany({ ...newCompany, notes: e.target.value })}
                    placeholder="ملاحظات إضافية"
                    rows={3}
                  />
                </div>
              </div>
              
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => setIsAddingCompany(false)}>
                  إلغاء
                </Button>
                <Button onClick={handleAddCompany}>
                  إضافة
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Building2 className="h-4 w-4" />
                الشركات الصديقة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{friendCompanies?.length || 0}</div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <MapPin className="h-4 w-4" />
                إجمالي الإيجارات
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{totalRentals}</div>
              <p className="text-sm text-muted-foreground">منها {activeRentals} نشط</p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <DollarSign className="h-4 w-4" />
                إجمالي التكلفة
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {totalCost.toLocaleString('ar-LY')} د.ل
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Calendar className="h-4 w-4" />
                صافي الربح
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {totalProfit.toLocaleString('ar-LY')} د.ل
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Friend Companies Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              الشركات الصديقة
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>اسم الشركة</TableHead>
                  <TableHead>الشخص المسؤول</TableHead>
                  <TableHead>رقم الهاتف</TableHead>
                  <TableHead>البريد الإلكتروني</TableHead>
                  <TableHead className="text-center">عدد الإيجارات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {friendCompanies?.map((company) => (
                  <TableRow key={company.id}>
                    <TableCell className="font-medium">{company.name}</TableCell>
                    <TableCell>{company.contact_person || '-'}</TableCell>
                    <TableCell>
                      {company.phone && (
                        <div className="flex items-center gap-1">
                          <Phone className="h-3 w-3" />
                          {company.phone}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      {company.email && (
                        <div className="flex items-center gap-1">
                          <Mail className="h-3 w-3" />
                          {company.email}
                        </div>
                      )}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary">
                        {friendBillboards?.filter(b => b.friend_company_id === company.id).length || 0}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Search */}
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="بحث في اللوحات..."
            className="pr-10"
          />
        </div>

        {/* Friend Billboards as Cards */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              اللوحات المستأجرة من الأصدقاء
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredBillboards?.map((billboard, index) => (
                <Card 
                  key={`${billboard.billboard_id}-${billboard.contract_number}-${index}`}
                  className="overflow-hidden hover:shadow-lg transition-shadow"
                >
                  {/* Card Header with Billboard Name */}
                  <div className="bg-gradient-to-l from-slate-700 to-slate-800 text-white p-3">
                    <div className="flex justify-between items-start">
                      <div className="flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        <span className="font-bold truncate">{billboard.billboard_name}</span>
                      </div>
                      {getStatusBadge(billboard.status)}
                    </div>
                  </div>
                  
                  {/* Card Body */}
                  <div className="p-4 space-y-3">
                    {/* Size & Location */}
                    <div className="flex items-center justify-between">
                      <Badge variant="outline" className="text-sm">{billboard.billboard_size}</Badge>
                      <span className="text-sm text-muted-foreground">{billboard.municipality}</span>
                    </div>
                    
                    {/* Company */}
                    <div className="flex items-center gap-2 text-sm">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">{billboard.friend_company_name}</span>
                    </div>
                    
                    {/* Contract & Duration */}
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">عقد #{billboard.contract_number}</span>
                      <Badge className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                        {billboard.duration_days} يوم
                      </Badge>
                    </div>
                    
                    {/* Dates */}
                    <div className="text-xs text-muted-foreground bg-muted/50 rounded p-2 text-center">
                      {new Date(billboard.start_date).toLocaleDateString('ar-LY')} - {new Date(billboard.end_date).toLocaleDateString('ar-LY')}
                    </div>
                  </div>
                  
                  {/* Card Footer */}
                  <div className="border-t p-3 flex justify-between items-center bg-muted/20">
                    <div className="flex gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">التكلفة</p>
                        <p className="text-sm font-bold text-red-600">
                          {billboard.friend_rental_cost.toLocaleString('ar-LY')} د.ل
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">الربح</p>
                        <p className="text-sm font-bold text-green-600">
                          {billboard.profit.toLocaleString('ar-LY')} د.ل
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePrintInvoice(billboard)}
                    >
                      <Printer className="h-4 w-4" />
                    </Button>
                  </div>
                </Card>
              ))}
            </div>
            
            {filteredBillboards?.length === 0 && (
              <div className="text-center py-12 text-muted-foreground">
                {searchQuery ? 'لا توجد نتائج للبحث' : 'لا توجد لوحات مستأجرة من الأصدقاء'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
