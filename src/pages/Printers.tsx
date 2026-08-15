import { useAuth } from '@/contexts/AuthContext';
import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Plus, Edit, Trash2, Printer, Phone, Mail, MapPin, Save, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

interface PrinterData {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
}

interface PrintedInvoice {
  id: string;
  invoice_number: string;
  customer_name: string | null;
  invoice_date: string;
  total_amount: number;
  paid_amount: number | null;
  notes: string | null;
}

export default function Printers() {
  const { canEdit: canEditAuth } = useAuth();
  const canEditSection = canEditAuth('printers');
  const [printers, setPrinters] = useState<PrinterData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [invoicesDialogOpen, setInvoicesDialogOpen] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState<PrinterData | null>(null);
  const [printerToDelete, setPrinterToDelete] = useState<PrinterData | null>(null);
  const [printerInvoices, setPrinterInvoices] = useState<PrintedInvoice[]>([]);
  const [loadingInvoices, setLoadingInvoices] = useState(false);

  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    is_active: true
  });

  useEffect(() => {
    loadPrinters();
  }, []);

  const loadPrinters = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('printers')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPrinters(data || []);
    } catch (error) {
      console.error('Error loading printers:', error);
      toast.error('فشل في تحميل المطابع');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenDialog = (printer?: PrinterData) => {
    if (printer) {
      setSelectedPrinter(printer);
      setFormData({
        name: printer.name,
        phone: printer.phone || '',
        email: printer.email || '',
        address: printer.address || '',
        notes: printer.notes || '',
        is_active: printer.is_active
      });
    } else {
      setSelectedPrinter(null);
      setFormData({
        name: '',
        phone: '',
        email: '',
        address: '',
        notes: '',
        is_active: true
      });
    }
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      toast.error('الرجاء إدخال اسم المطبعة');
      return;
    }

    try {
      if (selectedPrinter) {
        const { error } = await supabase
          .from('printers')
          .update({
            name: formData.name,
            phone: formData.phone || null,
            email: formData.email || null,
            address: formData.address || null,
            notes: formData.notes || null,
            is_active: formData.is_active
          })
          .eq('id', selectedPrinter.id);

        if (error) throw error;
        toast.success('تم تحديث المطبعة بنجاح');
      } else {
        const { error } = await supabase
          .from('printers')
          .insert({
            name: formData.name,
            phone: formData.phone || null,
            email: formData.email || null,
            address: formData.address || null,
            notes: formData.notes || null,
            is_active: formData.is_active
          });

        if (error) throw error;
        toast.success('تم إضافة المطبعة بنجاح');
      }

      setDialogOpen(false);
      loadPrinters();
    } catch (error) {
      console.error('Error saving printer:', error);
      toast.error('فشل في حفظ المطبعة');
    }
  };

  const handleDelete = async () => {
    if (!printerToDelete) return;

    try {
      const { error } = await supabase
        .from('printers')
        .delete()
        .eq('id', printerToDelete.id);

      if (error) throw error;
      toast.success('تم حذف المطبعة بنجاح');
      loadPrinters();
    } catch (error) {
      console.error('Error deleting printer:', error);
      toast.error('فشل في حذف المطبعة');
    } finally {
      setDeleteDialogOpen(false);
      setPrinterToDelete(null);
    }
  };

  const handleViewInvoices = async (printer: PrinterData) => {
    setSelectedPrinter(printer);
    setInvoicesDialogOpen(true);
    setLoadingInvoices(true);

    try {
      const { data, error } = await supabase
        .from('printed_invoices')
        .select('id, invoice_number, customer_name, invoice_date, total_amount, paid_amount, notes')
        .eq('printer_id', printer.id)
        .order('invoice_date', { ascending: false });

      if (error) throw error;
      setPrinterInvoices((data || []) as PrintedInvoice[]);
    } catch (error) {
      console.error('Error loading invoices:', error);
      toast.error('فشل في تحميل الفواتير');
      setPrinterInvoices([]);
    } finally {
      setLoadingInvoices(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">إدارة المطابع</h1>
        {canEditSection && (
          <Button onClick={() => handleOpenDialog()} className="gap-2" size="sm">
            <Plus className="h-4 w-4" />
            إضافة مطبعة
          </Button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center p-8">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {printers.map((printer) => (
            <Card 
              key={printer.id} 
              className="bg-card border-border cursor-pointer hover:border-primary transition-colors"
              onClick={() => handleViewInvoices(printer)}
            >
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Printer className="h-5 w-5 text-primary" />
                    <span>{printer.name}</span>
                  </div>
                  <Badge variant={printer.is_active ? 'default' : 'secondary'}>
                    {printer.is_active ? 'نشط' : 'غير نشط'}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2" onClick={(e) => e.stopPropagation()}>
                {printer.phone && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span dir="ltr">{printer.phone}</span>
                  </div>
                )}
                {printer.email && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{printer.email}</span>
                  </div>
                )}
                {printer.address && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <MapPin className="h-4 w-4" />
                    <span>{printer.address}</span>
                  </div>
                )}
                {printer.notes && (
                  <p className="text-xs text-muted-foreground mt-2">
                    {printer.notes}
                  </p>
                )}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleOpenDialog(printer)}
                    className="flex-1"
                  >
                    <Edit className="h-4 w-4 ml-2" />
                    تعديل
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      setPrinterToDelete(printer);
                      setDeleteDialogOpen(true);
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {printers.length === 0 && !loading && (
        <Card className="bg-card border-border">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Printer className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-4">لا توجد مطابع مسجلة</p>
            <Button onClick={() => handleOpenDialog()}>
              <Plus className="h-4 w-4 ml-2" />
              إضافة مطبعة
            </Button>
          </CardContent>
        </Card>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>
              {selectedPrinter ? 'تعديل المطبعة' : 'إضافة مطبعة جديدة'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="name">اسم المطبعة *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="أدخل اسم المطبعة"
              />
            </div>
            <div>
              <Label htmlFor="phone">رقم الهاتف</Label>
              <Input
                id="phone"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="أدخل رقم الهاتف"
                dir="ltr"
              />
            </div>
            <div>
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="أدخل البريد الإلكتروني"
              />
            </div>
            <div>
              <Label htmlFor="address">العنوان</Label>
              <Input
                id="address"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="أدخل العنوان"
              />
            </div>
            <div>
              <Label htmlFor="notes">ملاحظات</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="أدخل ملاحظات إضافية"
                rows={3}
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                className="rounded border-border"
              />
              <Label htmlFor="is_active">نشط</Label>
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                <X className="h-4 w-4 ml-2" />
                إلغاء
              </Button>
              <Button onClick={handleSave}>
                <Save className="h-4 w-4 ml-2" />
                حفظ
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذه المطبعة؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground">
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={invoicesDialogOpen} onOpenChange={setInvoicesDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              فواتير الطباعة - {selectedPrinter?.name}
            </DialogTitle>
          </DialogHeader>
          
          {loadingInvoices ? (
            <div className="flex justify-center p-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
            </div>
          ) : printerInvoices.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              لا توجد فواتير طباعة لهذه المطبعة
            </div>
          ) : (
            <div className="space-y-4">
              {printerInvoices.map((invoice) => (
                <Card key={invoice.id} className="bg-card border-border">
                  <CardContent className="pt-4">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">رقم الفاتورة</p>
                        <p className="font-medium">{invoice.invoice_number}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">اسم العميل</p>
                        <p className="font-medium">{invoice.customer_name || '-'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">تاريخ الفاتورة</p>
                        <p className="font-medium">
                          {new Date(invoice.invoice_date).toLocaleDateString('en-GB')}
                        </p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">المبلغ الإجمالي</p>
                        <p className="font-medium">{invoice.total_amount.toLocaleString()} د.ل</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">المبلغ المدفوع</p>
                        <p className="font-medium text-green-600">{(invoice.paid_amount || 0).toLocaleString()} د.ل</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">المبلغ المتبقي</p>
                        <p className="font-medium text-destructive">
                          {(invoice.total_amount - (invoice.paid_amount || 0)).toLocaleString()} د.ل
                        </p>
                      </div>
                      {invoice.notes && (
                        <div className="col-span-2 md:col-span-3">
                          <p className="text-xs text-muted-foreground">ملاحظات</p>
                          <p className="text-sm">{invoice.notes}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
