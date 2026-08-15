
-- Add display_name column if not exists
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS display_name text;

-- Insert new roles
INSERT INTO roles (name, display_name, description, permissions) VALUES
('sub_admin', 'مدير فرعي', 'مدير فرعي - صلاحيات كاملة بدون إعدادات النظام', ARRAY[
  'dashboard','contracts','offers','booking_requests','billboards','billboard_photos','extended_billboards','billboard_cleanup','billboard_maintenance','delayed_billboards','smart_distribution',
  'shared_billboards','shared_companies','friend_billboards','friend_accounts',
  'municipality_stickers','municipality_stats','municipality_rent_prices','municipality_organizer',
  'customers','customer_billing','customer_merge','overdue_payments','payments','revenue','expenses','salaries','custody',
  'printed_invoices_page','printer_accounts','installation_team_accounts','pricing','pricing_factors',
  'tasks','installation_tasks','removal_tasks','print_tasks','cutout_tasks','composite_tasks',
  'image_gallery','reports','kpi_dashboard','profitability_reports',
  'users','installation_teams','printers',
  'contracts_edit','offers_edit','booking_requests_edit','billboards_edit','billboard_cleanup_edit','billboard_maintenance_edit',
  'shared_billboards_edit','shared_companies_edit','friend_billboards_edit','friend_accounts_edit',
  'municipality_stickers_edit','municipality_rent_prices_edit','municipality_organizer_edit',
  'customers_edit','customer_billing_edit','customer_merge_edit','payments_edit','expenses_edit','salaries_edit','custody_edit',
  'printed_invoices_page_edit','printer_accounts_edit','installation_team_accounts_edit','pricing_edit','pricing_factors_edit',
  'tasks_edit','installation_tasks_edit','removal_tasks_edit','print_tasks_edit','cutout_tasks_edit','composite_tasks_edit',
  'image_gallery_edit','users_edit','installation_teams_edit','printers_edit'
]),
('accountant', 'محاسب', 'محاسب - صلاحيات مالية فقط', ARRAY[
  'dashboard','customers','customer_billing','overdue_payments','payments','revenue','expenses','salaries','custody',
  'printed_invoices_page','printer_accounts','installation_team_accounts','reports','profitability_reports','contracts',
  'customer_billing_edit','payments_edit','expenses_edit','salaries_edit','custody_edit','printed_invoices_page_edit'
]),
('customer', 'عميل', 'عميل - عرض بياناته فقط', ARRAY[
  'dashboard','booking_requests','booking_requests_edit'
])
ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name, description = EXCLUDED.description, permissions = EXCLUDED.permissions;
