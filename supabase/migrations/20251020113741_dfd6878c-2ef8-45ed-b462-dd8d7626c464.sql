-- إضافة عمود لحفظ قيمة الخصم من رصيد حساب الزبون في فواتير الطباعة
ALTER TABLE printed_invoices 
ADD COLUMN IF NOT EXISTS account_deduction numeric DEFAULT 0;

COMMENT ON COLUMN printed_invoices.account_deduction IS 'مبلغ الخصم من رصيد حساب الزبون';