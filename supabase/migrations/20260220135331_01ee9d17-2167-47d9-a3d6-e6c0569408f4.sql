
-- =============================================
-- إصلاح سياسات RLS الأمنية
-- تحويل USING(true) إلى سياسات تستخدم has_permission()
-- =============================================

-- 1. customers - بيانات العملاء
DROP POLICY IF EXISTS "Anyone can view customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can view customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can manage customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can insert customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can update customers" ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can delete customers" ON public.customers;
DROP POLICY IF EXISTS "Public can view customers" ON public.customers;

CREATE POLICY "Users with permission can view customers"
  ON public.customers FOR SELECT TO authenticated
  USING (has_permission(auth.uid(), 'customers'));

CREATE POLICY "Users with permission can insert customers"
  ON public.customers FOR INSERT TO authenticated
  WITH CHECK (has_permission(auth.uid(), 'customers'));

CREATE POLICY "Users with permission can update customers"
  ON public.customers FOR UPDATE TO authenticated
  USING (has_permission(auth.uid(), 'customers'));

CREATE POLICY "Users with permission can delete customers"
  ON public.customers FOR DELETE TO authenticated
  USING (has_permission(auth.uid(), 'customers'));

-- 2. profiles - بيانات المستخدمين
DROP POLICY IF EXISTS "Anyone can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Public can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can view profiles" ON public.profiles;
DROP POLICY IF EXISTS "Authenticated users can manage profiles" ON public.profiles;

CREATE POLICY "Users can view own profile"
  ON public.profiles FOR SELECT TO authenticated
  USING (id = auth.uid() OR has_role(auth.uid(), 'admin'));

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- 3. expenses - المصروفات
DROP POLICY IF EXISTS "Anyone can view expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated users can view expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated users can manage expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated users can insert expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated users can update expenses" ON public.expenses;
DROP POLICY IF EXISTS "Authenticated users can delete expenses" ON public.expenses;

CREATE POLICY "Users with permission can view expenses"
  ON public.expenses FOR SELECT TO authenticated
  USING (has_permission(auth.uid(), 'expenses'));

CREATE POLICY "Users with permission can insert expenses"
  ON public.expenses FOR INSERT TO authenticated
  WITH CHECK (has_permission(auth.uid(), 'expenses'));

CREATE POLICY "Users with permission can update expenses"
  ON public.expenses FOR UPDATE TO authenticated
  USING (has_permission(auth.uid(), 'expenses'));

CREATE POLICY "Users with permission can delete expenses"
  ON public.expenses FOR DELETE TO authenticated
  USING (has_permission(auth.uid(), 'expenses'));

-- 4. printers - الطابعين
DROP POLICY IF EXISTS "Anyone can view printers" ON public.printers;
DROP POLICY IF EXISTS "Authenticated users can view printers" ON public.printers;
DROP POLICY IF EXISTS "Authenticated users can manage printers" ON public.printers;
DROP POLICY IF EXISTS "Public read printers" ON public.printers;

CREATE POLICY "Users with permission can view printers"
  ON public.printers FOR SELECT TO authenticated
  USING (has_permission(auth.uid(), 'printers'));

CREATE POLICY "Users with permission can manage printers"
  ON public.printers FOR ALL TO authenticated
  USING (has_permission(auth.uid(), 'printers'))
  WITH CHECK (has_permission(auth.uid(), 'printers'));

-- 5. purchase_invoices - فواتير المشتريات
DROP POLICY IF EXISTS "Anyone can view purchase_invoices" ON public.purchase_invoices;
DROP POLICY IF EXISTS "Authenticated users can view purchase_invoices" ON public.purchase_invoices;
DROP POLICY IF EXISTS "Authenticated users can manage purchase_invoices" ON public.purchase_invoices;
DROP POLICY IF EXISTS "Authenticated users manage purchase_invoices" ON public.purchase_invoices;
DROP POLICY IF EXISTS "Public can view purchase invoices" ON public.purchase_invoices;

CREATE POLICY "Users with permission can view purchase_invoices"
  ON public.purchase_invoices FOR SELECT TO authenticated
  USING (has_permission(auth.uid(), 'expenses'));

CREATE POLICY "Users with permission can manage purchase_invoices"
  ON public.purchase_invoices FOR ALL TO authenticated
  USING (has_permission(auth.uid(), 'expenses'))
  WITH CHECK (has_permission(auth.uid(), 'expenses'));

-- 6. custody_accounts - العُهد المالية
DROP POLICY IF EXISTS "Authenticated users can manage custody_accounts" ON public.custody_accounts;
DROP POLICY IF EXISTS "Authenticated users manage custody" ON public.custody_accounts;

CREATE POLICY "Users with permission can manage custody_accounts"
  ON public.custody_accounts FOR ALL TO authenticated
  USING (has_permission(auth.uid(), 'custody'))
  WITH CHECK (has_permission(auth.uid(), 'custody'));

-- 7. custody_expenses
DROP POLICY IF EXISTS "Authenticated users can manage custody_expenses" ON public.custody_expenses;
DROP POLICY IF EXISTS "Authenticated users manage custody expenses" ON public.custody_expenses;

CREATE POLICY "Users with permission can manage custody_expenses"
  ON public.custody_expenses FOR ALL TO authenticated
  USING (has_permission(auth.uid(), 'custody'))
  WITH CHECK (has_permission(auth.uid(), 'custody'));

-- 8. custody_transactions
DROP POLICY IF EXISTS "Authenticated users can manage custody_transactions" ON public.custody_transactions;
DROP POLICY IF EXISTS "Authenticated users manage custody transactions" ON public.custody_transactions;

CREATE POLICY "Users with permission can manage custody_transactions"
  ON public.custody_transactions FOR ALL TO authenticated
  USING (has_permission(auth.uid(), 'custody'))
  WITH CHECK (has_permission(auth.uid(), 'custody'));

-- 9. billboard_history - تاريخ اللوحات
DROP POLICY IF EXISTS "Authenticated users can insert billboard history" ON public.billboard_history;
DROP POLICY IF EXISTS "Authenticated users can update billboard history" ON public.billboard_history;

CREATE POLICY "Permitted users can insert billboard history"
  ON public.billboard_history FOR INSERT TO authenticated
  WITH CHECK (has_permission(auth.uid(), 'billboards'));

CREATE POLICY "Permitted users can update billboard history"
  ON public.billboard_history FOR UPDATE TO authenticated
  USING (has_permission(auth.uid(), 'billboards'));

-- 10. base_prices - الأسعار
DROP POLICY IF EXISTS "Authenticated users can manage base_prices" ON public.base_prices;

CREATE POLICY "Permitted users can manage base_prices"
  ON public.base_prices FOR ALL TO authenticated
  USING (has_permission(auth.uid(), 'pricing'))
  WITH CHECK (has_permission(auth.uid(), 'pricing'));

-- 11. customer_payments - دفعات العملاء
DROP POLICY IF EXISTS "Authenticated users can manage customer_payments" ON public.customer_payments;
DROP POLICY IF EXISTS "Authenticated users manage customer payments" ON public.customer_payments;

CREATE POLICY "Users with permission can manage customer_payments"
  ON public.customer_payments FOR ALL TO authenticated
  USING (has_permission(auth.uid(), 'customers'))
  WITH CHECK (has_permission(auth.uid(), 'customers'));

-- 12. printed_invoices - الفواتير المطبوعة  
DROP POLICY IF EXISTS "Authenticated users can manage printed_invoices" ON public.printed_invoices;
DROP POLICY IF EXISTS "Authenticated users manage printed invoices" ON public.printed_invoices;

CREATE POLICY "Users with permission can manage printed_invoices"
  ON public.printed_invoices FOR ALL TO authenticated
  USING (has_permission(auth.uid(), 'invoices'))
  WITH CHECK (has_permission(auth.uid(), 'invoices'));

-- 13. contract_expenses - مصروفات العقود
DROP POLICY IF EXISTS "Authenticated users can manage contract_expenses" ON public.contract_expenses;

CREATE POLICY "Users with permission can manage contract_expenses"
  ON public.contract_expenses FOR ALL TO authenticated
  USING (has_permission(auth.uid(), 'contracts'))
  WITH CHECK (has_permission(auth.uid(), 'contracts'));

-- 14. employee related tables
DROP POLICY IF EXISTS "Authenticated users can manage employees" ON public.employees;
DROP POLICY IF EXISTS "Authenticated users manage employees" ON public.employees;

CREATE POLICY "Users with permission can manage employees"
  ON public.employees FOR ALL TO authenticated
  USING (has_permission(auth.uid(), 'salaries'))
  WITH CHECK (has_permission(auth.uid(), 'salaries'));

-- 15. installation_tasks
DROP POLICY IF EXISTS "Authenticated users can manage installation_tasks" ON public.installation_tasks;
DROP POLICY IF EXISTS "Authenticated users manage installation tasks" ON public.installation_tasks;

CREATE POLICY "Users with permission can manage installation_tasks"
  ON public.installation_tasks FOR ALL TO authenticated
  USING (has_permission(auth.uid(), 'installation_tasks'))
  WITH CHECK (has_permission(auth.uid(), 'installation_tasks'));

-- 16. installation_task_items
DROP POLICY IF EXISTS "Authenticated users can manage installation_task_items" ON public.installation_task_items;
DROP POLICY IF EXISTS "Authenticated users manage installation task items" ON public.installation_task_items;

CREATE POLICY "Users with permission can manage installation_task_items"
  ON public.installation_task_items FOR ALL TO authenticated
  USING (has_permission(auth.uid(), 'installation_tasks'))
  WITH CHECK (has_permission(auth.uid(), 'installation_tasks'));

-- 17. print_tasks
DROP POLICY IF EXISTS "Authenticated users can manage print_tasks" ON public.print_tasks;

CREATE POLICY "Users with permission can manage print_tasks"
  ON public.print_tasks FOR ALL TO authenticated
  USING (has_permission(auth.uid(), 'print_tasks'))
  WITH CHECK (has_permission(auth.uid(), 'print_tasks'));

-- 18. cutout_tasks
DROP POLICY IF EXISTS "Authenticated users can manage cutout_tasks" ON public.cutout_tasks;

CREATE POLICY "Users with permission can manage cutout_tasks"
  ON public.cutout_tasks FOR ALL TO authenticated
  USING (has_permission(auth.uid(), 'print_tasks'))
  WITH CHECK (has_permission(auth.uid(), 'print_tasks'));

-- 19. composite_tasks
DROP POLICY IF EXISTS "Authenticated users can manage composite_tasks" ON public.composite_tasks;

CREATE POLICY "Users with permission can manage composite_tasks"
  ON public.composite_tasks FOR ALL TO authenticated
  USING (has_permission(auth.uid(), 'tasks'))
  WITH CHECK (has_permission(auth.uid(), 'tasks'));

-- 20. billboards
DROP POLICY IF EXISTS "Authenticated users can manage billboards" ON public.billboards;
DROP POLICY IF EXISTS "Authenticated users manage billboards" ON public.billboards;

CREATE POLICY "Users with permission can manage billboards"
  ON public.billboards FOR ALL TO authenticated
  USING (has_permission(auth.uid(), 'billboards'))
  WITH CHECK (has_permission(auth.uid(), 'billboards'));
