-- Add payment_method column to printed_invoices table
ALTER TABLE printed_invoices 
ADD COLUMN IF NOT EXISTS payment_method TEXT;