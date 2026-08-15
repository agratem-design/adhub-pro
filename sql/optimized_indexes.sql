-- ==============================================================================
-- فهارس تحسين أداء استعلامات قاعدة البيانات (PostgreSQL Database Indexes)
-- نظام الفارس الذهبي للدعاية والإعلان
-- ==============================================================================

-- 1. فهارس جدول اللوحات الإعلانية (billboards)
CREATE INDEX IF NOT EXISTS idx_billboards_city_status ON "billboards" ("City", "Status");
CREATE INDEX IF NOT EXISTS idx_billboards_contract_number ON "billboards" ("Contract_Number");
CREATE INDEX IF NOT EXISTS idx_billboards_municipality ON "billboards" ("Municipality");
CREATE INDEX IF NOT EXISTS idx_billboards_level ON "billboards" ("Level");
CREATE INDEX IF NOT EXISTS idx_billboards_size ON "billboards" ("Size");

-- 2. فهارس جدول العقود (Contract)
CREATE INDEX IF NOT EXISTS idx_contract_customer_id ON "Contract" ("customer_id");
CREATE INDEX IF NOT EXISTS idx_contract_number ON "Contract" ("Contract_Number");
CREATE INDEX IF NOT EXISTS idx_contract_end_date ON "Contract" ("End Date");
CREATE INDEX IF NOT EXISTS idx_contract_contract_date ON "Contract" ("Contract Date");

-- 3. فهارس جدول مدفوعات العملاء (customer_payments)
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_id ON "customer_payments" ("customer_id");
CREATE INDEX IF NOT EXISTS idx_customer_payments_contract_number ON "customer_payments" ("contract_number");
CREATE INDEX IF NOT EXISTS idx_customer_payments_paid_at ON "customer_payments" ("paid_at");
CREATE INDEX IF NOT EXISTS idx_customer_payments_entry_type ON "customer_payments" ("entry_type");

-- 4. فهارس فواتير المبيعات والطباعة (Invoices)
CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer_id ON "sales_invoices" ("customer_id");
CREATE INDEX IF NOT EXISTS idx_printed_invoices_customer_id ON "printed_invoices" ("customer_id");
CREATE INDEX IF NOT EXISTS idx_purchase_invoices_customer_id ON "purchase_invoices" ("customer_id");

-- 5. فهارس المهام المجمعة والتنفيذية (Tasks)
CREATE INDEX IF NOT EXISTS idx_composite_tasks_customer_id ON "composite_tasks" ("customer_id");
CREATE INDEX IF NOT EXISTS idx_installation_tasks_billboard_id ON "installation_tasks" ("billboard_id");
CREATE INDEX IF NOT EXISTS idx_print_tasks_billboard_id ON "print_tasks" ("billboard_id");

-- 6. فهارس المستخدمين وسجلات النظام (Users & Profiles)
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON "user_roles" ("user_id");
CREATE INDEX IF NOT EXISTS idx_profiles_username ON "profiles" ("username");
CREATE INDEX IF NOT EXISTS idx_profiles_phone ON "profiles" ("phone");
