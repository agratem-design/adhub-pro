-- =====================================================
-- PostgreSQL Full Database Restore Script
-- نظام إدارة اللوحات الإعلانية - استعادة كاملة
-- Generated: 2026-03-08
-- =====================================================
-- هذا الملف يحتوي على كل ما يلزم لإعادة إنشاء قاعدة البيانات من الصفر:
-- 1. Enums
-- 2. Sequences
-- 3. جميع الجداول الأساسية والمرتبطة
-- 4. RLS Policies
-- 5. Functions
-- 6. Triggers
-- 7. Indexes
-- =====================================================

-- ==================== 1. ENUMS ====================
DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin', 'user'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.user_role AS ENUM ('user', 'admin', 'manager', 'viewer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ==================== 2. SEQUENCES ====================
CREATE SEQUENCE IF NOT EXISTS public."Contract_id_seq";
CREATE SEQUENCE IF NOT EXISTS public.account_closures_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.billboard_faces_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.billboard_levels_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.billboard_types_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.billboards_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.expense_categories_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.expenses_flags_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.expenses_withdrawals_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.levels_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.offers_offer_number_seq;
CREATE SEQUENCE IF NOT EXISTS public.period_closures_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.pricing_categories_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.pricing_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.print_installation_pricing_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.sizes_id_seq;
CREATE SEQUENCE IF NOT EXISTS public.withdrawals_id_seq;

-- ==================== 3. BASE TABLES ====================

-- جدول الأدوار
CREATE TABLE IF NOT EXISTS public.roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, description text, permissions text[] DEFAULT '{}', created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

-- جدول أدوار المستخدمين
CREATE TABLE IF NOT EXISTS public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, role app_role NOT NULL, UNIQUE(user_id, role));

-- جدول صلاحيات المستخدمين
CREATE TABLE IF NOT EXISTS public.user_permissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, permission text NOT NULL, created_at timestamptz DEFAULT now());

-- جدول الملفات الشخصية
CREATE TABLE IF NOT EXISTS public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, name text, email text, username text, phone text, company text, avatar_url text, approved boolean DEFAULT false, status text DEFAULT 'pending', created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

-- جدول العملاء
CREATE TABLE IF NOT EXISTS public.customers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, phone text, email text, company text, address text, notes text, customer_type text DEFAULT 'individual', tax_number text, commercial_register text, city text, category text, is_customer boolean DEFAULT true, is_supplier boolean DEFAULT false, supplier_type text, last_payment_date timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

-- جدول المقاسات
CREATE TABLE IF NOT EXISTS public.sizes (id bigint PRIMARY KEY DEFAULT nextval('sizes_id_seq'), name text NOT NULL UNIQUE, width numeric, height numeric, area numeric, installation_price bigint DEFAULT 0, print_price_per_meter numeric DEFAULT 0, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

-- جدول مستويات اللوحات
CREATE TABLE IF NOT EXISTS public.billboard_levels (id integer PRIMARY KEY DEFAULT nextval('billboard_levels_id_seq'), level_code text NOT NULL UNIQUE, level_name text NOT NULL, description text, sort_order integer NOT NULL UNIQUE, created_at timestamptz DEFAULT now());

-- جدول أوجه اللوحات
CREATE TABLE IF NOT EXISTS public.billboard_faces (id integer PRIMARY KEY DEFAULT nextval('billboard_faces_id_seq'), name text NOT NULL, face_count integer NOT NULL DEFAULT 2, count integer, description text, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), CONSTRAINT unique_face_count UNIQUE(face_count));

-- جدول أنواع اللوحات
CREATE TABLE IF NOT EXISTS public.billboard_types (id integer PRIMARY KEY DEFAULT nextval('billboard_types_id_seq'), name text NOT NULL, color text, description text, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

-- جدول شركات الأصدقاء
CREATE TABLE IF NOT EXISTS public.friend_companies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, phone text, email text, contact_person text, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

-- جدول الشركاء
CREATE TABLE IF NOT EXISTS public.partners (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, phone text, email text, company text, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

-- جدول اللوحات الإعلانية
CREATE TABLE IF NOT EXISTS public.billboards ("ID" bigint PRIMARY KEY DEFAULT nextval('billboards_id_seq'), "Billboard_Name" text, "City" text, "District" text, "Municipality" text, "Nearest_Landmark" text, "GPS_Coordinates" text, "GPS_Link" text, "Size" text, size_id integer REFERENCES public.sizes(id), "Level" text, "Category_Level" text, "Faces_Count" integer, "Ad_Type" text, "Status" text DEFAULT 'متاح', "Customer_Name" text, "Contract_Number" bigint, "Rent_Start_Date" text, "Rent_End_Date" text, "Price" numeric, "Days_Count" text, "Order_Size" text, "Image_URL" text, image_name text, "Review" text, billboard_type text, design_face_a text, design_face_b text, has_cutout boolean DEFAULT false, is_partnership boolean DEFAULT false, partner_companies text[], friend_company_id uuid REFERENCES public.friend_companies(id), capital numeric, capital_remaining numeric, maintenance_status text, maintenance_type text, maintenance_date text, maintenance_notes text, maintenance_cost numeric, maintenance_priority text, next_maintenance_date text, needs_rephotography boolean DEFAULT false, is_visible_in_available boolean DEFAULT true, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

-- جدول العقود
CREATE TABLE IF NOT EXISTS public."Contract" ("Contract_Number" bigint PRIMARY KEY DEFAULT nextval('"Contract_id_seq"'), id bigint NOT NULL DEFAULT nextval('"Contract_id_seq"'), "Customer Name" text, customer_category text, "Phone" text, "Company" text, "Contract Date" date, "Duration" text, "End Date" date, "Ad Type" text, "Total Rent" double precision, "Discount" double precision, installation_cost bigint, fee text, "Total" numeric, "Print Status" text, "Renewal Status" text, "Total Paid" text, "Payment 1" jsonb, "Payment 2" text, "Payment 3" text, "Remaining" text, customer_id uuid REFERENCES public.customers(id), billboard_id bigint, billboards_data text, billboards_count integer DEFAULT 0, billboard_ids text, billboard_prices text, single_face_billboards text, base_rent numeric DEFAULT 0, print_cost bigint, print_cost_enabled text, print_price_per_meter text, print_cost_details jsonb, operating_fee_rate bigint, operating_fee_rate_installation numeric DEFAULT 3, operating_fee_rate_print numeric DEFAULT 3, include_installation_in_price boolean NOT NULL DEFAULT false, include_print_in_billboard_price boolean NOT NULL DEFAULT false, include_operating_in_installation boolean DEFAULT false, include_operating_in_print boolean DEFAULT false, installation_enabled boolean DEFAULT true, design_data jsonb, level_discounts jsonb, partnership_data jsonb, partnership_operating_data jsonb, partnership_operating_fee_rate numeric DEFAULT 0, friend_rental_data jsonb, friend_rental_includes_installation boolean DEFAULT false, friend_rental_operating_fee_enabled boolean DEFAULT false, friend_rental_operating_fee_rate numeric DEFAULT 3, installment_count integer DEFAULT 2, installment_interval text DEFAULT 'month', installment_auto_calculate boolean DEFAULT true, installment_distribution_type text DEFAULT 'even', installment_first_at_signing boolean DEFAULT true, installment_first_payment_amount numeric DEFAULT 0, installment_first_payment_type text DEFAULT 'amount', installments_data text, payment_status text DEFAULT 'unpaid', billboards_released boolean DEFAULT false, contract_currency text, exchange_rate text, previous_contract_number bigint, ignore_removal_alert boolean DEFAULT false, CONSTRAINT "Contract_Contract_Number_key" UNIQUE("Contract_Number"));

-- جدول الموظفين
CREATE TABLE IF NOT EXISTS public.employees (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, phone text, email text, position text, department text, hire_date date, basic_salary numeric DEFAULT 0, allowances numeric DEFAULT 0, status text DEFAULT 'active', notes text, nationality text, id_number text, bank_name text, bank_account text, contract_type text DEFAULT 'full_time', created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

-- جدول المطبعات
CREATE TABLE IF NOT EXISTS public.printers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, phone text, email text, address text, contact_person text, notes text, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

-- جدول فرق التركيب
CREATE TABLE IF NOT EXISTS public.installation_teams (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), team_name text NOT NULL, sizes text[] NOT NULL DEFAULT '{}', cities text[] DEFAULT '{}', created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now());

-- جدول فئات المصروفات
CREATE TABLE IF NOT EXISTS public.expense_categories (id bigint PRIMARY KEY DEFAULT nextval('expense_categories_id_seq'), name text NOT NULL, description text, color text, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

-- جدول المستويات
CREATE TABLE IF NOT EXISTS public.levels (id bigint PRIMARY KEY DEFAULT nextval('levels_id_seq'), name text NOT NULL, code text, description text, created_at timestamptz DEFAULT now());

-- جدول البلديات
CREATE TABLE IF NOT EXISTS public.municipalities (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, city text, region text, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

-- جدول فئات التسعير
CREATE TABLE IF NOT EXISTS public.pricing_categories (id bigint PRIMARY KEY DEFAULT nextval('pricing_categories_id_seq'), name text NOT NULL, description text, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

-- ==================== 4. LINKED TABLES ====================

CREATE TABLE IF NOT EXISTS public.billboard_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), billboard_id bigint NOT NULL, contract_number bigint, customer_name text, ad_type text, start_date text, end_date text, duration_days integer, rent_amount numeric, billboard_rent_price numeric, discount_amount numeric, discount_percentage numeric, total_before_discount numeric, net_rental_amount numeric, installation_cost numeric, installation_date date, print_cost numeric, design_name text, design_face_a_url text, design_face_b_url text, installed_image_face_a_url text, installed_image_face_b_url text, team_name text, notes text, pricing_mode text, pricing_category text, include_print_in_price boolean, include_installation_in_price boolean, contract_total_rent numeric, contract_total numeric, contract_discount numeric, individual_billboard_data jsonb, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.account_closures (id integer PRIMARY KEY DEFAULT nextval('account_closures_id_seq'), contract_id integer, closure_date date NOT NULL, total_withdrawn numeric DEFAULT 0, remaining_balance numeric DEFAULT 0, notes text, created_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.base_prices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), size_name text NOT NULL, billboard_level text NOT NULL DEFAULT 'A', one_day numeric DEFAULT 0, one_month numeric DEFAULT 0, two_months numeric DEFAULT 0, three_months numeric DEFAULT 0, six_months numeric DEFAULT 0, full_year numeric DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(size_name, billboard_level));

CREATE TABLE IF NOT EXISTS public.billboard_cost_centers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), billboard_id bigint NOT NULL REFERENCES public.billboards("ID"), cost_type text NOT NULL, amount numeric DEFAULT 0, vendor_name text, frequency text, period_start text, period_end text, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.billboard_extensions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), billboard_id bigint NOT NULL REFERENCES public.billboards("ID"), contract_number bigint REFERENCES public."Contract"("Contract_Number"), old_end_date text NOT NULL, new_end_date text NOT NULL, extension_days integer NOT NULL, extension_type text DEFAULT 'manual', reason text NOT NULL, notes text, created_by text, created_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.customer_payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid REFERENCES public.customers(id), contract_number bigint, amount numeric NOT NULL, payment_method text DEFAULT 'cash', payment_date date DEFAULT CURRENT_DATE, paid_at timestamptz DEFAULT now(), notes text, entry_type text DEFAULT 'payment', receipt_number text, purchase_invoice_id uuid, distributed_payment_id uuid, intermediary_commission numeric DEFAULT 0, transfer_fee numeric DEFAULT 0, net_amount numeric DEFAULT 0, commission_notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.customer_purchases (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid REFERENCES public.customers(id), description text NOT NULL, total_price numeric NOT NULL, purchase_date date DEFAULT CURRENT_DATE, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.installation_tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contract_id bigint REFERENCES public."Contract"("Contract_Number"), team_id uuid REFERENCES public.installation_teams(id), status text DEFAULT 'pending', task_type text DEFAULT 'new_installation', print_task_id uuid, cutout_task_id uuid, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), UNIQUE(contract_id, team_id));

CREATE TABLE IF NOT EXISTS public.installation_task_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL REFERENCES public.installation_tasks(id) ON DELETE CASCADE, billboard_id bigint NOT NULL, status text DEFAULT 'pending', installation_date date, notes text, design_face_a text, design_face_b text, installed_image_face_a_url text, installed_image_face_b_url text, selected_design_id uuid, faces_to_install integer DEFAULT 2, company_installation_cost numeric DEFAULT 0, customer_installation_cost numeric DEFAULT 0, company_additional_cost numeric DEFAULT 0, company_additional_cost_notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), UNIQUE(task_id, billboard_id));

CREATE TABLE IF NOT EXISTS public.installation_team_accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), team_id uuid REFERENCES public.installation_teams(id), task_item_id uuid UNIQUE, billboard_id bigint, contract_id bigint, installation_date date, amount numeric DEFAULT 0, status text DEFAULT 'pending', payment_date date, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.printed_invoices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_number text, contract_number bigint, contract_numbers text, customer_id uuid REFERENCES public.customers(id), customer_name text, printer_name text, printer_id uuid REFERENCES public.printers(id), printer_cost numeric DEFAULT 0, invoice_date date DEFAULT CURRENT_DATE, total_amount numeric DEFAULT 0, subtotal numeric DEFAULT 0, discount numeric DEFAULT 0, discount_type text, discount_amount numeric DEFAULT 0, total numeric DEFAULT 0, items jsonb, print_items jsonb, notes text, design_face_a_path text, design_face_b_path text, invoice_type text, currency_code text, currency_symbol text, payment_method text, account_deduction numeric DEFAULT 0, account_payments_deducted numeric DEFAULT 0, include_account_balance boolean DEFAULT false, paid boolean DEFAULT false, paid_amount numeric DEFAULT 0, paid_at timestamptz, locked boolean DEFAULT false, composite_task_id uuid, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.print_tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contract_id bigint, printer_id uuid REFERENCES public.printers(id), invoice_id uuid REFERENCES public.printed_invoices(id), total_cost numeric DEFAULT 0, customer_total_amount numeric DEFAULT 0, is_composite boolean DEFAULT false, status text DEFAULT 'pending', notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.print_task_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL REFERENCES public.print_tasks(id) ON DELETE CASCADE, billboard_id bigint NOT NULL, size text, faces integer DEFAULT 2, area numeric DEFAULT 0, cost_per_meter numeric DEFAULT 0, total_cost numeric DEFAULT 0, customer_cost numeric DEFAULT 0, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.cutout_tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contract_id bigint, printer_id uuid REFERENCES public.printers(id), invoice_id uuid, total_cost numeric DEFAULT 0, customer_total_amount numeric DEFAULT 0, is_composite boolean DEFAULT false, status text DEFAULT 'pending', notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.cutout_task_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL REFERENCES public.cutout_tasks(id) ON DELETE CASCADE, billboard_id bigint NOT NULL, size text, cutout_type text, total_cost numeric DEFAULT 0, customer_cost numeric DEFAULT 0, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.composite_tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_number bigint NOT NULL GENERATED BY DEFAULT AS IDENTITY, installation_task_id uuid REFERENCES public.installation_tasks(id), contract_id bigint REFERENCES public."Contract"("Contract_Number"), customer_id uuid REFERENCES public.customers(id), customer_name text, task_type text NOT NULL, status text DEFAULT 'pending', customer_installation_cost numeric DEFAULT 0, company_installation_cost numeric DEFAULT 0, customer_print_cost numeric DEFAULT 0, company_print_cost numeric DEFAULT 0, customer_cutout_cost numeric DEFAULT 0, company_cutout_cost numeric DEFAULT 0, customer_total numeric DEFAULT 0, company_total numeric DEFAULT 0, net_profit numeric DEFAULT 0, profit_percentage numeric DEFAULT 0, discount_amount numeric DEFAULT 0, discount_reason text, print_discount numeric DEFAULT 0, print_discount_reason text, installation_discount numeric DEFAULT 0, installation_discount_reason text, cutout_discount numeric DEFAULT 0, cutout_discount_reason text, paid_amount numeric DEFAULT 0, print_task_id uuid REFERENCES public.print_tasks(id), cutout_task_id uuid REFERENCES public.cutout_tasks(id), combined_invoice_id uuid REFERENCES public.printed_invoices(id), invoice_generated boolean DEFAULT false, invoice_date text, notes text, cost_allocation jsonb, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.contract_expenses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contract_number bigint NOT NULL REFERENCES public."Contract"("Contract_Number"), expense_type text NOT NULL, reason text NOT NULL, amount numeric DEFAULT 0, unit_price numeric DEFAULT 0, quantity integer DEFAULT 1, item_name text, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.expenses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, amount numeric NOT NULL, expense_date date DEFAULT CURRENT_DATE, category_id bigint REFERENCES public.expense_categories(id), description text, payment_method text DEFAULT 'cash', receipt_number text, vendor text, employee_id uuid REFERENCES public.employees(id), notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.custody_accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), account_number text NOT NULL, custody_name text, employee_id uuid NOT NULL REFERENCES public.employees(id), initial_amount numeric DEFAULT 0, current_balance numeric DEFAULT 0, assigned_date date DEFAULT CURRENT_DATE, closed_date date, status text DEFAULT 'active', source_type text, source_payment_id uuid, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.custody_expenses (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), custody_account_id uuid NOT NULL REFERENCES public.custody_accounts(id), description text NOT NULL, amount numeric NOT NULL, expense_category text NOT NULL, expense_date date DEFAULT CURRENT_DATE, vendor_name text, receipt_number text, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.custody_transactions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), custody_account_id uuid NOT NULL REFERENCES public.custody_accounts(id), transaction_type text NOT NULL, amount numeric NOT NULL, description text, reference_number text, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.employee_advances (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), employee_id uuid NOT NULL REFERENCES public.employees(id), amount numeric NOT NULL, advance_date date DEFAULT CURRENT_DATE, reason text, status text DEFAULT 'pending', distributed_payment_id uuid, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.employee_contracts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), employee_id uuid NOT NULL REFERENCES public.employees(id), contract_type text DEFAULT 'full_time', start_date date, end_date date, salary numeric DEFAULT 0, allowances numeric DEFAULT 0, notes text, status text DEFAULT 'active', created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.employee_deductions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), employee_id uuid NOT NULL REFERENCES public.employees(id), amount numeric NOT NULL, deduction_date date DEFAULT CURRENT_DATE, deduction_type text DEFAULT 'salary', reason text, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.employee_manual_tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), employee_id uuid NOT NULL REFERENCES public.employees(id), task_description text NOT NULL, task_date date DEFAULT CURRENT_DATE, status text DEFAULT 'pending', priority text DEFAULT 'normal', notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.payroll_runs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), period_start date NOT NULL, period_end date NOT NULL, status text DEFAULT 'draft', notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.payroll_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), payroll_id uuid NOT NULL REFERENCES public.payroll_runs(id) ON DELETE CASCADE, employee_id uuid NOT NULL REFERENCES public.employees(id), basic_salary numeric DEFAULT 0, allowances numeric DEFAULT 0, overtime_amount numeric DEFAULT 0, deductions numeric DEFAULT 0, advances_deduction numeric DEFAULT 0, tax numeric DEFAULT 0, social_security numeric DEFAULT 0, net_salary numeric DEFAULT 0, paid boolean DEFAULT false, payment_date date, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.payments_salary (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), employee_id uuid REFERENCES public.employees(id), amount numeric NOT NULL, payment_date date DEFAULT CURRENT_DATE, payment_method text DEFAULT 'cash', notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.friend_billboard_rentals (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), billboard_id bigint NOT NULL, contract_number bigint, friend_company_id uuid REFERENCES public.friend_companies(id), friend_rental_cost numeric DEFAULT 0, customer_rental_price numeric DEFAULT 0, profit numeric GENERATED ALWAYS AS (customer_rental_price - friend_rental_cost) STORED, start_date date, end_date date, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), UNIQUE(billboard_id, contract_number));

CREATE TABLE IF NOT EXISTS public.shared_billboards (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), billboard_id bigint NOT NULL, partner_company_id uuid REFERENCES public.partners(id), capital_contribution numeric DEFAULT 0, capital_remaining numeric DEFAULT 0, reserved_amount numeric DEFAULT 0, confirmed_amount numeric DEFAULT 0, partner_pre_pct numeric DEFAULT 0, partner_post_pct numeric DEFAULT 0, status text DEFAULT 'active', notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.shared_transactions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), billboard_id bigint, contract_id bigint, partner_company_id uuid REFERENCES public.partners(id), beneficiary text, amount numeric DEFAULT 0, type text NOT NULL, transaction_date date DEFAULT CURRENT_DATE, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.partnership_contract_shares (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contract_id bigint, billboard_id bigint, partner_id uuid REFERENCES public.partners(id), capital_deduction numeric DEFAULT 0, partner_share numeric DEFAULT 0, company_share numeric DEFAULT 0, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.invoices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_number text, customer_id uuid REFERENCES public.customers(id), contract_number bigint, invoice_date date DEFAULT CURRENT_DATE, due_date date, total_amount numeric DEFAULT 0, status text DEFAULT 'draft', notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.invoice_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid REFERENCES public.invoices(id) ON DELETE CASCADE, billboard_id bigint NOT NULL, description text NOT NULL, quantity integer DEFAULT 1, unit_price numeric NOT NULL, total_price numeric, days_count integer, start_date date, end_date date, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.sales_invoices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_number text, invoice_name text, customer_id uuid REFERENCES public.customers(id), customer_name text, invoice_date date DEFAULT CURRENT_DATE, total_amount numeric DEFAULT 0, items jsonb, notes text, status text DEFAULT 'draft', paid boolean DEFAULT false, paid_amount numeric DEFAULT 0, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.sales_invoice_payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid REFERENCES public.sales_invoices(id), amount numeric NOT NULL, payment_date date DEFAULT CURRENT_DATE, payment_method text DEFAULT 'cash', notes text, created_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.purchase_invoices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_number text, supplier_name text, supplier_id uuid, invoice_date date DEFAULT CURRENT_DATE, total_amount numeric DEFAULT 0, paid_amount numeric DEFAULT 0, status text DEFAULT 'unpaid', notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.purchase_invoice_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid REFERENCES public.purchase_invoices(id) ON DELETE CASCADE, description text NOT NULL, quantity integer DEFAULT 1, unit_price numeric DEFAULT 0, total_price numeric DEFAULT 0, created_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.purchase_invoice_payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid REFERENCES public.purchase_invoices(id), amount numeric NOT NULL, payment_date date DEFAULT CURRENT_DATE, payment_method text DEFAULT 'cash', notes text, created_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.printer_payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), printer_id uuid REFERENCES public.printers(id), amount numeric NOT NULL, payment_date date DEFAULT CURRENT_DATE, payment_method text DEFAULT 'cash', notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.pricing (id bigint PRIMARY KEY DEFAULT nextval('pricing_id_seq'), size_id bigint REFERENCES public.sizes(id), category_id bigint REFERENCES public.pricing_categories(id), duration_id bigint, price numeric DEFAULT 0, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.pricing_durations (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, days integer NOT NULL, sort_order integer DEFAULT 0, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.category_factors (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), category_name text NOT NULL, factor numeric DEFAULT 1, description text, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.municipality_factors (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), municipality_name text NOT NULL, factor numeric DEFAULT 1, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.municipality_rent_prices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), municipality_id uuid REFERENCES public.municipalities(id), size_id bigint REFERENCES public.sizes(id), price numeric DEFAULT 0, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.installation_print_pricing (id bigint PRIMARY KEY DEFAULT nextval('print_installation_pricing_id_seq'), size text NOT NULL, install_price numeric DEFAULT 0, print_price numeric DEFAULT 0, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.offers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), offer_number bigint DEFAULT nextval('offers_offer_number_seq'), customer_id uuid REFERENCES public.customers(id), customer_name text, offer_date date DEFAULT CURRENT_DATE, valid_until date, status text DEFAULT 'draft', items jsonb, total_amount numeric DEFAULT 0, discount numeric DEFAULT 0, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.booking_requests (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid REFERENCES public.customers(id), billboard_ids bigint[] NOT NULL, start_date date NOT NULL, end_date date NOT NULL, total_price numeric NOT NULL, status text DEFAULT 'pending', notes text, admin_notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.customer_general_discounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid REFERENCES public.customers(id), discount_type text DEFAULT 'percentage', discount_value numeric DEFAULT 0, reason text, valid_from date, valid_to date, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.removal_tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contract_id bigint, team_id uuid REFERENCES public.installation_teams(id), status text DEFAULT 'pending', notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.removal_task_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid REFERENCES public.removal_tasks(id) ON DELETE CASCADE, billboard_id bigint NOT NULL, status text DEFAULT 'pending', removal_date date, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.distributions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, distribution_date date DEFAULT CURRENT_DATE, total_amount numeric DEFAULT 0, status text DEFAULT 'draft', notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.distribution_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), distribution_id uuid REFERENCES public.distributions(id) ON DELETE CASCADE, employee_id uuid REFERENCES public.employees(id), amount numeric DEFAULT 0, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text NOT NULL, report_type text, content jsonb, created_by uuid, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.report_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), report_id uuid REFERENCES public.reports(id) ON DELETE CASCADE, item_type text, data jsonb, sort_order integer DEFAULT 0, created_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.cleanup_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), cleanup_date timestamptz DEFAULT now(), billboards_cleaned integer DEFAULT 0, cleanup_type text DEFAULT 'manual', notes text, billboard_ids_cleaned integer[], created_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.print_settings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), setting_key text NOT NULL, primary_color text DEFAULT '#D4AF37', secondary_color text DEFAULT '#1a1a2e', accent_color text DEFAULT '#c0a060', font_family text DEFAULT 'Doran', title_font_size integer DEFAULT 18, header_font_size integer DEFAULT 14, body_font_size integer DEFAULT 12, show_logo boolean DEFAULT true, logo_path text DEFAULT '/logofaresgold.svg', logo_size integer DEFAULT 80, show_footer boolean DEFAULT true, footer_text text DEFAULT '', direction text DEFAULT 'rtl', show_company_name boolean DEFAULT true, company_name text DEFAULT '', company_address text DEFAULT '', company_phone text DEFAULT '', page_margin_top integer DEFAULT 10, page_margin_bottom integer DEFAULT 10, page_margin_left integer DEFAULT 10, page_margin_right integer DEFAULT 10, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.billboard_print_settings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), setting_key text DEFAULT 'default', background_url text, background_width text, background_height text, elements jsonb, primary_font text, secondary_font text, custom_css text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.billboard_print_profiles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), profile_name text NOT NULL, description text, settings_data jsonb NOT NULL, is_default boolean DEFAULT false, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.contract_template_settings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), setting_key text NOT NULL, setting_value jsonb NOT NULL, background_url text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.contract_terms (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), term_key text NOT NULL, term_title text NOT NULL, term_content text NOT NULL, term_order integer DEFAULT 0, is_active boolean DEFAULT true, font_size integer, font_weight text, position_x integer, position_y integer, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.system_settings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), setting_key text NOT NULL UNIQUE, setting_value jsonb, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.messaging_settings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider text NOT NULL, api_key text, settings jsonb, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.messaging_api_settings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), provider text NOT NULL, api_url text, api_key text, settings jsonb, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.management_phones (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), phone_number text NOT NULL, label text, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.maintenance_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), billboard_id bigint, maintenance_type text, maintenance_date date DEFAULT CURRENT_DATE, cost numeric DEFAULT 0, description text, status text DEFAULT 'completed', notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.task_designs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid, billboard_id bigint, design_face_a_url text, design_face_b_url text, design_name text, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.timesheets (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), employee_id uuid NOT NULL REFERENCES public.employees(id), date date NOT NULL, check_in timestamptz, check_out timestamptz, hours numeric, notes text, created_at timestamptz NOT NULL DEFAULT now());

CREATE TABLE IF NOT EXISTS public.municipality_stickers_settings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), setting_key text NOT NULL, setting_value jsonb, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.municipality_collections (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, municipality_id uuid REFERENCES public.municipalities(id), collection_date date DEFAULT CURRENT_DATE, total_amount numeric DEFAULT 0, status text DEFAULT 'pending', notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.municipality_collection_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), collection_id uuid REFERENCES public.municipality_collections(id) ON DELETE CASCADE, billboard_id bigint, amount numeric DEFAULT 0, notes text, created_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.print_backgrounds (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, url text NOT NULL, width text, height text, is_default boolean DEFAULT false, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.print_reprints (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), original_invoice_id uuid, reprint_date timestamptz DEFAULT now(), reason text, created_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.print_invoice_payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_id uuid REFERENCES public.printed_invoices(id), amount numeric NOT NULL, payment_date date DEFAULT CURRENT_DATE, payment_method text DEFAULT 'cash', notes text, created_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.site_theme_settings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), setting_key text NOT NULL UNIQUE, setting_value jsonb, logo_url text, favicon_url text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.billboard_print_customization (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), setting_key text DEFAULT 'default', primary_font text, secondary_font text, preview_background text, preview_zoom text, main_image_left text, main_image_top text, main_image_width text, main_image_height text, billboard_name_left text, billboard_name_top text, billboard_name_font_size text, billboard_name_color text, billboard_name_alignment text, billboard_name_font_weight text, billboard_name_offset_x text, location_info_left text, location_info_top text, location_info_font_size text, location_info_color text, location_info_alignment text, location_info_width text, location_info_offset_x text, landmark_info_left text, landmark_info_top text, landmark_info_font_size text, landmark_info_color text, landmark_info_alignment text, landmark_info_width text, landmark_info_offset_x text, size_left text, size_top text, size_font_size text, size_color text, size_alignment text, size_font_weight text, size_offset_x text, faces_count_left text, faces_count_top text, faces_count_font_size text, faces_count_color text, faces_count_alignment text, faces_count_offset_x text, contract_number_right text, contract_number_top text, contract_number_font_size text, contract_number_color text, contract_number_alignment text, contract_number_font_weight text, contract_number_offset_x text, team_name_right text, team_name_top text, team_name_font_size text, team_name_color text, team_name_alignment text, team_name_font_weight text, team_name_offset_x text, installation_date_right text, installation_date_top text, installation_date_font_size text, installation_date_color text, installation_date_alignment text, installation_date_font_weight text, installation_date_offset_x text, qr_left text, qr_top text, qr_size text, designs_left text, designs_top text, designs_width text, designs_gap text, design_image_height text, installed_images_left text, installed_images_top text, installed_images_width text, installed_images_gap text, installed_image_height text, status_badges_left text, status_badges_top text, status_badges_show text, status_badges_font_size text, status_overrides jsonb, coords_font_size text, coords_font_family text, coords_bar_height text, map_zoom text, map_show_labels text, pin_size text, pin_color text, pin_text_color text, custom_pin_url text, cover_page_enabled text, cover_logo_url text, cover_logo_size text, cover_logo_top text, cover_logo_left text, cover_logo_align text, cover_phrase text, cover_phrase_font_size text, cover_phrase_top text, cover_phrase_left text, cover_phrase_align text, cover_municipality_font_size text, cover_municipality_top text, cover_municipality_left text, cover_municipality_align text, cover_background_enabled text, cover_background_url text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.activity_log (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), action text NOT NULL, entity_type text NOT NULL, entity_id text, contract_number bigint, customer_name text, ad_type text, description text NOT NULL, details jsonb, user_id uuid, created_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.expenses_flags (id bigint PRIMARY KEY DEFAULT nextval('expenses_flags_id_seq'), expense_id uuid, flag_type text, notes text, created_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.expenses_withdrawals (id bigint PRIMARY KEY DEFAULT nextval('expenses_withdrawals_id_seq'), employee_id uuid, amount numeric NOT NULL, withdrawal_date date DEFAULT CURRENT_DATE, notes text, created_at timestamptz DEFAULT now());

CREATE TABLE IF NOT EXISTS public.period_closures (id bigint PRIMARY KEY DEFAULT nextval('period_closures_id_seq'), period_start date NOT NULL, period_end date NOT NULL, closed_by uuid, notes text, created_at timestamptz DEFAULT now());


-- ==================== 5. ENABLE RLS ====================

ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sizes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billboard_levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billboard_faces ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billboard_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Contract" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installation_teams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installation_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installation_task_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installation_team_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printed_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_task_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cutout_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cutout_task_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.composite_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custody_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custody_expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.custody_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_advances ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_contracts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_manual_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments_salary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friend_billboard_rentals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_billboards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.shared_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partnership_contract_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sales_invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoice_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.purchase_invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.printer_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.pricing_durations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.category_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipality_factors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipality_rent_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.base_prices ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billboard_cost_centers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billboard_extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billboard_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.customer_general_discounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.removal_tasks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.removal_task_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.distribution_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.report_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cleanup_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billboard_print_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billboard_print_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_template_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contract_terms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.account_closures ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.municipalities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.maintenance_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_invoice_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.print_reprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messaging_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messaging_api_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.management_phones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.site_theme_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.installation_print_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billboard_print_customization ENABLE ROW LEVEL SECURITY;


-- ==================== 6. CORE FUNCTIONS ====================

-- دالة فحص الصلاحيات
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles ur JOIN public.roles r ON ur.role::text = r.name WHERE ur.user_id = _user_id AND r.permissions @> ARRAY[_permission]::text[]) $$;

-- دالة فحص الأدوار
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $$ SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role) $$;

-- دالة تحديث updated_at
CREATE OR REPLACE FUNCTION public.set_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.update_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;

-- دالة حساب أرباح المهام المجمعة
CREATE OR REPLACE FUNCTION public.calculate_composite_task_profit() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  NEW.customer_total := COALESCE(NEW.customer_installation_cost, 0) + COALESCE(NEW.customer_print_cost, 0) + COALESCE(NEW.customer_cutout_cost, 0) - COALESCE(NEW.discount_amount, 0);
  NEW.company_total := COALESCE(NEW.company_installation_cost, 0) + COALESCE(NEW.company_print_cost, 0) + COALESCE(NEW.company_cutout_cost, 0);
  NEW.net_profit := NEW.customer_total - NEW.company_total;
  IF NEW.customer_total > 0 THEN NEW.profit_percentage := (NEW.net_profit / NEW.customer_total) * 100; ELSE NEW.profit_percentage := 0; END IF;
  RETURN NEW;
END;
$$;

-- دالة تحديث رصيد العهدة عند المصروف
CREATE OR REPLACE FUNCTION public.update_custody_balance_on_expense() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE custody_accounts SET current_balance = current_balance - NEW.amount, updated_at = now() WHERE id = NEW.custody_account_id;
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE custody_accounts SET current_balance = current_balance + OLD.amount - NEW.amount, updated_at = now() WHERE id = NEW.custody_account_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE custody_accounts SET current_balance = current_balance + OLD.amount, updated_at = now() WHERE id = OLD.custody_account_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- دالة تحديث آخر دفعة للعميل
CREATE OR REPLACE FUNCTION public.update_customer_last_payment() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$ BEGIN UPDATE customers SET last_payment_date = NEW.paid_at WHERE id = NEW.customer_id; RETURN NEW; END; $$;

-- دالة حذف اللوحة الآمن
CREATE OR REPLACE FUNCTION public.safe_delete_billboard(input_billboard_id bigint) RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE has_active_contracts BOOLEAN;
BEGIN
  IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Unauthorized: Admin role required'; END IF;
  SELECT EXISTS(SELECT 1 FROM "Contract" WHERE billboard_id = input_billboard_id AND "End Date" >= CURRENT_DATE) INTO has_active_contracts;
  IF has_active_contracts THEN RAISE EXCEPTION 'لا يمكن حذف اللوحة - توجد عقود نشطة مرتبطة بها'; RETURN FALSE; END IF;
  DELETE FROM "Contract" WHERE billboard_id = input_billboard_id;
  DELETE FROM billboards WHERE "ID" = input_billboard_id;
  RETURN TRUE;
END;
$$;

-- دالة تنظيف اللوحات المنتهية
CREATE OR REPLACE FUNCTION public.cleanup_orphaned_data() RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE cleaned_count INTEGER := 0;
BEGIN
  UPDATE billboards SET "Status" = 'متاح', "Customer_Name" = NULL, "Contract_Number" = NULL, "Rent_Start_Date" = NULL, "Rent_End_Date" = NULL
  WHERE "Contract_Number" IS NOT NULL AND NOT EXISTS (SELECT 1 FROM "Contract" WHERE "Contract_Number" = billboards."Contract_Number")
  AND NOT EXISTS (SELECT 1 FROM "Contract" c WHERE c."End Date" IS NOT NULL AND c."End Date"::date >= CURRENT_DATE AND c.billboard_ids IS NOT NULL AND billboards."ID" = ANY(string_to_array(c.billboard_ids, ',')::bigint[]));
  GET DIAGNOSTICS cleaned_count = ROW_COUNT;
  UPDATE billboards SET "Status" = 'متاح', "Contract_Number" = NULL, "Customer_Name" = NULL, "Rent_Start_Date" = NULL, "Rent_End_Date" = NULL
  WHERE "Status" IN ('مؤجر', 'محجوز') AND "Rent_End_Date" IS NOT NULL AND "Rent_End_Date"::date < CURRENT_DATE
  AND NOT EXISTS (SELECT 1 FROM "Contract" c WHERE c."End Date" IS NOT NULL AND c."End Date"::date >= CURRENT_DATE AND c.billboard_ids IS NOT NULL AND billboards."ID" = ANY(string_to_array(c.billboard_ids, ',')::bigint[]));
  RETURN cleaned_count;
END;
$$;

-- دالة مزامنة اللوحات من العقد (النسخة المحسنة)
CREATE OR REPLACE FUNCTION public.sync_billboards_from_contract(p_contract_number bigint)
RETURNS json LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_contract RECORD;
  v_billboard_ids bigint[];
  v_updated_count integer := 0;
  v_newest_contract RECORD;
BEGIN
  SELECT * INTO v_contract FROM "Contract" WHERE "Contract_Number" = p_contract_number;
  IF v_contract IS NULL THEN 
    RETURN json_build_object('success', false, 'error', 'Contract not found');
  END IF;
  
  IF v_contract.billboard_ids IS NULL OR v_contract.billboard_ids = '' THEN 
    RETURN json_build_object('success', true, 'updated', 0);
  END IF;
  
  SELECT ARRAY_AGG(CAST(TRIM(x) AS bigint)) INTO v_billboard_ids
  FROM unnest(string_to_array(v_contract.billboard_ids, ',')) x WHERE TRIM(x) ~ '^\d+$';
  
  IF v_billboard_ids IS NULL THEN 
    RETURN json_build_object('success', true, 'updated', 0);
  END IF;
  
  -- تحديث اللوحات فقط إذا كان هذا العقد هو الأحدث أو تاريخ انتهائه مستقبلي
  FOR v_newest_contract IN
    SELECT b."ID" as billboard_id, c."Contract_Number", c."Customer Name", c."Contract Date", c."End Date"
    FROM unnest(v_billboard_ids) AS b("ID")
    LEFT JOIN LATERAL (
      SELECT * FROM "Contract" cc
      WHERE cc.billboard_ids IS NOT NULL
        AND b."ID" = ANY(string_to_array(cc.billboard_ids, ',')::bigint[])
        AND cc."End Date" IS NOT NULL
      ORDER BY cc."End Date" DESC, cc."Contract_Number" DESC
      LIMIT 1
    ) c ON true
  LOOP
    IF v_newest_contract."Contract_Number" = p_contract_number THEN
      UPDATE billboards 
      SET "Status" = CASE 
            WHEN v_newest_contract."End Date" < CURRENT_DATE THEN 'متاح'
            ELSE 'مؤجر'
          END,
          "Contract_Number" = CASE 
            WHEN v_newest_contract."End Date" < CURRENT_DATE THEN NULL
            ELSE v_newest_contract."Contract_Number"
          END,
          "Customer_Name" = CASE 
            WHEN v_newest_contract."End Date" < CURRENT_DATE THEN NULL
            ELSE v_newest_contract."Customer Name"
          END,
          "Rent_Start_Date" = CASE 
            WHEN v_newest_contract."End Date" < CURRENT_DATE THEN NULL
            ELSE v_newest_contract."Contract Date"::text
          END,
          "Rent_End_Date" = CASE 
            WHEN v_newest_contract."End Date" < CURRENT_DATE THEN NULL
            ELSE v_newest_contract."End Date"::text
          END
      WHERE "ID" = v_newest_contract.billboard_id;
      v_updated_count := v_updated_count + 1;
    END IF;
  END LOOP;
  
  RETURN json_build_object('success', true, 'updated', v_updated_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.t_sync_billboards_from_contract() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$ BEGIN PERFORM public.sync_billboards_from_contract(NEW."Contract_Number"); RETURN NEW; END; $$;

-- دالة إنشاء مهام التركيب تلقائياً
CREATE OR REPLACE FUNCTION public.auto_create_installation_tasks() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE
  billboard_id_array bigint[];
  existing_billboard_ids bigint[];
  new_billboard_ids bigint[];
  removed_billboard_ids bigint[];
  team_rec RECORD;
  task_id_var uuid;
  is_update boolean;
BEGIN
  IF NEW."Contract_Number" < 1161 THEN RETURN NEW; END IF;
  IF COALESCE(NEW.installation_enabled, true) = false THEN
    DELETE FROM installation_task_items WHERE task_id IN (SELECT id FROM installation_tasks WHERE contract_id = NEW."Contract_Number");
    DELETE FROM installation_tasks WHERE contract_id = NEW."Contract_Number";
    RETURN NEW;
  END IF;
  IF NEW.billboard_ids IS NULL OR NEW.billboard_ids = '' THEN
    DELETE FROM installation_task_items WHERE task_id IN (SELECT id FROM installation_tasks WHERE contract_id = NEW."Contract_Number");
    DELETE FROM installation_tasks WHERE contract_id = NEW."Contract_Number";
    RETURN NEW;
  END IF;
  SELECT ARRAY_AGG(CAST(TRIM(id) AS bigint)) INTO billboard_id_array FROM unnest(string_to_array(NEW.billboard_ids, ',')) AS id WHERE TRIM(id) ~ '^\d+$';
  SELECT ARRAY_AGG(DISTINCT billboard_id) INTO existing_billboard_ids FROM installation_task_items iti JOIN installation_tasks it ON iti.task_id = it.id WHERE it.contract_id = NEW."Contract_Number";
  is_update := (existing_billboard_ids IS NOT NULL);
  IF is_update THEN
    SELECT ARRAY_AGG(x) INTO new_billboard_ids FROM unnest(billboard_id_array) x WHERE NOT (x = ANY(existing_billboard_ids));
    SELECT ARRAY_AGG(x) INTO removed_billboard_ids FROM unnest(existing_billboard_ids) x WHERE NOT (x = ANY(billboard_id_array));
    IF removed_billboard_ids IS NOT NULL THEN
      DELETE FROM installation_task_items WHERE task_id IN (SELECT id FROM installation_tasks WHERE contract_id = NEW."Contract_Number") AND billboard_id = ANY(removed_billboard_ids);
    END IF;
    IF new_billboard_ids IS NOT NULL THEN
      FOR team_rec IN SELECT t.id, t.team_name, t.sizes, t.cities FROM installation_teams t WHERE array_length(t.sizes, 1) > 0 LOOP
        IF EXISTS (SELECT 1 FROM billboards b WHERE b."ID" = ANY(new_billboard_ids) AND b."Size" = ANY(team_rec.sizes) AND (array_length(team_rec.cities, 1) IS NULL OR array_length(team_rec.cities, 1) = 0 OR b."City" = ANY(team_rec.cities))) THEN
          SELECT id INTO task_id_var FROM installation_tasks WHERE contract_id = NEW."Contract_Number" AND team_id = team_rec.id LIMIT 1;
          IF task_id_var IS NULL THEN INSERT INTO installation_tasks (contract_id, team_id, status) VALUES (NEW."Contract_Number", team_rec.id, 'pending') RETURNING id INTO task_id_var; END IF;
          INSERT INTO installation_task_items (task_id, billboard_id, status, faces_to_install) SELECT task_id_var, b."ID", 'pending', COALESCE(b."Faces_Count", 2) FROM billboards b WHERE b."ID" = ANY(new_billboard_ids) AND b."Size" = ANY(team_rec.sizes) AND (array_length(team_rec.cities, 1) IS NULL OR array_length(team_rec.cities, 1) = 0 OR b."City" = ANY(team_rec.cities)) ON CONFLICT (task_id, billboard_id) DO NOTHING;
        END IF;
      END LOOP;
    END IF;
    DELETE FROM installation_tasks WHERE contract_id = NEW."Contract_Number" AND id NOT IN (SELECT DISTINCT task_id FROM installation_task_items WHERE task_id IN (SELECT id FROM installation_tasks WHERE contract_id = NEW."Contract_Number"));
  ELSE
    FOR team_rec IN SELECT t.id, t.team_name, t.sizes, t.cities FROM installation_teams t WHERE array_length(t.sizes, 1) > 0 LOOP
      IF EXISTS (SELECT 1 FROM billboards b WHERE b."ID" = ANY(billboard_id_array) AND b."Size" = ANY(team_rec.sizes) AND (array_length(team_rec.cities, 1) IS NULL OR array_length(team_rec.cities, 1) = 0 OR b."City" = ANY(team_rec.cities))) THEN
        INSERT INTO installation_tasks (contract_id, team_id, status) VALUES (NEW."Contract_Number", team_rec.id, 'pending') RETURNING id INTO task_id_var;
        INSERT INTO installation_task_items (task_id, billboard_id, status, faces_to_install) SELECT task_id_var, b."ID", 'pending', COALESCE(b."Faces_Count", 2) FROM billboards b WHERE b."ID" = ANY(billboard_id_array) AND b."Size" = ANY(team_rec.sizes) AND (array_length(team_rec.cities, 1) IS NULL OR array_length(team_rec.cities, 1) = 0 OR b."City" = ANY(team_rec.cities));
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

-- دالة التحقق من مدة العقد
CREATE OR REPLACE FUNCTION public.validate_and_set_contract_duration() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE v_days integer; v_months integer; v_computed_duration text;
BEGIN
  IF NEW."Contract Date" IS NULL OR NEW."End Date" IS NULL THEN RETURN NEW; END IF;
  v_days := (NEW."End Date" - NEW."Contract Date");
  IF v_days <= 0 THEN RAISE EXCEPTION 'خطأ في المدة: تاريخ الانتهاء يجب أن يكون بعد تاريخ البداية.'; END IF;
  IF (v_days % 30 = 0) THEN v_months := v_days / 30;
    v_computed_duration := CASE WHEN v_months = 1 THEN 'شهر' WHEN v_months = 2 THEN 'شهرين' WHEN v_months BETWEEN 3 AND 10 THEN v_months::text || ' أشهر' ELSE v_months::text || ' شهر' END;
  ELSE v_computed_duration := v_days::text || ' يوم'; END IF;
  IF NEW."Duration" IS NOT NULL AND btrim(NEW."Duration") <> '' AND NEW."Duration" <> v_computed_duration THEN RAISE EXCEPTION 'خطأ في المدة: القيمة المدخلة (%) لا تطابق فرق التاريخين (%).', NEW."Duration", v_computed_duration; END IF;
  NEW."Duration" := v_computed_duration;
  RETURN NEW;
END;
$$;

-- دالة تسجيل تغييرات العقود
CREATE OR REPLACE FUNCTION public.log_contract_changes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_changes jsonb := '[]'::jsonb;
  v_description text;
  v_added_ids bigint[]; v_removed_ids bigint[]; v_old_ids bigint[]; v_new_ids bigint[];
  v_billboard_names text;
  v_status_labels jsonb := '{"partially_paid":"مدفوع جزئياً","paid":"مدفوع بالكامل","unpaid":"غير مدفوع","overdue":"متأخر"}'::jsonb;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (action, entity_type, entity_id, contract_number, customer_name, ad_type, description, details, user_id)
    VALUES ('create', 'contract', NEW."Contract_Number"::text, NEW."Contract_Number", NEW."Customer Name", NEW."Ad Type", 'إنشاء عقد جديد #' || NEW."Contract_Number" || COALESCE(' - ' || NEW."Customer Name", ''), jsonb_build_object('total', NEW."Total", 'discount', NEW."Discount", 'duration', NEW."Duration"), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.billboard_ids IS DISTINCT FROM NEW.billboard_ids THEN
      IF OLD.billboard_ids IS NOT NULL AND OLD.billboard_ids != '' THEN SELECT ARRAY_AGG(CAST(TRIM(x) AS bigint)) INTO v_old_ids FROM unnest(string_to_array(OLD.billboard_ids, ',')) x WHERE TRIM(x) ~ '^\d+$'; END IF;
      IF NEW.billboard_ids IS NOT NULL AND NEW.billboard_ids != '' THEN SELECT ARRAY_AGG(CAST(TRIM(x) AS bigint)) INTO v_new_ids FROM unnest(string_to_array(NEW.billboard_ids, ',')) x WHERE TRIM(x) ~ '^\d+$'; END IF;
      IF v_new_ids IS NOT NULL THEN IF v_old_ids IS NOT NULL THEN SELECT ARRAY_AGG(x) INTO v_added_ids FROM unnest(v_new_ids) x WHERE NOT (x = ANY(v_old_ids)); ELSE v_added_ids := v_new_ids; END IF; END IF;
      IF v_old_ids IS NOT NULL THEN IF v_new_ids IS NOT NULL THEN SELECT ARRAY_AGG(x) INTO v_removed_ids FROM unnest(v_old_ids) x WHERE NOT (x = ANY(v_new_ids)); ELSE v_removed_ids := v_old_ids; END IF; END IF;
      IF v_added_ids IS NOT NULL AND array_length(v_added_ids, 1) > 0 THEN SELECT string_agg(COALESCE(b."Billboard_Name", 'لوحة ' || b."ID") || COALESCE(' (' || b."Size" || ')', ''), ', ') INTO v_billboard_names FROM billboards b WHERE b."ID" = ANY(v_added_ids); v_changes := v_changes || jsonb_build_object('field', 'billboards_added', 'label', 'إضافة لوحات', 'new', v_billboard_names); END IF;
      IF v_removed_ids IS NOT NULL AND array_length(v_removed_ids, 1) > 0 THEN SELECT string_agg(COALESCE(b."Billboard_Name", 'لوحة ' || b."ID") || COALESCE(' (' || b."Size" || ')', ''), ', ') INTO v_billboard_names FROM billboards b WHERE b."ID" = ANY(v_removed_ids); v_changes := v_changes || jsonb_build_object('field', 'billboards_removed', 'label', 'إزالة لوحات', 'old', v_billboard_names); END IF;
    END IF;
    IF OLD."Total" IS DISTINCT FROM NEW."Total" THEN v_changes := v_changes || jsonb_build_object('field', 'total', 'label', 'الإجمالي', 'old', COALESCE(OLD."Total", 0), 'new', COALESCE(NEW."Total", 0)); END IF;
    IF OLD."Total Rent" IS DISTINCT FROM NEW."Total Rent" THEN v_changes := v_changes || jsonb_build_object('field', 'total_rent', 'label', 'إجمالي الإيجار', 'old', COALESCE(OLD."Total Rent", 0), 'new', COALESCE(NEW."Total Rent", 0)); END IF;
    IF OLD."Discount" IS DISTINCT FROM NEW."Discount" THEN v_changes := v_changes || jsonb_build_object('field', 'discount', 'label', 'الخصم', 'old', COALESCE(OLD."Discount", 0), 'new', COALESCE(NEW."Discount", 0)); END IF;
    IF OLD."Customer Name" IS DISTINCT FROM NEW."Customer Name" THEN v_changes := v_changes || jsonb_build_object('field', 'customer', 'label', 'العميل', 'old', OLD."Customer Name", 'new', NEW."Customer Name"); END IF;
    IF OLD."End Date" IS DISTINCT FROM NEW."End Date" THEN v_changes := v_changes || jsonb_build_object('field', 'end_date', 'label', 'تاريخ الانتهاء', 'old', OLD."End Date", 'new', NEW."End Date"); END IF;
    IF OLD."Contract Date" IS DISTINCT FROM NEW."Contract Date" THEN v_changes := v_changes || jsonb_build_object('field', 'start_date', 'label', 'تاريخ البداية', 'old', OLD."Contract Date", 'new', NEW."Contract Date"); END IF;
    IF OLD.payment_status IS DISTINCT FROM NEW.payment_status THEN v_changes := v_changes || jsonb_build_object('field', 'payment_status', 'label', 'حالة الدفع', 'old', COALESCE(v_status_labels->>OLD.payment_status, OLD.payment_status), 'new', COALESCE(v_status_labels->>NEW.payment_status, NEW.payment_status)); END IF;
    IF OLD."Ad Type" IS DISTINCT FROM NEW."Ad Type" THEN v_changes := v_changes || jsonb_build_object('field', 'ad_type', 'label', 'نوع الإعلان', 'old', OLD."Ad Type", 'new', NEW."Ad Type"); END IF;
    IF OLD.installation_cost IS DISTINCT FROM NEW.installation_cost THEN v_changes := v_changes || jsonb_build_object('field', 'installation_cost', 'label', 'تكلفة التركيب', 'old', COALESCE(OLD.installation_cost, 0), 'new', COALESCE(NEW.installation_cost, 0)); END IF;
    IF OLD.print_cost IS DISTINCT FROM NEW.print_cost THEN v_changes := v_changes || jsonb_build_object('field', 'print_cost', 'label', 'تكلفة الطباعة', 'old', COALESCE(OLD.print_cost, 0), 'new', COALESCE(NEW.print_cost, 0)); END IF;
    IF OLD."Duration" IS DISTINCT FROM NEW."Duration" THEN v_changes := v_changes || jsonb_build_object('field', 'duration', 'label', 'المدة', 'old', OLD."Duration", 'new', NEW."Duration"); END IF;
    IF jsonb_array_length(v_changes) > 0 THEN
      v_description := 'تعديل عقد #' || NEW."Contract_Number" || COALESCE(' - ' || NEW."Customer Name", '') || ' (' || jsonb_array_length(v_changes) || ' تغيير)';
      INSERT INTO activity_log (action, entity_type, entity_id, contract_number, customer_name, ad_type, description, details, user_id)
      VALUES ('update', 'contract', NEW."Contract_Number"::text, NEW."Contract_Number", NEW."Customer Name", NEW."Ad Type", v_description, jsonb_build_object('changes', v_changes), auth.uid());
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO activity_log (action, entity_type, entity_id, contract_number, customer_name, ad_type, description, details, user_id)
    VALUES ('delete', 'contract', OLD."Contract_Number"::text, OLD."Contract_Number", OLD."Customer Name", OLD."Ad Type", 'حذف عقد #' || OLD."Contract_Number" || COALESCE(' - ' || OLD."Customer Name", ''), jsonb_build_object('total', OLD."Total", 'discount', OLD."Discount"), auth.uid());
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

-- دالة مزامنة بيانات العميل مع العقد
CREATE OR REPLACE FUNCTION public.sync_contract_customer_info() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_company TEXT; v_phone TEXT;
BEGIN
  IF NEW.customer_id IS DISTINCT FROM OLD.customer_id AND NEW.customer_id IS NOT NULL THEN
    SELECT company, phone INTO v_company, v_phone FROM customers WHERE id = NEW.customer_id;
    NEW."Company" := v_company; NEW."Phone" := v_phone;
  END IF;
  RETURN NEW;
END;
$$;

-- دالة تحديث بيانات العميل في العقود
CREATE OR REPLACE FUNCTION public.sync_customer_info_to_contracts() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.name IS DISTINCT FROM OLD.name OR NEW.company IS DISTINCT FROM OLD.company OR NEW.phone IS DISTINCT FROM OLD.phone THEN
    UPDATE "Contract" SET "Customer Name" = NEW.name, "Company" = NEW.company, "Phone" = NEW.phone WHERE customer_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

-- دالة مزامنة تكاليف الطباعة مع المهام المجمعة
CREATE OR REPLACE FUNCTION public.sync_print_costs_to_composite() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  UPDATE public.composite_tasks ct SET
    company_print_cost = NEW.total_cost, customer_print_cost = NEW.customer_total_amount,
    company_total = COALESCE(ct.company_installation_cost, 0) + COALESCE(NEW.total_cost, 0) + COALESCE(ct.company_cutout_cost, 0),
    customer_total = COALESCE(ct.customer_installation_cost, 0) + COALESCE(NEW.customer_total_amount, 0) + COALESCE(ct.customer_cutout_cost, 0) - COALESCE(ct.discount_amount, 0),
    net_profit = (COALESCE(ct.customer_installation_cost, 0) + COALESCE(NEW.customer_total_amount, 0) + COALESCE(ct.customer_cutout_cost, 0) - COALESCE(ct.discount_amount, 0)) - (COALESCE(ct.company_installation_cost, 0) + COALESCE(NEW.total_cost, 0) + COALESCE(ct.company_cutout_cost, 0)),
    profit_percentage = CASE WHEN (COALESCE(ct.customer_installation_cost, 0) + COALESCE(NEW.customer_total_amount, 0) + COALESCE(ct.customer_cutout_cost, 0) - COALESCE(ct.discount_amount, 0)) > 0 THEN (((COALESCE(ct.customer_installation_cost, 0) + COALESCE(NEW.customer_total_amount, 0) + COALESCE(ct.customer_cutout_cost, 0) - COALESCE(ct.discount_amount, 0)) - (COALESCE(ct.company_installation_cost, 0) + COALESCE(NEW.total_cost, 0) + COALESCE(ct.company_cutout_cost, 0))) / (COALESCE(ct.customer_installation_cost, 0) + COALESCE(NEW.customer_total_amount, 0) + COALESCE(ct.customer_cutout_cost, 0) - COALESCE(ct.discount_amount, 0))) * 100 ELSE 0 END,
    updated_at = now()
  WHERE ct.print_task_id = NEW.id AND (ct.company_print_cost IS DISTINCT FROM NEW.total_cost OR ct.customer_print_cost IS DISTINCT FROM NEW.customer_total_amount);
  RETURN NEW;
END;
$$;

-- دالة المزامنة العكسية للطباعة
CREATE OR REPLACE FUNCTION public.sync_composite_print_costs_to_print() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
BEGIN
  IF NEW.print_task_id IS NULL THEN RETURN NEW; END IF;
  IF TG_OP = 'UPDATE' THEN IF (OLD.company_print_cost IS NOT DISTINCT FROM NEW.company_print_cost) AND (OLD.customer_print_cost IS NOT DISTINCT FROM NEW.customer_print_cost) THEN RETURN NEW; END IF; END IF;
  UPDATE public.print_tasks p SET total_cost = COALESCE(NEW.company_print_cost, 0), customer_total_amount = COALESCE(NEW.customer_print_cost, 0)
  WHERE p.id = NEW.print_task_id AND (p.total_cost IS DISTINCT FROM COALESCE(NEW.company_print_cost, 0) OR p.customer_total_amount IS DISTINCT FROM COALESCE(NEW.customer_print_cost, 0));
  RETURN NEW;
END;
$$;

-- دالة مزامنة عناصر التركيب مع المهمة المجمعة
CREATE OR REPLACE FUNCTION public.sync_installation_items_to_composite() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE v_composite_id uuid; v_new_total numeric;
BEGIN
  SELECT ct.id INTO v_composite_id FROM composite_tasks ct WHERE ct.installation_task_id = (SELECT task_id FROM installation_task_items WHERE id = COALESCE(NEW.id, OLD.id) LIMIT 1);
  IF v_composite_id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT COALESCE(SUM(
    CASE WHEN COALESCE(iti.reinstall_count, 0) > 0
      THEN COALESCE(iti.customer_original_install_cost, 0) + COALESCE(iti.customer_reinstall_cost, iti.customer_installation_cost, 0)
      ELSE COALESCE(iti.customer_installation_cost, 0)
    END
  ), 0) INTO v_new_total FROM installation_task_items iti JOIN installation_tasks it ON iti.task_id = it.id JOIN composite_tasks ct ON ct.installation_task_id = it.id WHERE ct.id = v_composite_id;
  UPDATE composite_tasks SET customer_installation_cost = v_new_total WHERE id = v_composite_id AND customer_installation_cost IS DISTINCT FROM v_new_total;
  RETURN COALESCE(NEW, OLD);
END;
$$;

-- دالة تأكيد رأس مال الشراكة
CREATE OR REPLACE FUNCTION public.confirm_partnership_capital() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE v_contract_id bigint; v_billboard_id bigint;
BEGIN
  IF NEW.status = 'completed' AND (OLD.status IS NULL OR OLD.status != 'completed') THEN
    SELECT contract_id INTO v_contract_id FROM installation_tasks WHERE id = NEW.task_id;
    v_billboard_id := NEW.billboard_id;
    IF EXISTS (SELECT 1 FROM shared_billboards sb WHERE sb.billboard_id = v_billboard_id AND sb.status = 'active') THEN
      UPDATE shared_billboards SET confirmed_amount = COALESCE(confirmed_amount, 0) + COALESCE(reserved_amount, 0), reserved_amount = 0, capital_remaining = GREATEST(0, capital_remaining - COALESCE(reserved_amount, 0)) WHERE billboard_id = v_billboard_id AND status = 'active';
      UPDATE billboards SET capital_remaining = COALESCE((SELECT SUM(capital_remaining) FROM shared_billboards WHERE billboard_id = v_billboard_id), 0) WHERE "ID" = v_billboard_id;
      INSERT INTO shared_transactions (billboard_id, contract_id, partner_company_id, beneficiary, amount, type, transaction_date, notes) SELECT v_billboard_id, v_contract_id, sb.partner_company_id, COALESCE(p.name, 'الفارس'), sb.reserved_amount * (sb.partner_pre_pct / 100.0), 'capital_deduction', CURRENT_DATE, 'خصم رأس المال عند إكمال التركيب للعقد ' || v_contract_id FROM shared_billboards sb LEFT JOIN partners p ON p.id = sb.partner_company_id WHERE sb.billboard_id = v_billboard_id AND sb.status = 'active';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- دالة حفظ سجل اللوحة عند إكمال التركيب
CREATE OR REPLACE FUNCTION public.save_billboard_history_on_completion() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_billboard RECORD; v_contract RECORD; v_task RECORD; v_team_name TEXT; v_duration_days INTEGER;
BEGIN
  IF NEW.status = 'completed' THEN
    SELECT * INTO v_billboard FROM public.billboards WHERE "ID" = NEW.billboard_id;
    SELECT it.*, itt.team_name INTO v_task FROM public.installation_tasks it LEFT JOIN public.installation_teams itt ON it.team_id = itt.id WHERE it.id = NEW.task_id;
    v_team_name := v_task.team_name;
    SELECT * INTO v_contract FROM public."Contract" WHERE "Contract_Number" = v_task.contract_id;
    IF v_contract."End Date" IS NOT NULL AND v_contract."Contract Date" IS NOT NULL THEN v_duration_days := GREATEST((v_contract."End Date" - v_contract."Contract Date"), 0); ELSE v_duration_days := NULL; END IF;
    INSERT INTO public.billboard_history (billboard_id, contract_number, customer_name, ad_type, start_date, end_date, duration_days, rent_amount, billboard_rent_price, installation_cost, discount_amount, discount_percentage, total_before_discount, installation_date, design_face_a_url, design_face_b_url, installed_image_face_a_url, installed_image_face_b_url, team_name, notes)
    VALUES (NEW.billboard_id, v_contract."Contract_Number", v_contract."Customer Name", v_contract."Ad Type", v_contract."Contract Date", v_contract."End Date", v_duration_days, v_contract."Total Rent", v_billboard."Price", v_contract.installation_cost, COALESCE(v_contract."Discount", 0), CASE WHEN v_contract."Total Rent" IS NOT NULL AND v_contract."Total Rent" > 0 AND v_contract."Discount" IS NOT NULL THEN ROUND((v_contract."Discount" / v_contract."Total Rent") * 100, 2) ELSE NULL END, CASE WHEN v_contract."Total" IS NOT NULL AND v_contract."Discount" IS NOT NULL THEN (v_contract."Total" + v_contract."Discount") WHEN v_contract."Total Rent" IS NOT NULL THEN v_contract."Total Rent" ELSE NULL END, NEW.installation_date, COALESCE(NEW.design_face_a, v_billboard.design_face_a), COALESCE(NEW.design_face_b, v_billboard.design_face_b), NEW.installed_image_face_a_url, NEW.installed_image_face_b_url, v_team_name, NEW.notes);
  END IF;
  RETURN NEW;
END;
$$;

-- دالة حساب تكلفة التركيب تلقائياً
CREATE OR REPLACE FUNCTION public.auto_set_company_installation_cost() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE v_size TEXT; v_base_price NUMERIC;
BEGIN
  IF NEW.company_installation_cost IS NULL OR NEW.company_installation_cost = 0 THEN
    SELECT "Size" INTO v_size FROM billboards WHERE "ID" = NEW.billboard_id;
    IF v_size IS NOT NULL THEN
      SELECT installation_price INTO v_base_price FROM sizes WHERE name = v_size LIMIT 1;
      IF v_base_price IS NULL OR v_base_price = 0 THEN SELECT install_price INTO v_base_price FROM installation_print_pricing WHERE size = v_size LIMIT 1; END IF;
      IF v_base_price IS NOT NULL AND v_base_price > 0 THEN
        IF COALESCE(NEW.total_reinstalled_faces, 0) > 0 THEN NEW.company_installation_cost := v_base_price * (NEW.total_reinstalled_faces * 0.5);
        ELSE NEW.company_installation_cost := v_base_price; END IF;
      END IF;
    END IF;
  END IF;
  IF COALESCE(NEW.reinstall_count, 0) > 0 THEN NEW.customer_reinstall_cost := COALESCE(NEW.customer_installation_cost, 0);
  ELSE NEW.customer_original_install_cost := COALESCE(NEW.customer_installation_cost, 0); NEW.customer_reinstall_cost := 0; END IF;
  RETURN NEW;
END;
$$;

-- دالة حذف مهام التركيب عند حذف العقد
CREATE OR REPLACE FUNCTION public.delete_installation_task_on_contract_delete() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN DELETE FROM installation_tasks WHERE contract_id = OLD."Contract_Number"; RETURN OLD; END; $$;

-- دالة حذف المهمة المجمعة عند حذف مهمة التركيب
CREATE OR REPLACE FUNCTION public.delete_composite_task_on_installation_delete() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$ BEGIN DELETE FROM composite_tasks WHERE installation_task_id = OLD.id; RETURN OLD; END; $$;

-- دالة قفل الفاتورة المدفوعة
CREATE OR REPLACE FUNCTION public.lock_paid_invoice() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$ BEGIN IF NEW.paid = TRUE AND OLD.paid = FALSE THEN NEW.locked = TRUE; END IF; RETURN NEW; END; $$;

-- دالة تسجيل تغييرات فواتير المبيعات
CREATE OR REPLACE FUNCTION public.log_sales_invoice_changes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (action, entity_type, entity_id, customer_name, description, details, user_id) VALUES ('create', 'sales_invoice', NEW.id::text, NEW.customer_name, 'إنشاء فاتورة مبيعات #' || NEW.invoice_number || COALESCE(' - ' || NEW.invoice_name, '') || COALESCE(' - ' || NEW.customer_name, ''), jsonb_build_object('total', NEW.total_amount, 'invoice_name', NEW.invoice_name), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.total_amount IS DISTINCT FROM NEW.total_amount OR OLD.paid IS DISTINCT FROM NEW.paid OR OLD.paid_amount IS DISTINCT FROM NEW.paid_amount THEN
      INSERT INTO activity_log (action, entity_type, entity_id, customer_name, description, details, user_id) VALUES ('update', 'sales_invoice', NEW.id::text, NEW.customer_name, 'تعديل فاتورة مبيعات #' || NEW.invoice_number || COALESCE(' - ' || NEW.invoice_name, ''), jsonb_build_object('total', NEW.total_amount, 'paid', NEW.paid), auth.uid());
    END IF; RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO activity_log (action, entity_type, entity_id, customer_name, description, user_id) VALUES ('delete', 'sales_invoice', OLD.id::text, OLD.customer_name, 'حذف فاتورة مبيعات #' || OLD.invoice_number || COALESCE(' - ' || OLD.customer_name, ''), auth.uid());
    RETURN OLD;
  END IF; RETURN NULL;
END;
$$;

-- دالة تسجيل تغييرات فواتير الطباعة
CREATE OR REPLACE FUNCTION public.log_printed_invoice_changes() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO activity_log (action, entity_type, entity_id, customer_name, description, details, user_id) VALUES ('create', 'printed_invoice', NEW.id::text, NEW.customer_name, 'إنشاء فاتورة طباعة #' || NEW.invoice_number || COALESCE(' - ' || NEW.printer_name, '') || COALESCE(' - ' || NEW.customer_name, ''), jsonb_build_object('total', NEW.total_amount, 'printer', NEW.printer_name), auth.uid());
    RETURN NEW;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.total_amount IS DISTINCT FROM NEW.total_amount OR OLD.paid IS DISTINCT FROM NEW.paid OR OLD.paid_amount IS DISTINCT FROM NEW.paid_amount THEN
      INSERT INTO activity_log (action, entity_type, entity_id, customer_name, description, details, user_id) VALUES ('update', 'printed_invoice', NEW.id::text, NEW.customer_name, 'تعديل فاتورة طباعة #' || NEW.invoice_number || COALESCE(' - ' || NEW.printer_name, ''), jsonb_build_object('total', NEW.total_amount, 'paid', NEW.paid), auth.uid());
    END IF; RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    INSERT INTO activity_log (action, entity_type, entity_id, customer_name, description, user_id) VALUES ('delete', 'printed_invoice', OLD.id::text, OLD.customer_name, 'حذف فاتورة طباعة #' || OLD.invoice_number || COALESCE(' - ' || OLD.customer_name, ''), auth.uid());
    RETURN OLD;
  END IF; RETURN NULL;
END;
$$;

-- دالة حذف دفعات فاتورة المشتريات
CREATE OR REPLACE FUNCTION public.delete_purchase_invoice_payments() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  DELETE FROM customer_payments WHERE entry_type = 'purchase_invoice' AND notes LIKE '%' || OLD.invoice_number || '%';
  DELETE FROM customer_payments WHERE purchase_invoice_id = OLD.id;
  RETURN OLD;
END;
$$;

-- دالة مزامنة رصيد العهدة عند تحديث الدفعة
CREATE OR REPLACE FUNCTION public.sync_custody_balance_on_payment_update() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE v_custody_account RECORD; v_amount_difference NUMERIC;
BEGIN
  IF TG_OP = 'UPDATE' THEN
    IF NEW.distributed_payment_id IS NOT NULL THEN
      SELECT * INTO v_custody_account FROM custody_accounts WHERE source_payment_id = NEW.distributed_payment_id;
      IF v_custody_account IS NOT NULL THEN
        v_amount_difference := COALESCE(NEW.amount, 0) - COALESCE(OLD.amount, 0);
        IF v_amount_difference != 0 THEN
          UPDATE custody_accounts SET initial_amount = initial_amount + v_amount_difference, current_balance = current_balance + v_amount_difference, updated_at = now() WHERE id = v_custody_account.id;
        END IF;
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- دالة حذف السلفة عند حذف الدفعة
CREATE OR REPLACE FUNCTION public.delete_advance_on_payment_delete() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$ BEGIN IF OLD.distributed_payment_id IS NOT NULL THEN DELETE FROM employee_advances WHERE distributed_payment_id = OLD.distributed_payment_id; END IF; RETURN OLD; END; $$;

-- دالة تنظيف اللوحات المنتهية
CREATE OR REPLACE FUNCTION public.cleanup_expired_billboards()
RETURNS TABLE(cleaned_count integer, cleaned_billboard_ids integer[], operation_timestamp timestamptz) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE expired_ids INTEGER[]; cleaned_count_result INTEGER := 0; operation_time TIMESTAMPTZ := NOW();
BEGIN
  SELECT ARRAY_AGG(b."ID") INTO expired_ids FROM billboards b WHERE b."Status" IN ('مؤجر', 'محجوز', 'rented') AND b."Rent_End_Date" IS NOT NULL AND b."Rent_End_Date"::date < CURRENT_DATE AND NOT EXISTS (SELECT 1 FROM "Contract" c WHERE c."End Date" IS NOT NULL AND c."End Date"::date >= CURRENT_DATE AND c.billboard_ids IS NOT NULL AND b."ID" = ANY(string_to_array(c.billboard_ids, ',')::bigint[]));
  IF expired_ids IS NULL OR array_length(expired_ids, 1) IS NULL THEN RETURN QUERY SELECT 0::INTEGER, ARRAY[]::INTEGER[], operation_time; RETURN; END IF;
  UPDATE billboards SET "Status" = 'متاح', "Contract_Number" = NULL, "Customer_Name" = NULL, "Rent_Start_Date" = NULL, "Rent_End_Date" = NULL WHERE "ID" = ANY(expired_ids);
  GET DIAGNOSTICS cleaned_count_result = ROW_COUNT;
  BEGIN INSERT INTO cleanup_logs (cleanup_date, billboards_cleaned, cleanup_type, notes, billboard_ids_cleaned) VALUES (operation_time, cleaned_count_result, 'automatic', 'Automatic cleanup via scheduled function', expired_ids); EXCEPTION WHEN undefined_table THEN NULL; END;
  RETURN QUERY SELECT cleaned_count_result, expired_ids, operation_time;
END;
$$;

-- دالة مزامنة تسلسل العقود
CREATE OR REPLACE FUNCTION public.sync_contract_seq() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public'
AS $$ BEGIN PERFORM setval('"Contract_id_seq"', (SELECT MAX("Contract_Number") FROM "Contract")); RETURN NEW; END; $$;

-- دالة ضبط تسلسل اللوحات
CREATE OR REPLACE FUNCTION public.setval_billboards_seq() RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN PERFORM setval('billboards_id_seq', COALESCE((SELECT MAX("ID") FROM billboards), 0), true); END; $$;

-- دالة فحص صلاحية تعيين الأدمن
CREATE OR REPLACE FUNCTION public.check_admin_role_assignment() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN IF NEW.role = 'admin'::app_role THEN IF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN RAISE EXCEPTION 'Only administrators can assign admin role'; END IF; END IF; RETURN NEW; END; $$;

-- دالة عرض هيكل الجدول
CREATE OR REPLACE FUNCTION public.get_table_schema(p_table_name text)
RETURNS TABLE(column_name text, data_type text, is_nullable text, column_default text, is_primary boolean) LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
BEGIN
  RETURN QUERY SELECT c.column_name::TEXT, c.data_type::TEXT, c.is_nullable::TEXT, c.column_default::TEXT, COALESCE(EXISTS (SELECT 1 FROM information_schema.table_constraints tc JOIN information_schema.key_column_usage kcu ON tc.constraint_name = kcu.constraint_name AND tc.table_schema = kcu.table_schema WHERE tc.constraint_type = 'PRIMARY KEY' AND tc.table_schema = 'public' AND tc.table_name = p_table_name AND kcu.column_name = c.column_name), false) as is_primary FROM information_schema.columns c WHERE c.table_schema = 'public' AND c.table_name = p_table_name ORDER BY c.ordinal_position;
END;
$$;

-- دالة ملخص الشركات المشتركة
CREATE OR REPLACE FUNCTION public.shared_company_summary(p_beneficiary text)
RETURNS TABLE(total_due numeric, total_paid numeric) LANGUAGE sql STABLE SET search_path TO 'public'
AS $$ SELECT coalesce(s.total_due,0)::numeric, coalesce(s.total_paid,0)::numeric FROM public.shared_beneficiary_summary s WHERE s.beneficiary = p_beneficiary $$;

-- دالة حذف اللوحة
CREATE OR REPLACE FUNCTION public.delete_billboard(billboard_id bigint) RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$ BEGIN IF NOT has_role(auth.uid(), 'admin') THEN RAISE EXCEPTION 'Unauthorized: Admin role required'; END IF; DELETE FROM billboards WHERE "ID" = billboard_id; END; $$;

-- دوال تحديث updated_at المتخصصة
CREATE OR REPLACE FUNCTION public.update_billboards_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.update_installation_tasks_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.update_printed_invoices_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.update_printer_payments_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.update_printers_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.update_removal_tasks_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.update_friend_companies_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.update_friend_rentals_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.update_contract_terms_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.update_contract_expenses_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.update_system_settings_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.update_print_settings_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.update_purchase_invoice_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.update_employee_manual_tasks_updated_at() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$ BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.update_contract_payment_status() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$ BEGIN RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.delete_withdrawal_on_payment_delete() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$ BEGIN RETURN OLD; END; $$;
CREATE OR REPLACE FUNCTION public.delete_separate_task_invoices() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$ BEGIN RETURN OLD; END; $$;
CREATE OR REPLACE FUNCTION public.link_invoice_to_composite() RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$ BEGIN RETURN NEW; END; $$;
CREATE OR REPLACE FUNCTION public.create_installation_task_for_contract() RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$ BEGIN RETURN NEW; END; $$;

-- دالة عرض ملخص الجداول
CREATE OR REPLACE FUNCTION public.show_tables_summary()
RETURNS TABLE(table_name text, structure json, sample_data json) LANGUAGE plpgsql SET search_path TO 'public'
AS $$
DECLARE r RECORD;
BEGIN
  FOR r IN SELECT t.table_name AS tbl_name FROM information_schema.tables t WHERE t.table_schema = 'public' AND t.table_type = 'BASE TABLE' LOOP
    RETURN QUERY EXECUTE format($query$ SELECT %L AS table_name, (SELECT json_agg(json_build_object('column', c.column_name, 'type', c.data_type, 'nullable', c.is_nullable, 'default', c.column_default)) FROM information_schema.columns c WHERE c.table_name = %L AND c.table_schema = 'public') AS structure, (SELECT json_agg(row_to_json(t)) FROM (SELECT * FROM %I LIMIT 3) t) AS sample_data $query$, r.tbl_name, r.tbl_name, r.tbl_name);
  END LOOP;
END;
$$;


-- ==================== 7. RLS POLICIES ====================
-- سياسات الوصول الأساسية - السماح للمستخدمين المصادق عليهم

DO $$ 
DECLARE
  tbl text;
  policy_name text;
BEGIN
  FOR tbl IN 
    SELECT table_name FROM information_schema.tables 
    WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
  LOOP
    policy_name := 'authenticated_access_' || tbl;
    BEGIN
      EXECUTE format('CREATE POLICY %I ON public.%I FOR ALL TO authenticated USING (true) WITH CHECK (true)', policy_name, tbl);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;


-- ==================== 8. ALL TRIGGERS ====================

-- Trigger لتحديث updated_at على الجداول الرئيسية
DO $$
DECLARE
  tbl text;
BEGIN
  FOR tbl IN 
    SELECT table_name FROM information_schema.columns 
    WHERE table_schema = 'public' AND column_name = 'updated_at'
    GROUP BY table_name
  LOOP
    BEGIN
      EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION set_updated_at()', tbl);
    EXCEPTION WHEN duplicate_object THEN NULL;
    END;
  END LOOP;
END $$;

-- Trigger حساب أرباح المهام المجمعة
DROP TRIGGER IF EXISTS calculate_composite_profit ON public.composite_tasks;
CREATE TRIGGER calculate_composite_profit BEFORE INSERT OR UPDATE ON public.composite_tasks FOR EACH ROW EXECUTE FUNCTION calculate_composite_task_profit();

-- Trigger تحديث رصيد العهدة
DROP TRIGGER IF EXISTS update_custody_balance ON public.custody_expenses;
CREATE TRIGGER update_custody_balance AFTER INSERT OR UPDATE OR DELETE ON public.custody_expenses FOR EACH ROW EXECUTE FUNCTION update_custody_balance_on_expense();

-- Trigger تحديث آخر دفعة للعميل
DROP TRIGGER IF EXISTS update_last_payment ON public.customer_payments;
CREATE TRIGGER update_last_payment AFTER INSERT ON public.customer_payments FOR EACH ROW EXECUTE FUNCTION update_customer_last_payment();

-- Trigger مزامنة اللوحات من العقد
DROP TRIGGER IF EXISTS trigger_sync_billboards ON public."Contract";
CREATE TRIGGER trigger_sync_billboards AFTER INSERT OR UPDATE ON public."Contract" FOR EACH ROW EXECUTE FUNCTION t_sync_billboards_from_contract();

-- Trigger إنشاء مهام التركيب تلقائياً
DROP TRIGGER IF EXISTS trigger_auto_create_installation_tasks ON public."Contract";
CREATE TRIGGER trigger_auto_create_installation_tasks AFTER INSERT OR UPDATE ON public."Contract" FOR EACH ROW EXECUTE FUNCTION auto_create_installation_tasks();

-- Trigger التحقق من مدة العقد
DROP TRIGGER IF EXISTS trigger_validate_contract_duration ON public."Contract";
CREATE TRIGGER trigger_validate_contract_duration BEFORE INSERT OR UPDATE ON public."Contract" FOR EACH ROW EXECUTE FUNCTION validate_and_set_contract_duration();

-- Trigger تسجيل تغييرات العقود
DROP TRIGGER IF EXISTS trigger_log_contract_changes ON public."Contract";
CREATE TRIGGER trigger_log_contract_changes AFTER INSERT OR UPDATE OR DELETE ON public."Contract" FOR EACH ROW EXECUTE FUNCTION log_contract_changes();

-- Trigger مزامنة بيانات العميل مع العقد
DROP TRIGGER IF EXISTS trigger_sync_contract_customer ON public."Contract";
CREATE TRIGGER trigger_sync_contract_customer BEFORE UPDATE ON public."Contract" FOR EACH ROW EXECUTE FUNCTION sync_contract_customer_info();

-- Trigger تحديث بيانات العميل في العقود
DROP TRIGGER IF EXISTS trigger_sync_customer_to_contracts ON public.customers;
CREATE TRIGGER trigger_sync_customer_to_contracts AFTER UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION sync_customer_info_to_contracts();

-- Trigger مزامنة تكاليف الطباعة مع المهام المجمعة
DROP TRIGGER IF EXISTS trigger_sync_print_to_composite ON public.print_tasks;
CREATE TRIGGER trigger_sync_print_to_composite AFTER UPDATE ON public.print_tasks FOR EACH ROW EXECUTE FUNCTION sync_print_costs_to_composite();

-- Trigger المزامنة العكسية للطباعة
DROP TRIGGER IF EXISTS trigger_sync_composite_to_print ON public.composite_tasks;
CREATE TRIGGER trigger_sync_composite_to_print AFTER INSERT OR UPDATE ON public.composite_tasks FOR EACH ROW EXECUTE FUNCTION sync_composite_print_costs_to_print();

-- Trigger مزامنة عناصر التركيب مع المهمة المجمعة
DROP TRIGGER IF EXISTS trigger_sync_install_items_to_composite ON public.installation_task_items;
CREATE TRIGGER trigger_sync_install_items_to_composite AFTER INSERT OR UPDATE OR DELETE ON public.installation_task_items FOR EACH ROW EXECUTE FUNCTION sync_installation_items_to_composite();

-- Trigger تأكيد رأس مال الشراكة
DROP TRIGGER IF EXISTS trigger_confirm_partnership ON public.installation_task_items;
CREATE TRIGGER trigger_confirm_partnership AFTER UPDATE ON public.installation_task_items FOR EACH ROW EXECUTE FUNCTION confirm_partnership_capital();

-- Trigger حفظ سجل اللوحة عند إكمال التركيب
DROP TRIGGER IF EXISTS trigger_save_history ON public.installation_task_items;
CREATE TRIGGER trigger_save_history AFTER UPDATE ON public.installation_task_items FOR EACH ROW EXECUTE FUNCTION save_billboard_history_on_completion();

-- Trigger حساب تكلفة التركيب تلقائياً
DROP TRIGGER IF EXISTS trigger_auto_install_cost ON public.installation_task_items;
CREATE TRIGGER trigger_auto_install_cost BEFORE INSERT OR UPDATE ON public.installation_task_items FOR EACH ROW EXECUTE FUNCTION auto_set_company_installation_cost();

-- Trigger حذف مهام التركيب عند حذف العقد
DROP TRIGGER IF EXISTS trigger_delete_install_on_contract ON public."Contract";
CREATE TRIGGER trigger_delete_install_on_contract BEFORE DELETE ON public."Contract" FOR EACH ROW EXECUTE FUNCTION delete_installation_task_on_contract_delete();

-- Trigger حذف المهمة المجمعة عند حذف مهمة التركيب
DROP TRIGGER IF EXISTS trigger_delete_composite_on_install ON public.installation_tasks;
CREATE TRIGGER trigger_delete_composite_on_install BEFORE DELETE ON public.installation_tasks FOR EACH ROW EXECUTE FUNCTION delete_composite_task_on_installation_delete();

-- Trigger قفل الفاتورة المدفوعة (فواتير الطباعة)
DROP TRIGGER IF EXISTS trigger_lock_printed_invoice ON public.printed_invoices;
CREATE TRIGGER trigger_lock_printed_invoice BEFORE UPDATE ON public.printed_invoices FOR EACH ROW EXECUTE FUNCTION lock_paid_invoice();

-- Trigger تسجيل تغييرات فواتير المبيعات
DROP TRIGGER IF EXISTS trigger_log_sales_invoice ON public.sales_invoices;
CREATE TRIGGER trigger_log_sales_invoice AFTER INSERT OR UPDATE OR DELETE ON public.sales_invoices FOR EACH ROW EXECUTE FUNCTION log_sales_invoice_changes();

-- Trigger تسجيل تغييرات فواتير الطباعة
DROP TRIGGER IF EXISTS trigger_log_printed_invoice ON public.printed_invoices;
CREATE TRIGGER trigger_log_printed_invoice AFTER INSERT OR UPDATE OR DELETE ON public.printed_invoices FOR EACH ROW EXECUTE FUNCTION log_printed_invoice_changes();

-- Trigger حذف دفعات فاتورة المشتريات
DROP TRIGGER IF EXISTS trigger_delete_purchase_payments ON public.purchase_invoices;
CREATE TRIGGER trigger_delete_purchase_payments BEFORE DELETE ON public.purchase_invoices FOR EACH ROW EXECUTE FUNCTION delete_purchase_invoice_payments();

-- Trigger مزامنة رصيد العهدة عند تحديث الدفعة
DROP TRIGGER IF EXISTS trigger_sync_custody_on_payment ON public.customer_payments;
CREATE TRIGGER trigger_sync_custody_on_payment AFTER UPDATE ON public.customer_payments FOR EACH ROW EXECUTE FUNCTION sync_custody_balance_on_payment_update();

-- Trigger حذف السلفة عند حذف الدفعة
DROP TRIGGER IF EXISTS trigger_delete_advance_on_payment ON public.customer_payments;
CREATE TRIGGER trigger_delete_advance_on_payment AFTER DELETE ON public.customer_payments FOR EACH ROW EXECUTE FUNCTION delete_advance_on_payment_delete();

-- Trigger مزامنة تسلسل العقود
DROP TRIGGER IF EXISTS trigger_sync_contract_seq ON public."Contract";
CREATE TRIGGER trigger_sync_contract_seq AFTER INSERT ON public."Contract" FOR EACH ROW EXECUTE FUNCTION sync_contract_seq();

-- Trigger فحص صلاحية تعيين الأدمن
DROP TRIGGER IF EXISTS trigger_check_admin_role ON public.user_roles;
CREATE TRIGGER trigger_check_admin_role BEFORE INSERT OR UPDATE ON public.user_roles FOR EACH ROW EXECUTE FUNCTION check_admin_role_assignment();


-- ==================== 9. INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_billboards_status ON public.billboards("Status");
CREATE INDEX IF NOT EXISTS idx_billboards_city ON public.billboards("City");
CREATE INDEX IF NOT EXISTS idx_billboards_contract ON public.billboards("Contract_Number");
CREATE INDEX IF NOT EXISTS idx_billboards_size ON public.billboards("Size");
CREATE INDEX IF NOT EXISTS idx_contract_customer ON public."Contract"("Customer Name");
CREATE INDEX IF NOT EXISTS idx_contract_dates ON public."Contract"("Contract Date", "End Date");
CREATE INDEX IF NOT EXISTS idx_contract_customer_id ON public."Contract"(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer ON public.customer_payments(customer_id);
CREATE INDEX IF NOT EXISTS idx_customer_payments_contract ON public.customer_payments(contract_number);
CREATE INDEX IF NOT EXISTS idx_installation_tasks_contract ON public.installation_tasks(contract_id);
CREATE INDEX IF NOT EXISTS idx_installation_task_items_task ON public.installation_task_items(task_id);
CREATE INDEX IF NOT EXISTS idx_installation_task_items_billboard ON public.installation_task_items(billboard_id);
CREATE INDEX IF NOT EXISTS idx_composite_tasks_contract ON public.composite_tasks(contract_id);
CREATE INDEX IF NOT EXISTS idx_composite_tasks_installation ON public.composite_tasks(installation_task_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_entity ON public.activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_log_contract ON public.activity_log(contract_number);
CREATE INDEX IF NOT EXISTS idx_activity_log_created ON public.activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_printed_invoices_customer ON public.printed_invoices(customer_id);
CREATE INDEX IF NOT EXISTS idx_printed_invoices_contract ON public.printed_invoices(contract_number);
CREATE INDEX IF NOT EXISTS idx_expenses_date ON public.expenses(expense_date);
CREATE INDEX IF NOT EXISTS idx_expenses_category ON public.expenses(category_id);
CREATE INDEX IF NOT EXISTS idx_billboard_history_billboard ON public.billboard_history(billboard_id);
CREATE INDEX IF NOT EXISTS idx_billboard_history_contract ON public.billboard_history(contract_number);


-- ==================== DONE ====================
-- تم إنشاء قاعدة البيانات بنجاح مع جميع:
-- ✅ Enums و Sequences
-- ✅ 80+ جدول مع جميع الأعمدة والقيود
-- ✅ جميع Functions (~40+ دالة)
-- ✅ جميع Triggers (~25+ trigger)
-- ✅ RLS Policies
-- ✅ Indexes للأداء
-- يمكنك الآن استخدام النظام
