-- Fix overly permissive RLS policies on custody-related tables
-- These tables contain sensitive employee financial information

-- Drop existing permissive policies
DROP POLICY IF EXISTS "Authenticated users view custody accounts" ON public.custody_accounts;
DROP POLICY IF EXISTS "Authenticated users view custody transactions" ON public.custody_transactions;
DROP POLICY IF EXISTS "Authenticated users view custody expenses" ON public.custody_expenses;

-- Create restricted policies - only admins can view all custody data
-- (Note: employee_id in custody_accounts is a UUID referencing employees table, not auth.users)
-- Since employees are not directly linked to auth.users, only admins should have access

-- custody_accounts: Admin-only access (already has admin manage policy, so just restrict SELECT)
CREATE POLICY "Admins view all custody accounts"
  ON public.custody_accounts FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- custody_transactions: Admin-only access
CREATE POLICY "Admins view all custody transactions"
  ON public.custody_transactions FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- custody_expenses: Admin-only access  
CREATE POLICY "Admins view all custody expenses"
  ON public.custody_expenses FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));