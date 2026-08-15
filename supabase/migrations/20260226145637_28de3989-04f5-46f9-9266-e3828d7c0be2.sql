
-- Update admin role permissions to include ALL sidebar items + edit permissions
UPDATE roles SET permissions = ARRAY[
  'dashboard', 'billboards', 'contracts', 'offers', 'customers', 'customer_billing', 'customer_merge',
  'reports', 'kpi_dashboard', 'profitability_reports', 'smart_distribution',
  'tasks', 'installation_tasks', 'removal_tasks', 'print_tasks', 'cutout_tasks', 'composite_tasks',
  'delayed_billboards', 'extended_billboards', 'billboard_cleanup', 'billboard_maintenance',
  'shared_billboards', 'shared_companies', 'friend_billboards', 'friend_accounts',
  'municipality_stickers', 'municipality_stats', 'municipality_rent_prices', 'municipality_organizer',
  'expenses', 'salaries', 'custody', 'revenue', 'payments', 'overdue_payments',
  'printed_invoices_page', 'printer_accounts', 'installation_team_accounts',
  'printers', 'installation_teams', 'booking_requests',
  'users', 'roles', 'pricing', 'pricing_factors',
  'settings', 'system_settings', 'print_settings', 'print_design', 'print_design_new',
  'billboard_print_settings', 'quick_print_settings', 'pdf_templates',
  'contract_terms', 'messaging_settings', 'currency_settings', 'database_backup',
  'dashboard_edit', 'billboards_edit', 'contracts_edit', 'offers_edit', 'customers_edit',
  'customer_billing_edit', 'customer_merge_edit', 'tasks_edit', 'installation_tasks_edit', 'removal_tasks_edit',
  'print_tasks_edit', 'cutout_tasks_edit', 'composite_tasks_edit',
  'expenses_edit', 'salaries_edit', 'custody_edit', 'payments_edit',
  'printers_edit', 'installation_teams_edit', 'pricing_edit', 'pricing_factors_edit',
  'settings_edit', 'users_edit', 'roles_edit', 'booking_requests_edit',
  'shared_billboards_edit', 'shared_companies_edit', 'friend_billboards_edit', 'friend_accounts_edit',
  'municipality_stickers_edit', 'municipality_rent_prices_edit',
  'billboard_cleanup_edit', 'billboard_maintenance_edit',
  'extended_billboards_edit', 'delayed_billboards_edit',
  'printed_invoices_page_edit', 'printer_accounts_edit', 'installation_team_accounts_edit',
  'revenue_edit', 'overdue_payments_edit'
]::text[], updated_at = now()
WHERE name = 'admin';

-- Update user role with view-only permissions (no _edit)
UPDATE roles SET permissions = ARRAY[
  'dashboard', 'billboards', 'contracts', 'offers', 'customers', 'customer_billing',
  'reports', 'tasks', 'installation_tasks', 'removal_tasks', 'print_tasks', 'cutout_tasks', 'composite_tasks',
  'delayed_billboards', 'extended_billboards', 'billboard_maintenance',
  'municipality_stickers', 'municipality_stats', 'municipality_rent_prices',
  'expenses', 'salaries', 'custody', 'revenue', 'payments', 'overdue_payments',
  'printed_invoices_page', 'printer_accounts', 'installation_team_accounts',
  'pricing', 'booking_requests'
]::text[], updated_at = now()
WHERE name = 'user';
