-- ============================================================
-- Performance Optimization: Create Missing Indexes
-- ============================================================

-- 1. Index on pricing.size (suggested by index_advisor)
-- Query: SELECT FROM pricing ORDER BY size - called 47,382 times
CREATE INDEX IF NOT EXISTS idx_pricing_size ON public.pricing USING btree (size);

-- 2. Index on billboards.ID for faster ordering
-- Query: SELECT FROM billboards ORDER BY ID - called 9,539+ times
CREATE INDEX IF NOT EXISTS idx_billboards_id_asc ON public.billboards USING btree ("ID" ASC);

-- 3. Index on billboards.Contract_Number for faster joins
CREATE INDEX IF NOT EXISTS idx_billboards_contract_number ON public.billboards USING btree ("Contract_Number");

-- 4. Index on billboards.Status for faster filtering
CREATE INDEX IF NOT EXISTS idx_billboards_status ON public.billboards USING btree ("Status");

-- 5. Index on Contract.Contract_Number for faster lookups
CREATE INDEX IF NOT EXISTS idx_contract_contract_number ON public."Contract" USING btree ("Contract_Number");

-- 6. Index on Contract.customer_id for faster joins
CREATE INDEX IF NOT EXISTS idx_contract_customer_id ON public."Contract" USING btree (customer_id);

-- 7. Index on Contract.End Date for date range queries
CREATE INDEX IF NOT EXISTS idx_contract_end_date ON public."Contract" USING btree ("End Date");

-- 8. Index on customer_payments.customer_id for faster joins
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_id ON public.customer_payments USING btree (customer_id);

-- 9. Index on customer_payments.contract_number for faster joins
CREATE INDEX IF NOT EXISTS idx_customer_payments_contract_number ON public.customer_payments USING btree (contract_number);

-- 10. Index on customer_payments.paid_at for date range queries
CREATE INDEX IF NOT EXISTS idx_customer_payments_paid_at ON public.customer_payments USING btree (paid_at);

-- 11. Index on installation_tasks.contract_id for faster joins
CREATE INDEX IF NOT EXISTS idx_installation_tasks_contract_id ON public.installation_tasks USING btree (contract_id);

-- 12. Index on installation_tasks.status for filtering
CREATE INDEX IF NOT EXISTS idx_installation_tasks_status ON public.installation_tasks USING btree (status);

-- 13. Index on print_tasks.contract_id for faster joins
CREATE INDEX IF NOT EXISTS idx_print_tasks_contract_id ON public.print_tasks USING btree (contract_id);

-- 14. Index on print_tasks.status for filtering
CREATE INDEX IF NOT EXISTS idx_print_tasks_status ON public.print_tasks USING btree (status);

-- 15. Index on cutout_tasks.contract_id for faster joins
CREATE INDEX IF NOT EXISTS idx_cutout_tasks_contract_id ON public.cutout_tasks USING btree (contract_id);

-- 16. Index on composite_tasks.contract_id for faster joins
CREATE INDEX IF NOT EXISTS idx_composite_tasks_contract_id ON public.composite_tasks USING btree (contract_id);

-- 17. Index on composite_tasks.customer_id for faster joins
CREATE INDEX IF NOT EXISTS idx_composite_tasks_customer_id ON public.composite_tasks USING btree (customer_id);

-- 18. Index on billboard_history.billboard_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_billboard_history_billboard_id ON public.billboard_history USING btree (billboard_id);

-- 19. Index on billboard_history.contract_number for faster joins
CREATE INDEX IF NOT EXISTS idx_billboard_history_contract_number ON public.billboard_history USING btree (contract_number);

-- 20. Index on customers.name for faster searches
CREATE INDEX IF NOT EXISTS idx_customers_name ON public.customers USING btree (name);

-- 21. Index on expenses.expense_date for date range queries
CREATE INDEX IF NOT EXISTS idx_expenses_expense_date ON public.expenses USING btree (expense_date);

-- 22. Index on invoices.customer_id for faster joins
CREATE INDEX IF NOT EXISTS idx_invoices_customer_id ON public.invoices USING btree (customer_id);

-- 23. Index on invoices.created_at for date ordering
CREATE INDEX IF NOT EXISTS idx_invoices_created_at ON public.invoices USING btree (created_at);

-- 24. Index on employees.status for filtering
CREATE INDEX IF NOT EXISTS idx_employees_status ON public.employees USING btree (status);

-- 25. Composite index on billboards for common filter combinations
CREATE INDEX IF NOT EXISTS idx_billboards_status_city ON public.billboards USING btree ("Status", "City");

-- 26. Composite index on Contract for common filter combinations
CREATE INDEX IF NOT EXISTS idx_contract_status_date ON public."Contract" USING btree (payment_status, "End Date");

-- Analyze tables to update statistics after creating indexes
ANALYZE public.pricing;
ANALYZE public.billboards;
ANALYZE public."Contract";
ANALYZE public.customer_payments;
ANALYZE public.installation_tasks;
ANALYZE public.print_tasks;
ANALYZE public.cutout_tasks;
ANALYZE public.composite_tasks;
ANALYZE public.billboard_history;
ANALYZE public.customers;
ANALYZE public.expenses;
ANALYZE public.invoices;
ANALYZE public.employees;