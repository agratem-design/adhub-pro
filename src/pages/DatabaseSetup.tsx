import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { 
  Database, Play, CheckCircle2, XCircle, Loader2, Copy, 
  ChevronDown, AlertTriangle, Shield, Table2, Zap, Eye,
  Settings, FileCode, Lock
} from "lucide-react";

// =====================================================
// SQL Sections - each section is an independent block
// =====================================================

const SQL_SECTIONS = [
  {
    id: "enums",
    title: "الأنواع المخصصة (Enums)",
    icon: <Settings className="h-5 w-5" />,
    description: "إنشاء أنواع البيانات المخصصة مثل app_role و user_role",
    sql: `DO $$ BEGIN CREATE TYPE public.app_role AS ENUM ('admin', 'user'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE public.user_role AS ENUM ('user', 'admin', 'manager', 'viewer'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`
  },
  {
    id: "sequences",
    title: "التسلسلات (Sequences)",
    icon: <Zap className="h-5 w-5" />,
    description: "إنشاء تسلسلات الأرقام التلقائية للمعرفات",
    sql: `CREATE SEQUENCE IF NOT EXISTS public."Contract_id_seq";
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
CREATE SEQUENCE IF NOT EXISTS public.withdrawals_id_seq;`
  },
  {
    id: "base_tables",
    title: "الجداول الأساسية",
    icon: <Table2 className="h-5 w-5" />,
    description: "جداول بدون مراجع خارجية: roles, user_roles, profiles, customers, sizes, billboard_levels, billboard_faces, billboard_types, friend_companies, partners, billboards, Contract, employees, printers, installation_teams, expense_categories, levels, municipalities, pricing_categories",
    sql: `-- جدول الأدوار
CREATE TABLE IF NOT EXISTS public.roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL UNIQUE, description text, permissions text[] DEFAULT '{}', created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
-- جدول أدوار المستخدمين
CREATE TABLE IF NOT EXISTS public.user_roles (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE, role app_role NOT NULL, UNIQUE(user_id, role));
-- جدول صلاحيات المستخدمين
CREATE TABLE IF NOT EXISTS public.user_permissions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id uuid NOT NULL, permission text NOT NULL, created_at timestamptz DEFAULT now());
-- جدول الملفات الشخصية
CREATE TABLE IF NOT EXISTS public.profiles (id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE, name text, email text, username text, phone text, company text, avatar_url text, approved boolean DEFAULT false, status text DEFAULT 'pending', created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
-- جدول العملاء
CREATE TABLE IF NOT EXISTS public.customers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), name text NOT NULL, phone text, email text, company text, address text, notes text, customer_type text DEFAULT 'individual', tax_number text, commercial_register text, city text, category text, last_payment_date timestamptz, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
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
CREATE TABLE IF NOT EXISTS public."Contract" ("Contract_Number" bigint PRIMARY KEY DEFAULT nextval('"Contract_id_seq"'), id bigint NOT NULL DEFAULT nextval('"Contract_id_seq"'), "Customer Name" text, customer_category text, "Phone" text, "Company" text, "Contract Date" date, "Duration" text, "End Date" date, "Ad Type" text, "Total Rent" double precision, "Discount" double precision, installation_cost bigint, fee text, "Total" numeric, "Print Status" text, "Renewal Status" text, "Total Paid" text, "Payment 1" jsonb, "Payment 2" text, "Payment 3" text, "Remaining" text, customer_id uuid REFERENCES public.customers(id), billboard_id bigint, billboards_data text, billboards_count integer DEFAULT 0, billboard_ids text, billboard_prices text, single_face_billboards text, base_rent numeric DEFAULT 0, print_cost bigint, print_cost_enabled text, print_price_per_meter text, print_cost_details jsonb, operating_fee_rate bigint, operating_fee_rate_installation numeric DEFAULT 3, operating_fee_rate_print numeric DEFAULT 3, include_installation_in_price boolean NOT NULL DEFAULT false, include_print_in_billboard_price boolean NOT NULL DEFAULT false, include_operating_in_installation boolean DEFAULT false, include_operating_in_print boolean DEFAULT false, installation_enabled boolean DEFAULT true, design_data jsonb, level_discounts jsonb, partnership_data jsonb, partnership_operating_data jsonb, partnership_operating_fee_rate numeric DEFAULT 0, friend_rental_data jsonb, friend_rental_includes_installation boolean DEFAULT false, friend_rental_operating_fee_enabled boolean DEFAULT false, friend_rental_operating_fee_rate numeric DEFAULT 3, installment_count integer DEFAULT 2, installment_interval text DEFAULT 'month', installment_auto_calculate boolean DEFAULT true, installment_distribution_type text DEFAULT 'even', installment_first_at_signing boolean DEFAULT true, installment_first_payment_amount numeric DEFAULT 0, installment_first_payment_type text DEFAULT 'amount', installments_data text, payment_status text DEFAULT 'unpaid', billboards_released boolean DEFAULT false, contract_currency text, exchange_rate text, CONSTRAINT "Contract_Contract_Number_key" UNIQUE("Contract_Number"));
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
CREATE TABLE IF NOT EXISTS public.pricing_categories (id bigint PRIMARY KEY DEFAULT nextval('pricing_categories_id_seq'), name text NOT NULL, description text, is_active boolean DEFAULT true, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());`
  },
  {
    id: "linked_tables",
    title: "الجداول المرتبطة",
    icon: <Table2 className="h-5 w-5" />,
    description: "جميع الجداول التي تحتوي مراجع خارجية: billboard_history, customer_payments, installation_tasks, printed_invoices, print_tasks, composite_tasks, expenses, custody_accounts, وأكثر من 60 جدول",
    sql: `-- تاريخ اللوحات
CREATE TABLE IF NOT EXISTS public.billboard_history (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), billboard_id bigint NOT NULL, contract_number bigint, customer_name text, ad_type text, start_date text, end_date text, duration_days integer, rent_amount numeric, billboard_rent_price numeric, discount_amount numeric, discount_percentage numeric, total_before_discount numeric, net_rental_amount numeric, installation_cost numeric, installation_date date, print_cost numeric, design_name text, design_face_a_url text, design_face_b_url text, installed_image_face_a_url text, installed_image_face_b_url text, team_name text, notes text, pricing_mode text, pricing_category text, include_print_in_price boolean, include_installation_in_price boolean, contract_total_rent numeric, contract_total numeric, contract_discount numeric, individual_billboard_data jsonb, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.account_closures (id integer PRIMARY KEY DEFAULT nextval('account_closures_id_seq'), contract_id integer, closure_date date NOT NULL, total_withdrawn numeric DEFAULT 0, remaining_balance numeric DEFAULT 0, notes text, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.base_prices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), size_name text NOT NULL, billboard_level text NOT NULL DEFAULT 'A', one_day numeric DEFAULT 0, one_month numeric DEFAULT 0, two_months numeric DEFAULT 0, three_months numeric DEFAULT 0, six_months numeric DEFAULT 0, full_year numeric DEFAULT 0, created_at timestamptz NOT NULL DEFAULT now(), updated_at timestamptz NOT NULL DEFAULT now(), UNIQUE(size_name, billboard_level));
CREATE TABLE IF NOT EXISTS public.billboard_cost_centers (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), billboard_id bigint NOT NULL REFERENCES public.billboards("ID"), cost_type text NOT NULL, amount numeric DEFAULT 0, vendor_name text, frequency text, period_start text, period_end text, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.billboard_extensions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), billboard_id bigint NOT NULL REFERENCES public.billboards("ID"), contract_number bigint REFERENCES public."Contract"("Contract_Number"), old_end_date text NOT NULL, new_end_date text NOT NULL, extension_days integer NOT NULL, extension_type text DEFAULT 'manual', reason text NOT NULL, notes text, created_by text, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.customer_payments (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid REFERENCES public.customers(id), contract_number bigint, amount numeric NOT NULL, payment_method text DEFAULT 'cash', payment_date date DEFAULT CURRENT_DATE, paid_at timestamptz DEFAULT now(), notes text, entry_type text DEFAULT 'payment', receipt_number text, purchase_invoice_id uuid, distributed_payment_id uuid, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.customer_purchases (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), customer_id uuid REFERENCES public.customers(id), description text NOT NULL, total_price numeric NOT NULL, purchase_date date DEFAULT CURRENT_DATE, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.installation_tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contract_id bigint REFERENCES public."Contract"("Contract_Number"), team_id uuid REFERENCES public.installation_teams(id), status text DEFAULT 'pending', task_type text DEFAULT 'new_installation', print_task_id uuid, cutout_task_id uuid, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), UNIQUE(contract_id, team_id));
CREATE TABLE IF NOT EXISTS public.installation_task_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL REFERENCES public.installation_tasks(id) ON DELETE CASCADE, billboard_id bigint NOT NULL, status text DEFAULT 'pending', installation_date date, notes text, design_face_a text, design_face_b text, installed_image_face_a_url text, installed_image_face_b_url text, selected_design_id uuid, faces_to_install integer DEFAULT 2, company_installation_cost numeric DEFAULT 0, customer_installation_cost numeric DEFAULT 0, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now(), UNIQUE(task_id, billboard_id));
CREATE TABLE IF NOT EXISTS public.installation_team_accounts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), team_id uuid REFERENCES public.installation_teams(id), task_item_id uuid UNIQUE, billboard_id bigint, contract_id bigint, installation_date date, amount numeric DEFAULT 0, status text DEFAULT 'pending', payment_date date, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.printed_invoices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_number text, contract_number bigint, contract_numbers text, customer_id uuid REFERENCES public.customers(id), customer_name text, printer_name text, printer_id uuid REFERENCES public.printers(id), printer_cost numeric DEFAULT 0, invoice_date date DEFAULT CURRENT_DATE, total_amount numeric DEFAULT 0, subtotal numeric DEFAULT 0, discount numeric DEFAULT 0, discount_type text, discount_amount numeric DEFAULT 0, total numeric DEFAULT 0, items jsonb, print_items jsonb, notes text, design_face_a_path text, design_face_b_path text, invoice_type text, currency_code text, currency_symbol text, payment_method text, account_deduction numeric DEFAULT 0, account_payments_deducted numeric DEFAULT 0, include_account_balance boolean DEFAULT false, paid boolean DEFAULT false, paid_amount numeric DEFAULT 0, paid_at timestamptz, locked boolean DEFAULT false, composite_task_id uuid, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.print_tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contract_id bigint, printer_id uuid REFERENCES public.printers(id), invoice_id uuid REFERENCES public.printed_invoices(id), total_cost numeric DEFAULT 0, customer_total_amount numeric DEFAULT 0, is_composite boolean DEFAULT false, status text DEFAULT 'pending', notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.print_task_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL REFERENCES public.print_tasks(id) ON DELETE CASCADE, billboard_id bigint NOT NULL, size text, faces integer DEFAULT 2, area numeric DEFAULT 0, cost_per_meter numeric DEFAULT 0, total_cost numeric DEFAULT 0, customer_cost numeric DEFAULT 0, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.cutout_tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), contract_id bigint, printer_id uuid REFERENCES public.printers(id), invoice_id uuid, total_cost numeric DEFAULT 0, customer_total_amount numeric DEFAULT 0, is_composite boolean DEFAULT false, status text DEFAULT 'pending', notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.cutout_task_items (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), task_id uuid NOT NULL REFERENCES public.cutout_tasks(id) ON DELETE CASCADE, billboard_id bigint NOT NULL, size text, cutout_type text, total_cost numeric DEFAULT 0, customer_cost numeric DEFAULT 0, notes text, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.composite_tasks (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), installation_task_id uuid REFERENCES public.installation_tasks(id), contract_id bigint REFERENCES public."Contract"("Contract_Number"), customer_id uuid REFERENCES public.customers(id), customer_name text, task_type text NOT NULL, status text DEFAULT 'pending', customer_installation_cost numeric DEFAULT 0, company_installation_cost numeric DEFAULT 0, customer_print_cost numeric DEFAULT 0, company_print_cost numeric DEFAULT 0, customer_cutout_cost numeric DEFAULT 0, company_cutout_cost numeric DEFAULT 0, customer_total numeric DEFAULT 0, company_total numeric DEFAULT 0, net_profit numeric DEFAULT 0, profit_percentage numeric DEFAULT 0, discount_amount numeric DEFAULT 0, discount_reason text, print_discount numeric DEFAULT 0, print_discount_reason text, installation_discount numeric DEFAULT 0, installation_discount_reason text, cutout_discount numeric DEFAULT 0, cutout_discount_reason text, paid_amount numeric DEFAULT 0, print_task_id uuid REFERENCES public.print_tasks(id), cutout_task_id uuid REFERENCES public.cutout_tasks(id), combined_invoice_id uuid REFERENCES public.printed_invoices(id), invoice_generated boolean DEFAULT false, invoice_date text, notes text, cost_allocation jsonb, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
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
CREATE TABLE IF NOT EXISTS public.sales_invoices (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), invoice_number text, customer_id uuid REFERENCES public.customers(id), invoice_date date DEFAULT CURRENT_DATE, total_amount numeric DEFAULT 0, items jsonb, notes text, status text DEFAULT 'draft', created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
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
CREATE TABLE IF NOT EXISTS public.print_settings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), setting_key text NOT NULL, primary_color text DEFAULT '#D4AF37', secondary_color text DEFAULT '#1a1a2e', accent_color text DEFAULT '#c0a060', header_bg_color text DEFAULT '#D4AF37', header_text_color text DEFAULT '#ffffff', table_header_bg_color text DEFAULT '#D4AF37', table_header_text_color text DEFAULT '#ffffff', table_border_color text DEFAULT '#e5e5e5', table_row_even_color text DEFAULT '#f8f9fa', table_row_odd_color text DEFAULT '#ffffff', totals_box_bg_color text DEFAULT '#f8f9fa', totals_box_text_color text DEFAULT '#333333', totals_box_border_color text, totals_box_border_radius integer DEFAULT 8, totals_title_font_size integer DEFAULT 14, totals_value_font_size integer DEFAULT 16, font_family text DEFAULT 'Doran', title_font_size integer DEFAULT 18, header_font_size integer DEFAULT 14, body_font_size integer DEFAULT 12, show_logo boolean DEFAULT true, logo_path text DEFAULT '/logofaresgold.svg', logo_size integer DEFAULT 80, show_footer boolean DEFAULT true, footer_text text DEFAULT '', show_page_number boolean DEFAULT true, footer_alignment text DEFAULT 'center', header_alignment text DEFAULT 'split', header_direction text DEFAULT 'row', header_style text DEFAULT 'classic', logo_position_order integer DEFAULT 0, direction text DEFAULT 'rtl', show_company_name boolean DEFAULT true, show_company_subtitle boolean DEFAULT false, show_company_address boolean DEFAULT true, show_company_contact boolean DEFAULT true, company_name text DEFAULT '', company_subtitle text DEFAULT '', company_address text DEFAULT '', company_phone text DEFAULT '', page_margin_top integer DEFAULT 10, page_margin_bottom integer DEFAULT 10, page_margin_left integer DEFAULT 10, page_margin_right integer DEFAULT 10, header_margin_bottom integer DEFAULT 20, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
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
CREATE TABLE IF NOT EXISTS public.site_theme_settings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), setting_key text NOT NULL UNIQUE, setting_value jsonb, created_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.expenses_flags (id bigint PRIMARY KEY DEFAULT nextval('expenses_flags_id_seq'), expense_id uuid, flag_type text, notes text, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.expenses_withdrawals (id bigint PRIMARY KEY DEFAULT nextval('expenses_withdrawals_id_seq'), employee_id uuid, amount numeric NOT NULL, withdrawal_date date DEFAULT CURRENT_DATE, notes text, created_at timestamptz DEFAULT now());
CREATE TABLE IF NOT EXISTS public.period_closures (id bigint PRIMARY KEY DEFAULT nextval('period_closures_id_seq'), period_start date NOT NULL, period_end date NOT NULL, closed_by uuid, notes text, created_at timestamptz DEFAULT now());`
  },
  {
    id: "enable_rls",
    title: "تمكين RLS",
    icon: <Lock className="h-5 w-5" />,
    description: "تمكين أمان مستوى الصف على جميع الجداول",
    sql: `ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY; ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY; ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY; ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY; ALTER TABLE public.customers ENABLE ROW LEVEL SECURITY; ALTER TABLE public.sizes ENABLE ROW LEVEL SECURITY; ALTER TABLE public.billboard_levels ENABLE ROW LEVEL SECURITY; ALTER TABLE public.billboard_faces ENABLE ROW LEVEL SECURITY; ALTER TABLE public.billboard_types ENABLE ROW LEVEL SECURITY; ALTER TABLE public.billboards ENABLE ROW LEVEL SECURITY; ALTER TABLE public."Contract" ENABLE ROW LEVEL SECURITY; ALTER TABLE public.employees ENABLE ROW LEVEL SECURITY; ALTER TABLE public.printers ENABLE ROW LEVEL SECURITY; ALTER TABLE public.installation_teams ENABLE ROW LEVEL SECURITY; ALTER TABLE public.installation_tasks ENABLE ROW LEVEL SECURITY; ALTER TABLE public.installation_task_items ENABLE ROW LEVEL SECURITY; ALTER TABLE public.installation_team_accounts ENABLE ROW LEVEL SECURITY; ALTER TABLE public.printed_invoices ENABLE ROW LEVEL SECURITY; ALTER TABLE public.print_tasks ENABLE ROW LEVEL SECURITY; ALTER TABLE public.print_task_items ENABLE ROW LEVEL SECURITY; ALTER TABLE public.cutout_tasks ENABLE ROW LEVEL SECURITY; ALTER TABLE public.cutout_task_items ENABLE ROW LEVEL SECURITY; ALTER TABLE public.composite_tasks ENABLE ROW LEVEL SECURITY; ALTER TABLE public.customer_payments ENABLE ROW LEVEL SECURITY; ALTER TABLE public.customer_purchases ENABLE ROW LEVEL SECURITY; ALTER TABLE public.contract_expenses ENABLE ROW LEVEL SECURITY; ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY; ALTER TABLE public.expense_categories ENABLE ROW LEVEL SECURITY; ALTER TABLE public.custody_accounts ENABLE ROW LEVEL SECURITY; ALTER TABLE public.custody_expenses ENABLE ROW LEVEL SECURITY; ALTER TABLE public.custody_transactions ENABLE ROW LEVEL SECURITY; ALTER TABLE public.employee_advances ENABLE ROW LEVEL SECURITY; ALTER TABLE public.employee_contracts ENABLE ROW LEVEL SECURITY; ALTER TABLE public.employee_deductions ENABLE ROW LEVEL SECURITY; ALTER TABLE public.employee_manual_tasks ENABLE ROW LEVEL SECURITY; ALTER TABLE public.payroll_runs ENABLE ROW LEVEL SECURITY; ALTER TABLE public.payroll_items ENABLE ROW LEVEL SECURITY; ALTER TABLE public.payments_salary ENABLE ROW LEVEL SECURITY; ALTER TABLE public.friend_companies ENABLE ROW LEVEL SECURITY; ALTER TABLE public.friend_billboard_rentals ENABLE ROW LEVEL SECURITY; ALTER TABLE public.shared_billboards ENABLE ROW LEVEL SECURITY; ALTER TABLE public.shared_transactions ENABLE ROW LEVEL SECURITY; ALTER TABLE public.partnership_contract_shares ENABLE ROW LEVEL SECURITY; ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY; ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY; ALTER TABLE public.sales_invoices ENABLE ROW LEVEL SECURITY; ALTER TABLE public.sales_invoice_payments ENABLE ROW LEVEL SECURITY; ALTER TABLE public.purchase_invoices ENABLE ROW LEVEL SECURITY; ALTER TABLE public.purchase_invoice_items ENABLE ROW LEVEL SECURITY; ALTER TABLE public.purchase_invoice_payments ENABLE ROW LEVEL SECURITY; ALTER TABLE public.printer_payments ENABLE ROW LEVEL SECURITY; ALTER TABLE public.pricing ENABLE ROW LEVEL SECURITY; ALTER TABLE public.pricing_categories ENABLE ROW LEVEL SECURITY; ALTER TABLE public.pricing_durations ENABLE ROW LEVEL SECURITY; ALTER TABLE public.category_factors ENABLE ROW LEVEL SECURITY; ALTER TABLE public.municipality_factors ENABLE ROW LEVEL SECURITY; ALTER TABLE public.municipality_rent_prices ENABLE ROW LEVEL SECURITY; ALTER TABLE public.base_prices ENABLE ROW LEVEL SECURITY; ALTER TABLE public.billboard_cost_centers ENABLE ROW LEVEL SECURITY; ALTER TABLE public.billboard_extensions ENABLE ROW LEVEL SECURITY; ALTER TABLE public.billboard_history ENABLE ROW LEVEL SECURITY; ALTER TABLE public.offers ENABLE ROW LEVEL SECURITY; ALTER TABLE public.booking_requests ENABLE ROW LEVEL SECURITY; ALTER TABLE public.customer_general_discounts ENABLE ROW LEVEL SECURITY; ALTER TABLE public.removal_tasks ENABLE ROW LEVEL SECURITY; ALTER TABLE public.removal_task_items ENABLE ROW LEVEL SECURITY; ALTER TABLE public.distributions ENABLE ROW LEVEL SECURITY; ALTER TABLE public.distribution_items ENABLE ROW LEVEL SECURITY; ALTER TABLE public.reports ENABLE ROW LEVEL SECURITY; ALTER TABLE public.report_items ENABLE ROW LEVEL SECURITY; ALTER TABLE public.cleanup_logs ENABLE ROW LEVEL SECURITY; ALTER TABLE public.print_settings ENABLE ROW LEVEL SECURITY; ALTER TABLE public.billboard_print_settings ENABLE ROW LEVEL SECURITY; ALTER TABLE public.billboard_print_profiles ENABLE ROW LEVEL SECURITY; ALTER TABLE public.contract_template_settings ENABLE ROW LEVEL SECURITY; ALTER TABLE public.contract_terms ENABLE ROW LEVEL SECURITY; ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY; ALTER TABLE public.account_closures ENABLE ROW LEVEL SECURITY; ALTER TABLE public.partners ENABLE ROW LEVEL SECURITY; ALTER TABLE public.municipalities ENABLE ROW LEVEL SECURITY; ALTER TABLE public.levels ENABLE ROW LEVEL SECURITY; ALTER TABLE public.maintenance_history ENABLE ROW LEVEL SECURITY; ALTER TABLE public.print_invoice_payments ENABLE ROW LEVEL SECURITY; ALTER TABLE public.print_reprints ENABLE ROW LEVEL SECURITY; ALTER TABLE public.messaging_settings ENABLE ROW LEVEL SECURITY; ALTER TABLE public.messaging_api_settings ENABLE ROW LEVEL SECURITY; ALTER TABLE public.management_phones ENABLE ROW LEVEL SECURITY; ALTER TABLE public.site_theme_settings ENABLE ROW LEVEL SECURITY; ALTER TABLE public.installation_print_pricing ENABLE ROW LEVEL SECURITY;`
  },
  {
    id: "optimized_indexes",
    title: "فهارس تحسين سرعة الاستعلامات (Indexes)",
    icon: <Zap className="h-5 w-5" />,
    description: "تسريع البحث واسترجاع البيانات في اللوحات والعقود والمدفوعات والمستخدمين",
    sql: `-- فهارس تسريع اللوحات والعقود والمدفوعات
CREATE INDEX IF NOT EXISTS idx_billboards_city_status ON "billboards" ("City", "Status");
CREATE INDEX IF NOT EXISTS idx_billboards_contract_number ON "billboards" ("Contract_Number");
CREATE INDEX IF NOT EXISTS idx_billboards_municipality ON "billboards" ("Municipality");
CREATE INDEX IF NOT EXISTS idx_contract_customer_id ON "Contract" ("customer_id");
CREATE INDEX IF NOT EXISTS idx_contract_number ON "Contract" ("Contract_Number");
CREATE INDEX IF NOT EXISTS idx_contract_end_date ON "Contract" ("End Date");
CREATE INDEX IF NOT EXISTS idx_customer_payments_customer_id ON "customer_payments" ("customer_id");
CREATE INDEX IF NOT EXISTS idx_customer_payments_contract_number ON "customer_payments" ("contract_number");
CREATE INDEX IF NOT EXISTS idx_sales_invoices_customer_id ON "sales_invoices" ("customer_id");
CREATE INDEX IF NOT EXISTS idx_printed_invoices_customer_id ON "printed_invoices" ("customer_id");
CREATE INDEX IF NOT EXISTS idx_composite_tasks_customer_id ON "composite_tasks" ("customer_id");
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON "user_roles" ("user_id");`
  },
  {
    id: "copy_sql",
    title: " نسخ ملف SQL الكامل",
    icon: <FileCode className="h-5 w-5" />,
    description: "انسخ ملف database_commands.sql الكامل (يشمل كل الدوال والتريغرات والسياسات) وشغله في Supabase SQL Editor",
    sql: "COPY_FULL_FILE"
  }
];

type SectionStatus = "idle" | "running" | "success" | "error";

interface SectionState {
  status: SectionStatus;
  error?: string;
}

const DatabaseSetup = () => {
  const [sectionStates, setSectionStates] = useState<Record<string, SectionState>>({});
  const [expandedSection, setExpandedSection] = useState<string | null>(null);
  const [isRunningAll, setIsRunningAll] = useState(false);

  const copyToClipboard = useCallback(async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(`تم نسخ ${label} إلى الحافظة`);
    } catch {
      toast.error("فشل النسخ");
    }
  }, []);

  const copyFullFile = useCallback(async () => {
    try {
      const response = await fetch("/database_commands.sql");
      if (response.ok) {
        const text = await response.text();
        await navigator.clipboard.writeText(text);
        toast.success("تم نسخ ملف SQL الكامل إلى الحافظة");
      } else {
        // Fallback: combine all sections
        const allSql = SQL_SECTIONS.filter(s => s.sql !== "COPY_FULL_FILE").map(s => `-- ${s.title}\n${s.sql}`).join("\n\n");
        await navigator.clipboard.writeText(allSql);
        toast.success("تم نسخ أوامر SQL إلى الحافظة");
      }
    } catch {
      toast.error("فشل النسخ");
    }
  }, []);

  const executeSection = useCallback(async (sectionId: string) => {
    const section = SQL_SECTIONS.find(s => s.id === sectionId);
    if (!section) return;

    if (section.sql === "COPY_FULL_FILE") {
      await copyFullFile();
      return;
    }

    setSectionStates(prev => ({ ...prev, [sectionId]: { status: "running" } }));

    // execute-sql edge function has been removed for security reasons.
    // Copy the SQL and run it manually in the Supabase SQL Editor.
    try {
      await navigator.clipboard.writeText(section.sql);
      setSectionStates(prev => ({
        ...prev,
        [sectionId]: { status: "success" },
      }));
      toast.success(`تم نسخ SQL: ${section.title} - الصقه في Supabase SQL Editor`);
    } catch (err: any) {
      setSectionStates(prev => ({
        ...prev,
        [sectionId]: { status: "error", error: "فشل النسخ" },
      }));
    }
  }, [copyFullFile]);

  const getStatusIcon = (status: SectionStatus) => {
    switch (status) {
      case "running": return <Loader2 className="h-4 w-4 animate-spin text-blue-500" />;
      case "success": return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case "error": return <XCircle className="h-4 w-4 text-red-500" />;
      default: return null;
    }
  };

  const getStatusBadge = (status: SectionStatus) => {
    switch (status) {
      case "running": return <Badge variant="secondary" className="bg-blue-100 text-blue-700">جاري التنفيذ...</Badge>;
      case "success": return <Badge variant="secondary" className="bg-green-100 text-green-700">تم بنجاح</Badge>;
      case "error": return <Badge variant="destructive">فشل</Badge>;
      default: return <Badge variant="outline">جاهز</Badge>;
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6 max-w-4xl" dir="rtl">
      <div className="text-center space-y-2">
        <div className="flex items-center justify-center gap-3">
          <Database className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">إعداد قاعدة البيانات</h1>
        </div>
        <p className="text-muted-foreground">
          إنشاء جميع جداول النظام والدوال والتريغرات وسياسات الأمان من الصفر
        </p>
      </div>

      <Alert className="border-amber-200 bg-amber-50">
        <AlertTriangle className="h-4 w-4 text-amber-600" />
        <AlertDescription className="text-amber-800">
          <strong>تنبيه مهم:</strong> هذه الصفحة لإعداد قاعدة بيانات <strong>جديدة فارغة</strong>.
          يُفضل نسخ الأوامر وتشغيلها في{" "}
          <a
            href={`https://supabase.com/dashboard/project/atqjaiebixuzomrfwilu/sql/new`}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold underline text-amber-900 hover:text-amber-700"
          >
            Supabase SQL Editor
          </a>{" "}
          لضمان التنفيذ الصحيح. شغل كل قسم بالترتيب.
        </AlertDescription>
      </Alert>

      <div className="space-y-3">
        {SQL_SECTIONS.map((section, index) => {
          const state = sectionStates[section.id] || { status: "idle" as SectionStatus };
          const isExpanded = expandedSection === section.id;

          return (
            <Card key={section.id} className="overflow-hidden">
              <CardHeader className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <span className="text-sm font-mono bg-muted rounded-full w-6 h-6 flex items-center justify-center">
                        {index + 1}
                      </span>
                      {section.icon}
                    </div>
                    <div className="flex-1">
                      <CardTitle className="text-base">{section.title}</CardTitle>
                      <CardDescription className="text-xs mt-1 line-clamp-1">{section.description}</CardDescription>
                    </div>
                    {getStatusIcon(state.status)}
                    {getStatusBadge(state.status)}
                  </div>
                  <div className="flex items-center gap-2">
                    {section.sql !== "COPY_FULL_FILE" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyToClipboard(section.sql, section.title)}
                      >
                        <Copy className="h-3.5 w-3.5 ml-1" />
                        نسخ
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => executeSection(section.id)}
                      disabled={state.status === "running"}
                      variant={section.sql === "COPY_FULL_FILE" ? "secondary" : "default"}
                    >
                      {state.status === "running" ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin ml-1" />
                      ) : section.sql === "COPY_FULL_FILE" ? (
                        <Copy className="h-3.5 w-3.5 ml-1" />
                      ) : (
                        <Play className="h-3.5 w-3.5 ml-1" />
                      )}
                      {section.sql === "COPY_FULL_FILE" ? "نسخ الكل" : "تنفيذ"}
                    </Button>
                    {section.sql !== "COPY_FULL_FILE" && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setExpandedSection(isExpanded ? null : section.id)}
                      >
                        <Eye className="h-3.5 w-3.5 ml-1" />
                        <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                      </Button>
                    )}
                  </div>
                </div>

                {state.status === "error" && state.error && (
                  <Alert variant="destructive" className="mt-3">
                    <AlertDescription className="text-xs whitespace-pre-wrap">{state.error}</AlertDescription>
                  </Alert>
                )}
              </CardHeader>

              {isExpanded && section.sql !== "COPY_FULL_FILE" && (
                <CardContent className="p-0 border-t">
                  <ScrollArea className="h-64">
                    <pre className="p-4 text-xs font-mono bg-muted/50 text-foreground whitespace-pre-wrap" dir="ltr">
                      {section.sql}
                    </pre>
                  </ScrollArea>
                </CardContent>
              )}
            </Card>
          );
        })}
      </div>

      <Card className="bg-muted/50 border-dashed">
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            <Shield className="h-5 w-5 text-primary mt-0.5" />
            <div className="text-sm text-muted-foreground space-y-1">
              <p><strong>للاستعادة الكاملة:</strong></p>
              <ol className="list-decimal list-inside space-y-1 mr-2">
                <li>أنشئ مشروع Supabase جديد</li>
                <li>انسخ ملف SQL الكامل (الزر الأخير)</li>
                <li>شغله في SQL Editor على أجزاء بالترتيب</li>
                <li>أعد إدخال البيانات من النسخة الاحتياطية</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default DatabaseSetup;
