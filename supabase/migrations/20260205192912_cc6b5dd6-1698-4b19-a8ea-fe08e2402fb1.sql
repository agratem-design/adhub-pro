-- =====================================================
-- SECURITY FIX: Harden RLS Policies for Sensitive Tables
-- Restricting write access to admin role only
-- =====================================================

-- Drop existing overly permissive policies and create secure ones

-- ============= FINANCIAL & INVOICING TABLES =============

-- sales_invoices
DROP POLICY IF EXISTS "Allow authenticated users to select sales_invoices" ON sales_invoices;
DROP POLICY IF EXISTS "Allow authenticated users to insert sales_invoices" ON sales_invoices;
DROP POLICY IF EXISTS "Allow authenticated users to update sales_invoices" ON sales_invoices;
DROP POLICY IF EXISTS "Allow authenticated users to delete sales_invoices" ON sales_invoices;
DROP POLICY IF EXISTS "Admins manage sales_invoices" ON sales_invoices;
DROP POLICY IF EXISTS "Authenticated users can read sales_invoices" ON sales_invoices;

CREATE POLICY "Authenticated users can read sales_invoices" ON sales_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage sales_invoices" ON sales_invoices FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- purchase_invoices
DROP POLICY IF EXISTS "Allow authenticated users to select purchase_invoices" ON purchase_invoices;
DROP POLICY IF EXISTS "Allow authenticated users to insert purchase_invoices" ON purchase_invoices;
DROP POLICY IF EXISTS "Allow authenticated users to update purchase_invoices" ON purchase_invoices;
DROP POLICY IF EXISTS "Allow authenticated users to delete purchase_invoices" ON purchase_invoices;
DROP POLICY IF EXISTS "Admins manage purchase_invoices" ON purchase_invoices;
DROP POLICY IF EXISTS "Authenticated users can read purchase_invoices" ON purchase_invoices;

CREATE POLICY "Authenticated users can read purchase_invoices" ON purchase_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage purchase_invoices" ON purchase_invoices FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- printed_invoices
DROP POLICY IF EXISTS "Allow authenticated users to select printed_invoices" ON printed_invoices;
DROP POLICY IF EXISTS "Allow authenticated users to insert printed_invoices" ON printed_invoices;
DROP POLICY IF EXISTS "Allow authenticated users to update printed_invoices" ON printed_invoices;
DROP POLICY IF EXISTS "Allow authenticated users to delete printed_invoices" ON printed_invoices;
DROP POLICY IF EXISTS "Admins manage printed_invoices" ON printed_invoices;
DROP POLICY IF EXISTS "Authenticated users can read printed_invoices" ON printed_invoices;

CREATE POLICY "Authenticated users can read printed_invoices" ON printed_invoices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage printed_invoices" ON printed_invoices FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- sales_invoice_payments
DROP POLICY IF EXISTS "Allow authenticated users to select sales_invoice_payments" ON sales_invoice_payments;
DROP POLICY IF EXISTS "Allow authenticated users to insert sales_invoice_payments" ON sales_invoice_payments;
DROP POLICY IF EXISTS "Allow authenticated users to update sales_invoice_payments" ON sales_invoice_payments;
DROP POLICY IF EXISTS "Allow authenticated users to delete sales_invoice_payments" ON sales_invoice_payments;
DROP POLICY IF EXISTS "Admins manage sales_invoice_payments" ON sales_invoice_payments;
DROP POLICY IF EXISTS "Authenticated users can read sales_invoice_payments" ON sales_invoice_payments;

CREATE POLICY "Authenticated users can read sales_invoice_payments" ON sales_invoice_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage sales_invoice_payments" ON sales_invoice_payments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- purchase_invoice_payments
DROP POLICY IF EXISTS "Allow authenticated users to select purchase_invoice_payments" ON purchase_invoice_payments;
DROP POLICY IF EXISTS "Allow authenticated users to insert purchase_invoice_payments" ON purchase_invoice_payments;
DROP POLICY IF EXISTS "Allow authenticated users to update purchase_invoice_payments" ON purchase_invoice_payments;
DROP POLICY IF EXISTS "Allow authenticated users to delete purchase_invoice_payments" ON purchase_invoice_payments;
DROP POLICY IF EXISTS "Admins manage purchase_invoice_payments" ON purchase_invoice_payments;
DROP POLICY IF EXISTS "Authenticated users can read purchase_invoice_payments" ON purchase_invoice_payments;

CREATE POLICY "Authenticated users can read purchase_invoice_payments" ON purchase_invoice_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage purchase_invoice_payments" ON purchase_invoice_payments FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============= TASKS & OPERATIONS TABLES =============

-- print_tasks
DROP POLICY IF EXISTS "Allow authenticated users to select print_tasks" ON print_tasks;
DROP POLICY IF EXISTS "Allow authenticated users to insert print_tasks" ON print_tasks;
DROP POLICY IF EXISTS "Allow authenticated users to update print_tasks" ON print_tasks;
DROP POLICY IF EXISTS "Allow authenticated users to delete print_tasks" ON print_tasks;
DROP POLICY IF EXISTS "Admins manage print_tasks" ON print_tasks;
DROP POLICY IF EXISTS "Authenticated users can read print_tasks" ON print_tasks;

CREATE POLICY "Authenticated users can read print_tasks" ON print_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage print_tasks" ON print_tasks FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- print_task_items
DROP POLICY IF EXISTS "Allow authenticated users to select print_task_items" ON print_task_items;
DROP POLICY IF EXISTS "Allow authenticated users to insert print_task_items" ON print_task_items;
DROP POLICY IF EXISTS "Allow authenticated users to update print_task_items" ON print_task_items;
DROP POLICY IF EXISTS "Allow authenticated users to delete print_task_items" ON print_task_items;
DROP POLICY IF EXISTS "Admins manage print_task_items" ON print_task_items;
DROP POLICY IF EXISTS "Authenticated users can read print_task_items" ON print_task_items;

CREATE POLICY "Authenticated users can read print_task_items" ON print_task_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage print_task_items" ON print_task_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- installation_tasks
DROP POLICY IF EXISTS "Allow authenticated users to select installation_tasks" ON installation_tasks;
DROP POLICY IF EXISTS "Allow authenticated users to insert installation_tasks" ON installation_tasks;
DROP POLICY IF EXISTS "Allow authenticated users to update installation_tasks" ON installation_tasks;
DROP POLICY IF EXISTS "Allow authenticated users to delete installation_tasks" ON installation_tasks;
DROP POLICY IF EXISTS "Admins manage installation_tasks" ON installation_tasks;
DROP POLICY IF EXISTS "Authenticated users can read installation_tasks" ON installation_tasks;

CREATE POLICY "Authenticated users can read installation_tasks" ON installation_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage installation_tasks" ON installation_tasks FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- installation_task_items
DROP POLICY IF EXISTS "Allow authenticated users to select installation_task_items" ON installation_task_items;
DROP POLICY IF EXISTS "Allow authenticated users to insert installation_task_items" ON installation_task_items;
DROP POLICY IF EXISTS "Allow authenticated users to update installation_task_items" ON installation_task_items;
DROP POLICY IF EXISTS "Allow authenticated users to delete installation_task_items" ON installation_task_items;
DROP POLICY IF EXISTS "Admins manage installation_task_items" ON installation_task_items;
DROP POLICY IF EXISTS "Authenticated users can read installation_task_items" ON installation_task_items;

CREATE POLICY "Authenticated users can read installation_task_items" ON installation_task_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage installation_task_items" ON installation_task_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- cutout_tasks
DROP POLICY IF EXISTS "Allow authenticated users to select cutout_tasks" ON cutout_tasks;
DROP POLICY IF EXISTS "Allow authenticated users to insert cutout_tasks" ON cutout_tasks;
DROP POLICY IF EXISTS "Allow authenticated users to update cutout_tasks" ON cutout_tasks;
DROP POLICY IF EXISTS "Allow authenticated users to delete cutout_tasks" ON cutout_tasks;
DROP POLICY IF EXISTS "Admins manage cutout_tasks" ON cutout_tasks;
DROP POLICY IF EXISTS "Authenticated users can read cutout_tasks" ON cutout_tasks;

CREATE POLICY "Authenticated users can read cutout_tasks" ON cutout_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage cutout_tasks" ON cutout_tasks FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- cutout_task_items
DROP POLICY IF EXISTS "Allow authenticated users to select cutout_task_items" ON cutout_task_items;
DROP POLICY IF EXISTS "Allow authenticated users to insert cutout_task_items" ON cutout_task_items;
DROP POLICY IF EXISTS "Allow authenticated users to update cutout_task_items" ON cutout_task_items;
DROP POLICY IF EXISTS "Allow authenticated users to delete cutout_task_items" ON cutout_task_items;
DROP POLICY IF EXISTS "Admins manage cutout_task_items" ON cutout_task_items;
DROP POLICY IF EXISTS "Authenticated users can read cutout_task_items" ON cutout_task_items;

CREATE POLICY "Authenticated users can read cutout_task_items" ON cutout_task_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage cutout_task_items" ON cutout_task_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- tasks
DROP POLICY IF EXISTS "Allow authenticated users to select tasks" ON tasks;
DROP POLICY IF EXISTS "Allow authenticated users to insert tasks" ON tasks;
DROP POLICY IF EXISTS "Allow authenticated users to update tasks" ON tasks;
DROP POLICY IF EXISTS "Allow authenticated users to delete tasks" ON tasks;
DROP POLICY IF EXISTS "Admins manage tasks" ON tasks;
DROP POLICY IF EXISTS "Authenticated users can read tasks" ON tasks;

CREATE POLICY "Authenticated users can read tasks" ON tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage tasks" ON tasks FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- reports
DROP POLICY IF EXISTS "Allow authenticated users to select reports" ON reports;
DROP POLICY IF EXISTS "Allow authenticated users to insert reports" ON reports;
DROP POLICY IF EXISTS "Allow authenticated users to update reports" ON reports;
DROP POLICY IF EXISTS "Allow authenticated users to delete reports" ON reports;
DROP POLICY IF EXISTS "Admins manage reports" ON reports;
DROP POLICY IF EXISTS "Authenticated users can read reports" ON reports;

CREATE POLICY "Authenticated users can read reports" ON reports FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage reports" ON reports FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- report_items
DROP POLICY IF EXISTS "Allow authenticated users to select report_items" ON report_items;
DROP POLICY IF EXISTS "Allow authenticated users to insert report_items" ON report_items;
DROP POLICY IF EXISTS "Allow authenticated users to update report_items" ON report_items;
DROP POLICY IF EXISTS "Allow authenticated users to delete report_items" ON report_items;
DROP POLICY IF EXISTS "Admins manage report_items" ON report_items;
DROP POLICY IF EXISTS "Authenticated users can read report_items" ON report_items;

CREATE POLICY "Authenticated users can read report_items" ON report_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage report_items" ON report_items FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============= CONFIGURATION & SETTINGS TABLES =============

-- template_settings
DROP POLICY IF EXISTS "Allow authenticated users to select template_settings" ON template_settings;
DROP POLICY IF EXISTS "Allow authenticated users to insert template_settings" ON template_settings;
DROP POLICY IF EXISTS "Allow authenticated users to update template_settings" ON template_settings;
DROP POLICY IF EXISTS "Allow authenticated users to delete template_settings" ON template_settings;
DROP POLICY IF EXISTS "Admins manage template_settings" ON template_settings;
DROP POLICY IF EXISTS "Authenticated users can read template_settings" ON template_settings;

CREATE POLICY "Authenticated users can read template_settings" ON template_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage template_settings" ON template_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- municipality_stickers_settings
DROP POLICY IF EXISTS "Allow authenticated users to select municipality_stickers_settings" ON municipality_stickers_settings;
DROP POLICY IF EXISTS "Allow authenticated users to insert municipality_stickers_settings" ON municipality_stickers_settings;
DROP POLICY IF EXISTS "Allow authenticated users to update municipality_stickers_settings" ON municipality_stickers_settings;
DROP POLICY IF EXISTS "Allow authenticated users to delete municipality_stickers_settings" ON municipality_stickers_settings;
DROP POLICY IF EXISTS "Admins manage municipality_stickers_settings" ON municipality_stickers_settings;
DROP POLICY IF EXISTS "Authenticated users can read municipality_stickers_settings" ON municipality_stickers_settings;

CREATE POLICY "Authenticated users can read municipality_stickers_settings" ON municipality_stickers_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage municipality_stickers_settings" ON municipality_stickers_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- base_prices
DROP POLICY IF EXISTS "Allow authenticated users to select base_prices" ON base_prices;
DROP POLICY IF EXISTS "Allow authenticated users to insert base_prices" ON base_prices;
DROP POLICY IF EXISTS "Allow authenticated users to update base_prices" ON base_prices;
DROP POLICY IF EXISTS "Allow authenticated users to delete base_prices" ON base_prices;
DROP POLICY IF EXISTS "Admins manage base_prices" ON base_prices;
DROP POLICY IF EXISTS "Authenticated users can read base_prices" ON base_prices;

CREATE POLICY "Authenticated users can read base_prices" ON base_prices FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage base_prices" ON base_prices FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- category_factors
DROP POLICY IF EXISTS "Allow authenticated users to select category_factors" ON category_factors;
DROP POLICY IF EXISTS "Allow authenticated users to insert category_factors" ON category_factors;
DROP POLICY IF EXISTS "Allow authenticated users to update category_factors" ON category_factors;
DROP POLICY IF EXISTS "Allow authenticated users to delete category_factors" ON category_factors;
DROP POLICY IF EXISTS "Admins manage category_factors" ON category_factors;
DROP POLICY IF EXISTS "Authenticated users can read category_factors" ON category_factors;

CREATE POLICY "Authenticated users can read category_factors" ON category_factors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage category_factors" ON category_factors FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- municipality_factors
DROP POLICY IF EXISTS "Allow authenticated users to select municipality_factors" ON municipality_factors;
DROP POLICY IF EXISTS "Allow authenticated users to insert municipality_factors" ON municipality_factors;
DROP POLICY IF EXISTS "Allow authenticated users to update municipality_factors" ON municipality_factors;
DROP POLICY IF EXISTS "Allow authenticated users to delete municipality_factors" ON municipality_factors;
DROP POLICY IF EXISTS "Admins manage municipality_factors" ON municipality_factors;
DROP POLICY IF EXISTS "Authenticated users can read municipality_factors" ON municipality_factors;

CREATE POLICY "Authenticated users can read municipality_factors" ON municipality_factors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage municipality_factors" ON municipality_factors FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- contract_template_settings
DROP POLICY IF EXISTS "Allow authenticated users to select contract_template_settings" ON contract_template_settings;
DROP POLICY IF EXISTS "Allow authenticated users to insert contract_template_settings" ON contract_template_settings;
DROP POLICY IF EXISTS "Allow authenticated users to update contract_template_settings" ON contract_template_settings;
DROP POLICY IF EXISTS "Allow authenticated users to delete contract_template_settings" ON contract_template_settings;
DROP POLICY IF EXISTS "Admins manage contract_template_settings" ON contract_template_settings;
DROP POLICY IF EXISTS "Authenticated users can read contract_template_settings" ON contract_template_settings;

CREATE POLICY "Authenticated users can read contract_template_settings" ON contract_template_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage contract_template_settings" ON contract_template_settings FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- ============= OTHER SENSITIVE TABLES =============

-- printers
DROP POLICY IF EXISTS "Allow authenticated users to select printers" ON printers;
DROP POLICY IF EXISTS "Allow authenticated users to insert printers" ON printers;
DROP POLICY IF EXISTS "Allow authenticated users to update printers" ON printers;
DROP POLICY IF EXISTS "Allow authenticated users to delete printers" ON printers;
DROP POLICY IF EXISTS "Admins manage printers" ON printers;
DROP POLICY IF EXISTS "Authenticated users can read printers" ON printers;

CREATE POLICY "Authenticated users can read printers" ON printers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage printers" ON printers FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- shared_billboards
DROP POLICY IF EXISTS "Allow authenticated users to select shared_billboards" ON shared_billboards;
DROP POLICY IF EXISTS "Allow authenticated users to insert shared_billboards" ON shared_billboards;
DROP POLICY IF EXISTS "Allow authenticated users to update shared_billboards" ON shared_billboards;
DROP POLICY IF EXISTS "Allow authenticated users to delete shared_billboards" ON shared_billboards;
DROP POLICY IF EXISTS "Admins manage shared_billboards" ON shared_billboards;
DROP POLICY IF EXISTS "Authenticated users can read shared_billboards" ON shared_billboards;

CREATE POLICY "Authenticated users can read shared_billboards" ON shared_billboards FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins manage shared_billboards" ON shared_billboards FOR ALL TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));