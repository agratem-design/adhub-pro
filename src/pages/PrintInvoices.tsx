// @ts-nocheck
import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { Printer, Plus, FileText, Calculator } from 'lucide-react';
import { uploadToImgbb } from '@/services/imgbbService';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/components/ui/sonner';
import { supabase } from '@/integrations/supabase/client';

interface PrintInvoice {
  id: string;
  contract_number: number;
  invoice_number: string;
  customer_id: string | null;
  customer_name: string | null;
  printer_name: string;
  invoice_date: string;
  total_amount: number | null;
  notes: string | null;
  design_face_a_path: string | null;
  design_face_b_path: string | null;
  created_at: string;
  updated_at: string;
}

interface CustomerOption {
  id: string;
  name: string;
}

interface ContractOption {
  contractNumber: number;
  customerName: string | null;
}

const generateInvoiceNumber = () => {
  const timestamp = new Date().getTime();
  return `PRINT-${timestamp}`;
};

const sanitizeFileName = (value: string) => value.replace(/[^a-zA-Z0-9_.-]/g, '_');

export const PrintInvoices = () => {
  const navigate = useNavigate();
  const [invoices, setInvoices] = useState<PrintInvoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState<PrintInvoice | null>(null);
  const [customers, setCustomers] = useState<CustomerOption[]>([]);
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [formState, setFormState] = useState({
    customerId: '',
    customerName: '',
    contractNumber: '',
    printerName: '',
    invoiceDate: new Date().toISOString().slice(0, 10),
    totalAmount: '',
    printerCost: '',
    notes: '',
    invoiceNumber: generateInvoiceNumber(),
  });
  const [faceAFile, setFaceAFile] = useState<File | null>(null);
  const [faceBFile, setFaceBFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [contractsLoading, setContractsLoading] = useState(false);

  useEffect(() => {
    const loadData = async () => {
      await Promise.all([fetchInvoices(), fetchCustomers()]);
    };

    loadData();
  }, []);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('print_invoices')
        .select('*')
        .order('invoice_date', { ascending: false });

      if (error) {
        console.error(error);
        toast.error('فشل في جلب فواتير الطباعة');
        return;
      }

      const normalized: PrintInvoice[] = (data || []).map((row) => ({
        ...row,
        total_amount: row.total_amount === null || row.total_amount === undefined ? null : Number(row.total_amount),
      }));

      setInvoices(normalized);
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء تحميل البيانات');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomers = async () => {
    try {
      const { data, error } = await supabase
        .from('customers')
        .select('id, name')
        .order('name', { ascending: true });

      if (error) {
        console.error(error);
        toast.error('فشل في جلب العملاء');
        return;
      }

      const transformed = (data || [])
        .filter((item): item is { id: string; name: string } => Boolean(item?.id && item?.name))
        .map((item) => ({ id: item.id, name: item.name as string }));

      setCustomers(transformed);
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء تحميل العملاء');
    }
  };

  const fetchContractsForCustomer = async (customerId: string) => {
    if (!customerId) {
      setContracts([]);
      return;
    }

    setContractsLoading(true);
    try {
      const { data, error } = await supabase
        .from('Contract')
        .select('Contract_Number, "Customer Name"')
        .eq('customer_id', customerId)
        .order('Contract_Number', { ascending: false });

      if (error) {
        console.error(error);
        toast.error('فشل في جلب عقود العميل');
        return;
      }

      const transformed: ContractOption[] = (data || []).map((row) => ({
        contractNumber: row.Contract_Number,
        customerName: row['Customer Name'],
      }));

      setContracts(transformed);
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ في تحميل العقود');
    } finally {
      setContractsLoading(false);
    }
  };

  const resetForm = () => {
    setFormState({
      customerId: '',
      customerName: '',
      contractNumber: '',
      printerName: '',
      invoiceDate: new Date().toISOString().slice(0, 10),
      totalAmount: '',
      printerCost: '',
      notes: '',
      invoiceNumber: generateInvoiceNumber(),
    });
    setFaceAFile(null);
    setFaceBFile(null);
    setContracts([]);
  };

  const closeAddDialog = () => {
    setAddDialogOpen(false);
    resetForm();
  };

  const formattedInvoices = useMemo(() => {
    return invoices.map((invoice) => ({
      ...invoice,
      formattedDate: invoice.invoice_date
        ? format(new Date(invoice.invoice_date), 'd MMMM yyyy', { locale: ar })
        : '',
    }));
  }, [invoices]);

  const handleCustomerChange = (customerId: string) => {
    const selected = customers.find((item) => item.id === customerId);
    setFormState((prev) => ({
      ...prev,
      customerId,
      customerName: selected?.name || '',
      contractNumber: '',
    }));
    fetchContractsForCustomer(customerId);
  };

  const handleContractChange = (value: string) => {
    setFormState((prev) => ({
      ...prev,
      contractNumber: value,
    }));
  };

  const uploadDesign = async (file: File, contractNumber: string, face: 'a' | 'b') => {
    const { createUploadProgressTracker } = await import('@/hooks/useUploadProgress');
    const progress = createUploadProgressTracker();
    const imageName = `print-invoice-${sanitizeFileName(contractNumber)}-face-${face}.jpg`;
    const fileSizeKB = Math.round(file.size / 1024);
    progress.start(imageName, fileSizeKB);

    let pct = 5;
    const interval = setInterval(() => {
      if (pct < 30) pct += 5;
      else if (pct < 70) pct += 3;
      else if (pct < 90) pct += 1;
      progress.update(pct);
    }, 250);

    try {
      const { uploadImageWithFallback } = await import('@/services/imageUploadService');
      const imageUrl = await uploadImageWithFallback(file, imageName, `print-invoices/C${sanitizeFileName(contractNumber)}`);
      clearInterval(interval);
      progress.update(100);
      progress.complete(true, 'تم رفع تصميم أمر الطباعة بنجاح');
      return imageUrl;
    } catch (err: any) {
      clearInterval(interval);
      progress.complete(false, err.message || 'فشل رفع التصميم');
      throw err;
    }
  };

  const handleSubmit = async () => {
    if (!formState.customerId || !formState.contractNumber || !formState.printerName) {
      toast.error('يرجى إدخال بيانات العميل والعقد واسم المطبعة');
      return;
    }

    const contractNumber = formState.contractNumber;
    const invoiceDate = formState.invoiceDate || new Date().toISOString().slice(0, 10);

    setSubmitting(true);

    try {
      let designAPath: string | null = null;
      let designBPath: string | null = null;

      if (faceAFile) {
        designAPath = await uploadDesign(faceAFile, contractNumber, 'a');
      }

      if (faceBFile) {
        designBPath = await uploadDesign(faceBFile, contractNumber, 'b');
      }

      const payload = {
        contract_number: Number(contractNumber),
        invoice_number: formState.invoiceNumber,
        customer_id: formState.customerId || null,
        customer_name: formState.customerName || null,
        printer_name: formState.printerName,
        invoice_date: invoiceDate,
        total_amount: formState.totalAmount ? Number(formState.totalAmount) : null,
        printer_cost: formState.printerCost ? Number(formState.printerCost) : null,
        notes: formState.notes || null,
        design_face_a_path: designAPath,
        design_face_b_path: designBPath,
      };

      const { error } = await supabase.from('print_invoices').insert(payload);

      if (error) {
        console.error(error);
        toast.error('فشل في حفظ فاتورة الطباعة');
        return;
      }

      toast.success('تم إضافة فاتورة الطباعة بنجاح');
      closeAddDialog();
      fetchInvoices();
    } catch (error) {
      console.error(error);
      toast.error('حدث خطأ أثناء حفظ الفاتورة');
    } finally {
      setSubmitting(false);
    }
  };

  const openDetails = (invoice: PrintInvoice) => {
    setSelectedInvoice(invoice);
    setDetailsDialogOpen(true);
  };

  const closeDetails = () => {
    setSelectedInvoice(null);
    setDetailsDialogOpen(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">فواتير الطباعة</h1>
          <p className="text-muted-foreground">إدارة جميع فواتير الطباعة الخاصة بالعملاء وتصاميم الطباعة</p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate('/admin/customer-billing?modernPrint=1')}
            className="flex items-center gap-2"
          >
            <Calculator className="h-5 w-5" />
            <span>فاتورة طباعة عصرية</span>
          </Button>
          <Button onClick={() => setAddDialogOpen(true)} className="flex items-center gap-2">
            <Plus className="h-5 w-5" />
            <span>إضافة فاتورة طباعة</span>
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Printer className="h-5 w-5" />
            <span>قائمة الفواتير</span>
          </CardTitle>
          <Badge variant="outline">{invoices.length} فاتورة</Badge>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="py-12 text-center text-muted-foreground">جاري تحميل البيانات...</div>
          ) : invoices.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground">لا توجد فواتير طباعة مسجلة حالياً</div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">رقم الفاتورة</TableHead>
                  <TableHead className="text-right">العميل</TableHead>
                  <TableHead className="text-right">رقم العقد</TableHead>
                  <TableHead className="text-right">اسم المطبعة</TableHead>
                  <TableHead className="text-right">تاريخ الفاتورة</TableHead>
                  <TableHead className="text-right">المبلغ الإجمالي</TableHead>
                  <TableHead className="text-right">التصاميم</TableHead>
                  <TableHead className="text-right">إجراءات</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {formattedInvoices.map((invoice) => (
                  <TableRow key={invoice.id}>
                    <TableCell className="text-right font-medium">{invoice.invoice_number}</TableCell>
                    <TableCell className="text-right">{invoice.customer_name || 'غير محدد'}</TableCell>
                    <TableCell className="text-right">{invoice.contract_number}</TableCell>
                    <TableCell className="text-right">{invoice.printer_name}</TableCell>
                    <TableCell className="text-right">{invoice.formattedDate}</TableCell>
                    <TableCell className="text-right">
                      {typeof invoice.total_amount === 'number'
                        ? `${invoice.total_amount.toLocaleString()} د.ل`
                        : '—'}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2 text-sm">
                        {invoice.design_face_a_path ? (
                          <a
                            href={invoice.design_face_a_path}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline"
                          >
                            وجه A
                          </a>
                        ) : (
                          <span className="text-muted-foreground">لا يوجد</span>
                        )}
                        {invoice.design_face_b_path ? (
                          <a
                            href={invoice.design_face_b_path}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline"
                          >
                            وجه B
                          </a>
                        ) : (
                          <span className="text-muted-foreground">لا يوجد</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => openDetails(invoice)} className="gap-2">
                        <FileText className="h-4 w-4" />
                        عرض التفاصيل
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={addDialogOpen} onOpenChange={(open) => (open ? setAddDialogOpen(true) : closeAddDialog())}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>إنشاء فاتورة طباعة جديدة</DialogTitle>
          </DialogHeader>

          <div className="grid gap-4 pt-2">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="customer">العميل</Label>
                <Select
                  value={formState.customerId}
                  onValueChange={handleCustomerChange}
                >
                  <SelectTrigger id="customer">
                    <SelectValue placeholder="اختر العميل" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((customer) => (
                      <SelectItem key={customer.id} value={customer.id}>
                        {customer.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="contract">رقم العقد</Label>
                <Select
                  value={formState.contractNumber}
                  onValueChange={handleContractChange}
                  disabled={!formState.customerId || contractsLoading}
                >
                  <SelectTrigger id="contract">
                    <SelectValue placeholder={contractsLoading ? 'جاري التحميل...' : 'اختر العقد'} />
                  </SelectTrigger>
                  <SelectContent>
                    {contracts.map((contract) => (
                      <SelectItem key={contract.contractNumber} value={String(contract.contractNumber)}>
                        {contract.contractNumber}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="printerName">اسم المطبعة</Label>
                <Input
                  id="printerName"
                  value={formState.printerName}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, printerName: event.target.value }))
                  }
                  placeholder="أدخل اسم المطبعة"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="invoiceDate">تاريخ الفاتورة</Label>
                <Input
                  type="date"
                  id="invoiceDate"
                  value={formState.invoiceDate}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, invoiceDate: event.target.value }))
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="invoiceNumber">رقم الفاتورة</Label>
                <Input
                  id="invoiceNumber"
                  value={formState.invoiceNumber}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, invoiceNumber: event.target.value }))
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="totalAmount">المبلغ الإجمالي (للعميل)</Label>
                <Input
                  type="number"
                  id="totalAmount"
                  value={formState.totalAmount}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, totalAmount: event.target.value }))
                  }
                  placeholder="0.00"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="printerCost">تكلفة المطبعة (سعر التكلفة)</Label>
                <Input
                  type="number"
                  id="printerCost"
                  value={formState.printerCost}
                  onChange={(event) =>
                    setFormState((prev) => ({ ...prev, printerCost: event.target.value }))
                  }
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2 flex items-end">
                <div className="p-3 bg-purple-50 dark:bg-purple-950 rounded-lg border border-purple-200 dark:border-purple-800 w-full">
                  <p className="text-sm text-muted-foreground mb-1">الربح المتوقع</p>
                  <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
                    {((Number(formState.totalAmount) || 0) - (Number(formState.printerCost) || 0)).toLocaleString('ar-LY')} د.ل
                  </p>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">ملاحظات للمطبعة</Label>
              <Textarea
                id="notes"
                value={formState.notes}
                onChange={(event) =>
                  setFormState((prev) => ({ ...prev, notes: event.target.value }))
                }
                placeholder="أدخل أي تعليمات أو ملاحظات إضافية"
                rows={3}
              />
            </div>

            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="faceA">تصميم الوجه A</Label>
                <Input
                  id="faceA"
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf,.svg"
                  onChange={(event) => setFaceAFile(event.target.files?.[0] ?? null)}
                />
                {faceAFile ? <p className="text-sm text-muted-foreground">{faceAFile.name}</p> : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="faceB">تصميم الوجه B</Label>
                <Input
                  id="faceB"
                  type="file"
                  accept=".jpg,.jpeg,.png,.pdf,.svg"
                  onChange={(event) => setFaceBFile(event.target.files?.[0] ?? null)}
                />
                {faceBFile ? <p className="text-sm text-muted-foreground">{faceBFile.name}</p> : null}
              </div>
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={closeAddDialog} disabled={submitting}>
              إلغاء
            </Button>
            <Button onClick={handleSubmit} disabled={submitting} className="gap-2">
              <Printer className="h-4 w-4" />
              {submitting ? 'جاري الحفظ...' : 'حفظ الفاتورة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={detailsDialogOpen} onOpenChange={(open) => (open ? setDetailsDialogOpen(true) : closeDetails())}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>تفاصيل فاتورة الطباعة</DialogTitle>
          </DialogHeader>
          {selectedInvoice ? (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <p className="text-sm text-muted-foreground">رقم الفا��ورة</p>
                  <p className="text-base font-semibold">{selectedInvoice.invoice_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">تاريخ الفاتورة</p>
                  <p className="text-base font-semibold">
                    {selectedInvoice.invoice_date
                      ? format(new Date(selectedInvoice.invoice_date), 'd MMMM yyyy', { locale: ar })
                      : 'غير محدد'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">العميل</p>
                  <p className="text-base font-semibold">{selectedInvoice.customer_name || 'غير محدد'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">رقم العقد</p>
                  <p className="text-base font-semibold">{selectedInvoice.contract_number}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">اسم المطبعة</p>
                  <p className="text-base font-semibold">{selectedInvoice.printer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">المبلغ الإجمالي</p>
                  <p className="text-base font-semibold">
                    {typeof selectedInvoice.total_amount === 'number'
                      ? `${selectedInvoice.total_amount.toLocaleString()} د.ل`
                      : '—'}
                  </p>
                </div>
              </div>

              <div>
                <p className="text-sm text-muted-foreground mb-2">ملاحظات</p>
                <div className="rounded-lg border bg-muted/30 p-3 text-sm leading-relaxed">
                  {selectedInvoice.notes || 'لا توجد ملاحظات'}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">تصميم الوجه A</p>
                  {selectedInvoice.design_face_a_path ? (
                    <a
                      href={selectedInvoice.design_face_a_path}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-lg border p-3 text-center text-sm text-primary underline"
                    >
                      فتح التصميم
                    </a>
                  ) : (
                    <div className="rounded-lg border p-3 text-center text-sm text-muted-foreground">لا يوجد ملف</div>
                  )}
                </div>
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">تصميم الوجه B</p>
                  {selectedInvoice.design_face_b_path ? (
                    <a
                      href={selectedInvoice.design_face_b_path}
                      target="_blank"
                      rel="noreferrer"
                      className="block rounded-lg border p-3 text-center text-sm text-primary underline"
                    >
                      فتح التصميم
                    </a>
                  ) : (
                    <div className="rounded-lg border p-3 text-center text-sm text-muted-foreground">لا يوجد ملف</div>
                  )}
                </div>
              </div>

              <div className="text-sm text-muted-foreground">
                <p>تاريخ الإنشاء: {format(new Date(selectedInvoice.created_at), 'd MMMM yyyy، hh:mm a', { locale: ar })}</p>
                <p>آخر تحديث: {format(new Date(selectedInvoice.updated_at), 'd MMMM yyyy، hh:mm a', { locale: ar })}</p>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PrintInvoices;
