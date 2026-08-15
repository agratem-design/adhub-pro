
-- Add marketer role to enum
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'marketer';

-- Add marketer role to roles table
INSERT INTO roles (name, display_name, description, permissions) VALUES
('marketer', 'مسوّق', 'مسوّق - يرى عقوده وحساباته فقط، يمكنه إنشاء عروض وطباعة', ARRAY[
  'dashboard','contracts','offers','offers_edit','billboards','customers','customer_billing',
  'booking_requests','booking_requests_edit','reports'
])
ON CONFLICT (name) DO UPDATE SET display_name = EXCLUDED.display_name, description = EXCLUDED.description, permissions = EXCLUDED.permissions;

-- Add linked_customer_id column to profiles for linking user to customer
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS linked_customer_id uuid REFERENCES public.customers(id);
