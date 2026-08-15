-- =====================================================
-- إصلاح مشاكل الأداء في RLS
-- =====================================================

-- 1. billboards
DROP POLICY IF EXISTS "Admins manage billboards" ON public.billboards;
CREATE POLICY "Admins manage billboards" ON public.billboards
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 2. users
DROP POLICY IF EXISTS "Admins manage users" ON public.users;
CREATE POLICY "Admins manage users" ON public.users
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 3. expenses
DROP POLICY IF EXISTS "Admins manage expenses" ON public.expenses;
CREATE POLICY "Admins manage expenses" ON public.expenses
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 4. expenses_withdrawals
DROP POLICY IF EXISTS "Admins manage expense withdrawals" ON public.expenses_withdrawals;
CREATE POLICY "Admins manage expense withdrawals" ON public.expenses_withdrawals
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 5. expense_categories
DROP POLICY IF EXISTS "Admins manage expense categories" ON public.expense_categories;
CREATE POLICY "Admins manage expense categories" ON public.expense_categories
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 6. billboard_faces
DROP POLICY IF EXISTS "Admins manage billboard faces" ON public.billboard_faces;
CREATE POLICY "Admins manage billboard faces" ON public.billboard_faces
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 7. billboard_types
DROP POLICY IF EXISTS "Admins manage billboard types" ON public.billboard_types;
CREATE POLICY "Admins manage billboard types" ON public.billboard_types
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 8. billboard_levels
DROP POLICY IF EXISTS "Admins manage billboard levels" ON public.billboard_levels;
CREATE POLICY "Admins manage billboard levels" ON public.billboard_levels
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 9. pricing
DROP POLICY IF EXISTS "Admins manage pricing" ON public.pricing;
CREATE POLICY "Admins manage pricing" ON public.pricing
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 10. pricing_categories
DROP POLICY IF EXISTS "Admins manage pricing categories" ON public.pricing_categories;
CREATE POLICY "Admins manage pricing categories" ON public.pricing_categories
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 11. installation_tasks
DROP POLICY IF EXISTS "Admins manage installation tasks" ON public.installation_tasks;
DROP POLICY IF EXISTS "Allow authenticated users to view installation tasks" ON public.installation_tasks;
CREATE POLICY "Authenticated users manage installation tasks" ON public.installation_tasks
  FOR ALL USING ((select auth.role()) = 'authenticated');

-- 12. installation_task_items
DROP POLICY IF EXISTS "Admins manage installation task items" ON public.installation_task_items;
DROP POLICY IF EXISTS "Authenticated users view installation task items" ON public.installation_task_items;
CREATE POLICY "Authenticated users manage installation task items" ON public.installation_task_items
  FOR ALL USING ((select auth.role()) = 'authenticated');

-- 13. installation_teams
DROP POLICY IF EXISTS "Admins manage installation teams" ON public.installation_teams;
DROP POLICY IF EXISTS "Authenticated users view installation teams" ON public.installation_teams;
CREATE POLICY "Authenticated users manage installation teams" ON public.installation_teams
  FOR ALL USING ((select auth.role()) = 'authenticated');

-- 14. booking_requests
DROP POLICY IF EXISTS "Admins manage booking requests" ON public.booking_requests;
CREATE POLICY "Admins manage booking requests" ON public.booking_requests
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 15. user_permissions
DROP POLICY IF EXISTS "Users view own permissions" ON public.user_permissions;
CREATE POLICY "Users view own permissions" ON public.user_permissions
  FOR SELECT USING ((select auth.uid()) = user_id);

-- 16. invoices
DROP POLICY IF EXISTS "Admins manage invoices" ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users view invoices" ON public.invoices;
CREATE POLICY "Authenticated users manage invoices" ON public.invoices
  FOR ALL USING ((select auth.role()) = 'authenticated');

-- 17. invoice_items
DROP POLICY IF EXISTS "Admins manage invoice items" ON public.invoice_items;
DROP POLICY IF EXISTS "Authenticated users view invoice items" ON public.invoice_items;
CREATE POLICY "Authenticated users manage invoice items" ON public.invoice_items
  FOR ALL USING ((select auth.role()) = 'authenticated');

-- 18. installation_print_pricing
DROP POLICY IF EXISTS "Admins manage installation pricing" ON public.installation_print_pricing;
DROP POLICY IF EXISTS "Authenticated users view installation pricing" ON public.installation_print_pricing;
CREATE POLICY "Authenticated users manage installation pricing" ON public.installation_print_pricing
  FOR ALL USING ((select auth.role()) = 'authenticated');

-- 19. customer_general_discounts
DROP POLICY IF EXISTS "Admins manage customer discounts" ON public.customer_general_discounts;
CREATE POLICY "Admins manage customer discounts" ON public.customer_general_discounts
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 20. customer_purchases
DROP POLICY IF EXISTS "Admins manage customer purchases" ON public.customer_purchases;
CREATE POLICY "Admins manage customer purchases" ON public.customer_purchases
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 21. management_phones
DROP POLICY IF EXISTS "Admins manage management phones" ON public.management_phones;
DROP POLICY IF EXISTS "Authenticated users view management phones" ON public.management_phones;
CREATE POLICY "Authenticated users manage management phones" ON public.management_phones
  FOR ALL USING ((select auth.role()) = 'authenticated');

-- 22. payments_salary
DROP POLICY IF EXISTS "Admins manage salary payments" ON public.payments_salary;
CREATE POLICY "Admins manage salary payments" ON public.payments_salary
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 23. partners
DROP POLICY IF EXISTS "Admins manage partners" ON public.partners;
CREATE POLICY "Admins manage partners" ON public.partners
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 24. printed_invoices
DROP POLICY IF EXISTS "Admins manage printed invoices" ON public.printed_invoices;
CREATE POLICY "Admins manage printed invoices" ON public.printed_invoices
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 25. customers
DROP POLICY IF EXISTS "Admins manage customers" ON public.customers;
CREATE POLICY "Admins manage customers" ON public.customers
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 26. customer_payments
DROP POLICY IF EXISTS "Admins manage payments" ON public.customer_payments;
CREATE POLICY "Admins manage payments" ON public.customer_payments
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 27. removal_tasks
DROP POLICY IF EXISTS "Admins manage removal tasks" ON public.removal_tasks;
CREATE POLICY "Admins manage removal tasks" ON public.removal_tasks
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 28. removal_task_items
DROP POLICY IF EXISTS "Admins manage removal task items" ON public.removal_task_items;
CREATE POLICY "Admins manage removal task items" ON public.removal_task_items
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 29. expenses_flags
DROP POLICY IF EXISTS "Admins manage expenses_flags" ON public.expenses_flags;
CREATE POLICY "Admins manage expenses_flags" ON public.expenses_flags
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 30. shared_transactions
DROP POLICY IF EXISTS "Admins manage shared_transactions" ON public.shared_transactions;
CREATE POLICY "Admins manage shared_transactions" ON public.shared_transactions
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 31. timesheets (uses employee_id, not user_id)
DROP POLICY IF EXISTS "Admins manage timesheets" ON public.timesheets;
DROP POLICY IF EXISTS "Users view own timesheets" ON public.timesheets;
CREATE POLICY "Timesheets access" ON public.timesheets
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 32. withdrawals
DROP POLICY IF EXISTS "Admins manage withdrawals" ON public.withdrawals;
CREATE POLICY "Admins manage withdrawals" ON public.withdrawals
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 33. billboard_history
DROP POLICY IF EXISTS "Admins manage billboard history" ON public.billboard_history;
CREATE POLICY "Admins manage billboard history" ON public.billboard_history
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 34. cutout_tasks
DROP POLICY IF EXISTS "Admins manage cutout tasks" ON public.cutout_tasks;
CREATE POLICY "Admins manage cutout tasks" ON public.cutout_tasks
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 35. cutout_task_items
DROP POLICY IF EXISTS "Admins manage cutout task items" ON public.cutout_task_items;
CREATE POLICY "Admins manage cutout task items" ON public.cutout_task_items
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 36. friend_companies
DROP POLICY IF EXISTS "Admins manage friend companies" ON public.friend_companies;
DROP POLICY IF EXISTS "Authenticated users view friend companies" ON public.friend_companies;
CREATE POLICY "Authenticated users manage friend companies" ON public.friend_companies
  FOR ALL USING ((select auth.role()) = 'authenticated');

-- 37. friend_billboard_rentals
DROP POLICY IF EXISTS "Admins manage friend rentals" ON public.friend_billboard_rentals;
DROP POLICY IF EXISTS "Authenticated users view friend rentals" ON public.friend_billboard_rentals;
CREATE POLICY "Authenticated users manage friend rentals" ON public.friend_billboard_rentals
  FOR ALL USING ((select auth.role()) = 'authenticated');

-- 38. composite_tasks
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.composite_tasks;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.composite_tasks;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.composite_tasks;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.composite_tasks;
CREATE POLICY "Authenticated users manage composite tasks" ON public.composite_tasks
  FOR ALL USING ((select auth.role()) = 'authenticated');

-- 39. custody_accounts
DROP POLICY IF EXISTS "Admins manage custody accounts" ON public.custody_accounts;
DROP POLICY IF EXISTS "Users with custody permission can view custody accounts" ON public.custody_accounts;
DROP POLICY IF EXISTS "Users with custody permission can manage custody accounts" ON public.custody_accounts;
CREATE POLICY "Custody accounts access" ON public.custody_accounts
  FOR ALL USING (
    public.has_role((select auth.uid()), 'admin')
    OR public.has_permission((select auth.uid()), 'custody')
  );

-- 40. custody_transactions
DROP POLICY IF EXISTS "Admins manage custody transactions" ON public.custody_transactions;
DROP POLICY IF EXISTS "Users with custody permission can view custody transactions" ON public.custody_transactions;
DROP POLICY IF EXISTS "Users with custody permission can manage custody transactions" ON public.custody_transactions;
CREATE POLICY "Custody transactions access" ON public.custody_transactions
  FOR ALL USING (
    public.has_role((select auth.uid()), 'admin')
    OR public.has_permission((select auth.uid()), 'custody')
  );

-- 41. custody_expenses
DROP POLICY IF EXISTS "Admins manage custody expenses" ON public.custody_expenses;
DROP POLICY IF EXISTS "Admins view all custody expenses" ON public.custody_expenses;
DROP POLICY IF EXISTS "Users with custody permission can view custody expenses" ON public.custody_expenses;
DROP POLICY IF EXISTS "Users with custody permission can manage custody expenses" ON public.custody_expenses;
CREATE POLICY "Custody expenses access" ON public.custody_expenses
  FOR ALL USING (
    public.has_role((select auth.uid()), 'admin')
    OR public.has_permission((select auth.uid()), 'custody')
  );

-- 42. employee_manual_tasks
DROP POLICY IF EXISTS "Admins manage employee manual tasks" ON public.employee_manual_tasks;
DROP POLICY IF EXISTS "Authenticated users view employee manual tasks" ON public.employee_manual_tasks;
CREATE POLICY "Authenticated users manage employee manual tasks" ON public.employee_manual_tasks
  FOR ALL USING ((select auth.role()) = 'authenticated');

-- 43. offers
DROP POLICY IF EXISTS "Admins manage offers" ON public.offers;
DROP POLICY IF EXISTS "Authenticated users view offers" ON public.offers;
CREATE POLICY "Authenticated users manage offers" ON public.offers
  FOR ALL USING ((select auth.role()) = 'authenticated');

-- 44. profiles
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins manage all profiles" ON public.profiles;
CREATE POLICY "Profile access" ON public.profiles
  FOR ALL USING (
    (select auth.uid()) = id
    OR public.has_role((select auth.uid()), 'admin')
  );

-- 45. billboard_extensions
DROP POLICY IF EXISTS "Admins manage billboard extensions" ON public.billboard_extensions;
CREATE POLICY "Admins manage billboard extensions" ON public.billboard_extensions
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 46. pricing_durations
DROP POLICY IF EXISTS "Admins manage pricing durations" ON public.pricing_durations;
CREATE POLICY "Admins manage pricing durations" ON public.pricing_durations
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 47. roles
DROP POLICY IF EXISTS "Only admins can manage roles" ON public.roles;
CREATE POLICY "Only admins can manage roles" ON public.roles
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 48. billboard_print_settings
DROP POLICY IF EXISTS "Only admins can manage billboard print settings" ON public.billboard_print_settings;
CREATE POLICY "Only admins can manage billboard print settings" ON public.billboard_print_settings
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 49. print_backgrounds
DROP POLICY IF EXISTS "Admins can manage print backgrounds" ON public.print_backgrounds;
CREATE POLICY "Admins can manage print backgrounds" ON public.print_backgrounds
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 50. billboard_print_customization
DROP POLICY IF EXISTS "Authenticated users can update print customization" ON public.billboard_print_customization;
DROP POLICY IF EXISTS "Authenticated users can insert print customization" ON public.billboard_print_customization;
CREATE POLICY "Authenticated users manage print customization" ON public.billboard_print_customization
  FOR ALL USING ((select auth.role()) = 'authenticated');

-- 51. print_settings
DROP POLICY IF EXISTS "Admins manage print_settings" ON public.print_settings;
CREATE POLICY "Admins manage print_settings" ON public.print_settings
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 52. employees
DROP POLICY IF EXISTS "Admins manage employees" ON public.employees;
DROP POLICY IF EXISTS "Users with custody permission can view employees" ON public.employees;
CREATE POLICY "Employees access" ON public.employees
  FOR ALL USING (
    public.has_role((select auth.uid()), 'admin')
    OR public.has_permission((select auth.uid()), 'custody')
  );

-- 53. levels
DROP POLICY IF EXISTS "Admins manage levels" ON public.levels;
DROP POLICY IF EXISTS "Authenticated users view levels" ON public.levels;
CREATE POLICY "Authenticated users manage levels" ON public.levels
  FOR ALL USING ((select auth.role()) = 'authenticated');

-- 54. maintenance_history
DROP POLICY IF EXISTS "Admins manage maintenance" ON public.maintenance_history;
DROP POLICY IF EXISTS "Authenticated users view maintenance history" ON public.maintenance_history;
CREATE POLICY "Authenticated users manage maintenance history" ON public.maintenance_history
  FOR ALL USING ((select auth.role()) = 'authenticated');

-- 55. municipality_factors
DROP POLICY IF EXISTS "Anyone can read municipality_factors" ON public.municipality_factors;
DROP POLICY IF EXISTS "Authenticated users can manage municipality_factors" ON public.municipality_factors;
CREATE POLICY "Anyone can access municipality factors" ON public.municipality_factors
  FOR ALL USING (true);

-- 56. installation_team_accounts
DROP POLICY IF EXISTS "Admins manage team accounts" ON public.installation_team_accounts;
DROP POLICY IF EXISTS "Authenticated users view team accounts" ON public.installation_team_accounts;
CREATE POLICY "Authenticated users manage team accounts" ON public.installation_team_accounts
  FOR ALL USING ((select auth.role()) = 'authenticated');

-- 57. sizes
DROP POLICY IF EXISTS "Enable read access for all users" ON public.sizes;
DROP POLICY IF EXISTS "Enable insert for all users" ON public.sizes;
DROP POLICY IF EXISTS "Enable update for all users" ON public.sizes;
DROP POLICY IF EXISTS "Enable delete for all users" ON public.sizes;
DROP POLICY IF EXISTS "allow_all_sizes" ON public.sizes;
CREATE POLICY "Anyone can access sizes" ON public.sizes
  FOR ALL USING (true);

-- 58. system_settings
DROP POLICY IF EXISTS "Allow all operations" ON public.system_settings;
DROP POLICY IF EXISTS "السماح بالقراءة للجميع" ON public.system_settings;
DROP POLICY IF EXISTS "السماح بالتحديث للمستخدمين المسجل" ON public.system_settings;
CREATE POLICY "Anyone can access system settings" ON public.system_settings
  FOR ALL USING (true);

-- 59. tasks
DROP POLICY IF EXISTS "Allow all operations on tasks" ON public.tasks;
DROP POLICY IF EXISTS "Enable delete for authenticated users" ON public.tasks;
DROP POLICY IF EXISTS "Enable insert for authenticated users" ON public.tasks;
DROP POLICY IF EXISTS "Enable update for authenticated users" ON public.tasks;
DROP POLICY IF EXISTS "Enable read access for all authenticated users" ON public.tasks;
DROP POLICY IF EXISTS "Authenticated users view tasks" ON public.tasks;
DROP POLICY IF EXISTS "tasks_select_all" ON public.tasks;
DROP POLICY IF EXISTS "tasks_insert_all" ON public.tasks;
DROP POLICY IF EXISTS "tasks_update_all" ON public.tasks;
DROP POLICY IF EXISTS "tasks_delete_all" ON public.tasks;
CREATE POLICY "Anyone can access tasks" ON public.tasks
  FOR ALL USING (true);

-- 60. printers
DROP POLICY IF EXISTS "Admins manage printers" ON public.printers;
DROP POLICY IF EXISTS "Authenticated users view printers" ON public.printers;
CREATE POLICY "Authenticated users manage printers" ON public.printers
  FOR ALL USING ((select auth.role()) = 'authenticated');

-- 61. print_tasks
DROP POLICY IF EXISTS "Admins manage print tasks" ON public.print_tasks;
DROP POLICY IF EXISTS "Authenticated users view print tasks" ON public.print_tasks;
CREATE POLICY "Authenticated users manage print tasks" ON public.print_tasks
  FOR ALL USING ((select auth.role()) = 'authenticated');

-- 62. print_task_items
DROP POLICY IF EXISTS "Admins manage print task items" ON public.print_task_items;
CREATE POLICY "Admins manage print task items" ON public.print_task_items
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 63. shared_billboards
DROP POLICY IF EXISTS "Admins manage shared billboards" ON public.shared_billboards;
DROP POLICY IF EXISTS "Authenticated users view shared billboards" ON public.shared_billboards;
CREATE POLICY "Authenticated users manage shared billboards" ON public.shared_billboards
  FOR ALL USING ((select auth.role()) = 'authenticated');

-- 64. task_designs
DROP POLICY IF EXISTS "Admins manage task designs" ON public.task_designs;
CREATE POLICY "Admins manage task designs" ON public.task_designs
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 65. purchase_invoices
DROP POLICY IF EXISTS "Admins manage purchase invoices" ON public.purchase_invoices;
CREATE POLICY "Admins manage purchase invoices" ON public.purchase_invoices
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));

-- 66. sales_invoices
DROP POLICY IF EXISTS "Admins manage sales invoices" ON public.sales_invoices;
CREATE POLICY "Admins manage sales invoices" ON public.sales_invoices
  FOR ALL USING (public.has_role((select auth.uid()), 'admin'));