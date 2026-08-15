-- إضافة عمود لعنوان الفاتورة في جدول فواتير المشتريات
ALTER TABLE purchase_invoices 
ADD COLUMN IF NOT EXISTS invoice_name TEXT DEFAULT 'فاتورة مشتريات';