import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { toast } from "sonner";
import {
  Database, Play, CheckCircle2, XCircle, Loader2, Copy,
  Download, Trash2, AlertTriangle, Cloud, Monitor, Server,
  RefreshCw, FileCode, Eye, EyeOff
} from "lucide-react";

// ========== MySQL Schema Generator ==========
// Converts PostgreSQL types/syntax to MySQL equivalents

const PG_TO_MYSQL_TYPES: Record<string, string> = {
  'uuid': 'CHAR(36)',
  'text': 'TEXT',
  'bigint': 'BIGINT',
  'integer': 'INT',
  'numeric': 'DECIMAL(15,2)',
  'double precision': 'DOUBLE',
  'boolean': 'TINYINT(1)',
  'date': 'DATE',
  'timestamptz': 'DATETIME',
  'timestamp with time zone': 'DATETIME',
  'jsonb': 'JSON',
  'json': 'JSON',
  'text[]': 'JSON',
  'bigint[]': 'JSON',
  'integer[]': 'JSON',
};

function generateMySQLSchema(): string {
  const lines: string[] = [];
  lines.push('-- =====================================================');
  lines.push('-- MySQL Database Schema - Auto-generated from PostgreSQL');
  lines.push(`-- Generated: ${new Date().toISOString()}`);
  lines.push('-- =====================================================');
  lines.push('');
  lines.push('SET FOREIGN_KEY_CHECKS = 0;');
  lines.push('SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";');
  lines.push('SET NAMES utf8mb4;');
  lines.push('SET CHARACTER SET utf8mb4;');
  lines.push('');

  // Core tables
  const tables = getMySQLTables();
  for (const table of tables) {
    lines.push(table);
    lines.push('');
  }

  lines.push('SET FOREIGN_KEY_CHECKS = 1;');
  return lines.join('\n');
}

function getMySQLTables(): string[] {
  return [
    // Roles & Auth
    `CREATE TABLE IF NOT EXISTS roles (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL UNIQUE,
  description TEXT,
  permissions JSON DEFAULT ('[]'),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS user_roles (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  role ENUM('admin','user') NOT NULL,
  UNIQUE KEY unique_user_role (user_id, role)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS user_permissions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  user_id CHAR(36) NOT NULL,
  permission VARCHAR(255) NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS profiles (
  id CHAR(36) PRIMARY KEY,
  name VARCHAR(255),
  email VARCHAR(255),
  username VARCHAR(255),
  phone VARCHAR(50),
  company VARCHAR(255),
  avatar_url TEXT,
  approved TINYINT(1) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Customers
    `CREATE TABLE IF NOT EXISTS customers (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  company VARCHAR(255),
  address TEXT,
  notes TEXT,
  customer_type VARCHAR(50) DEFAULT 'individual',
  tax_number VARCHAR(100),
  commercial_register VARCHAR(100),
  city VARCHAR(100),
  category VARCHAR(100),
  is_customer TINYINT(1) DEFAULT 1,
  is_supplier TINYINT(1) DEFAULT 0,
  supplier_type VARCHAR(50),
  last_payment_date DATETIME,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Sizes
    `CREATE TABLE IF NOT EXISTS sizes (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL UNIQUE,
  width DECIMAL(15,2),
  height DECIMAL(15,2),
  area DECIMAL(15,2),
  installation_price BIGINT DEFAULT 0,
  print_price_per_meter DECIMAL(15,2) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Billboard levels
    `CREATE TABLE IF NOT EXISTS billboard_levels (
  id INT AUTO_INCREMENT PRIMARY KEY,
  level_code VARCHAR(10) NOT NULL UNIQUE,
  level_name VARCHAR(100) NOT NULL,
  description TEXT,
  sort_order INT NOT NULL UNIQUE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Billboard faces
    `CREATE TABLE IF NOT EXISTS billboard_faces (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  face_count INT NOT NULL DEFAULT 2,
  count INT,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_face_count (face_count)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Billboard types
    `CREATE TABLE IF NOT EXISTS billboard_types (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  color VARCHAR(50),
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Friend companies
    `CREATE TABLE IF NOT EXISTS friend_companies (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  contact_person VARCHAR(255),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Partners
    `CREATE TABLE IF NOT EXISTS partners (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  company VARCHAR(255),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Billboards
    `CREATE TABLE IF NOT EXISTS billboards (
  ID BIGINT AUTO_INCREMENT PRIMARY KEY,
  Billboard_Name VARCHAR(255),
  City VARCHAR(100),
  District VARCHAR(100),
  Municipality VARCHAR(100),
  Nearest_Landmark TEXT,
  GPS_Coordinates VARCHAR(255),
  GPS_Link TEXT,
  Size VARCHAR(100),
  size_id INT,
  Level VARCHAR(10),
  Category_Level VARCHAR(50),
  Faces_Count INT,
  Ad_Type VARCHAR(100),
  Status VARCHAR(50) DEFAULT 'متاح',
  Customer_Name VARCHAR(255),
  Contract_Number BIGINT,
  Rent_Start_Date VARCHAR(50),
  Rent_End_Date VARCHAR(50),
  Price DECIMAL(15,2),
  Days_Count VARCHAR(50),
  Order_Size VARCHAR(100),
  Image_URL TEXT,
  image_name VARCHAR(255),
  Review TEXT,
  billboard_type VARCHAR(100),
  design_face_a TEXT,
  design_face_b TEXT,
  has_cutout TINYINT(1) DEFAULT 0,
  is_partnership TINYINT(1) DEFAULT 0,
  partner_companies JSON,
  friend_company_id CHAR(36),
  capital DECIMAL(15,2),
  capital_remaining DECIMAL(15,2),
  maintenance_status VARCHAR(50),
  maintenance_type VARCHAR(100),
  maintenance_date VARCHAR(50),
  maintenance_notes TEXT,
  maintenance_cost DECIMAL(15,2),
  maintenance_priority VARCHAR(50),
  next_maintenance_date VARCHAR(50),
  needs_rephotography TINYINT(1) DEFAULT 0,
  is_visible_in_available TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (friend_company_id) REFERENCES friend_companies(id),
  FOREIGN KEY (size_id) REFERENCES sizes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Contracts
    `CREATE TABLE IF NOT EXISTS contracts (
  Contract_Number BIGINT AUTO_INCREMENT PRIMARY KEY,
  id BIGINT,
  Customer_Name VARCHAR(255),
  customer_category VARCHAR(100),
  Phone VARCHAR(50),
  Company VARCHAR(255),
  Contract_Date DATE,
  Duration VARCHAR(100),
  End_Date DATE,
  Ad_Type VARCHAR(100),
  Total_Rent DOUBLE,
  Discount DOUBLE,
  installation_cost BIGINT,
  fee VARCHAR(50),
  Total DECIMAL(15,2),
  Print_Status VARCHAR(50),
  Renewal_Status VARCHAR(50),
  Total_Paid VARCHAR(50),
  Payment_1 JSON,
  Payment_2 TEXT,
  Payment_3 TEXT,
  Remaining VARCHAR(50),
  customer_id CHAR(36),
  billboard_id BIGINT,
  billboards_data TEXT,
  billboards_count INT DEFAULT 0,
  billboard_ids TEXT,
  billboard_prices TEXT,
  single_face_billboards TEXT,
  base_rent DECIMAL(15,2) DEFAULT 0,
  print_cost BIGINT,
  print_cost_enabled VARCHAR(10),
  print_price_per_meter VARCHAR(50),
  print_cost_details JSON,
  operating_fee_rate BIGINT,
  operating_fee_rate_installation DECIMAL(15,2) DEFAULT 3,
  operating_fee_rate_print DECIMAL(15,2) DEFAULT 3,
  include_installation_in_price TINYINT(1) NOT NULL DEFAULT 0,
  include_print_in_billboard_price TINYINT(1) NOT NULL DEFAULT 0,
  include_operating_in_installation TINYINT(1) DEFAULT 0,
  include_operating_in_print TINYINT(1) DEFAULT 0,
  installation_enabled TINYINT(1) DEFAULT 1,
  design_data JSON,
  level_discounts JSON,
  partnership_data JSON,
  partnership_operating_data JSON,
  partnership_operating_fee_rate DECIMAL(15,2) DEFAULT 0,
  friend_rental_data JSON,
  friend_rental_includes_installation TINYINT(1) DEFAULT 0,
  friend_rental_operating_fee_enabled TINYINT(1) DEFAULT 0,
  friend_rental_operating_fee_rate DECIMAL(15,2) DEFAULT 3,
  installment_count INT DEFAULT 2,
  installment_interval VARCHAR(50) DEFAULT 'month',
  installment_auto_calculate TINYINT(1) DEFAULT 1,
  installment_distribution_type VARCHAR(50) DEFAULT 'even',
  installment_first_at_signing TINYINT(1) DEFAULT 1,
  installment_first_payment_amount DECIMAL(15,2) DEFAULT 0,
  installment_first_payment_type VARCHAR(50) DEFAULT 'amount',
  installments_data TEXT,
  payment_status VARCHAR(50) DEFAULT 'unpaid',
  billboards_released TINYINT(1) DEFAULT 0,
  contract_currency VARCHAR(10),
  exchange_rate VARCHAR(50),
  previous_contract_number BIGINT,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Employees
    `CREATE TABLE IF NOT EXISTS employees (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  position VARCHAR(100),
  department VARCHAR(100),
  hire_date DATE,
  basic_salary DECIMAL(15,2) DEFAULT 0,
  allowances DECIMAL(15,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  notes TEXT,
  nationality VARCHAR(100),
  id_number VARCHAR(50),
  bank_name VARCHAR(100),
  bank_account VARCHAR(100),
  contract_type VARCHAR(50) DEFAULT 'full_time',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Printers
    `CREATE TABLE IF NOT EXISTS printers (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  phone VARCHAR(50),
  email VARCHAR(255),
  address TEXT,
  contact_person VARCHAR(255),
  notes TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Installation teams
    `CREATE TABLE IF NOT EXISTS installation_teams (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  team_name VARCHAR(255) NOT NULL,
  sizes JSON NOT NULL,
  cities JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Expense categories
    `CREATE TABLE IF NOT EXISTS expense_categories (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  color VARCHAR(50),
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Customer payments
    `CREATE TABLE IF NOT EXISTS customer_payments (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  customer_id CHAR(36),
  contract_number BIGINT,
  amount DECIMAL(15,2) NOT NULL,
  payment_method VARCHAR(50) DEFAULT 'cash',
  payment_date DATE DEFAULT (CURRENT_DATE),
  paid_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  notes TEXT,
  entry_type VARCHAR(50) DEFAULT 'payment',
  receipt_number VARCHAR(100),
  purchase_invoice_id CHAR(36),
  distributed_payment_id CHAR(36),
  intermediary_commission DECIMAL(15,2) DEFAULT 0,
  transfer_fee DECIMAL(15,2) DEFAULT 0,
  net_amount DECIMAL(15,2) DEFAULT 0,
  commission_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Installation tasks
    `CREATE TABLE IF NOT EXISTS installation_tasks (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  contract_id BIGINT,
  team_id CHAR(36),
  status VARCHAR(50) DEFAULT 'pending',
  task_type VARCHAR(50) DEFAULT 'new_installation',
  print_task_id CHAR(36),
  cutout_task_id CHAR(36),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_contract_team (contract_id, team_id),
  FOREIGN KEY (contract_id) REFERENCES contracts(Contract_Number),
  FOREIGN KEY (team_id) REFERENCES installation_teams(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Installation task items
    `CREATE TABLE IF NOT EXISTS installation_task_items (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  task_id CHAR(36) NOT NULL,
  billboard_id BIGINT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  installation_date DATE,
  notes TEXT,
  design_face_a TEXT,
  design_face_b TEXT,
  installed_image_face_a_url TEXT,
  installed_image_face_b_url TEXT,
  selected_design_id CHAR(36),
  faces_to_install INT DEFAULT 2,
  company_installation_cost DECIMAL(15,2) DEFAULT 0,
  customer_installation_cost DECIMAL(15,2) DEFAULT 0,
  company_additional_cost DECIMAL(15,2) DEFAULT 0,
  company_additional_cost_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_task_billboard (task_id, billboard_id),
  FOREIGN KEY (task_id) REFERENCES installation_tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Printed invoices
    `CREATE TABLE IF NOT EXISTS printed_invoices (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  invoice_number VARCHAR(100),
  contract_number BIGINT,
  contract_numbers TEXT,
  customer_id CHAR(36),
  customer_name VARCHAR(255),
  printer_name VARCHAR(255),
  printer_id CHAR(36),
  printer_cost DECIMAL(15,2) DEFAULT 0,
  invoice_date DATE DEFAULT (CURRENT_DATE),
  total_amount DECIMAL(15,2) DEFAULT 0,
  subtotal DECIMAL(15,2) DEFAULT 0,
  discount DECIMAL(15,2) DEFAULT 0,
  discount_type VARCHAR(50),
  discount_amount DECIMAL(15,2) DEFAULT 0,
  total DECIMAL(15,2) DEFAULT 0,
  items JSON,
  print_items JSON,
  notes TEXT,
  invoice_type VARCHAR(50),
  currency_code VARCHAR(10),
  currency_symbol VARCHAR(10),
  payment_method VARCHAR(50),
  paid TINYINT(1) DEFAULT 0,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  paid_at DATETIME,
  locked TINYINT(1) DEFAULT 0,
  composite_task_id CHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id),
  FOREIGN KEY (printer_id) REFERENCES printers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Composite tasks
    `CREATE TABLE IF NOT EXISTS composite_tasks (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  task_number BIGINT AUTO_INCREMENT UNIQUE,
  installation_task_id CHAR(36),
  contract_id BIGINT,
  customer_id CHAR(36),
  customer_name VARCHAR(255),
  task_type VARCHAR(100) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  customer_installation_cost DECIMAL(15,2) DEFAULT 0,
  company_installation_cost DECIMAL(15,2) DEFAULT 0,
  customer_print_cost DECIMAL(15,2) DEFAULT 0,
  company_print_cost DECIMAL(15,2) DEFAULT 0,
  customer_cutout_cost DECIMAL(15,2) DEFAULT 0,
  company_cutout_cost DECIMAL(15,2) DEFAULT 0,
  customer_total DECIMAL(15,2) DEFAULT 0,
  company_total DECIMAL(15,2) DEFAULT 0,
  net_profit DECIMAL(15,2) DEFAULT 0,
  profit_percentage DECIMAL(15,2) DEFAULT 0,
  discount_amount DECIMAL(15,2) DEFAULT 0,
  discount_reason TEXT,
  print_discount DECIMAL(15,2) DEFAULT 0,
  print_discount_reason TEXT,
  installation_discount DECIMAL(15,2) DEFAULT 0,
  installation_discount_reason TEXT,
  cutout_discount DECIMAL(15,2) DEFAULT 0,
  cutout_discount_reason TEXT,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  print_task_id CHAR(36),
  cutout_task_id CHAR(36),
  combined_invoice_id CHAR(36),
  invoice_generated TINYINT(1) DEFAULT 0,
  invoice_date VARCHAR(50),
  notes TEXT,
  cost_allocation JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (installation_task_id) REFERENCES installation_tasks(id),
  FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Expenses
    `CREATE TABLE IF NOT EXISTS expenses (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  title VARCHAR(255) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  expense_date DATE DEFAULT (CURRENT_DATE),
  category_id BIGINT,
  description TEXT,
  payment_method VARCHAR(50) DEFAULT 'cash',
  receipt_number VARCHAR(100),
  vendor VARCHAR(255),
  employee_id CHAR(36),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES expense_categories(id),
  FOREIGN KEY (employee_id) REFERENCES employees(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Billboard history
    `CREATE TABLE IF NOT EXISTS billboard_history (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  billboard_id BIGINT NOT NULL,
  contract_number BIGINT,
  customer_name VARCHAR(255),
  ad_type VARCHAR(100),
  start_date VARCHAR(50),
  end_date VARCHAR(50),
  duration_days INT,
  rent_amount DECIMAL(15,2),
  billboard_rent_price DECIMAL(15,2),
  discount_amount DECIMAL(15,2),
  installation_cost DECIMAL(15,2),
  installation_date DATE,
  design_face_a_url TEXT,
  design_face_b_url TEXT,
  installed_image_face_a_url TEXT,
  installed_image_face_b_url TEXT,
  team_name VARCHAR(255),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // System settings
    `CREATE TABLE IF NOT EXISTS system_settings (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  setting_key VARCHAR(255) NOT NULL UNIQUE,
  setting_value JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Activity log
    `CREATE TABLE IF NOT EXISTS activity_log (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  action VARCHAR(100) NOT NULL,
  entity_type VARCHAR(100) NOT NULL,
  entity_id VARCHAR(255),
  contract_number BIGINT,
  customer_name VARCHAR(255),
  ad_type VARCHAR(100),
  description TEXT NOT NULL,
  details JSON,
  user_id CHAR(36),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Custody accounts
    `CREATE TABLE IF NOT EXISTS custody_accounts (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  account_number VARCHAR(100) NOT NULL,
  custody_name VARCHAR(255),
  employee_id CHAR(36) NOT NULL,
  initial_amount DECIMAL(15,2) DEFAULT 0,
  current_balance DECIMAL(15,2) DEFAULT 0,
  assigned_date DATE DEFAULT (CURRENT_DATE),
  closed_date DATE,
  status VARCHAR(50) DEFAULT 'active',
  source_type VARCHAR(50),
  source_payment_id CHAR(36),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Custody expenses
    `CREATE TABLE IF NOT EXISTS custody_expenses (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  custody_account_id CHAR(36) NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  expense_category VARCHAR(100) NOT NULL,
  expense_date DATE DEFAULT (CURRENT_DATE),
  vendor_name VARCHAR(255),
  receipt_number VARCHAR(100),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (custody_account_id) REFERENCES custody_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Print settings
    `CREATE TABLE IF NOT EXISTS print_settings (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  setting_key VARCHAR(255) NOT NULL,
  primary_color VARCHAR(50) DEFAULT '#D4AF37',
  secondary_color VARCHAR(50) DEFAULT '#1a1a2e',
  font_family VARCHAR(100) DEFAULT 'Doran',
  show_logo TINYINT(1) DEFAULT 1,
  logo_path VARCHAR(255) DEFAULT '/logofaresgold.svg',
  logo_size INT DEFAULT 80,
  direction VARCHAR(10) DEFAULT 'rtl',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Site theme settings
    `CREATE TABLE IF NOT EXISTS site_theme_settings (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  setting_key VARCHAR(255) NOT NULL UNIQUE,
  setting_value JSON,
  logo_url TEXT,
  favicon_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Shared billboards
    `CREATE TABLE IF NOT EXISTS shared_billboards (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  billboard_id BIGINT NOT NULL,
  partner_company_id CHAR(36),
  capital_contribution DECIMAL(15,2) DEFAULT 0,
  capital_remaining DECIMAL(15,2) DEFAULT 0,
  reserved_amount DECIMAL(15,2) DEFAULT 0,
  confirmed_amount DECIMAL(15,2) DEFAULT 0,
  partner_pre_pct DECIMAL(15,2) DEFAULT 0,
  partner_post_pct DECIMAL(15,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'active',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (partner_company_id) REFERENCES partners(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Offers
    `CREATE TABLE IF NOT EXISTS offers (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  offer_number BIGINT AUTO_INCREMENT UNIQUE,
  customer_id CHAR(36),
  customer_name VARCHAR(255),
  offer_date DATE DEFAULT (CURRENT_DATE),
  valid_until DATE,
  status VARCHAR(50) DEFAULT 'draft',
  items JSON,
  total_amount DECIMAL(15,2) DEFAULT 0,
  discount DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Printer payments
    `CREATE TABLE IF NOT EXISTS printer_payments (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  printer_id CHAR(36),
  amount DECIMAL(15,2) NOT NULL,
  payment_date DATE DEFAULT (CURRENT_DATE),
  payment_method VARCHAR(50) DEFAULT 'cash',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (printer_id) REFERENCES printers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Payroll
    `CREATE TABLE IF NOT EXISTS payroll_runs (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  status VARCHAR(50) DEFAULT 'draft',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS payroll_items (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  payroll_id CHAR(36) NOT NULL,
  employee_id CHAR(36) NOT NULL,
  basic_salary DECIMAL(15,2) DEFAULT 0,
  allowances DECIMAL(15,2) DEFAULT 0,
  overtime_amount DECIMAL(15,2) DEFAULT 0,
  deductions DECIMAL(15,2) DEFAULT 0,
  advances_deduction DECIMAL(15,2) DEFAULT 0,
  tax DECIMAL(15,2) DEFAULT 0,
  social_security DECIMAL(15,2) DEFAULT 0,
  net_salary DECIMAL(15,2) DEFAULT 0,
  paid TINYINT(1) DEFAULT 0,
  payment_date DATE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (payroll_id) REFERENCES payroll_runs(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Contract expenses
    `CREATE TABLE IF NOT EXISTS contract_expenses (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  contract_number BIGINT NOT NULL,
  expense_type VARCHAR(100) NOT NULL,
  reason TEXT NOT NULL,
  amount DECIMAL(15,2) DEFAULT 0,
  unit_price DECIMAL(15,2) DEFAULT 0,
  quantity INT DEFAULT 1,
  item_name VARCHAR(255),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (contract_number) REFERENCES contracts(Contract_Number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Municipalities
    `CREATE TABLE IF NOT EXISTS municipalities (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  city VARCHAR(100),
  region VARCHAR(100),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Cleanup logs
    `CREATE TABLE IF NOT EXISTS cleanup_logs (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  cleanup_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  billboards_cleaned INT DEFAULT 0,
  cleanup_type VARCHAR(50) DEFAULT 'manual',
  notes TEXT,
  billboard_ids_cleaned JSON,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Missing tables - Pricing
    `CREATE TABLE IF NOT EXISTS pricing_categories (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS pricing_durations (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  days INT NOT NULL,
  sort_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS pricing (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  size_id BIGINT,
  category_id BIGINT,
  duration_id BIGINT,
  price DECIMAL(15,2) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (size_id) REFERENCES sizes(id),
  FOREIGN KEY (category_id) REFERENCES pricing_categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS base_prices (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  size_name VARCHAR(255) NOT NULL,
  billboard_level VARCHAR(10) NOT NULL DEFAULT 'A',
  one_day DECIMAL(15,2) DEFAULT 0,
  one_month DECIMAL(15,2) DEFAULT 0,
  two_months DECIMAL(15,2) DEFAULT 0,
  three_months DECIMAL(15,2) DEFAULT 0,
  six_months DECIMAL(15,2) DEFAULT 0,
  full_year DECIMAL(15,2) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_size_level (size_name, billboard_level)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS category_factors (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  category_name VARCHAR(255) NOT NULL,
  factor DECIMAL(15,2) DEFAULT 1,
  description TEXT,
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS municipality_factors (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  municipality_name VARCHAR(255) NOT NULL,
  factor DECIMAL(15,2) DEFAULT 1,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS municipality_rent_prices (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  municipality_id CHAR(36),
  size_id BIGINT,
  price DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (municipality_id) REFERENCES municipalities(id),
  FOREIGN KEY (size_id) REFERENCES sizes(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS installation_print_pricing (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  size VARCHAR(255) NOT NULL,
  install_price DECIMAL(15,2) DEFAULT 0,
  print_price DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Billboard cost centers & extensions
    `CREATE TABLE IF NOT EXISTS billboard_cost_centers (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  billboard_id BIGINT NOT NULL,
  cost_type VARCHAR(100) NOT NULL,
  amount DECIMAL(15,2) DEFAULT 0,
  vendor_name VARCHAR(255),
  frequency VARCHAR(50),
  period_start VARCHAR(50),
  period_end VARCHAR(50),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (billboard_id) REFERENCES billboards(ID)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS billboard_extensions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  billboard_id BIGINT NOT NULL,
  contract_number BIGINT,
  old_end_date VARCHAR(50) NOT NULL,
  new_end_date VARCHAR(50) NOT NULL,
  extension_days INT NOT NULL,
  extension_type VARCHAR(50) DEFAULT 'manual',
  reason TEXT NOT NULL,
  notes TEXT,
  created_by VARCHAR(255),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (billboard_id) REFERENCES billboards(ID),
  FOREIGN KEY (contract_number) REFERENCES contracts(Contract_Number)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Print & Cutout tasks
    `CREATE TABLE IF NOT EXISTS print_tasks (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  contract_id BIGINT,
  printer_id CHAR(36),
  invoice_id CHAR(36),
  total_cost DECIMAL(15,2) DEFAULT 0,
  customer_total_amount DECIMAL(15,2) DEFAULT 0,
  is_composite TINYINT(1) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (printer_id) REFERENCES printers(id),
  FOREIGN KEY (invoice_id) REFERENCES printed_invoices(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS print_task_items (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  task_id CHAR(36) NOT NULL,
  billboard_id BIGINT NOT NULL,
  size VARCHAR(100),
  faces INT DEFAULT 2,
  area DECIMAL(15,2) DEFAULT 0,
  cost_per_meter DECIMAL(15,2) DEFAULT 0,
  total_cost DECIMAL(15,2) DEFAULT 0,
  customer_cost DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES print_tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS cutout_tasks (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  contract_id BIGINT,
  printer_id CHAR(36),
  invoice_id CHAR(36),
  total_cost DECIMAL(15,2) DEFAULT 0,
  customer_total_amount DECIMAL(15,2) DEFAULT 0,
  is_composite TINYINT(1) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (printer_id) REFERENCES printers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS cutout_task_items (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  task_id CHAR(36) NOT NULL,
  billboard_id BIGINT NOT NULL,
  size VARCHAR(100),
  cutout_type VARCHAR(100),
  total_cost DECIMAL(15,2) DEFAULT 0,
  customer_cost DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES cutout_tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Removal tasks
    `CREATE TABLE IF NOT EXISTS removal_tasks (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  contract_id BIGINT,
  team_id CHAR(36),
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (team_id) REFERENCES installation_teams(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS removal_task_items (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  task_id CHAR(36),
  billboard_id BIGINT NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  removal_date DATE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (task_id) REFERENCES removal_tasks(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Employee tables
    `CREATE TABLE IF NOT EXISTS employee_advances (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  employee_id CHAR(36) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  advance_date DATE DEFAULT (CURRENT_DATE),
  reason TEXT,
  status VARCHAR(50) DEFAULT 'pending',
  distributed_payment_id CHAR(36),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS employee_contracts (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  employee_id CHAR(36) NOT NULL,
  contract_type VARCHAR(50) DEFAULT 'full_time',
  start_date DATE,
  end_date DATE,
  salary DECIMAL(15,2) DEFAULT 0,
  allowances DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  status VARCHAR(50) DEFAULT 'active',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS employee_deductions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  employee_id CHAR(36) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  deduction_date DATE DEFAULT (CURRENT_DATE),
  deduction_type VARCHAR(50) DEFAULT 'salary',
  reason TEXT,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS employee_manual_tasks (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  employee_id CHAR(36) NOT NULL,
  task_description TEXT NOT NULL,
  task_date DATE DEFAULT (CURRENT_DATE),
  status VARCHAR(50) DEFAULT 'pending',
  priority VARCHAR(50) DEFAULT 'normal',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS payments_salary (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  employee_id CHAR(36),
  amount DECIMAL(15,2) NOT NULL,
  payment_date DATE DEFAULT (CURRENT_DATE),
  payment_method VARCHAR(50) DEFAULT 'cash',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (employee_id) REFERENCES employees(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Invoices
    `CREATE TABLE IF NOT EXISTS invoices (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  invoice_number VARCHAR(100),
  customer_id CHAR(36),
  contract_number BIGINT,
  invoice_date DATE DEFAULT (CURRENT_DATE),
  due_date DATE,
  total_amount DECIMAL(15,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'draft',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS invoice_items (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  invoice_id CHAR(36),
  billboard_id BIGINT NOT NULL,
  description TEXT NOT NULL,
  quantity INT DEFAULT 1,
  unit_price DECIMAL(15,2) NOT NULL,
  total_price DECIMAL(15,2),
  days_count INT,
  start_date DATE,
  end_date DATE,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS sales_invoices (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  invoice_number VARCHAR(100),
  invoice_name VARCHAR(255),
  customer_id CHAR(36),
  customer_name VARCHAR(255),
  invoice_date DATE DEFAULT (CURRENT_DATE),
  total_amount DECIMAL(15,2) DEFAULT 0,
  items JSON,
  notes TEXT,
  status VARCHAR(50) DEFAULT 'draft',
  paid TINYINT(1) DEFAULT 0,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS sales_invoice_payments (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  invoice_id CHAR(36),
  amount DECIMAL(15,2) NOT NULL,
  payment_date DATE DEFAULT (CURRENT_DATE),
  payment_method VARCHAR(50) DEFAULT 'cash',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES sales_invoices(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS purchase_invoices (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  invoice_number VARCHAR(100),
  supplier_name VARCHAR(255),
  supplier_id CHAR(36),
  invoice_date DATE DEFAULT (CURRENT_DATE),
  total_amount DECIMAL(15,2) DEFAULT 0,
  paid_amount DECIMAL(15,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'unpaid',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS purchase_invoice_items (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  invoice_id CHAR(36),
  description TEXT NOT NULL,
  quantity INT DEFAULT 1,
  unit_price DECIMAL(15,2) DEFAULT 0,
  total_price DECIMAL(15,2) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES purchase_invoices(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS purchase_invoice_payments (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  invoice_id CHAR(36),
  amount DECIMAL(15,2) NOT NULL,
  payment_date DATE DEFAULT (CURRENT_DATE),
  payment_method VARCHAR(50) DEFAULT 'cash',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES purchase_invoices(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS print_invoice_payments (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  invoice_id CHAR(36),
  amount DECIMAL(15,2) NOT NULL,
  payment_date DATE DEFAULT (CURRENT_DATE),
  payment_method VARCHAR(50) DEFAULT 'cash',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (invoice_id) REFERENCES printed_invoices(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Custody transactions
    `CREATE TABLE IF NOT EXISTS custody_transactions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  custody_account_id CHAR(36) NOT NULL,
  transaction_type VARCHAR(50) NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  description TEXT,
  reference_number VARCHAR(100),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (custody_account_id) REFERENCES custody_accounts(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Friend & Partnership
    `CREATE TABLE IF NOT EXISTS friend_billboard_rentals (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  billboard_id BIGINT NOT NULL,
  contract_number BIGINT,
  friend_company_id CHAR(36),
  friend_rental_cost DECIMAL(15,2) DEFAULT 0,
  customer_rental_price DECIMAL(15,2) DEFAULT 0,
  profit DECIMAL(15,2) GENERATED ALWAYS AS (customer_rental_price - friend_rental_cost) STORED,
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY unique_billboard_contract (billboard_id, contract_number),
  FOREIGN KEY (friend_company_id) REFERENCES friend_companies(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS shared_transactions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  billboard_id BIGINT,
  contract_id BIGINT,
  partner_company_id CHAR(36),
  beneficiary VARCHAR(255),
  amount DECIMAL(15,2) DEFAULT 0,
  type VARCHAR(50) NOT NULL,
  transaction_date DATE DEFAULT (CURRENT_DATE),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (partner_company_id) REFERENCES partners(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS partnership_contract_shares (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  contract_id BIGINT,
  billboard_id BIGINT,
  partner_id CHAR(36),
  capital_deduction DECIMAL(15,2) DEFAULT 0,
  partner_share DECIMAL(15,2) DEFAULT 0,
  company_share DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (partner_id) REFERENCES partners(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Distributions & Reports
    `CREATE TABLE IF NOT EXISTS distributions (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  name VARCHAR(255) NOT NULL,
  distribution_date DATE DEFAULT (CURRENT_DATE),
  total_amount DECIMAL(15,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'draft',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS distribution_items (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  distribution_id CHAR(36),
  employee_id CHAR(36),
  amount DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (distribution_id) REFERENCES distributions(id) ON DELETE CASCADE,
  FOREIGN KEY (employee_id) REFERENCES employees(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS reports (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  title VARCHAR(255) NOT NULL,
  report_type VARCHAR(100),
  content JSON,
  created_by CHAR(36),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Booking & Discounts
    `CREATE TABLE IF NOT EXISTS booking_requests (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  customer_id CHAR(36),
  billboard_ids JSON NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  total_price DECIMAL(15,2) NOT NULL,
  status VARCHAR(50) DEFAULT 'pending',
  notes TEXT,
  admin_notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS customer_general_discounts (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  customer_id CHAR(36),
  discount_type VARCHAR(50) DEFAULT 'percentage',
  discount_value DECIMAL(15,2) DEFAULT 0,
  reason TEXT,
  valid_from DATE,
  valid_to DATE,
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS customer_purchases (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  customer_id CHAR(36),
  description TEXT NOT NULL,
  total_price DECIMAL(15,2) NOT NULL,
  purchase_date DATE DEFAULT (CURRENT_DATE),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (customer_id) REFERENCES customers(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Installation team accounts
    `CREATE TABLE IF NOT EXISTS installation_team_accounts (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  team_id CHAR(36),
  task_item_id CHAR(36) UNIQUE,
  billboard_id BIGINT,
  contract_id BIGINT,
  installation_date DATE,
  amount DECIMAL(15,2) DEFAULT 0,
  status VARCHAR(50) DEFAULT 'pending',
  payment_date DATE,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (team_id) REFERENCES installation_teams(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Settings tables
    `CREATE TABLE IF NOT EXISTS billboard_print_settings (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  setting_key VARCHAR(255) DEFAULT 'default',
  background_url TEXT,
  background_width VARCHAR(50),
  background_height VARCHAR(50),
  elements JSON,
  primary_font VARCHAR(100),
  secondary_font VARCHAR(100),
  custom_css TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS billboard_print_profiles (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  profile_name VARCHAR(255) NOT NULL,
  description TEXT,
  settings_data JSON NOT NULL,
  is_default TINYINT(1) DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS contract_template_settings (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  setting_key VARCHAR(255) NOT NULL,
  setting_value JSON NOT NULL,
  background_url TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS contract_terms (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  term_key VARCHAR(255) NOT NULL,
  term_title VARCHAR(255) NOT NULL,
  term_content TEXT NOT NULL,
  term_order INT DEFAULT 0,
  is_active TINYINT(1) DEFAULT 1,
  font_size INT,
  font_weight VARCHAR(50),
  position_x INT,
  position_y INT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    // Levels & misc
    `CREATE TABLE IF NOT EXISTS levels (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  code VARCHAR(10),
  description TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS account_closures (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  contract_id INT,
  closure_date DATE NOT NULL,
  total_withdrawn DECIMAL(15,2) DEFAULT 0,
  remaining_balance DECIMAL(15,2) DEFAULT 0,
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS maintenance_history (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  billboard_id BIGINT,
  maintenance_type VARCHAR(100),
  maintenance_date DATE DEFAULT (CURRENT_DATE),
  cost DECIMAL(15,2) DEFAULT 0,
  description TEXT,
  status VARCHAR(50) DEFAULT 'completed',
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS messaging_settings (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  provider VARCHAR(100) NOT NULL,
  api_key TEXT,
  settings JSON,
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS management_phones (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  phone_number VARCHAR(50) NOT NULL,
  label VARCHAR(255),
  is_active TINYINT(1) DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,

    `CREATE TABLE IF NOT EXISTS task_designs (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  task_id CHAR(36),
  billboard_id BIGINT,
  design_face_a_url TEXT,
  design_face_b_url TEXT,
  design_name VARCHAR(255),
  notes TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`,
  ];
}

// ========== Generate TRUNCATE statements ==========
function generateTruncateAll(): string {
  const tableNames = [
    'activity_log', 'cleanup_logs', 'task_designs', 'management_phones', 'messaging_settings',
    'maintenance_history', 'account_closures', 'levels',
    'custody_transactions', 'custody_expenses', 'custody_accounts',
    'contract_expenses', 'payroll_items', 'payroll_runs', 'payments_salary', 'printer_payments',
    'print_invoice_payments', 'purchase_invoice_payments', 'purchase_invoice_items', 'purchase_invoices',
    'sales_invoice_payments', 'sales_invoices', 'invoice_items', 'invoices',
    'distribution_items', 'distributions', 'report_items', 'reports',
    'cutout_task_items', 'cutout_tasks', 'print_task_items', 'print_tasks',
    'installation_team_accounts', 'installation_task_items', 'installation_tasks',
    'removal_task_items', 'removal_tasks', 'composite_tasks',
    'printed_invoices', 'customer_payments', 'customer_purchases', 'customer_general_discounts',
    'booking_requests', 'expenses', 'billboard_history', 'billboard_extensions', 'billboard_cost_centers',
    'billboard_print_profiles', 'billboard_print_settings', 'contract_template_settings', 'contract_terms',
    'offers', 'shared_transactions', 'shared_billboards', 'partnership_contract_shares',
    'friend_billboard_rentals', 'employee_manual_tasks', 'employee_deductions', 'employee_contracts', 'employee_advances',
    'billboards', 'contracts', 'customers', 'employees', 'printers', 'installation_teams',
    'expense_categories', 'friend_companies', 'partners', 'municipalities',
    'municipality_rent_prices', 'municipality_factors', 'category_factors',
    'installation_print_pricing', 'pricing', 'pricing_durations', 'pricing_categories',
    'base_prices', 'sizes', 'billboard_levels', 'billboard_faces', 'billboard_types',
    'system_settings', 'print_settings', 'site_theme_settings',
    'roles', 'user_roles', 'user_permissions', 'profiles'
  ];
  const lines = ['SET FOREIGN_KEY_CHECKS = 0;', ''];
  tableNames.forEach(t => lines.push(`TRUNCATE TABLE \`${t}\`;`));
  lines.push('', 'SET FOREIGN_KEY_CHECKS = 1;');
  return lines.join('\n');
}

// ========== Generate DROP statements ==========
function generateDropAll(): string {
  const tableNames = [
    'activity_log', 'cleanup_logs', 'task_designs', 'management_phones', 'messaging_settings',
    'maintenance_history', 'account_closures', 'levels',
    'custody_transactions', 'custody_expenses', 'custody_accounts',
    'contract_expenses', 'payroll_items', 'payroll_runs', 'payments_salary', 'printer_payments',
    'print_invoice_payments', 'purchase_invoice_payments', 'purchase_invoice_items', 'purchase_invoices',
    'sales_invoice_payments', 'sales_invoices', 'invoice_items', 'invoices',
    'distribution_items', 'distributions', 'report_items', 'reports',
    'cutout_task_items', 'cutout_tasks', 'print_task_items', 'print_tasks',
    'installation_team_accounts', 'installation_task_items', 'installation_tasks',
    'removal_task_items', 'removal_tasks', 'composite_tasks',
    'printed_invoices', 'customer_payments', 'customer_purchases', 'customer_general_discounts',
    'booking_requests', 'expenses', 'billboard_history', 'billboard_extensions', 'billboard_cost_centers',
    'billboard_print_profiles', 'billboard_print_settings', 'contract_template_settings', 'contract_terms',
    'offers', 'shared_transactions', 'shared_billboards', 'partnership_contract_shares',
    'friend_billboard_rentals', 'employee_manual_tasks', 'employee_deductions', 'employee_contracts', 'employee_advances',
    'billboards', 'contracts', 'customers', 'employees', 'printers', 'installation_teams',
    'expense_categories', 'friend_companies', 'partners', 'municipalities',
    'municipality_rent_prices', 'municipality_factors', 'category_factors',
    'installation_print_pricing', 'pricing', 'pricing_durations', 'pricing_categories',
    'base_prices', 'sizes', 'billboard_levels', 'billboard_faces', 'billboard_types',
    'system_settings', 'print_settings', 'site_theme_settings',
    'roles', 'user_roles', 'user_permissions', 'profiles'
  ];
  const lines = ['SET FOREIGN_KEY_CHECKS = 0;', ''];
  tableNames.forEach(t => lines.push(`DROP TABLE IF EXISTS \`${t}\`;`));
  lines.push('', 'SET FOREIGN_KEY_CHECKS = 1;');
  return lines.join('\n');
}

// ========== Component ==========

interface LogEntry {
  time: string;
  message: string;
  type: 'info' | 'success' | 'error';
}

const MySqlDatabaseManagement = () => {
  const [mode, setMode] = useState<'cloud' | 'local'>('local');
  const [host, setHost] = useState('localhost');
  const [port, setPort] = useState('3306');
  const [username, setUsername] = useState('root');
  const [password, setPassword] = useState('');
  const [dbName, setDbName] = useState('billboard_system');
  const [showPassword, setShowPassword] = useState(false);
  const [proxyUrl, setProxyUrl] = useState('http://localhost:3307');
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isExecuting, setIsExecuting] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [sqlPreview, setSqlPreview] = useState('');
  const [showSqlPreview, setShowSqlPreview] = useState(false);

  const addLog = useCallback((message: string, type: LogEntry['type'] = 'info') => {
    const time = new Date().toLocaleTimeString('ar-SA');
    setLogs(prev => [{ time, message, type }, ...prev]);
  }, []);

  const getConnectionConfig = () => ({
    host, port: parseInt(port), user: username, password, database: dbName
  });

  const executeViaProxy = async (sql: string, operation: string) => {
    const url = mode === 'local' ? proxyUrl : proxyUrl;
    try {
      const response = await fetch(`${url}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ connection: getConnectionConfig(), sql })
      });
      if (!response.ok) {
        const err = await response.text();
        throw new Error(err);
      }
      const result = await response.json();
 addLog(` ${operation} - تم بنجاح`, 'success');
      return result;
    } catch (err: any) {
 addLog(` ${operation} - ${err.message}`, 'error');
      throw err;
    }
  };

  const testConnection = async () => {
    setIsConnecting(true);
    addLog('جاري اختبار الاتصال...');
    try {
      await executeViaProxy('SELECT 1 AS test;', 'اختبار الاتصال');
      setIsConnected(true);
      toast.success('تم الاتصال بنجاح');
    } catch {
      setIsConnected(false);
      toast.error('فشل الاتصال - تأكد من تشغيل السيرفر المحلي');
    } finally {
      setIsConnecting(false);
    }
  };

  const createSchema = async () => {
    setIsExecuting(true);
    addLog('جاري إنشاء هيكل قاعدة البيانات...');
    try {
      const sql = generateMySQLSchema();
      await executeViaProxy(sql, 'إنشاء الهيكل');
      toast.success('تم إنشاء هيكل قاعدة البيانات بنجاح');
    } catch {
      toast.error('فشل إنشاء الهيكل');
    } finally {
      setIsExecuting(false);
    }
  };

  const exportSQL = () => {
    const sql = generateMySQLSchema();
    const blob = new Blob([sql], { type: 'text/sql;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mysql_schema_${new Date().toISOString().slice(0,10)}.sql`;
    a.click();
    URL.revokeObjectURL(url);
    addLog('تم تصدير ملف SQL', 'success');
    toast.success('تم تحميل ملف SQL');
  };

  const truncateAll = async () => {
 if (!confirm('️ هل أنت متأكد من حذف جميع البيانات؟ لا يمكن التراجع!')) return;
    setIsExecuting(true);
    addLog('جاري حذف جميع البيانات...');
    try {
      const sql = generateTruncateAll();
      await executeViaProxy(sql, 'حذف البيانات');
      toast.success('تم حذف جميع البيانات');
    } catch {
      toast.error('فشل حذف البيانات');
    } finally {
      setIsExecuting(false);
    }
  };

  const dropAll = async () => {
 if (!confirm('️️ هل أنت متأكد من حذف جميع الجداول؟ سيتم حذف كل شيء!')) return;
 if (!confirm('️ تأكيد نهائي: سيتم حذف جميع الجداول والبيانات بالكامل!')) return;
    setIsExecuting(true);
    addLog('جاري حذف جميع الجداول...');
    try {
      const sql = generateDropAll();
      await executeViaProxy(sql, 'حذف الجداول');
      toast.success('تم حذف جميع الجداول');
    } catch {
      toast.error('فشل حذف الجداول');
    } finally {
      setIsExecuting(false);
    }
  };

  const exportPostgresRestore = async () => {
    try {
      const response = await fetch('/database_full_restore.sql');
      if (!response.ok) throw new Error('الملف غير موجود');
      const text = await response.text();
      const blob = new Blob([text], { type: 'text/sql;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'database_full_restore.sql';
      a.click();
      URL.revokeObjectURL(url);
      addLog('تم تصدير ملف PostgreSQL الكامل', 'success');
      toast.success('تم تحميل ملف الاستعادة');
    } catch {
      toast.error('فشل تحميل الملف');
    }
  };

  const previewSQL = (type: 'create' | 'truncate' | 'drop') => {
    let sql = '';
    switch (type) {
      case 'create': sql = generateMySQLSchema(); break;
      case 'truncate': sql = generateTruncateAll(); break;
      case 'drop': sql = generateDropAll(); break;
    }
    setSqlPreview(sql);
    setShowSqlPreview(true);
  };

  const copySql = (sql: string) => {
    navigator.clipboard.writeText(sql);
    toast.success('تم نسخ SQL');
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Database className="h-7 w-7 text-primary" />
            إدارة قاعدة بيانات MySQL
          </h1>
          <p className="text-muted-foreground mt-1">ربط وإنشاء وإدارة قاعدة بيانات MySQL خارجية</p>
        </div>
      </div>

      {/* Mode Tabs */}
      <Tabs value={mode} onValueChange={(v) => setMode(v as 'cloud' | 'local')}>
        <TabsList className="grid w-full grid-cols-2 max-w-md">
          <TabsTrigger value="cloud" className="flex items-center gap-2">
            <Cloud className="h-4 w-4" />
            سحابي
          </TabsTrigger>
          <TabsTrigger value="local" className="flex items-center gap-2">
            <Monitor className="h-4 w-4" />
            محلي
          </TabsTrigger>
        </TabsList>

        <TabsContent value="cloud">
          <Alert className="border-primary/30 bg-primary/5">
            <Cloud className="h-4 w-4" />
            <AlertDescription>
              الوضع السحابي يتطلب سيرفر وسيط (Proxy) يمكنه الاتصال بقاعدة بيانات MySQL السحابية.
              أدخل عنوان الـ Proxy URL أدناه.
            </AlertDescription>
          </Alert>
        </TabsContent>

        <TabsContent value="local">
          <Alert className="border-primary/30 bg-primary/5">
            <Monitor className="h-4 w-4" />
            <AlertDescription>
              <div className="font-bold mb-1">الوضع المحلي</div>
              <div>يتطلب تشغيل السيرفر المحلي أولاً:</div>
              <code className="block mt-1 bg-muted p-2 rounded text-xs ltr" dir="ltr">
                cd mysql-local-server && npm install && node index.js
              </code>
            </AlertDescription>
          </Alert>
        </TabsContent>
      </Tabs>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Connection Settings */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Server className="h-5 w-5" />
              إعدادات الاتصال
            </CardTitle>
            <CardDescription>أدخل بيانات الاتصال بسيرفر MySQL</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {mode === 'cloud' && (
              <div className="space-y-2">
                <Label>عنوان Proxy URL</Label>
                <Input value={proxyUrl} onChange={e => setProxyUrl(e.target.value)} placeholder="https://your-proxy.example.com" />
              </div>
            )}
            {mode === 'local' && (
              <div className="space-y-2">
                <Label>عنوان السيرفر المحلي</Label>
                <Input value={proxyUrl} onChange={e => setProxyUrl(e.target.value)} placeholder="http://localhost:3307" />
              </div>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>عنوان السيرفر (Host)</Label>
                <Input value={host} onChange={e => setHost(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>المنفذ (Port)</Label>
                <Input value={port} onChange={e => setPort(e.target.value)} />
              </div>
            </div>
            <div className="space-y-2">
              <Label>اسم المستخدم</Label>
              <Input value={username} onChange={e => setUsername(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>كلمة المرور</Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>اسم قاعدة البيانات</Label>
              <Input value={dbName} onChange={e => setDbName(e.target.value)} />
            </div>
            <Button
              onClick={testConnection}
              disabled={isConnecting}
              className="w-full"
            >
              {isConnecting ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> :
                isConnected ? <CheckCircle2 className="h-4 w-4 ml-2 text-green-500" /> :
                <Play className="h-4 w-4 ml-2" />}
              اختبار الاتصال
            </Button>
          </CardContent>
        </Card>

        {/* Operations */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Database className="h-5 w-5" />
              العمليات
            </CardTitle>
            <CardDescription>إنشاء الهيكل أو حذف البيانات</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Create Schema */}
            <div className="border border-border rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Database className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-semibold text-sm">إنشاء هيكل قاعدة البيانات</div>
                  <div className="text-xs text-muted-foreground">إنشاء جميع الجداول والعلاقات والفهارس</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" onClick={createSchema} disabled={isExecuting}>
                  {isExecuting ? <Loader2 className="h-3 w-3 animate-spin ml-1" /> : <Play className="h-3 w-3 ml-1" />}
                  إنشاء الهيكل
                </Button>
                <Button size="sm" variant="outline" onClick={() => previewSQL('create')}>
                  <Eye className="h-3 w-3 ml-1" />
                  معاينة
                </Button>
              </div>
            </div>

            {/* Export SQL */}
            <div className="border border-border rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                <div>
                  <div className="font-semibold text-sm">تصدير ملف SQL</div>
                  <div className="text-xs text-muted-foreground">تحميل هيكل قاعدة البيانات كملف SQL</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" onClick={exportSQL}>
                  <Download className="h-3 w-3 ml-1" />
                  تصدير MySQL
                </Button>
                <Button size="sm" variant="outline" onClick={exportPostgresRestore}>
                  <FileCode className="h-3 w-3 ml-1" />
                  تصدير PostgreSQL
                </Button>
              </div>
            </div>

            {/* Truncate All */}
            <div className="border border-destructive/30 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <Trash2 className="h-5 w-5 text-destructive" />
                <div>
                  <div className="font-semibold text-sm text-destructive">حذف جميع البيانات</div>
                  <div className="text-xs text-muted-foreground">حذف جميع البيانات مع الحفاظ على هيكل الجداول</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={truncateAll} disabled={isExecuting}>
                  <Trash2 className="h-3 w-3 ml-1" />
                  حذف جميع البيانات
                </Button>
                <Button size="sm" variant="outline" onClick={() => previewSQL('truncate')}>
                  <Eye className="h-3 w-3 ml-1" />
                  معاينة
                </Button>
              </div>
            </div>

            {/* Drop All */}
            <div className="border border-destructive/50 bg-destructive/5 rounded-lg p-4 space-y-2">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive" />
                <div>
                  <div className="font-semibold text-sm text-destructive">حذف جميع الجداول</div>
                  <div className="text-xs text-muted-foreground">حذف جميع الجداول والبيانات بالكامل</div>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="destructive" onClick={dropAll} disabled={isExecuting}>
                  <AlertTriangle className="h-3 w-3 ml-1" />
                  حذف جميع الجداول
                </Button>
                <Button size="sm" variant="outline" onClick={() => previewSQL('drop')}>
                  <Eye className="h-3 w-3 ml-1" />
                  معاينة
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* SQL Preview */}
      {showSqlPreview && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <FileCode className="h-5 w-5" />
              معاينة SQL
            </CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => copySql(sqlPreview)}>
                <Copy className="h-3 w-3 ml-1" />
                نسخ
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setShowSqlPreview(false)}>
                <XCircle className="h-4 w-4" />
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-80 border border-border rounded-lg">
              <pre className="p-4 text-xs font-mono whitespace-pre-wrap ltr" dir="ltr">
                {sqlPreview}
              </pre>
            </ScrollArea>
          </CardContent>
        </Card>
      )}

      {/* Logs */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <RefreshCw className="h-4 w-4" />
            سجل العمليات
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={() => setLogs([])}>مسح السجل</Button>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-48">
            {logs.length === 0 ? (
              <p className="text-muted-foreground text-sm text-center py-8">لا توجد عمليات بعد</p>
            ) : (
              <div className="space-y-1">
                {logs.map((log, i) => (
                  <div key={i} className="flex items-start gap-2 text-sm py-1 border-b border-border/50 last:border-0">
                    <Badge variant={log.type === 'success' ? 'default' : log.type === 'error' ? 'destructive' : 'secondary'} className="text-[10px] px-1.5 shrink-0">
                      {log.time}
                    </Badge>
                    <span className={log.type === 'error' ? 'text-destructive' : log.type === 'success' ? 'text-green-600' : 'text-muted-foreground'}>
                      {log.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Local Server Setup Guide */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Server className="h-5 w-5" />
            إعداد السيرفر المحلي
          </CardTitle>
          <CardDescription>كيفية تشغيل سيرفر الوسيط للاتصال بـ MySQL</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <div className="bg-muted rounded-lg p-4 space-y-2" dir="ltr">
              <p className="text-sm font-bold text-foreground">1. Create folder: mysql-local-server/</p>
              <p className="text-sm font-bold text-foreground">2. Create package.json:</p>
              <pre className="text-xs bg-background p-3 rounded border border-border overflow-x-auto">{`{
  "name": "mysql-proxy",
  "dependencies": {
    "express": "^4.18.2",
    "mysql2": "^3.6.0",
    "cors": "^2.8.5"
  }
}`}</pre>
              <p className="text-sm font-bold text-foreground mt-2">3. Create index.js:</p>
              <pre className="text-xs bg-background p-3 rounded border border-border overflow-x-auto">{`const express = require('express');
const mysql = require('mysql2/promise');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

app.post('/execute', async (req, res) => {
  const { connection: config, sql } = req.body;
  let conn;
  try {
    conn = await mysql.createConnection({
      host: config.host,
      port: config.port,
      user: config.user,
      password: config.password,
      database: config.database,
      multipleStatements: true
    });
    const [rows] = await conn.query(sql);
    res.json({ success: true, data: rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    if (conn) await conn.end();
  }
});

app.listen(3307, () => {
  console.log('MySQL Proxy running on port 3307');
});`}</pre>
              <p className="text-sm font-bold text-foreground mt-2">4. Run:</p>
              <pre className="text-xs bg-background p-3 rounded border border-border">cd mysql-local-server && npm install && node index.js</pre>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MySqlDatabaseManagement;
