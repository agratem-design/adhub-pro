-- Fix remaining policies that failed due to name conflict

-- 8. customer_payments - drop existing admin policies first
DROP POLICY IF EXISTS "Admins can insert customer_payments" ON public.customer_payments;
DROP POLICY IF EXISTS "Admins can update customer_payments" ON public.customer_payments;

CREATE POLICY "Admins can insert customer_payments" ON public.customer_payments
  FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update customer_payments" ON public.customer_payments
  FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

-- 9-24: These also need DROP IF EXISTS for safety
-- distribution_items
DROP POLICY IF EXISTS "Authenticated can read distribution_items" ON public.distribution_items;
DROP POLICY IF EXISTS "Admins can insert distribution_items" ON public.distribution_items;
DROP POLICY IF EXISTS "Admins can update distribution_items" ON public.distribution_items;
DROP POLICY IF EXISTS "Admins can delete distribution_items" ON public.distribution_items;

CREATE POLICY "Authenticated can read distribution_items" ON public.distribution_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert distribution_items" ON public.distribution_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update distribution_items" ON public.distribution_items FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete distribution_items" ON public.distribution_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- distributions
DROP POLICY IF EXISTS "Authenticated can read distributions" ON public.distributions;
DROP POLICY IF EXISTS "Admins can insert distributions" ON public.distributions;
DROP POLICY IF EXISTS "Admins can update distributions" ON public.distributions;
DROP POLICY IF EXISTS "Admins can delete distributions" ON public.distributions;

CREATE POLICY "Authenticated can read distributions" ON public.distributions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert distributions" ON public.distributions FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update distributions" ON public.distributions FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete distributions" ON public.distributions FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- employee_credit_entries
DROP POLICY IF EXISTS "Admins can insert employee_credit_entries" ON public.employee_credit_entries;
DROP POLICY IF EXISTS "Admins can update employee_credit_entries" ON public.employee_credit_entries;
DROP POLICY IF EXISTS "Admins can delete employee_credit_entries" ON public.employee_credit_entries;

CREATE POLICY "Admins can insert employee_credit_entries" ON public.employee_credit_entries FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update employee_credit_entries" ON public.employee_credit_entries FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete employee_credit_entries" ON public.employee_credit_entries FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- municipalities
DROP POLICY IF EXISTS "Admins can insert municipalities" ON public.municipalities;
DROP POLICY IF EXISTS "Admins can update municipalities" ON public.municipalities;
DROP POLICY IF EXISTS "Admins can delete municipalities" ON public.municipalities;

CREATE POLICY "Admins can insert municipalities" ON public.municipalities FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update municipalities" ON public.municipalities FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete municipalities" ON public.municipalities FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- municipality_factors
DROP POLICY IF EXISTS "Authenticated can read municipality_factors" ON public.municipality_factors;
DROP POLICY IF EXISTS "Admins can insert municipality_factors" ON public.municipality_factors;
DROP POLICY IF EXISTS "Admins can update municipality_factors" ON public.municipality_factors;
DROP POLICY IF EXISTS "Admins can delete municipality_factors" ON public.municipality_factors;

CREATE POLICY "Authenticated can read municipality_factors" ON public.municipality_factors FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert municipality_factors" ON public.municipality_factors FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update municipality_factors" ON public.municipality_factors FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete municipality_factors" ON public.municipality_factors FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- municipality_stickers_settings
DROP POLICY IF EXISTS "Authenticated can read municipality_stickers_settings" ON public.municipality_stickers_settings;
DROP POLICY IF EXISTS "Admins can insert municipality_stickers_settings" ON public.municipality_stickers_settings;
DROP POLICY IF EXISTS "Admins can update municipality_stickers_settings" ON public.municipality_stickers_settings;
DROP POLICY IF EXISTS "Admins can delete municipality_stickers_settings" ON public.municipality_stickers_settings;

CREATE POLICY "Authenticated can read municipality_stickers_settings" ON public.municipality_stickers_settings FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert municipality_stickers_settings" ON public.municipality_stickers_settings FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update municipality_stickers_settings" ON public.municipality_stickers_settings FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete municipality_stickers_settings" ON public.municipality_stickers_settings FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- partnership_contract_shares
DROP POLICY IF EXISTS "Admins can insert partnership_contract_shares" ON public.partnership_contract_shares;
DROP POLICY IF EXISTS "Admins can update partnership_contract_shares" ON public.partnership_contract_shares;
DROP POLICY IF EXISTS "Admins can delete partnership_contract_shares" ON public.partnership_contract_shares;

CREATE POLICY "Admins can insert partnership_contract_shares" ON public.partnership_contract_shares FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update partnership_contract_shares" ON public.partnership_contract_shares FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete partnership_contract_shares" ON public.partnership_contract_shares FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- period_closures
DROP POLICY IF EXISTS "Authenticated can read period_closures" ON public.period_closures;
DROP POLICY IF EXISTS "Admins can insert period_closures" ON public.period_closures;
DROP POLICY IF EXISTS "Admins can update period_closures" ON public.period_closures;
DROP POLICY IF EXISTS "Admins can delete period_closures" ON public.period_closures;

CREATE POLICY "Authenticated can read period_closures" ON public.period_closures FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert period_closures" ON public.period_closures FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update period_closures" ON public.period_closures FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete period_closures" ON public.period_closures FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- pricing_categories
DROP POLICY IF EXISTS "Admins can insert pricing_categories" ON public.pricing_categories;
DROP POLICY IF EXISTS "Admins can update pricing_categories" ON public.pricing_categories;
DROP POLICY IF EXISTS "Admins can delete pricing_categories" ON public.pricing_categories;

CREATE POLICY "Admins can insert pricing_categories" ON public.pricing_categories FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update pricing_categories" ON public.pricing_categories FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete pricing_categories" ON public.pricing_categories FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- print_invoice_payments
DROP POLICY IF EXISTS "Authenticated can read print_invoice_payments" ON public.print_invoice_payments;
DROP POLICY IF EXISTS "Admins can insert print_invoice_payments" ON public.print_invoice_payments;
DROP POLICY IF EXISTS "Admins can update print_invoice_payments" ON public.print_invoice_payments;
DROP POLICY IF EXISTS "Admins can delete print_invoice_payments" ON public.print_invoice_payments;

CREATE POLICY "Authenticated can read print_invoice_payments" ON public.print_invoice_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert print_invoice_payments" ON public.print_invoice_payments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update print_invoice_payments" ON public.print_invoice_payments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete print_invoice_payments" ON public.print_invoice_payments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- print_reprints
DROP POLICY IF EXISTS "Authenticated can read print_reprints" ON public.print_reprints;
DROP POLICY IF EXISTS "Admins can insert print_reprints" ON public.print_reprints;
DROP POLICY IF EXISTS "Admins can update print_reprints" ON public.print_reprints;
DROP POLICY IF EXISTS "Admins can delete print_reprints" ON public.print_reprints;

CREATE POLICY "Authenticated can read print_reprints" ON public.print_reprints FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert print_reprints" ON public.print_reprints FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update print_reprints" ON public.print_reprints FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete print_reprints" ON public.print_reprints FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- print_task_items
DROP POLICY IF EXISTS "Authenticated can read print_task_items" ON public.print_task_items;
DROP POLICY IF EXISTS "Admins can insert print_task_items" ON public.print_task_items;
DROP POLICY IF EXISTS "Admins can update print_task_items" ON public.print_task_items;
DROP POLICY IF EXISTS "Admins can delete print_task_items" ON public.print_task_items;

CREATE POLICY "Authenticated can read print_task_items" ON public.print_task_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert print_task_items" ON public.print_task_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update print_task_items" ON public.print_task_items FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete print_task_items" ON public.print_task_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- print_tasks
DROP POLICY IF EXISTS "Authenticated can read print_tasks" ON public.print_tasks;
DROP POLICY IF EXISTS "Admins can insert print_tasks" ON public.print_tasks;
DROP POLICY IF EXISTS "Admins can update print_tasks" ON public.print_tasks;
DROP POLICY IF EXISTS "Admins can delete print_tasks" ON public.print_tasks;

CREATE POLICY "Authenticated can read print_tasks" ON public.print_tasks FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert print_tasks" ON public.print_tasks FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update print_tasks" ON public.print_tasks FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete print_tasks" ON public.print_tasks FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- printers
DROP POLICY IF EXISTS "Authenticated can read printers" ON public.printers;
DROP POLICY IF EXISTS "Admins can insert printers" ON public.printers;
DROP POLICY IF EXISTS "Admins can update printers" ON public.printers;
DROP POLICY IF EXISTS "Admins can delete printers" ON public.printers;

CREATE POLICY "Authenticated can read printers" ON public.printers FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert printers" ON public.printers FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update printers" ON public.printers FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete printers" ON public.printers FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- purchase_invoice_items
DROP POLICY IF EXISTS "Authenticated can read purchase_invoice_items" ON public.purchase_invoice_items;
DROP POLICY IF EXISTS "Admins can insert purchase_invoice_items" ON public.purchase_invoice_items;
DROP POLICY IF EXISTS "Admins can update purchase_invoice_items" ON public.purchase_invoice_items;
DROP POLICY IF EXISTS "Admins can delete purchase_invoice_items" ON public.purchase_invoice_items;

CREATE POLICY "Authenticated can read purchase_invoice_items" ON public.purchase_invoice_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert purchase_invoice_items" ON public.purchase_invoice_items FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update purchase_invoice_items" ON public.purchase_invoice_items FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete purchase_invoice_items" ON public.purchase_invoice_items FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));

-- purchase_invoice_payments
DROP POLICY IF EXISTS "Authenticated can read purchase_invoice_payments" ON public.purchase_invoice_payments;
DROP POLICY IF EXISTS "Admins can insert purchase_invoice_payments" ON public.purchase_invoice_payments;
DROP POLICY IF EXISTS "Admins can update purchase_invoice_payments" ON public.purchase_invoice_payments;
DROP POLICY IF EXISTS "Admins can delete purchase_invoice_payments" ON public.purchase_invoice_payments;

CREATE POLICY "Authenticated can read purchase_invoice_payments" ON public.purchase_invoice_payments FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admins can insert purchase_invoice_payments" ON public.purchase_invoice_payments FOR INSERT TO authenticated WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can update purchase_invoice_payments" ON public.purchase_invoice_payments FOR UPDATE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Admins can delete purchase_invoice_payments" ON public.purchase_invoice_payments FOR DELETE TO authenticated USING (public.has_role(auth.uid(), 'admin'::app_role));